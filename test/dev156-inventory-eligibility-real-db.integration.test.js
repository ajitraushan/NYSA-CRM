import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_INVENTORY_ELIGIBILITY_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_INVENTORY_ELIGIBILITY_DB_INTEGRATION=1 inside a disposable fixture schema',timeout:15000};
let database,server,request,fixture;
const id=()=>crypto.randomUUID();
const emit=(event,data)=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside a disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to mutate a database not explicitly identified as non-production');
  const [{createApp},{default:opportunityRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/opportunities.js'),import('../src/db.js')
  ]);
  database=dbModule;const {execute,one}=database,token=crypto.randomBytes(32).toString('hex'),sessionHash=crypto.createHash('sha256').update(token).digest('hex'),prefix=`dev156-${Date.now()}`;
  fixture={admin:id(),team:id(),contactBlocked:id(),contactStatus:id(),leadBlocked:id(),leadStatus:id(),requirementBlocked:id(),requirementStatus:id(),
    opportunityBlocked:id(),opportunityStatus:id(),listingBlocked:id(),listingStatus:id(),matchBlocked:id(),matchStatusSource:id(),assignmentBlocked:id(),assignmentStatusSource:id(),
    completedViewing:id(),offer:id(),revision:id(),document:id(),documentVersion:id(),prefix};
  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role)
    VALUES($1,$2,$3,'admin','active','integration-only','admin')`,[fixture.admin,`${prefix} admin`,`${prefix}@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.admin]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[fixture.team,fixture.admin]);
  await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES
    ($1,$2,$3,'buyer',$4,$4),($5,$6,$7,'buyer',$4,$4)`,[fixture.contactBlocked,`${prefix} blocked customer`,`${prefix}-blocked@example.invalid`,fixture.admin,
    fixture.contactStatus,`${prefix} status customer`,`${prefix}-status@example.invalid`]);
  await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,created_by) VALUES
    ($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$5),($6,$7,$8,'Website','Sale','Qualified','Warm',$4,$5,$5)`,[
    fixture.leadBlocked,fixture.contactBlocked,`${prefix} blocked lead`,fixture.team,fixture.admin,fixture.leadStatus,fixture.contactStatus,`${prefix} status lead`]);
  await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,must_haves,exclusions,created_by)
    VALUES($1,$2,1,'Sale','own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',ARRAY['Unobstructed sea view'],ARRAY['Tenanted property'],$3),
      ($4,$5,1,'Sale','own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',ARRAY[]::text[],ARRAY[]::text[],$3)`,[
    fixture.requirementBlocked,fixture.leadBlocked,fixture.admin,fixture.requirementStatus,fixture.leadStatus]);
  await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
    workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
    VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',900,1000000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready'),
      ($5,$6,$7,'Integration Test Area','Integration Test Community','Apartment','2',950,1100000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,[
    fixture.listingBlocked,`${prefix} blocked inventory`,`${prefix} blocked project`,fixture.admin,fixture.listingStatus,`${prefix} status inventory`,`${prefix} status project`]);
  await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7),
      ($9,$10,$11,$12,$13,$6,$7,$14,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7)`,[
    fixture.opportunityBlocked,`NYSA-OP-TEST-${fixture.opportunityBlocked.slice(0,8)}`,fixture.leadBlocked,fixture.contactBlocked,fixture.requirementBlocked,fixture.team,fixture.admin,`${prefix} blocked opportunity`,
    fixture.opportunityStatus,`NYSA-OP-TEST-${fixture.opportunityStatus.slice(0,8)}`,fixture.leadStatus,fixture.contactStatus,fixture.requirementStatus,`${prefix} status opportunity`]);
  for(const [opportunityId,leadId,source] of [[fixture.opportunityBlocked,fixture.leadBlocked,'blocked'],[fixture.opportunityStatus,fixture.leadStatus,'status']]){
    const snapshot=JSON.stringify({source:'Website',fixture:source});
    await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
      VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),opportunityId,leadId,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);
  }
  await execute('INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'1 hour\')',[sessionHash,fixture.admin]);
  const app=createApp();app.mount('/api',opportunityRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{
    method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let payload;try{payload=await response.json();}catch{payload={error:'non-JSON response'};}return{status:response.status,payload};};
});

