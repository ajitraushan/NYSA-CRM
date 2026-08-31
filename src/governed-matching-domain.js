import crypto from 'node:crypto';
import { rankInventoryMatches } from './ai-domain.js';
import { MATCHING_COMPLETION_POLICY_VERSION,evaluateInventoryEligibilityV2,scoreInventoryCandidateV2,stableHash } from './inventory-eligibility-domain.js';

export const INVENTORY_MATCHING_POLICY_VERSION='r3b-eligibility-v1';
export const INVENTORY_MATCH_DECISIONS=['shortlisted','rejected','deferred'];
export const INVENTORY_MATCH_DECISION_REASONS=['strong_fit','customer_preference','budget','location','property_type','size_layout','payment_terms','timing','availability_clarification','missing_information','other'];
export const INVENTORY_MATCH_FEEDBACK_OUTCOMES=['interested','not_suitable','more_options','viewing_requested','information_required'];
export const INVENTORY_MATCH_FEEDBACK_SOURCES=['customer_reported','broker_observed','viewing_feedback'];

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function validateInventoryMatchDecision(body={}){
  const decision=body.decision,reasonCode=body.reasonCode,reasonNotes=clean(body.reasonNotes),
    expectedPreviousDecisionId=clean(body.expectedPreviousDecisionId),assignToOpportunity=body.assignToOpportunity===true,
    requestId=clean(body.requestId);
  if(!INVENTORY_MATCH_DECISIONS.includes(decision))return {error:'Select shortlist, reject or defer'};
  if(!INVENTORY_MATCH_DECISION_REASONS.includes(reasonCode))return {error:'Select a controlled decision reason'};
  if(!reasonNotes)return {error:'Decision notes are required'};
  if(reasonNotes.length>1000)return {error:'Decision notes must be 1,000 characters or fewer'};
  if(assignToOpportunity&&decision!=='shortlisted')return{error:'Only a shortlist decision can assign Inventory to an Opportunity'};
  if(assignToOpportunity&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId||''))return{error:'A valid assignment request ID is required'};
  return{value:{decision,reasonCode,reasonNotes,expectedPreviousDecisionId,assignToOpportunity,requestId}};
}

export function validateInventoryMatchFeedback(body={}){
  const outcome=body.outcome,sourceKind=body.sourceKind,reasonCode=body.reasonCode,notes=clean(body.notes),
    decisionId=clean(body.decisionId),occurredAt=body.occurredAt?new Date(body.occurredAt):new Date();
  if(!INVENTORY_MATCH_FEEDBACK_OUTCOMES.includes(outcome))return {error:'Select a controlled property feedback outcome'};
  if(!INVENTORY_MATCH_FEEDBACK_SOURCES.includes(sourceKind))return {error:'Select the feedback evidence source'};
  if(!INVENTORY_MATCH_DECISION_REASONS.includes(reasonCode))return {error:'Select a controlled feedback reason'};
  if(!notes)return {error:'Property feedback notes are required'};
  if(notes.length>2000)return {error:'Property feedback notes must be 2,000 characters or fewer'};
  if(Number.isNaN(occurredAt.valueOf())||occurredAt>new Date(Date.now()+5*60*1000))return {error:'Feedback time must be valid and cannot be in the future'};
  return{value:{outcome,sourceKind,reasonCode,notes,decisionId,occurredAt:occurredAt.toISOString()}};
}

const snapshotListing=listing=>({
  id:listing.id,inventoryReference:listing.inventoryReference||null,project:listing.project||null,
  developer:listing.developer||null,area:listing.area||null,community:listing.community||null,
  propertyType:listing.propertyType||null,bedrooms:listing.bedrooms||null,sizeSqft:listing.sizeSqft??null,
  price:listing.price??null,currency:listing.currency||null,paymentPlanType:listing.paymentPlanType||null,
  status:listing.effectiveStatus||null,workflowStatus:listing.workflowStatus||null,
  verificationStatus:listing.verificationStatus||null,verificationExpiresAt:listing.verificationExpiresAt||null,
  availabilityConfirmedAt:listing.availabilityConfirmedAt||null,transactionTypes:listing.transactionTypes||[],
  handoverStatus:listing.handoverStatus||null
});

export function inventoryEligibility(listing,checkedAt=new Date().toISOString()){
  const reasons=[];
  if(listing.deletedAt)reasons.push({code:'deleted',label:'Inventory record is deleted'});
  if(listing.workflowStatus!=='approved')reasons.push({code:'workflow_not_approved',label:'Inventory workflow is not approved'});
  if(!['verified','not_required'].includes(listing.verificationStatus))reasons.push({code:'verification_not_trusted',label:'Inventory verification is not trusted'});
  const effectiveStatus=listing.effectiveStatus;
  if(!effectiveStatus)reasons.push({code:'effective_status_missing',label:'Canonical Inventory status could not be derived'});
  if(['Closed','Sold','Rented'].includes(effectiveStatus))reasons.push({code:'not_available',label:`Inventory status is ${effectiveStatus}`});
  if(listing.verificationExpiresAt&&new Date(listing.verificationExpiresAt)<=new Date(checkedAt))reasons.push({code:'verification_expired',label:'Inventory verification has expired'});
  return{eligible:reasons.length===0,reasons};
}

