// Protected end-to-end evidence for the two dev.158 journey blockers.
//
// This is deliberately not a source-text parity test. It starts the real HTTP
// router, writes a complete disposable PostgreSQL fixture, calls Negotiation,
// Booking and Deal endpoints, and independently reads the committed rows back.

import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 inside the disposable PostgreSQL fixture',timeout:30000};
const id=()=>crypto.randomUUID();
const emit=(event,data)=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);
const VALID_PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let database,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci/i,'Refusing to mutate a database not explicitly identified as non-production');
  const [{createApp},{default:opportunityRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/opportunities.js'),import('../src/db.js')
  ]);
  database=dbModule;
  const {execute,one}=database,prefix=`dev159-uat067-068-${Date.now()}`;
  fixture={manager:id(),agent:id(),team:id(),prefix};
  const token=crypto.randomBytes(32).toString('hex'),tokenHash=crypto.createHash('sha256').update(token).digest('hex');

  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,$2,$3,'internal_broker','active','integration-only','manager'),
    ($4,$5,$6,'internal_broker','active','integration-only','sales_agent')`,
    [fixture.manager,`${prefix} manager`,`${prefix}-manager@example.invalid`,fixture.agent,`${prefix} agent`,`${prefix}-agent@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.manager]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id IN ($2,$3)',[fixture.team,fixture.manager,fixture.agent]);
  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[tokenHash,fixture.agent]);

  const existingOrg=await one("SELECT id FROM organization_settings WHERE status='active' LIMIT 1");
  if(!existingOrg){
    const {savePrivate}=await import('../src/private-files.js'),logo=Buffer.from(VALID_PNG_BASE64,'base64'),storageKey=await savePrivate(logo,'.png');
    await execute(`INSERT INTO organization_settings(id,version,legal_name,display_name,status,created_by,
      logo_file_name,logo_media_type,logo_file_size_bytes,logo_storage_key,logo_file_hash,approved_by,approved_at,approval_reason)
      VALUES($1,1,$2,$2,'active',$3,'test-logo.png','image/png',$4,$5,$6,$3,NOW(),$7)`,
      [id(),`${prefix} organization`,fixture.manager,logo.length,storageKey,crypto.createHash('sha256').update(logo).digest('hex'),'Disposable integration-test approval']);
  }

  const listingId=id(),opportunityId=id(),requirementId=id(),contactId=id(),leadId=id(),matchId=id(),assignmentId=id();
  Object.assign(fixture,{listingId,opportunityId,requirementId,contactId,leadId,matchId,assignmentId});
  await execute(`INSERT INTO listings(id,inventory_headline,project,area,community,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
    workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types,payment_plan_type,handover_status)
    VALUES($1,$2,$3,'Integration Test Area','Integration Test Community','Apartment','2',900,1050000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'],'Cash','ready')`,
    [listingId,`${prefix} inventory`,`${prefix} project`,fixture.agent]);
  await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)`,
    [contactId,`${prefix} customer`,`${prefix}-customer@example.invalid`,fixture.agent]);
  await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id,classification_mapping_evidence,stage,temperature,assigned_team_id,assigned_to,created_by)
    VALUES($1,$2,$3,'Website','Sale','buy','ready_secondary','residential','uat062-v1',(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb,'Qualified','Warm',$4,$5,$5)`,
    [leadId,contactId,`${prefix} lead`,fixture.team,fixture.agent]);
  await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id,classification_mapping_evidence,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,size_sqft_min,must_haves,exclusions,created_by)
    VALUES($1,$2,1,'Sale','buy','ready_secondary','residential','uat062-v1',(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb,'own_use',ARRAY['Apartment'],ARRAY['Integration Test Area'],500000,1500000,'cash','0_3_months',500,ARRAY[]::text[],ARRAY[]::text[],$3)`,
    [requirementId,leadId,fixture.agent]);
  await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by,classification_catalogue_version_id,classification_mapping_evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Matching','Review Inventory',NOW()+INTERVAL '1 day','send_property_details',$7,(SELECT id FROM classification_catalogue_versions WHERE version_code='uat062-v1'),'{"catalogueVersion":"uat062-v1","objective":"buy","derivedTransaction":"sale"}'::jsonb)`,
    [opportunityId,`NYSA-OP-TEST-${opportunityId.slice(0,8)}`,leadId,contactId,requirementId,fixture.team,fixture.agent,`${prefix} opportunity`]);
  const snapshot=JSON.stringify({source:'Website',fixture:prefix});
  await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
    VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),opportunityId,leadId,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);
  await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,created_by,updated_by)
    VALUES($1,$2,$3,$4,'manual','strong_fit',$5,$6,$6)`,[matchId,opportunityId,requirementId,listingId,'Dedicated UAT-067/068 runtime evidence',fixture.agent]);
  await execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,created_by)
    VALUES($1,$2,$3,$4,$5)`,[assignmentId,opportunityId,listingId,matchId,fixture.agent]);
  await execute(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,organizer_id,starts_at,ends_at,timezone,location,status,outcome,feedback,calendar_uid,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'+INTERVAL '30 minutes','Asia/Dubai','Integration Test Area','completed','Positive','Customer confirmed interest after viewing',$6,$5,$5)`,
    [id(),opportunityId,matchId,listingId,fixture.agent,`${prefix}-viewing`]);

  const app=createApp();app.mount('/api',opportunityRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let payload;try{payload=await response.json();}catch{payload={};}
    return{status:response.status,payload};
  };
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)await database.closeDatabase();
});

