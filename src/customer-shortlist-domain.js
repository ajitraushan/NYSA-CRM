export const CUSTOMER_SHORTLIST_POLICY_VERSION='r3c-customer-shortlist-v1';
export const CUSTOMER_SHORTLIST_MAX_PROPERTIES=6;
export const CUSTOMER_SHORTLIST_RESPONSE_OUTCOMES=[
  'interested','viewing_requested','information_required','more_options','not_suitable'
];
export const CUSTOMER_NOT_SUITABLE_REASONS=[
  {code:'price_or_budget',label:'Price or budget mismatch'},
  {code:'location_or_community',label:'Location or community mismatch'},
  {code:'layout_or_size',label:'Layout or size mismatch'},
  {code:'condition_or_timing',label:'Condition, readiness or timing mismatch'},
  {code:'payment_terms',label:'Payment terms mismatch'},
  {code:'amenities_or_features',label:'Amenities or features mismatch'},
  {code:'other_governed_reason',label:'Other recorded reason'}
];
export const CUSTOMER_PREFERENCE_IMPACTS=[
  {code:'property_only',label:'Property-specific feedback; requirement unchanged'},
  {code:'review_required',label:'Possible preference change; agent review required'},
  {code:'confirmed_change',label:'Customer confirmed a preference change; new requirement version required'}
];

const RESPONSE_ACTIONS={
  interested:{code:'broker_follow_up',label:'Broker follow-up',dueHours:4},
  viewing_requested:{code:'schedule_viewing',label:'Arrange viewing',dueHours:2},
  information_required:{code:'prepare_information',label:'Prepare requested information',dueHours:4},
  more_options:{code:'rematch_requirement',label:'Review requirement and prepare more options',dueHours:8},
  not_suitable:{code:'review_preferences',label:'Record preference change and review matching evidence',dueHours:8}
};

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
};

