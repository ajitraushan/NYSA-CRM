// Protected runtime evidence for UAT-082 through UAT-085.
// Uses a disposable PostgreSQL fixture, real HTTP routes and independent DB reads.

import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV164_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DEV164_DB_INTEGRATION=1 inside a disposable fixture schema',timeout:30000};
const id=()=>crypto.randomUUID();
let database,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside a disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to mutate a database not explicitly identified as non-production');
  const [{createApp},{default:matchingRoutes},{default:crmRoutes},{default:opportunityRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/governed-matching.js'),import('../src/routes/crm.js'),import('../src/routes/opportunities.js'),import('../src/db.js')
  ]);
  database=dbModule;
  const {execute}=database,prefix=`dev164-${Date.now()}`,token=crypto.randomBytes(32).toString('hex');
  fixture={broker:id(),team:id(),contact:id(),lead:id(),requirement:id(),targetOpportunity:id(),distractorOpportunity:id(),listing:id(),prefix};
  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'admin','active','integration-only','admin')`,
    [fixture.broker,`${prefix} broker`,`${prefix}@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.broker]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[fixture.team,fixture.broker]);
  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",
    [crypto.createHash('sha256').update(token).digest('hex'),fixture.broker]);
  await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,
    [fixture.contact,`${prefix} customer`,`${prefix}-customer@example.invalid`,fixture.broker]);
  await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,customer_objective,market_stage_requirement,property_segment_requirement,
    classification_version,classification_catalogue_version_id,classification_mapping_evidence,stage,temperature,assigned_team_id,assigned_to,created_by)
    VALUES($1,$2,$3,'Website','Sale','buy','ready_secondary','residential','uat062-v1',
    (SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy"}'::jsonb,
    'Qualified','Warm',$4,$5,$5)`,[fixture.lead,fixture.contact,`${prefix} lead`,fixture.team,fixture.broker]);
  const reviewedAi={summary:'Customer seeks a ready residential apartment for own use in the selected area.',confidence:'medium',
    unansweredQuestions:['Confirm preferred view.'],warnings:['Budget flexibility is not yet confirmed.']};
  await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,customer_objective,market_stage_requirement,property_segment_requirement,
    classification_version,classification_catalogue_version_id,classification_mapping_evidence,purpose,property_types,areas,budget_min,budget_max,
    funding_method,timeline_code,must_haves,exclusions,created_by,ai_reviewed_evidence,ai_reviewed_at,ai_reviewed_by)
    VALUES($1,$2,1,'Sale','buy','ready_secondary','residential','uat062-v1',
    (SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy"}'::jsonb,
    'own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],700000,1300000,'cash','0_3_months',ARRAY[]::text[],ARRAY[]::text[],$3,$4::jsonb,NOW(),$3)`,
    [fixture.requirement,fixture.lead,fixture.broker,JSON.stringify(reviewedAi)]);
  await execute(`INSERT INTO lead_requirement_confirmations(id,requirement_id,requirement_snapshot,requirement_snapshot_hash,confirmation_basis,confirmation_notes,confirmed_by)
    VALUES($1,$2,$3::jsonb,$4,'direct_customer',$5,$6)`,[id(),fixture.requirement,JSON.stringify({id:fixture.requirement,versionNo:1}),
    crypto.createHash('sha256').update(fixture.requirement).digest('hex'),'Confirmed directly for protected runtime evidence',fixture.broker]);
  for(const [opportunityId,suffix,updatedOffset,transactionType,representationPath] of [
    [fixture.targetOpportunity,'target','2 hours','Sale','buyer'],[fixture.distractorOpportunity,'distractor','1 minute','Rental','inventory']]){
    await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,
      next_action,next_action_due_at,next_action_code,created_by,updated_at,classification_catalogue_version_id,classification_mapping_evidence,representation_path)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$10,'Requirements','Review matching',NOW()+INTERVAL '1 day','send_property_details',$7,
      NOW()-$9::interval,(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy"}'::jsonb,$11)`,
      [opportunityId,`NYSA-OP-TEST-${opportunityId.slice(0,8)}`,fixture.lead,fixture.contact,fixture.requirement,fixture.team,fixture.broker,`${prefix} ${suffix}`,updatedOffset,transactionType,representationPath]);
  }
  await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,
    responsible_agent_id,originating_agent_id,workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,
    payment_plan_type,handover_status) VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',900,1000000,'AED','Available',$4,$4,$4,
    'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,[fixture.listing,`${prefix} inventory`,`${prefix} project`,fixture.broker]);

  const app=createApp();app.mount('/api',matchingRoutes);app.mount('/api',crmRoutes);app.mount('/api',opportunityRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{
    method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let payload;try{payload=await response.json();}catch{payload={};}return{status:response.status,payload};};
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)await database.closeDatabase();
});

