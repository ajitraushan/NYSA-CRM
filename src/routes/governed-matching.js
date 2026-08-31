import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { hasInternalCrmIdentity,canReadLead,canOperateLead,canReadOpportunity,canWriteOpportunity } from '../crm-policy.js';
import { buildGovernedMatchingRunV2,validateInventoryMatchDecision,validateInventoryMatchFeedback } from '../governed-matching-domain.js';
import { evaluateInventoryEligibilityV2,declarationAssessmentReadiness,declarationHash,stableHash,validateCandidateAssessment,validateGovernedPromotion } from '../inventory-eligibility-domain.js';
import { inventoryEvaluatorProjection } from '../inventory-eligibility-service.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'Governed Inventory matching is restricted to NYSA staff'}));

async function scopedLead(req,res,write=false){
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead){res.status(404).json({error:'Lead not found'});return null;}
  const allowed=write?canOperateLead(req.broker,lead):canReadLead(req.broker,lead);
  if(!allowed){res.status(403).json({error:`Lead is outside your ${write?'writable':'permitted'} scope`});return null;}
  return lead;
}

async function loadRun(runId,leadId,client){
  const run=await one(`SELECT r.*,b.name AS requested_by_name,o.version AS opportunity_version,o.opportunity_reference,o.transaction_type
    FROM inventory_matching_runs r JOIN brokers b ON b.id=r.requested_by LEFT JOIN opportunities o ON o.id=r.opportunity_id
    WHERE r.id=$1 AND r.lead_id=$2`,[runId,leadId],client);
  if(!run)return null;
  const candidates=await many(`SELECT * FROM inventory_matching_candidates WHERE run_id=$1
    ORDER BY CASE eligibility_status WHEN 'eligible' THEN 0 ELSE 1 END,presented_rank NULLS LAST,
      listing_snapshot->>'inventoryReference'`,[run.id],client);
  const candidateIds=candidates.map(candidate=>candidate.id),decisions=candidateIds.length?await many(`SELECT d.*,b.name AS decided_by_name
    FROM inventory_match_decisions d JOIN brokers b ON b.id=d.decided_by WHERE d.candidate_id=ANY($1::uuid[])
    ORDER BY d.candidate_id,d.sequence_no`,[candidateIds],client):[],feedback=candidateIds.length?await many(`SELECT f.*,b.name AS recorded_by_name
    FROM inventory_match_feedback f JOIN brokers b ON b.id=f.recorded_by WHERE f.candidate_id=ANY($1::uuid[])
    ORDER BY f.candidate_id,f.occurred_at,f.created_at`,[candidateIds],client):[],assessments=candidateIds.length?await many(`SELECT a.*,b.name AS assessed_by_name
    FROM inventory_match_candidate_assessments a JOIN brokers b ON b.id=a.assessed_by WHERE a.candidate_id=ANY($1::uuid[])
    ORDER BY a.candidate_id,a.declaration_kind,a.declaration_index,a.sequence_no`,[candidateIds],client):[],origins=candidateIds.length?await many(`SELECT origin.*
    FROM property_match_governed_origins origin WHERE origin.candidate_id=ANY($1::uuid[])`,[candidateIds],client):[],assignments=run.opportunityId&&candidateIds.length?await many(`SELECT assignment.*
    FROM inventory_assignments assignment WHERE assignment.opportunity_id=$1 AND assignment.state='active' AND assignment.expires_at>NOW()`,[run.opportunityId],client):[];
  const liveCheckedAt=new Date().toISOString(),listingIds=candidates.map(candidate=>candidate.listingId),liveListings=listingIds.length?await many(`SELECT ${inventoryEvaluatorProjection('li')},EXISTS(SELECT 1 FROM bookings booking
    WHERE booking.listing_id=li.id AND booking.status='reserved' AND booking.expires_at>$2 AND ($3::uuid IS NULL OR booking.opportunity_id<>$3)) AS active_reservation
    FROM listings li WHERE li.id=ANY($1::uuid[])`,[listingIds,liveCheckedAt,run.opportunityId||null],client):[];
  for(const candidate of candidates){candidate.decisions=decisions.filter(item=>item.candidateId===candidate.id);candidate.latestDecision=candidate.decisions.at(-1)||null;
    candidate.feedback=feedback.filter(item=>item.candidateId===candidate.id);candidate.assessments=assessments.filter(item=>item.candidateId===candidate.id);
    candidate.governedOrigin=origins.find(item=>item.candidateId===candidate.id)||null;candidate.activeAssignment=assignments.find(item=>item.listingId===candidate.listingId)||null;const live=liveListings.find(item=>item.id===candidate.listingId);
    candidate.currentEligibility=live?evaluateInventoryEligibilityV2({listing:live,requirement:run.requirementSnapshot,opportunityTransactionType:run.transactionType,assessments:candidate.assessments,checkedAt:liveCheckedAt}):{state:'excluded',eligible:false,reasons:[{code:'inventory_missing',label:'Inventory record no longer exists'}],checkedAt:liveCheckedAt};}
  return{...run,candidates,needsClarificationCount:candidates.filter(item=>item.eligibilityStatus==='needs_clarification').length,advisoryOnly:false,governedPromotionAvailable:true,reservesInventory:false,
    websiteSuggestionsIncluded:false,inventoryStatusNotice:'Eligibility was checked at run time and must be revalidated before any operational action.'};
}

