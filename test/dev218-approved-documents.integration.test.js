import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';

const enabled=process.env.NYSA_RUN_DEV218_DB_INTEGRATION==='1',gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let pool,client;

before(async()=>{
  if(!enabled)return;
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  pool=guard.createFixturePool();await guard.assertDedicatedFixture(pool);client=await pool.connect();await client.query('BEGIN');
});
after(async()=>{if(client){await client.query('ROLLBACK');client.release();}if(pool)await pool.end();});

test('DEV218 migration installs the approved-document, BRN, ORN and Listing NOC contracts',gate,async()=>{
  const migration=await client.query("SELECT 1 FROM schema_migrations WHERE version='132_approved_documents_and_brand.sql'");
  assert.equal(migration.rowCount,1);
  const columns=await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND
    ((table_name='brokers' AND column_name IN('brn','brn_issued_on')) OR
     (table_name='organization_settings' AND column_name IN('default_document_agent_id','orn'))) ORDER BY table_name,column_name`);
  assert.equal(columns.rowCount,4);
  const tables=await client.query("SELECT to_regclass('approved_document_drafts') AS drafts,to_regclass('approved_document_issuances') AS issuances,to_regclass('listing_noc_evidence_versions') AS noc_evidence");
  assert.equal(tables.rows[0].drafts,'approved_document_drafts');assert.equal(tables.rows[0].issuances,'approved_document_issuances');assert.equal(tables.rows[0].noc_evidence,'listing_noc_evidence_versions');
});

test('DEV218 database enforces conditional BRN and immutable issuance/evidence identities',gate,async()=>{
  const constraints=await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE
    (conrelid='brokers'::regclass AND conname='brokers_brn_complete_ck') OR
    (conrelid='listing_noc_evidence_versions'::regclass AND conname LIKE '%pkey') OR
    (conrelid='approved_document_issuances'::regclass AND conname LIKE '%idempotency%') ORDER BY conname`);
  assert.ok(constraints.rows.some(row=>row.conname==='brokers_brn_complete_ck'&&/brn_issued_on IS NOT NULL/.test(row.definition)));
  const indexes=await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN('approved_document_drafts_open_uq','listing_noc_evidence_open_uq','listing_noc_evidence_active_uq') ORDER BY indexname");
  assert.equal(indexes.rowCount,3);for(const row of indexes.rows)assert.match(row.indexdef,/UNIQUE/);
  const trigger=await client.query("SELECT 1 FROM pg_trigger WHERE tgrelid='listing_noc_evidence_versions'::regclass AND tgname='listing_noc_evidence_immutable' AND NOT tgisinternal");
  assert.equal(trigger.rowCount,1);
});
