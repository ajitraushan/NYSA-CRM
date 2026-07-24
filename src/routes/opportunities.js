import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,canReadLead,canCreateOpportunity,canReadOpportunity,canWriteOpportunity,opportunityScopeSql,leadScopeSql,agentWorkLeadScopeSql } from '../crm-policy.js';
import { buildOpportunityAttribution,validateOpportunityCreate,validateOpportunityTransition,OPPORTUNITY_STAGES } from '../opportunity-domain.js';
import { validatePropertyMatch,validateMatchDecision,validateViewingCreate,validateViewingOutcome,buildViewingIcs } from '../matching-viewing-domain.js';
import { syncGoogleViewing } from '../calendar-sync.js';
import { OFFER_COUNTERPARTY_ROLES,validateOfferRevision,validateOfferEvent,offerStatusAfterRevision } from '../offer-domain.js';
import { makeOfferPdf } from '../offer-pdf.js';
import { savePrivate,removePrivate,readPrivate } from '../private-files.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>{
  if(!hasInternalCrmIdentity(req.broker))return res.status(403).json({error:'Opportunity data is restricted to NYSA staff'});
  next();
});

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const SELECT_OPPORTUNITY=`SELECT o.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,
  c.postal_address AS contact_address,l.title AS lead_title,l.stage AS lead_stage,
  req.version_no AS requirement_version,qa.final_temperature AS qualification_temperature,
  li.project AS listing_project,li.inventory_reference,owner.name AS owner_name,owner.phone AS owner_phone,t.name AS team_name,
  attr.source AS attribution_source,attr.campaign_code,attr.external_source_id,attr.source_page,attr.source_form,
  attr.originating_listing_id,attr.attribution_basis,attr.provenance_hash,attr.captured_at AS attribution_captured_at
  FROM opportunities o
  JOIN contacts c ON c.id=o.contact_id
  JOIN leads l ON l.id=o.lead_id
  JOIN lead_requirements req ON req.id=o.requirement_id
  JOIN qualification_assessments qa ON qa.id=o.qualification_assessment_id
  LEFT JOIN listings li ON li.id=o.listing_id
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
  if(clean(req.query.q)){params.push(`%${clean(req.query.q)}%`);where.push(`(o.title ILIKE $${params.length} OR o.opportunity_reference ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`);}
  const opportunities=await many(`${SELECT_OPPORTUNITY} WHERE ${where.join(' AND ')} ORDER BY
    CASE WHEN o.stage IN ('Closed Won','Closed Lost') THEN 1 ELSE 0 END,o.next_action_due_at,o.created_at DESC`,params);
  res.json({count:opportunities.length,opportunities});
});

r.get('/crm/opportunities/:id',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const [stageHistory,assignmentHistory,matches,viewings]=await Promise.all([
    many(`SELECT h.*,b.name AS changed_by_name FROM opportunity_stage_history h
      JOIN brokers b ON b.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id]),
    many(`SELECT h.*,old_owner.name AS from_owner_name,new_owner.name AS to_owner_name,old_team.name AS from_team_name,
      new_team.name AS to_team_name,actor.name AS changed_by_name FROM opportunity_assignment_history h
      LEFT JOIN brokers old_owner ON old_owner.id=h.from_owner_id JOIN brokers new_owner ON new_owner.id=h.to_owner_id
      LEFT JOIN teams old_team ON old_team.id=h.from_team_id LEFT JOIN teams new_team ON new_team.id=h.to_team_id
      JOIN brokers actor ON actor.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id]),
    many(`SELECT pm.*,li.project,li.area,li.property_type,li.price,li.currency,li.inventory_reference,
      creator.name AS created_by_name FROM property_matches pm JOIN listings li ON li.id=pm.listing_id
      JOIN brokers creator ON creator.id=pm.created_by WHERE pm.opportunity_id=$1 ORDER BY
      CASE pm.shortlist_status WHEN 'shortlisted' THEN 0 WHEN 'considering' THEN 1 ELSE 2 END,pm.created_at`,[opportunity.id]),
    many(`SELECT v.*,li.project AS listing_project,li.inventory_reference,organizer.name AS organizer_name,
      customer.full_name AS customer_name,customer.email AS customer_email,customer.phone AS customer_phone,
      customer.postal_address AS customer_address,owner.name AS owner_name,owner.phone AS owner_phone,
      cal.event_url AS google_event_url,cal.meeting_url AS google_meeting_url,cal.sync_status AS google_sync_status,cal.last_error AS google_last_error,cal.retry_count AS google_retry_count,
      COALESCE((SELECT json_agg(json_build_object('id',va.id,'contactId',va.contact_id,'brokerId',va.broker_id,
        'guestName',va.guest_name,'attendeeRole',va.attendee_role,'invitationStatus',va.invitation_status,
        'attendanceStatus',va.attendance_status,'displayName',COALESCE((SELECT c.full_name FROM contacts c WHERE c.id=va.contact_id),
        (SELECT b.name FROM brokers b WHERE b.id=va.broker_id),va.guest_name))) FROM viewing_attendees va WHERE va.viewing_id=v.id),'[]'::json) AS attendees
      FROM viewings v JOIN listings li ON li.id=v.listing_id JOIN brokers organizer ON organizer.id=v.organizer_id
      JOIN opportunities viewing_opportunity ON viewing_opportunity.id=v.opportunity_id
      JOIN contacts customer ON customer.id=viewing_opportunity.contact_id JOIN brokers owner ON owner.id=viewing_opportunity.owner_id
      LEFT JOIN viewing_calendar_events cal ON cal.viewing_id=v.id AND cal.provider='google_calendar'
      WHERE v.opportunity_id=$1 ORDER BY v.starts_at DESC`,[opportunity.id])
  ]);
  const offers=await many(`SELECT f.*,li.project AS listing_project,li.inventory_reference,owner.name AS owner_name
    FROM offers f JOIN listings li ON li.id=f.listing_id JOIN brokers owner ON owner.id=f.owner_id
    WHERE f.opportunity_id=$1 ORDER BY f.created_at DESC`,[opportunity.id]);
  if(offers.length){
    const ids=offers.map(x=>x.id),[revisions,events]=await Promise.all([
      many(`SELECT r.*,v.file_name,v.file_hash FROM offer_revisions r JOIN document_versions v ON v.id=r.document_version_id
        WHERE r.offer_id=ANY($1::uuid[]) ORDER BY r.offer_id,r.revision_number`,[ids]),
      many(`SELECT e.*,actor.name AS actor_name FROM negotiation_events e JOIN brokers actor ON actor.id=e.actor_id
        WHERE e.offer_id=ANY($1::uuid[]) ORDER BY e.offer_id,e.occurred_at,e.id`,[ids])
    ]);
    for(const offer of offers){offer.revisions=revisions.filter(x=>x.offerId===offer.id);offer.events=events.filter(x=>x.offerId===offer.id);}
  }
  res.json({opportunity,stageHistory,assignmentHistory,matches,viewings,offers});
});

r.get('/crm/opportunities/:id/matching-inventory',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const q=clean(req.query.q),params=[opportunity.id],where=["li.deleted_at IS NULL","li.workflow_status='approved'","li.id NOT IN (SELECT listing_id FROM property_matches WHERE opportunity_id=$1)"];
  if(q){params.push(`%${q}%`);where.push(`(li.project ILIKE $${params.length} OR li.area ILIKE $${params.length} OR li.inventory_reference ILIKE $${params.length})`);}
  const listings=await many(`SELECT li.id,li.inventory_reference,li.project,li.area,li.property_type,li.price,li.currency
    FROM listings li WHERE ${where.join(' AND ')} ORDER BY li.project,li.area LIMIT 50`,params);
  res.json({count:listings.length,listings,requirementId:opportunity.requirementId});
});

r.post('/crm/opportunities/:id/matches',async(req,res)=>{
  const checked=validatePropertyMatch(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(!['Requirements','Matching'].includes(opportunity.stage))return {code:409,error:'Property matching is available only before viewing starts'};
    const listing=await one("SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL AND workflow_status='approved'",[checked.value.listingId],client);
    if(!listing)return {code:409,error:'Select approved active inventory'};
    const id=uuid(),v=checked.value;
    const match=await one(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,[id,opportunity.id,opportunity.requirementId,v.listingId,v.matchSource,v.fitStatus,v.rationale,v.exceptions,req.broker.id],client);
    await execute(`INSERT INTO property_match_history(id,property_match_id,to_status,reason,changed_by) VALUES($1,$2,'considering',$3,$4)`,[uuid(),id,'Property added against the exact current requirement evidence',req.broker.id],client);
    if(opportunity.stage==='Requirements'){
      await execute("UPDATE opportunities SET stage='Matching',version=version+1,updated_at=NOW() WHERE id=$1",[opportunity.id],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,'Requirements','Matching','match_recorded','First explainable property match recorded',$3)`,[uuid(),opportunity.id,req.broker.id],client);
    }
    await audit('PropertyMatch',id,'created',req.broker.id,{opportunityId:opportunity.id,listingId:v.listingId,requirementId:opportunity.requirementId,fitStatus:v.fitStatus},client);
    return match;
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'This property is already recorded for the opportunity'});throw error;}
});

