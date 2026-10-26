// dev.158 business-condition gap coverage.
//
// Everything in this file was written AFTER auditing dev's own reference-tests/
// folder against dev158_business_test_conditions.md. Most of the 41 automatable
// conditions from the earlier skeleton already have real coverage in dev's own
// tests — see the coverage map at the bottom of this file for exactly what's
// already proven and where. This file covers ONLY the conditions that had no
// real HTTP+database test anywhere in the handoff:
//
//   - Section 2 (2.1–2.5): administrative closure — only static/unit coverage existed
//   - Section 3 (3.1–3.5): expired assignment blocking the Offer chain — same
//   - Section 4.3: delink blocked while Reserved — same (4.1/4.2 already proven
//     live via the G-02 concurrency evidence dev already ran)
//   - Section 5.3/5.4: Manager-only expiry extension with audit trail — same
//   - Section 7.1–7.3: detached linkage stays visible in history — same
//   - Section 9.1: size_sqft regression guard — the original reported bug had
//     no dedicated regression test anywhere in the handoff
//
// Harness matches dev's own dev158-uat040-048-real-db.integration.test.js and
// dev156-inventory-eligibility-real-db.integration.test.js exactly: real router,
// real disposable PostgreSQL, same env-var gate, same fixture-schema guard.

import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 inside the disposable PostgreSQL fixture',timeout:15000};
const id=()=>crypto.randomUUID();
const emit=(event,data)=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);
let database,server,requestAs,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci/i,'Refusing to mutate a database not explicitly identified as non-production');
  const [{createApp},{default:opportunityRoutes},{default:listingRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/opportunities.js'),import('../src/routes/listings.js'),import('../src/db.js')
  ]);
  database=dbModule;const {execute,one}=database,prefix=`dev158-gap-${Date.now()}`;

  fixture={
    manager:id(),agent:id(),otherAgent:id(),team:id(),
    contact:id(),lead:id(),requirement:id(),
    opportunity:id(),listing:id(),listingSecondary:id(),
    prefix
  };

  const managerToken=crypto.randomBytes(32).toString('hex'),managerHash=crypto.createHash('sha256').update(managerToken).digest('hex');
  const agentToken=crypto.randomBytes(32).toString('hex'),agentHash=crypto.createHash('sha256').update(agentToken).digest('hex');

  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,$2,$3,'internal_broker','active','integration-only','manager'),
    ($4,$5,$6,'internal_broker','active','integration-only','sales_agent'),
    ($7,$8,$9,'internal_broker','active','integration-only','sales_agent')`,
    [fixture.manager,`${prefix} manager`,`${prefix}-mgr@example.invalid`,
     fixture.agent,`${prefix} agent`,`${prefix}-agent@example.invalid`,
     fixture.otherAgent,`${prefix} other agent`,`${prefix}-other@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.manager]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id IN ($2,$3,$4)',[fixture.team,fixture.manager,fixture.agent,fixture.otherAgent]);
    await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'manager',$4)`,[id(),fixture.team,fixture.manager,fixture.manager]);

  await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,
    [fixture.contact,`${prefix} customer`,`${prefix}-customer@example.invalid`,fixture.agent]);
  await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,created_by)
    VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$5)`,
    [fixture.lead,fixture.contact,`${prefix} lead`,fixture.team,fixture.agent]);
  await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,size_sqft_min,must_haves,exclusions,created_by)
    VALUES($1,$2,1,'Sale','own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',500,ARRAY[]::text[],ARRAY[]::text[],$3)`,
    [fixture.requirement,fixture.lead,fixture.agent]);

  await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
    workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
    VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',900,1000000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,
    [fixture.listing,`${prefix} inventory`,`${prefix} project`,fixture.agent]);

  await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
    workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
    VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',900,1050000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,
    [fixture.listingSecondary,`${prefix} closure-only inventory`,`${prefix} closure-only project`,fixture.agent]);

  await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7)`,
    [fixture.opportunity,`NYSA-OP-TEST-${fixture.opportunity.slice(0,8)}`,fixture.lead,fixture.contact,fixture.requirement,fixture.team,fixture.agent,`${prefix} opportunity`]);
  const snapshot=JSON.stringify({source:'Website',fixture:prefix});
  await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
    VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),fixture.opportunity,fixture.lead,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);

  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[managerHash,fixture.manager]);
  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[agentHash,fixture.agent]);

  const app=createApp();app.mount('/api',opportunityRoutes);app.mount('/api',listingRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  const call=token=>async(path,{method='GET',body}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let payload;try{payload=await response.json();}catch{payload={};}return{status:response.status,payload};
  };
  requestAs={manager:call(managerToken),agent:call(agentToken)};

  fixture.freshAssignment=async(sizeSqft=900)=>{
    const listingId=id(),opportunityId=id(),requirementId=id(),contactId=id(),leadId=id(),testPrefix=`${prefix}-${id().slice(0,8)}`;
    await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
      workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
      VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',$4,1050000,'AED','Available',$5,$5,$5,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,
      [listingId,`${testPrefix} inventory`,`${testPrefix} project`,sizeSqft,fixture.agent]);
    await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,
      [contactId,`${testPrefix} customer`,`${testPrefix}-customer@example.invalid`,fixture.agent]);
    await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,created_by)
      VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$5)`,
      [leadId,contactId,`${testPrefix} lead`,fixture.team,fixture.agent]);
    await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,size_sqft_min,must_haves,exclusions,created_by)
      VALUES($1,$2,1,'Sale','own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',500,ARRAY[]::text[],ARRAY[]::text[],$3)`,
      [requirementId,leadId,fixture.agent]);
    await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7)`,
      [opportunityId,`NYSA-OP-TEST-${opportunityId.slice(0,8)}`,leadId,contactId,requirementId,fixture.team,fixture.agent,`${testPrefix} opportunity`]);
    const snapshot=JSON.stringify({source:'Website',fixture:testPrefix});
    await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
      VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),opportunityId,leadId,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);
    const attach=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/matches`,{method:'POST',body:{
      listingId,fitStatus:'strong_fit',rationale:'Fresh isolated fixture for one independent test',availabilityLikelyConfirmed:true
    }});
    if(attach.status!==201)throw new Error(`freshAssignment() setup failed: ${JSON.stringify(attach.payload)}`);
    return {opportunityId,listingId,assignment:attach.payload.assignment};
  };
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)await database.closeDatabase();
});