export function buildGovernedMatchingRunV2(requirement,listings=[],checkedAt=new Date().toISOString(),opportunityTransactionType=null){
  const evaluated=listings.map(listing=>{const eligibility=evaluateInventoryEligibilityV2({listing,requirement,opportunityTransactionType,checkedAt}),ranked=eligibility.state==='excluded'?null:scoreInventoryCandidateV2(requirement,listing,[]);return{listing,eligibility,ranked};});
  const rankable=evaluated.filter(item=>item.ranked).sort((a,b)=>b.ranked.score-a.ranked.score||a.ranked.missingCount-b.ranked.missingCount||String(a.listing.inventoryReference||a.listing.id).localeCompare(String(b.listing.inventoryReference||b.listing.id)));
  const rankById=new Map(rankable.map((item,index)=>[item.listing.id,index+1]));
  const candidates=evaluated.map(item=>({listingId:item.listing.id,eligibilityStatus:item.eligibility.state,presentedRank:rankById.get(item.listing.id)||null,
    score:item.ranked?.score??null,fitLabel:item.ranked?.fitLabel||null,listingSnapshot:snapshotListing(item.listing),criteria:item.ranked?.criteria||[],
    exclusionReasons:item.eligibility.reasons,evidence:{eligibility:item.eligibility,assessmentReadiness:item.ranked?.readiness||null}}))
    .sort((a,b)=>(a.presentedRank??Number.MAX_SAFE_INTEGER)-(b.presentedRank??Number.MAX_SAFE_INTEGER)||String(a.listingSnapshot.inventoryReference||a.listingId).localeCompare(String(b.listingSnapshot.inventoryReference||b.listingId)));
  const requirementSnapshot={id:requirement.id,versionNo:requirement.versionNo,businessLine:requirement.businessLine,purpose:requirement.purpose,
    propertyTypes:requirement.propertyTypes||[],areas:requirement.areas||[],budgetMin:requirement.budgetMin??null,budgetMax:requirement.budgetMax??null,
    fundingMethod:requirement.fundingMethod||null,bedroomsMin:requirement.bedroomsMin??null,bedroomsMax:requirement.bedroomsMax??null,
    sizeSqftMin:requirement.sizeSqftMin??null,sizeSqftMax:requirement.sizeSqftMax??null,timelineCode:requirement.timelineCode||null,
    declaredPriorities:requirement.declaredPriorities||[],mustHaves:requirement.mustHaves||[],preferences:requirement.preferences||[],
    exclusions:requirement.exclusions||[],acceptableTradeOffs:requirement.acceptableTradeOffs||[],reviewedAiSummary:requirement.aiReviewedEvidence?{
      summary:requirement.aiReviewedEvidence.summary||requirement.aiReviewedEvidence.aiSummary||null,
      confidence:requirement.aiReviewedEvidence.confidence||null,
      unansweredQuestions:Array.isArray(requirement.aiReviewedEvidence.unansweredQuestions)?requirement.aiReviewedEvidence.unansweredQuestions:[],
      warnings:Array.isArray(requirement.aiReviewedEvidence.warnings)?requirement.aiReviewedEvidence.warnings:[]}:null};
  const evidenceHash=stableHash({policyVersion:MATCHING_COMPLETION_POLICY_VERSION,checkedAt,opportunityTransactionType,requirementSnapshot,candidates});
  return{policyVersion:MATCHING_COMPLETION_POLICY_VERSION,checkedAt,opportunityTransactionType,requirementSnapshot,evidenceHash,
    eligibleCount:candidates.filter(x=>x.eligibilityStatus==='eligible').length,needsClarificationCount:candidates.filter(x=>x.eligibilityStatus==='needs_clarification').length,
    excludedCount:candidates.filter(x=>x.eligibilityStatus==='excluded').length,candidates};
}

export function buildGovernedMatchingRun(requirement,listings=[],checkedAt=new Date().toISOString()){
  const classified=listings.map(listing=>({listing,eligibility:inventoryEligibility(listing,checkedAt)}));
  const eligible=classified.filter(x=>x.eligibility.eligible).map(x=>x.listing);
  const ranked=rankInventoryMatches(requirement,eligible);
  const candidates=[...ranked.map((item,index)=>({
    listingId:item.listing.id,eligibilityStatus:'eligible',presentedRank:index+1,score:item.score,
    fitLabel:item.fit,listingSnapshot:snapshotListing(item.listing),criteria:item.criteria,
    exclusionReasons:[],evidence:item.evidence
  })),...classified.filter(x=>!x.eligibility.eligible).map(item=>({
    listingId:item.listing.id,eligibilityStatus:'excluded',presentedRank:null,score:null,fitLabel:null,
    listingSnapshot:snapshotListing(item.listing),criteria:[],exclusionReasons:item.eligibility.reasons,evidence:null
  }))];
  const requirementSnapshot={
    id:requirement.id,versionNo:requirement.versionNo,businessLine:requirement.businessLine,purpose:requirement.purpose,
    propertyTypes:requirement.propertyTypes||[],areas:requirement.areas||[],budgetMin:requirement.budgetMin??null,
    budgetMax:requirement.budgetMax??null,fundingMethod:requirement.fundingMethod||null,
    bedroomsMin:requirement.bedroomsMin??null,bedroomsMax:requirement.bedroomsMax??null,
    timelineCode:requirement.timelineCode||null,declaredPriorities:requirement.declaredPriorities||[],
    mustHaves:requirement.mustHaves||[],preferences:requirement.preferences||[],
    exclusions:requirement.exclusions||[],acceptableTradeOffs:requirement.acceptableTradeOffs||[]
  };
  const evidenceHash=crypto.createHash('sha256').update(JSON.stringify({policyVersion:INVENTORY_MATCHING_POLICY_VERSION,checkedAt,requirementSnapshot,candidates})).digest('hex');
  return{policyVersion:INVENTORY_MATCHING_POLICY_VERSION,checkedAt,requirementSnapshot,evidenceHash,
    eligibleCount:ranked.length,excludedCount:candidates.length-ranked.length,candidates};
}
