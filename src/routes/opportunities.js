import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isManager,canReadLead,canCreateOpportunity,canReadOpportunity,canWriteOpportunity,canApproveDeal,opportunityScopeSql,leadScopeSql,agentWorkLeadScopeSql,contactScopeSql,companyScopeSql } from '../crm-policy.js';
import { buildOpportunityAttribution,validateOpportunityCreate,validateOpportunityNextAction,validateOpportunityTransition,OPPORTUNITY_STAGES } from '../opportunity-domain.js';
import { validatePropertyMatch,validateMatchDecision,validateViewingCreate,validateViewingOutcome,buildViewingIcs } from '../matching-viewing-domain.js';
import { syncGoogleViewing } from '../calendar-sync.js';
import { OFFER_COUNTERPARTY_ROLES,validateOfferRevision,validateOfferEvent,offerStatusAfterRevision } from '../offer-domain.js';
import { makeOfferPdf } from '../offer-pdf.js';
import { savePrivate,removePrivate,readPrivate,decodeAndValidateFile } from '../private-files.js';
import { validateBookingCreate,validateBookingTransition,validateBookingExtension } from '../booking-domain.js';
import { REQUIRED_PARTIES,validateDealCreate,validateDealParty,validateDealApproval,validateDealCloseWon,validateDealCloseLost,dealClosureGates } from '../deal-domain.js';
import { sortCustomerPriorityCases } from '../customer-intelligence-domain.js';
import { requireDocumentComplianceGates } from '../document-compliance-gate.js';
import { inventoryEvaluatorProjection,loadOpportunityInventoryEvaluation } from '../inventory-eligibility-service.js';
import { evaluateInventoryEligibilityV2 } from '../inventory-eligibility-domain.js';
import { legacyBusinessType,loadActiveClassificationCatalogue,mapClassificationValue } from '../classification-catalogue.js';

const r=Router();
const publicTokenHash=token=>crypto.createHash('sha256').update(String(token||'')).digest('hex');
const publicEsc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

