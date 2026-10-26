import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {openNonvoiceCase,applyNonvoiceEvent,claimNonvoiceJobs,expireNonvoiceClaims} from '../src/nonvoice-follow-up-store.js';
import {persistMetaReferences} from '../src/lead-source-inbox.js';
import {createApp} from '../src/lib/http-kit.js';
import {createLeadIntegrationSetupRoutes} from '../src/routes/lead-integration-setup.js';
const enabled=process.env.NYSA_FOLLOWUP_DB_TEST==='local-synthetic';

test('durable nonvoice workflow on dedicated synthetic PostgreSQL', {skip:!enabled}, async t=>{
 const require=createRequire(import.meta.url);
 const pg=require(process.env.NYSA_TEST_PG_PACKAGE || 'pg');
 // No ambient PG* variables, connection strings, or production configuration are read.
 const pool=new pg.Pool({host:'127.0.0.1',port:55481,user:'nysa_build_test',database:'nysa_followup_fixture',max:6});
 t.after(()=>pool.end());
 const identity=(await pool.query('SELECT current_database() AS db,current_user AS usr,inet_server_port() AS port')).rows[0];
 assert.deepEqual(identity,{db:'nysa_followup_fixture',usr:'nysa_build_test',port:55481});
 // The unique schema permits reruns without destroying any existing object or test evidence.
 const schema='followup_'+randomUUID().replaceAll('-','');
 await pool.query(`CREATE SCHEMA ${schema}`);
 const tx=async work=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO ${schema},public`);const out=await work(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
 await tx(async c=>{
  await c.query('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const file of (await fs.readdir(new URL('../src/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
   try {await c.query(await fs.readFile(new URL('../src/migrations/'+file,import.meta.url),'utf8'));}
   catch(e){throw new Error(`Synthetic migration failed: ${file}; code ${e.code}; constraint ${e.constraint||'none'}`);}
   await c.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[file]);
  }
 });
 const ids={actor:randomUUID(),owner:randomUUID(),admin:randomUUID()};
 await tx(async c=>{
  for(const [key,role,job] of [['actor','admin','admin'],['owner','internal_broker','sales_agent'],['admin','admin','admin']])
   await c.query(`INSERT INTO brokers(id,name,email,role,job_role,password_hash) VALUES($1,$2,$3,$4,$5,'synthetic-not-a-password')`,
    [ids[key],'Synthetic '+key,`${key}@example.invalid`,role,job]);
 });
 const fixture=async(patch={})=>tx(async c=>{
  const sourceId=randomUUID(),contactId=randomUUID(),leadId=randomUUID();
  await persistMetaReferences([{pageId:'100',eventId:String(Date.now())+String(Math.floor(Math.random()*1000000)),formId:'300',sourceCreatedAt:'2026-10-27T06:00:00Z'}],c);
  // This fixture represents the output of future governed Meta retrieval/linking.
  await c.query(`INSERT INTO contacts(id,full_name,email,created_by) VALUES($1,'Synthetic enquiry','enquiry@example.invalid',$2)`,[contactId,ids.actor]);
  await c.query(`INSERT INTO leads(id,contact_id,title,source,business_type,created_by) VALUES($1,$2,'Synthetic enquiry','Social media','Unconfirmed',$3)`,[leadId,contactId,ids.actor]);
  await c.query(`INSERT INTO lead_source_inbox(id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,source_created_at,state,lead_id)
   VALUES($1,'meta','100',$2,'300',$3,NOW(),'accepted',$4)`,[sourceId,sourceId,'a'.repeat(64),leadId]);
  const input={sourceInboxId:sourceId,leadId,fallbackOwnerId:ids.owner,actorId:ids.actor,country:'IN',timeZone:'Asia/Kolkata',locationConfirmed:true,
   consent:{statementVersion:'meta-v2',evidenceRef:'evidence:synthetic',whatsapp:true,email:true},...patch};
  return {input,sourceId,contactId,leadId,case:await openNonvoiceCase(input,c)};
 });
 await t.test('all migrations apply and additive schema starts empty',async()=>{
  const result=await tx(c=>c.query('SELECT COUNT(*)::int AS n FROM schema_migrations'));
  assert.equal(result.rows[0].n,143);
 });
 await t.test('case and six nonvoice jobs are atomic/idempotent, lead ownership unchanged',async()=>{
  const f=await fixture();assert.equal(f.case.state,'ready');
  const duplicate=await tx(c=>openNonvoiceCase(f.input,c));assert.equal(duplicate.id,f.case.id);assert.equal(duplicate.duplicate,true);
  const result=await tx(c=>c.query('SELECT step,state FROM lead_follow_up_jobs WHERE case_id=$1 ORDER BY step',[f.case.id]));
  assert.deepEqual(result.rows.map(r=>r.step),[0,2,3,5,6,7]);assert.equal(result.rows[0].state,'queued');
  assert.equal(result.rows.filter(r=>r.state==='waiting').length,5);
  const lead=await tx(c=>c.query('SELECT assigned_to FROM leads WHERE id=$1',[f.leadId]));assert.equal(lead.rows[0].assigned_to,null);
 });
 await t.test('nonpilot/unknown timezone and incomplete consent produce human task and no automation jobs',async()=>{
  for(const patch of [{country:'GB',timeZone:'Europe/London'},{timeZone:null},{country:'IN',timeZone:'Asia/Dubai'},{consent:{statementVersion:'v2',evidenceRef:'evidence:2',whatsapp:true}}]){
   const f=await fixture(patch);assert.equal(f.case.state,'needs_review');
   const result=await tx(c=>c.query('SELECT COUNT(*)::int AS n FROM lead_follow_up_jobs WHERE case_id=$1',[f.case.id]));assert.equal(result.rows[0].n,0);
  }
 });
 await t.test('Admin cannot be the operational fallback',async()=>{
  await assert.rejects(()=>fixture({fallbackOwnerId:ids.admin}),/OPERATIONAL_OWNER_REQUIRED/);
 });
 await t.test('reply deduplicates, cancels work and altered event conflicts',async()=>{
  const f=await fixture(),event={caseId:f.case.id,connectionRef:'whatsapp:pilot',eventRef:randomUUID(),type:'reply',generation:1};
  assert.equal((await tx(c=>applyNonvoiceEvent(event,c))).state,'engaged');
  assert.equal((await tx(c=>applyNonvoiceEvent(event,c))).duplicate,true);
  await assert.rejects(()=>tx(c=>applyNonvoiceEvent({...event,type:'booking'},c)),/ALTERED_CHANNEL_EVENT/);
  const jobs=await tx(c=>c.query('SELECT state FROM lead_follow_up_jobs WHERE case_id=$1',[f.case.id]));assert.ok(jobs.rows.every(r=>r.state==='cancelled'));
 });
 await t.test('late opt-out after a booking still restricts contact and cancels future contact',async()=>{
  const f=await fixture(),event={caseId:f.case.id,connectionRef:'email:pilot',eventRef:randomUUID(),type:'booking',generation:1};
  await tx(c=>applyNonvoiceEvent(event,c));
  assert.equal((await tx(c=>applyNonvoiceEvent({...event,eventRef:randomUUID(),type:'opt_out'},c))).state,'opted_out');
  const contact=await tx(c=>c.query('SELECT do_not_contact FROM contacts WHERE id=$1',[f.contactId]));assert.equal(contact.rows[0].do_not_contact,1);
 });
 await t.test('concurrent workers never claim the same job and disabled worker claims nothing',async()=>{
  // Pause other fixtures so this test owns the only due job.
  await tx(c=>c.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE state='queued'"));
  const f=await fixture();assert.deepEqual(await tx(c=>claimNonvoiceJobs({},c)),[]);
  const claims=await Promise.all([tx(c=>claimNonvoiceJobs({liveEnabled:true,limit:1},c)),tx(c=>claimNonvoiceJobs({liveEnabled:true,limit:1},c))]);
  assert.equal(claims.flat().length,1);assert.equal(claims.flat()[0].case_id,f.case.id);
  const event=await tx(c=>applyNonvoiceEvent({caseId:f.case.id,connectionRef:'whatsapp:pilot',eventRef:randomUUID(),type:'reply',generation:1},c));
  assert.equal(event.requiresProviderReconciliation,true);
 });
 await t.test('expired claim becomes unknown, never silently queued again',async()=>{
  const f=await fixture();await tx(c=>claimNonvoiceJobs({liveEnabled:true,limit:20},c));
  await tx(c=>c.query("UPDATE lead_follow_up_jobs SET lease_expires_at=NOW()-INTERVAL '1 minute' WHERE case_id=$1 AND state='claimed'",[f.case.id]));
  assert.equal(await tx(c=>expireNonvoiceClaims(c)),1);
  const result=await tx(c=>c.query('SELECT state FROM lead_follow_up_cases WHERE id=$1',[f.case.id]));assert.equal(result.rows[0].state,'outcome_unknown');
  assert.deepEqual(await tx(c=>claimNonvoiceJobs({liveEnabled:true},c)),[]);
 });
 await t.test('Admin setup API saves audited drafts, enforces revisions and never enables live sends',async()=>{
  const app=createApp();app.mount('/api',createLeadIntegrationSetupRoutes({transaction:tx,requireAuth:(req,res,next)=>{
   req.broker={id:ids.admin,role:req.headers['x-synthetic-role']||'admin'};next();
  }}));
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
  try{
   const url=`http://127.0.0.1:${server.address().port}/api/admin/lead-integrations/setup`;
   assert.equal((await fetch(url,{headers:{'x-synthetic-role':'internal_broker'}})).status,403);
   const initial=await (await fetch(url)).json();assert.equal(initial.revision,0);assert.equal(initial.liveSendingEnabled,false);
   const body={revision:0,pageIds:['100'],formIds:['300'],whatsappSenderRef:'pilot-number-ref',calendarConnectionRef:'sunita-calendar-ref',emailSender:'lead@nysarealty.com'};
   const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
   const saves=await Promise.all([fetch(url,options),fetch(url,options)]);assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);
   const stored=await (await fetch(url)).json();assert.equal(stored.revision,1);assert.equal(stored.draft.whatsappSenderRef,'pilot-number-ref');assert.equal(stored.liveSendingEnabled,false);
   assert.equal((await fetch(url,{...options,body:JSON.stringify({...body,revision:1,apiKey:'must-not-be-stored'})})).status,400);
   const audit=await tx(c=>c.query("SELECT COUNT(*)::int AS n FROM audit_log WHERE entity_type='LeadIntegrationSetup'"));assert.equal(audit.rows[0].n,1);
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
 });});
