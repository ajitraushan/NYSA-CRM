import {Router} from '../lib/http-kit.js';
import {requireAuth} from '../auth.js';
import {one,many,execute,transaction,uuid,audit} from '../db.js';
import {hasInternalCrmIdentity,canReadOpportunity,canWriteOpportunity,isManager,opportunityScopeSql} from '../crm-policy.js';
import {prepareCustomerShortlist} from '../customer-shortlist-domain.js';
import {prepareGovernedSharePreflight} from '../governed-share-preflight-domain.js';
import {evaluateInventoryEligibilityV2} from '../inventory-eligibility-domain.js';
import {inventoryEvaluatorProjection} from '../inventory-eligibility-service.js';
import {
  RELEASE3C_POLICY_VERSION,deriveTransactionalSharePolicy,prepareGovernedResponseEvidence,release3cEvidenceHash,
  validateGovernedShareCancellation,validateGovernedSharePrepareRequest,validateGovernedShareReportQuery
} from '../release3c-crm-integration-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({code:'outside_write_scope',error:'Governed property sharing is restricted to NYSA staff'}));
const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

async function opportunityContext(id,client){
  const opportunity=await one(`SELECT o.*,c.lifecycle_status,c.do_not_contact,c.archived_at,req.version_no AS requirement_version,
    EXISTS(SELECT 1 FROM brokers owner WHERE owner.id=o.owner_id AND owner.status='active') AS owner_active
    FROM opportunities o JOIN contacts c ON c.id=o.contact_id JOIN lead_requirements req ON req.id=o.requirement_id
    WHERE o.id=$1`,[id],client);
  if(!opportunity)return null;
  opportunity.participantIds=(await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active',[id],client)).map(row=>row.brokerId);
  return opportunity;
}
async function scopedOpportunity(req,client,write=false){
  const opportunity=await opportunityContext(req.params.id,client);
  if(!opportunity)return{error:[404,'opportunity_not_found','Opportunity not found']};
  if(!(write?canWriteOpportunity(req.broker,opportunity):canReadOpportunity(req.broker,opportunity)))return{error:[403,'outside_write_scope',`Opportunity is outside your ${write?'writable':'permitted'} scope`]};
  return{opportunity};
}
const sendError=(res,result)=>res.status(result.error[0]).json({code:result.error[1],error:result.error[2]});

async function loadGovernedShare(shareId,opportunityId,client){
  const share=await one(`SELECT id,opportunity_id,governed_contract_version,preflight_version,matching_run_id,requirement_id,
    requirement_version_no,request_fingerprint,shortlist_evidence_hash,preflight_evidence_hash,policy_decision_id,
    template_reference,prepared_at,preflight_expires_at,governed_status,version,created_by,created_at
    FROM opportunity_property_shares WHERE id=$1 AND opportunity_id=$2 AND governed_contract_version IS NOT NULL`,[shareId,opportunityId],client);
  if(!share)return null;
  const items=await many(`SELECT id,share_id,property_match_id,listing_id,matching_candidate_id,match_decision_id,
    property_reference,sequence_no,property_snapshot,shortlist_property_evidence_hash,eligibility_checked_at,
    eligibility_evidence_hash FROM opportunity_property_share_items WHERE share_id=$1 ORDER BY sequence_no`,[share.id],client);
  return{...share,status:share.governedStatus,items,automaticSend:false,connectorEnabled:false};
}

r.get('/crm/opportunities/:id/governed-property-share-options',async(req,res)=>{
  const scoped=await scopedOpportunity(req,undefined,false);if(scoped.error)return sendError(res,scoped);const opportunity=scoped.opportunity;
  const options=await many(`SELECT DISTINCT ON(pm.id) pm.id AS property_match_id,c.id AS matching_candidate_id,d.id AS match_decision_id,
    l.id AS listing_id,l.inventory_reference,l.project,l.area,l.community,l.property_type,l.bedrooms,l.size_sqft,l.price,l.currency,
    c.fit_label,c.score,r.checked_at,d.live_checked_at,l.availability_confirmed_at
    FROM property_matches pm JOIN listings l ON l.id=pm.listing_id
    JOIN inventory_matching_candidates c ON c.listing_id=pm.listing_id AND c.eligibility_status='eligible'
    JOIN inventory_matching_runs r ON r.id=c.run_id AND r.opportunity_id=pm.opportunity_id AND r.requirement_id=$2
    JOIN LATERAL(SELECT decision.id,decision.decision,decision.live_checked_at FROM inventory_match_decisions decision
      WHERE decision.candidate_id=c.id ORDER BY decision.sequence_no DESC LIMIT 1)d ON d.decision='shortlisted'
    WHERE pm.opportunity_id=$1 AND pm.requirement_id=$2 AND pm.external_property_id IS NULL AND pm.shortlist_status<>'rejected'
    ORDER BY pm.id,r.created_at DESC`,[opportunity.id,opportunity.requirementId]);
  res.json({options,maxProperties:6,internalInventoryOnly:true,preparedNotSentOnly:true,automaticSend:false,connectorEnabled:false});
});

r.post('/crm/opportunities/:id/governed-property-shares',async(req,res)=>{
  const checked=validateGovernedSharePrepareRequest(req.body||{});if(checked.error)return res.status(400).json({code:'invalid_request',error:checked.error});
  try{const result=await transaction(async client=>{
    const scoped=await scopedOpportunity(req,client,true);if(scoped.error)return{error:scoped.error};const opportunity=scoped.opportunity,v=checked.value;
    if(Number(opportunity.version)!==v.expectedOpportunityVersion)return{error:[409,'stale_version','Opportunity changed after it was opened']};
    const requestFingerprint=release3cEvidenceHash({opportunityId:opportunity.id,expectedOpportunityVersion:v.expectedOpportunityVersion,title:v.title,
      selections:[...v.selections].sort((a,b)=>a.propertyMatchId.localeCompare(b.propertyMatchId))});
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[requestFingerprint],client);
    const existing=await one(`SELECT id FROM opportunity_property_shares
      WHERE request_fingerprint=$1 AND governed_contract_version IS NOT NULL`,[requestFingerprint],client);
    if(existing)return{share:await loadGovernedShare(existing.id,opportunity.id,client),idempotentReplay:true};
    const propertyMatchIds=v.selections.map(item=>item.propertyMatchId),candidateIds=v.selections.map(item=>item.matchingCandidateId),decisionIds=v.selections.map(item=>item.matchDecisionId);
    const rows=await many(`SELECT pm.id AS property_match_id,pm.listing_id,pm.external_property_id,pm.requirement_id AS property_match_requirement_id,
      pm.shortlist_status AS property_match_shortlist_status,c.id AS candidate_id,c.run_id,c.eligibility_status,
      c.score,c.fit_label,c.listing_snapshot,c.criteria,c.evidence,d.id AS decision_id,d.decision,d.live_checked_at,d.live_eligibility,
      r.requirement_id,r.opportunity_id AS run_opportunity_id,r.requirement_snapshot,${inventoryEvaluatorProjection('l')},
      EXISTS(SELECT 1 FROM bookings booking WHERE booking.listing_id=l.id AND booking.status='reserved' AND booking.expires_at>NOW() AND booking.opportunity_id<>$1) AS active_reservation
      FROM property_matches pm JOIN inventory_matching_candidates c ON c.listing_id=pm.listing_id
      JOIN inventory_matching_runs r ON r.id=c.run_id JOIN inventory_match_decisions d ON d.candidate_id=c.id
      JOIN listings l ON l.id=pm.listing_id
      WHERE pm.opportunity_id=$1 AND pm.id=ANY($2::uuid[]) AND c.id=ANY($3::uuid[]) AND d.id=ANY($4::uuid[])
      ORDER BY l.id FOR UPDATE OF pm,c,d,l`,[opportunity.id,propertyMatchIds,candidateIds,decisionIds],client);
    if(rows.length!==v.selections.length)return{error:[409,'selection_not_current','Every selection must resolve to the same Opportunity, candidate, decision and Internal Inventory record']};
    if(new Set(rows.map(row=>row.runId)).size!==1)return{error:[409,'selection_not_current','Every selected candidate must belong to one governed matching run']};
    for(const selection of v.selections){const row=rows.find(item=>item.propertyMatchId===selection.propertyMatchId&&item.candidateId===selection.matchingCandidateId&&item.decisionId===selection.matchDecisionId);
      if(!row||row.externalPropertyId||row.propertyMatchRequirementId!==opportunity.requirementId||row.propertyMatchShortlistStatus==='rejected'||
        row.eligibilityStatus!=='eligible'||row.decision!=='shortlisted'||row.runOpportunityId!==opportunity.id||row.requirementId!==opportunity.requirementId)
        return{error:[409,'selection_not_current','A selection is no longer the accepted current Internal Inventory chain']};
      const assessments=await many(`SELECT DISTINCT ON(declaration_kind,declaration_index) * FROM inventory_match_candidate_assessments
        WHERE candidate_id=$1 ORDER BY declaration_kind,declaration_index,sequence_no DESC`,[row.candidateId],client),eligibility=evaluateInventoryEligibilityV2({listing:row,
          requirement:row.requirementSnapshot,opportunityTransactionType:opportunity.transactionType,assessments,checkedAt:new Date().toISOString()});
      if(!eligibility.eligible)return{error:[409,'inventory_ineligible','Current Inventory and declaration evidence must remain eligible before preparation']};
      const latest=await one('SELECT id FROM inventory_match_decisions WHERE candidate_id=$1 ORDER BY sequence_no DESC LIMIT 1',[row.candidateId],client);if(latest?.id!==row.decisionId)return{error:[409,'selection_not_current','A shortlist decision is no longer current']};}
    const requirement=await one('SELECT * FROM lead_requirements WHERE id=$1 AND lead_id=$2 AND superseded_at IS NULL FOR SHARE',[opportunity.requirementId,opportunity.leadId],client);
    if(!requirement||Number(requirement.versionNo)!==Number(opportunity.requirementVersion))return{error:[409,'selection_not_current','The governed requirement version is no longer current']};
    const channel=await one(`SELECT id,channel_kind,whatsapp_enabled,verification_status,restriction_status FROM contact_channels
      WHERE contact_id=$1 AND channel_kind='Phone' AND whatsapp_enabled=1 ORDER BY is_primary DESC,created_at DESC LIMIT 1`,[opportunity.contactId],client),agreement=await one(`SELECT id,status,consent_scope,permitted_channels,effective_at,expires_at FROM marketing_agreements
      WHERE contact_id=$1 AND status='executed' ORDER BY effective_at DESC LIMIT 1`,[opportunity.contactId],client),evaluatedAt=new Date(),contact={id:opportunity.contactId,
      lifecycleStatus:opportunity.lifecycleStatus,doNotContact:opportunity.doNotContact,archivedAt:opportunity.archivedAt},policyResult=deriveTransactionalSharePolicy({actorAuthorized:true,channel,agreement,contact,opportunity,actorRef:req.broker.id,evaluatedAt});
    if(policyResult.error)return{error:[409,'policy_denied',policyResult.error]};const policy=policyResult.value;
    if(policy.outcome!=='allowed'){const deniedPolicyId=uuid();await execute(`INSERT INTO communication_policy_decisions(id,contact_id,opportunity_id,contact_channel_id,actor_id,channel,purpose,
      policy_version,outcome,reason_codes,actor_authorized,channel_eligible,consent_permits,restriction_clear,subject_eligible,consent_evidence_reference,
      evaluated_at,valid_until,evidence_hash) VALUES($1,$2,$3,$4,$5,'whatsapp','transactional_share',$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [deniedPolicyId,opportunity.contactId,opportunity.id,channel?.id||null,req.broker.id,RELEASE3C_POLICY_VERSION,policy.outcome,JSON.stringify(policy.reasonCodes),
        policy.checks.actorAuthorized?1:0,policy.checks.channelEligible?1:0,policy.checks.consentPermits?1:0,policy.checks.restrictionClear?1:0,
        policy.checks.subjectEligible?1:0,policy.consentEvidenceReference,policy.evaluatedAt,policy.validUntil,policy.evidenceHash],client);
      await audit('CommunicationPolicyDecision',deniedPolicyId,'denied',req.broker.id,{opportunityId:opportunity.id,reasonCodes:policy.reasonCodes,evidenceHash:policy.evidenceHash},client);
      return{error:[409,'policy_denied',`Communication policy denied: ${policy.reasonCodes.join(', ')}`]};}
    const ordered=v.selections.map(selection=>rows.find(item=>item.propertyMatchId===selection.propertyMatchId));
    for(const row of ordered)row.floorPlans=await many(`SELECT id::text AS asset_reference,title AS label,'approved'::text AS approval_status,'cleared'::text AS rights_status FROM property_media WHERE listing_id=$1
      AND media_kind='floor_plan' AND approval_status='approved' AND usage_rights_confirmed=TRUE
      AND (rights_expires_at IS NULL OR rights_expires_at>NOW()) ORDER BY display_order,created_at`,[row.listingId],client);
    const policyId=uuid(),liveInventory=ordered.map(row=>({...row,marketEvidence:null})),matchingRun={id:ordered[0].runId,requirementSnapshot:ordered[0].requirementSnapshot,candidates:ordered.map(row=>({id:row.candidateId,
      listingId:row.listingId,eligibilityStatus:row.eligibilityStatus,score:row.score,fitLabel:row.fitLabel,listingSnapshot:row.listingSnapshot,criteria:row.criteria,evidence:row.evidence}))},
      decisions=ordered.map(row=>({candidateId:row.candidateId,listingId:row.listingId,decision:row.decision})),shortlistResult=await prepareCustomerShortlist({
        matchingRun,selectedCandidateIds:ordered.map(row=>row.candidateId),decisions,liveInventory,checkedAt:policy.evaluatedAt,title:v.title,preparedBy:req.broker.id,brokerReviewConfirmed:true});
    if(shortlistResult.error)return{error:[409,'inventory_ineligible',shortlistResult.error]};const shortlist=shortlistResult.value,preflightResult=await prepareGovernedSharePreflight({
      checkedAt:policy.evaluatedAt,shortlist,liveInventory,policyDecision:{...policy,id:policyId},actorRef:req.broker.id,subjectRef:opportunity.contactId,scopeRef:opportunity.id});
    if(preflightResult.error)return{error:[409,preflightResult.changes?'customer_fact_drift':'inventory_ineligible',preflightResult.error]};const preflight=preflightResult.value,shareId=uuid();
    await execute(`INSERT INTO communication_policy_decisions(id,contact_id,opportunity_id,contact_channel_id,actor_id,channel,purpose,
      policy_version,outcome,reason_codes,actor_authorized,channel_eligible,consent_permits,restriction_clear,subject_eligible,consent_evidence_reference,
      evaluated_at,valid_until,evidence_hash) VALUES($1,$2,$3,$4,$5,'whatsapp','transactional_share',$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [policyId,opportunity.contactId,opportunity.id,channel.id,req.broker.id,RELEASE3C_POLICY_VERSION,policy.outcome,JSON.stringify(policy.reasonCodes),
        policy.checks.actorAuthorized?1:0,policy.checks.channelEligible?1:0,policy.checks.consentPermits?1:0,policy.checks.restrictionClear?1:0,
        policy.checks.subjectEligible?1:0,policy.consentEvidenceReference,policy.evaluatedAt,policy.validUntil,policy.evidenceHash],client);
    await execute(`INSERT INTO opportunity_property_shares(id,opportunity_id,channel,status,created_by,governed_contract_version,preflight_version,matching_run_id,
      requirement_id,requirement_version_no,request_fingerprint,shortlist_evidence_hash,preflight_evidence_hash,policy_decision_id,template_reference,prepared_at,
      preflight_expires_at,governed_status) VALUES($1,$2,'whatsapp','prepared',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'prepared_not_sent')`,
      [shareId,opportunity.id,req.broker.id,shortlist.policyVersion,preflight.version,ordered[0].runId,opportunity.requirementId,opportunity.requirementVersion,
        requestFingerprint,shortlist.evidenceHash,preflight.evidenceHash,policyId,preflight.templateRef,preflight.checkedAt,preflight.expiresAt],client);
    for(let index=0;index<ordered.length;index++){const row=ordered[index],card=shortlist.properties[index],eligibilityEvidence={checkedAt:preflight.checkedAt,
      listingId:row.listingId,eligible:true,liveEligibility:row.liveEligibility},propertyEvidenceHash=release3cEvidenceHash(card);
      await execute(`INSERT INTO opportunity_property_share_items(id,share_id,property_match_id,listing_id,property_snapshot,matching_candidate_id,match_decision_id,
        property_reference,sequence_no,shortlist_property_evidence_hash,eligibility_checked_at,eligibility_evidence_hash)
        VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,[uuid(),shareId,row.propertyMatchId,row.listingId,JSON.stringify(card),row.candidateId,row.decisionId,
        card.reference,index+1,propertyEvidenceHash,preflight.checkedAt,release3cEvidenceHash(eligibilityEvidence)],client);}
    const eventEvidence={shareId,eventType:'prepared',preflightEvidenceHash:preflight.evidenceHash,occurredAt:preflight.checkedAt};
    await execute(`INSERT INTO opportunity_property_share_events(id,share_id,event_type,source,occurred_at,actor_id,evidence_hash,evidence)
      VALUES($1,$2,'prepared','crm_local',$3,$4,$5,$6::jsonb)`,[uuid(),shareId,preflight.checkedAt,req.broker.id,release3cEvidenceHash(eventEvidence),JSON.stringify(eventEvidence)],client);
    await audit('OpportunityPropertyShare',shareId,'governed_prepared',req.broker.id,{opportunityId:opportunity.id,requestFingerprint,shortlistEvidenceHash:shortlist.evidenceHash,
      preflightEvidenceHash:preflight.evidenceHash,itemCount:ordered.length,automaticSend:false,connectorEnabled:false},client);
    return{share:await loadGovernedShare(shareId,opportunity.id,client),idempotentReplay:false};
  });if(result.error)return sendError(res,result);res.status(result.idempotentReplay?200:201).json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({code:'evidence_collision',error:'Concurrent governed evidence already exists; reload the Opportunity'});throw error;}
});

r.post('/crm/opportunities/:id/governed-property-shares/:shareId/cancel',async(req,res)=>{
  const checked=validateGovernedShareCancellation(req.body||{});if(checked.error)return res.status(400).json({code:'invalid_request',error:checked.error});
  const result=await transaction(async client=>{const scoped=await scopedOpportunity(req,client,true);if(scoped.error)return{error:scoped.error};
    const share=await one(`SELECT * FROM opportunity_property_shares WHERE id=$1 AND opportunity_id=$2 AND governed_contract_version IS NOT NULL FOR UPDATE`,[req.params.shareId,scoped.opportunity.id],client);
    if(!share)return{error:[404,'share_not_found','Governed property share not found']};if(share.governedStatus==='cancelled')return{share:await loadGovernedShare(share.id,scoped.opportunity.id,client),idempotentReplay:true};
    if(Number(share.version)!==checked.value.expectedVersion)return{error:[409,'stale_version','Governed property share changed after it was opened']};
    await execute(`UPDATE opportunity_property_shares SET governed_status='cancelled',version=version+1,updated_at=NOW() WHERE id=$1`,[share.id],client);
    const occurredAt=new Date().toISOString(),evidence={shareId:share.id,eventType:'cancelled',reason:checked.value.reason,occurredAt};
    await execute(`INSERT INTO opportunity_property_share_events(id,share_id,event_type,source,occurred_at,actor_id,evidence_hash,evidence)
      VALUES($1,$2,'cancelled','crm_local',$3,$4,$5,$6::jsonb)`,[uuid(),share.id,occurredAt,req.broker.id,release3cEvidenceHash(evidence),JSON.stringify(evidence)],client);
    await audit('OpportunityPropertyShare',share.id,'governed_cancelled',req.broker.id,{opportunityId:scoped.opportunity.id,reason:checked.value.reason},client);
    return{share:await loadGovernedShare(share.id,scoped.opportunity.id,client),idempotentReplay:false};});
  if(result.error)return sendError(res,result);res.json(result);
});

r.post('/crm/opportunities/:id/governed-property-shares/:shareId/responses',async(req,res)=>{
  const result=await transaction(async client=>{const scoped=await scopedOpportunity(req,client,true);if(scoped.error)return{error:scoped.error};const opportunity=scoped.opportunity;
    const share=await one(`SELECT * FROM opportunity_property_shares WHERE id=$1 AND opportunity_id=$2 AND governed_contract_version IS NOT NULL FOR SHARE`,[req.params.shareId,opportunity.id],client);
    if(!share)return{error:[404,'share_not_found','Governed property share not found']};if(share.governedStatus==='cancelled')return{error:[409,'share_cancelled','Responses cannot be added to a cancelled package']};
    const item=await one(`SELECT i.*,pm.id AS governed_property_match_id FROM opportunity_property_share_items i JOIN property_matches pm ON pm.id=i.property_match_id
      WHERE i.id=$1 AND i.share_id=$2 FOR SHARE OF i`,[req.body?.shareItemId,share.id],client);if(!item)return{error:[400,'invalid_request','Select a property from the governed package']};
    const prepared=prepareGovernedResponseEvidence({shortlistEvidenceHash:share.shortlistEvidenceHash,shareItemId:item.id,propertyReference:item.propertyReference,
      recordedBy:req.broker.id,body:req.body||{},preparedAt:share.preparedAt});if(prepared.error)return{error:[400,'invalid_request',prepared.error]};const v=prepared.value;
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[v.response.evidenceHash],client);
    const existing=await one(`SELECT f.*,p.task_id FROM inventory_match_feedback f LEFT JOIN customer_response_task_provenance p ON p.match_feedback_id=f.id
      WHERE f.response_evidence_hash=$1`,[v.response.evidenceHash],client);if(existing){const task=await one('SELECT * FROM tasks WHERE id=$1',[existing.taskId],client);return{response:{id:existing.id,
        shareItemId:existing.shareItemId,outcome:existing.outcome,occurredAt:existing.occurredAt,evidenceHash:existing.responseEvidenceHash,policyVersion:existing.responsePolicyVersion},task,
        automaticViewing:false,automaticRequirementChange:false,changesOpportunityStage:false,changesInventory:false,idempotentReplay:true};}
    if(!opportunity.ownerActive)return{error:[409,'responsible_agent_unavailable','The current responsible Opportunity owner is unavailable']};
    const feedbackId=uuid(),notSuitable=v.response.notSuitableEvidence,reasonCode=v.task.reasonCode;
    await execute(`INSERT INTO inventory_match_feedback(id,candidate_id,decision_id,feedback_source,outcome,reason_code,notes,occurred_at,recorded_by,
      share_item_id,response_policy_version,response_source,response_evidence_hash,not_suitable_reason_code,preference_impact,preference_change_detail)
      VALUES($1,$2,$3,'customer_reported',$4,$5,$6,$7,$8,$9,$10,'manual_fallback',$11,$12,$13,$14)`,[feedbackId,item.matchingCandidateId,item.matchDecisionId,
        v.response.outcome,reasonCode,v.response.notes,v.response.occurredAt,req.broker.id,item.id,v.response.policyVersion,v.response.evidenceHash,
        notSuitable?.rejectionReason?.code||null,notSuitable?.preferenceImpact?.code||null,notSuitable?.preferenceChangeDetail||null],client);
    const taskId=uuid(),details='Created from immutable governed customer-response evidence. Open the Opportunity for exact property context.',task=await one(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,
      assignee_id,priority,status,due_at,created_by,task_type) VALUES($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,'customer_response_follow_up') RETURNING *`,
      [taskId,opportunity.leadId,opportunity.contactId,v.task.subject,details,opportunity.ownerId,v.task.priority,v.task.dueAt,req.broker.id],client);
    await execute(`INSERT INTO customer_response_task_provenance(id,task_id,match_feedback_id,share_id,share_item_id,opportunity_id,property_match_id,
      translation_policy_version,response_evidence_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[uuid(),taskId,feedbackId,share.id,item.id,opportunity.id,item.propertyMatchId,
        v.task.translationPolicyVersion,v.response.evidenceHash],client);
    const pointer=await one(`SELECT t.subject,t.due_at FROM customer_response_task_provenance p JOIN tasks t ON t.id=p.task_id
      WHERE p.opportunity_id=$1 AND t.status IN ('open','in_progress') ORDER BY CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3
      WHEN 'normal' THEN 2 ELSE 1 END DESC,t.due_at,t.created_at LIMIT 1`,[opportunity.id],client);
    if(pointer)await execute(`UPDATE opportunities SET next_action_code='follow_up_offer_feedback',next_action=$1,next_action_notes=$1,next_action_due_at=$2,version=version+1,updated_at=NOW() WHERE id=$3`,[pointer.subject,pointer.dueAt,opportunity.id],client);
    await audit('CustomerResponseTaskProvenance',taskId,'created',req.broker.id,{opportunityId:opportunity.id,shareId:share.id,shareItemId:item.id,
      responseEvidenceHash:v.response.evidenceHash,taskId,changesOpportunityStage:false,changesInventory:false,automaticViewing:false},client);
    return{response:{id:feedbackId,shareItemId:item.id,outcome:v.response.outcome,occurredAt:v.response.occurredAt,evidenceHash:v.response.evidenceHash,
      policyVersion:v.response.policyVersion},task,automaticViewing:false,automaticRequirementChange:false,changesOpportunityStage:false,changesInventory:false,idempotentReplay:false};
  });if(result.error)return sendError(res,result);res.status(result.idempotentReplay?200:201).json(result);
});

r.get('/crm/opportunities/:id/governed-property-shares/:shareId',async(req,res)=>{const scoped=await scopedOpportunity(req,undefined,false);if(scoped.error)return sendError(res,scoped);
  const share=await loadGovernedShare(req.params.shareId,scoped.opportunity.id);if(!share)return res.status(404).json({code:'share_not_found',error:'Governed property share not found'});
  const events=await many(`SELECT id,event_type,source,occurred_at,evidence_hash FROM opportunity_property_share_events WHERE share_id=$1 ORDER BY occurred_at,id`,[share.id]),responses=await many(`SELECT f.id,f.share_item_id,f.outcome,f.reason_code,f.occurred_at,f.response_policy_version,f.response_source,f.response_evidence_hash,
    p.task_id,t.subject AS task_subject,t.priority AS task_priority,t.status AS task_status,t.due_at AS task_due_at
    FROM inventory_match_feedback f LEFT JOIN customer_response_task_provenance p ON p.match_feedback_id=f.id LEFT JOIN tasks t ON t.id=p.task_id
    WHERE f.share_item_id=ANY($1::uuid[]) ORDER BY f.occurred_at,f.created_at`,[share.items.map(item=>item.id)]);res.json({...share,events,responses});});

r.get('/crm/reports/governed-property-shares',async(req,res)=>{if(!isManager(req.broker))return res.status(403).json({code:'report_scope_required',error:'Manager or administrator scope is required'});
  const checked=validateGovernedShareReportQuery(req.query||{});if(checked.error)return res.status(400).json({code:'invalid_request',error:checked.error});const v=checked.value,params=[v.from,v.to],scope=opportunityScopeSql('o',req.broker,params),where=[scope.clause,
    's.governed_contract_version IS NOT NULL',`s.prepared_at>=$1`,`s.prepared_at<=$2`];if(v.ownerId){params.push(v.ownerId);where.push(`o.owner_id=$${params.length}`);}
  const rows=await many(`SELECT s.id AS share_id,s.opportunity_id,s.governed_status,s.prepared_at,o.owner_id,
    COUNT(DISTINCT f.id)::int AS response_count,COUNT(DISTINCT p.task_id)::int AS reconciled_task_count,
    COUNT(DISTINCT p.task_id) FILTER(WHERE t.status IN ('open','in_progress') AND t.due_at<NOW())::int AS overdue_task_count
    FROM opportunity_property_shares s JOIN opportunities o ON o.id=s.opportunity_id LEFT JOIN opportunity_property_share_items i ON i.share_id=s.id
    LEFT JOIN inventory_match_feedback f ON f.share_item_id=i.id LEFT JOIN customer_response_task_provenance p ON p.match_feedback_id=f.id LEFT JOIN tasks t ON t.id=p.task_id
    WHERE ${where.join(' AND ')} GROUP BY s.id,o.owner_id ORDER BY s.prepared_at DESC`,params);res.json({policyVersion:'r3c-share-response-mis-v1',from:v.from,to:v.to,
      connectedStates:{shared:'unavailable',delivered:'unavailable',opened:'unavailable',providerResponses:'unavailable'},metrics:{prepared:rows.length,cancelled:rows.filter(row=>row.governedStatus==='cancelled').length,
        responses:rows.reduce((sum,row)=>sum+Number(row.responseCount),0),missingFollowUp:rows.reduce((sum,row)=>sum+Math.max(0,Number(row.responseCount)-Number(row.reconciledTaskCount)),0),
        overdueFollowUp:rows.reduce((sum,row)=>sum+Number(row.overdueTaskCount),0)},rows});});

export default r;
