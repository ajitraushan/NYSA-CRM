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
    async function request(path, who, status, body, method = body ? 'POST' : 'GET') {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/crm/' + (path.startsWith('prospects/') ? path : 'prospect-diary/' + path), {
        method,
        headers: { authorization: 'Bearer ' + tokens[who], 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    }
    const cadence={dailyTarget:40,workingDays:[1,2,3,4,5,6],firstCallDays:1,retryGaps:[1,2,4],parkOnExhaustion:true};
    await request('admin/cadence-policy','agent',403,cadence);
    await request('admin/cadence-policy','admin',400,{...cadence,workingDays:[1,1]});
    const draft=(await request('admin/cadence-policy','admin',201,cadence)).version;
    const toDiscard=(await request('admin/cadence-policy','admin',201,cadence)).version;
    await request('admin/cadence-policy/'+toDiscard.id+'/discard','agent',403,{});
    await request('admin/cadence-policy/'+toDiscard.id+'/discard','admin',200,{});
    await request('admin/cadence-policy/'+toDiscard.id+'/approve','admin',404,{});
    const active=(await request('admin/cadence-policy/'+draft.id+'/approve','admin',200,{})).version;
    assert.equal(active.status,'active');
    assert.equal((await db.one("SELECT count(*)::int AS count FROM prospect_cadence_policy_versions WHERE status='active'")).count,1);
    const target={dailyTarget:25,effectiveFrom:'2026-11-12',reason:'Synthetic target'};
    await request('targets/'+ids.outsider,'manager',404,target);
    const savedTarget=(await request('targets/'+ids.agent,'manager',201,target)).target;
    assert.equal(savedTarget.dailyTarget,25);
    const governed=await db.one("SELECT count(*)::int AS count FROM value_sets WHERE stable_code LIKE 'prospect_%'");
    assert.equal(governed.count,6);
    const interest='prospects/'+ids.untouched+'/interest';
    await request(interest,'manager',403,{purpose:'investment'},'PATCH');
    await request(interest,'outsider',404,{purpose:'investment'},'PATCH');
    await request(interest,'agent',400,{purpose:'undefined_value'},'PATCH');
    const saved=(await request(interest,'agent',200,{purpose:'investment'},'PATCH')).interest;
    assert.equal(saved.purpose,'investment');
    assert.equal((await request(interest,'agent',200)).reasons.length,7);
    await request(interest,'agent',200,{purpose:'investment'},'PATCH');
    const history=await db.many('SELECT before_values,after_values FROM prospect_interest_history WHERE prospect_id=$1',[ids.untouched]);
    assert.equal(history.length,1);
    assert.equal(history[0].beforeValues.purpose,null);
    assert.equal(history[0].afterValues.purpose,'investment');
    const timeline=(await request('prospects/'+ids.untouched,'agent',200)).interestHistory;
    assert.equal(timeline.length,1);
    assert.equal(timeline[0].afterValues.purpose,'investment');
    await request('prospects/'+ids.untouched,'outsider',404);
    const own = await request('today', 'agent', 200);
    assert.deepEqual(own.items.map(item => item.id), [ids.due, ids.untouched]);
    assert.deepEqual(own.items.map(item => item.priority), [1, 5]);
    assert.equal((await request('today?agent=' + ids.agent, 'manager', 200)).readOnly, true);
    await request('today?agent=' + ids.agent, 'outsider', 404);
    await request('today', 'admin', 403);

    const before = await request('overrides', 'manager', 200);
    assert.equal(before.unreviewedCount, 1);
    assert.deepEqual((await request('overrides?status=reviewed&warning=repeat_after_decline','manager',200)).overrides,[]);
    assert.equal((await request('overrides?status=reviewed&warning=repeat_after_decline','manager',200)).unreviewedCount,1);
    assert.equal((await request('overrides?warning=outside_calling_window','manager',200)).unreviewedCount,0);
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
    const registered=uuid();
    await db.execute("INSERT INTO company_calling_numbers(id,label,phone,normalized_phone,tdra_registration_reference,tdra_registered_legal_name,tdra_registered_at,tdra_verified_at,tdra_evidence_reference,created_by) VALUES($1,'Synthetic office','+971501234560','+971501234560','fixture','Fixture','2026-11-10',now(),'fixture',$2)",[registered,ids.manager]);
    const original=uuid(),correction=uuid();
    await db.execute("INSERT INTO prospect_activities(id,prospect_id,activity_type,direction,outcome,notes,company_calling_number_id,created_by) VALUES($1,$2,'call','outbound','no_answer','Synthetic attempt',$3,$4)",[original,ids.due,registered,ids.agent]);
    await db.execute("INSERT INTO prospect_activities(id,prospect_id,activity_type,direction,outcome,notes,company_calling_number_id,created_by,corrects_activity_id,correction_reason) VALUES($1,$2,'call','outbound','answered','Synthetic correction',$3,$4,$5,'Fixture correction')",[correction,ids.due,registered,ids.agent,original]);
    const dashboard=await request('dashboard','manager',200);
    assert.equal(dashboard.tiles.callsMade,1);
    assert.equal(dashboard.tiles.callsConnected,1);
    assert.equal(dashboard.tiles.connectRate,1);
    assert.equal(dashboard.agents.length,1);
    assert.equal(dashboard.funnel.contacted,1);
    const generatedDeadline=await db.one('SELECT first_call_due_at FROM prospects WHERE id=$1',[ids.untouched]);
    assert.ok(generatedDeadline.firstCallDueAt);
    assert.equal((await request('dashboard','agent',200)).agents.length,0);
    assert.equal((await request('dashboard','outsider',200)).tiles.callsMade,0);
    await request('dashboard','admin',403);
    await request('dashboard?agent='+ids.agent,'outsider',404);
    const drill=await request('dashboard/drilldown?metric=callsMade','manager',200);
    assert.deepEqual(drill.rows.map(row=>row.id),[ids.due]);
    const digest=await request('digest/preview','manager',200);
    assert.equal(digest.audience,'manager');
    assert.equal(digest.tiles.callsMade,1);
    assert.equal((await request('digest/preview','agent',200)).agents.length,0);
    await request('digest/preview','admin',403);
    const settings=await request('admin/email','admin',200);
    assert.equal(settings.settings.enabled,false);
    assert.deepEqual(Object.keys(settings.settings).sort(),['enabled','environment','host','port','sender']);
    await request('admin/email','agent',403);
    await request('admin/email/test','admin',400,{to:'other@example.invalid'});
    await request('admin/email/test','admin',409,{});
    await request('digest/preference','agent',200,{optOut:true},'PATCH');
    assert.equal((await db.one('SELECT prospect_digest_opt_out FROM brokers WHERE id=$1',[ids.agent])).prospectDigestOptOut,true);
    const {runProspectDigestTick}=await import('../src/prospect-digest-worker.js');
    const envKeys=['PROSPECT_DIGEST_EMAIL_ENABLED','PROSPECT_DIGEST_ENVIRONMENT','PROSPECT_DIGEST_TEST_RECIPIENTS','PROSPECT_DIGEST_HOURLY_LIMIT','PROSPECT_DIGEST_SCHEDULE_ENABLED'];
    const prior=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
    try{
      const address=ids.admin+'@example.invalid';
      Object.assign(process.env,{
        PROSPECT_DIGEST_EMAIL_ENABLED:'true',PROSPECT_DIGEST_ENVIRONMENT:'crm-test',
        PROSPECT_DIGEST_TEST_RECIPIENTS:address,PROSPECT_DIGEST_HOURLY_LIMIT:'10',
        PROSPECT_DIGEST_SCHEDULE_ENABLED:'false',
      });
      const queued=await request('admin/email/test','admin',202,{});
      await request('admin/email/test','admin',409,{});
      let sends=0;
      await runProspectDigestTick(new Date(),{send:async envelope=>{
        sends++;
        assert.equal(envelope.to,address);
        assert.equal(envelope.text,'Synthetic Prospect Diary email delivery check.');
        return {state:'retryable',code:'SMTP_CONNECT_FAILED'};
      }});
      const retry=await db.one('SELECT status,attempts,next_attempt_at FROM prospect_digest_runs WHERE id=$1',[queued.run.id]);
      assert.equal(retry.status,'retry');
      assert.equal(retry.attempts,1);
      assert.ok(Date.parse(retry.nextAttemptAt)>Date.now()+29*60000);
      await runProspectDigestTick(new Date(),{send:async()=>{assert.fail('retry ran early');}});
      await db.execute("UPDATE prospect_digest_runs SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[queued.run.id]);
      await runProspectDigestTick(new Date(),{send:async()=>{sends++;return {state:'review',code:'SMTP_SUBMISSION_UNCERTAIN'};}});
      const review=await db.one('SELECT status,attempts,next_attempt_at FROM prospect_digest_runs WHERE id=$1',[queued.run.id]);
      assert.deepEqual([review.status,review.attempts,review.nextAttemptAt,sends],['review',2,null,2]);
      await runProspectDigestTick(new Date(),{send:async()=>{assert.fail('ambiguous delivery retried');}});
    }finally{
      for(const key of envKeys){
        if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];
      }
    }



  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.closeDatabase();
  }
});
