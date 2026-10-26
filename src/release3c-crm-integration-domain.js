import crypto from 'node:crypto';
import {evaluateCommunicationPolicy} from './communication-domain.js';
import {validateCustomerShortlistResponse,CUSTOMER_SHORTLIST_POLICY_VERSION} from './customer-shortlist-domain.js';
import {BROKER_NEXT_ACTION_POLICY_VERSION} from './broker-next-action-domain.js';

export const RELEASE3C_POLICY_VERSION='r3c-transactional-share-policy-v1';
export const RELEASE3C_SHARE_MAX_PROPERTIES=6;

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
};
export const release3cEvidenceHash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

export function validateGovernedSharePrepareRequest(body={}){
  const expectedOpportunityVersion=Number(body.expectedOpportunityVersion),title=clean(body.title),
    selections=Array.isArray(body.selections)?body.selections.map(item=>({
      propertyMatchId:clean(item?.propertyMatchId),matchingCandidateId:clean(item?.matchingCandidateId),matchDecisionId:clean(item?.matchDecisionId)
    })):[];
  if(!Number.isInteger(expectedOpportunityVersion)||expectedOpportunityVersion<1)return{error:'A positive expected Opportunity version is required'};
  if(!title)return{error:'A property-selection title is required'};
  if(title.length>120)return{error:'Property-selection title must be 120 characters or fewer'};
  if(body.brokerReviewConfirmed!==true)return{error:'Broker review must be confirmed before preparing a governed selection'};
  if(!selections.length||selections.length>RELEASE3C_SHARE_MAX_PROPERTIES)return{error:`Select between one and ${RELEASE3C_SHARE_MAX_PROPERTIES} properties`};
  if(selections.some(item=>!item.propertyMatchId||!item.matchingCandidateId||!item.matchDecisionId))return{error:'Every selection requires match, candidate and decision references'};
  for(const field of ['propertyMatchId','matchingCandidateId','matchDecisionId'])if(new Set(selections.map(item=>item[field])).size!==selections.length)return{error:`Every ${field} must be unique`};
  return{value:{expectedOpportunityVersion,title,selections,brokerReviewConfirmed:true}};
}

export function deriveTransactionalSharePolicy({actorAuthorized=false,channel,agreement,contact,opportunity,actorRef,evaluatedAt=new Date()}={}){
  const now=evaluatedAt instanceof Date?evaluatedAt:new Date(evaluatedAt),channelEligible=Boolean(channel&&channel.channelKind==='Phone'&&Number(channel.whatsappEnabled)===1&&
      ['format_valid','verified'].includes(channel.verificationStatus)&&channel.restrictionStatus==='allowed'),
    consentPermits=Boolean(agreement&&agreement.status==='executed'&&new Date(agreement.effectiveAt)<=now&&
      (!agreement.expiresAt||new Date(agreement.expiresAt)>now)&&(agreement.consentScope||[]).includes('transactional_share')&&
      (agreement.permittedChannels||[]).some(item=>String(item).toLowerCase()==='whatsapp')),
    restrictionClear=Boolean(contact&&Number(contact.doNotContact)===0&&contact.lifecycleStatus==='active'&&!contact.archivedAt&&channel?.restrictionStatus==='allowed'),
    subjectEligible=Boolean(contact&&opportunity&&contact.id===opportunity.contactId&&!['Closed Won','Closed Lost'].includes(opportunity.stage)&&
      contact.lifecycleStatus==='active'&&!contact.archivedAt),validUntil=new Date(now.getTime()+15*60*1000),
    input={subjectRef:contact?.id,scopeRef:opportunity?.id,channelRef:channel?.id,actorRef,purpose:'transactional_share',channel:'whatsapp',
      policyVersion:RELEASE3C_POLICY_VERSION,evaluatedAt:now.toISOString(),validUntil:validUntil.toISOString(),actorAuthorized:actorAuthorized===true,
      channelEligible,consentPermits,restrictionClear,subjectEligible},evaluated=evaluateCommunicationPolicy(input);
  if(evaluated.error)return evaluated;
  const value={...evaluated.value,checks:{actorAuthorized:actorAuthorized===true,channelEligible,consentPermits,restrictionClear,subjectEligible},
    consentEvidenceReference:agreement?.id||null};
  return{value:{...value,evidenceHash:release3cEvidenceHash(value)}};
}

const taskMap={
  interested:{subject:'Follow up on customer interest',priority:'high',dueHours:4,reasonCode:'strong_fit'},
  viewing_requested:{subject:'Coordinate property viewing',priority:'urgent',dueHours:2,reasonCode:'customer_preference'},
  information_required:{subject:'Prepare requested property information',priority:'high',dueHours:4,reasonCode:'missing_information'},
  more_options:{subject:'Review requirement and prepare more options',priority:'normal',dueHours:8,reasonCode:'customer_preference'},
  not_suitable_property_only:{subject:'Record property feedback and continue matching',priority:'normal',dueHours:8,reasonCode:'customer_preference'},
  not_suitable_review_required:{subject:'Review possible preference change',priority:'high',dueHours:8,reasonCode:'customer_preference'},
  not_suitable_confirmed_change:{subject:'Prepare a new governed requirement version',priority:'high',dueHours:4,reasonCode:'customer_preference'}
};

export function prepareGovernedResponseEvidence({shortlistEvidenceHash,shareItemId,propertyReference,recordedBy,body={},preparedAt,now=new Date()}={}){
  const validated=validateCustomerShortlistResponse({...body,propertyReference,recordedBy});
  if(validated.error)return validated;
  const response=validated.value,occurredAt=new Date(response.occurredAt),prepared=new Date(preparedAt),current=now instanceof Date?now:new Date(now);
  if(Number.isNaN(prepared.valueOf())||occurredAt<prepared)return{error:'Response time cannot be before package preparation'};
  if(occurredAt>new Date(current.getTime()+5*60*1000))return{error:'Response time must be valid and cannot be in the future'};
  const taskKey=response.outcome==='not_suitable'?`not_suitable_${response.notSuitableEvidence.preferenceImpact.code}`:response.outcome,task=taskMap[taskKey];
  if(!task)return{error:'Customer response cannot be translated into governed broker work'};
  const evidence={policyVersion:CUSTOMER_SHORTLIST_POLICY_VERSION,shortlistEvidenceHash,shareItemId,propertyReference,...response,
    responseSource:'manual_fallback'};
  return{value:{response:{...evidence,evidenceHash:release3cEvidenceHash(evidence)},task:{...task,dueAt:new Date(occurredAt.getTime()+task.dueHours*3600000).toISOString(),
    translationPolicyVersion:BROKER_NEXT_ACTION_POLICY_VERSION}}};
}

export function validateGovernedShareCancellation(body={}){
  const expectedVersion=Number(body.expectedVersion),reason=clean(body.reason);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return{error:'A positive expected share version is required'};
  if(!reason||reason.length<10||reason.length>500)return{error:'Cancellation reason must be between 10 and 500 characters'};
  return{value:{expectedVersion,reason}};
}

export function validateGovernedShareReportQuery(query={},now=new Date()){
  const end=query.to?new Date(query.to):new Date(now),start=query.from?new Date(query.from):new Date(end.getTime()-30*86400000);
  if(Number.isNaN(start.valueOf())||Number.isNaN(end.valueOf())||end<start)return{error:'A valid report date range is required'};
  if(end-start>93*86400000)return{error:'Report range cannot exceed 93 days'};
  return{value:{from:start.toISOString(),to:end.toISOString(),ownerId:clean(query.ownerId)}};
}
