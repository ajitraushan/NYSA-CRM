import { one,many } from './db.js';
import { evaluateInventoryEligibilityV2,inventoryEvaluatorProjection } from './inventory-eligibility-domain.js';
export { inventoryEvaluatorProjection } from './inventory-eligibility-domain.js';

// Both the SQL projection and evaluator consume INVENTORY_EVALUATOR_FIELD_COLUMNS.
// Stored status is returned for audit/display only; effective_status is the sole
// status input used by eligibility decisions.
export async function loadCurrentCandidateAssessments(candidateId,client){
  if(!candidateId)return [];
  return many(`SELECT DISTINCT ON(declaration_kind,declaration_index) * FROM inventory_match_candidate_assessments
    WHERE candidate_id=$1 ORDER BY declaration_kind,declaration_index,sequence_no DESC`,[candidateId],client);
}

export async function loadOpportunityInventoryEvaluation({listing,opportunityId,client,checkedAt=new Date().toISOString()}){
  if(!listing||!opportunityId)return {listing,evaluation:null,requirement:null,assessments:[],governedOrigin:null};
  const opportunity=await one(`SELECT o.requirement_id,o.transaction_type,lr.*
    FROM opportunities o LEFT JOIN lead_requirements lr ON lr.id=o.requirement_id WHERE o.id=$1`,[opportunityId],client);
  if(!opportunity)return {listing,evaluation:null,requirement:null,assessments:[],governedOrigin:null};
  const governedOrigin=await one(`SELECT origin.candidate_id,r.requirement_snapshot
    FROM property_match_governed_origins origin
    JOIN property_matches pm ON pm.id=origin.property_match_id
    JOIN inventory_matching_runs r ON r.id=origin.matching_run_id
    WHERE pm.opportunity_id=$1 AND pm.listing_id=$2
    ORDER BY origin.promoted_at DESC,origin.id DESC LIMIT 1`,[opportunityId,listing.id],client);
  const requirement=governedOrigin?.requirementSnapshot||opportunity;
  const assessments=await loadCurrentCandidateAssessments(governedOrigin?.candidateId,client);
  const evaluation=evaluateInventoryEligibilityV2({listing,requirement,
    opportunityTransactionType:opportunity.transactionType,assessments,checkedAt});
  return {listing,evaluation,requirement,assessments,governedOrigin};
}

export async function evaluateOpportunityInventoryById({listingId,opportunityId,client,lock=false,extraWhere='TRUE',params=[]}){
  const lockClause=lock?' FOR UPDATE OF l':'';
  const listing=await one(`SELECT ${inventoryEvaluatorProjection('l')} FROM listings l
    WHERE l.id=$1 AND (${extraWhere})${lockClause}`,[listingId,...params],client);
  return loadOpportunityInventoryEvaluation({listing,opportunityId,client});
}