r.get('/public/property-shares/:token',async(req,res)=>{
  const share=await one(`SELECT s.*,o.opportunity_reference,creator.name AS agent_name,creator.phone AS agent_phone,creator.email AS agent_email
    FROM opportunity_property_shares s JOIN opportunities o ON o.id=s.opportunity_id
    JOIN brokers creator ON creator.id=s.created_by
    WHERE s.public_token_hash=$1 AND s.public_expires_at>NOW()`,[publicTokenHash(req.params.token)]);
  if(!share)return res.status(404).send('This property share is unavailable or has expired.');
  const items=await many('SELECT * FROM opportunity_property_share_items WHERE share_id=$1 ORDER BY id',[share.id]);
  const cards=items.map(item=>{const p=item.propertySnapshot||{},media=Array.isArray(p.media)?p.media:[],photos=media.filter(x=>x.kind==='image'),documents=media.filter(x=>x.kind!=='image');
    return `<details class="property" open><summary><span><b>${publicEsc(p.project)}</b><small>${publicEsc(p.area)} · ${publicEsc(p.propertyType)} · ${publicEsc(p.bedrooms||'Bedrooms not recorded')}</small></span><strong>${publicEsc(p.currency)} ${Number(p.price||0).toLocaleString('en-US')}</strong></summary><div class="body">${photos.length?`<div class="photos">${photos.map(x=>`<a href="/api/public/property-shares/${encodeURIComponent(req.params.token)}/media/${x.id}" target="_blank"><img src="/api/public/property-shares/${encodeURIComponent(req.params.token)}/media/${x.id}" alt="${publicEsc(x.title)}"></a>`).join('')}</div>`:''}<dl><div><dt>Property type</dt><dd>${publicEsc(p.propertyType)}</dd></div><div><dt>Bedrooms</dt><dd>${publicEsc(p.bedrooms||'Not recorded')}</dd></div><div><dt>Size</dt><dd>${p.sizeSqft?`${Number(p.sizeSqft).toLocaleString('en-US')} sq ft`:'Not recorded'}</dd></div><div><dt>Payment plan</dt><dd>${publicEsc(p.paymentPlan||'Not recorded')}</dd></div></dl>${documents.length?`<div class="documents">${documents.map(x=>`<a href="/api/public/property-shares/${encodeURIComponent(req.params.token)}/media/${x.id}" target="_blank">${x.kind==='floor_plan'?'View floor plan / layout':'Open brochure'} · ${publicEsc(x.title)}</a>`).join('')}</div>`:''}<label>Response<select data-share-item="${item.id}"><option value="">Select response</option><option value="accepted">Interested / accepted</option><option value="rejected">Not suitable</option><option value="alternatives_requested">Send alternatives</option></select></label></div></details>`;}).join('');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>NYSA property selection</title><style>body{font:16px system-ui;margin:auto;max-width:900px;padding:20px;color:#27271f;background:#f5f4ef}header,.property{background:#fff;border:1px solid #ddd9cc;border-radius:12px;margin:12px 0;padding:16px}summary{display:flex;justify-content:space-between;gap:16px;cursor:pointer}summary span{display:grid}small{color:#727267;margin-top:4px}.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:16px 0}.photos img{width:100%;height:140px;object-fit:cover;border-radius:8px}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}dl div{background:#f5f4ef;padding:10px}dt{font-size:12px;text-transform:uppercase;color:#727267}dd{margin:4px 0}.documents{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.documents a{border:1px solid #b28b42;padding:8px;border-radius:7px;color:#76581d}footer{margin-top:20px;border-top:1px solid #ccc;padding-top:14px}.disclaimer{font-size:13px;color:#666}</style></head><body><header><h1>Selected property options</h1><p>${publicEsc(share.customerMessage)}</p></header>${cards}<footer><b>Your NYSA representative: ${publicEsc(share.agentName)}</b><p>${publicEsc(share.agentPhone||'')} · ${publicEsc(share.agentEmail||'')}</p><p class="disclaimer">${publicEsc(items[0]?.propertySnapshot?.disclaimer||'Property information, pricing and availability are subject to verification and may change without notice.')}</p></footer></body></html>`);
});

r.get('/public/property-shares/:token/media/:mediaId',async(req,res)=>{
  const media=await one(`SELECT m.* FROM opportunity_property_shares s
    JOIN opportunity_property_share_items i ON i.share_id=s.id
    JOIN property_media m ON m.id=$2 AND m.listing_id=i.listing_id
    WHERE s.public_token_hash=$1 AND s.public_expires_at>NOW() AND m.approval_status='approved'
      AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW())
      AND (i.property_snapshot->'media') @> jsonb_build_array(jsonb_build_object('id',m.id::text)) LIMIT 1`,
    [publicTokenHash(req.params.token),req.params.mediaId]);
  if(!media)return res.status(404).send('Approved shared media is unavailable.');
  const data=await readPrivate(media.storageKey);res.setHeader('Content-Type',media.mediaType);
  res.setHeader('Content-Disposition',`${media.mediaKind==='image'?'inline':'attachment'}; filename="${media.fileName.replace(/"/g,'')}"`);
  res.setHeader('Cache-Control','private, no-store');res.end(data);
});

r.use(requireAuth,(req,res,next)=>{
  if(!hasInternalCrmIdentity(req.broker))return res.status(403).json({error:'Opportunity data is restricted to NYSA staff'});
  next();
});

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const OPPORTUNITY_STAGE_WORKSPACES=['inventory','viewing','offer','negotiation','booking','deal'];
function validateOpportunityStageDraft(stageCode,body){
  if(!OPPORTUNITY_STAGE_WORKSPACES.includes(stageCode))return 'Invalid Opportunity workspace stage';
  if(!body?.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return 'Draft payload must be an object';
  const serialized=JSON.stringify(body.payload);
  if(serialized.length>65536)return 'Draft payload exceeds the 64 KB limit';
  const expectedVersion=Number(body.expectedOpportunityVersion);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return 'The current Opportunity version is required';
  return null;
}
async function releaseOfferOwnedReservation(offer,reason,actorId,client){
  const booking=await one(`SELECT b.* FROM bookings b WHERE b.offer_id=$1 AND b.opportunity_id=$2
    AND b.status='reserved' FOR UPDATE`,[offer.id,offer.opportunityId],client);
  if(!booking)return null;
  const released=await one(`UPDATE bookings SET status='cancelled',cancelled_at=NOW(),release_reason=$1,
    version=version+1,updated_at=NOW() WHERE id=$2 AND status='reserved' RETURNING *`,[reason,booking.id],client);
  if(!released)return null;
  await execute(`INSERT INTO booking_status_history(id,booking_id,from_status,to_status,reason,actor_id)
    VALUES($1,$2,'reserved','cancelled',$3,$4)`,[uuid(),booking.id,reason,actorId],client);
  const assignment=booking.listingId?await one(`UPDATE inventory_assignments SET state='delinked',ended_at=NOW(),end_reason=$1
    WHERE opportunity_id=$2 AND listing_id=$3 AND state='active' RETURNING *`,[reason,offer.opportunityId,booking.listingId],client):null;
  if(assignment)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
    VALUES($1,$2,'reservation_released',$3,$4,$5::jsonb)`,[uuid(),assignment.id,reason,actorId,JSON.stringify({bookingId:booking.id,offerId:offer.id})],client);
  const safeStatus=booking.listingId?(await one('SELECT nysa_inventory_effective_status($1) AS status',[booking.listingId],client)).status:booking.inventoryStatusBefore;
  if(!safeStatus||['Reserved','Closed','Sold','Rented'].includes(safeStatus))return {blocked:true,booking};
  if(booking.externalPropertyId)await execute(`UPDATE provisional_external_properties SET status=$1,updated_at=NOW()
    WHERE id=$2 AND status='reserved' AND EXISTS(SELECT 1 FROM bookings own WHERE own.id=$3 AND own.offer_id=$4 AND own.opportunity_id=$5)`,
    [safeStatus,booking.externalPropertyId,booking.id,offer.id,offer.opportunityId],client);
  await audit('BookingStatus',booking.id,'cancelled_from_terminal_offer',actorId,{offerId:offer.id,
    opportunityId:offer.opportunityId,reason,inventoryStatusFrom:'Reserved',inventoryStatusTo:safeStatus},client);
  return {released:true,bookingId:booking.id,restoredStatus:safeStatus};
}
// One governed boundary is used both to populate the broker's selection list and
// to revalidate the selected row under lock. A prior match/Lead selection is
// evidence, never proof that Inventory is live now.
function liveInventoryEligibility(alias,opportunityPlaceholder){
  return [`${alias}.deleted_at IS NULL`,`${alias}.workflow_status='approved'`,
    `${alias}.verification_status IN ('verified','not_required')`,
    `nysa_inventory_effective_status(${alias}.id) NOT IN ('Sold','Rented','Closed')`,
    `(${alias}.verification_expires_at IS NULL OR ${alias}.verification_expires_at>NOW())`,
    `NOT EXISTS(SELECT 1 FROM deals d WHERE d.listing_id=${alias}.id AND d.status='closed_won')`];
}
async function requireLiveInventory(listingId,opportunityId,client){
  const listing=await one(`SELECT ${inventoryEvaluatorProjection('l')} FROM listings l WHERE l.id=$1
    AND ${liveInventoryEligibility('l','$2').join('\n    AND ')} FOR UPDATE OF l`,[listingId],client);
  if(!listing||!opportunityId)return listing;
  const {evaluation}=await loadOpportunityInventoryEvaluation({listing,opportunityId,client});
  return evaluation?.eligible?listing:null;
}
// Opportunity creation records a governed starting selection, but it is not a
// customer-facing availability commitment. Approval, verification, terminal
// status and reservation protections are rechecked at every downstream boundary;
// the broker's explicit availability-likelihood acknowledgement is immutable
// assignment evidence, while a historic availability date remains advisory.
async function requireOpportunityInventory(listingId,requirement,transactionType,client){
  const listing=await one(`SELECT ${inventoryEvaluatorProjection('l')} FROM listings l WHERE l.id=$1 AND l.deleted_at IS NULL
    AND l.workflow_status='approved' AND l.verification_status IN ('verified','not_required')
    AND nysa_inventory_effective_status(l.id) NOT IN ('Sold','Rented','Closed')
    AND (l.verification_expires_at IS NULL OR l.verification_expires_at>NOW())
    AND NOT EXISTS(SELECT 1 FROM deals d WHERE d.listing_id=l.id AND d.status='closed_won')
    FOR UPDATE OF l`,[listingId],client);
  if(!listing)return null;
  const evaluation=evaluateInventoryEligibilityV2({listing,requirement,opportunityTransactionType:transactionType,assessments:[]});
  return evaluation.eligible?listing:null;
}

async function latestOpportunityOffer(opportunityId,client){
  return one(`SELECT id,created_by,status FROM offers WHERE opportunity_id=$1
    ORDER BY created_at DESC,id DESC LIMIT 1`,[opportunityId],client);
}

const responsibleManager=(broker,opportunity)=>broker?.jobRole==='manager'&&
  (broker.managedTeamIds||[]).includes(opportunity?.assignedTeamId);
async function canMaintainAssignments(broker,opportunity,client){
  const offer=await latestOpportunityOffer(opportunity.id,client);
  return {offer,allowed:responsibleManager(broker,opportunity)||opportunity.ownerId===broker.id};
}
async function finishExpiredAssignments(opportunityId,listingId,client){
  const expired=await many(`UPDATE inventory_assignments SET state='expired',ended_at=expires_at,
    end_reason='Seven-day assignment period elapsed' WHERE opportunity_id=$1 AND listing_id=$2
    AND state='active' AND expires_at<=NOW() RETURNING *`,[opportunityId,listingId],client);
  for(const item of expired)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
    VALUES($1,$2,'expired',$3,NULL,$4::jsonb)`,[uuid(),item.id,'Seven-day assignment period elapsed',JSON.stringify({expiredAt:item.expiresAt})],client);
  return expired;
}
async function inheritInventoryOwner(listingId,transactionType,actorId,client){
  if(!listingId)return null;
  const roles=transactionType==='Rental'||transactionType==='rental'||transactionType==='commercial_rental'
    ?['landlord','lessor']:['seller','developer','landlord','lessor'];
  const inventoryParty=await one(`SELECT p.*,COALESCE(c.full_name,p.display_name) AS display_name,
    COALESCE(c.phone,p.phone) AS phone,COALESCE(c.email,p.email) AS email
    FROM inventory_counterparties p LEFT JOIN contacts c ON c.id=p.contact_id
    WHERE p.listing_id=$1 AND p.party_role=ANY($2::text[])
    ORDER BY CASE p.party_role WHEN 'seller' THEN 1 WHEN 'landlord' THEN 2 WHEN 'lessor' THEN 3 ELSE 4 END,p.created_at DESC LIMIT 1`,
    [listingId,roles],client);
  if(!inventoryParty)return null;
  const role=['landlord','lessor'].includes(inventoryParty.partyRole)?'landlord':'seller';
  const counterparty=await one(`INSERT INTO transaction_counterparties
    (id,display_name,party_type,role,phone,email,represented_party,source,evidence_reference,created_by,inventory_counterparty_id)
    VALUES($1,$2,'inventory_owner',$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT(inventory_counterparty_id) DO UPDATE SET
      display_name=EXCLUDED.display_name,role=EXCLUDED.role,phone=EXCLUDED.phone,email=EXCLUDED.email,
      represented_party=EXCLUDED.represented_party,source=EXCLUDED.source,evidence_reference=EXCLUDED.evidence_reference,updated_at=NOW()
    RETURNING *`,[uuid(),inventoryParty.displayName,role,inventoryParty.phone,inventoryParty.email,inventoryParty.representedParty,
      inventoryParty.source,inventoryParty.authorityEvidence,actorId,inventoryParty.id],client);
  return {inventoryParty,counterparty};
}
const SELECT_OPPORTUNITY=`SELECT o.*,COALESCE(c.full_name,buyer_cp.display_name,'External buyer') AS contact_name,c.email AS contact_email,c.phone AS contact_phone,
  seller_cp.display_name AS seller_counterparty_name,seller_cp.role AS seller_counterparty_role,seller_cp.evidence_reference AS seller_counterparty_evidence,
  c.postal_address AS contact_address,l.title AS lead_title,l.stage AS lead_stage,COALESCE(req.customer_objective,l.customer_objective) AS customer_objective,
  req.version_no AS requirement_version,qa.final_temperature AS qualification_temperature,
  COALESCE(li.project,ep.project_or_building) AS listing_project,COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
  ep.property_address AS external_property_address,owner.name AS owner_name,owner.phone AS owner_phone,t.name AS team_name,
  attr.source AS attribution_source,attr.campaign_code,attr.external_source_id,attr.source_page,attr.source_form,
  attr.originating_listing_id,attr.attribution_basis,attr.provenance_hash,attr.captured_at AS attribution_captured_at
  FROM opportunities o
  LEFT JOIN contacts c ON c.id=o.contact_id
  LEFT JOIN leads l ON l.id=o.lead_id
  LEFT JOIN lead_requirements req ON req.id=o.requirement_id
  LEFT JOIN qualification_assessments qa ON qa.id=o.qualification_assessment_id
  LEFT JOIN listings li ON li.id=o.listing_id
  LEFT JOIN provisional_external_properties ep ON ep.id=o.external_property_id
  LEFT JOIN transaction_counterparties buyer_cp ON buyer_cp.id=o.buyer_counterparty_id
  LEFT JOIN transaction_counterparties seller_cp ON seller_cp.id=o.seller_counterparty_id
  JOIN brokers owner ON owner.id=o.owner_id
  LEFT JOIN teams t ON t.id=o.assigned_team_id
  JOIN opportunity_attribution attr ON attr.opportunity_id=o.id`;

async function opportunityWithParticipants(id,client){
  const opportunity=await one(`${SELECT_OPPORTUNITY} WHERE o.id=$1`,[id],client);
  if(!opportunity)return null;
  const participants=await many(`SELECT op.*,b.name AS broker_name,b.job_role FROM opportunity_participants op
    JOIN brokers b ON b.id=op.broker_id WHERE op.opportunity_id=$1 AND op.active ORDER BY op.added_at`,[id],client);
  opportunity.participants=participants;
  opportunity.participantIds=participants.map(x=>x.brokerId);
  return opportunity;
}

async function scopedOpportunity(req,id,client){
  const opportunity=await opportunityWithParticipants(id,client);
  if(!opportunity)return {error:[404,'Opportunity not found']};
  if(!canReadOpportunity(req.broker,opportunity))return {error:[403,'Opportunity is outside your permitted scope']};
  return {opportunity};
}

r.get('/crm/opportunities',async(req,res)=>{
  const params=[],scope=opportunityScopeSql('o',req.broker,params),where=[scope.clause];
  if(req.query.stage){if(!OPPORTUNITY_STAGES.includes(req.query.stage))return res.status(400).json({error:'Invalid opportunity stage'});params.push(req.query.stage);where.push(`o.stage=$${params.length}`);}
  if(req.query.assignedTo==='me'){params.push(req.broker.id);where.push(`o.owner_id=$${params.length}`);}
  if(req.query.leadId){params.push(req.query.leadId);where.push(`o.lead_id=$${params.length}`);}
  if(clean(req.query.q)){
    const raw=String(clean(req.query.q)),copiedReference=raw.match(/NYSA-OP-[0-9]{6}-[0-9]{6}/i)?.[0];
    params.push(`%${String(copiedReference||raw).replaceAll('*','%')}%`);
    where.push(`(o.title ILIKE $${params.length} OR o.opportunity_reference ILIKE $${params.length} OR c.full_name ILIKE $${params.length} OR o.transaction_type ILIKE $${params.length})`);
  }
  const pageSize=Math.min(100,Math.max(1,Number.parseInt(req.query.pageSize,10)||25));
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1),offset=(page-1)*pageSize;
  const total=Number((await one(`SELECT COUNT(*)::int AS count FROM opportunities o JOIN leads l ON l.id=o.lead_id JOIN contacts c ON c.id=l.contact_id WHERE ${where.join(' AND ')}`,params)).count||0);
  const sorts={due:"CASE WHEN o.stage IN ('Closed Won','Closed Lost') THEN 1 ELSE 0 END,o.next_action_due_at NULLS LAST,o.created_at DESC",newest:'o.created_at DESC',updated:'o.updated_at DESC,o.created_at DESC',customer:'LOWER(COALESCE(c.full_name,buyer_cp.display_name,\'\')),o.created_at DESC'};
  const opportunities=await many(`${SELECT_OPPORTUNITY} WHERE ${where.join(' AND ')} ORDER BY ${sorts[req.query.sort]||sorts.due} LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,pageSize,offset]);
  res.json({count:total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize)),opportunities});
});

r.get('/crm/opportunities/:id',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const [stageHistory,assignmentHistory,matches,inventoryAssignments,viewings]=await Promise.all([
    many(`SELECT h.*,b.name AS changed_by_name FROM opportunity_stage_history h
      JOIN brokers b ON b.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id]),
    many(`SELECT h.*,old_owner.name AS from_owner_name,new_owner.name AS to_owner_name,old_team.name AS from_team_name,
      new_team.name AS to_team_name,actor.name AS changed_by_name FROM opportunity_assignment_history h
      LEFT JOIN brokers old_owner ON old_owner.id=h.from_owner_id JOIN brokers new_owner ON new_owner.id=h.to_owner_id
      LEFT JOIN teams old_team ON old_team.id=h.from_team_id LEFT JOIN teams new_team ON new_team.id=h.to_team_id
      JOIN brokers actor ON actor.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id]),
    many(`SELECT pm.*,COALESCE(li.project,ep.project_or_building) AS project,
      COALESCE(li.area,ep.property_address) AS area,COALESCE(li.property_type,ep.property_type) AS property_type,
      COALESCE(li.price,ep.asking_price) AS price,COALESCE(li.currency,ep.currency) AS currency,
      COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
      CASE WHEN li.id IS NOT NULL THEN CONCAT_WS(', ',NULLIF(li.project,''),NULLIF(li.community,''),NULLIF(li.area,'')) ELSE ep.property_address END AS viewing_address,
      creator.name AS created_by_name FROM property_matches pm LEFT JOIN listings li ON li.id=pm.listing_id
      LEFT JOIN provisional_external_properties ep ON ep.id=pm.external_property_id
      JOIN brokers creator ON creator.id=pm.created_by WHERE pm.opportunity_id=$1 ORDER BY
      CASE pm.shortlist_status WHEN 'shortlisted' THEN 0 WHEN 'considering' THEN 1 ELSE 2 END,pm.created_at`,[opportunity.id]),
    many(`SELECT a.*,pm.shortlist_status,li.inventory_reference,li.project,li.area,li.property_type,li.price,li.currency,
      nysa_inventory_effective_status(li.id) AS inventory_effective_status,creator.name AS created_by_name,
      CASE WHEN a.state='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.listing_id=a.listing_id AND b.opportunity_id=a.opportunity_id AND b.status='reserved' AND b.expires_at>NOW()) THEN 'reserved_winner'
        WHEN a.state='active' AND a.expires_at<=NOW() THEN 'expired'
        WHEN a.state='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.listing_id=a.listing_id AND b.opportunity_id<>a.opportunity_id AND b.status='reserved' AND b.expires_at>NOW()) THEN 'blocked_by_reservation'
        ELSE a.state END AS effective_state,
      reservation.booking_reference,reservation.expires_at AS reservation_expires_at,
      reservation.opportunity_id AS reservation_opportunity_id,
      latest_offer.offer_reference,latest_offer.status AS offer_status,latest_offer.created_by_name AS offer_created_by_name,
      COALESCE((SELECT json_agg(json_build_object('id',e.id,'eventType',e.event_type,'reason',e.reason,
        'actorName',actor.name,'eventData',e.event_data,'occurredAt',e.occurred_at) ORDER BY e.occurred_at DESC,e.id DESC)
        FROM inventory_assignment_events e LEFT JOIN brokers actor ON actor.id=e.actor_id WHERE e.assignment_id=a.id),'[]'::json) AS events
      FROM inventory_assignments a JOIN property_matches pm ON pm.id=a.property_match_id
      JOIN listings li ON li.id=a.listing_id JOIN brokers creator ON creator.id=a.created_by
      LEFT JOIN LATERAL (SELECT b.booking_reference,b.expires_at,b.opportunity_id FROM bookings b
        WHERE b.listing_id=a.listing_id AND b.status='reserved' AND b.expires_at>NOW() ORDER BY b.created_at LIMIT 1) reservation ON TRUE
      LEFT JOIN LATERAL (SELECT f.offer_reference,f.status,offer_creator.name AS created_by_name FROM offers f
        JOIN brokers offer_creator ON offer_creator.id=f.created_by WHERE f.opportunity_id=a.opportunity_id
        AND f.listing_id=a.listing_id ORDER BY f.created_at DESC LIMIT 1) latest_offer ON TRUE
      WHERE a.opportunity_id=$1 ORDER BY CASE WHEN a.state='active' AND a.expires_at>NOW() THEN 0 ELSE 1 END,a.created_at DESC`,[opportunity.id]),
    many(`SELECT v.*,COALESCE(li.project,ep.project_or_building) AS listing_project,
      COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,organizer.name AS organizer_name,
      customer.full_name AS customer_name,customer.email AS customer_email,customer.phone AS customer_phone,
      customer.postal_address AS customer_address,owner.name AS owner_name,owner.phone AS owner_phone,
      cal.event_url AS google_event_url,cal.meeting_url AS google_meeting_url,cal.sync_status AS google_sync_status,cal.last_error AS google_last_error,cal.retry_count AS google_retry_count,
      COALESCE((SELECT json_agg(json_build_object('id',va.id,'contactId',va.contact_id,'brokerId',va.broker_id,
        'guestName',va.guest_name,'attendeeRole',va.attendee_role,'invitationStatus',va.invitation_status,
        'attendanceStatus',va.attendance_status,'displayName',COALESCE((SELECT c.full_name FROM contacts c WHERE c.id=va.contact_id),
        (SELECT b.name FROM brokers b WHERE b.id=va.broker_id),va.guest_name))) FROM viewing_attendees va WHERE va.viewing_id=v.id),'[]'::json) AS attendees
      FROM viewings v LEFT JOIN listings li ON li.id=v.listing_id
      LEFT JOIN provisional_external_properties ep ON ep.id=v.external_property_id
      JOIN brokers organizer ON organizer.id=v.organizer_id
      JOIN opportunities viewing_opportunity ON viewing_opportunity.id=v.opportunity_id
      LEFT JOIN contacts customer ON customer.id=viewing_opportunity.contact_id JOIN brokers owner ON owner.id=viewing_opportunity.owner_id
      LEFT JOIN viewing_calendar_events cal ON cal.viewing_id=v.id AND cal.provider='google_calendar'
      WHERE v.opportunity_id=$1 ORDER BY v.starts_at DESC`,[opportunity.id])
  ]);
  const offers=await many(`SELECT f.*,COALESCE(li.project,ep.project_or_building) AS listing_project,
    COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
    CASE WHEN li.id IS NOT NULL THEN nysa_inventory_effective_status(li.id) ELSE ep.status END AS listing_status,owner.name AS owner_name,
    reservation.booking_reference AS active_booking_reference,reservation.opportunity_id AS active_booking_opportunity_id,
    reservation.opportunity_reference AS active_booking_opportunity_reference,
    reservation.expires_at AS active_booking_expires_at,
    evidence.id AS viewing_feedback_id,evidence.feedback AS viewing_feedback,evidence.updated_at AS viewing_feedback_at
    FROM offers f LEFT JOIN listings li ON li.id=f.listing_id
    LEFT JOIN provisional_external_properties ep ON ep.id=f.external_property_id JOIN brokers owner ON owner.id=f.owner_id
    LEFT JOIN LATERAL (SELECT b.booking_reference,o.id AS opportunity_id,o.opportunity_reference,b.expires_at FROM bookings b
      JOIN opportunities o ON o.id=b.opportunity_id WHERE
      (b.listing_id=f.listing_id OR b.external_property_id=f.external_property_id) AND b.status='reserved'
      ORDER BY b.created_at DESC LIMIT 1) reservation ON TRUE
    LEFT JOIN LATERAL (SELECT v.id,v.feedback,v.updated_at FROM viewings v
      WHERE v.opportunity_id=f.opportunity_id
        AND (v.listing_id=f.listing_id OR v.external_property_id=f.external_property_id) AND v.status='completed'
        AND NULLIF(BTRIM(v.feedback),'') IS NOT NULL AND v.updated_at<=f.created_at
      ORDER BY v.updated_at DESC LIMIT 1) evidence ON TRUE
    WHERE f.opportunity_id=$1 ORDER BY f.created_at DESC`,[opportunity.id]);
  if(offers.length){
    const ids=offers.map(x=>x.id),[revisions,events]=await Promise.all([
      many(`SELECT r.*,v.file_name,v.file_hash FROM offer_revisions r JOIN document_versions v ON v.id=r.document_version_id
        WHERE r.offer_id=ANY($1::uuid[]) ORDER BY r.offer_id,r.revision_number`,[ids]),
      many(`SELECT e.*,actor.name AS actor_name FROM negotiation_events e JOIN brokers actor ON actor.id=e.actor_id
        WHERE e.offer_id=ANY($1::uuid[]) ORDER BY e.offer_id,e.occurred_at DESC,e.id DESC`,[ids])
    ]);
    for(const offer of offers){offer.revisions=revisions.filter(x=>x.offerId===offer.id);offer.events=events.filter(x=>x.offerId===offer.id);}
  }
  const bookings=await many(`SELECT b.*,f.offer_reference,f.offer_type,r.revision_number AS accepted_revision_number,
    COALESCE(li.project,ep.project_or_building) AS listing_project,
    COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
    dv.file_name AS evidence_file_name,dv.file_hash AS evidence_file_hash,owner.name AS owner_name,
    COALESCE((SELECT json_agg(json_build_object('id',h.id,'fromStatus',h.from_status,'toStatus',h.to_status,
      'reason',h.reason,'actorName',actor.name,'changedAt',h.changed_at) ORDER BY h.changed_at DESC,h.id DESC)
      FROM booking_status_history h JOIN brokers actor ON actor.id=h.actor_id WHERE h.booking_id=b.id),'[]'::json) AS history
      ,COALESCE((SELECT json_agg(json_build_object('id',extension.id,'previousExpiresAt',extension.previous_expires_at,
        'approvedExpiresAt',extension.approved_expires_at,'reason',extension.approval_reason,'approvedByName',approver.name,
        'approvedAt',extension.approved_at) ORDER BY extension.approved_at DESC,extension.id DESC)
        FROM booking_reservation_extensions extension JOIN brokers approver ON approver.id=extension.approved_by
        WHERE extension.booking_id=b.id),'[]'::json) AS extensions
    FROM bookings b JOIN offers f ON f.id=b.offer_id JOIN offer_revisions r ON r.id=b.accepted_offer_revision_id
    LEFT JOIN listings li ON li.id=b.listing_id LEFT JOIN provisional_external_properties ep ON ep.id=b.external_property_id
    JOIN document_versions dv ON dv.id=b.evidence_document_version_id JOIN brokers owner ON owner.id=b.owner_id
    WHERE b.opportunity_id=$1 ORDER BY b.created_at DESC`,[opportunity.id]);
  const deals=await many(`SELECT d.*,b.booking_reference,b.status AS booking_status,f.offer_reference,f.offer_type,r.revision_number AS accepted_revision_number,
    link.id AS authoritative_linkage_id,link.change_kind AS linkage_change_kind,link.created_at AS linkage_created_at,
    COALESCE(li.project,ep.project_or_building) AS listing_project,
    COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
    CASE WHEN li.id IS NOT NULL THEN nysa_inventory_effective_status(li.id) ELSE ep.status END AS listing_status,owner.name AS owner_name,
    approver.name AS approved_by_name,closer.name AS closed_by_name,
    dc.id AS checklist_id,dc.template_version_no,dc.status AS checklist_status,ct.name AS checklist_name
    FROM deals d LEFT JOIN deal_inventory_linkages link ON link.id=d.current_inventory_linkage_id
    LEFT JOIN bookings b ON b.id=link.booking_id LEFT JOIN offers f ON f.id=link.offer_id
    LEFT JOIN offer_revisions r ON r.id=link.accepted_offer_revision_id LEFT JOIN listings li ON li.id=link.listing_id
    LEFT JOIN provisional_external_properties ep ON ep.id=d.external_property_id
    JOIN brokers owner ON owner.id=d.owner_id LEFT JOIN brokers approver ON approver.id=d.approved_by
    LEFT JOIN brokers closer ON closer.id=d.closed_by LEFT JOIN deal_checklists dc ON dc.deal_id=d.id
    LEFT JOIN checklist_templates ct ON ct.id=dc.template_id
    WHERE d.opportunity_id=$1 ORDER BY d.created_at DESC`,[opportunity.id]);
  for(const deal of deals){
    [deal.parties,deal.checklistItems]=await Promise.all([
      many(`SELECT dp.*,COALESCE(c.full_name,co.name,tcp.display_name) AS party_name,
        COALESCE(c.email,tcp.email) AS contact_email,COALESCE(c.phone,tcp.phone) AS contact_phone
        FROM deal_parties dp LEFT JOIN contacts c ON c.id=dp.contact_id LEFT JOIN companies co ON co.id=dp.company_id
        LEFT JOIN transaction_counterparties tcp ON tcp.id=dp.transaction_counterparty_id
        WHERE dp.deal_id=$1 ORDER BY dp.effective_to NULLS FIRST,dp.effective_from`,[deal.id]),
      many(`SELECT i.*,assignee.name AS assignee_name,completed.name AS completed_by_name,waiver.name AS waived_by_name
        FROM deal_checklist_items i LEFT JOIN brokers assignee ON assignee.id=i.assignee_id
        LEFT JOIN brokers completed ON completed.id=i.completed_by LEFT JOIN brokers waiver ON waiver.id=i.waived_by
        WHERE i.deal_checklist_id=$1 ORDER BY i.display_order`,[deal.checklistId])
    ]);
    deal.closureGates=dealClosureGates({deal,parties:deal.parties,items:deal.checklistItems});
  }
  const propertyShares=await many(`SELECT s.*,creator.name AS created_by_name,sender.name AS sent_by_name,
    COALESCE(json_agg(json_build_object('id',i.id,'propertyMatchId',i.property_match_id,'propertySnapshot',i.property_snapshot,
      'responseStatus',i.response_status,'responseNotes',i.response_notes,'respondedAt',i.responded_at)
      ORDER BY i.id) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
    FROM opportunity_property_shares s
    JOIN brokers creator ON creator.id=s.created_by
    LEFT JOIN brokers sender ON sender.id=s.sent_by
    LEFT JOIN opportunity_property_share_items i ON i.share_id=s.id
    WHERE s.opportunity_id=$1 GROUP BY s.id,creator.name,sender.name ORDER BY s.created_at DESC`,[opportunity.id]);
  res.json({opportunity,stageHistory,assignmentHistory,matches,inventoryAssignments,viewings,offers,bookings,deals,propertyShares});
});

r.get('/crm/opportunities/:id/stage-drafts/:stageCode',async(req,res)=>{
  if(!OPPORTUNITY_STAGE_WORKSPACES.includes(req.params.stageCode))return res.status(400).json({error:'Invalid Opportunity workspace stage'});
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const versions=await many(`SELECT d.id,d.stage_code,d.version_no,d.opportunity_version,d.payload,d.created_at,
      f.finalized_at
    FROM opportunity_stage_draft_versions d
    LEFT JOIN opportunity_stage_draft_finalizations f ON f.draft_version_id=d.id
    WHERE d.opportunity_id=$1 AND d.stage_code=$2 AND d.created_by=$3
    ORDER BY d.version_no DESC LIMIT 25`,[opportunity.id,req.params.stageCode,req.broker.id]);
  res.json({latest:versions.find(version=>!version.finalizedAt)||null,versions});
});

r.post('/crm/opportunities/:id/stage-drafts/:stageCode',async(req,res)=>{
  const validationError=validateOpportunityStageDraft(req.params.stageCode,req.body);
  if(validationError)return res.status(400).json({error:validationError});
  const result=await transaction(async client=>{
    await one('SELECT id FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.id],client);
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    if(Number(opportunity.version)!==Number(req.body.expectedOpportunityVersion))return{code:409,error:'This Opportunity changed after the stage workspace was opened; reload before saving a draft'};
    const latest=await one(`SELECT COALESCE(MAX(version_no),0)::int AS version_no
      FROM opportunity_stage_draft_versions WHERE opportunity_id=$1 AND stage_code=$2 AND created_by=$3`,
      [opportunity.id,req.params.stageCode,req.broker.id],client);
    const versionNo=Number(latest.versionNo)+1,id=uuid();
    const draft=await one(`INSERT INTO opportunity_stage_draft_versions
      (id,opportunity_id,stage_code,version_no,opportunity_version,payload,created_by)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)
      RETURNING id,stage_code,version_no,opportunity_version,payload,created_at`,
      [id,opportunity.id,req.params.stageCode,versionNo,opportunity.version,JSON.stringify(req.body.payload),req.broker.id],client);
    await audit('OpportunityStageDraft',id,'draft_version_created',req.broker.id,
      {opportunityId:opportunity.id,stageCode:req.params.stageCode,versionNo,opportunityVersion:opportunity.version},client);
    return{draft};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.status(201).json(result.draft);
});

r.post('/crm/opportunities/:id/stage-drafts/:stageCode/finalize',async(req,res)=>{
  if(!OPPORTUNITY_STAGE_WORKSPACES.includes(req.params.stageCode))return res.status(400).json({error:'Invalid Opportunity workspace stage'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    const draft=await one(`SELECT d.* FROM opportunity_stage_draft_versions d
      LEFT JOIN opportunity_stage_draft_finalizations f ON f.draft_version_id=d.id
      WHERE d.opportunity_id=$1 AND d.stage_code=$2 AND d.created_by=$3 AND f.id IS NULL
      ORDER BY d.version_no DESC LIMIT 1 FOR UPDATE OF d`,[opportunity.id,req.params.stageCode,req.broker.id],client);
    if(!draft)return{finalized:null};
    const finalization=await one(`INSERT INTO opportunity_stage_draft_finalizations(id,draft_version_id,finalized_by)
      VALUES($1,$2,$3) ON CONFLICT(draft_version_id) DO NOTHING RETURNING *`,[uuid(),draft.id,req.broker.id],client);
    if(finalization)await audit('OpportunityStageDraft',draft.id,'draft_finalized',req.broker.id,
      {opportunityId:opportunity.id,stageCode:req.params.stageCode,versionNo:draft.versionNo},client);
    return{finalized:finalization?{draftId:draft.id,versionNo:draft.versionNo,finalizedAt:finalization.finalizedAt}:null};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/opportunities/:id/requirement-alignment',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),reason=clean(req.body?.reason);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The Opportunity version is required; reload before aligning'});
  if(!reason||reason.length<10)return res.status(400).json({error:'Alignment reason must contain at least 10 characters'});
  const result=await transaction(async client=>{
    const opportunity=await one('SELECT * FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!opportunity)return{code:404,error:'Opportunity not found'};
    const participants=await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active',[opportunity.id],client);
    opportunity.participantIds=participants.map(item=>item.brokerId);
    if(!canReadOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your permitted scope'};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    if(!['Requirements','Matching'].includes(opportunity.stage))return{code:409,error:'Requirement alignment is available only before Viewing work begins'};
    if(Number(opportunity.version)!==expectedVersion)return{code:409,error:'This Opportunity changed after the alignment action was opened; reload before saving'};
    const requirement=await one(`SELECT lr.*,confirmation.id AS confirmation_id,confirmation.confirmed_at
      FROM lead_requirements lr JOIN lead_requirement_confirmations confirmation ON confirmation.requirement_id=lr.id
      WHERE lr.lead_id=$1 AND lr.superseded_at IS NULL FOR UPDATE OF lr`,[opportunity.leadId],client);
    if(!requirement)return{code:409,error:'A current broker-confirmed Requirement is required before alignment'};
    if(requirement.id===opportunity.requirementId)return{code:409,error:`Opportunity ${opportunity.opportunityReference} is already linked to Requirement version ${requirement.versionNo}`};
    if(requirement.businessLine&&requirement.businessLine!==opportunity.transactionType)return{code:409,error:'The current Requirement business line does not match this Opportunity transaction type'};
    const blocker=await one(`SELECT
      (SELECT COUNT(*)::int FROM viewings WHERE opportunity_id=$1 AND status<>'cancelled') AS viewings,
      (SELECT COUNT(*)::int FROM offers WHERE opportunity_id=$1) AS offers,
      (SELECT COUNT(*)::int FROM bookings WHERE opportunity_id=$1) AS bookings,
      (SELECT COUNT(*)::int FROM deals WHERE opportunity_id=$1) AS deals`,[opportunity.id],client);
    const blockers=Object.entries(blocker).filter(([,count])=>Number(count)>0);
    if(blockers.length)return{code:409,error:`Requirement alignment is blocked because downstream records already exist: ${blockers.map(([name,count])=>`${count} ${name}`).join(', ')}`};
    const staleMatches=await many(`SELECT * FROM property_matches WHERE opportunity_id=$1 AND requirement_id IS DISTINCT FROM $2 FOR UPDATE`,[opportunity.id,requirement.id],client);
    const activeAssignments=await many(`SELECT assignment.* FROM inventory_assignments assignment
      JOIN property_matches match ON match.id=assignment.property_match_id
      WHERE assignment.opportunity_id=$1 AND assignment.state='active' AND match.requirement_id IS DISTINCT FROM $2 FOR UPDATE OF assignment`,[opportunity.id,requirement.id],client);
    if((staleMatches.length||activeAssignments.length)&&req.body?.acknowledgeStaleMatching!==true)return{code:409,error:'Confirm that stale matches will be retained as rejected history and stale active assignments will be delinked'};
    const endReason=`Requirement realigned to version ${requirement.versionNo}: ${reason}`;
    for(const assignment of activeAssignments){
      await execute("UPDATE inventory_assignments SET state='delinked',ended_at=NOW(),end_reason=$1 WHERE id=$2 AND state='active'",[endReason,assignment.id],client);
      await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
        VALUES($1,$2,'delinked',$3,$4,$5::jsonb)`,[uuid(),assignment.id,endReason,req.broker.id,JSON.stringify({opportunityId:opportunity.id,
        fromRequirementId:opportunity.requirementId,toRequirementId:requirement.id,toRequirementVersion:requirement.versionNo})],client);
    }
    for(const match of staleMatches){
      if(match.shortlistStatus==='rejected')continue;
      await execute(`UPDATE property_matches SET shortlist_status='rejected',rejected_at=NOW(),rejection_reason=$1,
        updated_by=$2,updated_at=NOW(),version=version+1 WHERE id=$3`,[endReason,req.broker.id,match.id],client);
      await execute(`INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by)
        VALUES($1,$2,$3,'rejected',$4,$5)`,[uuid(),match.id,match.shortlistStatus,endReason,req.broker.id],client);
    }
    const listingCleared=opportunity.representationPath==='buyer'&&Boolean(opportunity.listingId);
    const updated=await one(`UPDATE opportunities SET requirement_id=$1,listing_id=CASE WHEN representation_path='buyer' THEN NULL ELSE listing_id END,
      stage='Requirements',version=version+1,updated_at=NOW() WHERE id=$2 AND version=$3 RETURNING *`,[requirement.id,opportunity.id,expectedVersion],client);
    if(!updated)return{code:409,error:'This Opportunity changed during alignment; reload before saving'};
    if(opportunity.stage==='Matching')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Matching','Requirements','requirement_realigned',$3,$4)`,[uuid(),opportunity.id,endReason,req.broker.id],client);
    await audit('Opportunity',opportunity.id,'requirement_version_aligned',req.broker.id,{fromRequirementId:opportunity.requirementId,
      toRequirementId:requirement.id,toRequirementVersion:requirement.versionNo,reason,staleMatchCount:staleMatches.length,
      delinkedAssignmentCount:activeAssignments.length,listingCleared,priorStage:opportunity.stage},client);
    return{opportunity:updated,requirementId:requirement.id,requirementVersionNo:requirement.versionNo,
      staleMatchCount:staleMatches.length,delinkedAssignmentCount:activeAssignments.length};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/opportunities/:id/property-shares',async(req,res)=>{
  const matchIds=Array.isArray(req.body?.propertyMatchIds)?[...new Set(req.body.propertyMatchIds.map(String))]:[],
    recipientPhone=clean(req.body?.recipientPhone),customerMessage=clean(req.body?.customerMessage),
    recipientType=String(req.body?.recipientType||'customer'),recipientName=clean(req.body?.recipientName),
    recipientAgency=clean(req.body?.recipientAgency);
  if(!matchIds.length||!recipientPhone||!customerMessage||!recipientName)return res.status(400).json({error:'Select at least one property and provide the WhatsApp recipient name, number and message'});
  if(!['customer','external_broker'].includes(recipientType))return res.status(400).json({error:'Recipient must be the Customer or an external broker'});
  if(recipientType==='external_broker'&&!recipientAgency)return res.status(400).json({error:'External broker agency is required'});
  if(matchIds.length>10)return res.status(400).json({error:'A single WhatsApp share may contain up to 10 properties'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    const matches=await many(`SELECT pm.id,pm.listing_id,pm.external_property_id,pm.shortlist_status,
      COALESCE(li.inventory_reference,ep.external_reference) AS property_reference,
      COALESCE(li.project,ep.project_or_building) AS project,
      COALESCE(li.area,ep.property_address) AS area,COALESCE(li.property_type,ep.property_type) AS property_type,
      li.bedrooms,li.size_sqft,CASE WHEN li.payment_plan_type IS NULL THEN NULL ELSE concat_ws(' · ',li.payment_plan_type,
        CASE WHEN li.down_payment_percent IS NOT NULL THEN li.down_payment_percent||'% down' END,
        CASE WHEN li.on_handover_percent IS NOT NULL THEN li.on_handover_percent||'% on handover' END,
        li.payment_plan_notes) END AS payment_plan,
      COALESCE(li.price,ep.asking_price) AS price,COALESCE(li.currency,ep.currency,'AED') AS currency
      FROM property_matches pm LEFT JOIN listings li ON li.id=pm.listing_id
      LEFT JOIN provisional_external_properties ep ON ep.id=pm.external_property_id
      WHERE pm.opportunity_id=$1 AND pm.id=ANY($2::uuid[]) AND pm.shortlist_status<>'rejected'`,[opportunity.id,matchIds],client);
    if(matches.length!==matchIds.length)return{code:409,error:'Every selected property must be an active considered or shortlisted option in this Opportunity'};
    const organization=await one("SELECT default_disclaimer FROM organization_settings WHERE status='active' ORDER BY version DESC LIMIT 1",[],client);
    const token=crypto.randomBytes(32).toString('base64url'),id=uuid(),share=await one(`INSERT INTO opportunity_property_shares(
      id,opportunity_id,recipient_phone,recipient_type,recipient_name,recipient_agency,customer_message,public_token_hash,public_expires_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+INTERVAL '30 days',$9) RETURNING *`,
      [id,opportunity.id,recipientPhone,recipientType,recipientName,recipientAgency,customerMessage,publicTokenHash(token),req.broker.id],client);
    for(const match of matches){const media=match.listingId?await many(`SELECT id,media_kind,title,caption,file_name,media_type
      FROM property_media WHERE listing_id=$1 AND approval_status='approved' AND usage_rights_confirmed=TRUE
      AND (rights_expires_at IS NULL OR rights_expires_at>NOW()) AND media_kind IN ('image','floor_plan','brochure')
      ORDER BY CASE media_kind WHEN 'image' THEN 1 WHEN 'floor_plan' THEN 2 ELSE 3 END,display_order,created_at`,[match.listingId],client):[];
      await execute(`INSERT INTO opportunity_property_share_items(
      id,share_id,property_match_id,listing_id,external_property_id,property_snapshot)
      VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[uuid(),id,match.id,match.listingId,match.externalPropertyId,JSON.stringify({
        reference:match.propertyReference,project:match.project,area:match.area,propertyType:match.propertyType,
        bedrooms:match.bedrooms,sizeSqft:match.sizeSqft,paymentPlan:match.paymentPlan,price:match.price,currency:match.currency,
        media:media.map(item=>({id:String(item.id),kind:item.mediaKind,title:item.title,caption:item.caption,fileName:item.fileName,mediaType:item.mediaType})),
        disclaimer:organization?.defaultDisclaimer||'Property information, pricing and availability are subject to verification and may change without notice.'
      })],client);
    }
    await audit('OpportunityPropertyShare',id,'prepared',req.broker.id,{opportunityId:opportunity.id,matchIds,recipientPhone},client);
    return{...share,items:matches,publicToken:token};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

r.patch('/crm/opportunities/:id/property-shares/:shareId',async(req,res)=>{
  const action=String(req.body?.action||''),responseStatus=req.body?.responseStatus||null,
    responseNotes=clean(req.body?.responseNotes),itemResponses=Array.isArray(req.body?.itemResponses)?req.body.itemResponses:[];
  if(!['sent','delivery_failed','cancelled','response'].includes(action))return res.status(400).json({error:'Select a valid WhatsApp share update'});
  if(action==='response'&&!['accepted','rejected','alternatives_requested','mixed'].includes(responseStatus))
    return res.status(400).json({error:'Select the customer response'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    const prior=await one('SELECT * FROM opportunity_property_shares WHERE id=$1 AND opportunity_id=$2 FOR UPDATE',[req.params.shareId,opportunity.id],client);
    if(!prior)return{code:404,error:'WhatsApp property share not found'};
    const status=action==='response'?'responded':action;
    const updated=await one(`UPDATE opportunity_property_shares SET status=$1,
      sent_by=CASE WHEN $1='sent' THEN $2 ELSE sent_by END,sent_at=CASE WHEN $1='sent' THEN NOW() ELSE sent_at END,
      response_status=CASE WHEN $3 THEN $4 ELSE response_status END,response_notes=CASE WHEN $3 THEN $5 ELSE response_notes END,
      responded_at=CASE WHEN $3 THEN NOW() ELSE responded_at END,updated_at=NOW() WHERE id=$6 RETURNING *`,
      [status,req.broker.id,action==='response',responseStatus,responseNotes,prior.id],client);
    if(action==='response')for(const item of itemResponses){
      if(!['accepted','rejected','alternatives_requested'].includes(item.responseStatus))continue;
      await execute(`UPDATE opportunity_property_share_items SET response_status=$1,response_notes=$2,responded_at=NOW()
        WHERE id=$3 AND share_id=$4`,[item.responseStatus,clean(item.responseNotes),item.id,prior.id],client);
    }
    await audit('OpportunityPropertyShare',prior.id,action,req.broker.id,{from:prior.status,to:status,responseStatus,responseNotes},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.get('/crm/opportunities/:id/matching-inventory',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const q=clean(req.query.q),params=[opportunity.id],where=[...liveInventoryEligibility('li','$1'),"li.id NOT IN (SELECT listing_id FROM inventory_assignments WHERE opportunity_id=$1 AND state='active' AND expires_at>NOW())"];
  if(q){params.push(`%${q}%`);where.push(`(li.project ILIKE $${params.length} OR li.area ILIKE $${params.length} OR li.inventory_reference ILIKE $${params.length})`);}
  const liveCandidates=await many(`SELECT ${inventoryEvaluatorProjection('li')} FROM listings li WHERE ${where.join(' AND ')} ORDER BY li.project,li.area`,params),liveCandidateIds=new Set(liveCandidates.map(item=>item.id));
  const selected=await many("SELECT listing_id FROM inventory_assignments WHERE opportunity_id=$1 AND state='active' AND expires_at>NOW()",[opportunity.id]),selectedIds=new Set(selected.map(item=>item.listingId));
  const considered=await many(`SELECT ${inventoryEvaluatorProjection('li')},
    EXISTS(SELECT 1 FROM bookings active_booking WHERE active_booking.listing_id=li.id AND active_booking.status='reserved' AND active_booking.expires_at>NOW() AND active_booking.opportunity_id<>$1) AS active_reservation
    FROM listings li WHERE li.deleted_at IS NULL ORDER BY li.project,li.area`,[opportunity.id]);
  const evaluated=await Promise.all(considered.map(async listing=>{const {evaluation}=await loadOpportunityInventoryEvaluation({listing,opportunityId:opportunity.id});return{listing,evaluation};})),
    propertyReasons=evaluated.map(({listing,evaluation})=>{const reasons=selectedIds.has(listing.id)?[{code:'already_selected',state:'not_met',label:'Already selected for this Opportunity'}]:evaluation.reasons;
      return{listingId:listing.id,inventoryReference:listing.inventoryReference,project:listing.project,state:selectedIds.has(listing.id)?'excluded':evaluation.state,reasons};}),
    eligibleListings=evaluated.filter(({listing,evaluation})=>evaluation.eligible&&liveCandidateIds.has(listing.id)).map(({listing})=>listing);
  const reasonCounts={};for(const item of propertyReasons)for(const reason of item.reasons)reasonCounts[reason.code]=(reasonCounts[reason.code]||0)+1;
  res.json({count:eligibleListings.length,listings:eligibleListings,requirementId:opportunity.requirementId,summary:{selectedCount:selectedIds.size,
    eligibleAdditionalCount:eligibleListings.length,consideredCount:considered.length,reasonCounts,propertyReasons}});
});

r.post('/crm/opportunities/:id/matches',async(req,res)=>{
  const checked=validatePropertyMatch(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(!['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal'].includes(opportunity.stage))return {code:409,error:'Property matches cannot be maintained on a closed Opportunity'};
    const permission=await canMaintainAssignments(req.broker,opportunity,client);
    if(!permission.allowed)return {code:403,error:'Only the responsible Opportunity owner, exact Offer creator or responsible team Manager may assign Inventory'};
    const listing=await requireLiveInventory(checked.value.listingId,opportunity.id,client);
    if(!listing)return {code:409,error:'This Inventory is not currently assignable. Select approved, verified Inventory that is not Sold, Rented or administratively Closed.'};
    const v=checked.value;await finishExpiredAssignments(opportunity.id,v.listingId,client);
    if(await one("SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2 AND state='active'",[opportunity.id,v.listingId],client))return {code:409,error:'This Inventory already has an active assignment to the Opportunity'};
    const prior=await one('SELECT * FROM property_matches WHERE opportunity_id=$1 AND requirement_id=$2 AND listing_id=$3 FOR UPDATE',[opportunity.id,opportunity.requirementId,v.listingId],client);
    let match=prior;
    if(prior){
      match=await one(`UPDATE property_matches SET requirement_id=$1,fit_status=$2,rationale=$3,exceptions=$4,
        shortlist_status='considering',shortlisted_at=NULL,rejected_at=NULL,rejection_reason=NULL,
        updated_by=$5,updated_at=NOW(),version=version+1
        WHERE id=$6 RETURNING *`,[opportunity.requirementId,v.fitStatus,v.rationale,v.exceptions,req.broker.id,prior.id],client);
      if(prior.shortlistStatus==='rejected')await execute(`INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by)
        VALUES($1,$2,'rejected','considering',$3,$4)`,[uuid(),prior.id,'Inventory reconsidered against current requirement evidence for a fresh formal assignment',req.broker.id],client);
    }else{
      const id=uuid();match=await one(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,[id,opportunity.id,opportunity.requirementId,v.listingId,v.matchSource,v.fitStatus,v.rationale,v.exceptions,req.broker.id],client);
      await execute(`INSERT INTO property_match_history(id,property_match_id,to_status,reason,changed_by) VALUES($1,$2,'considering',$3,$4)`,[uuid(),id,'Property added against the exact current requirement evidence',req.broker.id],client);
    }
    const predecessor=await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
      ORDER BY created_at DESC LIMIT 1`,[opportunity.id,v.listingId],client),assignmentId=uuid();
    const assignment=await one(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,predecessor_assignment_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[assignmentId,opportunity.id,v.listingId,match.id,predecessor?.id||null,req.broker.id],client);
    await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
      VALUES($1,$2,'created',$3,$4,$5::jsonb)`,[uuid(),assignment.id,'Inventory explicitly assigned to the Opportunity for seven days',req.broker.id,
      JSON.stringify({opportunityId:opportunity.id,listingId:v.listingId,propertyMatchId:match.id,predecessorAssignmentId:predecessor?.id||null,availabilityLikelyConfirmed:v.availabilityLikelyConfirmed,priorAvailabilityConfirmedAt:listing.availabilityConfirmedAt||null})],client);
    if(opportunity.stage==='Requirements'){
      await execute("UPDATE opportunities SET stage='Matching',version=version+1,updated_at=NOW() WHERE id=$1",[opportunity.id],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,'Requirements','Matching','match_recorded','First explainable property match recorded',$3)`,[uuid(),opportunity.id,req.broker.id],client);
    }
    await audit('PropertyMatch',match.id,'inventory_assigned',req.broker.id,{assignmentId:assignment.id,opportunityId:opportunity.id,listingId:v.listingId,
      requirementId:opportunity.requirementId,fitStatus:v.fitStatus,assignmentExpiresAt:assignment.expiresAt,assignmentDays:7},client);
    return {match,assignment};
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'This property is already recorded for the opportunity'});throw error;}
});

