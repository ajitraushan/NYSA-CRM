import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV160_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DEV160_DB_INTEGRATION=1 inside the disposable fixture schema',timeout:20000};
const id=()=>crypto.randomUUID();
let database,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside a disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to mutate a database not identified as non-production');
  const [{createApp},{default:authRoutes},{default:adminRoutes},{default:marketRoutes},{default:qualificationRoutes},auth,db]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/auth.js'),import('../src/routes/admin.js'),import('../src/routes/dld-market-intelligence.js'),import('../src/routes/qualification-finance.js'),import('../src/auth.js'),import('../src/db.js')
  ]);
  database=db;const token=crypto.randomBytes(32).toString('hex'),sessionHash=crypto.createHash('sha256').update(token).digest('hex'),prefix=`dev160-${Date.now()}`;
  fixture={admin:id(),area:id(),community:id(),communityVersion:id(),contact:id(),lead:id(),activity:id(),prefix};
  fixture.email=`${prefix}@example.invalid`;fixture.password='Dev160-integration-only!';
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'admin','active',$4,'admin')`,[fixture.admin,`${prefix} administrator`,fixture.email,auth.hashPassword(fixture.password)]);
  await db.execute('INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'1 hour\')',[sessionHash,fixture.admin]);
  await db.execute(`INSERT INTO areas(id,stable_code,business_label,emirate,created_by) VALUES($1,$2,$3,'Dubai',$4)`,[fixture.area,`${prefix.replaceAll('-','_')}_area`,`${prefix} Area`,fixture.admin]);
  await db.execute('INSERT INTO market_communities(id,stable_code,area_id,created_by) VALUES($1,$2,$3,$4)',[fixture.community,`${prefix.replaceAll('-','_')}_community`,fixture.area,fixture.admin]);
  await db.execute(`INSERT INTO market_community_versions(id,community_id,area_id,version_number,business_label,normalized_label,status,created_by,approved_by,approved_at)
    VALUES($1,$2,$3,1,$4,$5,'active',$6,$6,NOW())`,[fixture.communityVersion,fixture.community,fixture.area,`${prefix} Community`,`${prefix} community`,fixture.admin]);
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,[fixture.contact,`${prefix} Customer`,`${prefix}-customer@example.invalid`,fixture.admin]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id)
    VALUES($1,$2,$3,'Website','Sale','Contacted','Unassessed',$4,$4,'buy','ready_secondary','residential','uat062-v1','06200000-0000-4000-8000-000000000001')`,[fixture.lead,fixture.contact,`${prefix} Lead`,fixture.admin]);
  await db.execute(`INSERT INTO activities(id,lead_id,contact_id,activity_type,subject,direction,outcome,due_at,completed_at,owner_id,created_by,contact_outcome_code)
    VALUES($1,$2,$3,'Call','Substantive Customer discussion','Outbound','Requirements discussed',NOW()+INTERVAL '1 day',NOW(),$4,$4,'substantive_discussion')`,[fixture.activity,fixture.lead,fixture.contact,fixture.admin]);
  const app=createApp();app.mount('/api',authRoutes);app.mount('/api',adminRoutes);app.mount('/api',marketRoutes);app.mount('/api',qualificationRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body,authenticated=true}={})=>{const headers={'content-type':'application/json'};if(authenticated)headers.authorization=`Bearer ${token}`;const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let payload;try{payload=await response.json();}catch{payload={error:'non-JSON response'};}return{status:response.status,payload,headers:Object.fromEntries(response.headers)};};
});

after(()=>{if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}if(database)database.closeDatabase().catch(()=>{});});

test('UAT-072 and UAT-074 expose one-time delivery evidence and explicit persistent-session behavior',gate,async()=>{
  const sessionOnly=await request('/api/auth/login',{method:'POST',authenticated:false,body:{email:fixture.email,password:fixture.password,rememberMe:false}});assert.equal(sessionOnly.status,200,JSON.stringify(sessionOnly.payload));assert.doesNotMatch(sessionOnly.headers['set-cookie'],/Max-Age=/i);
  const remembered=await request('/api/auth/login',{method:'POST',authenticated:false,body:{email:fixture.email,password:fixture.password,rememberMe:true}});assert.equal(remembered.status,200,JSON.stringify(remembered.payload));assert.match(remembered.headers['set-cookie'],/Max-Age=604800/i);
  const requested=await request('/api/auth/password-reset-requests',{method:'POST',authenticated:false,body:{email:fixture.email}});assert.equal(requested.status,200);
  const queue=await request('/api/admin/password-reset-requests');const open=queue.payload.requests.find(x=>x.email===fixture.email);assert.ok(open);
  const issued=await request(`/api/admin/password-reset-requests/${open.id}/issue`,{method:'POST'});assert.equal(issued.status,200);assert.match(issued.payload.code,/^NYSA-RST-/);
  const delivered=await request(`/api/admin/password-reset-requests/${open.id}/delivery`,{method:'POST',body:{confirmed:true}});assert.equal(delivered.status,200);
  const evidence=await database.one('SELECT delivery_method,delivery_recorded_at,code_hash FROM password_reset_requests WHERE id=$1',[open.id]);assert.equal(evidence.deliveryMethod,'manual_approved_private_channel');assert.ok(evidence.deliveryRecordedAt);assert.ok(evidence.codeHash);assert.notEqual(evidence.codeHash,issued.payload.code);
});

