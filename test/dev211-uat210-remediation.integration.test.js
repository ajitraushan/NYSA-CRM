import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';

const enabled=process.env.NYSA_RUN_DEV211_DB_INTEGRATION==='1',gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let pool,client;

before(async()=>{
  if(!enabled)return;
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  pool=guard.createFixturePool();await guard.assertDedicatedFixture(pool);client=await pool.connect();await client.query('BEGIN');
});

after(async()=>{if(client){await client.query('ROLLBACK');client.release();}if(pool)await pool.end();});

test('migration 128 installs all DEV211 governed schema contracts',gate,async()=>{
  const migration=await client.query("SELECT 1 FROM schema_migrations WHERE version='128_dev211_uat210_remediation.sql'");assert.equal(migration.rowCount,1);
  const columns=await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND
    ((table_name='viewings' AND column_name='inventory_assignment_id') OR (table_name='offers' AND column_name='inventory_assignment_id') OR
     (table_name='purchased_data_import_batches' AND column_name='excluded_count'))`);
  assert.equal(columns.rowCount,3);
  const tables=await client.query("SELECT to_regclass('customer_change_requests') AS customer_changes,to_regclass('deal_cancellation_requests') AS deal_cancellations");
  assert.equal(tables.rows[0].customer_changes,'customer_change_requests');assert.equal(tables.rows[0].deal_cancellations,'deal_cancellation_requests');
  const outcome=await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='communication_policy_decisions'::regclass AND conname='communication_policy_decisions_outcome_check'");
  assert.match(outcome.rows[0].definition,/preparation_only/);
});

test('DEV211 approval queues permit only one pending request per governed record',gate,async()=>{
  const indexes=await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN('customer_change_requests_one_pending_uq','deal_cancellation_requests_one_pending_uq') ORDER BY indexname");
  assert.equal(indexes.rowCount,2);for(const row of indexes.rows){assert.match(row.indexdef,/UNIQUE/);assert.match(row.indexdef,/WHERE \(status = 'pending'/);}
});
