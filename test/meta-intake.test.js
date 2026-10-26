import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createApp} from '../src/lib/http-kit.js';
import {createMetaIntakeRoutes} from '../src/routes/meta-intake.js';
import {applySequenceEvent} from '../src/lead-follow-up-domain.js';
const env={META_INTAKE_ENABLED:'true',META_APP_SECRET:'synthetic-app-secret-'.repeat(3),
 META_WEBHOOK_VERIFY_TOKEN:'synthetic-verify-token-'.repeat(3),META_ALLOWED_PAGE_IDS:'100'};
const payload={object:'page',entry:[{id:'100',changes:[{field:'leadgen',value:{page_id:'100',leadgen_id:'200',form_id:'300',created_time:1793066400}}]}]};
function fakeTransaction() {
 const rows=new Map();let calls=0;
 const transaction=async work=>{
   calls++;const snapshot=new Map(rows);
   const client={query:async(sql,p)=>{
     if(sql.startsWith('INSERT')){
       const key=p[1]+':'+p[2];if(rows.has(key))return {rows:[]};
       const row={id:p[0],state:'pending_retrieval',reference_digest:p[4]};rows.set(key,row);return {rows:[row]};
     }
     return {rows:rows.has(p[0]+':'+p[1])?[rows.get(p[0]+':'+p[1])]:[]};
   }};
   try{return await work(client);}catch(e){rows.clear();for(const [k,v]of snapshot)rows.set(k,v);throw e;}
 };
 return {transaction,rows,calls:()=>calls};
}
async function start(t,options={}) {
 const fake=fakeTransaction(),app=createApp();app.mount('/api',createMetaIntakeRoutes({transaction:fake.transaction,env,...options}));
 const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return {...fake,url:`http://127.0.0.1:${server.address().port}/api/intake/meta`};
}
function signed(body) {return {'Content-Type':'application/json','x-hub-signature-256':'sha256='+crypto.createHmac('sha256',env.META_APP_SECRET).update(body).digest('hex')};}
test('Meta endpoint is disabled without exact feature configuration',async t=>{
 const api=await start(t,{env:{}});assert.equal((await fetch(api.url,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}})).status,503);
 assert.equal(api.calls(),0);
});
test('Meta verification challenge requires correct separate token',async t=>{
 const api=await start(t),q=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':env.META_WEBHOOK_VERIFY_TOKEN,'hub.challenge':'12345'});
 const result=await fetch(api.url+'?'+q);assert.equal(result.status,200);assert.equal(await result.text(),'12345');
 q.set('hub.verify_token','wrong');assert.equal((await fetch(api.url+'?'+q)).status,403);assert.equal(api.calls(),0);
});
test('signed receipts deduplicate, reject altered replay and expose no source/customer details',async t=>{
 const api=await start(t),body=JSON.stringify(payload);
 for(let i=0;i<2;i++){
 const response=await fetch(api.url,{method:'POST',body,headers:signed(body)});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{status:'durably_received',count:1});
 }
 assert.equal(api.rows.size,1);
 const altered=structuredClone(payload);altered.entry[0].changes[0].value.form_id='301';const changed=JSON.stringify(altered);
 assert.equal((await fetch(api.url,{method:'POST',body:changed,headers:signed(changed)})).status,409);
 assert.equal(api.rows.size,1);
});
test('invalid signature and unapproved page never access persistence',async t=>{
 const api=await start(t),body=JSON.stringify(payload);
 assert.equal((await fetch(api.url,{method:'POST',body,headers:{...signed(body),'x-hub-signature-256':'invalid'}})).status,401);
 const other=JSON.stringify({...payload,entry:[{...payload.entry[0],id:'999'}]});
 assert.equal((await fetch(api.url,{method:'POST',body:other,headers:signed(other)})).status,400);assert.equal(api.calls(),0);
});
test('database failure is retryable and does not leak internal error text',async t=>{
 const api=await start(t,{transaction:async()=>{throw new Error('sensitive internal parameters');}}),body=JSON.stringify(payload);
 const response=await fetch(api.url,{method:'POST',body,headers:signed(body)});
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'META_RECEIPT_UNAVAILABLE'});
});
test('Meta body bound applies before parsing/persistence',async t=>{
 const api=await start(t),body=JSON.stringify({oversize:'x'.repeat(256*1024)});
 assert.equal((await fetch(api.url,{method:'POST',body,headers:signed(body)})).status,413);assert.equal(api.calls(),0);
});
test('unknown outcome cannot be reopened by a reply before reconciliation, but opt-out still applies',()=>{
 const current={state:'outcome_unknown',generation:2};
 assert.equal(applySequenceEvent(current,{type:'reply',generation:2}).ignored,true);
 assert.equal(applySequenceEvent(current,{type:'opt_out',generation:2}).state,'opted_out');
});
