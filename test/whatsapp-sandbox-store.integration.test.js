import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import {saveSandboxConnection,setSandboxPaused,sandboxStatus,sendSandboxTest,receiveSandboxEvents,loadSandboxConnection,configureSandboxWebhook} from '../src/whatsapp-sandbox-store.js';

const enabled=process.env.NYSA_WHATSAPP_DB_TEST==='local-synthetic';
test('sandbox durable lifecycle, quota, encryption and concurrent idempotency on isolated PostgreSQL',{skip:!enabled},async t=>{
 // Explicit fixture-only coordinates; no ambient PG settings or hosted secrets.
 const pool=new pg.Pool({host:'127.0.0.1',port:55482,user:'nysa_test_user',database:'nysa_test_fixture',connectionTimeoutMillis:3000,max:8});
 t.after(()=>pool.end());
 const identity=(await pool.query('SELECT current_database() AS db,current_user AS usr,inet_server_port() AS port,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser')).rows[0];
 assert.deepEqual(identity,{db:'nysa_test_fixture',usr:'nysa_test_user',port:55482,superuser:false});
 const schema='wa_test_'+randomUUID().replaceAll('-','');
 await pool.query(`CREATE SCHEMA ${schema}`);
 const transaction=async work=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO ${schema},public`);const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
 const actorId=randomUUID(),recipient='+919900000001';
 const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SANDBOX_SETUP_ENABLED:'true',WHATSAPP_SANDBOX_ENABLED:'true',WHATSAPP_SANDBOX_CALLBACK_APPROVED:'true',WHATSAPP_SANDBOX_REQUEST_BUDGET:'3',LEAD_CONNECTION_KEY:'a'.repeat(64)};
 const credentials={revision:0,apiKey:'synthetic-private-api-key',recipientKind:'phone',recipient,relaySecret:'synthetic-relay-secret-'.repeat(3)};
 await transaction(async c=>{
  await c.query('CREATE TABLE brokers(id UUID PRIMARY KEY)');await c.query('INSERT INTO brokers(id) VALUES($1)',[actorId]);
  const migration=await fs.readFile(new URL('../src/migrations/160_whatsapp_sandbox_foundation.sql',import.meta.url),'utf8');
  await c.query(migration.replaceAll('nysareal_nysar2app','nysa_test_user'));
 });
 await t.test('credential save is encrypted, paused, revision-checked and not returned',async()=>{
  const saved=await transaction(c=>saveSandboxConnection({body:credentials,actorId,env},c));assert.equal(saved.paused,true);
  await assert.rejects(()=>transaction(c=>saveSandboxConnection({body:credentials,actorId,env},c)),/STALE_CONFIGURATION/);
  const encrypted=(await transaction(c=>c.query('SELECT encrypted_credentials FROM wa_sandbox_connections'))).rows[0].encrypted_credentials;
  assert.ok(!encrypted.includes(credentials.apiKey));assert.ok(!encrypted.includes(recipient));
  const status=await transaction(c=>sandboxStatus(c,env));assert.ok(!JSON.stringify(status).includes(credentials.apiKey));assert.ok(!JSON.stringify(status).includes(recipient));
  await assert.rejects(()=>transaction(c=>setSandboxPaused({paused:false,actorId,env:{...env,WHATSAPP_SANDBOX_CALLBACK_APPROVED:'false'}},c)),/ACTIVATION_NOT_APPROVED/);
  const callbackEnv={...env,WHATSAPP_SANDBOX_AUTH_MODE:'basic',WHATSAPP_SANDBOX_PUBLIC_ORIGIN:'https://crm-test.nysarealty.com'};
  await assert.rejects(()=>configureSandboxWebhook({actorId,env:{...callbackEnv,WHATSAPP_SANDBOX_PUBLIC_ORIGIN:'https://example.invalid'},transaction}),/SETUP_DISABLED/);
  const connected=await configureSandboxWebhook({actorId,env:callbackEnv,transaction,fetchImpl:async(url,options)=>{
   assert.equal(url,'https://waba-sandbox.360dialog.io/v1/configs/webhook');assert.equal(options.redirect,'error');
   const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload),['url']);assert.match(payload.url,/^https:\/\/crm-test\.nysarealty\.com\/api\/providers\/whatsapp-sandbox\/events\/[a-f0-9]{64}$/);
   return new Response(JSON.stringify({url:payload.url}),{status:200});
  }});
  assert.equal(connected.callbackVerified,false);assert.equal((await transaction(c=>sandboxStatus(c,callbackEnv))).webhookConfigured,true);
  await transaction(c=>setSandboxPaused({paused:false,actorId,env},c));
 });
 let calls=0;
 const fetchImpl=async()=>{calls++;if(calls===1){
  const body={entry:[{changes:[{field:'messages',value:{statuses:[{id:'wamid.synthetic:1',recipient_id:recipient.slice(1),status:'read',timestamp:String(Math.floor(Date.now()/1000))}]}}]}]};
  await transaction(c=>receiveSandboxEvents({body,env},c));
 }await new Promise(resolve=>setTimeout(resolve,20));return new Response(JSON.stringify({messages:[{id:'wamid.synthetic:'+calls}]}),{status:201});};
 const send=body=>sendSandboxTest({body,actorId,env,transaction,fetchImpl});
 const payload={actionKey:randomUUID(),confirmed:true,type:'template',templateName:'disclaimer'};
 let firstAttemptId;
 await t.test('concurrent same-action sends submit exactly once and survive a fresh transaction',async()=>{
  const results=await Promise.all([send(payload),send(payload)]);assert.equal(calls,1);assert.equal(results[0].attemptId,results[1].attemptId);
  firstAttemptId=results[0].attemptId;
  assert.equal((await transaction(c=>sandboxStatus(c,env))).attempts[0].delivery_state,'read');
  const again=await send(payload);assert.equal(again.state,'accepted');assert.equal(calls,1);
  await assert.rejects(()=>send({...payload,templateName:'first_welcome_messsage',parameters:['Synthetic']}),/ACTION_CONFLICT/);
 });
 const event=(id,text)=>({entry:[{changes:[{field:'messages',value:{messages:[{id,from:recipient.slice(1),timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:text}}]}}]}]});
 await t.test('inbound replay is durable and altered replay rolls back atomically',async()=>{
  const body=event('wamid.inbound','Please send details');
  await transaction(c=>receiveSandboxEvents({body,env},c));await transaction(c=>receiveSandboxEvents({body,env},c));
  assert.equal((await transaction(c=>c.query("SELECT COUNT(*)::int AS count FROM wa_sandbox_events WHERE type='reply'"))).rows[0].count,1);
  const changed=structuredClone(body);changed.entry[0].changes[0].value.messages[0].text.body='Altered';
  await assert.rejects(()=>transaction(c=>receiveSandboxEvents({body:changed,env},c)),/EVENT_CONFLICT/);
 });
 await t.test('text reply uses durable inbound time and rejects a browser-supplied window',async()=>{
  const request={actionKey:randomUUID(),confirmed:true,type:'text',text:'Synthetic requested reply'};
  await assert.rejects(()=>send({...request,lastInboundAt:new Date().toISOString()}),/SEND_INVALID/);
  await assert.rejects(()=>sendSandboxTest({body:request,actorId,env:{...env,WHATSAPP_SANDBOX_CALLBACK_APPROVED:'false'},transaction,fetchImpl}),/SANDBOX_DISABLED/);
  assert.equal((await send(request)).state,'accepted');
 });
 await t.test('out-of-order callbacks preserve read state and receipt can precede stored outcome',async()=>{
  for(const status of ['read','sent','delivered','failed']){
   const body={entry:[{changes:[{field:'messages',value:{statuses:[{id:'wamid.synthetic:1',recipient_id:recipient.slice(1),status,timestamp:String(Math.floor(Date.now()/1000))}]}}]}]};
   await transaction(c=>receiveSandboxEvents({body,env},c));
  }
  const status=await transaction(c=>sandboxStatus(c,env));assert.equal(status.attempts.find(x=>x.id===firstAttemptId).delivery_state,'read');
 });
 await t.test('quota serializes different requests and same-key credential rotation cannot reset it',async()=>{
  const results=await Promise.allSettled(Array.from({length:3},()=>send({...payload,actionKey:randomUUID()})));
  // Concurrent independent sends are conservatively blocked while another is in flight.
  assert.ok(results.some(x=>x.status==='fulfilled'));assert.ok(calls<=3);
  while(calls<3)await send({...payload,actionKey:randomUUID()});
  await assert.rejects(()=>send({...payload,actionKey:randomUUID()}),/QUOTA_EXHAUSTED/);assert.equal(calls,3);
  await transaction(c=>saveSandboxConnection({body:{...credentials,revision:1},actorId,env},c));
  const status=await transaction(c=>sandboxStatus(c,env));assert.equal(status.used,3);assert.equal(status.remaining,0);assert.equal(status.paused,true);
  await assert.rejects(()=>transaction(c=>saveSandboxConnection({body:{...credentials,revision:2,recipient:'+919900000002'},actorId,env},c)),/RECIPIENT_CHANGE/);
 });
 await t.test('unknown submissions persist and cannot be blindly retried after a fresh read',async()=>{
  await transaction(c=>saveSandboxConnection({body:{...credentials,revision:2,apiKey:'synthetic-second-key'},actorId,env},c));
  await transaction(c=>setSandboxPaused({paused:false,actorId,env},c));
  let submitted=0;const request={...payload,actionKey:randomUUID()};
  const sendUnknown=body=>sendSandboxTest({body,actorId,env,transaction,fetchImpl:async()=>{submitted++;throw Error('synthetic timeout');}});
  assert.equal((await sendUnknown(request)).state,'outcome_unknown');
  assert.equal((await sendUnknown(request)).state,'outcome_unknown');assert.equal(submitted,1);
  await assert.rejects(()=>sendUnknown({...request,actionKey:randomUUID()}),/UNRESOLVED_SUBMISSION/);assert.equal(submitted,1);
 });
 await t.test('STOP pauses further sends; private content is absent from plain audit',async()=>{
  await transaction(c=>setSandboxPaused({paused:false,actorId,env},c));
  await transaction(c=>receiveSandboxEvents({body:event('wamid.stop','STOP'),env},c));
  assert.equal((await transaction(c=>sandboxStatus(c,env))).paused,true);
  await assert.rejects(()=>send({...payload,actionKey:randomUUID()}),/PAUSED_OR_CHANGED/);
  const audits=await transaction(c=>c.query('SELECT details FROM wa_sandbox_audit'));
  assert.ok(!JSON.stringify(audits.rows).includes(credentials.apiKey));assert.ok(!JSON.stringify(audits.rows).includes('Please send details'));
  const loaded=await transaction(c=>loadSandboxConnection(c,env));assert.equal(loaded.credentials.apiKey,'synthetic-second-key');
 });
});
