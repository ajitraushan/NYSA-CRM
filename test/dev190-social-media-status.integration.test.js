import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV190_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let db,pool,agent,admin,policy;

before(async()=>{
  if(!enabled)return;
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  pool=guard.createFixturePool();await guard.assertDedicatedFixture(pool);await pool.end();
  db=await import('../src/db.js');agent=crypto.randomUUID();admin=crypto.randomUUID();policy=crypto.randomUUID();
  const stamp=Date.now();
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,$3,$4,'admin','active','synthetic-only','admin'),
    ($2,$5,$6,'internal_broker','active','synthetic-only','sales_agent')`,
    [admin,agent,`dev190 admin ${stamp}`,`dev190-admin-${stamp}@example.invalid`,`dev190 agent ${stamp}`,`dev190-agent-${stamp}@example.invalid`]);
});

after(async()=>{
  if(!db)return;
  await db.execute('DELETE FROM commission_payout_policy_versions WHERE id=$1',[policy]);
  await db.execute('DELETE FROM agent_social_media_payout_status_versions WHERE agent_id=$1',[agent]);
  await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[agent,admin]]);
  await db.closeDatabase();
});

test('database accepts the maintained quarterly achieved-rate method and true-up accounting',gate,async()=>{
  await db.execute(`INSERT INTO commission_payout_policy_versions(id,policy_code,version_number,currency,effective_from,trigger_method,status,reason,created_by)
    VALUES($1,'dev190_synthetic',1,'AED','2026-07-01','quarter_achieved_rate','draft','Synthetic calculation method',$2)`,[policy,admin]);
  const saved=await db.one('SELECT trigger_method FROM commission_payout_policy_versions WHERE id=$1',[policy]);assert.equal(saved.triggerMethod,'quarter_achieved_rate');
  const constraints=await db.many(`SELECT conname FROM pg_constraint WHERE conrelid IN ('agent_payout_calculations'::regclass,'agent_payout_calculation_bands'::regclass)`);
  assert.ok(!constraints.some(x=>x.conname.endsWith('company_retained_amount_check')),'true-up may exceed the crossing Deal credit while remaining fully reconciled');
});

test('effective-dated Agent social-media statuses cannot overlap',gate,async()=>{
  const first=crypto.randomUUID(),second=crypto.randomUUID();
  await db.execute(`INSERT INTO agent_social_media_payout_status_versions(id,agent_id,status,effective_from,effective_to,reason,evidence_reference,created_by)
    VALUES($1,$2,'active','2026-07-01','2026-08-01','Synthetic active eligibility','SYN-190-A',$3)`,[first,agent,admin]);
  await assert.rejects(db.execute(`INSERT INTO agent_social_media_payout_status_versions(id,agent_id,status,effective_from,effective_to,reason,evidence_reference,created_by)
    VALUES($1,$2,'inactive','2026-07-15','2026-09-01','Synthetic overlapping status','SYN-190-B',$3)`,[second,agent,admin]),/already covers this effective period/);
  await db.execute(`INSERT INTO agent_social_media_payout_status_versions(id,agent_id,status,effective_from,reason,evidence_reference,created_by)
    VALUES($1,$2,'inactive','2026-08-01','Synthetic inactive eligibility','SYN-190-C',$3)`,[second,agent,admin]);
  const rows=await db.many('SELECT status,effective_from::text AS effective_from FROM agent_social_media_payout_status_versions WHERE agent_id=$1 ORDER BY effective_from',[agent]);
  assert.deepEqual(rows.map(x=>[x.status,x.effectiveFrom]),[['active','2026-07-01'],['inactive','2026-08-01']]);
});