async function finishExpiredGovernedAssignment(opportunityId,listingId,client){
  const expired=await many(`UPDATE inventory_assignments SET state='expired',ended_at=expires_at,
    end_reason='Seven-day assignment period elapsed' WHERE opportunity_id=$1 AND listing_id=$2
    AND state='active' AND expires_at<=NOW() RETURNING *`,[opportunityId,listingId],client);
  for(const item of expired)await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
    VALUES($1,$2,'expired',$3,NULL,$4::jsonb)`,[uuid(),item.id,'Seven-day assignment period elapsed',JSON.stringify({expiredAt:item.expiresAt})],client);
}

async function delinkGovernedAssignmentForDecision({req,client,candidate,decision}){
  const linked=await one(`SELECT assignment.*,match.id AS match_id,match.shortlist_status FROM property_match_governed_origins origin
    JOIN property_matches match ON match.id=origin.property_match_id
    JOIN inventory_assignments assignment ON assignment.property_match_id=match.id AND assignment.state='active'
    WHERE origin.candidate_id=$1 FOR UPDATE OF assignment,match`,[candidate.id],client);
  if(!linked)return null;
  const reason=`Governed matching decision changed to ${decision.decision}: ${decision.reasonNotes}`;
  await execute("UPDATE inventory_assignments SET state='delinked',ended_at=NOW(),end_reason=$1 WHERE id=$2",[reason,linked.id],client);
  await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
    VALUES($1,$2,'delinked',$3,$4,$5::jsonb)`,[uuid(),linked.id,reason,req.broker.id,JSON.stringify({candidateId:candidate.id,
    decisionId:decision.id,decision:decision.decision})],client);
  if(decision.decision==='rejected')await execute(`UPDATE property_matches SET shortlist_status='rejected',rejected_at=NOW(),rejection_reason=$1,
    updated_by=$2,updated_at=NOW() WHERE id=$3`,[decision.reasonNotes,req.broker.id,linked.matchId],client);
  else await execute(`UPDATE property_matches SET shortlist_status='considering',shortlisted_at=NULL,updated_by=$1,updated_at=NOW() WHERE id=$2`,
    [req.broker.id,linked.matchId],client);
  await execute(`INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by)
    VALUES($1,$2,$3,$4,$5,$6)`,[uuid(),linked.matchId,linked.shortlistStatus,decision.decision==='rejected'?'rejected':'considering',reason,req.broker.id],client);
  return{...linked,state:'delinked',endReason:reason};
}