test('UAT-067/068 real HTTP and PostgreSQL journey commits acceptance, separate reservation and exact Deal lineage',gate,async()=>{
  const offer=await request(`/api/crm/opportunities/${fixture.opportunityId}/offers`,{method:'POST',body:{
    propertyMatchId:fixture.matchId,offerType:'purchase',direction:'outbound',proposerRole:'customer',amount:1000000,
    depositAmount:100000,currency:'AED',validityExpiresAt:new Date(Date.now()+7*86400000).toISOString()
  }});
  assert.equal(offer.status,201,'Offer creation must succeed through the real route');
  const sent=await request(`/api/crm/offers/${offer.payload.id}/send`,{method:'POST',body:{
    recipientName:'Integration Test Customer',recipientEmail:'customer@example.invalid',deliveryChannel:'Email',counterpartyRole:'customer',expectedVersion:offer.payload.version
  }});
  assert.equal(sent.status,200,'The exact revision must be sent before Negotiation acceptance');

  const prematureBooking=await request(`/api/crm/offers/${offer.payload.id}/bookings`,{method:'POST',body:{
    refundableState:'refundable',evidence:{fileName:'reservation-evidence.png',mediaType:'image/png',base64:VALID_PNG_BASE64}
  }});
  assert.equal(prematureBooking.status,409,'Booking must remain a separate action that requires prior Negotiation acceptance');
  assert.equal(prematureBooking.payload.error,'Record Customer/counterparty acceptance in Negotiation before creating a reservation');
  assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM bookings WHERE offer_id=$1',[offer.payload.id])).count,0);

  const accepted=await request(`/api/crm/offers/${offer.payload.id}/events`,{method:'POST',body:{
    eventType:'accepted',summary:'Customer accepted the exact current revision',counterpartyRole:'customer',direction:'inbound',expectedVersion:sent.payload.version
  }});
  assert.equal(accepted.status,200,'UAT-067 Negotiation acceptance must succeed through the real route');
  const acceptedState=await database.one(`SELECT o.status,o.current_revision_id,o.accepted_revision_id,o.accepted_at,o.version,
    n.event_type,n.offer_revision_id,n.document_version_id,n.counterparty_role,n.direction,
    p.stage AS opportunity_stage,p.next_action_code
    FROM offers o JOIN negotiation_events n ON n.offer_id=o.id AND n.event_type='accepted'
    JOIN opportunities p ON p.id=o.opportunity_id WHERE o.id=$1`,[offer.payload.id]);
  assert.equal(acceptedState.status,'accepted');
  assert.equal(acceptedState.acceptedRevisionId,acceptedState.currentRevisionId);
  assert.ok(acceptedState.acceptedAt);
  assert.equal(acceptedState.eventType,'accepted');
  assert.equal(acceptedState.offerRevisionId,acceptedState.acceptedRevisionId);
  assert.ok(acceptedState.documentVersionId);
  assert.equal(acceptedState.opportunityStage,'Negotiation');
  assert.equal(acceptedState.nextActionCode,'create_reservation');
  emit('UAT-067',{httpStatus:accepted.status,offerId:offer.payload.id,acceptedRevisionId:acceptedState.acceptedRevisionId,
    negotiationEvent:'accepted',opportunityStage:acceptedState.opportunityStage,nextActionCode:acceptedState.nextActionCode,prematureBookingStatus:prematureBooking.status});

  const booking=await request(`/api/crm/offers/${offer.payload.id}/bookings`,{method:'POST',body:{
    refundableState:'refundable',evidence:{fileName:'reservation-evidence.png',mediaType:'image/png',base64:VALID_PNG_BASE64}
  }});
  assert.equal(booking.status,201,'The separate reservation must succeed only after Negotiation acceptance');
  const bookingState=await database.one(`SELECT id,opportunity_id,listing_id,offer_id,accepted_offer_revision_id,status,
    evidence_document_version_id,reservation_starts_at,expires_at FROM bookings WHERE id=$1`,[booking.payload.id]);
  assert.equal(bookingState.status,'reserved');
  assert.equal(bookingState.opportunityId,fixture.opportunityId);
  assert.equal(bookingState.listingId,fixture.listingId);
  assert.equal(bookingState.offerId,offer.payload.id);
  assert.equal(bookingState.acceptedOfferRevisionId,acceptedState.acceptedRevisionId);
  assert.ok(bookingState.evidenceDocumentVersionId);

  const dealResult=await request(`/api/crm/bookings/${booking.payload.id}/deal`,{method:'POST',body:{targetCompletionAt:new Date(Date.now()+30*86400000).toISOString()}});
  assert.equal(dealResult.status,201,`UAT-068 Deal creation must return 201, not 500: ${JSON.stringify(dealResult.payload)}`);
  const deal=await database.one(`SELECT d.*,l.assignment_id,l.listing_id AS linkage_listing_id,l.offer_id AS linkage_offer_id,
    l.accepted_offer_revision_id AS linkage_revision_id,l.booking_id AS linkage_booking_id,l.change_kind,
    o.stage AS opportunity_stage FROM deals d JOIN deal_inventory_linkages l ON l.id=d.current_inventory_linkage_id
    JOIN opportunities o ON o.id=d.opportunity_id WHERE d.id=$1`,[dealResult.payload.id]);
  assert.equal(deal.opportunityId,fixture.opportunityId);
  assert.equal(deal.dealType,'sale');
  assert.equal(deal.status,'draft');
  assert.equal(deal.listingId,fixture.listingId);
  assert.equal(deal.offerId,offer.payload.id);
  assert.equal(deal.acceptedOfferRevisionId,acceptedState.acceptedRevisionId);
  assert.equal(deal.bookingId,booking.payload.id);
  assert.equal(deal.linkageListingId,fixture.listingId);
  assert.equal(deal.linkageOfferId,offer.payload.id);
  assert.equal(deal.linkageRevisionId,acceptedState.acceptedRevisionId);
  assert.equal(deal.linkageBookingId,booking.payload.id);
  assert.equal(deal.assignmentId,fixture.assignmentId);
  assert.equal(deal.changeKind,'attached');
  assert.equal(deal.opportunityStage,'Deal');
  assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM deals WHERE opportunity_id=$1',[fixture.opportunityId])).count,1);
  assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM deal_checklists WHERE deal_id=$1',[deal.id])).count,1);
  assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM deal_parties WHERE deal_id=$1 AND contact_id=$2 AND party_role=\'buyer\'',[deal.id,fixture.contactId])).count,1);
  const audit=await database.one("SELECT details FROM audit_log WHERE entity_type='Deal' AND entity_id=$1 AND action='created' ORDER BY timestamp DESC LIMIT 1",[deal.id]);
  const auditDetails=typeof audit.details==='string'?JSON.parse(audit.details):audit.details;
  assert.equal(auditDetails.bookingId,booking.payload.id);
  assert.equal(auditDetails.acceptedOfferRevisionId,acceptedState.acceptedRevisionId);

  const duplicate=await request(`/api/crm/bookings/${booking.payload.id}/deal`,{method:'POST',body:{targetCompletionAt:new Date(Date.now()+30*86400000).toISOString()}});
  assert.equal(duplicate.status,409,'Retry must not create a duplicate Deal');
  assert.equal((await database.one('SELECT COUNT(*)::int AS count FROM deals WHERE opportunity_id=$1',[fixture.opportunityId])).count,1);
  emit('UAT-068',{httpStatus:dealResult.status,dealId:deal.id,bookingId:deal.bookingId,listingId:deal.listingId,
    offerId:deal.offerId,acceptedRevisionId:deal.acceptedOfferRevisionId,linkageId:deal.currentInventoryLinkageId,
    checklistCount:1,buyerPartyCount:1,duplicateStatus:duplicate.status});
});