r.patch('/crm/opportunities/:id/matches/:matchId',async(req,res)=>{
  const checked=validateMatchDecision(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(!['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal'].includes(opportunity.stage))return {code:409,error:'Inventory assignments cannot be maintained on a closed Opportunity'};
    const prior=await one('SELECT * FROM property_matches WHERE id=$1 AND opportunity_id=$2 FOR UPDATE',[req.params.matchId,opportunity.id],client);
    if(!prior)return {code:404,error:'Property match not found'};
    const v=checked.value,updated=await one(`UPDATE property_matches SET shortlist_status=$1,shortlisted_at=CASE WHEN $1='shortlisted' THEN NOW() ELSE NULL END,
      rejected_at=CASE WHEN $1='rejected' THEN NOW() ELSE NULL END,rejection_reason=CASE WHEN $1='rejected' THEN $2 ELSE NULL END,
      updated_by=$3,updated_at=NOW(),version=version+1 WHERE id=$4 AND version=$5 RETURNING *`,[v.status,v.reason,req.broker.id,prior.id,v.expectedVersion],client);
    if(!updated)return {code:409,error:'This property match changed after it was opened; reload before updating it'};
    await execute('INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6)',[uuid(),prior.id,prior.shortlistStatus,v.status,v.reason,req.broker.id],client);
    await audit('PropertyMatch',prior.id,'shortlist_decision',req.broker.id,{from:prior.shortlistStatus,to:v.status,reason:v.reason},client);return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/opportunities/:id/inventory-assignments/:assignmentId/delink',async(req,res)=>{
  const reason=clean(req.body?.reason);if(!reason||reason.length<10)return res.status(400).json({error:'A meaningful delink reason of at least 10 characters is required'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal'].includes(opportunity.stage))return {code:409,error:'Inventory assignments cannot be changed on a closed Opportunity'};
    const permission=await canMaintainAssignments(req.broker,opportunity,client);if(!permission.allowed)return {code:403,error:'Only the current servicing agent or responsible team Manager may delink Inventory'};
    const assignment=await one(`SELECT * FROM inventory_assignments WHERE id=$1 AND opportunity_id=$2 AND state='active' FOR UPDATE`,[req.params.assignmentId,opportunity.id],client);
    if(!assignment)return {code:404,error:'Active Inventory assignment not found'};
    if(await one("SELECT id FROM bookings WHERE listing_id=$1 AND opportunity_id=$2 AND status='reserved' AND expires_at>NOW() LIMIT 1",[assignment.listingId,opportunity.id],client))return {code:409,error:'Reserved Inventory cannot be detached. Release or expire its reservation first'};
    if(await one("SELECT id FROM offers WHERE opportunity_id=$1 AND listing_id=$2 AND status='accepted' LIMIT 1",[opportunity.id,assignment.listingId],client))return {code:409,error:'Accepted Offer Inventory cannot be detached. Complete the governed reservation release or expiry path first'};
    const activeOffer=await one(`SELECT * FROM offers WHERE opportunity_id=$1 AND listing_id=$2 AND status IN ('draft','sent','countered','under_review','approved') ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[opportunity.id,assignment.listingId],client);
    if(activeOffer){await execute("UPDATE offers SET status='withdrawn',withdrawn_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1",[activeOffer.id],client);
      await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,event_type,direction,counterparty_role,summary,reason,actor_id)
        VALUES($1,$2,$3,'withdrawn','internal','customer',$4,$5,$6)`,[uuid(),activeOffer.id,activeOffer.currentRevisionId,'Offer withdrawn atomically because its Inventory assignment was delinked',reason,req.broker.id],client);}
    const ended=await one(`UPDATE inventory_assignments SET state='delinked',ended_at=NOW(),end_reason=$1 WHERE id=$2 AND state='active' RETURNING *`,[reason,assignment.id],client);
    await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
      VALUES($1,$2,'delinked',$3,$4,$5::jsonb)`,[uuid(),assignment.id,reason,req.broker.id,JSON.stringify({withdrawnOfferId:activeOffer?.id||null})],client);
    const effective=await one('SELECT nysa_inventory_effective_status($1) AS status',[assignment.listingId],client);
    await execute(`UPDATE opportunities SET next_action_code='send_property_details',next_action='Select Inventory and create a new Offer',next_action_notes=$1,next_action_due_at=NOW()+INTERVAL '1 day',version=version+1,updated_at=NOW() WHERE id=$2`,[reason,opportunity.id],client);
    return {assignment:ended,withdrawnOfferId:activeOffer?.id||null,effectiveInventoryStatus:effective.status};
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/opportunities/:id/inventory-assignments/:assignmentId/expiry',async(req,res)=>{
  const reason=clean(req.body?.reason),expiresAt=new Date(req.body?.expiresAt||'');
  if(!reason||reason.length<10||Number.isNaN(expiresAt.valueOf())||expiresAt<=new Date())return res.status(400).json({error:'A future expiry and meaningful reason of at least 10 characters are required'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!responsibleManager(req.broker,opportunity))return {code:403,error:'Only the responsible team Manager may change assignment expiry'};
    const assignment=await one(`SELECT * FROM inventory_assignments WHERE id=$1 AND opportunity_id=$2 AND state='active' FOR UPDATE`,[req.params.assignmentId,opportunity.id],client);
    if(!assignment)return {code:404,error:'Active Inventory assignment not found'};
    const changeId=uuid();await execute(`INSERT INTO inventory_assignment_expiry_changes(id,assignment_id,previous_expires_at,approved_expires_at,reason,approved_by)
      VALUES($1,$2,$3,$4,$5,$6)`,[changeId,assignment.id,assignment.expiresAt,expiresAt.toISOString(),reason,req.broker.id],client);
    const updated=await one('UPDATE inventory_assignments SET expires_at=$1 WHERE id=$2 RETURNING *',[expiresAt.toISOString(),assignment.id],client);
    await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
      VALUES($1,$2,'expiry_changed',$3,$4,$5::jsonb)`,[uuid(),assignment.id,reason,req.broker.id,JSON.stringify({changeId,previousExpiresAt:assignment.expiresAt,approvedExpiresAt:expiresAt.toISOString()})],client);
    return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/opportunities/:id/viewings',async(req,res)=>{
  const checked=validateViewingCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    await one('SELECT id FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.id],client);
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(!['Matching','Viewing'].includes(opportunity.stage))return {code:409,error:'A viewing can be scheduled only after matching starts and before offers begin'};
    const v=checked.value,match=await one(`SELECT pm.*,COALESCE(li.project,ep.project_or_building) AS project
      FROM property_matches pm LEFT JOIN listings li ON li.id=pm.listing_id
      LEFT JOIN provisional_external_properties ep ON ep.id=pm.external_property_id
      WHERE pm.id=$1 AND pm.opportunity_id=$2 FOR UPDATE OF pm`,[v.propertyMatchId,opportunity.id],client);
    if(!match||match.shortlistStatus==='rejected')return {code:409,error:'Select a considered or shortlisted property for the viewing'};
    if(match.listingId&&!await requireLiveInventory(match.listingId,opportunity.id,client))return {code:409,error:'This Inventory is sold, rented, administratively closed or no longer verified and cannot be scheduled for viewing. Its prior match remains historical evidence.'};
    let rescheduledFrom=null;
    if(v.rescheduledFromViewingId){
      rescheduledFrom=await one('SELECT * FROM viewings WHERE id=$1 AND opportunity_id=$2 FOR UPDATE',[v.rescheduledFromViewingId,opportunity.id],client);
      if(!rescheduledFrom||!['no_show','cancelled'].includes(rescheduledFrom.status))return {code:409,error:'Only a cancelled or no-show viewing can be the source of a new rescheduled appointment'};
      if(rescheduledFrom.propertyMatchId!==match.id)return {code:409,error:'The rescheduled viewing must retain the original property'};
    }
    const duplicate=await one("SELECT id FROM viewings WHERE opportunity_id=$1 AND property_match_id=$2 AND starts_at=$3 AND ends_at=$4 AND status='scheduled' LIMIT 1",[opportunity.id,match.id,v.startsAt,v.endsAt],client);
    if(duplicate)return {code:409,error:'This viewing is already confirmed. Review the confirmed viewing before scheduling another'};
    if(match.shortlistStatus==='considering'){
      await execute(`UPDATE property_matches SET shortlist_status='shortlisted',shortlisted_at=NOW(),updated_by=$1,updated_at=NOW(),version=version+1 WHERE id=$2`,
        [req.broker.id,match.id],client);
      await execute(`INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by)
        VALUES($1,$2,'considering','shortlisted','Property automatically shortlisted when its viewing was scheduled',$3)`,[uuid(),match.id,req.broker.id],client);
      await audit('PropertyMatch',match.id,'shortlist_decision',req.broker.id,{from:'considering',to:'shortlisted',reason:'Viewing scheduled for this property'},client);
    }
    const id=uuid(),calendarUid=`${id}@nysarealty.com`;
    const viewing=await one(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,external_property_id,organizer_id,starts_at,ends_at,timezone,location,instructions,client_message,calendar_uid,created_by,updated_by,rescheduled_from_viewing_id,reschedule_reason)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$6,$6,$14,$15) RETURNING *`,
      [id,opportunity.id,match.id,match.listingId,match.externalPropertyId,req.broker.id,v.startsAt,v.endsAt,v.timezone,v.location,v.instructions,v.clientMessage,calendarUid,v.rescheduledFromViewingId,v.rescheduleReason],client);
    if(opportunity.contactId)await execute(`INSERT INTO viewing_attendees(id,viewing_id,contact_id,attendee_role,invitation_status) VALUES($1,$2,$3,'customer','planned')`,[uuid(),id,opportunity.contactId],client);
    else if(opportunity.buyerCounterpartyId){
      const buyer=await one('SELECT display_name FROM transaction_counterparties WHERE id=$1',[opportunity.buyerCounterpartyId],client);
      if(buyer)await execute(`INSERT INTO viewing_attendees(id,viewing_id,guest_name,attendee_role,invitation_status) VALUES($1,$2,$3,'guest','planned')`,[uuid(),id,buyer.displayName],client);
    }
    await execute(`INSERT INTO viewing_attendees(id,viewing_id,broker_id,attendee_role,invitation_status) VALUES($1,$2,$3,'agent','planned')`,[uuid(),id,opportunity.ownerId],client);
    for(const attendee of v.attendees){
      const name=clean(attendee.guestName);if(!name)continue;
      await execute(`INSERT INTO viewing_attendees(id,viewing_id,guest_name,attendee_role,invitation_status) VALUES($1,$2,$3,'guest','planned')`,[uuid(),id,name],client);
    }
    await execute(`INSERT INTO viewing_status_history(id,viewing_id,to_status,reason,changed_by) VALUES($1,$2,'scheduled','Viewing scheduled locally',$3)`,[uuid(),id,req.broker.id],client);
    await execute(`UPDATE opportunities SET stage='Viewing',listing_id=COALESCE(listing_id,$1),next_action_code='complete_viewing_feedback',next_action='Complete viewing and record feedback',next_action_notes=NULL,next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3`,[match.listingId,v.endsAt,opportunity.id],client);
    if(opportunity.stage==='Matching')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Matching','Viewing','viewing_scheduled',$3,$4)`,[uuid(),opportunity.id,`Viewing scheduled for ${match.project}`,req.broker.id],client);
    await audit('Viewing',id,rescheduledFrom?'rescheduled_as_new_viewing':'scheduled',req.broker.id,{opportunityId:opportunity.id,propertyMatchId:match.id,listingId:match.listingId,startsAt:v.startsAt,endsAt:v.endsAt,timezone:v.timezone,clientMessageIncluded:Boolean(v.clientMessage),rescheduledFromViewingId:v.rescheduledFromViewingId,rescheduleReason:v.rescheduleReason,propertyAutomaticallyShortlisted:match.shortlistStatus==='considering'},client);
    return viewing;
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

r.patch('/crm/opportunities/:id/viewings/:viewingId',async(req,res)=>{
  const checked=validateViewingOutcome(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    const prior=await one('SELECT * FROM viewings WHERE id=$1 AND opportunity_id=$2 FOR UPDATE',[req.params.viewingId,opportunity.id],client);
    if(!prior)return {code:404,error:'Viewing not found'};if(prior.status!=='scheduled')return {code:409,error:'Only a scheduled viewing can receive an outcome'};
    const v=checked.value,attendees=await many('SELECT id FROM viewing_attendees WHERE viewing_id=$1 FOR UPDATE',[prior.id],client);
    if(prior.version!==v.expectedVersion)return {code:409,error:'This viewing changed after it was opened; reload before updating it'};
    const attendeeIds=new Set(attendees.map(x=>x.id)),submittedIds=new Set(v.attendance.map(x=>x.id));
    if(v.status==='completed'&&(submittedIds.size!==attendeeIds.size||[...submittedIds].some(id=>!attendeeIds.has(id))))return {code:409,error:'Record attendance for every viewing attendee'};
    if([...submittedIds].some(id=>!attendeeIds.has(id)))return {code:409,error:'A viewing attendee changed; reload before recording the outcome'};
    for(const item of v.attendance){
      await execute('UPDATE viewing_attendees SET attendance_status=$1 WHERE id=$2 AND viewing_id=$3',[item.attendanceStatus,item.id,prior.id],client);
    }
    const updated=await one(`UPDATE viewings SET status=$1,outcome=$2,feedback=$3,follow_up_action=$4,follow_up_due_at=$5,
      updated_by=$6,updated_at=NOW(),version=version+1 WHERE id=$7 AND version=$8 RETURNING *`,[v.status,v.outcome,v.feedback,v.followUpAction,v.followUpDueAt,req.broker.id,prior.id,v.expectedVersion],client);
    if(!updated)return {code:409,error:'This viewing changed after it was opened; reload before updating it'};
    await execute('INSERT INTO viewing_status_history(id,viewing_id,from_status,to_status,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6)',[uuid(),prior.id,prior.status,v.status,v.feedback||v.outcome,req.broker.id],client);
    if(v.followUpAction)await execute("UPDATE opportunities SET next_action_code='follow_up_offer_feedback',next_action=$1,next_action_notes=$1,next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3",[v.followUpAction,v.followUpDueAt,opportunity.id],client);
    await audit('Viewing',prior.id,'outcome_recorded',req.broker.id,{from:prior.status,to:v.status,outcome:v.outcome,followUpAction:v.followUpAction},client);return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});const calendarSync=result.status==='cancelled'?await syncGoogleViewing(result.id,req.broker.id):null;res.json({...result,calendarSync});
});

r.patch('/crm/opportunities/:id/viewings/:viewingId/schedule',async(req,res)=>{
  const startsAt=new Date(req.body?.startsAt),endsAt=new Date(req.body?.endsAt),timezone=clean(req.body?.timezone),location=clean(req.body?.location),instructions=clean(req.body?.instructions),clientMessage=clean(req.body?.clientMessage),expectedVersion=Number(req.body?.expectedVersion);
  if(Number.isNaN(startsAt.valueOf())||Number.isNaN(endsAt.valueOf())||endsAt<=startsAt||!timezone||!location||!Number.isInteger(expectedVersion))return res.status(400).json({error:'Valid start, end, timezone, location and current version are required'});
  const result=await transaction(async client=>{const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};const prior=await one('SELECT * FROM viewings WHERE id=$1 AND opportunity_id=$2 FOR UPDATE',[req.params.viewingId,opportunity.id],client);if(!prior)return {code:404,error:'Viewing not found'};if(prior.status!=='scheduled')return {code:409,error:'Only a scheduled viewing can be rescheduled'};const updated=await one(`UPDATE viewings SET starts_at=$1,ends_at=$2,timezone=$3,location=$4,instructions=$5,client_message=$6,updated_by=$7,updated_at=NOW(),version=version+1 WHERE id=$8 AND version=$9 RETURNING *`,[startsAt.toISOString(),endsAt.toISOString(),timezone,location,instructions,clientMessage,req.broker.id,prior.id,expectedVersion],client);if(!updated)return {code:409,error:'This viewing changed after it was opened; reload before rescheduling'};await execute("INSERT INTO viewing_status_history(id,viewing_id,from_status,to_status,reason,changed_by) VALUES($1,$2,'scheduled','scheduled',$3,$4)",[uuid(),prior.id,'Viewing schedule updated',req.broker.id],client);await audit('Viewing',prior.id,'rescheduled',req.broker.id,{from:{startsAt:prior.startsAt,endsAt:prior.endsAt},to:{startsAt:updated.startsAt,endsAt:updated.endsAt},timezone,location,clientMessageIncluded:Boolean(clientMessage)},client);return updated;});if(result.error)return res.status(result.code).json({error:result.error});const calendarSync=await syncGoogleViewing(result.id,req.broker.id);res.json({...result,calendarSync});
});

