import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import { applyFixtureMigration, createFixture, fixtureIdentity, migrationFiles } from './dev270-pg13-rehearsal-fixture.mjs';

const ownership = JSON.parse(await fs.readFile('release-artifacts/dev270-preparation-r2/hosted-production-ownership/PRODUCTION_OWNERSHIP_RESULT.json', 'utf8'));
const results = [];
const actor = '99999999-0000-4000-8000-000000000001';
const prospect = '99999999-0000-4000-8000-000000000002';
const legacyCall = "INSERT INTO prospect_activities(id,prospect_id,activity_type,direction,outcome,notes,occurred_at,created_by) VALUES($1,$2,'call','inbound','answered','Synthetic DEV270 call',$3,$4)";
for (const [database, role] of [['nysa_test_fixture','nysa_test_user'], ['nysareal_nysacrm','nysareal_nysacrmapp']]) {
  const client = await createFixture(database, role);
  try {
    for (const file of migrationFiles.slice(0,171)) await applyFixtureMigration(client,file,role);
    assert.equal((await fixtureIdentity(client)).migrations,171);
    if (role === 'nysareal_nysacrmapp') {
      const admin = new pg.Client({database,user:'postgres'});
      await admin.connect();
      try {
        await admin.query('CREATE ROLE nysareal_nysacrm; GRANT nysareal_nysacrm TO nysareal_nysacrmapp; ALTER DATABASE nysareal_nysacrm OWNER TO nysareal_nysacrm');
        assert.equal(ownership.tables.length,58);
        for (const table of ownership.tables) {
          assert.match(table.table_name,/^[a-z_0-9]+$/);
          await admin.query('ALTER TABLE public.' + table.table_name + ' OWNER TO nysareal_nysacrm');
        }
      } finally { await admin.end(); }
    }
    await client.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Synthetic Agent','dev271@example.test','internal_broker','sales_agent','active','fixture')",[actor]);
    await client.query("INSERT INTO prospects(id,phone,normalized_phone,owner_id,timezone,timezone_source,created_by,created_at) VALUES ($1,'+971501234567','+971501234567',$3,'Asia/Dubai','phone_inferred',$3,'2020-11-14 05:00Z'), ($2,'+971501234568','+971501234568',$3,'Asia/Dubai','phone_inferred',$3,now())",[prospect,'99999999-0000-4000-8000-000000000005',actor]);
    await client.query(legacyCall,['99999999-0000-4000-8000-000000000003',prospect,'2020-11-14 06:00Z',actor]);
    assert.equal(migrationFiles[171],'172_prospect_tracking.sql');
    const started = performance.now();
    await applyFixtureMigration(client,migrationFiles[171],role);
    const elapsedMs = Math.round(performance.now()-started);
    const {rows:[backfill]} = await client.query('SELECT now() AS measured_at, count(*)::int AS prospects_total, count(first_call_due_at)::int AS first_call_due_backfilled, count(*) FILTER (WHERE first_call_due_at < now())::int AS first_call_due_in_past FROM prospects');
    assert.deepEqual([backfill.prospects_total,backfill.first_call_due_backfilled,backfill.first_call_due_in_past],[2,2,1]);
    await client.query(legacyCall,['99999999-0000-4000-8000-000000000004',prospect,'2020-11-16 06:00Z',actor]);
    const history='99999999-0000-4000-8000-000000000006';
    await client.query("INSERT INTO prospect_interest_history(id,prospect_id,changed_by,before_values,after_values) VALUES($1,$2,$3,'{}','{\"purpose\":\"investment\"}')",[history,prospect,actor]);
    for (const sql of ["UPDATE prospect_interest_history SET after_values='{}' WHERE id=$1",'DELETE FROM prospect_interest_history WHERE id=$1']) {
      await assert.rejects(client.query(sql,[history]),{code:'23514',message:/append-only/});
    }
    const {rows:[retained]}=await client.query('SELECT after_values FROM prospect_interest_history WHERE id=$1',[history]);
    assert.deepEqual(retained.after_values,{purpose:'investment'});
    const {rows:[evidence]}=await client.query("SELECT p.last_activity_at,p.first_call_due_at,(SELECT count(*)::int FROM prospect_activities WHERE prospect_id=p.id AND next_step IS NULL) AS legacy_calls,(SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,(SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tableowner='nysareal_nysacrm') AS owner_held FROM prospects p WHERE p.id=$1",[prospect]);
    assert.equal(evidence.legacy_calls,2);
    assert.equal(evidence.last_activity_at.toISOString(),'2020-11-14T06:00:00.000Z');
    assert.equal(evidence.first_call_due_at.toISOString(),'2020-11-16T05:00:00.000Z');
    assert.equal(evidence.tables,313);
    assert.equal(evidence.owner_held,database==='nysareal_nysacrm'?58:0);
    const identity=await fixtureIdentity(client);
    assert.equal(identity.migrations,172);
    results.push({...identity,...evidence,elapsedMs,...backfill,interest_history:{insert_accepted:true,update_rejected:true,delete_rejected:true,row_retained:true},scope:'synthetic data, DEV270 INSERT shape only'});
    console.log(JSON.stringify(results.at(-1)));
  } finally { await client.end(); }
}
await fs.writeFile('docs/change-requests/DEV271-PG13-LOCAL-MIGRATION.json',JSON.stringify(results,null,2)+'\n');