r.patch('/crm/opportunities/:id/matches/:matchId',async(req,res)=>{
  const checked=validateMatchDecision(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
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

r.post('/crm/opportunities/:id/viewings',async(req,res)=>{
  const checked=validateViewingCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    await one('SELECT id FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.id],client);
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(!['Matching','Viewing'].includes(opportunity.stage))return {code:409,error:'A viewing can be scheduled only after matching starts and before offers begin'};
    const v=checked.value,match=await one(`SELECT pm.*,li.project FROM property_matches pm JOIN listings li ON li.id=pm.listing_id
      WHERE pm.id=$1 AND pm.opportunity_id=$2 FOR UPDATE OF pm`,[v.propertyMatchId,opportunity.id],client);
    if(!match||match.shortlistStatus==='rejected')return {code:409,error:'Select a considered or shortlisted property for the viewing'};
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
    const viewing=await one(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,organizer_id,starts_at,ends_at,timezone,location,instructions,client_message,calendar_uid,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$5,$5) RETURNING *`,[id,opportunity.id,match.id,match.listingId,req.broker.id,v.startsAt,v.endsAt,v.timezone,v.location,v.instructions,v.clientMessage,calendarUid],client);
    await execute(`INSERT INTO viewing_attendees(id,viewing_id,contact_id,attendee_role,invitation_status) VALUES($1,$2,$3,'customer','planned')`,[uuid(),id,opportunity.contactId],client);
    await execute(`INSERT INTO viewing_attendees(id,viewing_id,broker_id,attendee_role,invitation_status) VALUES($1,$2,$3,'agent','planned')`,[uuid(),id,opportunity.ownerId],client);
    for(const attendee of v.attendees){
      const name=clean(attendee.guestName);if(!name)continue;
      await execute(`INSERT INTO viewing_attendees(id,viewing_id,guest_name,attendee_role,invitation_status) VALUES($1,$2,$3,'guest','planned')`,[uuid(),id,name],client);
    }
    await execute(`INSERT INTO viewing_status_history(id,viewing_id,to_status,reason,changed_by) VALUES($1,$2,'scheduled','Viewing scheduled locally',$3)`,[uuid(),id,req.broker.id],client);
    await execute(`UPDATE opportunities SET stage='Viewing',listing_id=COALESCE(listing_id,$1),next_action='Complete viewing and record feedback',next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3`,[match.listingId,v.endsAt,opportunity.id],client);
    if(opportunity.stage==='Matching')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Matching','Viewing','viewing_scheduled',$3,$4)`,[uuid(),opportunity.id,`Viewing scheduled for ${match.project}`,req.broker.id],client);
    await audit('Viewing',id,'scheduled',req.broker.id,{opportunityId:opportunity.id,propertyMatchId:match.id,listingId:match.listingId,startsAt:v.startsAt,endsAt:v.endsAt,timezone:v.timezone,clientMessageIncluded:Boolean(v.clientMessage),propertyAutomaticallyShortlisted:match.shortlistStatus==='considering'},client);
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
    if(v.followUpAction)await execute('UPDATE opportunities SET next_action=$1,next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3',[v.followUpAction,v.followUpDueAt,opportunity.id],client);
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
  const viewing=await one(`SELECT v.*,li.project AS listing_project,o.opportunity_reference FROM viewings v JOIN listings li ON li.id=v.listing_id
    JOIN opportunities o ON o.id=v.opportunity_id WHERE v.id=$1 AND v.opportunity_id=$2`,[req.params.viewingId,opportunity.id]);
  if(!viewing)return res.status(404).json({error:'Viewing not found'});await audit('Viewing',viewing.id,'calendar_downloaded',req.broker.id,{opportunityId:opportunity.id});
  res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="nysa-viewing-${viewing.id}.ics"`);res.end(buildViewingIcs(viewing));
});

async function offerContext(req,offerId,client){
  const offer=await one(`SELECT f.*,o.lead_id,o.contact_id,o.owner_id AS opportunity_owner_id,o.created_by AS opportunity_created_by,
    o.assigned_team_id,o.opportunity_reference,o.title AS opportunity_title,o.stage AS opportunity_stage,
    c.full_name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,li.project AS listing_project,li.inventory_reference
    FROM offers f JOIN opportunities o ON o.id=f.opportunity_id JOIN contacts c ON c.id=o.contact_id
    JOIN listings li ON li.id=f.listing_id WHERE f.id=$1`,[offerId],client);
  if(!offer)return {error:[404,'Offer not found']};
  offer.participantIds=(await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active',[offer.opportunityId],client)).map(x=>x.brokerId);
  if(!canReadOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {error:[403,'Offer is outside your permitted scope']};
  return {offer};
}

async function createOfferRevisionRecords({client,req,offer,opportunity,listing,customer,input,revisionNumber,supersedesRevisionId}){
  const organization=await one("SELECT * FROM organization_settings WHERE status='active' LIMIT 1",[],client);
  if(!organization)throw Object.assign(new Error('Activate the approved NYSA organization profile before generating an offer letter'),{status:409});
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
      VALUES($1,$2,'Lead',$3,$4),($5,$2,'Opportunity',$6,$4),($7,$2,'Offer',$8,$4),($9,$2,'OfferRevision',$10,$4)`,
      [uuid(),documentId,opportunity.leadId,req.broker.id,uuid(),opportunity.id,uuid(),offer.id,uuid(),revisionId],client);
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
      const listingId=req.body?.listingId||opportunity.listingId;
      const listing=await one(`SELECT li.* FROM listings li JOIN property_matches pm ON pm.listing_id=li.id
        WHERE li.id=$1 AND pm.opportunity_id=$2 AND pm.shortlist_status<>'rejected' AND li.deleted_at IS NULL AND li.workflow_status='approved'
        LIMIT 1`,[listingId,opportunity.id],client);
      if(!listing)return {code:409,error:'Select an approved considered or shortlisted property from this Opportunity'};
      const completedViewing=await one(`SELECT id FROM viewings WHERE opportunity_id=$1 AND listing_id=$2
        AND status='completed' AND NULLIF(BTRIM(feedback),'') IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
        [opportunity.id,listing.id],client);
      if(!completedViewing)return {code:409,error:'Complete the property viewing and record customer feedback before creating an offer for this property'};
      const customer=await one('SELECT * FROM contacts WHERE id=$1',[opportunity.contactId],client),period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code,
        counter=await one(`INSERT INTO offer_number_counters(period_code,last_value) VALUES($1,1) ON CONFLICT(period_code)
          DO UPDATE SET last_value=offer_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client),
        offerReference=`NYSA-OF-${period}-${String(counter.lastValue).padStart(6,'0')}`,offerId=uuid(),
        offer=await one(`INSERT INTO offers(id,offer_reference,opportunity_id,listing_id,offer_type,currency,owner_id,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [offerId,offerReference,opportunity.id,listing.id,checked.value.offerType,checked.value.currency,opportunity.ownerId,req.broker.id],client);
      const revision=await createOfferRevisionRecords({client,req,offer,opportunity,listing,customer,input:checked.value,revisionNumber:1,supersedesRevisionId:null});storageKey=revision.storageKey;
      await execute('UPDATE offers SET current_revision_id=$1,updated_at=NOW() WHERE id=$2',[revision.id,offer.id],client);
      await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,actor_id)
        VALUES($1,$2,$3,$4,'created','internal',$5,$6,$7)`,
        [uuid(),offer.id,revision.id,revision.documentVersionId,checked.value.proposerRole,'Offer created with immutable Revision 1 and exact generated document',req.broker.id],client);
      await execute(`UPDATE opportunities SET stage='Offer',listing_id=$1,next_action='Review and send the exact offer revision',
        next_action_due_at=LEAST(next_action_due_at,NOW()+INTERVAL '1 day'),version=version+1,updated_at=NOW() WHERE id=$2`,[listing.id,opportunity.id],client);
      if(opportunity.stage!=='Offer')await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,$3,'Offer','offer_created',$4,$5)`,[uuid(),opportunity.id,opportunity.stage,`Offer ${offerReference} created for ${listing.project}`,req.broker.id],client);
      await audit('Offer',offer.id,'created',req.broker.id,{opportunityId:opportunity.id,listingId:listing.id,offerReference,revisionId:revision.id,documentVersionId:revision.documentVersionId,fileHash:revision.fileHash},client);
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
      if(['accepted','rejected','expired','withdrawn'].includes(offer.status))return {code:409,error:'A terminal offer cannot receive another revision'};
      if(Number(req.body?.expectedVersion)!==offer.version)return {code:409,error:'This offer changed after it was opened; reload before revising it'};
      const prior=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client),
        revisionNumber=prior.revisionNumber+1,checked=validateOfferRevision({...req.body,offerType:offer.offerType},revisionNumber);
      if(checked.error)return {code:400,error:checked.error};
      const opportunity=await opportunityWithParticipants(offer.opportunityId,client),listing=await one('SELECT * FROM listings WHERE id=$1',[offer.listingId],client),
        customer=await one('SELECT * FROM contacts WHERE id=$1',[offer.contactId],client),
        revision=await createOfferRevisionRecords({client,req,offer,opportunity,listing,customer,input:checked.value,revisionNumber,supersedesRevisionId:prior.id});storageKey=revision.storageKey;
      const status=offerStatusAfterRevision(checked.value.direction),updated=await one(`UPDATE offers SET current_revision_id=$1,status=$2,
        version=version+1,updated_at=NOW() WHERE id=$3 AND version=$4 RETURNING *`,[revision.id,status,offer.id,offer.version],client);
      await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,reason,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid(),offer.id,revision.id,revision.documentVersionId,'material_correction',checked.value.direction,checked.value.proposerRole,
          `Immutable Revision ${revisionNumber} created`,checked.value.materialCorrectionReason,req.broker.id],client);
      if(checked.value.direction==='inbound')await execute(`UPDATE opportunities SET stage='Negotiation',next_action='Review counteroffer and record response',
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
    counterpartyRole=req.body?.counterpartyRole,expectedVersion=Number(req.body?.expectedVersion);
  if(!recipientName&&!legacyRecipient)return res.status(400).json({error:'Recipient name is required'});
  if(!recipientEmail&&!recipientPhone&&!legacyRecipient)return res.status(400).json({error:'Recipient email or phone is required'});
  if(/^email$/i.test(deliveryChannel)&&!recipientEmail&&!legacyRecipient)return res.status(400).json({error:'Recipient email is required for Email delivery'});
  if(/^whatsapp$/i.test(deliveryChannel)&&!recipientPhone&&!legacyRecipient)return res.status(400).json({error:'Recipient phone is required for WhatsApp delivery'});
  if(!recipient||!deliveryChannel||!OFFER_COUNTERPARTY_ROLES.includes(counterpartyRole))return res.status(400).json({error:'Recipient, delivery channel and counterparty are required'});
  const result=await transaction(async client=>{
    const {offer,error}=await offerContext(req,req.params.offerId,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,{...offer,ownerId:offer.opportunityOwnerId,createdBy:offer.opportunityCreatedBy}))return {code:403,error:'Offer is outside your writable scope'};
    if(offer.status!=='draft'||offer.version!==expectedVersion)return {code:409,error:'Only the current draft revision can be sent; reload before sending'};
    const revision=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client);
    if(!revision||revision.direction!=='outbound')return {code:409,error:'Create an outbound revision before sending'};
    if(new Date(revision.validityExpiresAt)<=new Date())return {code:409,error:'This revision has expired; create a new immutable revision before sending'};
    const updated=await one(`UPDATE offers SET status='sent',sent_at=NOW(),version=version+1,updated_at=NOW()
      WHERE id=$1 AND version=$2 RETURNING *`,[offer.id,offer.version],client);
    await execute("UPDATE document_versions SET status='sent',sent_at=NOW(),recipient=$1,immutable=1 WHERE id=$2",[recipient,revision.documentVersionId],client);
    await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,delivery_channel,delivery_recipient,actor_id)
      VALUES($1,$2,$3,$4,'sent','outbound',$5,$6,$7,$8,$9)`,
      [uuid(),offer.id,revision.id,revision.documentVersionId,counterpartyRole,`Exact Revision ${revision.revisionNumber} sent to ${recipient}`,deliveryChannel,recipient,req.broker.id],client);
    await execute(`UPDATE opportunities SET stage='Negotiation',next_action='Confirm offer receipt and record negotiation response',
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
    if(offer.version!==expectedVersion)return {code:409,error:'This offer changed after it was opened; reload before recording the negotiation event'};
    const checked=validateOfferEvent(offer.status,req.body||{});if(checked.error)return {code:409,error:checked.error};
    const v=checked.value,revision=await one('SELECT * FROM offer_revisions WHERE id=$1 AND offer_id=$2',[offer.currentRevisionId,offer.id],client),
      nextStatus=v.eventType==='acknowledged'?'viewed':v.eventType,terminalAt={
        accepted:'accepted_at',rejected:'rejected_at',expired:'expired_at',withdrawn:'withdrawn_at',viewed:'viewed_at',acknowledged:'viewed_at'
      }[v.eventType],sets=["status=$1","version=version+1","updated_at=NOW()"],params=[nextStatus];
    const validityExpired=new Date(revision.validityExpiresAt)<=new Date();
    if(v.eventType==='accepted'&&validityExpired)return {code:409,error:'This revision has expired and cannot be accepted'};
    if(v.eventType==='expired'&&!validityExpired)return {code:409,error:'This revision remains valid; record withdrawal or rejection instead'};
    if(terminalAt)sets.push(`${terminalAt}=NOW()`);
    if(v.eventType==='accepted'){params.push(revision.id);sets.push(`accepted_revision_id=$${params.length}`);}
    params.push(offer.id,offer.version);
    const updated=await one(`UPDATE offers SET ${sets.join(',')} WHERE id=$${params.length-1} AND version=$${params.length} RETURNING *`,params,client);
    await execute(`INSERT INTO negotiation_events(id,offer_id,offer_revision_id,document_version_id,event_type,direction,counterparty_role,summary,reason,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(),offer.id,revision.id,revision.documentVersionId,v.eventType,v.direction,v.counterpartyRole,v.summary,v.reason,req.broker.id],client);
    const nextAction=v.eventType==='accepted'?'Begin booking and reservation only after R2.3B is enabled':
      ['rejected','expired','withdrawn'].includes(v.eventType)?'Review outcome and decide whether to create a new offer':'Continue negotiation and record the next exact revision';
    await execute('UPDATE opportunities SET next_action=$1,next_action_due_at=NOW()+INTERVAL \'1 day\',version=version+1,updated_at=NOW() WHERE id=$2',[nextAction,offer.opportunityId],client);
    await audit('NegotiationEvent',offer.id,v.eventType,req.broker.id,{offerRevisionId:revision.id,documentVersionId:revision.documentVersionId,reason:v.reason,counterpartyRole:v.counterpartyRole},client);
    return updated;
  });if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/leads/:id/opportunities',async(req,res)=>{
  const checked=validateOpportunityCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{
    const result=await transaction(async client=>{
      const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
      if(!lead)return {code:404,error:'Lead not found'};
      if(!canReadLead(req.broker,lead))return {code:403,error:'Lead is outside your permitted scope'};
      if(!canCreateOpportunity(req.broker,lead))return {code:403,error:'Only the assigned Sales Agent, managed-team Manager or Administrator can create this opportunity'};
      if(!['Qualified','Viewing','Negotiation','Won'].includes(lead.stage))return {code:409,error:'Complete qualification before creating an opportunity'};
      if(!lead.assignedTo)return {code:409,error:'Assign the qualified lead to a responsible Sales Agent before creating an opportunity'};
      const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR SHARE',[lead.id],client);
      if(!requirement)return {code:409,error:'A current structured requirement is required before creating an opportunity'};
      const assessment=await one('SELECT * FROM qualification_assessments WHERE lead_id=$1 ORDER BY assessed_at DESC LIMIT 1',[lead.id],client);
      if(!assessment)return {code:409,error:'A recorded qualification assessment is required before creating an opportunity'};
      const input=checked.value;
      if(input.listingId&&!await one("SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL AND workflow_status='approved'",[input.listingId],client))return {code:409,error:'Select approved active inventory or leave the property unselected'};
      const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code;
      const counter=await one(`INSERT INTO opportunity_number_counters(period_code,last_value) VALUES($1,1)
        ON CONFLICT(period_code) DO UPDATE SET last_value=opportunity_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client);
      const opportunityReference=`NYSA-OP-${period}-${String(counter.lastValue).padStart(6,'0')}`,id=uuid();
      const opportunity=await one(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,qualification_assessment_id,
        listing_id,assigned_team_id,owner_id,title,transaction_type,priority,next_action,next_action_due_at,created_from_legacy_stage,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [id,opportunityReference,lead.id,lead.contactId,requirement.id,assessment.id,input.listingId,lead.assignedTeamId,lead.assignedTo,
          input.title,input.transactionType,input.priority,input.nextAction,input.nextActionDueAt,['Viewing','Negotiation','Won'].includes(lead.stage)?lead.stage:null,req.broker.id],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,'Requirements','opportunity_created',$3,$4)`,[uuid(),id,input.serviceOpportunityReason,req.broker.id],client);
      await execute(`INSERT INTO opportunity_participants(id,opportunity_id,broker_id,participation_role,added_by)
        VALUES($1,$2,$3,'owner',$4)`,[uuid(),id,lead.assignedTo,req.broker.id],client);
      await execute(`INSERT INTO opportunity_assignment_history(id,opportunity_id,to_team_id,to_owner_id,change_scope,reason,changed_by)
        VALUES($1,$2,$3,$4,'opportunity_only','Initial owner captured from the qualified lead when the opportunity was created',$5)`,
        [uuid(),id,lead.assignedTeamId,lead.assignedTo,req.broker.id],client);
      const attribution=buildOpportunityAttribution(lead);
      const attributionId=uuid();
      await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,campaign_code,external_source_id,source_page,source_form,
        originating_listing_id,provenance_snapshot,provenance_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [attributionId,id,lead.id,attribution.source,attribution.campaignCode,attribution.externalSourceId,attribution.sourcePage,attribution.sourceForm,
          attribution.originatingListingId,JSON.stringify(attribution.provenanceSnapshot),attribution.provenanceHash],client);
      await execute(`UPDATE r2_legacy_lead_review SET review_status='linked_after_review',linked_opportunity_id=$1,reviewed_by=$2,
        reviewed_at=NOW(),review_note='Opportunity created explicitly after scoped review' WHERE lead_id=$3 AND review_status='pending'`,[id,req.broker.id,lead.id],client);
      await audit('Opportunity',id,'created',req.broker.id,{leadId:lead.id,opportunityReference,requirementId:requirement.id,qualificationAssessmentId:assessment.id,legacyLeadStage:lead.stage,serviceOpportunityConfirmed:true,serviceOpportunityReason:input.serviceOpportunityReason},client);
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
    const updated=await one(`UPDATE opportunities SET stage=$1,lost_reason_code=$2,lost_reason=$3,closed_at=CASE WHEN $4 THEN NOW() ELSE NULL END,
      version=version+1,updated_at=NOW() WHERE id=$5 AND version=$6 RETURNING *`,[next.toStage,next.reasonCode,next.reason,closed,opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    const historyId=uuid();await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[historyId,opportunity.id,opportunity.stage,next.toStage,next.reasonCode,next.reason,req.broker.id],client);
    await audit('OpportunityStage',historyId,'changed',req.broker.id,{opportunityId:opportunity.id,from:opportunity.stage,to:next.toStage,reasonCode:next.reasonCode,reason:next.reason},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'Another open Requirements opportunity conflicts with this return; review the lead opportunities'});throw error;}
});

r.patch('/crm/opportunities/:id/next-action',async(req,res)=>{
  const nextAction=clean(req.body?.nextAction),due=new Date(req.body?.nextActionDueAt),expectedVersion=Number(req.body?.expectedVersion);
  if(!nextAction||Number.isNaN(due.valueOf())||!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'Next action, valid due time and current version are required'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(['Closed Won','Closed Lost'].includes(opportunity.stage))return {code:409,error:'A closed opportunity cannot receive a new next action'};
    const updated=await one(`UPDATE opportunities SET next_action=$1,next_action_due_at=$2,version=version+1,updated_at=NOW()
      WHERE id=$3 AND version=$4 RETURNING *`,[nextAction,due.toISOString(),opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    await audit('Opportunity',opportunity.id,'next_action_updated',req.broker.id,{nextAction,nextActionDueAt:due.toISOString()},client);return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
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

r.get('/crm/operations/guided-work',async(req,res)=>{
  const canCoordinateAssignment=req.broker.role==='admin'||['director','manager'].includes(req.broker.jobRole);
  const nextCaseResponsibility=req.broker.jobRole==='manager'?"AND l.assigned_to IS NULL AND l.assignment_status IN ('unassigned','reassignment_due')":'';
  const leadParams=[],leadScope=agentWorkLeadScopeSql('l',req.broker,leadParams),opportunityParams=[],opportunityScope=opportunityScopeSql('o',req.broker,opportunityParams),
    nextParams=[],nextLeadScope=agentWorkLeadScopeSql('l',req.broker,nextParams),nextOpportunityScope=opportunityScopeSql('x',req.broker,nextParams);
  const [leadCounts,opportunityCounts,nextCases]=await Promise.all([
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
      COUNT(*) FILTER(WHERE o.stage NOT IN ('Closed Won','Closed Lost') AND o.next_action_due_at<NOW())::int AS overdue
      FROM opportunities o WHERE ${opportunityScope.clause}`,opportunityScope.params),
    many(`SELECT l.id AS lead_id,l.title,c.full_name AS customer_name,l.stage AS lead_stage,l.assigned_to,l.accepted_at,
      assignment_offer.offered_at AS assignment_offered_at,
      b.name AS owner_name,manager.name AS responsible_manager_name,o.id AS opportunity_id,o.opportunity_reference,o.stage AS opportunity_stage,
      CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN 'Accept assignment'
        ELSE COALESCE(o.next_action,CASE WHEN l.assigned_to IS NULL THEN 'Assignment requires manager action'
        WHEN NOT EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL) THEN 'Record structured requirements'
        WHEN NOT EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id) THEN 'Complete qualification'
        WHEN l.stage IN ('Qualified','Viewing','Negotiation','Won') THEN 'Create or review Opportunity'
        ELSE 'Continue Lead follow-up' END) END AS next_action,
      CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN COALESCE(assignment_offer.acceptance_due_at,l.acceptance_due_at)
        ELSE COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) END AS due_at
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
      LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers manager ON manager.id=t.manager_id
      LEFT JOIN LATERAL (SELECT la.offered_at,la.acceptance_due_at FROM lead_assignments la WHERE la.lead_id=l.id AND la.superseded_at IS NULL AND la.status='offered' ORDER BY la.sequence_no DESC LIMIT 1) assignment_offer ON TRUE
      LEFT JOIN LATERAL (SELECT x.* FROM opportunities x WHERE x.lead_id=l.id AND ${nextOpportunityScope.clause} AND x.stage NOT IN ('Closed Won','Closed Lost') ORDER BY x.next_action_due_at LIMIT 1) o ON TRUE
      WHERE ${nextLeadScope.clause} AND l.stage NOT IN ('Won','Lost') ${nextCaseResponsibility}
      ORDER BY CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN l.assigned_to IS NOT NULL AND l.accepted_at IS NULL THEN COALESCE(assignment_offer.acceptance_due_at,l.acceptance_due_at) ELSE COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) END NULLS LAST,
        l.updated_at DESC LIMIT 50`,nextLeadScope.params)
  ]);
  const guidedCases=nextCases.map(item=>item.assignedTo?{...item,actionHint:item.acceptedAt?'Open connected case':'Open Lead to accept or reject'}:{
    ...item,
    nextAction:canCoordinateAssignment?'Assign a responsible agent':`Await assignment by ${item.responsibleManagerName||'your manager'}`,
    actionHint:canCoordinateAssignment?'Open Lead and review reassignment':'Manager-controlled; open Lead context only'
  });
  const steps=[
    {code:'customer',label:'Customer',status:'completed',count:leadCounts.customers,action:'Open the linked customer record'},
    {code:'lead',label:'Lead',status:leadCounts.unassigned?'blocked':'current',count:leadCounts.leads,action:leadCounts.unassigned?(canCoordinateAssignment?`${leadCounts.unassigned} need assignment`:`${leadCounts.unassigned} awaiting manager assignment`):'Continue customer follow-up'},
    {code:'qualification',label:'Qualification',status:leadCounts.qualified?'current':'ready',count:leadCounts.qualified,action:'Complete requirements and approved qualification'},
    {code:'opportunity',label:'Opportunity',status:leadCounts.readyOpportunities?'ready':opportunityCounts.active?'current':'blocked',count:opportunityCounts.active,action:leadCounts.readyOpportunities?`${leadCounts.readyOpportunities} qualified lead${leadCounts.readyOpportunities===1?' is':'s are'} ready`:opportunityCounts.overdue?`${opportunityCounts.overdue} next action${opportunityCounts.overdue===1?' is':'s are'} overdue`:'Create from a qualified lead'},
    {code:'matching',label:'Match',status:opportunityCounts.matching?'current':opportunityCounts.viewing?'completed':opportunityCounts.requirements?'ready':'blocked',count:opportunityCounts.matching,action:opportunityCounts.requirements?`${opportunityCounts.requirements} ready for matching`:'Review explainable property matches'},
    {code:'viewing',label:'Viewing',status:opportunityCounts.viewing?'current':opportunityCounts.matching?'ready':'blocked',count:opportunityCounts.viewing,action:opportunityCounts.matching?'Shortlist a property and schedule a viewing':'Record attendance, feedback and follow-up'},
    {code:'offer',label:'Offer',status:opportunityCounts.acceptedOffers?'completed':opportunityCounts.offers?'current':opportunityCounts.viewing?'ready':'blocked',count:opportunityCounts.offers,action:opportunityCounts.acceptedOffers?'Accepted offer is ready for the separately controlled booking slice':opportunityCounts.offers?'Review exact revision and negotiation timeline':'Create immutable terms from an active Opportunity'},
    ...['Booking','Deal'].map(label=>({code:label.toLowerCase(),label,status:'not_available',count:0,action:'Available in a later Release 2 slice'}))
  ];
  res.json({role:req.broker.jobRole,steps,nextCases:guidedCases,dataAsOf:new Date(),releaseBoundary:'R2.3A enables immutable offers and chronological negotiation; Booking and Deal remain unavailable'});
});

export default r;
