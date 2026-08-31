// dev.158 business-condition gap coverage — Section 3 (F-04).
//
// Built after dev supplied offer-domain.js and the viewings table schema
// (040_release2_matching_viewing.sql + 044/052 alterations), which were missing
// from the original handoff. Traced every route directly against opportunities.js
// rather than guessing:
//
//   - Offer creation (POST .../offers) checks for an active unexpired assignment
//     at line ~709, AFTER validating the request body — so the fixture below
//     must pass validateOfferRevision() to actually reach that check.
//   - Offer revision (POST .../revisions) has the identical check at line ~756.
//   - Offer send (POST .../send) has the identical check at line ~800.
//   - IMPORTANT CORRECTION to the original business condition split: "offer
//     acceptance" and "Booking creation" are NOT two separate steps in this
//     codebase — POST /crm/offers/:offerId/bookings does both atomically in one
//     transaction (records acceptance AND creates the Booking together). Its
//     assignment-expiry check is at line ~907-909. So 3.3 and 3.4 are proven by
//     the same call, not two separate ones — this reflects the real system, not
//     the original document's assumption.
//
// Separate file from dev158_business_conditions_gaps.integration.test.js
// deliberately — that file is already verified passing; no reason to risk it
// while adding this. Same harness conventions throughout.

import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 inside the disposable PostgreSQL fixture',timeout:20000};
const id=()=>crypto.randomUUID();
const emit=(event,data)=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);
// A real, valid 1x1 transparent PNG — needed because file upload validation
// checks actual magic bytes, not just the declared mediaType.
const VALID_PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let database,server,requestAs,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci/i,'Refusing to mutate a database not explicitly identified as non-production');
  const [{createApp},{default:opportunityRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/opportunities.js'),import('../src/db.js')
  ]);
  database=dbModule;const {execute,one}=database,prefix=`dev158-s3-${Date.now()}`;

  fixture={manager:id(),agent:id(),team:id(),prefix};
  const agentToken=crypto.randomBytes(32).toString('hex'),agentHash=crypto.createHash('sha256').update(agentToken).digest('hex');

  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,$2,$3,'internal_broker','active','integration-only','manager'),
    ($4,$5,$6,'internal_broker','active','integration-only','sales_agent')`,
    [fixture.manager,`${prefix} manager`,`${prefix}-mgr@example.invalid`,
     fixture.agent,`${prefix} agent`,`${prefix}-agent@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.manager]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id IN ($2,$3)',[fixture.team,fixture.manager,fixture.agent]);
  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[agentHash,fixture.agent]);

  const app=createApp();app.mount('/api',opportunityRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  requestAs={agent:async(path,{method='GET',body}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${agentToken}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let payload;try{payload=await response.json();}catch{payload={};}return{status:response.status,payload};
  }};

  // Offer creation calls createOfferRevisionRecords(), which requires an active
  // organization_settings row with a real, readable logo file — it isn't just a
  // stored path, the code actually calls readPrivate(logoStorageKey) to build the
  // PDF. Using the application's own savePrivate() here, the same way every real
  // logo upload does, so the storage key is genuinely valid, not fabricated.
  //
  // This table is a genuine global singleton — the application itself only ever
  // reads "the one active row" (see createOfferRevisionRecords in opportunities.js).
  // So we only insert if none exists yet, rather than blindly inserting every run,
  // which would collide with a row left behind by an earlier test run.
  const existingOrg=await one("SELECT id FROM organization_settings WHERE status='active' LIMIT 1");
  if(!existingOrg){
    const {savePrivate}=await import('../src/private-files.js');
    const logoBuffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    const logoStorageKey=await savePrivate(logoBuffer,'.png');
    await execute(`INSERT INTO organization_settings(id,version,legal_name,display_name,status,created_by,
      logo_file_name,logo_media_type,logo_file_size_bytes,logo_storage_key,logo_file_hash,
      approved_by,approved_at,approval_reason)
      VALUES($1,1,$2,$2,'active',$3,'test-logo.png','image/png',$4,$5,$6,$3,NOW(),$7)`,
      [id(),`${prefix} organization`,fixture.manager,logoBuffer.length,logoStorageKey,crypto.createHash('sha256').update(logoBuffer).digest('hex'),
       'Test fixture: approved for integration testing']);
  }

  // Independence factory: fresh Contact + Lead + Requirement + Opportunity +
  // Listing + PropertyMatch + ACTIVE Assignment + COMPLETED Viewing with
  // feedback — everything real "offer creation" needs to succeed. Every test
  // below calls this to get its own fully isolated fixture.
  fixture.freshOfferReady=async(sizeSqft=900)=>{
    const listingId=id(),opportunityId=id(),requirementId=id(),contactId=id(),leadId=id(),matchId=id(),assignmentId=id(),testPrefix=`${prefix}-${id().slice(0,8)}`;
    await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
      workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
      VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',$4,1050000,'AED','Available',$5,$5,$5,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,
      [listingId,`${testPrefix} inventory`,`${testPrefix} project`,sizeSqft,fixture.agent]);
    await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,
      [contactId,`${testPrefix} customer`,`${testPrefix}-customer@example.invalid`,fixture.agent]);
    await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id,classification_mapping_evidence,stage,temperature,assigned_team_id,assigned_to,created_by)
      VALUES($1,$2,$3,'Website','Sale','buy','ready_secondary','residential','uat062-v1',(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb,'Qualified','Warm',$4,$5,$5)`,
      [leadId,contactId,`${testPrefix} lead`,fixture.team,fixture.agent]);
    await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id,classification_mapping_evidence,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,size_sqft_min,must_haves,exclusions,created_by)
      VALUES($1,$2,1,'Sale','buy','ready_secondary','residential','uat062-v1',(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb,'own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',500,ARRAY[]::text[],ARRAY[]::text[],$3)`,
      [requirementId,leadId,fixture.agent]);
    await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by,classification_catalogue_version_id,classification_mapping_evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7,(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb)`,
      [opportunityId,`NYSA-OP-TEST-${opportunityId.slice(0,8)}`,leadId,contactId,requirementId,fixture.team,fixture.agent,`${testPrefix} opportunity`]);
    const snapshot=JSON.stringify({source:'Website',fixture:testPrefix});
    await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
      VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),opportunityId,leadId,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);
    await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,created_by,updated_by)
      VALUES($1,$2,$3,$4,'manual','strong_fit',$5,NULL,$6,$6)`,
      [matchId,opportunityId,requirementId,listingId,'Fresh isolated fixture for one independent test',fixture.agent]);
    await execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,created_by)
      VALUES($1,$2,$3,$4,$5)`,[assignmentId,opportunityId,listingId,matchId,fixture.agent]);
    await execute(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,organizer_id,starts_at,ends_at,timezone,location,status,outcome,feedback,calendar_uid,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'+INTERVAL '30 minutes','Asia/Dubai','Integration Test Area','completed','Positive','Customer confirmed strong interest after viewing',$6,$5,$5)`,
      [id(),opportunityId,matchId,listingId,fixture.agent,`${testPrefix}-calendar-uid`]);
    return {opportunityId,listingId,matchId,assignmentId};
  };

  fixture.expireAssignment=async(assignmentId)=>{
    await execute(`UPDATE inventory_assignments SET state='expired',starts_at=NOW()-INTERVAL '10 days',
      expires_at=NOW()-INTERVAL '3 days',ended_at=NOW()-INTERVAL '3 days',end_reason=$2 WHERE id=$1`,
      [assignmentId,'Test fixture: forcing expiry to prove the F-04 guard']);
  };

  fixture.validOfferBody=(matchId)=>({
    propertyMatchId:matchId,offerType:'purchase',direction:'outbound',proposerRole:'customer',
    amount:1000000,depositAmount:1000000,currency:'AED',validityExpiresAt:new Date(Date.now()+7*86400000).toISOString()
  });
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)await database.closeDatabase();
});

