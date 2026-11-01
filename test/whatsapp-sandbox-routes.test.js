import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/lib/http-kit.js';
import {createWhatsAppSandboxAdminRoutes,createWhatsAppSandboxInboxRoutes} from '../src/routes/whatsapp-sandbox.js';
import {sandboxCredentials,sandboxQuota} from '../src/whatsapp-sandbox-store.js';
import {sealLeadEvidence} from '../src/meta-lead-retrieval.js';
import crypto from 'node:crypto';
import {sandboxCallbackToken} from '../src/whatsapp-sandbox.js';

async function appFor(t,{role='admin',env={},transaction=async fn=>fn({query:async()=>{throw new Error('unexpected database access');}})}={}){
 const app=createApp();app.mount('/api',createWhatsAppSandboxAdminRoutes({requireAuth:(req,res,next)=>{req.broker={id:'synthetic',role};next();},transaction,env}));app.mount('/api',createWhatsAppSandboxInboxRoutes({transaction,env}));
 const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;
}
test('sandbox setup and ingress default closed without any database or provider call',async t=>{
 const base=await appFor(t);const status=await fetch(base+'/api/admin/whatsapp-sandbox');assert.equal(status.headers.get('cache-control'),'no-store');assert.equal((await status.json()).setupEnabled,false);
 const send=await fetch(base+'/api/admin/whatsapp-sandbox/send-test',{method:'POST',headers:{'Content-Type':'application/json','x-nysa-sandbox-action':'1'},body:'{}'});assert.equal(send.status,503);
 const ingress=await fetch(base+'/api/providers/whatsapp-sandbox/events',{method:'POST',body:'{}'});assert.equal(ingress.status,503);
});
test('Agent cannot access protected sandbox setup and browser mutations require custom action header',async t=>{
 const agent=await appFor(t,{role:'internal_broker'});assert.equal((await fetch(agent+'/api/admin/whatsapp-sandbox')).status,403);
 const admin=await appFor(t);assert.equal((await fetch(admin+'/api/admin/whatsapp-sandbox/connection',{method:'POST',body:'{}'})).status,403);
});
test('sandbox body bound rejects large requests before persistence',async t=>{
 const base=await appFor(t);const response=await fetch(base+'/api/providers/whatsapp-sandbox/events',{method:'POST',body:JSON.stringify({text:'x'.repeat(256*1024)})});assert.equal(response.status,413);
});
test('private settings validation and invalid budgets fail closed',()=>{
 for(const value of ['0','26','-1','invalid','1.5'])assert.equal(sandboxQuota({WHATSAPP_SANDBOX_REQUEST_BUDGET:value}),0);
 assert.equal(sandboxQuota({}),10);
 assert.throws(()=>sandboxCredentials({revision:0,apiKey:'synthetic',recipientKind:'phone',recipient:'+919900000001',relaySecret:'short'}),/CONFIGURATION_INVALID/);
});
test('enabled ingress requires exact signed raw bytes and never accepts an unverified native callback',async t=>{
 const secret='synthetic-relay-secret-'.repeat(3),key='a'.repeat(64);
 const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SANDBOX_SETUP_ENABLED:'true',WHATSAPP_SANDBOX_CALLBACK_APPROVED:'true',LEAD_CONNECTION_KEY:key};
 let writes=0;
 const row={id:'synthetic-connection',encrypted_credentials:sealLeadEvidence({recipientKind:'phone',recipient:'+919900000001',relaySecret:secret},key)};
 const transaction=async fn=>fn({query:async sql=>{if(sql.startsWith('SELECT * FROM wa_sandbox_connections'))return {rows:[row]};writes++;throw new Error('unexpected write');}});
 const base=await appFor(t,{env,transaction}),url=base+'/api/providers/whatsapp-sandbox/events';
 const raw=JSON.stringify({entry:[]}),timestamp=String(Date.now()),signature='sha256='+crypto.createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
 assert.equal((await fetch(url,{method:'POST',body:raw})).status,401);
 assert.equal((await fetch(url,{method:'POST',body:raw+' ',headers:{'x-nysa-timestamp':timestamp,'x-nysa-signature':signature}})).status,401);
 const valid=await fetch(url,{method:'POST',body:raw,headers:{'x-nysa-timestamp':timestamp,'x-nysa-signature':signature}});assert.equal(valid.status,200);assert.equal((await valid.json()).status,'durably_received');assert.equal(writes,0);
});
test('native header probe can receive authenticated tests while outbound remains disabled',async t=>{
 const secret='synthetic-native-secret-'.repeat(3),key='a'.repeat(64);
 const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SANDBOX_SETUP_ENABLED:'true',WHATSAPP_SANDBOX_AUTH_MODE:'basic',WHATSAPP_SANDBOX_NATIVE_PROBE_ENABLED:'true',LEAD_CONNECTION_KEY:key};
 const row={id:'synthetic',encrypted_credentials:sealLeadEvidence({recipientKind:'phone',recipient:'+919900000001',relaySecret:secret},key)};
 const transaction=async fn=>fn({query:async()=>({rows:[row]})});
 const base=await appFor(t,{env,transaction}),url=base+'/api/providers/whatsapp-sandbox/events',body=JSON.stringify({entry:[]});
 assert.equal((await fetch(url,{method:'POST',body})).status,401);
 const authorization='Basic '+Buffer.from('nysa-sandbox:'+secret).toString('base64');
 assert.equal((await fetch(url,{method:'POST',body,headers:{authorization}})).status,200);
 const send=await fetch(base+'/api/admin/whatsapp-sandbox/send-test',{method:'POST',body:'{}',headers:{'x-nysa-sandbox-action':'1'}});assert.equal(send.status,503);
});

