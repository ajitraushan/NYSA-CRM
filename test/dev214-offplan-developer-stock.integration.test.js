import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDedicatedFixture,createFixturePool,FIXTURE_SCHEMA,quoteIdentifier } from '../tools/local-postgres-fixture/fixture-guard.mjs';

const enabled=process.env.NYSA_RUN_DEV214_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DEV214_DB_INTEGRATION=1 inside the restricted synthetic fixture',timeout:15000};

test('DEV214 migration accepts booking-free Developer-stock linkage and rollback-only Sold Inventory creation',gate,async()=>{
  const pool=createFixturePool();
  try{
    await assertDedicatedFixture(pool);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${quoteIdentifier(FIXTURE_SCHEMA)}, public`);
      const migration=(await client.query("SELECT version FROM schema_migrations WHERE version='129_dev214_offplan_developer_stock.sql'")).rows[0];
      assert.equal(migration.version,'129_dev214_offplan_developer_stock.sql');
      const linkageChecks=(await client.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid='deal_inventory_linkages'::regclass AND contype='c'`)).rows.map(row=>row.definition).join('\n');
      assert.match(linkageChecks,/developer_stock_attached/);
      assert.match(linkageChecks,/booking_id IS NULL/);
      let broker=(await client.query('SELECT id FROM brokers ORDER BY id LIMIT 1')).rows[0];
      if(!broker)broker=(await client.query(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role)
        VALUES(gen_random_uuid(),'DEV214 Synthetic Agent','dev214-agent@example.invalid','internal_broker','active','integration-only','sales_agent') RETURNING id`)).rows[0];
      const sold=(await client.query(`INSERT INTO listings(id,project,developer,area,property_type,price,currency,status,closed_reason,
        closed_at,exclusivity_tier,posted_by,responsible_agent_id,originating_agent_id,notes,availability_confirmed_at,verification_status,portal_status,handover_status,
        workflow_status,source_kind,inventory_headline,transaction_types)
        VALUES(gen_random_uuid(),'Synthetic DEV214 Project','Synthetic Developer','Synthetic Area','Apartment',5200000,'AED',
          'Sold','Sold',NOW(),'Off-market',$1,$1,$1,'Rollback-only DEV214 validation',NOW(),'not_required','not_ready','to_be_confirmed',
          'approved','manual','Synthetic Unit A-1204',ARRAY['Off-plan']::text[])
        RETURNING inventory_reference,status,transaction_types`,[broker.id])).rows[0];
      assert.match(sold.inventory_reference,/^NYSA-INV-/);
      assert.equal(sold.status,'Sold');
      assert.deepEqual(sold.transaction_types,['Off-plan']);
      await client.query('ROLLBACK');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }finally{await pool.end();}
});