test('UAT-075 creates Building and audit atomically, then reports exact duplicate without another row',gate,async()=>{
  const stableCode=`b_${fixture.prefix.replaceAll('-','_')}`,body={stableCode,communityId:fixture.community,businessLabel:`${fixture.prefix} Tower`};
  const created=await request('/api/admin/inventory-buildings',{method:'POST',body});assert.equal(created.status,201,JSON.stringify(created.payload));
  const stored=await database.one(`SELECT b.id,(SELECT COUNT(*)::int FROM audit_log a WHERE a.entity_type='InventoryBuilding' AND a.entity_id=b.id) AS audits FROM inventory_buildings b WHERE b.stable_code=$1`,[stableCode]);
  assert.equal(stored.audits,1);
  const duplicate=await request('/api/admin/inventory-buildings',{method:'POST',body});assert.equal(duplicate.status,409);assert.match(duplicate.payload.error,/stable code .* already exists/i);
  const count=await database.one('SELECT COUNT(*)::int AS n FROM inventory_buildings WHERE stable_code=$1',[stableCode]);assert.equal(count.n,1);
});

test('UAT-078 creates objective-specific version 1 rows under one stable model code',gate,async()=>{
  const factors=[{code:'readiness',label:'Readiness',question:'How ready is the Customer to proceed?',inputSource:'agent_confirmed',answerType:'scale',min:0,max:10,weight:100,required:true,missingTreatment:'reject'}];
  for(const customerObjective of ['buy','sell']){const result=await request('/api/admin/qualification-models',{method:'POST',body:{modelCode:'lead_readiness',name:`${customerObjective} readiness`,purpose:'Governed Lead qualification',customerObjective,factors,thresholds:{warmMin:45,hotMin:75},guidance:{}}});assert.equal(result.status,201,JSON.stringify(result.payload));assert.equal(result.payload.version,1);}
  const rows=await database.many("SELECT customer_objective,version FROM qualification_models WHERE model_code='lead_readiness' AND customer_objective IN('buy','sell') ORDER BY customer_objective");assert.deepEqual(rows.map(x=>[x.customerObjective,x.version]),[['buy',1],['sell',1]]);
});

test('UAT-077 completed assessment atomically records score and advances Contacted Lead to Qualified',gate,async()=>{
  const model=await database.one("SELECT id FROM qualification_models WHERE model_code='lead_readiness' AND customer_objective='buy' AND status='draft'");
  const approved=await request(`/api/admin/qualification-models/${model.id}/approve`,{method:'POST',body:{reason:'Disposable integration test approval'}});assert.equal(approved.status,200,JSON.stringify(approved.payload));
  const activated=await request(`/api/admin/qualification-models/${model.id}/activate`,{method:'POST'});assert.equal(activated.status,200,JSON.stringify(activated.payload));
  const assessed=await request(`/api/crm/leads/${fixture.lead}/qualification-assessments`,{method:'POST',body:{inputs:{readiness:8}}});assert.equal(assessed.status,201,JSON.stringify(assessed.payload));assert.equal(assessed.payload.leadStage,'Qualified');
  const state=await database.one(`SELECT l.stage,l.temperature,(SELECT COUNT(*)::int FROM qualification_assessments a WHERE a.lead_id=l.id) AS assessments,(SELECT COUNT(*)::int FROM lead_stage_history h WHERE h.lead_id=l.id AND h.from_stage='Contacted' AND h.to_stage='Qualified' AND h.reason_code='qualification_assessment_completed') AS transitions FROM leads l WHERE l.id=$1`,[fixture.lead]);
  assert.equal(state.stage,'Qualified');assert.equal(state.temperature,'Hot');assert.equal(state.assessments,1);assert.equal(state.transitions,1);
});

test('UAT-079 retires the active objective model with reasoned audit evidence',gate,async()=>{
  const model=await database.one("SELECT id FROM qualification_models WHERE model_code='lead_readiness' AND customer_objective='buy' AND status='active'");
  const retired=await request(`/api/admin/qualification-models/${model.id}/retire`,{method:'POST',body:{reason:'Replacement questionnaire will be configured'}});assert.equal(retired.status,200,JSON.stringify(retired.payload));assert.equal(retired.payload.status,'retired');
  const audit=await database.one("SELECT details FROM audit_log WHERE entity_type='QualificationModel' AND entity_id=$1 AND action='retired' ORDER BY timestamp DESC LIMIT 1",[model.id]);assert.equal(JSON.parse(audit.details).reason,'Replacement questionnaire will be configured');
});
