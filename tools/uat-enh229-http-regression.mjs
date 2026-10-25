import crypto from 'node:crypto';

import {fileURLToPath} from 'node:url';
import {createFixturePool,assertDedicatedFixture} from './local-postgres-fixture/fixture-guard.mjs';
const guardedPool=createFixturePool();try{await assertDedicatedFixture(guardedPool);}finally{await guardedPool.end();}
const ROOT=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
if(!ROOT)throw new Error('NYSA_APP_ROOT is required');
const [{createApp},{default:crmRoutes},{default:opportunityRoutes},database,{default:leadRoutes}]=await Promise.all([
  import(`file://${ROOT}/src/lib/http-kit.js`),
  import(`file://${ROOT}/src/routes/crm.js`),
  import(`file://${ROOT}/src/routes/opportunities.js`),
  import(`file://${ROOT}/src/db.js`),import(`file://${ROOT}/src/routes/lead-operations.js`)
]);
const {db,execute,one,many,closeDatabase}=database;
const id=()=>crypto.randomUUID();
const token=crypto.randomBytes(32).toString('hex');
const sessionHash=crypto.createHash('sha256').update(token).digest('hex');
const agentToken=crypto.randomBytes(32).toString('hex');
const agentSessionHash=crypto.createHash('sha256').update(agentToken).digest('hex');
const prefix=`enh229-http-${Date.now()}`;
const fixture={admin:id(),oldAgent:id(),newAgent:id(),team:id(),listing:id(),contactA:id(),contactB:id(),contactM:id(),leadA:id(),leadB:id(),leadM:id(),opportunityA:id(),opportunityB:id(),opportunityM:id(),matchA:id(),matchB:id(),assignmentA:id(),assignmentB:id(),offerA:id(),offerB:id(),offerM:id(),revisionA:id(),revisionB:id()};
let server;

const emit=(event,data={})=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const request=async(path,body,authToken=token,method='POST')=>{
  const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{
    method,headers:{authorization:`Bearer ${authToken}`,'content-type':'application/json'},body:JSON.stringify(body)
  });
  let payload;try{payload=await response.json();}catch{payload={error:'non-JSON response'};}
  return {status:response.status,payload};
};

async function seedDocument(documentId,versionId,label){
  await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by)
    VALUES($1,$2,'offer_letter',$3,'Outbound','private','sent',$4,$4)`,[documentId,`DOC-${label}-${documentId.slice(0,8)}`,`${prefix} ${label}`,fixture.admin]);
  await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
    VALUES($1,$2,1,$3,'application/pdf',18,$4,$5,1,'generated','private','sent',$6,$6)`,
    [versionId,documentId,`${label}.pdf`,`dev154-fixture/${label}.pdf`,crypto.createHash('sha256').update(label).digest('hex'),fixture.admin]);
}