after(()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)database.closeDatabase().catch(()=>{});
});

test('FIT-DECLARATIONS-RANKING-ONLY-156 permits an unassessed customer-fit variance while preserving evidence',gate,async()=>{
  const {one}=database,f=fixture;
  const before=(await one('SELECT COUNT(*)::int AS count FROM inventory_assignments WHERE opportunity_id=$1',[f.opportunityBlocked])).count;
  emit('fixture',{test:'FIT-DECLARATIONS-RANKING-ONLY-156',opportunityId:f.opportunityBlocked,listingId:f.listingBlocked,requirementId:f.requirementBlocked,governedOrigin:false,assignmentRowsBefore:before});
  const assignment=await request(`/api/crm/opportunities/${f.opportunityBlocked}/matches`,{method:'POST',body:{listingId:f.listingBlocked,fitStatus:'exception',rationale:'Customer-fit declarations remain visible ranking evidence and do not make operationally valid Inventory ineligible',exceptions:'Unassessed sea-view must-have and tenancy exclusion require customer review',availabilityLikelyConfirmed:true}});
  emit('http-response',{boundary:'assignment',status:assignment.status,payload:assignment.payload});
  assert.equal(assignment.status,201);
  const after=(await one('SELECT COUNT(*)::int AS count FROM inventory_assignments WHERE opportunity_id=$1',[f.opportunityBlocked])).count;
  assert.equal(after,before+1);
  const match=await one('SELECT fit_status,rationale,exceptions FROM property_matches WHERE opportunity_id=$1 AND listing_id=$2',[f.opportunityBlocked,f.listingBlocked]);
  assert.equal(match.fitStatus,'exception');assert.match(match.exceptions,/sea-view|tenancy/i);
  emit('database-after',{assignmentRowsAfter:after,match});
  emit('result',{test:'FIT-DECLARATIONS-RANKING-ONLY-156',httpStatus:assignment.status,pass:true});
});

test('P0-INVENTORY-EFFECTIVE-STATUS-PARITY-157 reports canonical status when stored Inventory status is stale',gate,async()=>{
  const {execute,one}=database,f=fixture;
  await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,shortlist_status,shortlisted_at,created_by,updated_by)
    VALUES($1,$2,$3,$4,'manual','strong_fit','Synthetic status source','shortlisted',NOW(),$5,$5)`,[f.matchStatusSource,f.opportunityBlocked,f.requirementBlocked,f.listingStatus,f.admin]);
  await execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,starts_at,expires_at,created_by)
    VALUES($1,$2,$3,$4,NOW(),NOW()+INTERVAL '7 days',$5)`,[f.assignmentStatusSource,f.opportunityBlocked,f.listingStatus,f.matchStatusSource,f.admin]);
  const before=await one('SELECT status,nysa_inventory_effective_status(id) AS effective_status FROM listings WHERE id=$1',[f.listingStatus]);
  emit('database-before',{test:'P0-INVENTORY-EFFECTIVE-STATUS-PARITY-157',opportunityId:f.opportunityStatus,listingId:f.listingStatus,row:before});
  assert.equal(before.status,'Available');assert.equal(before.effectiveStatus,'Assigned');
  const matching=await request(`/api/crm/opportunities/${f.opportunityStatus}/matching-inventory`);
  emit('http-response',{boundary:'matching-inventory',status:matching.status,payload:matching.payload});
  assert.equal(matching.status,200);const row=matching.payload.listings.find(item=>item.id===f.listingStatus);
  assert.ok(row,'Derived-Assigned Inventory must remain visible to the permitted matching boundary');
  assert.equal(row.storedStatus,'Available');assert.equal(row.effectiveStatus,'Assigned');assert.equal(row.status,'Assigned');
  const after=await one('SELECT status,nysa_inventory_effective_status(id) AS effective_status FROM listings WHERE id=$1',[f.listingStatus]);
  emit('database-after',{test:'P0-INVENTORY-EFFECTIVE-STATUS-PARITY-157',row:after});
  emit('result',{test:'P0-INVENTORY-EFFECTIVE-STATUS-PARITY-157',storedStatus:row.storedStatus,effectiveStatus:row.effectiveStatus,reportedStatus:row.status,httpStatus:matching.status,pass:true});
});