test('authenticated rejection records only an allowlisted reason after rollback; unauthenticated requests never audit',async t=>{
 const secret='synthetic-native-secret-'.repeat(3),key='a'.repeat(64);
 const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SANDBOX_SETUP_ENABLED:'true',WHATSAPP_SANDBOX_AUTH_MODE:'basic',WHATSAPP_SANDBOX_NATIVE_PROBE_ENABLED:'true',LEAD_CONNECTION_KEY:key};
 const row={id:'synthetic',revision:1,encrypted_credentials:sealLeadEvidence({recipientKind:'phone',recipient:'+919900000001',relaySecret:secret},key)};
 const audits=[];let transactions=0;
 const transaction=async fn=>{transactions++;return fn({query:async(sql,args)=>{if(sql.startsWith('SELECT *'))return {rows:[row]};if(sql.startsWith('INSERT INTO wa_sandbox_audit')){audits.push(args);return {rows:[]};}throw Error('Unexpected query');}});};
 const base=await appFor(t,{env,transaction}),url=base+'/api/providers/whatsapp-sandbox/events',body=JSON.stringify({privateMessage:'do not record this'});
 assert.equal((await fetch(url,{method:'POST',body})).status,401);assert.equal(audits.length,0);
 const authorization='Basic '+Buffer.from('nysa-sandbox:'+secret).toString('base64');
 const r=await fetch(url,{method:'POST',body,headers:{authorization}});
 assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'SANDBOX_EVENT_INVALID'});
 assert.equal(audits.length,1);assert.deepEqual(JSON.parse(audits[0][3]),{revision:1,reason:'envelope'});
 assert.equal(transactions,3);assert.ok(!JSON.stringify(audits).includes('do not record this'));assert.ok(!JSON.stringify(audits).includes(secret));
});

test('sandbox URL token binds connection/revision and accepts minimal provider packet without live metadata',async t=>{
 const secret='synthetic-native-secret-'.repeat(3),key='a'.repeat(64);
 const credentials={recipientKind:'phone',recipient:'+919900000001',relaySecret:secret};
 const row={id:'synthetic',revision:1,encrypted_credentials:sealLeadEvidence(credentials,key)};
 const env={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SANDBOX_SETUP_ENABLED:'true',WHATSAPP_SANDBOX_AUTH_MODE:'basic',WHATSAPP_SANDBOX_NATIVE_PROBE_ENABLED:'true',LEAD_CONNECTION_KEY:key};
 const writes=[];const transaction=async fn=>fn({query:async(sql,args)=>{if(sql.startsWith('SELECT *'))return {rows:[row]};writes.push({sql,args});return {rows:[{id:'inserted'}]};}});
 const token=sandboxCallbackToken({...row,credentials});
 const base=await appFor(t,{env,transaction}),url=base+'/api/providers/whatsapp-sandbox/events/'+token;
 const packet=from=>({entry:[{changes:[{field:'messages',value:{messages:[{id:'wamid.synthetic',from,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'synthetic test'}}]}}]}]});
 const response=await fetch(url,{method:'POST',body:JSON.stringify(packet('919900000001'))});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{status:'durably_received'});assert.equal(writes.length,2);
 assert.deepEqual(JSON.parse(writes[1].args[4]),{revision:1,authMode:'path_token'});
 writes.length=0;
 assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(packet('919900000002'))})).status,400);assert.equal(writes.length,0);
 const authorization='Basic '+Buffer.from('nysa-sandbox:'+secret).toString('base64');
 for(const wrong of ['x'.repeat(64),sandboxCallbackToken({...row,revision:2,credentials})]){
  assert.equal((await fetch(base+'/api/providers/whatsapp-sandbox/events/'+wrong,{method:'POST',headers:{authorization},body:JSON.stringify(packet('919900000001'))})).status,401);
 }
 assert.equal(writes.length,0);
 assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({padding:'x'.repeat(256*1024)})})).status,413);
});