try{
  const migration=await one("SELECT version FROM schema_migrations WHERE version='099_dev153_inventory_assignment_lifecycle.sql'");
  assert(migration?.version,'Isolated schema is not migrated through 099');
  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role)
    VALUES($1,$2,$3,'internal_broker','active','integration-only','manager'),
          ($4,$5,$6,'internal_broker','active','integration-only','sales_agent'),
          ($7,$8,$9,'internal_broker','active','integration-only','sales_agent')`,[
    fixture.admin,`${prefix} manager`,`${prefix}-manager@example.invalid`,fixture.oldAgent,`${prefix} original agent`,`${prefix}-old@example.invalid`,fixture.newAgent,`${prefix} new agent`,`${prefix}-new@example.invalid`
  ]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.admin]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[fixture.team,[fixture.admin,fixture.oldAgent,fixture.newAgent]]);
  await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by)
    VALUES($1,$2,$3,'manager',$3),($4,$2,$5,'member',$3),($6,$2,$7,'member',$3)`,[id(),fixture.team,fixture.admin,id(),fixture.oldAgent,id(),fixture.newAgent]);
  await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES
    ($1,$2,$3,'buyer',$4,$4),($5,$6,$7,'buyer',$4,$4),($8,$9,$10,'buyer',$4,$4)`,[
    fixture.contactA,`${prefix} customer A`,`${prefix}-a@example.invalid`,fixture.oldAgent,fixture.contactB,`${prefix} customer B`,`${prefix}-b@example.invalid`,
    fixture.contactM,`${prefix} reassignment customer`,`${prefix}-m@example.invalid`
  ]);
  await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,created_by) VALUES
    ($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$5),($6,$7,$8,'Website','Sale','Qualified','Warm',$4,$5,$5),
    ($9,$10,$11,'Website','Sale','Qualified','Warm',$4,$5,$5)`,[
    fixture.leadA,fixture.contactA,`${prefix} lead A`,fixture.team,fixture.oldAgent,fixture.leadB,fixture.contactB,`${prefix} lead B`,
    fixture.leadM,fixture.contactM,`${prefix} reassignment lead`
  ]);
  await execute(`INSERT INTO listings(id,inventory_headline,project,area,property_type,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,
    workflow_status,verification_status,verification_expires_at,availability_confirmed_at,transaction_types)
    VALUES($1,$2,$3,'Synthetic Test Area','Apartment',1000000,'AED','Available',$4,$4,$4,'approved','verified',NOW()+INTERVAL '30 days',NOW(),ARRAY['Sale'])`,
    [fixture.listing,`${prefix} inventory`,`${prefix} project`,fixture.admin]);
  await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,listing_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by) VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Offer','Continue Offer',NOW()+INTERVAL '1 day','follow_up_offer_feedback',$7),
    ($9,$10,$11,$12,$5,$6,$7,$13,'Sale','Offer','Continue Offer',NOW()+INTERVAL '1 day','follow_up_offer_feedback',$7),
    ($14,$15,$16,$17,$5,$6,$7,$18,'Sale','Offer','Continue accepted Offer servicing',NOW()+INTERVAL '1 day','follow_up_offer_feedback',$7)`,[
    fixture.opportunityA,`NYSA-OP-TEST-${fixture.opportunityA.slice(0,8)}`,fixture.leadA,fixture.contactA,fixture.listing,fixture.team,fixture.oldAgent,`${prefix} opportunity A`,
    fixture.opportunityB,`NYSA-OP-TEST-${fixture.opportunityB.slice(0,8)}`,fixture.leadB,fixture.contactB,`${prefix} opportunity B`,
    fixture.opportunityM,`NYSA-OP-TEST-${fixture.opportunityM.slice(0,8)}`,fixture.leadM,fixture.contactM,`${prefix} reassignment opportunity`
  ]);
  for(const [opportunityId,leadId,label] of [[fixture.opportunityA,fixture.leadA,'A'],[fixture.opportunityB,fixture.leadB,'B'],[fixture.opportunityM,fixture.leadM,'M']]){
    const snapshot=JSON.stringify({source:'Website',fixture:`${prefix}-${label}`});
    await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
      VALUES($1,$2,$3,'Website',$4::jsonb,$5)`,[id(),opportunityId,leadId,snapshot,crypto.createHash('sha256').update(snapshot).digest('hex')]);
  }
  await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,shortlist_status,shortlisted_at,created_by,updated_by) VALUES
    ($1,$2,NULL,$3,'manual','strong_fit','Synthetic exact match','shortlisted',NOW(),$4,$4),
    ($5,$6,NULL,$3,'manual','strong_fit','Synthetic exact match','shortlisted',NOW(),$4,$4)`,[
    fixture.matchA,fixture.opportunityA,fixture.listing,fixture.admin,fixture.matchB,fixture.opportunityB
  ]);
  await execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,starts_at,expires_at,created_by) VALUES
    ($1,$2,$3,$4,NOW(),NOW()+INTERVAL '7 days',$5),($6,$7,$3,$8,NOW(),NOW()+INTERVAL '7 days',$5)`,[
    fixture.assignmentA,fixture.opportunityA,fixture.listing,fixture.matchA,fixture.admin,fixture.assignmentB,fixture.opportunityB,fixture.matchB
  ]);
  const docA=id(),docB=id(),docVersionA=id(),docVersionB=id();
  await seedDocument(docA,docVersionA,'offer-a');await seedDocument(docB,docVersionB,'offer-b');
  await execute(`INSERT INTO offers(id,offer_reference,opportunity_id,listing_id,offer_type,status,currency,owner_id,current_revision_id,sent_at,created_by) VALUES
    ($1,$2,$3,$4,'purchase','sent','AED',$5,NULL,NOW(),$5),($6,$7,$8,$4,'purchase','sent','AED',$5,NULL,NOW(),$5)`,[
    fixture.offerA,`NYSA-OF-TEST-${fixture.offerA.slice(0,8)}`,fixture.opportunityA,fixture.listing,fixture.oldAgent,
    fixture.offerB,`NYSA-OF-TEST-${fixture.offerB.slice(0,8)}`,fixture.opportunityB
  ]);
  await execute(`INSERT INTO offer_revisions(id,offer_id,revision_number,direction,proposer_role,amount,currency,deposit_amount,validity_expires_at,document_version_id,created_by) VALUES
    ($1,$2,1,'outbound','agent',1000000,'AED',10000,NOW()+INTERVAL '1 day',$3,$4),
    ($5,$6,1,'outbound','agent',1000000,'AED',10000,NOW()+INTERVAL '1 day',$7,$4)`,[
    fixture.revisionA,fixture.offerA,docVersionA,fixture.oldAgent,fixture.revisionB,fixture.offerB,docVersionB
  ]);
  await execute('UPDATE offers SET current_revision_id=$1::uuid WHERE id=$2',[fixture.revisionA,fixture.offerA]);
  await execute('UPDATE offers SET current_revision_id=$1::uuid WHERE id=$2',[fixture.revisionB,fixture.offerB]);
  for(const [offerId,revisionId,documentVersionId,contactId] of [[fixture.offerA,fixture.revisionA,docVersionA,fixture.contactA],[fixture.offerB,fixture.revisionB,docVersionB,fixture.contactB]]){
    for(const side of ['buyer','seller'])await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,actor_id,accepting_side,acceptance_evidence,accepting_party_id)
      VALUES($1,$2,$3,$4,'accepted','inbound',$5,'Synthetic exact revision acceptance',$6,$7,'Synthetic written acceptance',$8)`,[id(),offerId,revisionId,documentVersionId,side==='buyer'?'customer':'seller',fixture.oldAgent,side,contactId]);
  }
  await execute("UPDATE offers SET status='accepted',accepted_revision_id=$1::uuid,accepted_at=NOW(),version=version+1 WHERE id=$2",[fixture.revisionA,fixture.offerA]);
  await execute("UPDATE offers SET status='accepted',accepted_revision_id=$1::uuid,accepted_at=NOW(),version=version+1 WHERE id=$2",[fixture.revisionB,fixture.offerB]);
  await execute(`INSERT INTO offers(id,offer_reference,opportunity_id,listing_id,offer_type,status,currency,owner_id,accepted_at,created_by)
    VALUES($1,$2,$3,$4,'purchase','accepted','AED',$5,NOW(),$5)`,[
    fixture.offerM,`NYSA-OF-TEST-${fixture.offerM.slice(0,8)}`,fixture.opportunityM,fixture.listing,fixture.oldAgent
  ]);
  await execute(`INSERT INTO sessions(token,broker_id,expires_at) VALUES
    ($1,$2,NOW()+INTERVAL '1 hour'),($3,$4,NOW()+INTERVAL '1 hour')`,[sessionHash,fixture.admin,agentSessionHash,fixture.oldAgent]);

  const app=createApp();app.mount('/api',crmRoutes);app.mount('/api',opportunityRoutes);app.mount('/api',leadRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});

  const {loadActiveClassificationCatalogue}=await import(`file://${ROOT}/src/classification-catalogue.js`),catalogue=await loadActiveClassificationCatalogue();
  const market=catalogue.dimensions.find(x=>x.code==='market_stage').values.find(x=>x.active&&x.code!=='not_confirmed').code,
    segment=catalogue.dimensions.find(x=>x.code==='property_segment').values.find(x=>x.active&&x.code!=='not_confirmed').code;
  const requirement=await request(`/api/crm/leads/${fixture.leadA}/requirements`,{customerObjective:'buy',marketStageRequirement:market,propertySegmentRequirement:segment,classificationVersion:catalogue.version.code,purpose:'own_use',fundingMethod:'cash',timelineCode:'0_3_months',propertyTypes:['Apartment'],bedroomsMin:1.5,bedroomsMax:2.5},agentToken);
  assert(requirement.status===201,`Fractional requirement HTTP ${requirement.status}: ${requirement.payload.error||''}`);
  const requirementReload=await one('SELECT bedrooms_min,bedrooms_max FROM lead_requirements WHERE id=$1',[requirement.payload.id]);
  assert(Number(requirementReload.bedroomsMin)===1.5&&Number(requirementReload.bedroomsMax)===2.5,'Requirement must persist exact fractions');
  const invalidRequirement=await request(`/api/crm/leads/${fixture.leadA}/requirements`,{purpose:'own_use',fundingMethod:'cash',timelineCode:'0_3_months',bedroomsMin:2.5,bedroomsMax:1.5},agentToken);
  assert(invalidRequirement.status===400,'Reversed fractional requirement range must remain invalid');
  emit('FRACTIONAL_REQUIREMENT_HTTP_PASS',{create:201,reloadExact:true,reversedRange:400});

  const viewingId=id();
  await execute(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,inventory_assignment_id,organizer_id,starts_at,ends_at,timezone,location,instructions,calendar_uid,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,NOW(),NOW()+INTERVAL '1 hour','Asia/Dubai','Synthetic location','Synthetic lobby',$7,$6,$6)`,[viewingId,fixture.opportunityA,fixture.matchA,fixture.listing,fixture.assignmentA,fixture.oldAgent,viewingId+'@example.invalid']);
  const viewingBody={status:'completed',outcome:'positive',feedback:'More viewing requested',customerNextDecision:'more_viewings_required',followUpAction:'Arrange another viewing',followUpDueAt:new Date(Date.now()+86400000).toISOString(),expectedVersion:1,attendance:[]};
  const missingDecision=await request(`/api/crm/opportunities/${fixture.opportunityA}/viewings/${viewingId}`,{...viewingBody,customerNextDecision:null},agentToken,'PATCH');
  assert(missingDecision.status===400,'New completion must require Customer next decision');
  const feedback=await request(`/api/crm/opportunities/${fixture.opportunityA}/viewings/${viewingId}`,viewingBody,agentToken,'PATCH');
  assert(feedback.status===200,`Viewing decision HTTP ${feedback.status}: ${feedback.payload.error||''}`);
  assert(feedback.payload.customerNextDecision==='more_viewings_required','Customer decision must persist separately from positive reaction');
  const storedViewing=await one('SELECT status,customer_next_decision FROM viewings WHERE id=$1',[viewingId]);
  assert(storedViewing.status==='completed'&&storedViewing.customerNextDecision==='more_viewings_required','Reload must retain appointment completion and next decision');
  await execute('UPDATE opportunities SET classification_catalogue_version_id=$1,requirement_id=$2 WHERE id=$3',[catalogue.version.id,requirement.payload.id,fixture.opportunityA]);
  const blockedOffer=await request(`/api/crm/opportunities/${fixture.opportunityA}/offers`,{propertyMatchId:fixture.matchA,offerType:'purchase',amount:1000000,currency:'AED',validityExpiresAt:new Date(Date.now()+86400000).toISOString()},agentToken);
  assert(blockedOffer.status===409&&blockedOffer.payload.error.includes('Ready for Offer'),`More-viewing decision must block new Offer: ${blockedOffer.status} ${blockedOffer.payload.error||''}`);
  emit('VIEWING_DECISION_HTTP_PASS',{missingDecision:400,completion:200,positiveDoesNotImplyReady:true,newOfferBlocked:409});

  let saleChecklist=await one("SELECT id FROM checklist_templates WHERE deal_type='sale' AND status='approved'");
  if(!saleChecklist){saleChecklist={id:id()};await execute(`INSERT INTO checklist_templates(id,template_code,version_no,name,deal_type,status,approved_by,approved_at)
    VALUES($1,$2,1,$3,'sale','approved',$4,NOW())`,[saleChecklist.id,`${prefix}_sale`,`${prefix} Sale completion`,fixture.admin]);}
  const evidence={fileName:'synthetic-reservation-proof.pdf',mediaType:'application/pdf',base64:Buffer.from('%PDF-1.4\n% synthetic integration evidence\n').toString('base64')};
  const body={refundableState:'refundable'};
  const [resultA,resultB]=await Promise.all([
    request(`/api/crm/offers/${fixture.offerA}/bookings`,body,agentToken),request(`/api/crm/offers/${fixture.offerB}/bookings`,body,agentToken)
  ]);
  const statuses=[resultA.status,resultB.status].sort((a,b)=>a-b);
  const offerState=await many('SELECT id,status,accepted_revision_id FROM offers WHERE id=ANY($1::uuid[]) ORDER BY id',[[fixture.offerA,fixture.offerB]]);
  const bookings=await many("SELECT id,offer_id,status,evidence_document_version_id,created_by,reservation_starts_at,expires_at FROM bookings WHERE listing_id=$1 ORDER BY created_at,id",[fixture.listing]);
  const accepted=offerState.filter(row=>row.status==='accepted');
  const reserved=bookings.filter(row=>row.status==='reserved');
  assert(statuses[0]===201&&statuses[1]===409,`Expected HTTP 201/409, got ${statuses.join('/')}`);
  assert(accepted.length===2,'Both Negotiation acceptances must remain immutable; Booking decides reservation exclusivity separately');
  assert(reserved.length===1&&bookings.length===1,'Exactly one reserved Booking must exist');
  assert(reserved[0].evidenceDocumentVersionId===null,'No evidence file should be required or invented');
  assert(reserved[0].createdBy===fixture.oldAgent,'The actual confirming Agent must be recorded');
  assert(new Date(reserved[0].expiresAt)-new Date(reserved[0].reservationStartsAt)===7*86400000,'Reservation must be exactly seven days');
  assert(accepted.some(row=>row.id===reserved[0].offerId),'Reserved Booking must belong to an accepted Offer');
  const winner=[resultA,resultB].find(row=>row.status===201),dealResult=await request(`/api/crm/bookings/${winner.payload.id}/deal`,{targetCompletionAt:new Date(Date.now()+14*86400000).toISOString()},agentToken);
  assert(dealResult.status===201,`Governed Deal creation HTTP status ${dealResult.status}: ${dealResult.payload?.error||'unknown error'}`);
  const deal=await one('SELECT booking_id,listing_id,offer_id,accepted_offer_revision_id,current_inventory_linkage_id FROM deals WHERE id=$1',[dealResult.payload.id]);
  assert(deal.bookingId===winner.payload.id&&deal.listingId===fixture.listing&&deal.offerId===reserved[0].offerId&&deal.acceptedOfferRevisionId&&deal.currentInventoryLinkageId,'Deal lineage was not populated atomically');
  emit('G02_REAL_CONCURRENCY_PASS',{
    httpStatuses:[resultA.status,resultB.status],successCount:[resultA,resultB].filter(row=>row.status===201).length,
    conflictCount:[resultA,resultB].filter(row=>row.status===409).length,acceptedOfferCount:accepted.length,
    reservedBookingCount:reserved.length,totalBookingRows:bookings.length,separateNegotiationAcceptancePreserved:true,governedDealCreated:true,atomicDealLineage:true
  });
  emit('ALL_LIVE_DB_TESTS_PASS',{tests:3,productionDataRead:false,fixtureSchemaOnly:true});
}catch(error){
  emit('LIVE_DB_TEST_FAILURE',{name:error?.name||'Error',message:error?.message||String(error)});
  process.exitCode=1;
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await closeDatabase().catch(()=>{});
}