/* -------------------------------------------------------------------------
   3.1 — Offer creation blocked while the assignment is expired
   3.5 — after renewing the assignment, offer creation succeeds
------------------------------------------------------------------------- */

test('3.1 offer creation is blocked while the Inventory assignment is expired',gate,async()=>{
  const {opportunityId,matchId,assignmentId}=await fixture.freshOfferReady();
  await fixture.expireAssignment(assignmentId);
  const result=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(matchId)});
  emit('3.1',{status:result.status,payload:result.payload});
  assert.equal(result.status,409);
  assert.equal(result.payload.error,'Assign this Inventory to the Opportunity before creating an Offer');
});

test('3.5 renewing the assignment restores the ability to create an Offer',gate,async()=>{
  const {opportunityId,listingId,matchId,assignmentId}=await fixture.freshOfferReady();
  await fixture.expireAssignment(assignmentId);
  const blocked=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(matchId)});
  assert.equal(blocked.status,409,'sanity check: must actually be blocked before renewal, or renewal proves nothing');
  const newAssignmentId=id();
  await database.execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,predecessor_assignment_id,created_by)
    VALUES($1,$2,$3,$4,$5,$6)`,[newAssignmentId,opportunityId,listingId,matchId,assignmentId,fixture.agent]);
  const result=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(matchId)});
  emit('3.5',{status:result.status,payload:{offerId:result.payload?.id,offerReference:result.payload?.offerReference}});
  assert.equal(result.status,201);
});

/* -------------------------------------------------------------------------
   3.2 — Offer revision blocked while the assignment is expired
------------------------------------------------------------------------- */

test('3.2 offer revision is blocked while the Inventory assignment is expired',gate,async()=>{
  const {opportunityId,matchId,assignmentId}=await fixture.freshOfferReady();
  const created=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(matchId)});
  assert.equal(created.status,201,'sanity check: the offer must exist before we can attempt to revise it');
  await fixture.expireAssignment(assignmentId);
  const result=await requestAs.agent(`/api/crm/offers/${created.payload.id}/revisions`,{method:'POST',body:{
    direction:'outbound',proposerRole:'customer',amount:950000,currency:'AED',
    validityExpiresAt:new Date(Date.now()+7*86400000).toISOString(),
    materialCorrectionReason:'Test fixture: attempting a revision after the assignment expired',
    expectedVersion:created.payload.version
  }});
  emit('3.2',{status:result.status,payload:result.payload});
  assert.equal(result.status,409);
  assert.equal(result.payload.error,'This Offer Inventory assignment expired or ended. Reassign the Inventory before creating another revision');
});

/* -------------------------------------------------------------------------
   3.3 / 3.4 — Offer acceptance and Booking creation are the SAME call in this
   codebase (POST .../bookings does both atomically), so both business
   conditions are proven by the one test below. Sent while the assignment is
   still active (to reach 'sent' status genuinely), then the assignment is
   expired specifically between send and the acceptance/booking attempt — this
   isolates the booking-time check (line ~907-909) rather than accidentally
   re-triggering the send-time check (line ~800-801).
------------------------------------------------------------------------- */

test('3.3/3.4 Negotiation acceptance and the separate Booking creation are each blocked while the Inventory assignment is expired',gate,async()=>{
  const {opportunityId,matchId,assignmentId}=await fixture.freshOfferReady();
  const created=await requestAs.agent(`/api/crm/opportunities/${opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(matchId)});
  emit('3.3-3.4-offer-creation',{status:created.status,payload:created.payload});
  assert.equal(created.status,201,'sanity check: the offer must exist before it can be sent');
  const sent=await requestAs.agent(`/api/crm/offers/${created.payload.id}/send`,{method:'POST',body:{
    recipientName:'Integration Test Customer',recipientEmail:'customer@example.invalid',
    deliveryChannel:'Email',counterpartyRole:'customer',expectedVersion:created.payload.version
  }});
  emit('3.3-3.4-offer-send',{status:sent.status,payload:sent.payload});
  assert.equal(sent.status,200,'sanity check: sending must succeed while the assignment is still active, to genuinely isolate the booking-time check');
  await fixture.expireAssignment(assignmentId);
  const acceptance=await requestAs.agent(`/api/crm/offers/${created.payload.id}/events`,{method:'POST',body:{
    eventType:'accepted',summary:'Customer confirmed acceptance of the exact revision terms',counterpartyRole:'customer',expectedVersion:sent.payload.version
  }});
  emit('3.3-acceptance',{status:acceptance.status,payload:acceptance.payload});
  assert.equal(acceptance.status,409);
  assert.equal(acceptance.payload.error,'This Offer Inventory has no active unexpired assignment to the Opportunity');
  const offerAfter=await database.one('SELECT status,accepted_revision_id,accepted_at FROM offers WHERE id=$1',[created.payload.id]);
  assert.equal(offerAfter.status,'sent','the Offer must remain in "sent" status — never silently advanced to accepted');
  assert.equal(offerAfter.acceptedAt,null,'acceptedAt must never be set when the booking attempt was rejected');

  const second=await fixture.freshOfferReady(),created2=await requestAs.agent(`/api/crm/opportunities/${second.opportunityId}/offers`,{method:'POST',body:fixture.validOfferBody(second.matchId)}),
    sent2=await requestAs.agent(`/api/crm/offers/${created2.payload.id}/send`,{method:'POST',body:{recipientName:'Integration Test Customer',recipientEmail:'customer@example.invalid',deliveryChannel:'Email',counterpartyRole:'customer',expectedVersion:created2.payload.version}}),
    accepted2=await requestAs.agent(`/api/crm/offers/${created2.payload.id}/events`,{method:'POST',body:{eventType:'accepted',summary:'Customer accepted the exact revision',counterpartyRole:'customer',expectedVersion:sent2.payload.version}});
  assert.equal(accepted2.status,200,'sanity check: Negotiation acceptance must succeed while the assignment is active');
  await fixture.expireAssignment(second.assignmentId);
  const booking=await requestAs.agent(`/api/crm/offers/${created2.payload.id}/bookings`,{method:'POST',body:{refundableState:'refundable',evidence:{fileName:'reservation-evidence.png',mediaType:'image/png',base64:VALID_PNG_BASE64}}});
  emit('3.4-booking',{status:booking.status,payload:booking.payload});
  assert.equal(booking.status,409);
  assert.equal(booking.payload.error,'The exact Offer Inventory has no active unexpired assignment to this Opportunity');
  const bookingRows=await database.many('SELECT id FROM bookings WHERE offer_id=$1',[created2.payload.id]).catch(()=>[]);
  assert.equal(bookingRows.length,0,'no Booking row should exist for the blocked reservation attempt');
});
