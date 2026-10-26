import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,uuid,closeDatabase} from '../src/db.js';
import {assertDedicatedFixture} from './local-postgres-fixture/fixture-guard.mjs';
import {createApp} from '../src/lib/http-kit.js';
import finance from '../src/routes/commission-payout.js';
await assertDedicatedFixture(db);
const actors=[],tokens=[],app=createApp();app.mount('/api',finance);
const server=await new Promise(resolve=>{const s=app.listen({host:'127.0.0.1',port:0},()=>resolve(s));});
try{
 for(const job of ['accountant','sales_agent']){
  const id=uuid(),token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');actors.push(id);tokens.push({token,hash});
  await db.query("INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,'Synthetic Queue Actor',$2,'internal_broker','active','not-a-login-password',$3)",[id,`queue-${id}@example.invalid`,job]);
  await db.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')",[hash,id]);
 }
 const request=async(index,path)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{headers:{authorization:`Bearer ${tokens[index].token}`}});return{status:response.status,body:await response.json()};};
 for(const category of ['invoice-awaiting','invoice-issued','invoice-changes','collection-unpaid','collection-part','collection-overdue','collection-paid','payout-prepare','payout-ready','payout-pending','payout-approved','payout-paid','statements','advice-generated','advice-pending','advice-failed']){
  const result=await request(0,`/finance/workspace/queue?category=${category}&q=SYNTHETIC&size=25&from=2000-01-01`);assert.equal(result.status,200,category);assert.ok(result.body.items.length<=25);
 }
 for(const query of ['size=100000','from=2026-02-30','agentId=bad','quarter=2026-Q5','currency=invalid'])assert.equal((await request(0,`/finance/workspace/queue?category=statements&${query}`)).status,400);
 for(const group of ['invoices','collections','payouts','statements','advice']){const result=await request(0,'/finance/workspace/counts?group='+group);assert.equal(result.status,200);assert.ok(Object.values(result.body.counts).every(x=>Number.isInteger(x.count)));}
 assert.equal((await request(0,'/finance/workspace/counts')).status,200);
 assert.equal((await request(1,'/finance/workspace/counts?group=advice')).status,200);
 assert.equal((await request(1,'/finance/workspace/queue?category=payout-approved')).status,403);
 const own=await request(1,'/finance/workspace/queue?category=advice-generated');assert.equal(own.status,200);assert.equal(own.body.count,0);
 assert.equal((await request(1,`/finance/payout-advice/${uuid()}/document`)).status,404);
 console.log('Synthetic API checks passed: all 16 paged queues, invalid filters, finance access, own-advice scope and unknown-document privacy.');
}finally{
 server.closeAllConnections();server.close();
 for(const item of tokens)await db.query('DELETE FROM sessions WHERE token=$1',[item.hash]);
 for(const actor of actors)await db.query('DELETE FROM brokers WHERE id=$1',[actor]);
 await closeDatabase();
}