test('UAT-082/084/085 binds the visible Opportunity, preserves AI summary, and atomically shortlists plus assigns',gate,async()=>{
  const run=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs`,{method:'POST',body:{opportunityId:fixture.targetOpportunity}});
  assert.equal(run.status,201,JSON.stringify(run.payload));
  assert.equal(run.payload.opportunityId,fixture.targetOpportunity,'Must not silently bind the newer distractor Opportunity');
  assert.equal(run.payload.requirementId,fixture.requirement);
  assert.equal(run.payload.requirementSnapshot.reviewedAiSummary.summary,'Customer seeks a ready residential apartment for own use in the selected area.');
  const candidate=run.payload.candidates.find(item=>item.listingId===fixture.listing);
  assert.ok(candidate,'Fixture Inventory must be returned by the governed ranking');

  const decision=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs/${run.payload.id}/candidates/${candidate.id}/decisions`,{method:'POST',body:{
    decision:'shortlisted',reasonCode:'strong_fit',reasonNotes:'Customer and broker reviewed this ranked property',expectedPreviousDecisionId:null,
    assignToOpportunity:true,requestId:id()
  }});
  assert.equal(decision.status,201,JSON.stringify(decision.payload));
  assert.equal(decision.payload.createsPropertyMatch,true);
  assert.equal(decision.payload.createsInventoryAssignment,true);
  assert.ok(decision.payload.assignment?.id);

  const state=await database.one(`SELECT r.opportunity_id,r.requirement_id,r.requirement_snapshot,d.decision,
    pm.id AS property_match_id,pm.requirement_id AS match_requirement_id,origin.matching_run_id,origin.candidate_id,
    a.id AS assignment_id,a.state,a.starts_at,a.expires_at,o.stage,l.status AS stored_listing_status
    FROM inventory_matching_runs r JOIN inventory_matching_candidates c ON c.run_id=r.id
    JOIN inventory_match_decisions d ON d.candidate_id=c.id AND d.decision='shortlisted'
    JOIN property_match_governed_origins origin ON origin.candidate_id=c.id
    JOIN property_matches pm ON pm.id=origin.property_match_id
    JOIN inventory_assignments a ON a.property_match_id=pm.id AND a.state='active'
    JOIN opportunities o ON o.id=r.opportunity_id JOIN listings l ON l.id=c.listing_id
    WHERE r.id=$1 AND c.id=$2`,[run.payload.id,candidate.id]);
  assert.equal(state.opportunityId,fixture.targetOpportunity);
  assert.equal(state.requirementId,fixture.requirement);
  assert.equal(state.matchRequirementId,fixture.requirement);
  assert.equal(state.matchingRunId,run.payload.id);
  assert.equal(state.candidateId,candidate.id);
  assert.equal(state.assignmentId,decision.payload.assignment.id);
  assert.equal(state.state,'active');
  assert.equal(state.stage,'Matching');
  assert.equal(state.storedListingStatus,'Available','Assignment must not reserve or rewrite Inventory status');
  assert.ok(new Date(state.expiresAt)-new Date(state.startsAt)>=6.99*86400000,'Assignment must retain the seven-day governed period');
  const event=await database.one("SELECT event_data FROM inventory_assignment_events WHERE assignment_id=$1 AND event_type='created'",[state.assignmentId]);
  assert.equal(event.eventData.matchingRunId,run.payload.id);
  assert.equal(event.eventData.candidateId,candidate.id);

  const context=await request(`/api/crm/leads/${fixture.lead}/operating-context`);
  assert.equal(context.status,200,JSON.stringify(context.payload));
  const requirementsStep=context.payload.steps.find(item=>item.code==='requirements');
  assert.equal(requirementsStep.status,'completed','Confirmed aligned Requirements must be shown as completed');

  const rejected=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs/${run.payload.id}/candidates/${candidate.id}/decisions`,{method:'POST',body:{
    decision:'rejected',reasonCode:'customer_preference',reasonNotes:'Customer decided not to proceed with this property',
    expectedPreviousDecisionId:decision.payload.decision.id,assignToOpportunity:false
  }});
  assert.equal(rejected.status,201,JSON.stringify(rejected.payload));
  assert.equal(rejected.payload.assignmentDelinked,true,'A later governed rejection must deliberately end the active assignment');
  const ended=await database.one('SELECT state,ended_at,end_reason FROM inventory_assignments WHERE id=$1',[state.assignmentId]);
  assert.equal(ended.state,'delinked');assert.ok(ended.endedAt);assert.match(ended.endReason,/changed to rejected/);
  const delinkEvent=await database.one("SELECT event_data FROM inventory_assignment_events WHERE assignment_id=$1 AND event_type='delinked'",[state.assignmentId]);
  assert.equal(delinkEvent.eventData.decisionId,rejected.payload.decision.id);
});

test('UAT-082 realigns exact confirmed lineage before UAT-083/085 rerun and atomic assignment',gate,async()=>{
  const otherRequirement=id();
  await database.execute('UPDATE lead_requirements SET superseded_at=NOW() WHERE id=$1',[fixture.requirement]);
  await database.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,must_haves,exclusions,created_by)
    VALUES($1,$2,2,'Sale','own_use',ARRAY['Apartment'],ARRAY['Other Area'],700000,1300000,'cash','0_3_months',ARRAY[]::text[],ARRAY[]::text[],$3)`,
    [otherRequirement,fixture.lead,fixture.broker]);
  await database.execute(`INSERT INTO lead_requirement_confirmations(id,requirement_id,requirement_snapshot,requirement_snapshot_hash,confirmation_basis,confirmation_notes,confirmed_by)
    VALUES($1,$2,$3::jsonb,$4,'direct_customer',$5,$6)`,[id(),otherRequirement,JSON.stringify({id:otherRequirement,versionNo:2}),
    crypto.createHash('sha256').update(otherRequirement).digest('hex'),'Confirmed replacement requirement for mismatch evidence',fixture.broker]);
  const before=(await database.one('SELECT COUNT(*)::int AS count FROM inventory_matching_runs WHERE opportunity_id=$1',[fixture.targetOpportunity])).count;
  const result=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs`,{method:'POST',body:{opportunityId:fixture.targetOpportunity}});
  assert.equal(result.status,409);
  assert.match(result.payload.error,/different Requirement Version/);
  const afterCount=(await database.one('SELECT COUNT(*)::int AS count FROM inventory_matching_runs WHERE opportunity_id=$1',[fixture.targetOpportunity])).count;
  assert.equal(afterCount,before,'Lineage failure must not leave a partial matching run');

  const beforeOpportunity=await database.one('SELECT version,requirement_id FROM opportunities WHERE id=$1',[fixture.targetOpportunity]);
  const aligned=await request(`/api/crm/opportunities/${fixture.targetOpportunity}/requirement-alignment`,{method:'POST',body:{
    expectedVersion:Number(beforeOpportunity.version),reason:'Customer confirmed the newer requirement version',acknowledgeStaleMatching:true
  }});
  assert.equal(aligned.status,200,JSON.stringify(aligned.payload));
  assert.equal(aligned.payload.requirementId,otherRequirement);
  const alignmentAudit=await database.one("SELECT details FROM audit_log WHERE entity_type='Opportunity' AND entity_id=$1 AND action='requirement_version_aligned' ORDER BY timestamp DESC LIMIT 1",[fixture.targetOpportunity]);
  const alignmentDetails=JSON.parse(alignmentAudit.details);
  assert.equal(alignmentDetails.fromRequirementId,fixture.requirement);
  assert.equal(alignmentDetails.toRequirementId,otherRequirement);

  const rerun=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs`,{method:'POST',body:{opportunityId:fixture.targetOpportunity}});
  assert.equal(rerun.status,201,JSON.stringify(rerun.payload));
  assert.equal(rerun.payload.requirementId,otherRequirement);
  const candidate=rerun.payload.candidates.find(item=>item.listingId===fixture.listing);
  assert.ok(candidate);
  const reassigned=await request(`/api/crm/leads/${fixture.lead}/inventory-matching-runs/${rerun.payload.id}/candidates/${candidate.id}/decisions`,{method:'POST',body:{
    decision:'shortlisted',reasonCode:'strong_fit',reasonNotes:'Reviewed after exact Requirement realignment',expectedPreviousDecisionId:null,
    assignToOpportunity:true,requestId:id()
  }});
  assert.equal(reassigned.status,201,JSON.stringify(reassigned.payload));
  const lineages=await database.many('SELECT requirement_id,shortlist_status FROM property_matches WHERE opportunity_id=$1 AND listing_id=$2 ORDER BY created_at',[fixture.targetOpportunity,fixture.listing]);
  assert.equal(lineages.length,2,'The prior Property Match must remain as evidence beside the new exact-version match');
  assert.deepEqual(new Set(lineages.map(item=>item.requirementId)),new Set([fixture.requirement,otherRequirement]));
  assert.equal(lineages.find(item=>item.requirementId===fixture.requirement).shortlistStatus,'rejected');
  assert.equal(lineages.find(item=>item.requirementId===otherRequirement).shortlistStatus,'shortlisted');
});
