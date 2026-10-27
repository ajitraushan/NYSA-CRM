import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {openNonvoiceCase,applyNonvoiceEvent,claimNonvoiceJobs,expireNonvoiceClaims} from '../src/nonvoice-follow-up-store.js';
import {persistMetaReferences} from '../src/lead-source-inbox.js';
import {createApp} from '../src/lib/http-kit.js';
import {createLeadIntegrationSetupRoutes} from '../src/routes/lead-integration-setup.js';
import {acceptRetrievedMetaLead,readLeadEvidence} from '../src/meta-lead-retrieval.js';
import {dispatchAiReplies} from '../src/nonvoice-chat-dispatch.js';
import {saveLeadConnection,leadConnectionEnvironment} from '../src/lead-integration-connections.js';
import {prepareAiReply,draftAiBookingResponse} from '../src/nonvoice-ai-chat.js';
import {reserveMessageBudget,recordMessageSubmission} from '../src/nonvoice-message-dispatch.js';
import {createLeadChannelInboxRoutes,processLeadChannelInbox} from '../src/routes/lead-channel-inbox.js';
import crypto from 'node:crypto';
import {listResponseCases,scopedResponseCase,decideResponseTier,takeOverResponseCase,bookResponseCallback,releaseDependentMessages,responseMetrics} from '../src/nonvoice-response-workflow.js';
import {escalateOverdueHotResponses} from '../src/nonvoice-recovery.js';
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
 let baselineSnapshots=null,baselinePreserved=false;
 const snapshot=async(c,tables)=>{const result={};for(const name of tables){const quoted='"'+name.replaceAll('"','""')+'"';result[name]=(await c.query(`SELECT COUNT(*)::int AS count,md5(COALESCE(string_agg(row_to_json(x)::text,'' ORDER BY row_to_json(x)::text),'')) AS digest FROM ${quoted} x`)).rows[0];}return result;};
 await tx(async c=>{
  await c.query('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const file of (await fs.readdir(new URL('../src/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
   try {await c.query(await fs.readFile(new URL('../src/migrations/'+file,import.meta.url),'utf8'));}
   catch(e){throw new Error(`Synthetic migration failed: ${file}; code ${e.code}; constraint ${e.constraint||'none'}`);}
   await c.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[file]);
   if(file.startsWith('140_')){
    const owner=randomUUID(),team=randomUUID(),contact=randomUUID(),lead=randomUUID();
    await c.query("INSERT INTO teams(id,name) VALUES($1,'Synthetic preserved team')",[team]);
    await c.query("INSERT INTO brokers(id,name,email,role,job_role,password_hash,team_id) VALUES($1,'Synthetic preserved owner','baseline@example.invalid','internal_broker','sales_agent','synthetic-preserved-password-marker',$2)",[owner,team]);
    await c.query("INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,'Synthetic preserved contact','baseline-contact@example.invalid','other',$2,$2)",[contact,owner]);
    await c.query("INSERT INTO leads(id,contact_id,title,source,business_type,assigned_team_id,assigned_to,assignment_status,created_by) VALUES($1,$2,'Synthetic preserved lead','Social media','Unconfirmed',$3,$4,'assigned',$4)",[lead,contact,team,owner]);
    const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename<>'schema_migrations' ORDER BY tablename",[schema])).rows.map(row=>row.tablename);
    baselineSnapshots=await snapshot(c,tables);
   }

  }
  assert.deepEqual(await snapshot(c,Object.keys(baselineSnapshots)),baselineSnapshots);baselinePreserved=true;
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
  await c.query(`INSERT INTO contacts(id,full_name,email,phone,created_by) VALUES($1,'Synthetic enquiry','enquiry@example.invalid','+919900000005',$2)`,[contactId,ids.actor]);
  await c.query(`INSERT INTO leads(id,contact_id,title,source,business_type,created_by) VALUES($1,$2,'Synthetic enquiry','Social media','Unconfirmed',$3)`,[leadId,contactId,ids.actor]);
  await c.query(`INSERT INTO lead_source_inbox(id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,source_created_at,state,lead_id)
   VALUES($1,'meta','100',$2,'300',$3,NOW(),'accepted',$4)`,[sourceId,sourceId,'a'.repeat(64),leadId]);
  const input={sourceInboxId:sourceId,leadId,fallbackOwnerId:ids.owner,actorId:ids.actor,country:'IN',timeZone:'Asia/Kolkata',locationConfirmed:true,
   consent:{statementVersion:'meta-v2',evidenceRef:'evidence:synthetic',whatsapp:true,email:true},...patch};
  return {input,sourceId,contactId,leadId,case:await openNonvoiceCase(input,c)};
 });
 await t.test('all migrations apply and additive schema starts empty',async()=>{
  const result=await tx(c=>c.query('SELECT COUNT(*)::int AS n FROM schema_migrations'));
  assert.equal(result.rows[0].n,154);assert.equal(baselinePreserved,true);assert.ok(Object.keys(baselineSnapshots).length>100);
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
 }); await t.test('Meta retrieval output atomically links CRM records and encrypted evidence without guessed classification',async()=>{
  const source=await tx(async c=>{const ref={pageId:'100',eventId:'900000000000001',formId:'300',sourceCreatedAt:'2026-10-27T06:00:00Z'};return (await persistMetaReferences([ref],c))[0];});
  const mapping={pageIds:['100'],formIds:['300'],statementVersion:'consent-v2',consentField:'permission',consentAcceptedValue:'yes',countryField:'country',timeZoneField:'timezone',budgetField:'budget'};
  const data={id:'900000000000001',form_id:'300',field_data:[{name:'full_name',values:['Synthetic Meta Enquiry']},{name:'phone_number',values:['+919900000001']},{name:'email',values:['meta@example.invalid']},{name:'country',values:['IN']},{name:'timezone',values:['Asia/Kolkata']},{name:'permission',values:['yes']},{name:'budget',values:['Not yet decided']}]};
  const input={sourceId:source.receiptRef,data,mapping,actorId:ids.actor,ownerId:ids.owner,evidenceKey:'a'.repeat(64)};
  const result=await tx(c=>acceptRetrievedMetaLead(input,c));assert.equal(result.status,'ready');
  assert.equal((await tx(c=>acceptRetrievedMetaLead(input,c))).duplicate,true);
  const evidence=await tx(c=>c.query('SELECT encrypted_payload FROM lead_response_evidence WHERE source_inbox_id=$1',[source.receiptRef]));
  assert.ok(!evidence.rows[0].encrypted_payload.includes('meta@example.invalid'));assert.deepEqual(readLeadEvidence(evidence.rows[0].encrypted_payload,'a'.repeat(64)),data);
  const lead=await tx(c=>c.query('SELECT business_type,temperature,assigned_to FROM leads WHERE id=$1',[result.leadId]));
  assert.equal(lead.rows[0].business_type,'Unconfirmed');assert.equal(lead.rows[0].temperature,'Unassessed');assert.equal(lead.rows[0].assigned_to,null);
 });
 await t.test('response board and tier decisions preserve scope and authoritative qualification',async()=>{
  const f=await fixture(),broker={id:ids.owner,role:'internal_broker',jobRole:'sales_agent'};
  assert.ok((await tx(c=>listResponseCases(broker,c))).some(r=>r.id===f.case.id));
  await assert.rejects(()=>tx(c=>scopedResponseCase(f.case.id,{id:ids.admin,role:'admin',jobRole:'admin'},c)),/Operational/);
  const result=await tx(c=>decideResponseTier({caseId:f.case.id,tier:'Warm',reason:'Customer requested later follow-up',dimensions:{timing:2,requirements:2,budget:1,nextAction:2}},broker,c));assert.equal(result.suggestion.suggestedTier,'Warm');
  const lead=await tx(c=>c.query('SELECT temperature FROM leads WHERE id=$1',[f.leadId]));assert.equal(lead.rows[0].temperature,'Unassessed'); // Existing governed default unchanged.
 });
 await t.test('callback booking is idempotent and concurrent cases cannot double-book the owner',async()=>{
  const a=await fixture(),b=await fixture(),broker={id:ids.owner,role:'internal_broker',jobRole:'sales_agent'};
  const day=new Date();day.setUTCDate(day.getUTCDate()+2);day.setUTCHours(7,0,0,0);const startsAt=day.toISOString();
  const results=await Promise.allSettled([tx(c=>bookResponseCallback({caseId:a.case.id,startsAt,confirmed:true},broker,c)),tx(c=>bookResponseCallback({caseId:b.case.id,startsAt,confirmed:true},broker,c))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const winner=results[0].status==='fulfilled'?a:b;
  assert.equal((await tx(c=>bookResponseCallback({caseId:winner.case.id,startsAt,confirmed:true},broker,c))).duplicate,true);
  await tx(c=>takeOverResponseCase(winner.case.id,broker,c));
  const lead=await tx(c=>c.query('SELECT assigned_to FROM leads WHERE id=$1',[winner.leadId]));assert.equal(lead.rows[0].assigned_to,ids.owner);
 });
 await t.test('verified prerequisite releases nonvoice steps once and defers into local hours',async()=>{
  const f=await fixture();
  assert.equal((await tx(c=>releaseDependentMessages({caseId:f.case.id,kind:'first_missed_call',anchorAt:'2026-10-25T20:00:00Z'},c))).released,1);
  assert.equal((await tx(c=>releaseDependentMessages({caseId:f.case.id,kind:'first_missed_call',anchorAt:'2026-10-25T20:00:00Z'},c))).duplicate,true);
  const job=await tx(c=>c.query('SELECT due_at FROM lead_follow_up_jobs WHERE case_id=$1 AND step=2',[f.case.id]));assert.equal(new Date(job.rows[0].due_at).toISOString(),'2026-10-26T03:30:00.000Z');
  assert.equal((await tx(c=>releaseDependentMessages({caseId:f.case.id,kind:'first_call_day3',anchorAt:'2026-10-25T08:00:00Z'},c))).released,2);
  const day3=await tx(c=>c.query('SELECT step,due_at FROM lead_follow_up_jobs WHERE case_id=$1 AND step IN (6,7) ORDER BY step',[f.case.id]));
  assert.equal(new Date(day3.rows[0].due_at).toISOString(),'2026-10-27T04:30:00.000Z');assert.equal(new Date(day3.rows[1].due_at).toISOString(),'2026-10-27T12:30:00.000Z');
 }); await t.test('messaging cap is transactionally reserved and inbound reply is bound to a real sent message',async()=>{
  await tx(c=>c.query('UPDATE lead_integration_setup SET paused=FALSE')); // Synthetic transport tests only; no live credentials or external requests.
  const fixtures=await Promise.all([fixture(),fixture()]);
  const jobs=[];
  for(const f of fixtures){jobs.push(await tx(async c=>{const job=(await c.query('SELECT id FROM lead_follow_up_jobs WHERE case_id=$1 AND step=0',[f.case.id])).rows[0];const lease=randomUUID();await c.query("UPDATE lead_follow_up_jobs SET state='claimed',lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",[job.id,lease]);return {jobId:job.id,leaseToken:lease};}));}
  const results=await Promise.allSettled(jobs.map(job=>tx(c=>reserveMessageBudget({...job,maxCostUsd:6},c))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const win=results.findIndex(r=>r.status==='fulfilled'),attempt=results[win].value.attempt;
  await tx(c=>c.query('UPDATE contacts SET phone=$2 WHERE id=$1',[fixtures[win].contactId,'+919900000002']));
  assert.equal((await tx(c=>reserveMessageBudget({...jobs[win],maxCostUsd:6},c))).duplicate,true);
  await tx(c=>recordMessageSubmission({attemptId:attempt.id,outcome:'accepted',providerRef:'provider:synthetic-001'},c));
  const env={LEAD_CHANNEL_INBOX_ENABLED:'true',LEAD_CHANNEL_RELAY_SECRET:'synthetic-relay-secret-'.repeat(3),LEAD_EVIDENCE_KEY:'a'.repeat(64),LEAD_CHANNEL_CONNECTION_REF:'whatsapp:synthetic'};
  const app=createApp();app.mount('/api',createLeadChannelInboxRoutes({transaction:tx,env}));const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
  try{
   const url=`http://127.0.0.1:${server.address().port}/api/providers/lead-response/events`,body=JSON.stringify({provider:'whatsapp',connectionRef:'whatsapp:synthetic',eventRef:'inbound:001',messageRef:'provider:synthetic-001',type:'opt_out',sender:'+919900000002',text:'STOP'}),timestamp=String(Date.now());
   const headers={'Content-Type':'application/json','x-nysa-timestamp':timestamp,'x-nysa-signature':'sha256='+crypto.createHmac('sha256',env.LEAD_CHANNEL_RELAY_SECRET).update(timestamp+'.'+body).digest('hex')};
   assert.equal((await fetch(url,{method:'POST',body,headers:{...headers,'x-nysa-signature':'forged'}})).status,401);
   for(let n=0;n<2;n++)assert.equal((await fetch(url,{method:'POST',body,headers})).status,200);
   const inbox=await tx(c=>c.query("SELECT id,encrypted_payload FROM lead_response_provider_inbox WHERE event_ref='inbound:001'"));assert.equal(inbox.rows.length,1);assert.ok(!inbox.rows[0].encrypted_payload.includes('STOP'));
   const applied=await tx(c=>processLeadChannelInbox({id:inbox.rows[0].id,evidenceKey:env.LEAD_EVIDENCE_KEY},c));assert.equal(applied.state,'opted_out');
   const contact=await tx(c=>c.query('SELECT do_not_contact FROM contacts WHERE id=$1',[fixtures[win].contactId]));assert.equal(contact.rows[0].do_not_contact,1);
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
 });
 await t.test('AI replies reserve cost, redact identity and are invalidated by opt-out during model processing',async()=>{
  const f=await fixture(),attemptId=randomUUID(),messageRef='synthetic:ai-source:'+randomUUID(),inboxId=randomUUID();
  await tx(async c=>{
   const day=(await c.query("SELECT (NOW() AT TIME ZONE 'Asia/Dubai')::date AS day")).rows[0].day;
   const job=(await c.query('SELECT id FROM lead_follow_up_jobs WHERE case_id=$1 AND step=0',[f.case.id])).rows[0];
   await c.query(`INSERT INTO lead_response_message_attempts(id,job_id,budget_day,reserved_usd,state,provider_ref) VALUES($1,$2,$3,0.01,'accepted',$4)`,[attemptId,job.id,day,messageRef]);
   const event={provider:'whatsapp',sender:'+919900000005',connectionRef:'whatsapp:synthetic',eventRef:'reply:'+inboxId,messageRef,type:'reply',text:'Please arrange a callback. My email is test@example.invalid'};
   const {sealLeadEvidence}=await import('../src/meta-lead-retrieval.js');
   await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,state,expires_at)
    VALUES($1,'whatsapp',$2,'whatsapp:synthetic',$3,$4,'processed',NOW()+INTERVAL '12 months')`,[inboxId,event.eventRef,'a'.repeat(64),sealLeadEvidence(event,'a'.repeat(64))]);
   await applyNonvoiceEvent({caseId:f.case.id,connectionRef:event.connectionRef,eventRef:event.eventRef,type:'reply',generation:1},c);
  });
  const result=await prepareAiReply({inboxId,evidenceKey:'a'.repeat(64),aiEnabled:true,maxCostUsd:0.2,transaction:tx,request:async input=>{
   assert.equal(input.maxOutputTokens,768);assert.ok(!input.input.customerText.includes('test@example.invalid'));
   await tx(c=>applyNonvoiceEvent({caseId:f.case.id,connectionRef:'whatsapp:synthetic',eventRef:randomUUID(),type:'opt_out',generation:2},c));
   return {result:{reply:'What callback time suits you?',language:'English',requestHuman:false,requestedBooking:true,dimensions:{timing:null,requirements:null,budget:null,nextAction:3}}};
  }});
  assert.equal(result.state,'cancelled');
  const draft=await tx(c=>c.query('SELECT state FROM lead_response_chat_drafts WHERE id=$1',[result.id]));assert.equal(draft.rows[0].state,'cancelled');
 });

 await t.test('protected UI connection storage never returns credentials and pause blocks resume without activation',async()=>{
  const saved=await tx(c=>saveLeadConnection({provider:'email',body:{password:'synthetic-mailbox-password'},actorId:ids.admin,key:'b'.repeat(64)},c));
  assert.equal(saved.credentialsSaved,true);assert.ok(!JSON.stringify(saved).includes('synthetic-mailbox-password'));
  const stored=await tx(c=>c.query("SELECT encrypted_credentials FROM lead_integration_connections WHERE provider='email'"));assert.ok(!stored.rows[0].encrypted_credentials.includes('synthetic-mailbox-password'));
  assert.equal((await tx(c=>leadConnectionEnvironment(c,'b'.repeat(64)))).LEAD_EMAIL_PASSWORD,'synthetic-mailbox-password');
  const app=createApp();app.mount('/api',createLeadIntegrationSetupRoutes({transaction:tx,requireAuth:(req,res,next)=>{req.broker={id:ids.admin,role:'admin'};next();},env:{}}));
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
  try{const url=`http://127.0.0.1:${server.address().port}/api/admin/lead-integrations`;
   assert.equal((await fetch(url+'/pause',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paused:true,confirmed:true})})).status,200);
   assert.equal((await fetch(url+'/pause',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paused:false,confirmed:true})})).status,409);
   const result=await (await fetch(url+'/setup')).json();assert.equal(result.paused,true);assert.equal(result.liveSendingEnabled,false);assert.ok(!JSON.stringify(result).includes('synthetic-mailbox-password'));
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
  await tx(c=>c.query('UPDATE lead_integration_setup SET paused=FALSE')); // Restore synthetic test-only dispatch control.
 });
 await t.test('nonvoice journey: reply -> bounded AI response -> human callback booking',async()=>{
  const f=await fixture(),attemptId=randomUUID(),messageRef='synthetic:journey:'+randomUUID(),inboxId=randomUUID();
  await tx(async c=>{
   const day=(await c.query("SELECT (NOW() AT TIME ZONE 'Asia/Dubai')::date AS day")).rows[0].day;
   const job=(await c.query('SELECT id FROM lead_follow_up_jobs WHERE case_id=$1 AND step=0',[f.case.id])).rows[0];
   await c.query("INSERT INTO lead_response_message_attempts(id,job_id,budget_day,reserved_usd,state,provider_ref) VALUES($1,$2,$3,0.01,'accepted',$4)",[attemptId,job.id,day,messageRef]);
   const {sealLeadEvidence}=await import('../src/meta-lead-retrieval.js');
   const event={provider:'whatsapp',sender:'+919900000005',connectionRef:'whatsapp:synthetic',eventRef:'journey:'+inboxId,messageRef,type:'reply',text:'Please arrange a callback',occurredAt:new Date().toISOString()};
   await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,state,expires_at)
     VALUES($1,'whatsapp',$2,'whatsapp:synthetic',$3,$4,'processed',NOW()+INTERVAL '12 months')`,[inboxId,event.eventRef,'a'.repeat(64),sealLeadEvidence(event,'a'.repeat(64))]);
   await applyNonvoiceEvent({caseId:f.case.id,connectionRef:event.connectionRef,eventRef:event.eventRef,type:'reply',generation:1},c);
  });
  const draft=await prepareAiReply({inboxId,evidenceKey:'a'.repeat(64),aiEnabled:true,maxCostUsd:0.1,transaction:tx,request:async()=>({result:{reply:'What callback time suits you?',language:'English',requestHuman:false,requestedBooking:true,dimensions:{timing:null,requirements:null,budget:null,nextAction:3}}})});assert.equal(draft.state,'ready');
  const daytime=new Date();daytime.setUTCHours(8,0,0,0);if(daytime<=new Date())daytime.setUTCDate(daytime.getUTCDate()+1);
  let sent=0;const delivery=await dispatchAiReplies({transaction:tx,env:{LEAD_RESPONSE_ENVIRONMENT:'crm-test',LEAD_RESPONSE_LIVE_ENABLED:'true',LEAD_AI_CHAT_ENABLED:'true',LEAD_EVIDENCE_KEY:'a'.repeat(64)},now:()=>daytime,
    whatsappSend:async message=>{sent++;assert.equal(message.to,'+919900000005');return {providerRef:'synthetic:journey:reply'};}});
  assert.equal(delivery.submitted,1);assert.equal(sent,1);
  const broker={id:ids.owner,role:'internal_broker',jobRole:'sales_agent'},slot=new Date(daytime);slot.setUTCDate(slot.getUTCDate()+2);slot.setUTCHours(8,30,0,0);
  const booking=await tx(c=>bookResponseCallback({caseId:f.case.id,startsAt:slot.toISOString(),confirmed:true},broker,c));assert.equal(booking.status,'confirmed_callback');
  const row=await tx(c=>c.query('SELECT state FROM lead_follow_up_cases WHERE id=$1',[f.case.id]));assert.equal(row.rows[0].state,'booked');
 });
 await t.test('overdue Hot alerts the existing manager once, preserves ownership and flags missing setup',async()=>{
  const f=await fixture(),manager=randomUUID(),team=randomUUID(),at=new Date('2026-10-27T06:00:00Z');
  await tx(async c=>{
   await c.query("INSERT INTO brokers(id,name,email,role,job_role,password_hash) VALUES($1,'Synthetic manager','manager@example.invalid','internal_broker','manager','synthetic')",[manager]);
   await c.query("INSERT INTO teams(id,name,manager_id) VALUES($1,'Synthetic escalation team',$2)",[team,manager]);
   await c.query('UPDATE leads SET assigned_team_id=$2 WHERE id=$1',[f.leadId,team]);
   await c.query("UPDATE lead_follow_up_cases SET accepted_tier='Hot',handoff_requested_at=$2 WHERE id=$1",[f.case.id,at]);
  });
  assert.equal((await tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T06:29:00Z')}))).alerted,0);
  assert.equal((await tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T06:30:00Z')}))).alerted,1);
  assert.equal((await tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T07:00:00Z')}))).alerted,0);
  const row=(await tx(c=>c.query('SELECT t.assignee_id,l.assigned_to,c.fallback_owner_id FROM lead_follow_up_cases c JOIN tasks t ON t.id=c.manager_alert_task_id JOIN leads l ON l.id=c.lead_id WHERE c.id=$1',[f.case.id]))).rows[0];
  assert.equal(row.assignee_id,manager);assert.equal(row.assigned_to,null);assert.equal(row.fallback_owner_id,ids.owner);
  const missing=await fixture();await tx(c=>c.query("UPDATE lead_follow_up_cases SET accepted_tier='Hot',handoff_requested_at=$2 WHERE id=$1",[missing.case.id,at]));
  const result=await tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T07:00:00Z')}));assert.equal(result.missingManager,1);
 });

 await t.test('manager-owned Hot escalates only to a distinct active reporting manager, never self or guessed managers',async()=>{
  for(const mode of ['reporting','self','missing','inactive','admin']){
   const f=await fixture(),owner=randomUUID(),superior=randomUUID(),primaryTeam=randomUUID(),leadTeam=randomUUID();
   const at=new Date('2026-10-27T06:00:00Z');
   await tx(async c=>{
    await c.query("INSERT INTO brokers(id,name,email,role,job_role,password_hash) VALUES($1,'Synthetic owner manager',$2,'internal_broker','manager','synthetic-owner-marker')",[owner,owner+'@example.invalid']);
    await c.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Synthetic reporting manager',$2,$3,'manager',$4,'synthetic-report-marker')",[superior,superior+'@example.invalid',mode==='admin'?'admin':'internal_broker',mode==='inactive'?'revoked':'active']);
    await c.query("INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3),($4,$5,$6)",[primaryTeam,'Synthetic primary '+primaryTeam,mode==='missing'?null:mode==='self'?owner:superior,leadTeam,'Synthetic lead '+leadTeam,owner]);
    await c.query('UPDATE brokers SET team_id=$2 WHERE id=$1',[owner,primaryTeam]);
    await c.query('UPDATE leads SET assigned_to=$2,assigned_team_id=$3 WHERE id=$1',[f.leadId,mode==='reporting'?owner:null,leadTeam]);
    await c.query("UPDATE lead_follow_up_cases SET fallback_owner_id=$2,accepted_tier='Hot',handoff_requested_at=$3 WHERE id=$1",[f.case.id,owner,at]);
   });
   const before=await tx(c=>c.query('SELECT assigned_to,assigned_team_id FROM leads WHERE id=$1',[f.leadId]));
   const runs=await Promise.all([tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T06:30:00Z')})),tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T06:30:00Z')}))]);
   assert.equal(runs.reduce((n,r)=>n+r.alerted,0),1);
   const row=(await tx(c=>c.query('SELECT c.*,t.assignee_id,t.priority,t.subject FROM lead_follow_up_cases c JOIN tasks t ON t.id=c.manager_alert_task_id WHERE c.id=$1',[f.case.id]))).rows[0];
   assert.equal(row.assignee_id,mode==='reporting'?superior:owner);assert.equal(row.manager_alert_setup_missing,mode!=='reporting');assert.equal(row.priority,'urgent');assert.match(row.subject,/Overdue Hot lead/);assert.equal(row.fallback_owner_id,owner);
   assert.deepEqual((await tx(c=>c.query('SELECT assigned_to,assigned_team_id FROM leads WHERE id=$1',[f.leadId]))).rows,before.rows);
   assert.equal((await tx(c=>c.query('SELECT password_hash FROM brokers WHERE id=$1',[owner]))).rows[0].password_hash,'synthetic-owner-marker');
   if(mode==='reporting'){
    const broker={id:superior,role:'internal_broker',jobRole:'manager',managedTeamIds:[]};
    assert.equal((await tx(c=>scopedResponseCase(f.case.id,broker,c))).id,f.case.id);
    await assert.rejects(()=>tx(c=>scopedResponseCase(f.case.id,broker,c,true)),/review only/);
    assert.ok((await tx(c=>listResponseCases(broker,c))).some(r=>r.id===f.case.id));assert.equal((await tx(c=>responseMetrics(broker,c))).leads,1);
    const unrelated=await fixture();await assert.rejects(()=>tx(c=>scopedResponseCase(unrelated.case.id,broker,c)),/outside your scope/);
    await tx(c=>c.query("UPDATE tasks SET status='completed' WHERE id=$1",[row.manager_alert_task_id]));
    await assert.rejects(()=>tx(c=>scopedResponseCase(f.case.id,broker,c)),/outside your scope/);
   }
   assert.equal((await tx(c=>escalateOverdueHotResponses(c,{now:new Date('2026-10-27T07:00:00Z')}))).alerted,0);
  }
 });

});
