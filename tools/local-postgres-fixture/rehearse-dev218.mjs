import { migrateFixture } from './migrate.mjs';
import { assertDedicatedFixture,createFixturePool,FIXTURE_SCHEMA,quoteIdentifier } from './fixture-guard.mjs';

const migration='132_approved_documents_and_brand.sql';
const pool=createFixturePool();
try{
  await assertDedicatedFixture(pool);
  const schema=quoteIdentifier(FIXTURE_SCHEMA),client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    const applied=await client.query(`SELECT 1 FROM ${schema}.schema_migrations WHERE version=$1`,[migration]);
    if(!applied.rowCount)throw new Error(`${migration} is not applied`);
    await client.query('DROP TABLE listing_noc_evidence_versions');
    await client.query('DROP FUNCTION prevent_listing_noc_evidence_fact_mutation()');
    await client.query('DROP TABLE approved_document_issuances');
    await client.query('DROP TABLE approved_document_drafts');
    await client.query('ALTER TABLE organization_settings DROP COLUMN default_document_agent_id, DROP COLUMN orn');
    await client.query('ALTER TABLE brokers DROP CONSTRAINT brokers_brn_complete_ck, DROP COLUMN brn, DROP COLUMN brn_issued_on');
    await client.query(`DELETE FROM ${schema}.schema_migrations WHERE version=$1`,[migration]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}finally{await pool.end();}

const reapplied=await migrateFixture(),verifyPool=createFixturePool();
try{
  await assertDedicatedFixture(verifyPool);
  const schema=quoteIdentifier(FIXTURE_SCHEMA),contract=(await verifyPool.query(`
    SELECT
      EXISTS(SELECT 1 FROM ${schema}.schema_migrations WHERE version=$1) AS migration,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=$2 AND table_name='brokers' AND column_name='brn') AS broker_brn,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=$2 AND table_name='organization_settings' AND column_name='orn') AS organization_orn,
      to_regclass($2||'.approved_document_issuances') IS NOT NULL AS issuance,
      to_regclass($2||'.listing_noc_evidence_versions') IS NOT NULL AS listing_noc_evidence
  `,[migration,FIXTURE_SCHEMA])).rows[0];
  if(Object.values(contract).some(value=>value!==true))throw new Error(`DEV218 fixture contract failed: ${JSON.stringify(contract)}`);
  console.log(JSON.stringify({rolledBackTo:'131_optional_booking_amount.sql',reapplied,contract}));
}finally{await verifyPool.end();}
