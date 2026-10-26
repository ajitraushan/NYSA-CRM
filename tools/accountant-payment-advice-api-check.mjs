import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db,uuid,closeDatabase} from '../src/db.js';
import {assertDedicatedFixture,quoteIdentifier} from './local-postgres-fixture/fixture-guard.mjs';
import {createApp} from '../src/lib/http-kit.js';
import finance from '../src/routes/commission-payout.js';
import {generateNextAdvice} from '../src/payout-advice.js';
import {removePrivate} from '../src/private-files.js';
await assertDedicatedFixture(db);assert.equal(db.options.max,1,'Use PGPOOL_MAX=1 so every fixture request uses its isolated schema');
const schema='acc_payment_'+uuid().replaceAll('-',''),q=quoteIdentifier,tables=['brokers','sessions','team_memberships','opportunities','deals','listings','agent_payout_calculations','agent_payout_calculation_bands','agent_payout_decision_events','agent_payout_release_events','commission_payment_batches','commission_payment_batch_items','agent_payout_advices','audit_log'];
let server,created=false;
try{
 const source=(await db.query("SELECT d.id,d.opportunity_id FROM deals d WHERE d.status='closed_won' AND d.deal_reference LIKE '%DEAL' ORDER BY d.created_at DESC LIMIT 1")).rows[0];assert.ok(source,'Create the approved synthetic Closed Won fixture first');
 await db.query(`CREATE SCHEMA ${q(schema)}`);created=true;
 for(const table of tables)await db.query(`CREATE TABLE ${q(schema)}.${q(table)} (LIKE nysa_test_user.${q(table)} INCLUDING ALL)`);
 await db.query(`SET search_path TO ${q(schema)}`);
 await db.query('ALTER TABLE agent_payout_advices ADD FOREIGN KEY(batch_id) REFERENCES commission_payment_batches(id), ADD FOREIGN KEY(agent_id) REFERENCES brokers(id)');
 await db.query('INSERT INTO deals SELECT * FROM nysa_test_user.deals WHERE id=$1',[source.id]);await db.query('INSERT INTO opportunities SELECT * FROM nysa_test_user.opportunities WHERE id=$1',[source.opportunity_id]);
 const actors=[],tokens=[];
 for(const job of ['accountant','director','sales_agent','sales_agent','sales_agent']){
  const id=uuid(),token=crypto.randomBytes(32).toString('hex');actors.push(id);tokens.push(token);
  await db.query("INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,'Synthetic Payment Agent',$2,'internal_broker','active','not-a-login-password',$3)",[id,`payment-${id}@example.invalid`,job]);
  await db.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')",[crypto.createHash('sha256').update(token).digest('hex'),id]);
 }
 const batch=uuid(),fingerprint='0'.repeat(64),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
 await db.query("INSERT INTO commission_payment_batches(id,batch_reference,currency,submitted_by,idempotency_key,status,decided_by,decided_at,decision_reason,evidence_reference) VALUES($1,$2,'AED',$3,$4,'approved',$5,NOW(),'Synthetic MD approval','SYNTHETIC-MD-APPROVAL')",[batch,'SYNTHETIC-BATCH-'+batch,actors[0],uuid(),actors[1]]);
 for(const agent of actors.slice(2)){
  const id=uuid();await db.query(`INSERT INTO agent_payout_calculations(id,payout_reference,credit_line_id,agent_id,deal_id,currency,receipt_date,quarter_key,prior_cumulative_amount,current_credited_amount,resulting_cumulative_amount,trigger_method,policy_version_id,resolved_plan_fingerprint,cumulative_context_fingerprint,agent_payout_amount,company_retained_amount,release_due_date,idempotency_key,status,calculated_by)
   VALUES($1,$2,$3,$4,$5,'AED',CURRENT_DATE,'2026-Q4',0,1000,1000,'attained_trigger',$6,$7,$7,100,900,CURRENT_DATE,$8,'approved',$9)`,[id,'SYNTHETIC-PAYOUT-'+id,uuid(),agent,source.id,uuid(),fingerprint,uuid(),actors[0]]);
  await db.query("INSERT INTO commission_payment_batch_items(id,batch_id,calculation_id,status) VALUES($1,$2,$3,'approved')",[uuid(),batch,id]);
 }
 const app=createApp();app.mount('/api',finance);server=await new Promise(resolve=>{const s=app.listen({host:'127.0.0.1',port:0},()=>resolve(s));});
 const request=async(actor,path,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${tokens[actor]}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json()};};
 const payment={idempotencyKey:uuid(),paymentDate:today,paymentReference:'SYNTHETIC-BANK-'+batch};
 assert.equal((await request(1,`/finance/commission-payment-batches/${batch}/release`,payment)).status,403);
 assert.equal((await request(2,`/finance/workspace/batches/${batch}/advice`,{})).status,403);
 const results=await Promise.all([request(0,`/finance/commission-payment-batches/${batch}/release`,payment),request(0,`/finance/commission-payment-batches/${batch}/release`,payment)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM agent_payout_release_events')).rows[0].count,3);
 let advice=(await db.query('SELECT * FROM agent_payout_advices ORDER BY agent_id')).rows;assert.equal(advice.length,3);assert.ok(advice.every(x=>Number(x.input_snapshot.total)===100&&x.input_snapshot.items.length===1));
 await generateNextAdvice({render:async()=>{throw new Error('Synthetic renderer failure');}});
 assert.equal((await db.query('SELECT payment_status FROM commission_payment_batches WHERE id=$1',[batch])).rows[0].payment_status,'paid');
 const failed=(await db.query("SELECT id FROM agent_payout_advices WHERE status='failed'")).rows[0];assert.ok(failed);assert.equal((await request(0,`/finance/payout-advice/${failed.id}/retry`,{})).status,200);
 const render=async()=>Buffer.from('%PDF-SYNTHETIC-PRIVATE-ADVICE');await Promise.all([generateNextAdvice({render}),generateNextAdvice({render}),generateNextAdvice({render})]);
 advice=(await db.query('SELECT * FROM agent_payout_advices')).rows;assert.ok(advice.every(x=>x.status==='generated'));
 const own=advice.find(x=>x.agent_id===actors[2]),other=advice.find(x=>x.agent_id===actors[3]);assert.equal((await request(2,'/finance/workspace/queue?category=advice-generated')).body.count,1);
 assert.equal((await request(2,`/finance/payout-advice/${other.id}/document`)).status,404);
 const document=await fetch(`http://127.0.0.1:${server.address().port}/api/finance/payout-advice/${own.id}/document`,{headers:{authorization:`Bearer ${tokens[2]}`}});assert.equal(document.status,200);assert.equal(document.headers.get('content-type'),'application/pdf');
 assert.equal((await request(0,`/finance/workspace/batches/${batch}/advice`,{})).status,200);assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM agent_payout_advices')).rows[0].count,3);
 console.log('Synthetic payment API passed: concurrent payment recorded once, three release rows, three agent advice intents, failed PDF preserves payment, retry succeeds, own advice downloadable, other-agent document hidden, historical retry creates no duplicate.');
}finally{
 server?.closeAllConnections();server?.close();
 if(created){for(const row of (await db.query('SELECT storage_key FROM agent_payout_advices WHERE storage_key IS NOT NULL')).rows)await removePrivate(row.storage_key);await db.query(`SET search_path TO nysa_test_user`);await db.query(`DROP SCHEMA ${q(schema)} CASCADE`);}
 await closeDatabase();
}