r.get('/crm/opportunities/:id/viewings/:viewingId/calendar.ics',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const viewing=await one(`SELECT v.*,COALESCE(li.project,ep.project_or_building) AS listing_project,o.opportunity_reference
    FROM viewings v LEFT JOIN listings li ON li.id=v.listing_id
    LEFT JOIN provisional_external_properties ep ON ep.id=v.external_property_id
    JOIN opportunities o ON o.id=v.opportunity_id WHERE v.id=$1 AND v.opportunity_id=$2`,[req.params.viewingId,opportunity.id]);
  if(!viewing)return res.status(404).json({error:'Viewing not found'});await audit('Viewing',viewing.id,'calendar_downloaded',req.broker.id,{opportunityId:opportunity.id});
  res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="nysa-viewing-${viewing.id}.ics"`);res.end(buildViewingIcs(viewing));
});

async function offerContext(req,offerId,client){
  const offer=await one(`SELECT f.*,o.lead_id,o.contact_id,o.owner_id AS opportunity_owner_id,o.created_by AS opportunity_created_by,
    o.assigned_team_id,o.opportunity_reference,o.title AS opportunity_title,o.stage AS opportunity_stage,
    COALESCE(c.full_name,buyer.display_name) AS customer_name,COALESCE(c.email,buyer.email) AS customer_email,
    COALESCE(c.phone,buyer.phone) AS customer_phone,COALESCE(li.project,ep.project_or_building) AS listing_project,
    COALESCE(li.inventory_reference,ep.external_reference) AS inventory_reference,
    EXISTS(SELECT 1 FROM viewings v WHERE v.opportunity_id=f.opportunity_id
      AND (v.listing_id=f.listing_id OR v.external_property_id=f.external_property_id)
      AND v.status='completed' AND NULLIF(BTRIM(v.feedback),'') IS NOT NULL AND v.updated_at<=f.created_at) AS viewing_feedback_recorded
    FROM offers f JOIN opportunities o ON o.id=f.opportunity_id LEFT JOIN contacts c ON c.id=o.contact_id
    LEFT JOIN transaction_counterparties buyer ON buyer.id=o.buyer_counterparty_id
    LEFT JOIN listings li ON li.id=f.listing_id LEFT JOIN provisional_external_properties ep ON ep.id=f.external_property_id
    WHERE f.id=$1`,[offerId],client);
  if(!offer)return {error:[404,'Offer not found']};
  offer.participantIds=(await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active',[offer.opportunityId],client)).map(x=>x.brokerId);
  if(!canReadOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {error:[403,'Offer is outside your permitted scope']};
  return {offer};
}

async function createOfferRevisionRecords({client,req,offer,opportunity,listing,customer,input,revisionNumber,supersedesRevisionId}){
  const organization=await one("SELECT * FROM organization_settings WHERE status='active' LIMIT 1",[],client);
  if(!organization)throw Object.assign(new Error('Activate the approved NYSA organization profile before generating an offer letter'),{status:409});
  if(!organization.logoStorageKey||!['image/jpeg','image/png'].includes(organization.logoMediaType)){
    throw Object.assign(new Error('The active NYSA organization profile must contain an approved JPEG or PNG logo before generating an offer letter'),{status:409});
  }
  const logo=organization.logoStorageKey?{buffer:await readPrivate(organization.logoStorageKey),mediaType:organization.logoMediaType}:null,
    revisionId=uuid(),documentId=uuid(),documentVersionId=uuid(),createdAt=new Date(),revision={...input,id:revisionId,revisionNumber,createdAt},
    pdf=makeOfferPdf({offer,revision,opportunity,customer,listing,agent:req.broker,organization,logo}),storageKey=await savePrivate(pdf,'.pdf'),
    fileHash=crypto.createHash('sha256').update(pdf).digest('hex'),fileName=`${offer.offerReference}-R${revisionNumber}.pdf`;
  try{
    await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,lead_id,listing_id)
      VALUES($1,$2,'Offer Letter',$3,$8,'private','active',$4,$4,$5,$6,$7)`,
      [documentId,`${offer.offerReference}-R${revisionNumber}`,`${offer.offerReference} - Revision ${revisionNumber}`,req.broker.id,opportunity.contactId,opportunity.leadId,listing.id,input.direction==='inbound'?'Inbound':'Outbound'],client);
    await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
      VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'generated','private','generated',$7,$7)`,
      [documentVersionId,documentId,fileName,pdf.length,storageKey,fileHash,req.broker.id],client);
    await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by)
      VALUES($1,$2,'Opportunity',$3,$4),($5,$2,'Offer',$6,$4),($7,$2,'OfferRevision',$8,$4)`,
      [uuid(),documentId,opportunity.id,req.broker.id,uuid(),offer.id,uuid(),revisionId],client);
    if(opportunity.leadId)await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by)
      VALUES($1,$2,'Lead',$3,$4)`,[uuid(),documentId,opportunity.leadId,req.broker.id],client);
    const row=await one(`INSERT INTO offer_revisions(id,offer_id,revision_number,supersedes_revision_id,direction,proposer_role,
      amount,currency,deposit_amount,financing_method,payment_terms,conditions,validity_expires_at,material_correction_reason,
      document_version_id,created_by,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [revisionId,offer.id,revisionNumber,supersedesRevisionId,input.direction,input.proposerRole,input.amount,input.currency,
        input.depositAmount,input.financingMethod,input.paymentTerms,input.conditions,input.validityExpiresAt,input.materialCorrectionReason,
        documentVersionId,req.broker.id,createdAt],client);
    return {...row,fileName,fileHash,storageKey};
  }catch(error){await removePrivate(storageKey).catch(()=>{});throw error;}
}

r.post('/crm/opportunities/:id/offers',async(req,res)=>{
  let storageKey;
  try{
    const result=await transaction(async client=>{
      await one('SELECT id FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.id],client);
      const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
      if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
      if(['Closed Won','Closed Lost','Booking'].includes(opportunity.stage))return {code:409,error:'Create offers only from an active pre-booking Opportunity'};
      const checked=validateOfferRevision(req.body||{},1);if(checked.error)return {code:400,error:checked.error};
      const catalogue=await loadActiveClassificationCatalogue(client);
      if(opportunity.classificationCatalogueVersionId!==catalogue.version.id)return {code:409,error:`Opportunity classification is not pinned to active catalogue ${catalogue.version.code}`};
      const governedOfferType=mapClassificationValue(catalogue,'customer_objective',opportunity.customerObjective,'offer_direction')?.targetValueCode;
      if(!governedOfferType)return {code:409,error:'Confirm the Customer objective before creating an Offer'};
      if(checked.value.offerType!==governedOfferType)return {code:409,error:'Offer direction must follow the confirmed Customer objective'};
      const match=await one(`SELECT pm.*,COALESCE(li.project,ep.project_or_building) AS project,
        COALESCE(li.area,ep.property_address) AS area,COALESCE(li.property_type,ep.property_type) AS property_type,
        COALESCE(li.price,ep.asking_price) AS price,COALESCE(li.currency,ep.currency) AS currency,
        li.deleted_at,li.workflow_status,ep.status AS external_status
        FROM property_matches pm LEFT JOIN listings li ON li.id=pm.listing_id
        LEFT JOIN provisional_external_properties ep ON ep.id=pm.external_property_id
        WHERE pm.id=$1 AND pm.opportunity_id=$2 AND pm.shortlist_status<>'rejected' LIMIT 1`,
        [req.body?.propertyMatchId,opportunity.id],client);
      if(!match||match.listingId&&!await requireLiveInventory(match.listingId,opportunity.id,client)||
        match.externalPropertyId&&match.externalStatus!=='approved_for_opportunity')
        return {code:409,error:'Select an approved considered or shortlisted property from this Opportunity'};
      if(match.listingId&&!await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
        AND state='active' AND starts_at<=NOW() AND expires_at>NOW()`,[opportunity.id,match.listingId],client))return {code:409,error:'Assign this Inventory to the Opportunity before creating an Offer'};
      let predecessor=null;
      if(req.body?.predecessorOfferId){
        predecessor=await one(`SELECT * FROM offers WHERE id=$1 AND opportunity_id=$2 FOR UPDATE`,[req.body.predecessorOfferId,opportunity.id],client);
        if(!predecessor||!['rejected','expired','withdrawn'].includes(predecessor.status))return {code:409,error:'Renegotiation must reference a terminal rejected, expired or NYSA-withdrawn Offer'};
        // A reassignment or Inventory replacement creates a new Offer ID at Revision 1 while
        // retaining the terminal predecessor even when the property changed.
      }
      const completedViewing=await one(`SELECT id FROM viewings WHERE opportunity_id=$1 AND property_match_id=$2
        AND status='completed' AND NULLIF(BTRIM(feedback),'') IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
        [opportunity.id,match.id],client);
      if(!completedViewing)return {code:409,error:'Complete the property viewing and record customer feedback before creating an offer for this property'};
      const customer=opportunity.contactId?await one('SELECT * FROM contacts WHERE id=$1',[opportunity.contactId],client):
        await one(`SELECT display_name AS full_name,email,phone FROM transaction_counterparties WHERE id=$1`,[opportunity.buyerCounterpartyId],client),
        period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code,
        counter=await one(`INSERT INTO offer_number_counters(period_code,last_value) VALUES($1,1) ON CONFLICT(period_code)
          DO UPDATE SET last_value=offer_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client),
        offerReference=`NYSA-OF-${period}-${String(counter.lastValue).padStart(6,'0')}`,offerId=uuid(),
        offer=await one(`INSERT INTO offers(id,offer_reference,opportunity_id,listing_id,external_property_id,offer_type,currency,owner_id,created_by,predecessor_offer_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [offerId,offerReference,opportunity.id,match.listingId,match.externalPropertyId,checked.value.offerType,checked.value.currency,opportunity.ownerId,req.broker.id,predecessor?.id||null],client);
      await execute(`UPDATE offers SET classification_catalogue_version_id=$1,classification_mapping_evidence=$2::jsonb WHERE id=$3`,
        [opportunity.classificationCatalogueVersionId,JSON.stringify(opportunity.classificationMappingEvidence||{}),offer.id],client);
      const revision=await createOfferRevisionRecords({client,req,offer,opportunity,listing:{...match,id:match.listingId},customer,input:checked.value,revisionNumber:1,supersedesRevisionId:null});storageKey=revision.storageKey;
      await execute('UPDATE offers SET current_revision_id=$1,updated_at=NOW() WHERE id=$2',[revision.id,offer.id],client);
      await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,actor_id)
        VALUES($1,$2,$3,$4,'created','internal',$5,$6,$7)`,
        [uuid(),offer.id,revision.id,revision.documentVersionId,checked.value.proposerRole,'Offer created with immutable Revision 1 and exact generated document',req.broker.id],client);
      await execute(`UPDATE opportunities SET stage='Offer',listing_id=$1,next_action_code='prepare_or_review_offer',next_action='Review and send the exact offer revision',next_action_notes=NULL,
        recovery_state=NULL,next_action_due_at=LEAST(next_action_due_at,NOW()+INTERVAL '1 day'),version=version+1,updated_at=NOW() WHERE id=$2`,[match.listingId,opportunity.id],client);
      if(opportunity.stage!=='Offer')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Offer','offer_created',$4,$5)`,[uuid(),opportunity.id,opportunity.stage,`Offer ${offerReference} created for ${match.project}`,req.broker.id],client);
      await audit('Offer',offer.id,predecessor?'recovery_offer_created':'created',req.broker.id,{opportunityId:opportunity.id,listingId:match.listingId,
        externalPropertyId:match.externalPropertyId,offerReference,revisionId:revision.id,documentVersionId:revision.documentVersionId,fileHash:revision.fileHash},client);
      return {...offer,currentRevisionId:revision.id,revision};
    });
    if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
  }catch(error){if(storageKey)await removePrivate(storageKey).catch(()=>{});if(error.status)return res.status(error.status).json({error:error.message});if(error.code==='23505')return res.status(409).json({error:'An active offer already exists for this Opportunity, property and offer type'});throw error;}
});

r.post('/crm/offers/:offerId/revisions',async(req,res)=>{
  let storageKey;
  try{
    const result=await transaction(async client=>{
      const {offer,error}=await offerContext(req,req.params.offerId,client);if(error)return {code:error[0],error:error[1]};
      if(!canWriteOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {code:403,error:'Offer is outside your writable scope'};
      if(!offer.viewingFeedbackRecorded)return {code:409,error:'This offer has no completed viewing feedback evidence recorded before it was created. Withdraw it and create a governed replacement after feedback'};
      if(['accepted','rejected','expired','withdrawn'].includes(offer.status))return {code:409,error:'A terminal offer cannot receive another revision'};
      if(offer.listingId&&!await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
        AND state='active' AND starts_at<=NOW() AND expires_at>NOW()`,[offer.opportunityId,offer.listingId],client))return {code:409,error:'This Offer Inventory assignment expired or ended. Reassign the Inventory before creating another revision'};
      if(Number(req.body?.expectedVersion)!==offer.version)return {code:409,error:'This offer changed after it was opened; reload before revising it'};
      const prior=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client),
        revisionNumber=prior.revisionNumber+1,checked=validateOfferRevision({...req.body,offerType:offer.offerType},revisionNumber);
      if(checked.error)return {code:400,error:checked.error};
      const opportunity=await opportunityWithParticipants(offer.opportunityId,client),
        listing=offer.listingId?await one('SELECT * FROM listings WHERE id=$1',[offer.listingId],client):
          await one(`SELECT id AS external_property_id,project_or_building AS project,property_address AS area,
            property_type,asking_price AS price,currency FROM provisional_external_properties WHERE id=$1`,[offer.externalPropertyId],client),
        customer=offer.contactId?await one('SELECT * FROM contacts WHERE id=$1',[offer.contactId],client):
          {fullName:offer.customerName,email:offer.customerEmail,phone:offer.customerPhone},
        revision=await createOfferRevisionRecords({client,req,offer,opportunity,listing,customer,input:checked.value,revisionNumber,supersedesRevisionId:prior.id});storageKey=revision.storageKey;
      const status=offerStatusAfterRevision(checked.value.direction),updated=await one(`UPDATE offers SET current_revision_id=$1,status=$2,
        version=version+1,updated_at=NOW() WHERE id=$3 AND version=$4 RETURNING *`,[revision.id,status,offer.id,offer.version],client);
      await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,reason,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid(),offer.id,revision.id,revision.documentVersionId,'material_correction',checked.value.direction,checked.value.proposerRole,
          `Immutable Revision ${revisionNumber} created`,checked.value.materialCorrectionReason,req.broker.id],client);
      if(checked.value.direction==='inbound')await execute(`UPDATE opportunities SET stage='Negotiation',next_action_code='follow_up_offer_feedback',next_action='Review counteroffer and record response',next_action_notes=NULL,
        next_action_due_at=NOW()+INTERVAL '1 day',version=version+1,updated_at=NOW() WHERE id=$1`,[offer.opportunityId],client);
      await audit('OfferRevision',revision.id,'created',req.broker.id,{offerId:offer.id,revisionNumber,direction:revision.direction,documentVersionId:revision.documentVersionId,fileHash:revision.fileHash,reason:revision.materialCorrectionReason},client);
      return {...updated,revision};
    });
    if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
  }catch(error){if(storageKey)await removePrivate(storageKey).catch(()=>{});if(error.status)return res.status(error.status).json({error:error.message});throw error;}
});

r.post('/crm/offers/:offerId/send',async(req,res)=>{
  const recipientName=clean(req.body?.recipientName),recipientEmail=clean(req.body?.recipientEmail)?.toLowerCase(),
    recipientPhone=clean(req.body?.recipientPhone),legacyRecipient=clean(req.body?.recipient),
    recipient=[recipientName,recipientEmail,recipientPhone].filter(Boolean).join(' | ')||legacyRecipient,
    deliveryChannel=clean(req.body?.deliveryChannel),
    counterpartyRole=['buyer','tenant'].includes(req.body?.counterpartyRole)?'customer':req.body?.counterpartyRole,expectedVersion=Number(req.body?.expectedVersion);
  if(!recipientName&&!legacyRecipient)return res.status(400).json({error:'Recipient name is required'});
  if(!recipientEmail&&!recipientPhone&&!legacyRecipient)return res.status(400).json({error:'Recipient email or phone is required'});
  if(/^email$/i.test(deliveryChannel)&&!recipientEmail&&!legacyRecipient)return res.status(400).json({error:'Recipient email is required for Email delivery'});
  if(/^whatsapp$/i.test(deliveryChannel)&&!recipientPhone&&!legacyRecipient)return res.status(400).json({error:'Recipient phone is required for WhatsApp delivery'});
  if(!recipient||!deliveryChannel||!OFFER_COUNTERPARTY_ROLES.includes(counterpartyRole))return res.status(400).json({error:'Recipient, delivery channel and counterparty are required'});
  const result=await transaction(async client=>{
    const {offer,error}=await offerContext(req,req.params.offerId,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {code:403,error:'Offer is outside your writable scope'};
    if(!offer.viewingFeedbackRecorded)return {code:409,error:'This offer has no completed viewing feedback evidence recorded before it was created. Withdraw it and create a governed replacement after feedback'};
    if(offer.status!=='draft'||offer.version!==expectedVersion)return {code:409,error:'Only the current draft revision can be sent; reload before sending'};
    if(offer.listingId&&!await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
      AND state='active' AND starts_at<=NOW() AND expires_at>NOW()`,[offer.opportunityId,offer.listingId],client))return {code:409,error:'This Offer Inventory assignment expired or ended. Reassign the Inventory before sending the Offer'};
    const revision=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client);
    if(!revision||revision.direction!=='outbound')return {code:409,error:'Create an outbound revision before sending'};
    if(new Date(revision.validityExpiresAt)<=new Date())return {code:409,error:'This revision has expired; create a new immutable revision before sending'};
    const updated=await one(`UPDATE offers SET status='sent',sent_at=NOW(),version=version+1,updated_at=NOW()
      WHERE id=$1 AND version=$2 RETURNING *`,[offer.id,offer.version],client);
    await execute("UPDATE document_versions SET status='sent',sent_at=NOW(),recipient=$1,immutable=1 WHERE id=$2",[recipient,revision.documentVersionId],client);
    await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,delivery_channel,delivery_recipient,actor_id)
      VALUES($1,$2,$3,$4,'sent','outbound',$5,$6,$7,$8,$9)`,
      [uuid(),offer.id,revision.id,revision.documentVersionId,counterpartyRole,`Exact Revision ${revision.revisionNumber} sent to ${recipient}`,deliveryChannel,recipient,req.broker.id],client);
    await execute(`UPDATE opportunities SET stage='Negotiation',next_action_code='follow_up_offer_feedback',next_action='Confirm offer receipt and record negotiation response',next_action_notes=NULL,
      next_action_due_at=NOW()+INTERVAL '1 day',version=version+1,updated_at=NOW() WHERE id=$1`,[offer.opportunityId],client);
    if(offer.opportunityStage!=='Negotiation')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,'Negotiation','offer_sent',$4,$5)`,[uuid(),offer.opportunityId,offer.opportunityStage,`Offer ${offer.offerReference} Revision ${revision.revisionNumber} sent`,req.broker.id],client);
    await audit('Offer',offer.id,'sent',req.broker.id,{revisionId:revision.id,documentVersionId:revision.documentVersionId,recipient,deliveryChannel,counterpartyRole},client);
    return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/offers/:offerId/events',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion);
  const result=await transaction(async client=>{
    const {offer,error}=await offerContext(req,req.params.offerId,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {code:403,error:'Offer is outside your writable scope'};
    if(!offer.viewingFeedbackRecorded&&req.body?.eventType!=='withdrawn')return {code:409,error:'Only withdrawal is available because this offer has no viewing feedback evidence recorded before creation'};
    if(offer.version!==expectedVersion)return {code:409,error:'This offer changed after it was opened; reload before recording the negotiation event'};
    if(offer.status==='accepted')return {code:409,error:'Accepted Offer outcomes must use the governed Manager reservation release, cancellation or expiry path'};
    const checked=validateOfferEvent(offer.status,req.body||{});if(checked.error)return {code:409,error:checked.error};
    const v=checked.value,revision=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client),
      nextStatus=v.eventType==='acknowledged'?'viewed':v.eventType,terminalAt={
        accepted:'accepted_at',rejected:'rejected_at',expired:'expired_at',withdrawn:'withdrawn_at',viewed:'viewed_at',acknowledged:'viewed_at'
      }[v.eventType],sets=["status=$1","version=version+1","updated_at=NOW()"],params=[nextStatus];
    const validityExpired=new Date(revision.validityExpiresAt)<=new Date();
    if(v.eventType==='accepted'&&validityExpired)return {code:409,error:'This revision has expired and cannot be accepted'};
    if(v.eventType==='accepted'){
      const assignmentPermission=await canMaintainAssignments(req.broker,{...offer,id:offer.opportunityId,ownerId:offer.opportunityOwnerId,assignedTeamId:offer.assignedTeamId},client);
      if(!assignmentPermission.allowed)return {code:403,error:'Only the exact Offer creator or responsible team Manager may record acceptance'};
      if(offer.listingId&&!await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
        AND state='active' AND starts_at<=NOW() AND expires_at>NOW()`,[offer.opportunityId,offer.listingId],client))
        return {code:409,error:'This Offer Inventory has no active unexpired assignment to the Opportunity'};
      const competing=await one(`SELECT b.booking_reference,o.opportunity_reference,b.expires_at FROM bookings b
        JOIN opportunities o ON o.id=b.opportunity_id WHERE b.listing_id=$1 AND b.status='reserved' AND b.expires_at>NOW()
        AND b.opportunity_id<>$2 ORDER BY b.created_at LIMIT 1`,[offer.listingId,offer.opportunityId],client);
      if(competing)return {code:409,error:`Inventory is exclusively reserved under ${competing.bookingReference} for Opportunity ${competing.opportunityReference} until ${new Date(competing.expiresAt).toISOString()}; this Offer cannot be accepted while that reservation is active`};
    }
    if(v.eventType==='accepted'&&!await one(`SELECT id FROM property_matches WHERE opportunity_id=$1 AND shortlist_status<>'rejected'
      AND (($2::uuid IS NOT NULL AND listing_id=$2) OR ($3::uuid IS NOT NULL AND external_property_id=$3)) LIMIT 1`,[offer.opportunityId,offer.listingId,offer.externalPropertyId],client))
      return {code:409,error:'This Offer property is no longer attached to the Opportunity. Re-add the eligible Inventory before recording acceptance'};
    if(['withdrawn','expired'].includes(v.eventType)&&await one("SELECT id FROM deals WHERE offer_id=$1 AND status NOT IN ('closed_won','closed_lost')",[offer.id],client))return {code:409,error:'This accepted Offer already governs an active Deal. Use the governed Deal close-lost or future replacement action; the Offer cannot be withdrawn independently'};
    if(v.eventType==='expired'&&!validityExpired)return {code:409,error:'This revision remains valid; record withdrawal or rejection instead'};
    if(terminalAt)sets.push(`${terminalAt}=NOW()`);
    if(v.eventType==='accepted'){params.push(revision.id);sets.push(`accepted_revision_id=$${params.length}`);}
    params.push(offer.id,offer.version);
    const updated=await one(`UPDATE offers SET ${sets.join(',')} WHERE id=$${params.length-1} AND version=$${params.length} RETURNING *`,params,client);
    await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,reason,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(),offer.id,revision.id,revision.documentVersionId,v.eventType,v.direction,v.counterpartyRole,v.summary,v.reason,req.broker.id],client);
    const recovered=['rejected','expired','withdrawn'].includes(v.eventType),nextAction=v.eventType==='accepted'?'Create the separate seven-day reservation from this accepted revision':
      recovered?'Offer outcome recorded: renegotiate, create a new offer, return to Matching, or close as Lost':'Continue negotiation and record the next exact revision';
    if(recovered){
      const reservationRelease=await releaseOfferOwnedReservation(offer,`${v.eventType} offer: ${v.reason||v.summary}`,req.broker.id,client);
      if(reservationRelease?.blocked)return {code:409,error:'The Offer-owned reservation has an unsafe prior Inventory status and must be reconciled before recording this terminal outcome'};
      await execute("UPDATE offers SET recovery_checkpoint='terminal_offer' WHERE id=$1",[offer.id],client);
      await execute("UPDATE opportunities SET stage='Offer',recovery_state='offer_recovery',next_action_code='follow_up_offer_feedback',next_action=$1,next_action_notes=$1,next_action_due_at=NOW()+INTERVAL '1 day',version=version+1,updated_at=NOW() WHERE id=$2",[nextAction,offer.opportunityId],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Offer','terminal_offer_recovery',$4,$5)`,[uuid(),offer.opportunityId,offer.opportunityStage,`${v.eventType} offer retained immutably; recovery checkpoint opened`,req.broker.id],client);
    }else{
      await execute("UPDATE opportunities SET stage=CASE WHEN $1='accepted' THEN 'Negotiation' ELSE stage END,next_action_code=$2,next_action=$3,next_action_notes=NULL,next_action_due_at=NOW()+INTERVAL '1 day',version=version+1,updated_at=NOW() WHERE id=$4",[v.eventType,v.eventType==='accepted'?'create_reservation':'follow_up_offer_feedback',nextAction,offer.opportunityId],client);
      if(v.eventType==='accepted'&&offer.opportunityStage!=='Negotiation')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Negotiation','offer_revision_accepted',$4,$5)`,[uuid(),offer.opportunityId,offer.opportunityStage,
        `Customer/counterparty accepted exact Offer revision ${revision.revisionNumber}`,req.broker.id],client);
    }
    if(v.eventType==='accepted'&&offer.externalPropertyId)await execute(`UPDATE provisional_external_properties
      SET status='under_offer',updated_at=NOW() WHERE id=$1 AND status='approved_for_opportunity'`,[offer.externalPropertyId],client);
    await audit('NegotiationEvent',offer.id,v.eventType,req.broker.id,{offerRevisionId:revision.id,documentVersionId:revision.documentVersionId,reason:v.reason,counterpartyRole:v.counterpartyRole,
      inventoryReleasePolicy:'only reservation owned by this Offer and Opportunity; restore recorded pre-block status only'},client);
    return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/offers/:offerId/bookings',async(req,res)=>{
  const checked=validateBookingCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const file=decodeAndValidateFile({...checked.value.evidence,maxBytes:10*1024*1024,
    allowedTypes:['application/pdf','image/jpeg','image/png']});
  if(file.error)return res.status(400).json({error:`Reservation evidence document is required: ${file.error}`});
  const extension=file.fileName.includes('.')?file.fileName.slice(file.fileName.lastIndexOf('.')):'';
  const storageKey=await savePrivate(file.buffer,extension);
  try{
    const result=await transaction(async client=>{
      const {offer,error}=await offerContext(req,req.params.offerId,client);if(error)return {code:error[0],error:error[1]};
      if(!canWriteOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {code:403,error:'Offer is outside your writable scope'};
      const lockedOffer=await one('SELECT * FROM offers WHERE id=$1 FOR UPDATE',[offer.id],client);
      if(lockedOffer.status!=='accepted'||!lockedOffer.acceptedRevisionId)return {code:409,error:'Record Customer/counterparty acceptance in Negotiation before creating a reservation'};
      const acceptedRevisionId=lockedOffer.acceptedRevisionId;
      const acceptedRevision=await one('SELECT id,deposit_amount,currency,validity_expires_at,document_version_id FROM offer_revisions WHERE id=$1 AND offer_id=$2',[acceptedRevisionId,offer.id],client);
      if(!acceptedRevision||new Date(acceptedRevision.validityExpiresAt)<=new Date())return {code:409,error:'The exact Offer revision has expired and cannot be accepted'};
      if(!acceptedRevision||acceptedRevision.depositAmount===null||Number(acceptedRevision.depositAmount)<=0)return {code:409,error:'The exact accepted offer revision has no positive deposit. Record the corrected commercial terms through a new governed Offer before reserving Inventory.'};
      const listing=offer.listingId?await requireLiveInventory(offer.listingId,offer.opportunityId,client):
        await one(`SELECT id,external_reference AS inventory_reference,project_or_building AS project,status,
          'approved_for_opportunity'::text AS inventory_status_before FROM provisional_external_properties
          WHERE id=$1 FOR UPDATE`,[offer.externalPropertyId],client);
      if(!listing)return {code:409,error:'The governed property record is sold, rented, administratively closed or no longer verified; CORE cannot create a customer reservation'};
      const assignment=offer.listingId?await one(`SELECT * FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
        AND state='active' AND starts_at<=NOW() AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[offer.opportunityId,offer.listingId],client):null;
      if(offer.listingId&&!assignment)return {code:409,error:'The exact Offer Inventory has no active unexpired assignment to this Opportunity'};
      const activeBooking=await one(`SELECT b.booking_reference,o.opportunity_reference,b.expires_at FROM bookings b
        JOIN opportunities o ON o.id=b.opportunity_id WHERE
        (b.listing_id=$1 OR b.external_property_id=$2) AND b.status='reserved'
        ORDER BY b.created_at DESC LIMIT 1 FOR UPDATE OF b`,[offer.listingId,offer.externalPropertyId],client);
      if(activeBooking)return {code:409,error:`Property is already reserved under ${activeBooking.bookingReference} for Opportunity ${activeBooking.opportunityReference} until ${new Date(activeBooking.expiresAt).toISOString()}. Release, expire or cancel that booking before creating another reservation`};
      const effectiveBefore=offer.listingId?(await one('SELECT nysa_inventory_effective_status($1) AS status',[offer.listingId],client)).status:listing.status;
      if(offer.listingId&&!['Available','Assigned'].includes(effectiveBefore))return {code:409,error:`Inventory is effectively ${effectiveBefore}; another current reservation or terminal closure blocks this Booking`};
      if(offer.externalPropertyId&&!['approved_for_opportunity','under_offer'].includes(listing.status))return {code:409,error:'External/co-broker property must remain approved for this Opportunity before reservation'};
      const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code,
        counter=await one(`INSERT INTO booking_number_counters(period_code,last_value) VALUES($1,1) ON CONFLICT(period_code)
          DO UPDATE SET last_value=booking_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client),
        bookingReference=`NYSA-BK-${period}-${String(counter.lastValue).padStart(6,'0')}`,
        documentId=uuid(),documentVersionId=uuid(),bookingId=uuid();
      await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,lead_id,listing_id)
        VALUES($1,$2,'reservation_evidence',$3,'Inbound','private','active',$4,$4,$5,$6,$7)`,
        [documentId,`DOC-${Date.now()}-${documentId.slice(0,8)}`,`Reservation evidence ${bookingReference}`,req.broker.id,offer.contactId,offer.leadId,offer.listingId],client);
      await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by,received_at)
        VALUES($1,$2,1,$3,$4,$5,$6,$7,1,'upload','private','received',$8,$8,NOW())`,
        [documentVersionId,documentId,file.fileName,checked.value.evidence.mediaType,file.buffer.length,storageKey,file.fileHash,req.broker.id],client);
      const booking=await one(`INSERT INTO bookings(id,booking_reference,opportunity_id,listing_id,external_property_id,offer_id,accepted_offer_revision_id,status,
        booking_amount,currency,refundable_state,reservation_starts_at,expires_at,evidence_document_version_id,inventory_status_before,owner_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,'reserved',$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [bookingId,bookingReference,offer.opportunityId,offer.listingId,offer.externalPropertyId,offer.id,acceptedRevision.id,Number(acceptedRevision.depositAmount),
          acceptedRevision.currency,checked.value.refundableState,checked.value.reservationStartsAt,checked.value.expiresAt,documentVersionId,
          offer.listingId?effectiveBefore:listing.status,offer.opportunityOwnerId,req.broker.id],client);
      await execute(`INSERT INTO booking_status_history(id,booking_id,to_status,reason,actor_id)
        VALUES($1,$2,'reserved','Explicit reservation created from accepted offer',$3)`,[uuid(),booking.id,req.broker.id],client);
      await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES
        ($1,$2,'Booking',$3,$4),($5,$2,'Opportunity',$6,$4),($7,$2,'Offer',$8,$4)`,
        [uuid(),documentId,booking.id,req.broker.id,uuid(),offer.opportunityId,uuid(),offer.id],client);
      if(offer.externalPropertyId)await execute("UPDATE provisional_external_properties SET status='reserved',updated_at=NOW() WHERE id=$1",[offer.externalPropertyId],client);
      if(assignment)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
        VALUES($1,$2,'reservation_won',$3,$4,$5::jsonb)`,[uuid(),assignment.id,'The accepted Offer revision was separately reserved through Booking',req.broker.id,
        JSON.stringify({bookingId:booking.id,offerId:offer.id,acceptedOfferRevisionId:acceptedRevision.id,expiresAt:booking.expiresAt})],client);
      await execute(`UPDATE opportunities SET stage='Booking',listing_id=$1,next_action_code='monitor_reservation',next_action='Monitor reservation expiry and complete booking requirements',next_action_notes=NULL,
        next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3`,[offer.listingId,checked.value.expiresAt,offer.opportunityId],client);
      if(offer.opportunityStage!=='Booking')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Booking','reservation_created',$4,$5)`,
        [uuid(),offer.opportunityId,offer.opportunityStage,`Reservation ${bookingReference} explicitly blocked inventory`,req.broker.id],client);
      await audit('Booking',booking.id,'reserved_from_accepted_offer',req.broker.id,{bookingReference,offerId:offer.id,acceptedOfferRevisionId:acceptedRevision.id,
        listingId:offer.listingId,externalPropertyId:offer.externalPropertyId,evidenceDocumentVersionId:documentVersionId,
        fileHash:file.fileHash,propertyStatusFrom:listing.status,propertyStatusTo:'reserved'},client);
      return booking;
    });
    if(result.error){await removePrivate(storageKey);return res.status(result.code).json({error:result.error});}
    res.status(201).json(result);
  }catch(error){
    await removePrivate(storageKey);
    if(error.code==='23505'){
      const activeBooking=await one(`SELECT b.booking_reference,o.opportunity_reference,b.expires_at FROM offers target
        JOIN bookings b ON b.status='reserved' AND (b.listing_id=target.listing_id OR b.offer_id=target.id)
        JOIN opportunities o ON o.id=b.opportunity_id WHERE target.id=$1 ORDER BY b.created_at DESC LIMIT 1`,[req.params.offerId]);
      if(activeBooking)return res.status(409).json({error:`Inventory is already reserved under ${activeBooking.bookingReference} for Opportunity ${activeBooking.opportunityReference} until ${new Date(activeBooking.expiresAt).toISOString()}. Open that Opportunity and ask its maintained manager to release, expire or cancel the reservation`});
      return res.status(409).json({error:'A reservation conflict was detected, but its owning record could not be resolved. Reload the Opportunity before retrying; CORE has not changed the inventory'});
    }
    throw error;
  }
});