async function createGovernedMatchAndAssignment({req,client,opportunity,row,decisionId,requestId,eligibility,assessments=[]}){
  if(row.opportunityId!==opportunity.id)return{code:409,error:'This matching run belongs to a different Opportunity. Run matching from the current Opportunity and try again'};
  if(row.requirementId!==opportunity.requirementId)return{code:409,error:'This Opportunity and matching run use different Requirement Versions. Confirm and run matching from this Opportunity again'};
  const readiness=declarationAssessmentReadiness(row.requirementSnapshot,assessments),checkedAt=new Date().toISOString(),
    assessmentSnapshot=readiness.items.map(item=>({kind:item.kind,index:item.index,hash:item.hash,result:item.assessment?.result||'not_assessed',assessmentId:item.assessment?.id||null})),
    assessmentEvidenceHash=stableHash(assessmentSnapshot),fingerprint=stableHash({opportunityId:opportunity.id,requirementId:row.requirementId,
      runId:row.runId||row.run_id,candidateId:row.id,decisionId,policyVersion:row.policyVersion,eligibilityHash:eligibility.evidenceHash,assessmentEvidenceHash});
  let propertyMatch=await one('SELECT * FROM property_matches WHERE opportunity_id=$1 AND requirement_id=$2 AND listing_id=$3 FOR UPDATE',[opportunity.id,row.requirementId,row.listingId],client),created=false;
  const priorOrigin=propertyMatch?await one('SELECT * FROM property_match_governed_origins WHERE property_match_id=$1',[propertyMatch.id],client):null;
  if(priorOrigin&&priorOrigin.candidateId!==row.id)return{code:409,error:'This Property Match already has different governed matching evidence'};
  if(!propertyMatch){const fitStatus=Number(row.score)>=80?'strong_fit':Number(row.score)>=60?'partial_fit':'exception',
      rationale=`Governed match ${row.score}% under ${row.policyVersion}`,exceptions=(row.criteria||[]).filter(item=>item.state&&item.state!=='met').map(item=>item.label).join('; ')||null;
    propertyMatch=await one(`INSERT INTO property_matches
      (id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,shortlist_status,shortlisted_at,created_by,updated_by)
      VALUES($1,$2,$3,$4,'governed',$5,$6,$7,'shortlisted',NOW(),$8,$8) RETURNING *`,[uuid(),opportunity.id,row.requirementId,row.listingId,fitStatus,rationale,exceptions,req.broker.id],client);
    await execute(`INSERT INTO property_match_history(id,property_match_id,to_status,reason,changed_by)
      VALUES($1,$2,'shortlisted',$3,$4)`,[uuid(),propertyMatch.id,'Shortlisted and assigned from exact governed matching evidence',req.broker.id],client);created=true;
  }else if(propertyMatch.shortlistStatus!=='shortlisted'){
    await execute("UPDATE property_matches SET shortlist_status='shortlisted',shortlisted_at=NOW(),updated_by=$1,updated_at=NOW() WHERE id=$2",
      [req.broker.id,propertyMatch.id],client);
    await execute(`INSERT INTO property_match_history(id,property_match_id,from_status,to_status,reason,changed_by)
      VALUES($1,$2,$3,'shortlisted',$4,$5)`,[uuid(),propertyMatch.id,propertyMatch.shortlistStatus,
      'Existing Property Match shortlisted and assigned from exact governed matching evidence',req.broker.id],client);
    propertyMatch={...propertyMatch,shortlistStatus:'shortlisted'};
  }
  let origin=priorOrigin;
  if(!origin)origin=await one(`INSERT INTO property_match_governed_origins(id,request_id,property_match_id,matching_run_id,candidate_id,shortlist_decision_id,
    policy_version,promotion_fingerprint,inventory_checked_at,inventory_eligibility,assessment_snapshot,assessment_evidence_hash,promoted_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13) RETURNING *`,[uuid(),requestId,propertyMatch.id,row.runId||row.run_id,row.id,
    decisionId,row.policyVersion,fingerprint,checkedAt,JSON.stringify(eligibility),JSON.stringify(assessmentSnapshot),assessmentEvidenceHash,req.broker.id],client);
  await finishExpiredGovernedAssignment(opportunity.id,row.listingId,client);
  let assignment=await one("SELECT * FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2 AND state='active' FOR UPDATE",[opportunity.id,row.listingId],client),assignmentCreated=false;
  if(!assignment){const predecessor=await one(`SELECT id FROM inventory_assignments WHERE opportunity_id=$1 AND listing_id=$2 ORDER BY created_at DESC LIMIT 1`,[opportunity.id,row.listingId],client);
    assignment=await one(`INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,predecessor_assignment_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[uuid(),opportunity.id,row.listingId,propertyMatch.id,predecessor?.id||null,req.broker.id],client);
    await execute(`INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data)
      VALUES($1,$2,'created',$3,$4,$5::jsonb)`,[uuid(),assignment.id,'Inventory shortlisted and assigned to the Opportunity from governed ranking',req.broker.id,
      JSON.stringify({opportunityId:opportunity.id,listingId:row.listingId,propertyMatchId:propertyMatch.id,matchingRunId:row.runId||row.run_id,candidateId:row.id,shortlistDecisionId:decisionId,governedOriginId:origin.id})],client);assignmentCreated=true;
  }
  if(opportunity.stage==='Requirements'){
    await execute("UPDATE opportunities SET stage='Matching',version=version+1,updated_at=NOW() WHERE id=$1",[opportunity.id],client);
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,'Requirements','Matching','match_recorded','Governed shortlist assigned to Opportunity',$3)`,[uuid(),opportunity.id,req.broker.id],client);
    opportunity.stage='Matching';opportunity.version=Number(opportunity.version)+1;
  }
  await audit('PropertyMatch',propertyMatch.id,'governed_shortlist_assigned',req.broker.id,{assignmentId:assignment.id,opportunityId:opportunity.id,
    listingId:row.listingId,requirementId:row.requirementId,matchingRunId:row.runId||row.run_id,candidateId:row.id,decisionId,originId:origin.id,
    propertyMatchCreated:created,assignmentCreated,assignmentExpiresAt:assignment.expiresAt},client);
  return{propertyMatch,origin,assignment,propertyMatchCreated:created,assignmentCreated};
}