async function sha256(value){
  const bytes=new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function customerSelectionEligibility(listing,checkedAt=new Date().toISOString()){
  const reasons=[];
  const checkTime=new Date(checkedAt);
  if(Number.isNaN(checkTime.valueOf()))return{eligible:false,reasons:[{code:'invalid_check_time',label:'Eligibility check time is invalid'}]};
  if(!listing||typeof listing!=='object')return{eligible:false,reasons:[{code:'inventory_missing',label:'Inventory record no longer exists'}]};
  if(listing.deletedAt)reasons.push({code:'deleted',label:'Inventory record is deleted'});
  if(listing.workflowStatus!=='approved')reasons.push({code:'workflow_not_approved',label:'Inventory workflow is not approved'});
  if(!['verified','not_required'].includes(listing.verificationStatus))reasons.push({code:'verification_not_trusted',label:'Inventory verification is not trusted'});
  const effectiveStatus=listing.effectiveStatus;
  if(!effectiveStatus)reasons.push({code:'effective_status_missing',label:'Canonical Inventory status could not be derived'});
  if(['Closed','Sold','Rented'].includes(effectiveStatus))reasons.push({code:'not_available',label:`Inventory status is ${effectiveStatus}`});
  if(listing.verificationExpiresAt&&new Date(listing.verificationExpiresAt)<=checkTime)reasons.push({code:'verification_expired',label:'Inventory verification has expired'});
  return{eligible:reasons.length===0,reasons};
}

function customerSafeSnapshot(candidate,listing){
  const original=candidate.listingSnapshot||{};
  const floorPlans=(listing.floorPlans||[]).filter(item=>item?.approvalStatus==='approved'&&item?.rightsStatus==='cleared').map(item=>({
    assetReference:clean(item.assetReference),label:clean(item.label)||'Approved floor plan',
    bedrooms:finite(item.bedrooms),sizeSqft:finite(item.sizeSqft)
  })).filter(item=>item.assetReference);
  const evidence=listing.marketEvidence?.status==='approved'?listing.marketEvidence:null;
  const marketEvidence=evidence&&clean(evidence.sourceLabel)&&clean(evidence.asOf)?{
    evidenceReference:clean(evidence.evidenceReference),sourceLabel:clean(evidence.sourceLabel),
    sourceVersion:clean(evidence.sourceVersion),asOf:clean(evidence.asOf),periodLabel:clean(evidence.periodLabel),
    geography:clean(evidence.geography),propertySegment:clean(evidence.propertySegment),sampleSize:finite(evidence.sampleSize),
    subjectPricePerSqft:finite(evidence.subjectPricePerSqft),medianComparablePrice:finite(evidence.medianComparablePrice),
    medianComparablePricePerSqft:finite(evidence.medianComparablePricePerSqft),observedPriceChangePercent:finite(evidence.observedPriceChangePercent),
    completedTransactions:finite(evidence.completedTransactions),methodNote:clean(evidence.methodNote)
  }:null;
  return{
    inventoryId:clean(listing.id)||clean(candidate.listingId),
    reference:clean(listing.inventoryReference)||clean(original.inventoryReference),
    project:clean(listing.project)||clean(original.project),
    developer:clean(listing.developer)||clean(original.developer),
    area:clean(listing.area)||clean(original.area),
    community:clean(listing.community)||clean(original.community),
    propertyType:clean(listing.propertyType)||clean(original.propertyType),
    bedrooms:finite(listing.bedrooms)??finite(original.bedrooms),
    sizeSqft:finite(listing.sizeSqft)??finite(original.sizeSqft),
    amount:finite(listing.price)??finite(original.price),
    currency:clean(listing.currency)||clean(original.currency)||'AED',
    paymentPlan:clean(listing.paymentPlanType)||clean(original.paymentPlanType),
    fitLabel:clean(candidate.fitLabel),
    matchScore:finite(candidate.score),
    matchReasons:(candidate.criteria||[]).map(item=>clean(item?.label)||clean(item?.reason)||clean(item)).filter(Boolean),
    tradeOffs:(candidate.evidence?.tradeOffs||candidate.evidence?.tradeoffs||[]).map(item=>clean(item?.label)||clean(item)).filter(Boolean),
    missingFacts:(candidate.evidence?.missingFacts||[]).map(item=>clean(item?.label)||clean(item)).filter(Boolean),
    floorPlans,marketEvidence
  };
}

export async function prepareCustomerShortlist(input={}){
  const run=input.matchingRun||{},selectedIds=[...new Set((input.selectedCandidateIds||[]).map(clean).filter(Boolean))],
    decisions=input.decisions||[],inventory=input.liveInventory||[],checkedAt=input.checkedAt||new Date().toISOString(),
    title=clean(input.title)||'Property selection',preparedBy=clean(input.preparedBy);
  if(!input.brokerReviewConfirmed)return{error:'Broker review must be confirmed before preparing properties for customer review'};
  if(!preparedBy)return{error:'A broker reference is required'};
  if(!selectedIds.length)return{error:'Select at least one shortlisted property'};
  if(selectedIds.length>CUSTOMER_SHORTLIST_MAX_PROPERTIES)return{error:`Select no more than ${CUSTOMER_SHORTLIST_MAX_PROPERTIES} properties`};
  if(!Array.isArray(run.candidates))return{error:'A governed matching run is required'};
  const properties=[];
  for(const candidateId of selectedIds){
    const candidate=run.candidates.find(item=>item.id===candidateId||item.listingId===candidateId);
    if(!candidate)return{error:'A selected matching candidate no longer exists',candidateId};
    if(candidate.eligibilityStatus!=='eligible')return{error:'Excluded Inventory cannot enter a broker-prepared selection for customer review',candidateId};
    const latestDecision=[...decisions].reverse().find(item=>item.candidateId===candidateId||item.listingId===candidate.listingId);
    if(latestDecision?.decision!=='shortlisted')return{error:'Every selected property must have a current broker shortlist decision',candidateId};
    const live=inventory.find(item=>item.id===candidate.listingId);
    const eligibility=customerSelectionEligibility(live,checkedAt);
    if(!eligibility.eligible)return{error:'A broker-selected property is no longer eligible for customer review',candidateId,listingId:candidate.listingId,reasons:eligibility.reasons};
    properties.push(customerSafeSnapshot(candidate,live));
  }
  const snapshot={
    policyVersion:CUSTOMER_SHORTLIST_POLICY_VERSION,
    matchingRunReference:clean(run.id)||clean(run.evidenceHash),
    requirementReference:clean(run.requirementSnapshot?.id),
    requirementVersion:finite(run.requirementSnapshot?.versionNo),
    title,checkedAt:new Date(checkedAt).toISOString(),preparedBy,
    properties
  };
  return{value:{...snapshot,evidenceHash:await sha256(snapshot),status:'prepared',responses:[],automaticSend:false,automaticCommitment:false}};
}

export function validateCustomerShortlistResponse(body={}){
  const propertyReference=clean(body.propertyReference),outcome=body.outcome,notes=clean(body.notes),
    recordedBy=clean(body.recordedBy),occurredAt=body.occurredAt?new Date(body.occurredAt):new Date();
  if(!propertyReference)return{error:'Select a property from the prepared selection'};
  if(!CUSTOMER_SHORTLIST_RESPONSE_OUTCOMES.includes(outcome))return{error:'Select a controlled customer response'};
  if(!notes)return{error:'Response notes are required'};
  if(notes.length>1000)return{error:'Response notes must be 1,000 characters or fewer'};
  if(!recordedBy)return{error:'A broker reference is required'};
  if(Number.isNaN(occurredAt.valueOf())||occurredAt>new Date(Date.now()+5*60*1000))return{error:'Response time must be valid and cannot be in the future'};
  let notSuitableEvidence=null;
  if(outcome==='not_suitable'){
    const rejectionReason=CUSTOMER_NOT_SUITABLE_REASONS.find(item=>item.code===body.rejectionReason);
    const preferenceImpact=CUSTOMER_PREFERENCE_IMPACTS.find(item=>item.code===body.preferenceImpact);
    const preferenceChangeDetail=clean(body.preferenceChangeDetail);
    if(!rejectionReason)return{error:'Select why the property is not suitable'};
    if(!preferenceImpact)return{error:'Confirm whether the customer requirement changed'};
    if(preferenceImpact.code!=='property_only'&&!preferenceChangeDetail)return{error:'Describe the possible or confirmed preference change'};
    notSuitableEvidence={
      rejectionReason:{...rejectionReason},preferenceImpact:{...preferenceImpact},
      preferenceChangeDetail:preferenceImpact.code==='property_only'?null:preferenceChangeDetail,
      agentHandoff:{route:'current_responsible_agent_work_queue',label:'Current responsible agent CRM work queue',status:'proposed_not_sent'}
    };
  }
  return{value:{propertyReference,outcome,notes,recordedBy,occurredAt:occurredAt.toISOString(),notSuitableEvidence}};
}

export async function recordCustomerShortlistResponse(shortlist,body={}){
  if(!shortlist?.evidenceHash||!Array.isArray(shortlist.properties))return{error:'A broker-prepared property selection for customer review is required'};
  const validated=validateCustomerShortlistResponse(body);
  if(validated.error)return validated;
  const response=validated.value;
  const property=shortlist.properties.find(item=>item.reference===response.propertyReference);
  if(!property)return{error:'The property is not part of this immutable broker-prepared selection'};
  const action=response.outcome==='not_suitable'
    ?response.notSuitableEvidence.preferenceImpact.code==='property_only'
      ?{code:'record_property_feedback',label:'Record property feedback and continue matching',dueHours:8}
      :response.notSuitableEvidence.preferenceImpact.code==='confirmed_change'
        ?{code:'version_customer_requirement',label:'Review confirmed change and prepare a new requirement version',dueHours:4}
        :{code:'review_preferences',label:'Review possible preference change with responsible agent',dueHours:8}
    :RESPONSE_ACTIONS[response.outcome];
  const responseEvidence={shortlistEvidenceHash:shortlist.evidenceHash,...response,nextAction:{...action}};
  return{value:{response:{...responseEvidence,evidenceHash:await sha256(responseEvidence)},nextAction:{...action},changesInventory:false,changesOpportunityStage:false,automaticSend:false}};
}

export async function recordCustomerShortlistResponses(shortlist,bodies=[]){
  if(!Array.isArray(bodies)||!bodies.length)return{error:'Select at least one property response'};
  const references=bodies.map(item=>clean(item?.propertyReference));
  if(new Set(references).size!==references.length)return{error:'Record only one response for each property in this action'};
  const recorded=[];
  for(const body of bodies){
    const result=await recordCustomerShortlistResponse(shortlist,body);
    if(result.error)return result;
    recorded.push(result.value.response);
  }
  const actions=recorded.map(item=>item.nextAction);
  const combinedAction=actions.some(item=>item.code==='schedule_viewing')
    ?{code:'coordinate_property_viewings',label:'Coordinate selected property viewings',dueHours:2}
    :actions.some(item=>item.code==='prepare_information')
      ?{code:'prepare_property_comparison',label:'Prepare requested property details and comparison',dueHours:4}
      :recorded.length>1&&recorded.some(item=>item.outcome==='interested')
        ?{code:'multi_property_follow_up',label:'Follow up on multiple interested properties',dueHours:4}
        :{...actions.sort((a,b)=>a.dueHours-b.dueHours)[0]};
  const batchEvidence={shortlistEvidenceHash:shortlist.evidenceHash,responseEvidenceHashes:recorded.map(item=>item.evidenceHash),combinedAction};
  return{value:{responses:recorded,combinedAction:{...combinedAction},evidenceHash:await sha256(batchEvidence),changesInventory:false,changesOpportunityStage:false,automaticSend:false}};
}