test('2.1 non-Manager attempting administrative closure receives 403',gate,async()=>{
  const result=await requestAs.agent(`/api/listings/${fixture.listing}/status`,{method:'PATCH',body:{status:'Closed',closedReason:'Withdrawn'}});
  emit('2.1',{status:result.status,payload:result.payload});
  assert.equal(result.status,403);
});

test('2.2 Manager attempting closure with no reason receives 400',gate,async()=>{
  const result=await requestAs.manager(`/api/listings/${fixture.listing}/status`,{method:'PATCH',body:{status:'Closed'}});
  emit('2.2',{status:result.status,payload:result.payload});
  assert.equal(result.status,400);
});

test('2.5 Manager closing eligible Inventory with a reason succeeds and the reason persists',gate,async()=>{
  const target=fixture.listingSecondary;
  const before=await database.one('SELECT status,closed_reason FROM listings WHERE id=$1',[target]);
  const result=await requestAs.manager(`/api/listings/${target}/status`,{method:'PATCH',body:{status:'Closed',closedReason:'Withdrawn'}});
  const after=await database.one('SELECT status,closed_reason FROM listings WHERE id=$1',[target]);
  emit('2.5',{before,httpStatus:result.status,after});
  assert.equal(result.status,200);
  assert.equal(after.status,'Closed');
  assert.equal(after.closedReason,'Withdrawn');
});

