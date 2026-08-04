import crypto from 'node:crypto';

export const OPPORTUNITY_STAGES=['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Won','Closed Lost'];
export const R2_2_ENABLED_STAGES=['Requirements','Matching','Viewing','Closed Lost'];
export const R2_3A_ENABLED_STAGES=['Requirements','Matching','Viewing','Offer','Negotiation','Closed Lost'];
export const R2_4_ENABLED_STAGES=['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal','Closed Won','Closed Lost'];
export const OPPORTUNITY_LOST_REASONS=['customer_withdrew','no_suitable_property','budget_or_finance','timing_changed','competitor','duplicate_pursuit','other'];
export const OPPORTUNITY_TRANSACTION_TYPES=['Sale','Rental','Off-plan','Commercial'];

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const stableSnapshot=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));

export function buildOpportunityAttribution(lead){
  const snapshot={
    attributionBasis:'original_enquiry',
    campaignCode:clean(lead.campaignCode),
    externalSourceId:clean(lead.externalSourceId),
    originatingLeadId:lead.id,
    originatingListingId:lead.listingId||null,
    source:clean(lead.source),
    sourceForm:clean(lead.sourceForm),
    sourcePage:clean(lead.sourcePage)
  };
  const serialized=stableSnapshot(snapshot);
  return {...snapshot,provenanceSnapshot:snapshot,provenanceHash:crypto.createHash('sha256').update(serialized).digest('hex')};
}

export function validateOpportunityCreate(body={}){
  const title=clean(body.title),nextAction=clean(body.nextAction),transactionType=body.transactionType,serviceOpportunityReason=clean(body.serviceOpportunityReason);
  if(body.serviceOpportunityConfirmed!==true)return {error:'Confirm that this is a genuine opportunity for NYSA to serve the customer'};
  if(!serviceOpportunityReason)return {error:'Explain why NYSA has a genuine opportunity to serve this customer'};
  if(!title)return {error:'Opportunity title is required'};
  if(!OPPORTUNITY_TRANSACTION_TYPES.includes(transactionType))return {error:'Select a valid transaction type'};
  if(!nextAction)return {error:'Next action is required for an active opportunity'};
  const due=new Date(body.nextActionDueAt);
  if(!body.nextActionDueAt||Number.isNaN(due.valueOf()))return {error:'A valid next-action due time is required'};
  if(body.priority&&!['low','normal','high','urgent'].includes(body.priority))return {error:'Select a valid opportunity priority'};
  const listingIds=[...new Set([...(Array.isArray(body.listingIds)?body.listingIds:[]),body.listingId].filter(Boolean))];
  const representationPath=body.representationPath||'buyer';
  if(!['buyer','inventory','dual'].includes(representationPath))return {error:'Select how NYSA is representing the parties'};
  if(['inventory','dual'].includes(representationPath)&&listingIds.length!==1)return {error:'Seller/landlord and dual representation must select exactly one approved NYSA Inventory record'};
  const percent=(value,label)=>{
    if(value===undefined||value===null||value==='')return null;
    const number=Number(value);if(!Number.isFinite(number)||number<0||number>100)throw new Error(`${label} must be between 0% and 100%`);
    return number;
  },amount=(value,label)=>{
    if(value===undefined||value===null||value==='')return null;
    const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} must be a non-negative amount`);
    return number;
  };
  let buyerCommissionPercent,buyerCommissionMinimum,sellerCommissionPercent,sellerCommissionMinimum,originatingAgentSplitPercent,servicingAgentSplitPercent;
  try{
    buyerCommissionPercent=percent(body.buyerCommissionPercent,'Buyer-side commission');
    buyerCommissionMinimum=amount(body.buyerCommissionMinimum,'Buyer-side commission minimum');
    sellerCommissionPercent=percent(body.sellerCommissionPercent,'Seller-side commission');
    sellerCommissionMinimum=amount(body.sellerCommissionMinimum,'Seller-side commission minimum');
    originatingAgentSplitPercent=percent(body.originatingAgentSplitPercent,'Originating-agent split');
    servicingAgentSplitPercent=percent(body.servicingAgentSplitPercent,'Servicing-agent split');
  }catch(error){return {error:error.message};}
  if((originatingAgentSplitPercent!==null||servicingAgentSplitPercent!==null)&&
    (originatingAgentSplitPercent===null||servicingAgentSplitPercent===null||originatingAgentSplitPercent+servicingAgentSplitPercent!==100))
    return {error:'Originating-agent and servicing-agent split percentages must both be entered and total 100%'};
  return {value:{title,transactionType,nextAction,nextActionDueAt:due.toISOString(),priority:body.priority||'normal',listingId:listingIds[0]||null,listingIds,serviceOpportunityReason,
    representationPath,buyerCommissionPercent,buyerCommissionMinimum,sellerCommissionPercent,sellerCommissionMinimum,originatingAgentSplitPercent,servicingAgentSplitPercent,
    disclosureEvidence:clean(body.disclosureEvidence)}};
}

export function validateOpportunityTransition(currentStage,toStage,{reasonCode,reason}={}){
  if(!OPPORTUNITY_STAGES.includes(currentStage)||!OPPORTUNITY_STAGES.includes(toStage))return {error:'Invalid opportunity stage'};
  if(!R2_3A_ENABLED_STAGES.includes(toStage))return {error:`${toStage} is not enabled in Release 2.3A`};
  if(currentStage==='Requirements'&&toStage==='Matching')return {value:{toStage,reasonCode:null,reason:null}};
  if(currentStage==='Matching'&&toStage==='Requirements'){
    if(!clean(reason))return {error:'A reason is required to return to Requirements'};
    return {value:{toStage,reasonCode:'requirements_reopened',reason:clean(reason)}};
  }
  if(currentStage==='Matching'&&toStage==='Viewing')return {value:{toStage,reasonCode:'viewing_scheduled',reason:clean(reason)||'Viewing scheduled for a shortlisted property'}};
  if(currentStage==='Viewing'&&toStage==='Matching'){
    if(!clean(reason))return {error:'A reason is required to return to Matching'};
    return {value:{toStage,reasonCode:'viewing_returned_to_matching',reason:clean(reason)}};
  }
  if(['Requirements','Matching','Viewing','Offer','Negotiation'].includes(currentStage)&&toStage==='Closed Lost'){
    if(!OPPORTUNITY_LOST_REASONS.includes(reasonCode)||!clean(reason))return {error:'A controlled lost reason and explanation are required'};
    return {value:{toStage,reasonCode,reason:clean(reason)}};
  }
  return {error:`Transition from ${currentStage} to ${toStage} is not enabled in Release 2.3A`};
}
