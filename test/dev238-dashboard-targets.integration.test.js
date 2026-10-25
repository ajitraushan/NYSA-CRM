import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
const enabled=process.env.NYSA_RUN_DEV238_DB==='1';
test('DEV238 target API lifecycle, authorization, period values and optimistic concurrency',{skip:!enabled?'Dedicated local fixture required':false,timeout:120000},async t=>{
 assert.equal(process.env.PGDATABASE,'nysa_test_fixture');assert.equal(process.env.PGUSER,'nysa_test_user');assert.equal(process.env.PGHOST,'localhost');
 const db=await import('../src/db.js'),{createApp}=await import('../src/lib/http-kit.js'),{default:routes}=await import('../src/routes/dashboards.js');
 const actor=crypto.randomUUID(),agent=crypto.randomUUID(),otherAgent=crypto.randomUUID(),tokens=[crypto.randomBytes(32).toString('hex'),crypto.randomBytes(32).toString('hex'),crypto.randomBytes(32).toString('hex')],created=[];
 let server;const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
 try{
  for(const [id,role,jobRole,token] of [[actor,'admin','admin',tokens[0]],[agent,'internal_broker','sales_agent',tokens[1]],[otherAgent,'internal_broker','sales_agent',tokens[2]]]){
   await db.execute("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Synthetic target test',$2,$3,$4,'active','synthetic-only')",[id,`synthetic-target-${id}@example.invalid`,role,jobRole]);
   await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[hash(token),id]);
  }
  const app=createApp();app.mount('/api',routes);server=await new Promise(resolve=>{const s=app.listen(0,()=>resolve(s));});
  const request=async(path,body,token=tokens[0])=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
  const {data:setup}=await request('/admin/dashboard-metrics');assert.ok(setup.businessTypes.includes('Rental'));assert.equal(setup.metrics.find(m=>m.code==='team_capacity_pressure').unit,'agents');
  await t.test('hosting preflight target-state SELECT is valid PostgreSQL',async()=>{
   const source=fs.readFileSync(new URL('../scripts/dev238-host-run.mjs',import.meta.url),'utf8'),sql=JSON.parse(source.match(/const targetState=\(await db.query\(("[^\n]+")\)/)[1]),result=await db.one(sql);assert.equal(typeof result.total,'number');
  });
  await t.test('benchmark retirement is narrowly identified, audited and reversible in fixture transaction',async()=>{
   const client=await db.db.connect(),ids=['d7000000-0000-4000-8000-999999999991','d7000000-0000-4000-8000-999999999992',crypto.randomUUID()];
   try{await client.query('BEGIN');for(let i=0;i<ids.length;i++)await client.query(`INSERT INTO dashboard_targets(id,metric_code,scope_type,scope_id,period_start,period_end,target_value,unit,definition,status,benchmark_source,created_by) VALUES($1,'new_leads','agent',$2,$3,$3,$4,'leads','Controlled test definition for new_leads','active','CORE Release 1 test benchmark',$5)`,[ids[i],agent,`2051-01-0${i+1}`,i===1?20:10,actor]);
    const sql=fs.readFileSync(new URL('../src/migrations/139_workable_dashboard_targets.sql',import.meta.url),'utf8').split('WITH retired AS (')[1].split('GRANT SELECT')[0];await client.query('WITH retired AS ('+sql);
    const rows=(await client.query('SELECT id,status FROM dashboard_targets WHERE id=ANY($1::uuid[])',[ids])).rows;assert.equal(rows.find(x=>x.id===ids[0]).status,'retired');for(const id of ids.slice(1))assert.equal(rows.find(x=>x.id===id).status,'active');assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM audit_log WHERE entity_id=$1 AND action='seeded_test_benchmark_retired'",[ids[0]])).rows[0].n,1);
   }finally{await client.query('ROLLBACK');client.release();}
  });
  const base={metricCode:'new_leads',scopeType:'agent',scopeId:agent,cadence:'weekly',periodStart:'2030-11-04',periodEnd:null,targetValue:100,exceptionThreshold:80,thresholdDirection:'low_bad'};
  let target;
  await t.test('invalid period and invented scope rejected; Agent cannot maintain targets',async()=>{assert.equal((await request('/admin/dashboard-targets',{...base,periodStart:'2030-11-05'})).status,400);assert.equal((await request('/admin/dashboard-targets',{...base,scopeType:'business_line',scopeId:'invented'})).status,400);assert.equal((await request('/admin/dashboard-targets',base,tokens[1])).status,403);});
  await t.test('draft supports edit, approval and activation',async()=>{
   let result=await request('/admin/dashboard-targets',base);assert.equal(result.status,201);target=result.data;created.push(target.id);
   result=await request(`/admin/dashboard-targets/${target.id}/edit`,{...base,targetValue:105,expectedRevision:target.revision,reason:'Synthetic draft correction'});assert.equal(result.status,200);target=result.data;
   for(const action of ['approve','activate']){result=await request(`/admin/dashboard-targets/${target.id}/${action}`,{expectedRevision:target.revision,reason:'Synthetic lifecycle verification'});assert.equal(result.status,200,JSON.stringify(result.data));target=result.data;}
  });
  await t.test('active target requires future aligned edits and rejects stale revisions',async()=>{
   assert.equal((await request(`/admin/dashboard-targets/${target.id}/edit`,{...base,expectedRevision:target.revision,changeEffectiveOn:'2030-11-05',reason:'Synthetic invalid edit'})).status,400);
   const result=await request(`/admin/dashboard-targets/${target.id}/edit`,{...base,targetValue:120,expectedRevision:target.revision,changeEffectiveOn:'2030-11-18',reason:'Synthetic future plan'});assert.equal(result.status,200,JSON.stringify(result.data));const oldRevision=target.revision;target=result.data;
   assert.equal((await request(`/admin/dashboard-targets/${target.id}/retire`,{expectedRevision:oldRevision,reason:'Synthetic stale edit'})).status,409);
  });
  await t.test('overlapping target cannot be approved; future comparisons keep old values',async()=>{
   let result=await request('/admin/dashboard-targets',base);created.push(result.data.id);assert.equal((await request(`/admin/dashboard-targets/${result.data.id}/approve`,{expectedRevision:result.data.revision,reason:'Synthetic overlap check'})).status,409);
   result=await request(`/crm/dashboard/target-comparisons?dateFrom=2030-11-04&dateTo=2030-11-24`,undefined,tokens[1]);assert.equal(result.status,200,JSON.stringify(result.data));assert.deepEqual(result.data.rows.map(x=>x.targetValue),[105,105,120]);assert.ok(result.data.rows.every(x=>x.actual===null));
  });
  await t.test('current-period comparisons reuse live scoped calculations; historical snapshots stay unavailable',async()=>{
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
   for(const metricCode of ['new_leads','inventory_available']){
    let result=await request('/admin/dashboard-targets',{...base,metricCode,cadence:'daily',periodStart:yesterday});assert.equal(result.status,201);let row=result.data;created.push(row.id);
    for(const action of ['approve','activate']){result=await request(`/admin/dashboard-targets/${row.id}/${action}`,{expectedRevision:row.revision,reason:'Synthetic period comparison'});assert.equal(result.status,200,JSON.stringify(result.data));row=result.data;}
   }
   const result=await request(`/crm/dashboard/target-comparisons?dateFrom=${yesterday}&dateTo=${today}`,undefined,tokens[1]);assert.equal(result.status,200,JSON.stringify(result.data));
   assert.ok(result.data.rows.filter(r=>r.metricCode==='new_leads').every(r=>r.actual===0));
   assert.equal(result.data.rows.find(r=>r.metricCode==='inventory_available'&&r.from===yesterday).actual,null);
   const dashboard=await request(`/crm/dashboard?dateFrom=${yesterday}&dateTo=${today}`,undefined,tokens[1]);assert.equal(dashboard.status,200,JSON.stringify(dashboard.data));assert.equal(dashboard.data.dashboardType,'agent');
  });
  await t.test('Agent cannot select another Agent to reveal their target',async()=>{
   let result=await request('/admin/dashboard-targets',{...base,scopeId:otherAgent});let row=result.data;created.push(row.id);
   for(const action of ['approve','activate']){result=await request(`/admin/dashboard-targets/${row.id}/${action}`,{expectedRevision:row.revision,reason:'Synthetic role-scope verification'});assert.equal(result.status,200);row=result.data;}
   result=await request(`/crm/dashboard/target-comparisons?dateFrom=2030-11-04&dateTo=2030-11-24&agentId=${otherAgent}`,undefined,tokens[1]);assert.equal(result.status,200);assert.equal(result.data.rows.length,0);
  });
  await t.test('history retained; active deletion forbidden; retirement and draft deletion work',async()=>{
   let result=await request(`/admin/dashboard-targets/${target.id}/history`);assert.ok(result.data.versions.length>=5);assert.ok(result.data.events.some(x=>x.action==='edited'));
   assert.equal((await request(`/admin/dashboard-targets/${target.id}/delete`,{expectedRevision:target.revision,reason:'Synthetic forbidden deletion'})).status,409);
   result=await request(`/admin/dashboard-targets/${target.id}/retire`,{expectedRevision:target.revision,reason:'Synthetic test complete'});assert.equal(result.data.status,'retired');
   const draft=await db.one('SELECT * FROM dashboard_targets WHERE id=$1',[created[1]]);assert.equal((await request(`/admin/dashboard-targets/${draft.id}/delete`,{expectedRevision:draft.revision,reason:'Synthetic draft cleanup'})).status,200);
  });
 }finally{
  if(server){server.close();server.closeAllConnections?.();}
  // Dedicated synthetic fixture cleanup only; no application/customer records are touched.
  await db.execute('DELETE FROM dashboard_target_revisions WHERE target_id=ANY($1::uuid[])',[created]);await db.execute('DELETE FROM dashboard_targets WHERE id=ANY($1::uuid[])',[created]);
  await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[[actor,agent,otherAgent]]);await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[actor,agent]]);await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[actor,agent]]);await db.closeDatabase();
 }
});
