import {customerSelectionEligibility} from './customer-shortlist-domain.js';

export const GOVERNED_SHARE_PREFLIGHT_VERSION='r3c-governed-share-preflight-v1';
export const GOVERNED_SHARE_PREFLIGHT_TTL_MINUTES=15;

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
};
async function sha256(value){
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function shareFacts(item){return{
  reference:clean(item.inventoryReference)||clean(item.reference),project:clean(item.project),community:clean(item.community),
  bedrooms:finite(item.bedrooms),sizeSqft:finite(item.sizeSqft),amount:finite(item.price)??finite(item.amount),
  currency:clean(item.currency)||'AED'
};}

function changedFacts(snapshot,live){
  const before=shareFacts(snapshot),after=shareFacts(live);
  return Object.keys(before).filter(key=>before[key]!==after[key]).map(key=>({field:key,prepared:before[key],live:after[key]}));
}

function customerPackageFacts(item){
  const core=shareFacts(item),market=item.marketEvidence;
  return{
    ...core,
    matchReasons:(item.matchReasons||[]).map(clean).filter(Boolean),
    tradeOffs:(item.tradeOffs||[]).map(clean).filter(Boolean),
    missingFacts:(item.missingFacts||[]).map(clean).filter(Boolean),
    floorPlans:(item.floorPlans||[]).map(plan=>({assetReference:clean(plan.assetReference),label:clean(plan.label),bedrooms:finite(plan.bedrooms),sizeSqft:finite(plan.sizeSqft)})).filter(plan=>plan.assetReference),
    marketEvidence:market?{
      evidenceReference:clean(market.evidenceReference),sourceLabel:clean(market.sourceLabel),sourceVersion:clean(market.sourceVersion),asOf:clean(market.asOf),periodLabel:clean(market.periodLabel),geography:clean(market.geography),propertySegment:clean(market.propertySegment),sampleSize:finite(market.sampleSize),subjectPricePerSqft:finite(market.subjectPricePerSqft),medianComparablePrice:finite(market.medianComparablePrice),medianComparablePricePerSqft:finite(market.medianComparablePricePerSqft),observedPriceChangePercent:finite(market.observedPriceChangePercent),completedTransactions:finite(market.completedTransactions),methodNote:clean(market.methodNote)
    }:null
  };
}

export async function prepareGovernedSharePreflight(input={}){
  const checkedAt=new Date(input.checkedAt||Date.now()),shortlist=input.shortlist,liveInventory=input.liveInventory,
    policy=input.policyDecision,actorRef=clean(input.actorRef),subjectRef=clean(input.subjectRef),scopeRef=clean(input.scopeRef);
  if(Number.isNaN(checkedAt.valueOf()))return{error:'Share preflight time is invalid'};
  if(!shortlist?.evidenceHash||!Array.isArray(shortlist.properties)||!shortlist.properties.length)return{error:'A broker-prepared property selection for customer review is required'};
  if(!Array.isArray(liveInventory))return{error:'Live Inventory evidence is required'};
  if(!actorRef||!subjectRef||!scopeRef)return{error:'Opaque actor, customer and Opportunity references are required'};
  if(!policy||policy.outcome!=='allowed')return{error:'Communication policy does not permit this share',reasonCodes:policy?.reasonCodes||['policyMissing']};
  if(clean(policy.actorRef)!==actorRef||clean(policy.subjectRef)!==subjectRef||clean(policy.scopeRef)!==scopeRef)return{error:'Communication policy scope does not match this share'};
  if(policy.channel!=='whatsapp'||policy.purpose!=='transactional_share')return{error:'Communication policy channel or purpose does not match this share'};
  const validUntil=new Date(policy.validUntil);
  if(Number.isNaN(validUntil.valueOf())||validUntil<=checkedAt)return{error:'Communication policy evidence has expired'};
  const cards=[];
  for(const property of shortlist.properties){
    const live=liveInventory.find(item=>(clean(item.inventoryReference)||clean(item.reference))===clean(property.reference));
    const eligibility=customerSelectionEligibility(live,checkedAt.toISOString());
    if(!eligibility.eligible)return{error:'A selected property is no longer eligible to share',propertyReference:property.reference,reasons:eligibility.reasons};
    const changes=changedFacts(property,live);
    if(changes.length)return{error:'Customer-visible property facts changed after broker review',propertyReference:property.reference,changes};
    const preparedPlans=(property.floorPlans||[]).map(item=>clean(item.assetReference)).filter(Boolean),livePlans=(live.floorPlans||[]).filter(item=>item?.approvalStatus==='approved'&&item?.rightsStatus==='cleared').map(item=>clean(item.assetReference)).filter(Boolean);
    if(preparedPlans.some(reference=>!livePlans.includes(reference)))return{error:'An approved floor plan is no longer shareable',propertyReference:property.reference};
    const preparedMarket=property.marketEvidence,liveMarket=live.marketEvidence;
    if(preparedMarket&&(!liveMarket||liveMarket.status!=='approved'||clean(liveMarket.evidenceReference)!==clean(preparedMarket.evidenceReference)||clean(liveMarket.sourceVersion)!==clean(preparedMarket.sourceVersion)||clean(liveMarket.asOf)!==clean(preparedMarket.asOf)))return{error:'Market evidence changed after broker review',propertyReference:property.reference};
    cards.push(customerPackageFacts(property));
  }
  const expiresAt=new Date(checkedAt.getTime()+GOVERNED_SHARE_PREFLIGHT_TTL_MINUTES*60000).toISOString();
  const snapshot={version:GOVERNED_SHARE_PREFLIGHT_VERSION,shortlistEvidenceHash:shortlist.evidenceHash,policyDecisionRef:clean(policy.id)||clean(policy.policyDecisionRef),actorRef,subjectRef,scopeRef,checkedAt:checkedAt.toISOString(),expiresAt,cards,templateRef:'property_selection_transactional_v1'};
  return{value:{...snapshot,evidenceHash:await sha256(snapshot),status:'prepared_not_sent',shareReady:true,automaticSend:false,connectorEnabled:false,changesInventory:false,changesOpportunityStage:false}};
}