r.post('/crm/leads/:id/inventory-matching-runs',async(req,res)=>{
  const lead=await scopedLead(req,res,true);if(!lead)return;
  const result=await transaction(async client=>{
    const requirement=await one(`SELECT lr.*,confirmation.id AS confirmation_id,
      (SELECT COUNT(*)::int FROM lead_requirement_website_conflicts conflict WHERE conflict.requirement_id=lr.id) AS declared_conflict_count,
      (SELECT COUNT(*)::int FROM lead_requirement_website_conflicts conflict JOIN lead_requirement_conflict_resolutions resolution
        ON resolution.conflict_id=conflict.id WHERE conflict.requirement_id=lr.id AND resolution.resolution='confirmed_current_value') AS accepted_conflict_count,
      (SELECT COUNT(*)::int FROM lead_requirement_website_conflicts conflict JOIN lead_requirement_conflict_resolutions resolution
        ON resolution.conflict_id=conflict.id WHERE conflict.requirement_id=lr.id AND resolution.resolution='requires_new_version') AS correction_required_count
      FROM lead_requirements lr LEFT JOIN lead_requirement_confirmations confirmation ON confirmation.requirement_id=lr.id
      WHERE lr.lead_id=$1 AND lr.superseded_at IS NULL FOR SHARE OF lr`,[lead.id],client);
    if(!requirement)return{code:409,error:'A current structured requirement is required before matching Inventory'};
    if(!requirement.confirmationId)return{code:409,error:`Requirement version ${requirement.versionNo} must be broker-confirmed before matching Inventory`,requirementId:requirement.id};
    if(Number(requirement.correctionRequiredCount)>0)return{code:409,error:'A declared website conflict requires a corrected requirement version before matching Inventory',requirementId:requirement.id};
    if(Number(requirement.acceptedConflictCount)!==Number(requirement.declaredConflictCount))return{code:409,error:'Every declared website conflict must be explicitly resolved before matching Inventory',requirementId:requirement.id,
      declaredConflictCount:Number(requirement.declaredConflictCount),acceptedConflictCount:Number(requirement.acceptedConflictCount)};
    const requestedOpportunityId=String(req.body?.opportunityId||'').trim()||null,checkedAt=new Date().toISOString(),
      opportunity=requestedOpportunityId?await one(`SELECT * FROM opportunities WHERE id=$1 AND lead_id=$2
        AND stage NOT IN ('Closed Won','Closed Lost') FOR SHARE`,[requestedOpportunityId,lead.id],client):await one(`SELECT * FROM opportunities
        WHERE lead_id=$1 AND stage NOT IN ('Closed Won','Closed Lost') ORDER BY updated_at DESC LIMIT 1`,[lead.id],client);
    if(requestedOpportunityId&&!opportunity)return{code:404,error:'The selected open Opportunity does not belong to this Lead'};
    if(opportunity&&requestedOpportunityId&&!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    if(opportunity&&opportunity.requirementId!==requirement.id)return{code:409,error:`Opportunity ${opportunity.opportunityReference} is linked to a different Requirement Version. Align the Opportunity before running matching`,
      opportunityId:opportunity.id,opportunityRequirementId:opportunity.requirementId,currentRequirementId:requirement.id};
    const listings=await many(`SELECT ${inventoryEvaluatorProjection('li')},EXISTS(SELECT 1 FROM bookings b
      WHERE b.listing_id=li.id AND b.status='reserved' AND b.expires_at>$1 AND ($2::uuid IS NULL OR b.opportunity_id<>$2)) AS active_reservation
      FROM listings li ORDER BY li.id FOR SHARE OF li`,[checkedAt,opportunity?.id||null],client),
      snapshot=buildGovernedMatchingRunV2(requirement,listings,checkedAt,opportunity?.transactionType||requirement.businessLine),runId=uuid();
    await execute(`INSERT INTO inventory_matching_runs(id,lead_id,requirement_id,opportunity_id,policy_version,checked_at,
      requirement_snapshot,evidence_hash,eligible_count,excluded_count,requested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,[runId,lead.id,requirement.id,opportunity?.id||null,
      snapshot.policyVersion,checkedAt,JSON.stringify(snapshot.requirementSnapshot),snapshot.evidenceHash,
      snapshot.eligibleCount,snapshot.excludedCount,req.broker.id],client);
    for(const candidate of snapshot.candidates)await execute(`INSERT INTO inventory_matching_candidates(id,run_id,listing_id,
      eligibility_status,presented_rank,score,fit_label,listing_snapshot,criteria,exclusion_reasons,evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)`,[uuid(),runId,candidate.listingId,
      candidate.eligibilityStatus,candidate.presentedRank,candidate.score,candidate.fitLabel,JSON.stringify(candidate.listingSnapshot),
      JSON.stringify(candidate.criteria),JSON.stringify(candidate.exclusionReasons),candidate.evidence?JSON.stringify(candidate.evidence):null],client);
    await audit('Lead',lead.id,'governed_inventory_matching_run_created',req.broker.id,{runId,requirementId:requirement.id,
      opportunityId:opportunity?.id||null,policyVersion:snapshot.policyVersion,evidenceHash:snapshot.evidenceHash,
      eligibleCount:snapshot.eligibleCount,excludedCount:snapshot.excludedCount,automaticCommitment:false},client);
    return{run:await loadRun(runId,lead.id,client)};
  });
  if(result.error)return res.status(result.code).json(result);res.status(201).json(result.run);
});

r.get('/crm/leads/:id/inventory-matching-runs',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const runs=await many(`SELECT r.*,b.name AS requested_by_name,(lr.superseded_at IS NULL) AS requirement_current FROM inventory_matching_runs r
    JOIN brokers b ON b.id=r.requested_by JOIN lead_requirements lr ON lr.id=r.requirement_id
    WHERE r.lead_id=$1 ORDER BY r.created_at DESC LIMIT 25`,[lead.id]);
  const currentIndex=runs.findIndex(item=>item.requirementCurrent);runs.forEach((item,index)=>item.isCurrent=index===currentIndex);
  res.json({runs,advisoryOnly:false,governedPromotionAvailable:true,websiteSuggestionsIncluded:false});
});

r.get('/crm/leads/:id/inventory-matching-runs/:runId',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const run=await loadRun(req.params.runId,lead.id);if(!run)return res.status(404).json({error:'Inventory matching run not found'});
  res.json(run);
});

r.post('/crm/leads/:id/inventory-matching-runs/:runId/candidates/:candidateId/decisions',async(req,res)=>{
  const lead=await scopedLead(req,res,true);if(!lead)return;
  const checked=validateInventoryMatchDecision(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const candidate=await one(`SELECT c.*,r.id AS matching_run_id,r.requirement_id,r.requirement_snapshot,r.opportunity_id,r.policy_version,o.transaction_type FROM inventory_matching_candidates c JOIN inventory_matching_runs r ON r.id=c.run_id
      LEFT JOIN opportunities o ON o.id=r.opportunity_id
      WHERE c.id=$1 AND c.run_id=$2 AND r.lead_id=$3 FOR UPDATE OF c`,[req.params.candidateId,req.params.runId,lead.id],client);
    if(!candidate)return{code:404,error:'Inventory matching candidate not found'};
    if(candidate.eligibilityStatus==='excluded'&&checked.value.decision==='shortlisted')return{code:409,error:'Excluded Inventory cannot receive a broker shortlist decision'};
    const latest=await one('SELECT * FROM inventory_match_decisions WHERE candidate_id=$1 ORDER BY sequence_no DESC LIMIT 1',[candidate.id],client),v=checked.value;
    if((latest?.id||null)!==(v.expectedPreviousDecisionId||null))return{code:409,error:'This candidate decision changed after it was opened; reload the immutable run before deciding'};
    const assessments=await many(`SELECT DISTINCT ON(declaration_kind,declaration_index) * FROM inventory_match_candidate_assessments
      WHERE candidate_id=$1 ORDER BY declaration_kind,declaration_index,sequence_no DESC`,[candidate.id],client),liveCheckedAt=new Date().toISOString(),listing=await one(`SELECT ${inventoryEvaluatorProjection('li')},EXISTS(SELECT 1 FROM bookings b
      WHERE b.listing_id=li.id AND b.status='reserved' AND b.expires_at>$2 AND ($3::uuid IS NULL OR b.opportunity_id<>$3)) AS active_reservation
      FROM listings li WHERE li.id=$1 FOR UPDATE OF li`,[candidate.listingId,liveCheckedAt,candidate.opportunityId||null],client);
    const liveEligibility=listing?evaluateInventoryEligibilityV2({listing,requirement:candidate.requirementSnapshot,opportunityTransactionType:candidate.transactionType,assessments,checkedAt:liveCheckedAt}):{eligible:false,state:'excluded',reasons:[{code:'inventory_missing',label:'Inventory record no longer exists'}]};
    if(v.decision==='shortlisted'&&!liveEligibility.eligible)return{code:409,error:'This Inventory is no longer eligible and cannot be shortlisted',liveEligibility};
    if(v.assignToOpportunity&&!candidate.opportunityId)return{code:409,error:'Create or open the Opportunity and run matching from that Opportunity before assigning Inventory'};
    const opportunity=v.assignToOpportunity?await one('SELECT * FROM opportunities WHERE id=$1 FOR UPDATE',[candidate.opportunityId],client):null;
    if(v.assignToOpportunity&&(!opportunity||opportunity.leadId!==lead.id))return{code:409,error:'This matching run is not linked to the current Opportunity'};
    if(v.assignToOpportunity&&candidate.requirementId!==opportunity.requirementId)return{code:409,error:'This Opportunity and matching run use different Requirement Versions. Run matching again from the current Opportunity'};
    const decision=await one(`INSERT INTO inventory_match_decisions(id,candidate_id,previous_decision_id,sequence_no,decision,
      reason_code,reason_notes,live_checked_at,live_eligibility,decided_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING *`,[uuid(),candidate.id,latest?.id||null,(latest?.sequenceNo||0)+1,
      v.decision,v.reasonCode,v.reasonNotes,liveCheckedAt,JSON.stringify(liveEligibility),req.broker.id],client);
    let governedAssignment=null,delinkedAssignment=null;if(v.assignToOpportunity){const latestAssessments=await many(`SELECT DISTINCT ON(declaration_kind,declaration_index) *
      FROM inventory_match_candidate_assessments WHERE candidate_id=$1 ORDER BY declaration_kind,declaration_index,sequence_no DESC`,[candidate.id],client);
      governedAssignment=await createGovernedMatchAndAssignment({req,client,opportunity,row:{...candidate,runId:candidate.matchingRunId},decisionId:decision.id,
        requestId:v.requestId,eligibility:liveEligibility,assessments:latestAssessments});
      if(governedAssignment.error)throw Object.assign(new Error(governedAssignment.error),{statusCode:governedAssignment.code||409});}
    else if(v.decision!=='shortlisted')delinkedAssignment=await delinkGovernedAssignmentForDecision({req,client,candidate,decision});
    await audit('Lead',lead.id,'inventory_match_decision_recorded',req.broker.id,{runId:req.params.runId,candidateId:candidate.id,
      listingId:candidate.listingId,decision:v.decision,reasonCode:v.reasonCode,decisionId:decision.id,createsPropertyMatch:Boolean(governedAssignment),
      createsInventoryAssignment:Boolean(governedAssignment),reservesInventory:false},client);return{decision,liveEligibility,
      advisoryOnly:!governedAssignment,createsPropertyMatch:Boolean(governedAssignment),createsInventoryAssignment:Boolean(governedAssignment),
      propertyMatch:governedAssignment?.propertyMatch||null,assignment:governedAssignment?.assignment||null,
      assignmentDelinked:Boolean(delinkedAssignment),delinkedAssignment,reservesInventory:false};
  });
  if(result.error)return res.status(result.code).json({error:result.error,liveEligibility:result.liveEligibility});res.status(201).json(result);
});

r.post('/crm/leads/:id/inventory-matching-runs/:runId/candidates/:candidateId/assessments',async(req,res)=>{
  const lead=await scopedLead(req,res,true);if(!lead)return;
  const checked=validateCandidateAssessment(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{const candidate=await one(`SELECT c.*,r.requirement_snapshot FROM inventory_matching_candidates c
      JOIN inventory_matching_runs r ON r.id=c.run_id WHERE c.id=$1 AND c.run_id=$2 AND r.lead_id=$3 FOR UPDATE OF c`,
      [req.params.candidateId,req.params.runId,lead.id],client);if(!candidate)return{code:404,error:'Inventory matching candidate not found'};
    const v=checked.value,key={must_have:'mustHaves',exclusion:'exclusions',preference:'preferences',acceptable_trade_off:'acceptableTradeOffs'}[v.declarationKind],
      declaration=candidate.requirementSnapshot?.[key]?.[v.declarationIndex];if(typeof declaration!=='string'||!declaration.trim())return{code:409,error:'The selected declaration does not exist in this frozen requirement'};
    const latest=await one(`SELECT * FROM inventory_match_candidate_assessments WHERE candidate_id=$1 AND declaration_kind=$2
      AND declaration_index=$3 ORDER BY sequence_no DESC LIMIT 1`,[candidate.id,v.declarationKind,v.declarationIndex],client);
    if((latest?.id||null)!==(v.expectedPreviousAssessmentId||null))return{code:409,error:'This assessment changed after it was opened; reload before recording another version'};
    const assessment=await one(`INSERT INTO inventory_match_candidate_assessments(id,candidate_id,previous_assessment_id,sequence_no,
      declaration_kind,declaration_index,declaration_text,declaration_hash,result,evidence_kind,evidence_reference,assessment_notes,assessed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[uuid(),candidate.id,latest?.id||null,(latest?.sequenceNo||0)+1,
      v.declarationKind,v.declarationIndex,declaration.trim(),declarationHash(v.declarationKind,v.declarationIndex,declaration),v.result,v.evidenceKind,
      v.evidenceReference,v.assessmentNotes,req.broker.id],client);await audit('Lead',lead.id,'inventory_match_declaration_assessed',req.broker.id,
      {runId:req.params.runId,candidateId:candidate.id,assessmentId:assessment.id,declarationKind:v.declarationKind,declarationIndex:v.declarationIndex,result:v.result},client);
    return{assessment,immutableEvidence:true};});
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

r.post('/crm/leads/:id/inventory-matching-runs/:runId/candidates/:candidateId/feedback',async(req,res)=>{
  const lead=await scopedLead(req,res,true);if(!lead)return;
  const checked=validateInventoryMatchFeedback(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const candidate=await one(`SELECT c.* FROM inventory_matching_candidates c JOIN inventory_matching_runs r ON r.id=c.run_id
      WHERE c.id=$1 AND c.run_id=$2 AND r.lead_id=$3 FOR UPDATE OF c`,[req.params.candidateId,req.params.runId,lead.id],client);
    if(!candidate)return{code:404,error:'Inventory matching candidate not found'};
    if(candidate.eligibilityStatus!=='eligible')return{code:409,error:'Feedback may be recorded only for Inventory that was eligible in this exact run'};
    const v=checked.value;
    if(v.decisionId){const decision=await one('SELECT id FROM inventory_match_decisions WHERE id=$1 AND candidate_id=$2',[v.decisionId,candidate.id],client);
      if(!decision)return{code:409,error:'The linked decision does not belong to this matching candidate'};}
    const feedback=await one(`INSERT INTO inventory_match_feedback(id,candidate_id,decision_id,feedback_source,outcome,reason_code,
      notes,occurred_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),candidate.id,v.decisionId,
      v.sourceKind,v.outcome,v.reasonCode,v.notes,v.occurredAt,req.broker.id],client);
    await audit('Lead',lead.id,'inventory_match_feedback_recorded',req.broker.id,{runId:req.params.runId,candidateId:candidate.id,
      listingId:candidate.listingId,feedbackId:feedback.id,sourceKind:v.sourceKind,outcome:v.outcome,reasonCode:v.reasonCode},client);
    return{feedback,immutableEvidence:true,changesPriorRun:false};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

r.post('/crm/opportunities/:opportunityId/governed-matches',async(req,res)=>{
  const checked=validateGovernedPromotion(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{const v=checked.value,opportunity=await one('SELECT * FROM opportunities WHERE id=$1 FOR UPDATE',[req.params.opportunityId],client);
    if(!opportunity)return{code:404,error:'Opportunity not found'};if(!(canWriteOpportunity(req.broker,opportunity)||(req.broker.jobRole==='director'&&canReadOpportunity(req.broker,opportunity))))return{code:403,error:'Opportunity is outside your writable scope'};
    if(Number(opportunity.version)!==v.expectedOpportunityVersion)return{code:409,error:'The Opportunity changed after it was opened; reload before promotion'};
    const promoted=[];for(const selection of v.selections){const row=await one(`SELECT c.*,r.lead_id,r.requirement_id,r.requirement_snapshot,r.opportunity_id,
        r.policy_version,d.decision,d.sequence_no AS decision_sequence FROM inventory_matching_candidates c JOIN inventory_matching_runs r ON r.id=c.run_id
        JOIN inventory_match_decisions d ON d.id=$3 AND d.candidate_id=c.id WHERE r.id=$1 AND c.id=$2 FOR UPDATE OF c,d`,
        [selection.runId,selection.candidateId,selection.shortlistDecisionId],client);if(!row)return{code:404,error:'Selected governed matching candidate was not found'};
      if(row.opportunityId!==opportunity.id)return{code:409,error:'This matching run belongs to a different Opportunity. Run matching from the current Opportunity and try again'};
      if(row.requirementId!==opportunity.requirementId)return{code:409,error:'This Opportunity and matching run use different Requirement Versions. Run matching again from the current Opportunity'};
      const latestDecision=await one('SELECT id FROM inventory_match_decisions WHERE candidate_id=$1 ORDER BY sequence_no DESC LIMIT 1',[row.id],client);
      if(row.decision!=='shortlisted'||latestDecision?.id!==selection.shortlistDecisionId)return{code:409,error:'Every candidate requires its exact latest shortlist decision'};
      const assessments=await many(`SELECT DISTINCT ON(declaration_kind,declaration_index) * FROM inventory_match_candidate_assessments WHERE candidate_id=$1
        ORDER BY declaration_kind,declaration_index,sequence_no DESC`,[row.id],client);
      const checkedAt=new Date().toISOString(),listing=await one(`SELECT ${inventoryEvaluatorProjection('li')},EXISTS(SELECT 1 FROM bookings b WHERE b.listing_id=li.id AND b.status='reserved'
        AND b.expires_at>$2 AND b.opportunity_id<>$3) AS active_reservation FROM listings li WHERE li.id=$1 FOR UPDATE OF li`,[row.listingId,checkedAt,opportunity.id],client);
      if(!listing)return{code:409,error:'Selected Inventory no longer exists'};const eligibility=evaluateInventoryEligibilityV2({listing,requirement:row.requirementSnapshot,
        opportunityTransactionType:opportunity.transactionType,assessments,checkedAt});if(!eligibility.eligible)return{code:409,error:'Selected Inventory is not currently eligible',eligibility};
      const assigned=await createGovernedMatchAndAssignment({req,client,opportunity,row,decisionId:selection.shortlistDecisionId,
        requestId:v.requestId,eligibility,assessments});if(assigned.error)return assigned;
      promoted.push({propertyMatchId:assigned.propertyMatch.id,originId:assigned.origin.id,assignmentId:assigned.assignment.id,
        assignmentExpiresAt:assigned.assignment.expiresAt,propertyMatchCreated:assigned.propertyMatchCreated,assignmentCreated:assigned.assignmentCreated});}
    return{promoted,createsInventoryAssignments:true,reservesInventory:false,atomic:true};});
  if(result.error)return res.status(result.code).json({error:result.error,eligibility:result.eligibility});res.status(201).json(result);
});

export default r;
