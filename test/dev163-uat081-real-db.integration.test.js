import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV163_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DEV163_DB_INTEGRATION=1 inside the disposable fixture schema',timeout:30000};
const id=()=>crypto.randomUUID();
let database,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside a disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to mutate a database not identified as non-production');
  const [{createApp},{default:qualificationRoutes},{default:leadOperationsRoutes},auth,db]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/qualification-finance.js'),import('../src/routes/lead-operations.js'),import('../src/auth.js'),import('../src/db.js')
  ]);
  database=db;const token=crypto.randomBytes(32).toString('hex'),sessionHash=crypto.createHash('sha256').update(token).digest('hex'),prefix=`dev163-${Date.now()}`;
  fixture={admin:id(),contact:id(),lead:id(),activity:id(),prefix,email:`${prefix}@example.invalid`,password:'Dev163-integration-only!'};
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'admin','active',$4,'admin')`,[fixture.admin,`${prefix} administrator`,fixture.email,auth.hashPassword(fixture.password)]);
  await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[sessionHash,fixture.admin]);
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,[fixture.contact,`${prefix} Customer`,`${prefix}-customer@example.invalid`,fixture.admin]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id)
    VALUES($1,$2,$3,'Website','Sale','Contacted','Unassessed',$4,$4,'buy','ready_secondary','residential','uat062-v1',(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'))`,[fixture.lead,fixture.contact,`${prefix} Lead`,fixture.admin]);
  await db.execute(`INSERT INTO activities(id,lead_id,contact_id,activity_type,subject,direction,outcome,due_at,completed_at,owner_id,created_by,contact_outcome_code)
    VALUES($1,$2,$3,'Call','Substantive Customer discussion','Outbound','Requirements discussed',NOW()+INTERVAL '1 day',NOW(),$4,$4,'substantive_discussion')`,[fixture.activity,fixture.lead,fixture.contact,fixture.admin]);
  const app=createApp();app.mount('/api',qualificationRoutes);app.mount('/api',leadOperationsRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let payload;try{payload=await response.json();}catch{payload={};}return{status:response.status,payload};};
});

after(async()=>{if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}if(database)await database.closeDatabase();});

test('UAT-081 real HTTP and PostgreSQL evidence creates deadline, supersedes reassessment, and recurs Cold nurture',gate,async()=>{
  const policy=await request('/api/admin/sla-policies',{method:'POST',body:{name:`${fixture.prefix} SLA`,workDays:[1,2,3,4,5],workStartMinute:540,workEndMinute:1080,acceptanceMinutes:30,firstContactMinutes:240,qualificationHotElapsedMinutes:15,qualificationWarmBusinessMinutes:240,qualificationColdBusinessDays:1,qualificationColdNurtureBusinessDays:5}});
  assert.equal(policy.status,201,JSON.stringify(policy.payload));assert.equal((await request(`/api/admin/sla-policies/${policy.payload.id}/activate`,{method:'POST'})).status,200);
  const factors=[{code:'readiness',label:'Readiness',question:'How ready is the Customer to proceed?',inputSource:'agent_confirmed',answerType:'scale',min:0,max:10,weight:100,required:true,missingTreatment:'reject'}];
  const model=await request('/api/admin/qualification-models',{method:'POST',body:{modelCode:'lead_readiness',name:`${fixture.prefix} readiness`,purpose:'Governed qualification SLA evidence',customerObjective:'buy',factors,thresholds:{warmMin:45,hotMin:75},guidance:{}}});
  assert.equal(model.status,201,JSON.stringify(model.payload));assert.equal((await request(`/api/admin/qualification-models/${model.payload.id}/approve`,{method:'POST',body:{reason:'Disposable UAT-081 integration evidence'}})).status,200);assert.equal((await request(`/api/admin/qualification-models/${model.payload.id}/activate`,{method:'POST'})).status,200);

  const hotStarted=Date.now(),hot=await request(`/api/crm/leads/${fixture.lead}/qualification-assessments`,{method:'POST',body:{inputs:{readiness:8}}});
  assert.equal(hot.status,201,JSON.stringify(hot.payload));assert.equal(hot.payload.finalTemperature,'Hot');assert.equal(hot.payload.nextAction.priority,'urgent');
  const hotDue=new Date(hot.payload.nextAction.dueAt).getTime();assert.ok(hotDue-hotStarted>=14*60000&&hotDue-hotStarted<=16*60000);
  const hotState=await database.one(`SELECT t.task_type,t.status,t.priority,q.temperature,q.timer_basis,q.target_minutes,l.next_follow_up_at
    FROM tasks t JOIN qualification_follow_up_task_links q ON q.task_id=t.id JOIN leads l ON l.id=q.lead_id WHERE q.assessment_id=$1`,[hot.payload.id]);
  assert.equal(hotState.taskType,'qualification_follow_up');assert.equal(hotState.status,'open');assert.equal(hotState.priority,'urgent');assert.equal(hotState.timerBasis,'elapsed_minutes');assert.equal(hotState.targetMinutes,15);assert.equal(new Date(hotState.nextFollowUpAt).getTime(),hotDue);

  const cold=await request(`/api/crm/leads/${fixture.lead}/qualification-assessments`,{method:'POST',body:{inputs:{readiness:2}}});
  assert.equal(cold.status,201,JSON.stringify(cold.payload));assert.equal(cold.payload.finalTemperature,'Cold');assert.equal(cold.payload.nextAction.cadenceBusinessDays,5);
  assert.equal((await database.one("SELECT COUNT(*)::int AS n FROM tasks WHERE id=$1 AND status='cancelled'",[hot.payload.nextAction.taskId])).n,1);
  const completed=await request(`/api/crm/tasks/${cold.payload.nextAction.taskId}`,{method:'PATCH',body:{status:'completed',outcome:'Weekly nurture call completed'}});
  assert.equal(completed.status,200,JSON.stringify(completed.payload));assert.ok(completed.payload.successorTask?.id);
  const cycles=await database.many('SELECT cycle_number,temperature,cadence_business_days FROM qualification_follow_up_task_links WHERE assessment_id=$1 ORDER BY cycle_number',[cold.payload.id]);
  assert.deepEqual(cycles.map(x=>[x.cycleNumber,x.temperature,x.cadenceBusinessDays]),[[1,'Cold',5],[2,'Cold',5]]);
});
