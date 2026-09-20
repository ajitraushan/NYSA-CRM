import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV208_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let pool,client;

before(async()=>{
  if(!enabled)return;
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  pool=guard.createFixturePool();await guard.assertDedicatedFixture(pool);client=await pool.connect();
  await client.query('BEGIN');
});

after(async()=>{
  if(client){await client.query('ROLLBACK');client.release();}
  if(pool)await pool.end();
});

test('migration 127 installs private, auditable import schema without granting authority',gate,async()=>{
  const tables=await client.query("SELECT to_regclass('purchased_data_import_batches') AS batches,to_regclass('purchased_data_import_rows') AS rows,to_regclass('purchased_data_import_authorizations') AS authorizations");
  assert.equal(tables.rows[0].batches,'purchased_data_import_batches');assert.equal(tables.rows[0].rows,'purchased_data_import_rows');assert.equal(tables.rows[0].authorizations,'purchased_data_import_authorizations');
  const authorizations=await client.query('SELECT COUNT(*)::int AS count FROM purchased_data_import_authorizations');
  assert.equal(authorizations.rows[0].count,0,'migration must not infer operational import authority from a role');
  const columns=await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='purchased_data_import_batches'");
  assert.ok(columns.rows.some(row=>row.column_name==='storage_key'),'raw workbook must have a private-storage reference');
  assert.ok(columns.rows.some(row=>row.column_name==='preview_hash'),'confirmation must bind to the reviewed preview');
});

test('Customer reference, Sales Agent importer identity and batch provenance are enforced by the database',gate,async()=>{
  const admin=crypto.randomUUID(),agent=crypto.randomUUID(),customer=crypto.randomUUID(),batch=crypto.randomUUID(),row=crypto.randomUUID();
  await client.query(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,'Synthetic Admin',$2,'admin','active','synthetic-only','admin'),
    ($3,'Synthetic Sales Agent',$4,'internal_broker','active','synthetic-only','sales_agent')`,[admin,`dev208-admin-${Date.now()}@example.invalid`,agent,`dev208-agent-${Date.now()}@example.invalid`]);
  await client.query(`INSERT INTO contacts(id,customer_reference,full_name,email,owner_id,created_by,email_status,phone_status,lifecycle_status) VALUES($1,'NYSA-CUS-SYN-208','Synthetic Customer','dev208-customer@example.invalid',NULL,$2,'unverified','unverified','active')`,[customer,agent]);
  await assert.rejects(client.query(`INSERT INTO contacts(id,customer_reference,full_name,email,owner_id,created_by,email_status,phone_status,lifecycle_status) VALUES($1,'NYSA-CUS-SYN-208','Duplicate Reference','dev208-duplicate@example.invalid',NULL,$2,'unverified','unverified','active')`,[crypto.randomUUID(),agent]),/duplicate key/i);
  // PostgreSQL aborts a transaction after the expected uniqueness failure; the
  // second transaction keeps the remaining assertions isolated and recoverable.
  await client.query('ROLLBACK');await client.query('BEGIN');
  await client.query(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES ($1,'Synthetic Admin',$2,'admin','active','synthetic-only','admin'),($3,'Synthetic Sales Agent',$4,'internal_broker','active','synthetic-only','sales_agent')`,[admin,`dev208-admin2-${Date.now()}@example.invalid`,agent,`dev208-agent2-${Date.now()}@example.invalid`]);
  await client.query(`INSERT INTO contacts(id,customer_reference,full_name,email,owner_id,created_by,email_status,phone_status,lifecycle_status) VALUES($1,'NYSA-CUS-SYN-208','Synthetic Customer','dev208-customer2@example.invalid',NULL,$2,'unverified','unverified','active')`,[customer,agent]);
  await client.query(`INSERT INTO purchased_data_import_batches(id,batch_reference,module_type,source_system_code,supplier_name,acquisition_batch_reference,acquisition_date,processing_basis,original_file_name,media_type,file_size_bytes,file_hash,preview_hash,storage_key,status,row_count,uploaded_by,confirmed_by,confirmed_at)
    VALUES($1,'PDI-2026-SYN208','customer_only','synthetic_supplier','Synthetic Supplier','SYN-208','2026-09-19','Synthetic testing only','synthetic.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',1024,$2,$3,'private/synthetic.xlsx','processing',1,$4,$4,NOW())`,[batch,'a'.repeat(64),'b'.repeat(64),agent]);
  await client.query(`INSERT INTO purchased_data_import_rows(id,batch_id,row_number,external_row_reference,outcome,contact_id,normalized_payload) VALUES($1,$2,2,'SYN-ROW-1','created',$3,$4)`,[row,batch,customer,{moduleType:'customer_only',sourceSystemCode:'synthetic_supplier',acquisitionBatchReference:'SYN-208'}]);
  const stored=await client.query('SELECT b.status,r.outcome,c.owner_id FROM purchased_data_import_batches b JOIN purchased_data_import_rows r ON r.batch_id=b.id JOIN contacts c ON c.id=r.contact_id WHERE b.id=$1',[batch]);
  assert.deepEqual(stored.rows[0],{status:'processing',outcome:'created',owner_id:null});
});
