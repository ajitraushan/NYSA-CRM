import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const enabled = process.env.NYSA_PROSPECT_DIARY_TEST === 'local-synthetic';

test('DEV271 Today and override review enforce scope and retain evidence', { skip: !enabled, timeout: 180000 }, async () => {
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGDATABASE, 'nysa_test_fixture');
  assert.equal(process.env.PGUSER, 'nysa_test_user');
  const db = await import('../src/db.js');
  const { createApp } = await import('../src/lib/http-kit.js');
  const { default: prospects } = await import('../src/routes/prospects.js');
  const uuid = () => crypto.randomUUID();
  const ids = Object.fromEntries(['agent','outsider','manager','admin','team','due','untouched','blocked','warning'].map(key => [key, uuid()]));
  const tokens = {};
  let server;
  try {
    const ledger = await db.one("SELECT count(*)::int AS count FROM schema_migrations WHERE version='172_prospect_tracking.sql'");
    assert.equal(ledger.count, 1, 'Apply migration 172 to the isolated fixture before running this test');
    const identity = await db.one("SELECT current_setting('server_version') AS version");
    assert.match(identity.version, /^13\.23\b/);
    for (const [name, role] of [['agent','sales_agent'],['outsider','sales_agent'],['manager','manager'],['admin','admin']]) {
      await db.execute('INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,$2,$3,$4,$5,\'active\',\'fixture\')',
        [ids[name], name, ids[name] + '@example.invalid', name === 'admin' ? 'admin' : 'internal_broker', role]);
      tokens[name] = crypto.randomBytes(32).toString('hex');
      await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [crypto.createHash('sha256').update(tokens[name]).digest('hex'), ids[name]]);
    }
    await db.execute('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)', [ids.team, 'Synthetic DEV271 team', ids.manager]);
    await db.execute("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4),($5,$2,$4,'manager',$4)",
      [uuid(), ids.team, ids.agent, ids.manager, uuid()]);
    await db.execute("INSERT INTO prospects(id,phone,normalized_phone,owner_id,team_id,timezone,timezone_source,created_by,status,do_not_contact_reason,do_not_contact_at) VALUES " +
      "($1,'+971501234561','+971501234561',$4,$5,'Asia/Dubai','phone_inferred',$4,'call_back',NULL,NULL)," +
      "($2,'+971501234562','+971501234562',$4,$5,'Asia/Dubai','phone_inferred',$4,'not_contacted',NULL,NULL)," +
      "($3,'+971501234563','+971501234563',$4,$5,'Asia/Dubai','phone_inferred',$4,'do_not_contact','Synthetic DNC',now())",
      [ids.due, ids.untouched, ids.blocked, ids.agent, ids.team]);
    await db.execute("INSERT INTO tasks(id,prospect_id,prospect_channel,task_type,subject,assignee_id,priority,due_at,created_by,policy_warning_codes,policy_warning_acknowledged,policy_warning_reason) " +
      "VALUES($1,$2,'call','prospect_follow_up','Synthetic overdue task',$3,'normal',now()-interval '2 hours',$3,ARRAY['repeat_after_decline'],true,'Synthetic warning reason')",
      [ids.warning, ids.due, ids.agent]);
    const app = createApp();
    app.mount('/api', prospects);
    server = await new Promise((resolve, reject) => {
      const listener = app.listen({ host: '127.0.0.1', port: 0 }, () => resolve(listener));
      listener.once('error', reject);
    });
    async function request(path, who, status, body) {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/crm/prospect-diary/' + path, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: 'Bearer ' + tokens[who], 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    }
    const own = await request('today', 'agent', 200);
    assert.deepEqual(own.items.map(item => item.id), [ids.due, ids.untouched]);
    assert.deepEqual(own.items.map(item => item.priority), [1, 5]);
    assert.equal((await request('today?agent=' + ids.agent, 'manager', 200)).readOnly, true);
    await request('today?agent=' + ids.agent, 'outsider', 404);
    await request('today', 'admin', 403);

    const before = await request('overrides', 'manager', 200);
    assert.equal(before.unreviewedCount, 1);
    assert.equal(before.overrides[0].phoneLastFour, '4561');
    const review = 'overrides/' + ids.warning + '/review';
    await request(review, 'agent', 403, { evidenceType: 'follow_up' });
    await request(review, 'manager', 201, { evidenceType: 'follow_up', comment: 'Synthetic review' });
    await request(review, 'manager', 409, { evidenceType: 'follow_up' });
    const after = await request('overrides', 'manager', 200);
    assert.equal(after.unreviewedCount, 0);
    assert.equal(after.overrides[0].warningReason, 'Synthetic warning reason');
    assert.equal(after.overrides[0].comment, 'Synthetic review');
    const audit = await db.one("SELECT count(*)::int AS count FROM audit_log WHERE entity_type='Prospect' AND action='override_reviewed' AND performed_by=$1", [ids.manager]);
    assert.equal(audit.count, 1);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.closeDatabase();
  }
});