r.post('/crm/bookings/:bookingId/status',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion);
  const result=await transaction(async client=>{
    const booking=await one(`SELECT b.*,o.owner_id AS opportunity_owner_id,o.created_by AS opportunity_created_by,
      o.assigned_team_id,o.stage AS opportunity_stage,
      CASE WHEN li.id IS NOT NULL THEN nysa_inventory_effective_status(li.id) ELSE ep.status END AS current_inventory_status
      FROM bookings b JOIN opportunities o ON o.id=b.opportunity_id LEFT JOIN listings li ON li.id=b.listing_id
      LEFT JOIN provisional_external_properties ep ON ep.id=b.external_property_id
      WHERE b.id=$1 FOR UPDATE OF b`,[req.params.bookingId],client);
    if(!booking)return {code:404,error:'Booking not found'};
    const opportunity=await opportunityWithParticipants(booking.opportunityId,client);
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Booking is outside your writable scope'};
    if(!isManager(req.broker))return {code:403,error:'Only the maintained manager for this Opportunity may release, expire or cancel its reservation'};
    const governedDeal=await one("SELECT * FROM deals WHERE booking_id=$1 AND status NOT IN ('closed_won','closed_lost') FOR UPDATE",[booking.id],client);
    if(booking.version!==expectedVersion)return {code:409,error:'This reservation changed after it was opened; reload before updating it'};
    if(!['Reserved','reserved'].includes(booking.currentInventoryStatus))return {code:409,error:`Property is ${booking.currentInventoryStatus}; resolve that status conflict before changing this reservation`};
    const checked=validateBookingTransition(booking.status,{...req.body,expiresAt:booking.expiresAt});
    if(checked.error)return {code:409,error:checked.error};
    const v=checked.value,column={released:'released_at',expired:'expired_at',cancelled:'cancelled_at'}[v.toStatus],
      updated=await one(`UPDATE bookings SET status=$1,release_reason=$2,${column}=NOW(),version=version+1,updated_at=NOW()
        WHERE id=$3 AND version=$4 RETURNING *`,[v.toStatus,v.reason,booking.id,booking.version],client);
    await execute(`INSERT INTO booking_status_history(id,booking_id,from_status,to_status,reason,actor_id)
      VALUES($1,$2,'reserved',$3,$4,$5)`,[uuid(),booking.id,v.toStatus,v.reason,req.broker.id],client);
    if(booking.externalPropertyId)await execute(`UPDATE provisional_external_properties SET status=$1,updated_at=NOW()
      WHERE id=$2 AND status='reserved'`,[booking.inventoryStatusBefore,booking.externalPropertyId],client);
    const assignment=booking.listingId?await one(`SELECT * FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2 AND state='active'
      ORDER BY created_at DESC LIMIT 1`,[booking.opportunityId,booking.listingId],client):null;
    if(assignment){const assignmentState=v.toStatus==='expired'?'expired':'delinked';
      await execute(`UPDATE inventory_assignments SET state=$1,ended_at=NOW(),end_reason=$2 WHERE id=$3 AND state='active'`,
        [assignmentState,v.reason||`Reservation ${v.toStatus}`,assignment.id],client);
      await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
        VALUES($1,$2,'reservation_released',$3,$4,$5::jsonb)`,[uuid(),assignment.id,v.reason||`Reservation ${v.toStatus}`,req.broker.id,
        JSON.stringify({bookingId:booking.id,toStatus:v.toStatus,assignmentState})],client);
    }
    const restoredStatus=booking.listingId?(await one('SELECT nysa_inventory_effective_status($1) AS status',[booking.listingId],client)).status:booking.inventoryStatusBefore;
    if(governedDeal){const linkageId=uuid();await execute(`INSERT INTO deal_inventory_linkages(id,deal_id,opportunity_id,predecessor_linkage_id,change_kind,reason,created_by)
      VALUES($1,$2,$3,$4,'detached',$5,$6)`,[linkageId,governedDeal.id,governedDeal.opportunityId,governedDeal.currentInventoryLinkageId,v.reason||`Reservation ${v.toStatus}`,req.broker.id],client);
      await execute(`UPDATE deals SET current_inventory_linkage_id=$1,listing_id=NULL,external_property_id=NULL,offer_id=NULL,
        accepted_offer_revision_id=NULL,booking_id=NULL,version=version+1,updated_at=NOW() WHERE id=$2`,[linkageId,governedDeal.id],client);}
    await execute(`UPDATE opportunities SET stage='Negotiation',next_action_code='follow_up_offer_feedback',next_action=$1,next_action_notes=$1,next_action_due_at=NOW()+INTERVAL '1 day',
      version=version+1,updated_at=NOW() WHERE id=$2`,
      [`Reservation ${v.toStatus}; review accepted offer and next customer action`,booking.opportunityId],client);
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,'Negotiation',$4,$5,$6)`,
      [uuid(),booking.opportunityId,booking.opportunityStage,`reservation_${v.toStatus}`,v.reason||`Reservation reached ${v.toStatus}`,req.broker.id],client);
    await audit('BookingStatus',booking.id,v.toStatus,req.broker.id,{from:'reserved',to:v.toStatus,reason:v.reason,
      listingId:booking.listingId,externalPropertyId:booking.externalPropertyId,
      propertyStatusFrom:'reserved',propertyStatusTo:restoredStatus},client);
    return {...updated,dealId:governedDeal?.id||null,dealRetained:Boolean(governedDeal)};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/bookings/:bookingId/extensions',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion);
  const result=await transaction(async client=>{
    const booking=await one(`SELECT b.*,o.owner_id AS opportunity_owner_id,o.created_by AS opportunity_created_by,
      o.assigned_team_id FROM bookings b JOIN opportunities o ON o.id=b.opportunity_id
      WHERE b.id=$1 FOR UPDATE OF b`,[req.params.bookingId],client);
    if(!booking)return {code:404,error:'Booking not found'};
    const opportunity=await opportunityWithParticipants(booking.opportunityId,client);
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Booking is outside your writable scope'};
    if(!isManager(req.broker))return {code:403,error:'Only the maintained manager for this Opportunity may approve a reservation extension'};
    if(booking.version!==expectedVersion)return {code:409,error:'This reservation changed after it was opened; reload before extending it'};
    const checked=validateBookingExtension(booking,req.body||{});if(checked.error)return {code:409,error:checked.error};
    const extensionId=uuid(),v=checked.value;
    await execute(`INSERT INTO booking_reservation_extensions(id,booking_id,previous_expires_at,approved_expires_at,approval_reason,approved_by)
      VALUES($1,$2,$3,$4,$5,$6)`,[extensionId,booking.id,booking.expiresAt,v.expiresAt,v.reason,req.broker.id],client);
    const updated=await one(`UPDATE bookings SET expires_at=$1,version=version+1,updated_at=NOW()
      WHERE id=$2 AND version=$3 RETURNING *`,[v.expiresAt,booking.id,booking.version],client);
    await audit('Booking',booking.id,'reservation_extended',req.broker.id,{extensionId,previousExpiresAt:booking.expiresAt,
      approvedExpiresAt:v.expiresAt,reservationStartsAt:booking.reservationStartsAt,cumulativeMaximumDays:14,reason:v.reason},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.get('/crm/opportunities/:id/deal-party-options',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const contactParams=[],contactScope=contactScopeSql('c',req.broker,contactParams),companyParams=[],companyScope=companyScopeSql('co',req.broker,companyParams);
  const [contacts,companies,counterparties]=await Promise.all([
    many(`SELECT c.id,c.full_name,c.email,c.phone FROM contacts c WHERE c.archived_at IS NULL AND ${contactScope.clause} ORDER BY c.full_name`,contactScope.params),
    many(`SELECT co.id,co.name,co.email,co.phone FROM companies co WHERE co.status='active' AND ${companyScope.clause} ORDER BY co.name`,companyScope.params),
    many(`SELECT id,display_name,email,phone,role,party_type FROM transaction_counterparties ORDER BY display_name`)
  ]);
  if(opportunity.contactId&&!contacts.some(x=>x.id===opportunity.contactId))contacts.unshift({id:opportunity.contactId,fullName:opportunity.contactName,email:opportunity.contactEmail,phone:opportunity.contactPhone});
  res.json({contacts,companies,counterparties});
});

r.post('/crm/bookings/:bookingId/deal',async(req,res)=>{
  const result=await transaction(async client=>{
    const booking=await one(`SELECT b.*,o.owner_id AS opportunity_owner_id,o.created_by AS opportunity_created_by,o.assigned_team_id,
      o.stage AS opportunity_stage,o.contact_id,COALESCE(c.full_name,buyer.display_name) AS contact_name,
      o.buyer_counterparty_id,o.seller_counterparty_id,
      seller.display_name AS seller_name,seller.role AS seller_role,seller.source AS seller_source,seller.evidence_reference AS seller_evidence,
      f.offer_type,r.amount AS accepted_amount,r.currency AS accepted_currency
      FROM bookings b JOIN opportunities o ON o.id=b.opportunity_id LEFT JOIN contacts c ON c.id=o.contact_id
      LEFT JOIN transaction_counterparties buyer ON buyer.id=o.buyer_counterparty_id
      LEFT JOIN transaction_counterparties seller ON seller.id=o.seller_counterparty_id
      JOIN offers f ON f.id=b.offer_id JOIN offer_revisions r ON r.id=b.accepted_offer_revision_id
      WHERE b.id=$1 FOR UPDATE OF b,o`,[req.params.bookingId],client);
    if(!booking)return{code:404,error:'Booking not found'};
    const opportunity=await opportunityWithParticipants(booking.opportunityId,client);
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Booking is outside your writable scope'};
    if(booking.status!=='reserved')return{code:409,error:'A Deal can only start from an active governed reservation'};
    const existing=await one('SELECT * FROM deals WHERE opportunity_id=$1 OR booking_id=$2 FOR UPDATE',[booking.opportunityId,booking.id],client);
    if(existing?.bookingId===booking.id)return{code:409,error:`Deal ${existing.dealReference} already governs this reservation`};
    const checked=validateDealCreate(req.body||{},{offerType:booking.offerType,agreedValue:booking.acceptedAmount,currency:booking.acceptedCurrency});
    if(checked.error)return{code:400,error:checked.error};
    const assignment=booking.listingId?await one(`SELECT * FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2
      AND state='active' AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1`,[booking.opportunityId,booking.listingId],client):null;
    if(booking.listingId&&!assignment)return{code:409,error:'The Booking Inventory no longer has an active assignment'};
    if(existing){
      if(['closed_won','closed_lost'].includes(existing.status))return{code:409,error:`Deal ${existing.dealReference} is already ${existing.status.replaceAll('_',' ')}`};
      if(existing.bookingId||existing.listingId||existing.offerId)return{code:409,error:`Deal ${existing.dealReference} still has a current Inventory lineage. Release or expire that reservation before linking a replacement`};
      const linkageId=uuid(),v=checked.value;
      await execute(`INSERT INTO deal_inventory_linkages(id,deal_id,opportunity_id,assignment_id,listing_id,external_property_id,
        offer_id,accepted_offer_revision_id,booking_id,predecessor_linkage_id,change_kind,reason,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'booking_switched','Replacement Inventory accepted and reserved; stable Deal retained',$11)`,
        [linkageId,existing.id,booking.opportunityId,assignment?.id||null,booking.listingId,booking.externalPropertyId,booking.offerId,
          booking.acceptedOfferRevisionId,booking.id,existing.currentInventoryLinkageId,req.broker.id],client);
      const retained=await one(`UPDATE deals SET current_inventory_linkage_id=$1,booking_id=$2,listing_id=$3,external_property_id=$4,
        offer_id=$5,accepted_offer_revision_id=$6,agreed_value=$7,currency=$8,target_completion_at=$9,
        version=version+1,updated_at=NOW() WHERE id=$10 RETURNING *`,[linkageId,booking.id,booking.listingId,
        booking.externalPropertyId,booking.offerId,booking.acceptedOfferRevisionId,v.agreedValue,v.currency,v.targetCompletionAt,existing.id],client);
      await execute(`UPDATE opportunities SET stage='Deal',next_action_code='complete_deal',next_action='Complete mandatory Deal parties and completion checklist',
        next_action_notes='Stable Deal retained after replacement Inventory reservation',next_action_due_at=$1,version=version+1,updated_at=NOW() WHERE id=$2`,
        [v.targetCompletionAt,booking.opportunityId],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Deal','replacement_booking_linked',$4,$5)`,[uuid(),booking.opportunityId,booking.opportunityStage,
        `Deal ${existing.dealReference} retained; Booking ${booking.bookingReference} became current`,req.broker.id],client);
      await audit('DealInventoryLinkage',linkageId,'booking_switched',req.broker.id,{dealId:existing.id,dealReference:existing.dealReference,
        predecessorLinkageId:existing.currentInventoryLinkageId,assignmentId:assignment?.id||null,listingId:booking.listingId,
        offerId:booking.offerId,acceptedOfferRevisionId:booking.acceptedOfferRevisionId,bookingId:booking.id},client);
      return {...retained,dealRetained:true};
    }
    const template=await one("SELECT * FROM checklist_templates WHERE deal_type=$1 AND status='approved'",[checked.value.dealType],client);
    if(!template)return{code:409,error:`No approved completion checklist exists for ${checked.value.dealType.replaceAll('_',' ')}`};
    const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code;
    const counter=await one(`INSERT INTO deal_number_counters(period_code,last_value) VALUES($1,1) ON CONFLICT(period_code)
      DO UPDATE SET last_value=deal_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client);
    const dealId=uuid(),dealReference=`NYSA-DL-${period}-${String(counter.lastValue).padStart(6,'0')}`,v=checked.value;
    if(!booking.sellerCounterpartyId&&booking.listingId){
      const inherited=await inheritInventoryOwner(booking.listingId,v.dealType,req.broker.id,client);
      if(inherited){
        booking.sellerCounterpartyId=inherited.counterparty.id;booking.sellerName=inherited.counterparty.displayName;
        booking.sellerRole=inherited.counterparty.role;booking.sellerSource=inherited.counterparty.source;
        booking.sellerEvidence=inherited.counterparty.evidenceReference;
        await execute('UPDATE opportunities SET seller_counterparty_id=$1,version=version+1,updated_at=NOW() WHERE id=$2',
          [booking.sellerCounterpartyId,booking.opportunityId],client);
      }
    }
    let deal=await one(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [dealId,dealReference,booking.opportunityId,v.dealType,v.agreedValue,v.currency,v.targetCompletionAt,booking.opportunityOwnerId,req.broker.id],client);
    const linkageId=uuid();await execute(`INSERT INTO deal_inventory_linkages(id,deal_id,opportunity_id,assignment_id,listing_id,external_property_id,
      offer_id,accepted_offer_revision_id,booking_id,change_kind,reason,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'attached','Initial Deal linkage from exact accepted Offer and Booking',$10)`,
      [linkageId,dealId,booking.opportunityId,assignment?.id||null,booking.listingId,booking.externalPropertyId,booking.offerId,booking.acceptedOfferRevisionId,booking.id,req.broker.id],client);
    deal=await one(`UPDATE deals SET current_inventory_linkage_id=$1,booking_id=$2,listing_id=$3,external_property_id=$4,
      offer_id=$5,accepted_offer_revision_id=$6 WHERE id=$7 RETURNING *`,[linkageId,booking.id,booking.listingId,booking.externalPropertyId,
      booking.offerId,booking.acceptedOfferRevisionId,dealId],client);
    const customerRole=['rental','commercial_rental'].includes(v.dealType)?'tenant':'buyer',side='buyer_side';
    await execute(`INSERT INTO deal_parties(id,deal_id,contact_id,transaction_counterparty_id,party_role,side,representation,is_primary,source_evidence,created_by)
      VALUES($1,$2,$3,$4,$5,$6,'direct',TRUE,$7,$8)`,
      [uuid(),dealId,booking.contactId,booking.contactId?null:booking.buyerCounterpartyId,customerRole,side,
        `Originating Opportunity buyer/tenant: ${booking.contactName}`,req.broker.id],client);
    if(booking.sellerCounterpartyId)await execute(`INSERT INTO deal_parties
      (id,deal_id,transaction_counterparty_id,party_role,side,representation,is_primary,source_evidence,created_by)
      VALUES($1,$2,$3,$4,'seller_side','direct',TRUE,$5,$6)`,
      [uuid(),dealId,booking.sellerCounterpartyId,booking.sellerRole==='landlord'?'landlord':'seller',
        `Inherited from selected NYSA Inventory: ${booking.sellerName}; ${booking.sellerSource}; ${booking.sellerEvidence}`,req.broker.id],client);
    const checklistId=uuid();
    await execute(`INSERT INTO deal_checklists(id,deal_id,template_id,template_version_no) VALUES($1,$2,$3,$4)`,
      [checklistId,dealId,template.id,template.versionNo],client);
    await execute(`INSERT INTO deal_checklist_items(id,deal_checklist_id,template_item_id,item_code,label,responsible_role,required,evidence_required,display_order)
      SELECT gen_random_uuid(),$1,id,item_code,label,responsible_role,required,evidence_required,display_order
      FROM checklist_template_items WHERE template_id=$2 ORDER BY display_order`,[checklistId,template.id],client);
    await execute(`INSERT INTO deal_status_history(id,deal_id,to_status,reason,actor_id)
      VALUES($1,$2,'draft','Governed Deal created from active reservation and exact accepted offer revision',$3)`,[uuid(),dealId,req.broker.id],client);
    await execute(`UPDATE opportunities SET stage='Deal',next_action_code='complete_deal',next_action='Complete mandatory Deal parties and completion checklist',next_action_notes=NULL,
      next_action_due_at=$1,version=version+1,updated_at=NOW() WHERE id=$2`,[v.targetCompletionAt,booking.opportunityId],client);
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,'Deal','deal_created',$4,$5)`,
      [uuid(),booking.opportunityId,booking.opportunityStage,`Deal ${dealReference} created from active reservation`,req.broker.id],client);
    await audit('Deal',dealId,'created',req.broker.id,{dealReference,bookingId:booking.id,acceptedOfferRevisionId:booking.acceptedOfferRevisionId,
      checklistTemplateId:template.id,checklistTemplateVersion:template.versionNo},client);
    return deal;
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.status(201).json(result);
});

r.post('/crm/deals/:dealId/parties',async(req,res)=>{
  const checked=validateDealParty(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{const result=await transaction(async client=>{
    const deal=await one('SELECT * FROM deals WHERE id=$1',[req.params.dealId],client);if(!deal)return{code:404,error:'Deal not found'};
    const {opportunity,error}=await scopedOpportunity(req,deal.opportunityId,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Deal is outside your writable scope'};
    if(!['draft','completion_in_progress'].includes(deal.status))return{code:409,error:'Parties cannot be changed after the Deal enters approval'};
    const v=checked.value;
    if(v.contactId){const params=[v.contactId],scope=contactScopeSql('c',req.broker,params);
      if(!await one(`SELECT c.id FROM contacts c WHERE c.id=$1 AND c.archived_at IS NULL AND ${scope.clause}`,scope.params,client))return{code:400,error:'Selected Contact is unavailable or outside your scope'};}
    if(v.companyId){const params=[v.companyId],scope=companyScopeSql('co',req.broker,params);
      if(!await one(`SELECT co.id FROM companies co WHERE co.id=$1 AND co.status='active' AND ${scope.clause}`,scope.params,client))return{code:400,error:'Selected Company is unavailable or outside your scope'};}
    if(v.transactionCounterpartyId&&!await one('SELECT id FROM transaction_counterparties WHERE id=$1',[v.transactionCounterpartyId],client))return{code:400,error:'Transaction-only counterparty is unavailable'};
    const party=await one(`INSERT INTO deal_parties(id,deal_id,contact_id,company_id,transaction_counterparty_id,party_role,side,representation,is_primary,source_evidence,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [uuid(),deal.id,v.contactId,v.companyId,v.transactionCounterpartyId,v.partyRole,v.side,v.representation,v.isPrimary,v.sourceEvidence,req.broker.id],client);
    await execute("UPDATE deals SET status='completion_in_progress',version=version+1,updated_at=NOW() WHERE id=$1 AND status='draft'",[deal.id],client);
    await audit('DealParty',party.id,'added',req.broker.id,{dealId:deal.id,partyRole:v.partyRole,side:v.side,contactId:v.contactId,companyId:v.companyId,transactionCounterpartyId:v.transactionCounterpartyId},client);
    return party;
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'That active party and role are already recorded for this Deal'});throw error;}
});

r.patch('/crm/deals/:dealId/checklist-items/:itemId',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),status=req.body?.status,evidenceReference=clean(req.body?.evidenceReference);
  if(!['completed','pending'].includes(status))return res.status(400).json({error:'Select completed or pending'});
  const result=await transaction(async client=>{
    const deal=await one('SELECT * FROM deals WHERE id=$1',[req.params.dealId],client);if(!deal)return{code:404,error:'Deal not found'};
    const {opportunity,error}=await scopedOpportunity(req,deal.opportunityId,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity)&&req.broker.jobRole!=='director')return{code:403,error:'Deal is outside your writable scope'};
    if(!['draft','completion_in_progress'].includes(deal.status))return{code:409,error:'Checklist evidence is locked after closure approval'};
    const item=await one(`SELECT i.* FROM deal_checklist_items i JOIN deal_checklists c ON c.id=i.deal_checklist_id
      WHERE i.id=$1 AND c.deal_id=$2 FOR UPDATE OF i`,[req.params.itemId,deal.id],client);
    if(!item)return{code:404,error:'Checklist item not found'};
    if(item.version!==expectedVersion)return{code:409,error:'This checklist item changed after it was opened; reload before updating it'};
    const roleAllowed=item.responsibleRole==='sales_agent'?['sales_agent','manager'].includes(req.broker.jobRole):item.responsibleRole===req.broker.jobRole;
    if(!roleAllowed)return{code:403,error:`This item is assigned to the ${item.responsibleRole.replaceAll('_',' ')} role`};
    if(status==='completed'&&item.evidenceRequired&&!evidenceReference)return{code:400,error:'Evidence reference is required to complete this item'};
    if(status==='completed'&&['manager','director'].includes(item.responsibleRole)){
      const parties=await many('SELECT party_role FROM deal_parties WHERE deal_id=$1 AND effective_to IS NULL',[deal.id],client);
      const present=new Set(parties.map(x=>x.partyRole)),missing=(REQUIRED_PARTIES[deal.dealType]||[]).filter(role=>!present.has(role));
      if(missing.length)return{code:409,error:`Complete mandatory transaction parties before management review: ${missing.join(', ')}`};
    }
    const updated=await one(`UPDATE deal_checklist_items SET status=$1,evidence_reference=$2,
      completed_by=CASE WHEN $1='completed' THEN $3::uuid ELSE NULL END,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE NULL END,
      version=version+1 WHERE id=$4 AND version=$5 RETURNING *`,
      [status,status==='completed'?evidenceReference:null,req.broker.id,item.id,item.version],client);
    await execute("UPDATE deals SET status='completion_in_progress',version=version+1,updated_at=NOW() WHERE id=$1 AND status='draft'",[deal.id],client);
    await audit('DealChecklistItem',item.id,status,req.broker.id,{dealId:deal.id,evidenceReference:status==='completed'?evidenceReference:null},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/deals/:dealId/approval',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),decision=clean(req.body?.decision)||'approved',checked=validateDealApproval(req.body||{});
  if(!['approved','returned'].includes(decision))return res.status(400).json({error:'Select approve or return for correction'});
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Deal version is required'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const deal=await one(`SELECT d.*,b.status AS booking_status FROM deals d JOIN bookings b ON b.id=d.booking_id
      WHERE d.id=$1 FOR UPDATE OF d,b`,[req.params.dealId],client);
    if(!deal)return{code:404,error:'Deal not found'};
    const opportunity=await opportunityWithParticipants(deal.opportunityId,client);
    if(!opportunity||!canReadOpportunity(req.broker,opportunity))return{code:403,error:'Deal is outside your permitted scope'};
    if(!canApproveDeal(req.broker,opportunity,deal))return{code:403,error:['commercial_sale','commercial_rental'].includes(deal.dealType)?
      'Commercial Deal closure approval requires a Director':'Only the managed-team Manager or a Director may approve this Deal for closure'};
    if(!['draft','completion_in_progress'].includes(deal.status))return{code:409,error:`Deal is already ${deal.status.replaceAll('_',' ')}`};
    if(deal.version!==expectedVersion)return{code:409,error:'This Deal changed after it was opened; reload before approving'};
    if(decision!=='approved'){
      const updated=await one(`UPDATE deals SET status='completion_in_progress',approved_by=NULL,approved_at=NULL,
        approval_reason=NULL,approval_evidence_reference=NULL,version=version+1,updated_at=NOW()
        WHERE id=$1 AND version=$2 RETURNING *`,[deal.id,expectedVersion],client);
      if(!updated)return{code:409,error:'This completion record changed after it was opened; reload before deciding'};
      await execute(`INSERT INTO deal_status_history(id,deal_id,from_status,to_status,reason,actor_id)
        VALUES($1,$2,$3,'completion_in_progress',$4,$5)`,[uuid(),deal.id,deal.status,`${decision}: ${checked.value.reason}`,req.broker.id],client);
      await audit('DealStatus',deal.id,'closure_returned',req.broker.id,
        {opportunityId:deal.opportunityId,evidenceReference:checked.value.evidenceReference,reason:checked.value.reason,version:updated.version},client);
      return updated;
    }
    const documentCompliance=await requireDocumentComplianceGates({dealId:deal.id,gateCodes:['before_pending_approval','before_approval'],client});
    if(!documentCompliance.canProceed)return{code:409,error:`Required document compliance is incomplete: ${documentCompliance.blocking.map(x=>`${x.label} (${x.state.replaceAll('_',' ')})`).join('; ')}`};
    const [parties,items]=await Promise.all([
      many('SELECT * FROM deal_parties WHERE deal_id=$1 AND effective_to IS NULL',[deal.id],client),
      many(`SELECT i.* FROM deal_checklist_items i JOIN deal_checklists c ON c.id=i.deal_checklist_id
        WHERE c.deal_id=$1 ORDER BY i.display_order`,[deal.id],client)
    ]);
    const blockers=dealClosureGates({deal,parties,items}).filter(x=>['terms','reservation','parties','checklist'].includes(x.code)&&!x.complete);
    if(blockers.length)return{code:409,error:`Deal is not ready for closure approval: ${blockers.map(x=>x.label).join('; ')}`};
    const updated=await one(`UPDATE deals SET status='approved',approved_by=$1,approved_at=NOW(),approval_reason=$2,
      approval_evidence_reference=$3,version=version+1,updated_at=NOW()
      WHERE id=$4 AND version=$5 RETURNING *`,
      [req.broker.id,checked.value.reason,checked.value.evidenceReference,deal.id,expectedVersion],client);
    if(!updated)return{code:409,error:'This Deal changed after it was opened; reload before approving'};
    await execute("UPDATE deal_checklists SET status='approved' WHERE deal_id=$1",[deal.id],client);
    await execute(`INSERT INTO deal_status_history(id,deal_id,from_status,to_status,reason,actor_id)
      VALUES($1,$2,$3,'approved',$4,$5)`,[uuid(),deal.id,deal.status,checked.value.reason,req.broker.id],client);
    await audit('DealStatus',deal.id,'closure_approved',req.broker.id,{opportunityId:deal.opportunityId,
      evidenceReference:checked.value.evidenceReference,reason:checked.value.reason,version:updated.version},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/deals/:dealId/close-won',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),checked=validateDealCloseWon(req.body||{});
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Deal version is required'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const deal=await one(`SELECT d.*,b.status AS booking_status,b.version AS booking_version,
      o.stage AS opportunity_stage,o.version AS opportunity_version,
      CASE WHEN li.id IS NOT NULL THEN nysa_inventory_effective_status(li.id) ELSE ep.status END AS listing_status
      FROM deals d JOIN bookings b ON b.id=d.booking_id JOIN opportunities o ON o.id=d.opportunity_id
      LEFT JOIN listings li ON li.id=d.listing_id LEFT JOIN provisional_external_properties ep ON ep.id=d.external_property_id
      WHERE d.id=$1 FOR UPDATE OF d,b,o`,[req.params.dealId],client);
    if(!deal)return{code:404,error:'Deal not found'};
    const opportunity=await opportunityWithParticipants(deal.opportunityId,client);
    if(!opportunity||!canReadOpportunity(req.broker,opportunity))return{code:403,error:'Deal is outside your permitted scope'};
    if(!canApproveDeal(req.broker,opportunity,deal))return{code:403,error:['commercial_sale','commercial_rental'].includes(deal.dealType)?
      'Commercial Deal closure requires a Director':'Only the managed-team Manager or a Director may close this Deal'};
    if(deal.status!=='approved')return{code:409,error:'The Deal requires a separate recorded closure approval before Closed Won'};
    if(deal.version!==expectedVersion)return{code:409,error:'This Deal changed after it was opened; reload before closing'};
    const documentCompliance=await requireDocumentComplianceGates({dealId:deal.id,gateCodes:['before_close_won'],client});
    if(!documentCompliance.canProceed)return{code:409,error:`Required document compliance is incomplete: ${documentCompliance.blocking.map(x=>`${x.label} (${x.state.replaceAll('_',' ')})`).join('; ')}`};
    const commissionReceiptReady=await one(`SELECT c.id FROM deal_commission_receipt_confirmations c
      JOIN deal_commission_expectation_versions e ON e.id=c.expectation_version_id
      WHERE c.deal_id=$1 AND c.status='confirmed' AND c.deal_version=$2 AND e.status='frozen'
        AND (c.variance_amount=0 OR EXISTS(SELECT 1 FROM deal_commission_variance_decisions v
          WHERE v.confirmation_id=c.id AND v.decision='approved')) LIMIT 1`,[deal.id,deal.version],client);
    if(!commissionReceiptReady)return{code:409,error:'Confirmed actual commission receipt is required before Close Won'};
    if(deal.bookingStatus!=='reserved'||!['Reserved','reserved'].includes(deal.listingStatus)||deal.opportunityStage!=='Deal')
      return{code:409,error:`Closure records are not aligned: Booking ${deal.bookingStatus}, property ${deal.listingStatus}, Opportunity ${deal.opportunityStage}`};
    const v=checked.value,inventoryOutcome=['rental','commercial_rental'].includes(deal.dealType)?'Rented':'Sold';
    const updated=await one(`UPDATE deals SET status='closed_won',actual_completion_at=$1,closed_by=$2,closed_at=NOW(),
      closed_reason=$3,closure_evidence_reference=$4,version=version+1,updated_at=NOW()
      WHERE id=$5 AND version=$6 RETURNING *`,
      [v.actualCompletionAt,req.broker.id,v.completionNote,v.evidenceReference,deal.id,expectedVersion],client);
    if(!updated)return{code:409,error:'This Deal changed after it was opened; reload before closing'};
    await execute(`UPDATE bookings SET status='completed',completed_at=NOW(),version=version+1,updated_at=NOW()
      WHERE id=$1 AND status='reserved'`,[deal.bookingId],client);
    await execute(`INSERT INTO booking_status_history(id,booking_id,from_status,to_status,reason,actor_id)
      VALUES($1,$2,'reserved','completed',$3,$4)`,[uuid(),deal.bookingId,`Completed through ${deal.dealReference}`,req.broker.id],client);
    if(deal.listingId)await execute(`UPDATE listings SET status=$1,closed_reason=$1,closed_at=NOW(),updated_at=NOW()
      WHERE id=$2 AND status NOT IN ('Closed','Sold','Rented')`,[inventoryOutcome,deal.listingId],client);
    if(deal.listingId){const closedAssignments=await many(`UPDATE inventory_assignments SET state='closed',ended_at=NOW(),
      end_reason=$1 WHERE listing_id=$2 AND state='active' RETURNING id`,[`Inventory ${inventoryOutcome} through Deal ${deal.dealReference}`,deal.listingId],client);
      for(const assignment of closedAssignments)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
        VALUES($1,$2,'closed',$3,$4,$5::jsonb)`,[uuid(),assignment.id,`Inventory ${inventoryOutcome} through Deal ${deal.dealReference}`,req.broker.id,
        JSON.stringify({dealId:deal.id,outcome:inventoryOutcome})],client);}
    else await execute(`UPDATE provisional_external_properties SET status='closed',updated_at=NOW()
      WHERE id=$1 AND status='reserved'`,[deal.externalPropertyId],client);
    await execute(`UPDATE opportunities SET stage='Closed Won',next_action_code='closed_won',next_action='Deal completed and authoritatively closed won',next_action_notes=NULL,
      next_action_due_at=$1,closed_at=NOW(),version=version+1,updated_at=NOW()
      WHERE id=$2 AND stage='Deal'`,[v.actualCompletionAt,deal.opportunityId],client);
    const stageHistoryId=uuid();
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Deal','Closed Won','deal_completed',$3,$4)`,
      [stageHistoryId,deal.opportunityId,v.completionNote,req.broker.id],client);
    await execute(`INSERT INTO deal_status_history(id,deal_id,from_status,to_status,reason,actor_id)
      VALUES($1,$2,'approved','closed_won',$3,$4)`,[uuid(),deal.id,v.completionNote,req.broker.id],client);
    await audit('DealStatus',deal.id,'closed_won',req.broker.id,{opportunityId:deal.opportunityId,bookingId:deal.bookingId,
      listingId:deal.listingId,externalPropertyId:deal.externalPropertyId,acceptedOfferRevisionId:deal.acceptedOfferRevisionId,actualCompletionAt:v.actualCompletionAt,
      evidenceReference:v.evidenceReference,inventoryOutcome},client);
    await audit('OpportunityStage',stageHistoryId,'changed',req.broker.id,{opportunityId:deal.opportunityId,from:'Deal',to:'Closed Won',
      reasonCode:'deal_completed',dealId:deal.id},client);
    await audit('BookingStatus',deal.bookingId,'completed',req.broker.id,{dealId:deal.id,from:'reserved',to:'completed'},client);
    if(deal.listingId)await audit('Listing',deal.listingId,'closed_from_deal',req.broker.id,{dealId:deal.id,from:'Reserved',to:inventoryOutcome,closedReason:inventoryOutcome},client);
    else await audit('ExternalProperty',deal.externalPropertyId,'closed_from_deal',req.broker.id,{dealId:deal.id,from:'reserved',to:'closed'},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/deals/:dealId/close-lost',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),checked=validateDealCloseLost(req.body||{});
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Deal version is required'});
  if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const deal=await one(`SELECT d.*,b.status AS booking_status,b.inventory_status_before,
      o.stage AS opportunity_stage,current_link.change_kind AS current_linkage_kind,
      CASE WHEN li.id IS NOT NULL THEN nysa_inventory_effective_status(li.id) ELSE ep.status END AS listing_status
      FROM deals d JOIN opportunities o ON o.id=d.opportunity_id
      LEFT JOIN bookings b ON b.id=d.booking_id
      LEFT JOIN deal_inventory_linkages current_link ON current_link.id=d.current_inventory_linkage_id
      LEFT JOIN listings li ON li.id=d.listing_id LEFT JOIN provisional_external_properties ep ON ep.id=d.external_property_id
      WHERE d.id=$1 FOR UPDATE OF d,o`,[req.params.dealId],client);
    if(!deal)return{code:404,error:'Deal not found'};
    const opportunity=await opportunityWithParticipants(deal.opportunityId,client);
    if(!opportunity||!canReadOpportunity(req.broker,opportunity))return{code:403,error:'Deal is outside your permitted scope'};
    if(!canApproveDeal(req.broker,opportunity,deal))return{code:403,error:['commercial_sale','commercial_rental'].includes(deal.dealType)?
      'Closing a commercial Deal lost requires a Director':'Only the managed-team Manager or a Director may close this Deal lost'};
    if(!['draft','completion_in_progress','approved'].includes(deal.status))return{code:409,error:`Deal is already ${deal.status.replaceAll('_',' ')}`};
    if(deal.version!==expectedVersion)return{code:409,error:'This Deal changed after it was opened; reload before closing'};
    const lockedBooking=deal.bookingId?await one('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[deal.bookingId],client):null;
    if(deal.opportunityStage!=='Deal'||(deal.bookingId&&(!lockedBooking||lockedBooking.status!=='reserved'||!['Reserved','reserved'].includes(deal.listingStatus)))||
      (!deal.bookingId&&deal.currentLinkageKind!=='detached'))
      return{code:409,error:`Closure records are not aligned: Booking ${lockedBooking?.status||'detached'}, property ${deal.listingStatus||'detached'}, Opportunity ${deal.opportunityStage}`};
    const v=checked.value;
    const updated=await one(`UPDATE deals SET status='closed_lost',closed_by=$1,closed_at=NOW(),
      closed_reason=$2,closure_evidence_reference=$3,version=version+1,updated_at=NOW()
      WHERE id=$4 AND version=$5 RETURNING *`,
      [req.broker.id,`${v.reasonCode}: ${v.reason}`,v.evidenceReference,deal.id,expectedVersion],client);
    if(!updated)return{code:409,error:'This Deal changed after it was opened; reload before closing'};
    if(lockedBooking){await execute(`UPDATE bookings SET status='cancelled',cancelled_at=NOW(),release_reason=$1,version=version+1,updated_at=NOW()
      WHERE id=$2 AND status='reserved'`,[v.reason,deal.bookingId],client);
      await execute(`INSERT INTO booking_status_history(id,booking_id,from_status,to_status,reason,actor_id)
        VALUES($1,$2,'reserved','cancelled',$3,$4)`,[uuid(),deal.bookingId,v.reason,req.broker.id],client);}
    const closedAssignments=await many(`UPDATE inventory_assignments SET state='closed',ended_at=NOW(),end_reason=$1
      WHERE opportunity_id=$2 AND state='active' RETURNING id,listing_id`,[v.reason,deal.opportunityId],client);
    for(const assignment of closedAssignments)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
      VALUES($1,$2,'closed',$3,$4,$5::jsonb)`,[uuid(),assignment.id,v.reason,req.broker.id,JSON.stringify({dealId:deal.id,outcome:'closed_lost'})],client);
    const restoredStatus=deal.listingId?(await one('SELECT nysa_inventory_effective_status($1) AS status',[deal.listingId],client)).status:deal.inventoryStatusBefore;
    if(deal.externalPropertyId)await execute(`UPDATE provisional_external_properties SET status=$1,updated_at=NOW()
      WHERE id=$2 AND status='reserved'`,[restoredStatus,deal.externalPropertyId],client);
    await execute(`UPDATE opportunities SET stage='Closed Lost',lost_reason_code=$1,lost_reason=$2,
      next_action_code='closed_lost',next_action='Transaction closed lost',next_action_notes=$2,next_action_due_at=NOW(),closed_at=NOW(),version=version+1,updated_at=NOW()
      WHERE id=$3 AND stage='Deal'`,[v.reasonCode==='customer_withdrew'?'customer_withdrew':'other',v.reason,deal.opportunityId],client);
    const stageHistoryId=uuid();
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Deal','Closed Lost',$3,$4,$5)`,
      [stageHistoryId,deal.opportunityId,v.reasonCode,v.reason,req.broker.id],client);
    await execute(`INSERT INTO deal_status_history(id,deal_id,from_status,to_status,reason,actor_id)
      VALUES($1,$2,$3,'closed_lost',$4,$5)`,[uuid(),deal.id,deal.status,v.reason,req.broker.id],client);
    await audit('DealStatus',deal.id,'closed_lost',req.broker.id,{opportunityId:deal.opportunityId,bookingId:deal.bookingId,
      listingId:deal.listingId,reasonCode:v.reasonCode,reason:v.reason,evidenceReference:v.evidenceReference,
      inventoryStatusFrom:'Reserved',inventoryStatusTo:restoredStatus},client);
    await audit('OpportunityStage',stageHistoryId,'changed',req.broker.id,{opportunityId:deal.opportunityId,from:'Deal',to:'Closed Lost',
      reasonCode:v.reasonCode,dealId:deal.id},client);
    if(lockedBooking)await audit('BookingStatus',deal.bookingId,'cancelled',req.broker.id,{dealId:deal.id,from:'reserved',to:'cancelled',reason:v.reason},client);
    if(deal.listingId)await audit('Listing',deal.listingId,'reservation_released_from_lost_deal',req.broker.id,{dealId:deal.id,
      from:'Reserved',to:restoredStatus},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/deals/:dealId/replace-accepted-offer',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),reason=clean(req.body?.reason),evidenceReference=clean(req.body?.evidenceReference),
    propertyDisposition=req.body?.propertyDisposition,requirementImpact=req.body?.requirementImpact,replacementRequirementId=clean(req.body?.replacementRequirementId);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Deal version is required'});
  if(!reason||!evidenceReference)return res.status(400).json({error:'Replacement reason and evidence reference are required'});
  if(!['not_suitable','fallback','reconsider_terms'].includes(propertyDisposition))return res.status(400).json({error:'Record the prior property disposition'});
  if(!['unchanged','agent_review','customer_confirmed_change'].includes(requirementImpact))return res.status(400).json({error:'Record the requirement impact'});
  return res.status(409).json({error:'Reserved Inventory cannot be replaced. Release or expire the reservation first; the Deal ID will remain active for a new Inventory assignment, Offer and Booking.'});
});

r.post('/crm/leads/:id/opportunities',async(req,res)=>{
  const checked=validateOpportunityCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{
    const result=await transaction(async client=>{
      const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
      if(!lead)return {code:404,error:'Lead not found'};
      if(!canReadLead(req.broker,lead))return {code:403,error:'Lead is outside your permitted scope'};
      if(!canCreateOpportunity(req.broker,lead))return {code:403,error:'Only the assigned Agent or Administrator can create this opportunity'};
      if(!['Qualified','Viewing','Negotiation','Won'].includes(lead.stage))return {code:409,error:'Complete qualification before creating an opportunity'};
      if(!lead.assignedTo)return {code:409,error:'Assign the qualified lead to a responsible Sales Agent before creating an opportunity'};
      const catalogue=await loadActiveClassificationCatalogue(client);
      if(lead.classificationCatalogueVersionId!==catalogue.version.id)return {code:409,error:`Lead classification is not pinned to active catalogue ${catalogue.version.code}`};
      const derivedTransaction=legacyBusinessType(mapClassificationValue(catalogue,'customer_objective',lead.customerObjective,'derived_transaction')?.targetValueCode);
      if(derivedTransaction==='Unconfirmed')return {code:409,error:'Confirm the versioned Customer objective before creating an Opportunity'};
      if(checked.value.transactionType!==derivedTransaction)return {code:409,error:`Opportunity transaction is derived as ${derivedTransaction} from Customer objective ${lead.customerObjective}; refresh the form`};
      const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR SHARE',[lead.id],client);
      if(!requirement)return {code:409,error:'A current structured requirement is required before creating an opportunity'};
      const assessment=await one('SELECT * FROM qualification_assessments WHERE lead_id=$1 ORDER BY assessed_at DESC LIMIT 1',[lead.id],client);
      if(!assessment)return {code:409,error:'A recorded qualification assessment is required before creating an opportunity'};
      const input=checked.value,selectionSpecified=Array.isArray(req.body?.listingIds),storedSelections=await many(`SELECT listing_id FROM lead_inventory_selections
        WHERE lead_id=$1 AND removed_at IS NULL ORDER BY selected_at`,[lead.id],client),
        selectedListingIds=[...new Set((selectionSpecified?input.listingIds:[...storedSelections.map(x=>x.listingId),lead.listingId]).filter(Boolean))],
        selectedListingId=selectedListingIds[0]||null;
      const selectedListings=[];
      for(const listingId of selectedListingIds){
        const selected=await requireOpportunityInventory(listingId,requirement,input.transactionType,client);
        if(!selected)return {code:409,error:'Selected Inventory is no longer approved, verified, current or non-terminal; deliberately remove or replace it before continuing'};
        selectedListings.push(selected);
      }
      const representationListing=selectedListings[0]||null;
      let sellerCounterpartyId=null,authorityEvidence=null;
      if(representationListing){
        const inventoryParty=await one(`SELECT p.*,COALESCE(c.full_name,p.display_name) AS display_name,
          COALESCE(c.phone,p.phone) AS phone,COALESCE(c.email,p.email) AS email
          FROM inventory_counterparties p LEFT JOIN contacts c ON c.id=p.contact_id
          WHERE p.listing_id=$1 AND p.party_role=ANY($2::text[])
          ORDER BY CASE p.party_role WHEN 'seller' THEN 1 WHEN 'landlord' THEN 2 WHEN 'lessor' THEN 3 ELSE 4 END,p.created_at DESC LIMIT 1`,
          [representationListing.id,input.transactionType==='Rental'?['landlord','lessor']:['seller','landlord','lessor','developer']],client);
        if(!inventoryParty)return {code:409,error:'The selected Inventory must have a maintained seller, landlord or developer before this representation path can create an Opportunity'};
        if(input.representationPath==='inventory'){
          const leadParty=await one('SELECT id,full_name,email,phone FROM contacts WHERE id=$1',[lead.contactId],client),
            normalizePhone=value=>String(value||'').replace(/\D/g,''),
            sameParty=Boolean(inventoryParty.contactId===lead.contactId||
              inventoryParty.email&&leadParty?.email&&inventoryParty.email.trim().toLowerCase()===leadParty.email.trim().toLowerCase()||
              normalizePhone(inventoryParty.phone)&&normalizePhone(inventoryParty.phone)===normalizePhone(leadParty?.phone)||
              inventoryParty.displayName&&leadParty?.fullName&&inventoryParty.displayName.trim().toLowerCase()===leadParty.fullName.trim().toLowerCase()
            );
          if(!sameParty)return {code:409,error:'For seller/landlord representation, the qualified Lead party must be the owner maintained on the selected Inventory. Create or select the owner Lead; do not use an unrelated Customer.'};
        }
        let representationAgreement=null;
        if(['inventory','dual'].includes(input.representationPath)){
          representationAgreement=await one(`SELECT * FROM inventory_agreements WHERE listing_id=$1 AND status='active'
            ORDER BY created_at DESC LIMIT 1`,[representationListing.id],client);
          if(!representationAgreement)return {code:409,error:'Seller/landlord or dual representation requires an active mandate agreement for the selected Inventory'};
        }
        const role=['landlord','lessor'].includes(inventoryParty.partyRole)?'landlord':'seller';
        const inherited=await inheritInventoryOwner(representationListing.id,input.transactionType,req.broker.id,client);
        sellerCounterpartyId=inherited.counterparty.id;
        authorityEvidence=representationAgreement?.evidenceReference||inventoryParty.authorityEvidence;
      }
      if(selectionSpecified){
        const selectedSet=new Set(selectedListingIds);
        for(const prior of storedSelections)if(!selectedSet.has(prior.listingId))await execute(`UPDATE lead_inventory_selections
          SET removed_by=$1,removed_at=NOW(),removal_reason='Deliberately removed during Opportunity creation'
          WHERE lead_id=$2 AND listing_id=$3 AND removed_at IS NULL`,[req.broker.id,lead.id,prior.listingId],client);
        const priorSet=new Set(storedSelections.map(x=>x.listingId));
        for(const listingId of selectedListingIds)if(!priorSet.has(listingId))await execute(`INSERT INTO lead_inventory_selections(
          id,lead_id,listing_id,selection_source,selected_by
        ) VALUES($1,$2,$3,'manual',$4)`,[uuid(),lead.id,listingId,req.broker.id],client);
      }
      const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code;
      const counter=await one(`INSERT INTO opportunity_number_counters(period_code,last_value) VALUES($1,1)
        ON CONFLICT(period_code) DO UPDATE SET last_value=opportunity_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client);
      const opportunityReference=`NYSA-OP-${period}-${String(counter.lastValue).padStart(6,'0')}`,id=uuid(),
        inventorySideAgentId=['inventory','dual'].includes(input.representationPath)?lead.assignedTo:null,
        buyerSideAgentId=input.representationPath==='inventory'?null:lead.assignedTo,
        ownerId=lead.assignedTo,
        ownerTeam=await one('SELECT team_id FROM brokers WHERE id=$1',[ownerId],client);
      const opportunity=await one(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,qualification_assessment_id,
        listing_id,assigned_team_id,owner_id,title,transaction_type,priority,next_action_code,next_action,next_action_notes,next_action_due_at,created_from_legacy_stage,created_by,
        representation_path,property_source,buyer_source,buyer_side_agent_id,inventory_side_agent_id,seller_counterparty_id,
        authority_evidence,disclosure_evidence,representation_locked_at,buyer_commission_percent,buyer_commission_minimum,
        seller_commission_percent,seller_commission_minimum,originating_agent_split_percent,servicing_agent_split_percent)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'nysa_inventory',$20,$21,$22,$23,$24,$25,NOW(),$26,$27,$28,$29,$30,$31) RETURNING *`,
        [id,opportunityReference,lead.id,lead.contactId,requirement.id,assessment.id,selectedListingId,ownerTeam?.teamId||lead.assignedTeamId,ownerId,
          input.title,input.transactionType,input.priority,input.nextActionCode,input.nextAction,input.nextActionNotes,input.nextActionDueAt,['Viewing','Negotiation','Won'].includes(lead.stage)?lead.stage:null,req.broker.id,
          input.representationPath,input.representationPath==='inventory'?'external_buyer_agent':'nysa_customer',buyerSideAgentId,inventorySideAgentId,
          sellerCounterpartyId,authorityEvidence,input.disclosureEvidence,input.buyerCommissionPercent,input.buyerCommissionMinimum,
          input.sellerCommissionPercent,input.sellerCommissionMinimum,input.originatingAgentSplitPercent,input.servicingAgentSplitPercent],client);
      await execute(`UPDATE opportunities SET classification_catalogue_version_id=$1,classification_mapping_evidence=$2::jsonb WHERE id=$3`,
        [requirement.classificationCatalogueVersionId,JSON.stringify(requirement.classificationMappingEvidence||{}),opportunity.id],client);
      const supersededAssignments=await many(`UPDATE lead_assignments SET operating_sla_ended_at=NOW(),
        operating_sla_end_reason=$1 WHERE lead_id=$2 AND superseded_at IS NULL AND operating_sla_ended_at IS NULL RETURNING id`,
        [`Superseded by active Opportunity ${opportunityReference}`,lead.id],client);
      for(const assignment of supersededAssignments)await audit('LeadAssignment',assignment.id,'operating_sla_superseded',req.broker.id,
        {leadId:lead.id,opportunityId:id,opportunityReference,authoritativeOwnerId:ownerId},client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,$4,$5,$6)`,[uuid(),id,selectedListingId?'Matching':'Requirements',selectedListingId?'lead_inventory_carried_forward':'opportunity_created',
          selectedListingId?'The Inventory selected on the originating Lead was carried into the Opportunity':'Opportunity explicitly created from a qualified Lead',req.broker.id],client);
      if(selectedListingId){
        await execute("UPDATE opportunities SET stage='Matching' WHERE id=$1",[id],client);
        for(const listingId of selectedListingIds){
          const matchId=uuid();
          await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,created_by,updated_by)
            VALUES($1,$2,$3,$4,'manual','partial_fit',$5,$6,$7,$7)`,
            [matchId,id,requirement.id,listingId,'Carried forward from originating Lead; suitability must be confirmed against the current requirements','Confirm current availability and customer suitability',req.broker.id],client);
          await execute(`INSERT INTO property_match_history(id,property_match_id,to_status,reason,changed_by)
            VALUES($1,$2,'considering',$3,$4)`,[uuid(),matchId,'Inventory carried forward from the originating Lead without losing provenance',req.broker.id],client);
          const assignmentId=uuid();
          await execute(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,created_by)
            VALUES($1,$2,$3,$4,$5)`,[assignmentId,id,listingId,matchId,req.broker.id],client);
          await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
            VALUES($1,$2,'created',$3,$4,$5::jsonb)`,[uuid(),assignmentId,'Starting Inventory explicitly assigned when the Opportunity was created',req.broker.id,
            JSON.stringify({opportunityId:id,listingId,propertyMatchId:matchId,source:'qualified_lead_conversion',assignmentDays:7})],client);
        }
      }
      await execute(`INSERT INTO opportunity_participants(id,opportunity_id,broker_id,participation_role,added_by)
        VALUES($1,$2,$3,'owner',$4)`,[uuid(),id,ownerId,req.broker.id],client);
      await execute(`INSERT INTO opportunity_assignment_history(id,opportunity_id,to_team_id,to_owner_id,change_scope,reason,changed_by)
        VALUES($1,$2,$3,$4,'opportunity_only',$5,$6)`,
        [uuid(),id,ownerTeam?.teamId||lead.assignedTeamId,ownerId,
          'Initial Opportunity owner captured from the qualified Lead assignment; Inventory maintenance remains with the Listing Executive',req.broker.id],client);
      const representationSnapshot={representationPath:input.representationPath,leadId:lead.id,listingId:selectedListingId,
        buyerSideAgentId,inventorySideAgentId,inventoryOriginatingAgentId:representationListing?.originatingAgentId||null,
        sellerCounterpartyId,authorityEvidence,buyerCommissionPercent:input.buyerCommissionPercent,
        buyerCommissionMinimum:input.buyerCommissionMinimum,sellerCommissionPercent:input.sellerCommissionPercent,
        sellerCommissionMinimum:input.sellerCommissionMinimum,originatingAgentSplitPercent:input.originatingAgentSplitPercent,
        servicingAgentSplitPercent:input.servicingAgentSplitPercent};
      await execute(`INSERT INTO opportunity_representation_history(id,opportunity_id,representation_path,property_source,buyer_source,snapshot,reason,changed_by)
        VALUES($1,$2,$3,'nysa_inventory',$4,$5,$6,$7)`,[uuid(),id,input.representationPath,
          input.representationPath==='inventory'?'external_buyer_agent':'nysa_customer',JSON.stringify(representationSnapshot),
          'Representation selected during governed conversion of a qualified Lead',req.broker.id],client);
      const attribution=buildOpportunityAttribution(lead);
      const attributionId=uuid();
      await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,campaign_code,external_source_id,source_page,source_form,
        originating_listing_id,provenance_snapshot,provenance_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [attributionId,id,lead.id,attribution.source,attribution.campaignCode,attribution.externalSourceId,attribution.sourcePage,attribution.sourceForm,
          attribution.originatingListingId,JSON.stringify(attribution.provenanceSnapshot),attribution.provenanceHash],client);
      await execute(`UPDATE r2_legacy_lead_review SET review_status='linked_after_review',linked_opportunity_id=$1,reviewed_by=$2,
        reviewed_at=NOW(),review_note='Opportunity created explicitly after scoped review' WHERE lead_id=$3 AND review_status='pending'`,[id,req.broker.id,lead.id],client);
      await audit('Opportunity',id,'created',req.broker.id,{leadId:lead.id,opportunityReference,requirementId:requirement.id,qualificationAssessmentId:assessment.id,legacyLeadStage:lead.stage,creationBasis:'explicit_agent_creation_from_qualified_lead',...representationSnapshot},client);
      await audit('OpportunityAttribution',attributionId,'captured',req.broker.id,{opportunityId:id,provenanceHash:attribution.provenanceHash,attributionBasis:'original_enquiry'},client);
      return opportunity;
    });
    if(result.error)return res.status(result.code).json({error:result.error});
    res.status(201).json(result);
  }catch(error){
    if(error.code==='23505')return res.status(409).json({error:'An open opportunity already exists for this lead, property and transaction type'});
    throw error;
  }
});

r.post('/crm/opportunities/:id/offer-recovery/return-to-matching',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion),recoveryChoice=req.body?.recoveryChoice,
    requirementImpact=req.body?.requirementImpact,propertyDisposition=req.body?.propertyDisposition,
    reason=clean(req.body?.reason),replacementRequirementId=clean(req.body?.replacementRequirementId),
    action=validateOpportunityNextAction(req.body||{});
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Opportunity version is required'});
  if(!['more_options','review_requirements'].includes(recoveryChoice))return res.status(400).json({error:'Select more options or a governed requirement review'});
  if(!['unchanged','agent_review','customer_confirmed_change'].includes(requirementImpact))return res.status(400).json({error:'Record the exact requirement impact'});
  if(!['not_suitable','fallback','reconsider_terms'].includes(propertyDisposition))return res.status(400).json({error:'Record how the prior property should be treated'});
  if(!reason)return res.status(400).json({error:'A recovery reason is required'});if(action.error)return res.status(400).json({error:action.error});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    if(opportunity.version!==expectedVersion)return{code:409,error:'This Opportunity changed after it was opened; reload before recovery'};
    if(opportunity.recoveryState!=='offer_recovery'||!['Offer','Negotiation'].includes(opportunity.stage))return{code:409,error:'A terminal Offer recovery checkpoint is required'};
    const terminal=await one(`SELECT id,offer_reference,status FROM offers WHERE opportunity_id=$1 AND status IN ('rejected','expired','withdrawn')
      ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,[opportunity.id],client);if(!terminal)return{code:409,error:'No immutable terminal Offer supports this recovery action'};
    let requirementId=opportunity.requirementId;if(requirementImpact==='customer_confirmed_change'){
      const replacement=await one(`SELECT lr.id FROM lead_requirements lr JOIN lead_requirement_confirmations c ON c.requirement_id=lr.id
        WHERE lr.id=$1 AND lr.lead_id=$2 AND lr.superseded_at IS NULL`,[replacementRequirementId,opportunity.leadId],client);
      if(!replacement)return{code:409,error:'Select a current, customer-confirmed replacement requirement from this Lead'};requirementId=replacement.id;
    }else if(replacementRequirementId)return{code:400,error:'A replacement requirement is allowed only for a customer-confirmed change'};
    if(recoveryChoice==='more_options'&&requirementImpact==='agent_review')return{code:400,error:'Complete the requirement review before requesting more options'};
    const toStage=recoveryChoice==='review_requirements'?'Requirements':'Matching',v=action.value;
    const updated=await one(`UPDATE opportunities SET stage=$1,requirement_id=$2,recovery_state=$3,next_action_code=$4,next_action=$5,
      next_action_notes=$6,next_action_due_at=$7,version=version+1,updated_at=NOW() WHERE id=$8 AND version=$9 RETURNING *`,
      [toStage,requirementId,toStage==='Matching'?'matching':'requirements_review',v.nextActionCode,v.nextAction,v.nextActionNotes,v.nextActionDueAt,opportunity.id,expectedVersion],client);
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,$4,'terminal_offer_governed_recovery',$5,$6)`,[uuid(),opportunity.id,opportunity.stage,toStage,
        `${terminal.offerReference}: ${reason}; requirement=${requirementImpact}; property=${propertyDisposition}`,req.broker.id],client);
    await execute(`INSERT INTO offer_replacement_actions(id,opportunity_id,original_offer_id,requirement_impact,replacement_requirement_id,
      property_disposition,reservation_disposition,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,'not_applicable',$7,$8)`,
      [uuid(),opportunity.id,terminal.id,requirementImpact,requirementId===opportunity.requirementId?null:requirementId,propertyDisposition,reason,req.broker.id],client);
    await audit('Opportunity',opportunity.id,'terminal_offer_recovery_selected',req.broker.id,{terminalOfferId:terminal.id,recoveryChoice,
      requirementImpact,replacementRequirementId:requirementId===opportunity.requirementId?null:requirementId,propertyDisposition,toStage,nextActionCode:v.nextActionCode},client);
    return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/opportunities/:id/stage',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current opportunity version is required'});
  try{const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(opportunity.version!==expectedVersion)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    if(opportunity.stage==='Matching'&&req.body?.toStage==='Viewing'){
      const scheduled=await one("SELECT id FROM viewings WHERE opportunity_id=$1 AND status='scheduled' LIMIT 1",[opportunity.id],client);
      if(!scheduled)return {code:409,error:'Schedule a viewing for a shortlisted property before moving to Viewing'};
    }
    const checked=validateOpportunityTransition(opportunity.stage,req.body?.toStage,{reasonCode:req.body?.reasonCode,reason:req.body?.reason});
    if(checked.error)return {code:409,error:checked.error};
    const next=checked.value,closed=next.toStage==='Closed Lost';
    const recoveryState=closed?'closed_lost':next.reasonCode==='terminal_offer_return_to_matching'?'matching':null;
    const updated=await one(`UPDATE opportunities SET stage=$1,lost_reason_code=$2,lost_reason=$3,closed_at=CASE WHEN $4 THEN NOW() ELSE NULL END,
      recovery_state=$5,next_action_code=CASE WHEN $5='matching' THEN 'return_to_matching' ELSE next_action_code END,next_action=CASE WHEN $5='matching' THEN 'Select another eligible property or create a new governed match' ELSE next_action END,
      version=version+1,updated_at=NOW() WHERE id=$6 AND version=$7 RETURNING *`,[next.toStage,next.reasonCode,next.reason,closed,recoveryState,opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    const historyId=uuid();await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[historyId,opportunity.id,opportunity.stage,next.toStage,next.reasonCode,next.reason,req.broker.id],client);
    await audit('OpportunityStage',historyId,'changed',req.broker.id,{opportunityId:opportunity.id,from:opportunity.stage,to:next.toStage,reasonCode:next.reasonCode,reason:next.reason},client);
    if(next.toStage==='Closed Lost')await execute(`UPDATE leads SET current_status='closed_lost',updated_at=NOW() WHERE id=$1
      AND NOT EXISTS(SELECT 1 FROM opportunities WHERE lead_id=$1 AND stage NOT IN ('Closed Won','Closed Lost'))`,[opportunity.leadId],client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'Another open Requirements opportunity conflicts with this return; review the lead opportunities'});throw error;}
});

r.patch('/crm/opportunities/:id/next-action',async(req,res)=>{
  const checked=validateOpportunityNextAction(req.body||{}),expectedVersion=Number(req.body?.expectedVersion);
  if(checked.error)return res.status(400).json({error:checked.error});
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current Opportunity version is required'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(['Closed Won','Closed Lost'].includes(opportunity.stage))return {code:409,error:'A closed opportunity cannot receive a new next action'};
    const v=checked.value,updated=await one(`UPDATE opportunities SET next_action_code=$1,next_action=$2,next_action_notes=$3,next_action_due_at=$4,version=version+1,updated_at=NOW()
      WHERE id=$5 AND version=$6 RETURNING *`,[v.nextActionCode,v.nextAction,v.nextActionNotes,v.nextActionDueAt,opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    await audit('Opportunity',opportunity.id,'next_action_updated',req.broker.id,{nextActionCode:v.nextActionCode,nextAction:v.nextAction,nextActionNotes:v.nextActionNotes,nextActionDueAt:v.nextActionDueAt},client);return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.get('/crm/release2/reconciliation',async(req,res)=>{
  if(req.broker.role!=='admin'&&!['manager','director'].includes(req.broker.jobRole))
    return res.status(403).json({error:'Release-candidate reconciliation requires Manager, Director or Administrator access'});
  const params=[],scope=opportunityScopeSql('o',req.broker,params);
  const [opportunityStages,dealStatuses,sourceOutcomes,exceptions,offerRecovery]=await Promise.all([
    many(`SELECT o.stage,COUNT(*)::int AS count FROM opportunities o WHERE ${scope.clause}
      GROUP BY o.stage ORDER BY o.stage`,params),
    many(`SELECT d.status,COUNT(*)::int AS count,COALESCE(SUM(d.agreed_value) FILTER(WHERE d.status='closed_won'),0) AS closed_won_value
      FROM deals d JOIN opportunities o ON o.id=d.opportunity_id WHERE ${scope.clause}
      GROUP BY d.status ORDER BY d.status`,params),
    many(`SELECT COALESCE(a.source,'Not recorded') AS source,COALESCE(a.campaign_code,'No campaign') AS campaign_code,
      COUNT(DISTINCT o.id)::int AS opportunities,COUNT(DISTINCT d.id)::int AS deals,
      COUNT(DISTINCT d.id) FILTER(WHERE d.status='closed_won')::int AS closed_won,
      COALESCE(SUM(d.agreed_value) FILTER(WHERE d.status='closed_won'),0) AS closed_won_value
      FROM opportunities o JOIN opportunity_attribution a ON a.opportunity_id=o.id
      LEFT JOIN deals d ON d.opportunity_id=o.id WHERE ${scope.clause}
      GROUP BY a.source,a.campaign_code ORDER BY opportunities DESC,a.source,a.campaign_code`,params),
    one(`SELECT
      COUNT(*) FILTER(WHERE a.id IS NULL)::int AS missing_attribution,
      COUNT(*) FILTER(WHERE o.stage='Closed Won' AND (d.id IS NULL OR d.status<>'closed_won'))::int AS closed_won_without_deal,
      COUNT(*) FILTER(WHERE d.status='closed_won' AND o.stage<>'Closed Won')::int AS deal_opportunity_mismatch,
      COUNT(*) FILTER(WHERE (b.status='reserved' AND nysa_inventory_effective_status(li.id)<>'Reserved')
        OR (b.status='completed' AND nysa_inventory_effective_status(li.id) NOT IN ('Sold','Rented')))::int AS booking_inventory_mismatch
      FROM opportunities o LEFT JOIN opportunity_attribution a ON a.opportunity_id=o.id
      LEFT JOIN deals d ON d.opportunity_id=o.id LEFT JOIN bookings b ON b.id=d.booking_id
      LEFT JOIN listings li ON li.id=d.listing_id WHERE ${scope.clause}`,params),
    one(`SELECT COUNT(*) FILTER(WHERE f.status IN ('rejected','expired','withdrawn'))::int AS terminal_offers,
      COUNT(DISTINCT o.id) FILTER(WHERE o.recovery_state='offer_recovery')::int AS awaiting_recovery,
      COUNT(*) FILTER(WHERE f.predecessor_offer_id IS NOT NULL)::int AS recovery_offers,
      COUNT(DISTINCT o.id) FILTER(WHERE o.recovery_state='matching')::int AS returned_to_matching,
      COUNT(DISTINCT o.id) FILTER(WHERE o.recovery_state='closed_lost')::int AS recovery_closed_lost,
      COUNT(*) FILTER(WHERE f.predecessor_offer_id IS NOT NULL AND f.status='accepted')::int AS recovered_acceptances,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-f.updated_at))/86400) FILTER(WHERE o.recovery_state='offer_recovery'),1),0) AS average_recovery_age_days,
      COUNT(*) FILTER(WHERE o.recovery_state='offer_recovery' AND f.updated_at<NOW()-INTERVAL '3 days')::int AS recovery_aging_over_3_days
      FROM opportunities o LEFT JOIN offers f ON f.opportunity_id=o.id WHERE ${scope.clause}`,params)
  ]);
  const exceptionCount=Object.values(exceptions||{}).reduce((sum,value)=>sum+Number(value||0),0);
  res.json({opportunityStages,dealStatuses,sourceOutcomes,offerRecovery,exceptions,exceptionCount,dataAsOf:new Date(),
    releaseCandidate:'R2.5',migrationBaseline:'050_release2_customer_kyc_uat_corrections.sql'});
});

r.get('/crm/release2/legacy-lead-review',async(req,res)=>{
  if(req.broker.role!=='admin'&&!['manager','director'].includes(req.broker.jobRole))return res.status(403).json({error:'Manager, Director or Administrator review access required'});
  const params=[],scope=leadScopeSql('l',req.broker,params);
  const records=await many(`SELECT review.*,l.title,c.full_name AS contact_name,l.assigned_to,l.assigned_team_id,owner.name AS owner_name,t.name AS team_name
    FROM r2_legacy_lead_review review JOIN leads l ON l.id=review.lead_id JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN brokers owner ON owner.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id
    WHERE ${scope.clause} ORDER BY CASE review.review_status WHEN 'pending' THEN 0 ELSE 1 END,review.created_at`,params);
  res.json({count:records.length,records,automaticConversion:false});
});

async function refreshRecoveryCases(broker){
  const companyWide=broker.role==='admin'||broker.jobRole==='director',teamIds=(broker.managedTeamIds||[]).map(String),refreshAt=new Date(),cases=[];
  const [leads,tasks,intake]=await Promise.all([
    many(`SELECT l.id,l.lead_reference,l.title,l.assigned_team_id,l.assigned_to,l.assignment_status,l.accepted_at,l.first_contact_at,
      l.acceptance_due_at,l.first_contact_due_at,l.next_follow_up_at,l.queue_cycle_no,l.received_at,c.full_name AS customer_name,t.name AS team_name,
      o.id AS opportunity_id,o.next_action AS opportunity_next_action,o.next_action_due_at AS opportunity_next_action_due_at
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id
      LEFT JOIN LATERAL (SELECT x.id,x.next_action,x.next_action_due_at FROM opportunities x WHERE x.lead_id=l.id AND x.stage NOT IN ('Closed Won','Closed Lost') ORDER BY x.updated_at DESC LIMIT 1) o ON TRUE
      WHERE l.stage NOT IN ('Won','Lost') AND ($1::boolean OR l.assigned_team_id=ANY($2::uuid[]))`,[companyWide,teamIds]),
    many(`SELECT task.id AS task_id,task.lead_id,task.subject,task.due_at,l.lead_reference,l.assigned_team_id,c.full_name AS customer_name
      FROM tasks task JOIN leads l ON l.id=task.lead_id JOIN contacts c ON c.id=l.contact_id
      WHERE task.status NOT IN ('completed','cancelled') AND task.due_at<NOW() AND l.stage NOT IN ('Won','Lost')
      AND ($1::boolean OR l.assigned_team_id=ANY($2::uuid[]))`,[companyWide,teamIds]),
    many(`SELECT id AS website_intake_event_id,event_id,status,error_code,review_due_at,received_at FROM website_intake_events
      WHERE status IN ('email_review','identity_review','duplicate_review','failed') ORDER BY COALESCE(review_due_at,received_at)`)
  ]);
  const add=(record,category,severity,title,requiredAction,dueAt,evidence={})=>cases.push({caseKey:`${record.taskId||record.websiteIntakeEventId||record.id||record.leadId}:${category}`,leadId:record.id||record.leadId||null,
    websiteIntakeEventId:record.websiteIntakeEventId||null,taskId:record.taskId||null,assignedTeamId:record.assignedTeamId||null,category,severity,title,requiredAction,dueAt:dueAt||null,evidence});
  const now=Date.now();
  for(const lead of leads){
    const label=`${lead.customerName} · ${lead.leadReference||lead.title}`;
    if(!lead.assignedTo&&now-new Date(lead.receivedAt).valueOf()>=30*60*1000)add(lead,'unassigned_ageing','high',label,'Assign a responsible broker or confirm the team queue',lead.acceptanceDueAt,{assignmentStatus:lead.assignmentStatus,teamName:lead.teamName});
    if(!lead.acceptedAt&&lead.acceptanceDueAt&&new Date(lead.acceptanceDueAt)<refreshAt)add(lead,'acceptance_breach','critical',label,'Recover or reassign the unanswered Lead',lead.acceptanceDueAt,{assignmentStatus:lead.assignmentStatus});
    if(lead.acceptedAt&&!lead.firstContactAt&&lead.firstContactDueAt&&new Date(lead.firstContactDueAt)<refreshAt)add(lead,'first_contact_breach','critical',label,'Contact the customer or reassign with evidence',lead.firstContactDueAt,{assignedTo:lead.assignedTo});
    const nextDue=lead.opportunityNextActionDueAt||lead.nextFollowUpAt;
    if(lead.acceptedAt&&!lead.opportunityNextAction&&!lead.nextFollowUpAt)add(lead,'no_next_action','high',label,'Record an owned next action and due time',null,{opportunityId:lead.opportunityId});
    if(nextDue&&new Date(nextDue)<refreshAt)add(lead,'overdue_next_action','high',label,'Complete or reschedule the overdue action with a reason',nextDue,{nextAction:lead.opportunityNextAction||'Lead follow-up'});
    if(Number(lead.queueCycleNo||0)>1)add(lead,'repeated_reassignment','medium',label,'Review why this Lead has returned to the queue repeatedly',lead.acceptanceDueAt,{queueCycleNo:Number(lead.queueCycleNo)});
  }
  for(const task of tasks)add(task,'overdue_task','high',`${task.customerName} · ${task.leadReference}`,'Complete or reschedule the overdue task',task.dueAt,{subject:task.subject});
  for(const event of intake){const category=event.status==='email_review'?'intake_email_review':event.status==='identity_review'?'intake_identity_review':event.status==='duplicate_review'?'intake_duplicate_review':'intake_failed',severity=event.status==='failed'?'critical':'high';
    add({...event,id:null},category,severity,`Website event ${event.eventId}`,event.status==='failed'?'Correct the processing failure and replay the retained event':event.status==='email_review'?'Approve a genuine email-only exception or reject dummy/bot evidence':'Record the governed intake decision',event.reviewDueAt||event.receivedAt,{eventId:event.eventId,errorCode:event.errorCode,status:event.status});}
  await transaction(async client=>{
    for(const item of cases)await execute(`INSERT INTO lead_recovery_cases(id,case_key,lead_id,website_intake_event_id,task_id,assigned_team_id,category,severity,title,required_action,evidence,due_at,last_detected_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) ON CONFLICT(case_key) DO UPDATE SET severity=EXCLUDED.severity,title=EXCLUDED.title,
      required_action=EXCLUDED.required_action,evidence=EXCLUDED.evidence,due_at=EXCLUDED.due_at,assigned_team_id=EXCLUDED.assigned_team_id,status='open',last_detected_at=EXCLUDED.last_detected_at,resolved_at=NULL,resolution_kind=NULL,updated_at=NOW()`,
      [uuid(),item.caseKey,item.leadId,item.websiteIntakeEventId,item.taskId,item.assignedTeamId,item.category,item.severity,item.title,item.requiredAction,JSON.stringify(item.evidence),item.dueAt,refreshAt],client);
    await execute(`UPDATE lead_recovery_cases SET status='resolved',resolved_at=NOW(),resolution_kind='authoritative_condition_cleared',updated_at=NOW()
      WHERE status='open' AND last_detected_at<$1 AND ($2::boolean OR assigned_team_id=ANY($3::uuid[]) OR website_intake_event_id IS NOT NULL)`,[refreshAt,companyWide,teamIds],client);
  });
  return many(`SELECT rc.*,l.lead_reference,e.event_id FROM lead_recovery_cases rc LEFT JOIN leads l ON l.id=rc.lead_id
    LEFT JOIN website_intake_events e ON e.id=rc.website_intake_event_id WHERE rc.status='open' AND ($1::boolean OR rc.assigned_team_id=ANY($2::uuid[]) OR rc.website_intake_event_id IS NOT NULL)
    ORDER BY CASE rc.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,rc.due_at NULLS LAST,rc.first_detected_at LIMIT 100`,[companyWide,teamIds]);
}

r.get('/crm/operations/guided-work',async(req,res)=>{
  const canCoordinateAssignment=req.broker.role==='admin'||['director','manager'].includes(req.broker.jobRole);
  const nextCaseResponsibility=req.broker.jobRole==='manager'?"AND l.assigned_to IS NULL AND l.assignment_status IN ('unassigned','reassignment_due')":'';
  const leadParams=[],leadScope=agentWorkLeadScopeSql('l',req.broker,leadParams),opportunityParams=[],opportunityScope=opportunityScopeSql('o',req.broker,opportunityParams),
    nextParams=[],nextLeadScope=agentWorkLeadScopeSql('l',req.broker,nextParams),nextOpportunityScope=opportunityScopeSql('x',req.broker,nextParams);
  const dealParams=[],dealScope=opportunityScopeSql('o',req.broker,dealParams);
  const verificationParams=[],verificationScope=req.broker.role==='admin'?'TRUE':req.broker.jobRole==='manager'?(verificationParams.push(req.broker.id),`(t.manager_id=$1 OR EXISTS(
    SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$1
      AND tm.membership_role='manager' AND tm.ends_at IS NULL
  ) OR EXISTS(
    SELECT 1 FROM user_role_assignments ur WHERE ur.team_id=t.id AND ur.broker_id=$1
      AND ur.job_role='manager' AND ur.status='active' AND ur.ends_at IS NULL
  ))`):'FALSE';
  const [leadCounts,opportunityCounts,nextCases,dealApprovalCases,intakeReviewCases,inventoryVerificationCases]=await Promise.all([
    one(`SELECT COUNT(DISTINCT l.contact_id)::int AS customers,COUNT(*)::int AS leads,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL))::int AS requirements,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id))::int AS qualified,
      COUNT(*) FILTER(WHERE l.assigned_to IS NULL AND l.stage NOT IN ('Won','Lost'))::int AS unassigned,
      COUNT(*) FILTER(WHERE l.assigned_to IS NOT NULL AND l.stage IN ('Qualified','Viewing','Negotiation','Won')
        AND EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL)
        AND EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id)
        AND NOT EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage NOT IN ('Closed Won','Closed Lost')))::int AS ready_opportunities
      FROM leads l WHERE ${leadScope.clause}`,leadScope.params),
    one(`SELECT COUNT(*) FILTER(WHERE o.stage NOT IN ('Closed Won','Closed Lost'))::int AS active,
      COUNT(*) FILTER(WHERE o.stage='Requirements')::int AS requirements,
      COUNT(*) FILTER(WHERE o.stage='Matching')::int AS matching,
      COUNT(*) FILTER(WHERE o.stage='Viewing')::int AS viewing,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM offers f WHERE f.opportunity_id=o.id))::int AS offers,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM offers f WHERE f.opportunity_id=o.id AND f.status='accepted'))::int AS accepted_offers,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.opportunity_id=o.id AND b.status='reserved'))::int AS bookings,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM deals d WHERE d.opportunity_id=o.id))::int AS deals,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM deals d WHERE d.opportunity_id=o.id AND d.status NOT IN ('closed_won','closed_lost')))::int AS active_deals,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM deals d WHERE d.opportunity_id=o.id AND d.status IN ('closed_won','closed_lost')))::int AS closed_deals,
      COUNT(*) FILTER(WHERE o.stage NOT IN ('Closed Won','Closed Lost') AND o.next_action_due_at<NOW())::int AS overdue
      FROM opportunities o WHERE ${opportunityScope.clause}`,opportunityScope.params),
    many(`SELECT l.id AS lead_id,l.contact_id,l.lead_reference,l.current_status,l.title,l.source,
      COALESCE(governed_campaign.campaign_code,l.campaign_code) AS campaign_code,l.campaign_code AS raw_campaign_code,l.business_type,l.temperature,
      l.received_at,l.created_at,l.stage AS lead_stage,l.assigned_to,l.accepted_at,l.first_contact_at,l.next_follow_up_at,
      c.full_name AS customer_name,c.email_status,c.phone_status,c.do_not_contact,c.preferred_channel,
      (SELECT COUNT(*)::int FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL) AS requirement_count,
      (SELECT COUNT(*)::int FROM qualification_assessments qa WHERE qa.lead_id=l.id) AS qualification_count,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id=l.id) AS last_interaction_at,
      assignment_offer.offered_at AS assignment_offered_at,
      b.name AS owner_name,manager.name AS responsible_manager_name,o.id AS opportunity_id,o.opportunity_reference,o.stage AS opportunity_stage,
      o.next_action AS opportunity_next_action,
      CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN 'Accept assignment'
        ELSE COALESCE(o.next_action,CASE WHEN l.assigned_to IS NULL THEN 'Assignment requires manager action'
        WHEN NOT EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL) THEN 'Record structured requirements'
        WHEN NOT EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id) THEN 'Complete qualification'
        WHEN l.stage IN ('Qualified','Viewing','Negotiation','Won') THEN 'Create or review Opportunity'
        ELSE 'Continue Lead follow-up' END) END AS next_action,
      CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN COALESCE(assignment_offer.acceptance_due_at,l.acceptance_due_at)
        ELSE COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) END AS due_at
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
      LEFT JOIN marketing_campaigns governed_campaign ON governed_campaign.id=l.campaign_id
      LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers manager ON manager.id=t.manager_id
      LEFT JOIN LATERAL (SELECT la.offered_at,la.acceptance_due_at FROM lead_assignments la WHERE la.lead_id=l.id AND la.superseded_at IS NULL AND la.status='offered' ORDER BY la.sequence_no DESC LIMIT 1) assignment_offer ON TRUE
      LEFT JOIN LATERAL (SELECT x.* FROM opportunities x WHERE x.lead_id=l.id AND ${nextOpportunityScope.clause} AND x.stage NOT IN ('Closed Won','Closed Lost') ORDER BY x.next_action_due_at LIMIT 1) o ON TRUE
      WHERE ${nextLeadScope.clause} AND l.stage NOT IN ('Won','Lost') ${nextCaseResponsibility}
      ORDER BY CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN COALESCE(assignment_offer.acceptance_due_at,l.acceptance_due_at) ELSE COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) END NULLS LAST,
        l.updated_at DESC LIMIT 8`,nextLeadScope.params),
    req.broker.role==='admin'||['manager','director'].includes(req.broker.jobRole)?many(`SELECT l.id AS lead_id,l.title,c.full_name AS customer_name,
      l.stage AS lead_stage,l.assigned_to,l.accepted_at,owner.name AS owner_name,o.id AS opportunity_id,o.opportunity_reference,
      o.stage AS opportunity_stage,'Review Deal closure approval' AS next_action,d.updated_at AS due_at,d.id AS deal_id
      FROM deals d JOIN opportunities o ON o.id=d.opportunity_id JOIN leads l ON l.id=o.lead_id JOIN contacts c ON c.id=l.contact_id
      LEFT JOIN brokers owner ON owner.id=o.owner_id WHERE ${dealScope.clause} AND d.status IN ('draft','completion_in_progress')
      AND NOT EXISTS(SELECT 1 FROM deal_checklist_items i JOIN deal_checklists dc ON dc.id=i.deal_checklist_id
        WHERE dc.deal_id=d.id AND i.required AND i.status<>'completed')
      ORDER BY d.updated_at LIMIT 8`,dealScope.params):Promise.resolve([]),
    req.broker.role==='admin'||['manager','director'].includes(req.broker.jobRole)?many(`SELECT event_id AS intake_event_id,
      CONCAT('Website event ',event_id) AS title,'Website enquiry awaiting Customer decision' AS customer_name,
      source_code AS source,campaign_code,received_at,review_due_at AS due_at,status AS current_status,error_code
       FROM website_intake_events WHERE status IN ('email_review','identity_review','duplicate_review') ORDER BY review_due_at NULLS LAST,received_at LIMIT 12`):Promise.resolve([]),
    many(`SELECT vr.id AS inventory_verification_request_id,l.id AS listing_id,
      COALESCE(l.inventory_reference,'Inventory reference pending') AS title,l.project AS customer_name,
      'Internal Inventory' AS source,vr.status AS current_status,vr.request_type,vr.request_reason,
      vr.submitted_at AS received_at,vr.submitted_at AS due_at,submitter.name AS submitted_by_name,t.name AS team_name
      FROM inventory_verification_requests vr JOIN listings l ON l.id=vr.listing_id
      JOIN brokers submitter ON submitter.id=vr.submitted_by
      JOIN brokers maintainer ON maintainer.id=l.posted_by
      LEFT JOIN teams t ON t.id=maintainer.team_id
      WHERE vr.status='pending' AND l.deleted_at IS NULL AND ${verificationScope}
      ORDER BY vr.submitted_at LIMIT 12`,verificationParams)
  ]);
  const guidedCases=sortCustomerPriorityCases([...inventoryVerificationCases.map(item=>({...item,responsibility:'manager',hardPriority:true,
    hardPriorityReason:`Inventory verification from ${item.submittedByName||'a team member'} is awaiting a governed decision`,
    hardPriorityAction:{code:'review_inventory_verification',label:'Verify, return or reject Inventory',target:'inventory_verification'}})),...intakeReviewCases.map(item=>({...item,responsibility:'manager',hardPriority:true,
    hardPriorityReason:item.currentStatus==='email_review'?'An email-only enquiry did not pass the free credibility gate':item.currentStatus==='duplicate_review'?'A possible repeated Lead requires a governed decision before enquiry creation':'Customer identity conflict is blocking website enquiry creation',
    hardPriorityAction:item.currentStatus==='email_review'?{code:'review_intake_email',label:'Approve genuine evidence or reject dummy / bot',target:'website_intake'}:item.currentStatus==='duplicate_review'?{code:'review_duplicate_lead',label:'Decide whether this is the same or a distinct Lead',target:'website_intake'}:{code:'review_intake_identity',label:'Resolve the Customer identity conflict',target:'website_intake'}})),...dealApprovalCases.map(item=>({...item,responsibility:'manager',actionHint:'Open connected Lead and Opportunity to decide',hardPriority:true,hardPriorityReason:'Deal closure approval is ready for a governed decision'})),...nextCases.map(item=>item.assignedTo?{...item,responsibility:'agent',actionHint:item.acceptedAt?'Open connected case':'Open Lead to accept or reject'}:{
    ...item,
    responsibility:'manager',
    nextAction:canCoordinateAssignment?'Assign a responsible agent':`Await assignment by ${item.responsibleManagerName||'your manager'}`,
    actionHint:canCoordinateAssignment?'Open Lead and review reassignment':'Manager-controlled; open Lead context only'
  })]).slice(0,12);
  const steps=[
    {code:'customer',label:'Customer',status:'completed',count:leadCounts.customers,action:'Open the linked customer record'},
    {code:'lead',label:'Lead',status:leadCounts.unassigned?'blocked':'current',count:leadCounts.leads,action:leadCounts.unassigned?(canCoordinateAssignment?`${leadCounts.unassigned} need assignment`:`${leadCounts.unassigned} awaiting manager assignment`):'Continue customer follow-up'},
    {code:'qualification',label:'Qualification',status:leadCounts.qualified?'completed':'ready',count:leadCounts.qualified,action:'Complete the approved assessment; requirements may be recorded before or in parallel'},
    {code:'requirements',label:'Requirements',status:leadCounts.requirements?'completed':'ready',count:leadCounts.requirements,action:'Record structured requirements independently; Opportunity readiness still requires both prerequisites'},
    {code:'opportunity',label:'Opportunity',status:leadCounts.readyOpportunities?'ready':opportunityCounts.active?'current':'blocked',count:opportunityCounts.active,action:leadCounts.readyOpportunities?`${leadCounts.readyOpportunities} qualified lead${leadCounts.readyOpportunities===1?' is':'s are'} ready`:opportunityCounts.overdue?`${opportunityCounts.overdue} next action${opportunityCounts.overdue===1?' is':'s are'} overdue`:'Create from a qualified lead'},
    {code:'matching',label:'Match',status:opportunityCounts.matching?'current':opportunityCounts.viewing?'completed':opportunityCounts.requirements?'ready':'blocked',count:opportunityCounts.matching,action:opportunityCounts.requirements?`${opportunityCounts.requirements} ready for matching`:'Review explainable property matches'},
    {code:'viewing',label:'Viewing',status:opportunityCounts.viewing?'current':opportunityCounts.matching?'ready':'blocked',count:opportunityCounts.viewing,action:opportunityCounts.matching?'Shortlist a property and schedule a viewing':'Record attendance, feedback and follow-up'},
    {code:'offer',label:'Offer',status:opportunityCounts.acceptedOffers?'completed':opportunityCounts.offers?'current':opportunityCounts.viewing?'ready':'blocked',count:opportunityCounts.offers,action:opportunityCounts.acceptedOffers?'Accepted offer is ready for explicit reservation':opportunityCounts.offers?'Review exact revision and negotiation timeline':'Create immutable terms from an active Opportunity'},
    {code:'booking',label:'Booking',status:opportunityCounts.deals?'completed':opportunityCounts.bookings?'current':opportunityCounts.acceptedOffers?'ready':'blocked',count:opportunityCounts.bookings,action:opportunityCounts.deals?'Governed Deal created':opportunityCounts.bookings?'Create the governed Deal and monitor reservation expiry':opportunityCounts.acceptedOffers?'Create an explicit reservation with evidence':'An accepted exact offer revision is required'},
    {code:'deal',label:'Deal',status:opportunityCounts.activeDeals?'current':opportunityCounts.closedDeals?'completed':opportunityCounts.bookings?'ready':'blocked',count:opportunityCounts.deals,action:opportunityCounts.activeDeals?'Complete mandatory parties and the exact approved checklist':opportunityCounts.closedDeals?'Authoritative Deal closure recorded':opportunityCounts.bookings?'Create only from an active governed reservation':'An active governed reservation is required'}
  ];
  const recoveryCases=canCoordinateAssignment?await refreshRecoveryCases(req.broker):[];
  res.json({role:req.broker.jobRole,steps,nextCases:guidedCases,recoveryCases,priorityBands:['immediate','new_enquiry','due_today','high_potential','waiting'],dataAsOf:new Date(),priorityRulesVersion:'r3a-dev94-v1',releaseBoundary:'R2.5 reconciles the accepted Release 2 flow through governed approval and authoritative closure; Release 3A adds a customer-centred priority foundation where AI may explain but cannot override deterministic deadlines or role scope'});
});

export default r;
