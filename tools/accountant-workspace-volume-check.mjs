import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {assertDedicatedFixture,quoteIdentifier} from './local-postgres-fixture/fixture-guard.mjs';
import {queueDefinition} from '../src/finance-workspace-domain.js';
import {financeQueueQuery} from '../src/finance-queue-query.js';
const pool=new pg.Pool({max:20}),schema='acc_volume_'+crypto.randomUUID().replaceAll('-',''),q=quoteIdentifier;
await assertDedicatedFixture(pool);
const tables=['brokers','contacts','leads','opportunities','deals','listings','commission_receivable_schedules','commission_receivable_invoices','commission_receivable_collections','commission_receivable_reversals','commission_receivable_adjustment_requests','deal_agent_credit_lines','deal_agent_credit_versions','deal_commission_receipt_confirmations','commission_payout_policy_versions','agent_payout_calculations','agent_payout_calculation_bands','agent_payout_release_events','commission_payment_batches','commission_payment_batch_items','agent_payout_advices'];
const client=await pool.connect();let created=false;
try{
 await client.query(`CREATE SCHEMA ${q(schema)}`);created=true;
 for(const table of tables){
  await client.query(`CREATE TABLE ${q(schema)}.${q(table)} AS SELECT * FROM nysa_test_user.${q(table)} WITH NO DATA`);
  const indexes=(await client.query('SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename=$2',['nysa_test_user',table])).rows;
  for(const {indexdef}of indexes)await client.query(indexdef.replaceAll('nysa_test_user.',schema+'.'));
  const primary=(await client.query("SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='nysa_test_user' AND t.relname=$1 AND c.contype='p'",[table])).rows[0];
  if(primary)await client.query(`ALTER TABLE ${q(schema)}.${q(table)} ADD CONSTRAINT ${q(primary.conname)} PRIMARY KEY USING INDEX ${q(primary.conname)}`);
 }
 await client.query(`SET search_path TO ${q(schema)}`);
 await client.query(`INSERT INTO brokers(id,name) SELECT md5('agent'||i)::uuid,'Synthetic Agent '||i FROM generate_series(1,100)i`);
 await client.query(`INSERT INTO contacts(id,full_name) VALUES(md5('contact')::uuid,'Synthetic Volume Customer')`);
 await client.query(`INSERT INTO leads(id,contact_id) VALUES(md5('lead')::uuid,md5('contact')::uuid)`);
 await client.query(`INSERT INTO opportunities(id,opportunity_reference,lead_id,stage) SELECT md5('opp'||i)::uuid,'SYNTHETIC-OP-'||i,md5('lead')::uuid,'Closed Won' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO deals(id,opportunity_id,status,closed_at,currency) SELECT md5('deal'||i)::uuid,md5('opp'||i)::uuid,'closed_won',NOW(),'AED' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO commission_receivable_schedules(id,opportunity_id,payer_name,currency) SELECT md5('schedule'||i)::uuid,md5('opp'||i)::uuid,'Synthetic Payer '||i,'AED' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO commission_receivable_invoices(id,schedule_id,invoice_reference,invoice_date,due_date,total_cents,state) SELECT md5('invoice'||i)::uuid,md5('schedule'||i)::uuid,'SYNTHETIC-INV-'||i,CURRENT_DATE-30,CURRENT_DATE-1,105000,'issued' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO deal_commission_receipt_confirmations(id,receipt_date) SELECT md5('confirm'||i)::uuid,CURRENT_DATE FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO deal_agent_credit_versions(id,receipt_confirmation_id,deal_id,currency,status) SELECT md5('version'||i)::uuid,md5('confirm'||i)::uuid,md5('deal'||i)::uuid,'AED','frozen' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO deal_agent_credit_lines(id,agent_id,credit_version_id,credited_amount) SELECT md5('credit'||i)::uuid,md5('agent'||(1+i%100))::uuid,md5('version'||i)::uuid,1000 FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO agent_payout_calculations(id,credit_line_id,agent_id,deal_id,payout_reference,currency,agent_payout_amount,status,quarter_key,receipt_date,release_due_date) SELECT md5('payout'||i)::uuid,md5('credit'||i)::uuid,md5('agent'||(1+i%100))::uuid,md5('deal'||i)::uuid,'SYNTHETIC-PAYOUT-'||i,'AED',100,'approved','2026-Q4',CURRENT_DATE,CURRENT_DATE FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO commission_payment_batches(id,batch_reference,currency,status,payment_status,submitted_at) SELECT md5('batch'||i)::uuid,'SYNTHETIC-BATCH-'||i,'AED','approved','awaiting_payment',NOW() FROM generate_series(1,10000)i`);
 await client.query(`INSERT INTO commission_payment_batch_items(id,batch_id,calculation_id,status) SELECT md5('item'||i)::uuid,md5('batch'||(1+(i-1)/10))::uuid,md5('payout'||i)::uuid,'approved' FROM generate_series(1,100000)i`);
 await client.query(`INSERT INTO agent_payout_advices(id,batch_id,agent_id,currency,input_snapshot,status,advice_number,created_at) SELECT md5('advice'||i)::uuid,md5('batch'||i)::uuid,md5('agent'||(1+i%100))::uuid,'AED','{"total":1000}'::jsonb,'generated',i,NOW() FROM generate_series(1,10000)i`);
 for(const table of tables)await client.query(`ANALYZE ${q(table)}`);
 client.release();
 const durations=[],sizes=[],byCategory={},categories=['collection-overdue','payout-approved','advice-generated','statements'];
 for(let round=0;round<3;round++)await Promise.all(Array.from({length:20},async(_,index)=>{
  const connection=await pool.connect();try{
   await connection.query(`SET search_path TO ${q(schema)}`);
   const definition=queueDefinition(categories[index%categories.length],{jobRole:'accountant',role:'internal_broker'}),started=performance.now();
   const params=[...definition.params],limitIndex=params.push(25),offsetIndex=params.push(0);
   const result=await connection.query(financeQueueQuery(definition.sql,{limitIndex,offsetIndex}),params);
   const elapsed=performance.now()-started;durations.push(elapsed);(byCategory[categories[index%categories.length]]??=[]).push(elapsed);sizes.push(Buffer.byteLength(JSON.stringify(result.rows[0])));
  }finally{connection.release();}
 }));
 durations.sort((a,b)=>a-b);
 const result={scope:'Synthetic local SQL workload; excludes HTTP, network and PDF generation',invoices:100000,payouts:100000,batches:10000,advice:10000,concurrentReaders:20,samples:durations.length,byCategory:Object.fromEntries(Object.entries(byCategory).map(([key,values])=>[key,{p95Ms:values.sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]}])),p95Ms:durations[Math.ceil(durations.length*.95)-1],p99Ms:durations[Math.ceil(durations.length*.99)-1],maximumResponseBytes:Math.max(...sizes)};
 await fs.writeFile('uat-evidence/accountant-workspace-volume.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(result.p95Ms>2000||result.p99Ms>5000||result.maximumResponseBytes>300000)throw new Error('Volume acceptance threshold not met; inspect the saved workload evidence');
}finally{
 if(!client.released)try{client.release();}catch{}
 if(created)await pool.query(`DROP SCHEMA ${q(schema)} CASCADE`);
 await pool.end();
}