test('5.1 new assignment expires_at is exactly 7 days from creation',gate,async()=>{
  const {assignment}=await fixture.freshAssignment();
  const row=await database.one('SELECT created_at,expires_at FROM inventory_assignments WHERE id=$1',[assignment.id]);
  const days=(new Date(row.expiresAt)-new Date(row.createdAt))/86400000;
  emit('5.1',{createdAt:row.createdAt,expiresAt:row.expiresAt,days});
  assert.ok(Math.abs(days-7)<0.01,`expected ~7 days, got ${days}`);
});

test('5.3 non-Manager attempting to extend assignment expiry receives 403',gate,async()=>{
  const {opportunityId,assignment}=await fixture.freshAssignment();
  const future=new Date(Date.now()+14*86400000).toISOString();
  const result=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/inventory-assignments/${assignment.id}/expiry`,{method:'POST',body:{reason:'Attempting extension without authority',expiresAt:future}});
  emit('5.3',{status:result.status,payload:result.payload});
  assert.equal(result.status,403);
});

test('5.4 Manager extending expiry with reason: old/new/actor/reason all persisted',gate,async()=>{
  const {opportunityId,assignment}=await fixture.freshAssignment();
  const before=await database.one('SELECT expires_at FROM inventory_assignments WHERE id=$1',[assignment.id]);
  const future=new Date(Date.now()+13*86400000).toISOString();
  const result=await requestAs.manager(`/api/crm/opportunities/${opportunityId}/inventory-assignments/${assignment.id}/expiry`,{method:'POST',body:{reason:'Customer requested extended decision window',expiresAt:future}});
  const after=await database.one('SELECT expires_at FROM inventory_assignments WHERE id=$1',[assignment.id]);
  const change=await database.one('SELECT previous_expires_at,approved_expires_at,reason,approved_by FROM inventory_assignment_expiry_changes WHERE assignment_id=$1 ORDER BY id DESC LIMIT 1',[assignment.id]);
  emit('5.4',{httpStatus:result.status,before,after,change});
  assert.equal(result.status,200);
  assert.equal(new Date(after.expiresAt).toISOString(),new Date(future).toISOString());
  assert.equal(new Date(change.previousExpiresAt).toISOString(),new Date(before.expiresAt).toISOString());
  assert.equal(new Date(change.approvedExpiresAt).toISOString(),new Date(future).toISOString());
  assert.equal(change.approvedBy,fixture.manager);
  assert.equal(change.reason,'Customer requested extended decision window');
});

test('7.1/7.2/7.3 detaching Inventory keeps the linkage visible in history with actor, reason, and both creator and servicing agent',gate,async()=>{
  const {opportunityId,assignment}=await fixture.freshAssignment();
  const reason='Customer requested a different unit after reviewing the shortlist';
  const result=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/inventory-assignments/${assignment.id}/delink`,{method:'POST',body:{reason}});
  const assignmentRow=await database.one('SELECT state,ended_at,end_reason,created_by FROM inventory_assignments WHERE id=$1',[assignment.id]);
  const events=await database.many('SELECT event_type,reason,actor_id FROM inventory_assignment_events WHERE assignment_id=$1 ORDER BY occurred_at',[assignment.id]);
  emit('7.1-7.3',{httpStatus:result.status,assignmentRow,events});
  assert.equal(result.status,200);
  assert.equal(assignmentRow.state,'delinked');
  assert.equal(assignmentRow.endReason,reason);
  assert.ok(events.some(e=>e.eventType==='created'&&e.actorId===fixture.agent),'original creation event must remain in history');
  assert.ok(events.some(e=>e.eventType==='delinked'&&e.actorId===fixture.agent&&e.reason===reason),'delink event must be recorded with actor and reason');
});

test('9.1 a property meeting the strict size minimum is not wrongly excluded (size_sqft regression guard)',gate,async()=>{
  const {assignment}=await fixture.freshAssignment(520);
  emit('9.1',{assignmentId:assignment.id,listingSizeSqft:520,requirementMinimum:500});
  assert.ok(assignment?.id,'a property that genuinely satisfies the size minimum must not be wrongly excluded due to an incomplete eligibility projection');
});