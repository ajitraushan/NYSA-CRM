import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV208_RUNTIME_INTEGRATION==='1',gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let db,server,requestAs,ids;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to run outside a named test database');
  const [{createApp},{default:officialRoutes},{default:marketingRoutes},{default:leaveRoutes},{default:taskRoutes},{default:importRoutes},database]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/official-document-evidence.js'),import('../src/routes/marketing-material-compliance.js'),import('../src/routes/agent-leave.js'),import('../src/routes/lead-operations.js'),import('../src/routes/purchased-data-import.js'),import('../src/db.js')
  ]);
  db=database;ids={admin:crypto.randomUUID(),agent:crypto.randomUUID(),manager:crypto.randomUUID()};
  const stamp=Date.now();
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,'Synthetic Admin',$2,'admin','active','synthetic-only','admin'),
    ($3,'Synthetic Agent',$4,'internal_broker','active','synthetic-only','sales_agent'),
    ($5,'Synthetic Manager',$6,'internal_broker','active','synthetic-only','manager')`,[ids.admin,`dev208-admin-${stamp}@example.invalid`,ids.agent,`dev208-agent-${stamp}@example.invalid`,ids.manager,`dev208-manager-${stamp}@example.invalid`]);
  ids.leave={type:crypto.randomUUID(),typeVersion:crypto.randomUUID(),policy:crypto.randomUUID(),entitlement:crypto.randomUUID(),employment:crypto.randomUUID(),employmentVersion:crypto.randomUUID()};
  await db.execute(`INSERT INTO leave_types(id,type_code,created_by) VALUES($1,$2,$3)`,[ids.leave.type,`synthetic_${String(stamp).slice(-8)}`,ids.admin]);
  await db.execute(`INSERT INTO leave_type_versions(id,leave_type_id,version_no,label,paid_classification,effective_from,status,reason,created_by,activated_by,activated_at) VALUES($1,$2,1,'Synthetic annual leave','paid',CURRENT_DATE-1,'active','Synthetic runtime verification',$3,$3,NOW())`,[ids.leave.typeVersion,ids.leave.type,ids.admin]);
  await db.execute(`INSERT INTO leave_policy_versions(id,policy_code,version_no,name,effective_from,status,reason,created_by,activated_by,activated_at) VALUES($1,$2,1,'Synthetic policy',CURRENT_DATE-1,'active','Synthetic runtime verification',$3,$3,NOW())`,[ids.leave.policy,`synthetic_${String(stamp).slice(-8)}`,ids.admin]);
  await db.execute(`INSERT INTO leave_policy_entitlements(id,policy_version_id,leave_type_version_id,display_order,annual_units) VALUES($1,$2,$3,1,20)`,[ids.leave.entitlement,ids.leave.policy,ids.leave.typeVersion]);
  await db.execute(`INSERT INTO agent_employments(id,broker_id,created_by) VALUES($1,$2,$3)`,[ids.leave.employment,ids.agent,ids.admin]);
  await db.execute(`INSERT INTO agent_employment_versions(id,employment_id,version_no,employment_status,effective_from,start_date,reporting_manager_id,policy_version_id,status,reason,created_by,activated_by,activated_at) VALUES($1,$2,1,'active',CURRENT_DATE-1,CURRENT_DATE-1,$3,$4,'active','Synthetic runtime verification',$5,$5,NOW())`,[ids.leave.employmentVersion,ids.leave.employment,ids.manager,ids.leave.policy,ids.admin]);
  ids.tokens={};for(const key of ['admin','agent','manager']){const raw=crypto.randomBytes(32).toString('hex');ids.tokens[key]=raw;await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(raw).digest('hex'),ids[key]]);}
  const app=createApp();for(const route of [officialRoutes,marketingRoutes,leaveRoutes,taskRoutes,importRoutes])app.mount('/api',route);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  requestAs=async(role,path)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{headers:{authorization:`Bearer ${ids.tokens[role]}`}});return{status:response.status,payload:await response.json()};};
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(db&&ids){await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[ids.admin,ids.agent,ids.manager]]);if(ids.leave){await db.execute('DELETE FROM agent_employment_versions WHERE id=$1',[ids.leave.employmentVersion]);await db.execute('DELETE FROM agent_employments WHERE id=$1',[ids.leave.employment]);await db.execute('DELETE FROM leave_policy_entitlements WHERE id=$1',[ids.leave.entitlement]);await db.execute('DELETE FROM leave_policy_versions WHERE id=$1',[ids.leave.policy]);await db.execute('DELETE FROM leave_type_versions WHERE id=$1',[ids.leave.typeVersion]);await db.execute('DELETE FROM leave_types WHERE id=$1',[ids.leave.type]);}await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[ids.admin,ids.agent,ids.manager]]);await db.closeDatabase();}
});

test('Admin can maintain official-document and marketing configuration but cannot open operational evidence',gate,async()=>{
  const definitions=await requestAs('admin','/api/admin/official-document-definitions');assert.equal(definitions.status,200,JSON.stringify(definitions.payload));
  const marketing=await requestAs('admin','/api/marketing-material-compliance/configuration');assert.equal(marketing.status,200,JSON.stringify(marketing.payload));assert.equal(marketing.payload.canDraftConfiguration,true);
  const evidence=await requestAs('admin',`/api/crm/deals/${crypto.randomUUID()}/official-document-requirements?stepCode=sale_agreement`);assert.equal(evidence.status,403);assert.match(evidence.payload.error,/configuration, purchased-data intake and leave administration/i);
});

test('Sales Agent populated leave and Manager task endpoints return governed states instead of server errors',gate,async()=>{
  const employment=await requestAs('agent','/api/crm/my-employment');assert.equal(employment.status,200,JSON.stringify(employment.payload));assert.equal(employment.payload.employment.employmentId,ids.leave.employment);
  const leave=await requestAs('agent','/api/crm/my-leave-balances');assert.equal(leave.status,200,JSON.stringify(leave.payload));assert.equal(leave.payload.balances.length,1);assert.equal(leave.payload.balances[0].leaveTypeVersionId,ids.leave.typeVersion);
  const applications=await requestAs('agent','/api/crm/my-leave-applications');assert.equal(applications.status,200,JSON.stringify(applications.payload));assert.deepEqual(applications.payload.applications,[]);
  const tasks=await requestAs('manager','/api/crm/tasks?bucket=open&mine=1');assert.equal(tasks.status,200,JSON.stringify(tasks.payload));assert.ok(Array.isArray(tasks.payload.tasks));
});

test('purchased-data register follows the central Sales Agent and Admin role capability',gate,async()=>{
  const manager=await requestAs('manager','/api/crm/purchased-data-import/batches');assert.equal(manager.status,403);
  for(const role of ['agent','admin']){const allowed=await requestAs(role,'/api/crm/purchased-data-import/batches');assert.equal(allowed.status,200,JSON.stringify(allowed.payload));assert.ok(Array.isArray(allowed.payload.batches));}
});
