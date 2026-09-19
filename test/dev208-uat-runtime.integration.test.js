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
  ids.tokens={};for(const key of ['admin','agent','manager']){const raw=crypto.randomBytes(32).toString('hex');ids.tokens[key]=raw;await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(raw).digest('hex'),ids[key]]);}
  const app=createApp();for(const route of [officialRoutes,marketingRoutes,leaveRoutes,taskRoutes,importRoutes])app.mount('/api',route);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  requestAs=async(role,path)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{headers:{authorization:`Bearer ${ids.tokens[role]}`}});return{status:response.status,payload:await response.json()};};
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(db&&ids){await db.execute('DELETE FROM purchased_data_import_authorizations WHERE broker_id=$1',[ids.manager]);await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[ids.admin,ids.agent,ids.manager]]);await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[ids.admin,ids.agent,ids.manager]]);await db.closeDatabase();}
});

test('Admin can maintain official-document and marketing configuration but cannot open operational evidence',gate,async()=>{
  const definitions=await requestAs('admin','/api/admin/official-document-definitions');assert.equal(definitions.status,200,JSON.stringify(definitions.payload));
  const marketing=await requestAs('admin','/api/marketing-material-compliance/configuration');assert.equal(marketing.status,200,JSON.stringify(marketing.payload));assert.equal(marketing.payload.canDraftConfiguration,true);
  const evidence=await requestAs('admin',`/api/crm/deals/${crypto.randomUUID()}/official-document-requirements?stepCode=sale_agreement`);assert.equal(evidence.status,403);assert.match(evidence.payload.error,/configuration and leave administration/i);
});

test('Sales Agent leave and Manager task endpoints return governed empty states instead of server errors',gate,async()=>{
  const leave=await requestAs('agent','/api/crm/my-leave-balances');assert.equal(leave.status,200,JSON.stringify(leave.payload));assert.deepEqual(leave.payload.balances,[]);
  const tasks=await requestAs('manager','/api/crm/tasks?bucket=open&mine=1');assert.equal(tasks.status,200,JSON.stringify(tasks.payload));assert.ok(Array.isArray(tasks.payload.tasks));
});

test('purchased-data register stays closed until Admin explicitly grants operational authority',gate,async()=>{
  const blocked=await requestAs('manager','/api/crm/purchased-data-import/batches');assert.equal(blocked.status,403);
  await db.execute(`INSERT INTO purchased_data_import_authorizations(broker_id,may_preview,may_confirm,reason,configured_by) VALUES($1,1,1,'Synthetic runtime verification only',$2)`,[ids.manager,ids.admin]);
  const allowed=await requestAs('manager','/api/crm/purchased-data-import/batches');assert.equal(allowed.status,200,JSON.stringify(allowed.payload));assert.ok(Array.isArray(allowed.payload.batches));
});
