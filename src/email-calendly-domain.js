import crypto from 'node:crypto';

export const EMAIL_POLICY_VERSION='r3d-microsoft365-email-v1';
export const CALENDLY_POLICY_VERSION='r3d-calendly-scheduling-v1';
export const EMAIL_PURPOSES=Object.freeze(['service_follow_up','meeting_coordination','viewing_coordination']);
export const EMAIL_STATES=Object.freeze(['draft','confirmed','queued','dispatching','accepted','retry_wait','outcome_unknown','reconciled','failed_permanent','cancelled']);
export const CALENDLY_KINDS=Object.freeze(['customer_meeting','property_viewing']);
export const CALENDLY_EVENT_FAMILIES=Object.freeze(['invitee.created','invitee.canceled']);

const clean=value=>typeof value==='string'?value.trim():'';
const positiveInt=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const iso=value=>{const date=new Date(value);return value&&!Number.isNaN(date.valueOf())?date.toISOString():null;};
const hex64=value=>/^[a-f0-9]{64}$/.test(clean(value));
const forbiddenEmailInput=/(recipient(email|address)?|toRecipients|ccRecipients|bccRecipients|accessToken|refreshToken|clientSecret|providerToken)/i;
function canonicalJson(value){
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stableHash=value=>crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');

export function validateEmailDraft(input={}){
  const prohibited=Object.keys(input).find(key=>forbiddenEmailInput.test(key));
  if(prohibited)return{error:'Email recipient and provider authorization are server-derived',field:prohibited};
  const leadId=clean(input.leadId),contactId=clean(input.contactId),mailboxConnectionId=clean(input.mailboxConnectionId),
    opportunityId=clean(input.opportunityId)||null,purpose=clean(input.purpose),subject=clean(input.subject),body=clean(input.body),
    contactAuthorityHash=clean(input.contactAuthorityHash),templateVersionId=clean(input.templateVersionId)||null;
  if(!leadId||!contactId||!mailboxConnectionId||!hex64(contactAuthorityHash))return{error:'Exact Lead, Contact, mailbox and Contact authority are required'};
  if(!EMAIL_PURPOSES.includes(purpose))return{error:'Select a controlled Email purpose'};
  if(subject.length<3||subject.length>200)return{error:'Email subject must contain 3 to 200 characters'};
  if(body.length<1||body.length>20000)return{error:'Email body must contain 1 to 20,000 characters'};
  return{value:{leadId,contactId,mailboxConnectionId,opportunityId,purpose,subject,body,contactAuthorityHash,templateVersionId,policyVersion:EMAIL_POLICY_VERSION}};
}

export function validateEmailSend(input={}){
  const draftVersion=positiveInt(input.draftVersion),confirmation=clean(input.confirmation),idempotencyKey=clean(input.idempotencyKey);
  if(!draftVersion||!idempotencyKey)return{error:'Draft version and idempotency key are required'};
  if(confirmation!=='SEND_EMAIL')return{error:'Exact Email send confirmation is required'};
  return{value:{draftVersion,idempotencyKey}};
}

const emailTransitions={draft:{confirm:'confirmed',cancel:'cancelled'},confirmed:{queue:'queued',cancel:'cancelled'},queued:{claim:'dispatching',cancel:'cancelled'},dispatching:{accept:'accepted',temporary_failure:'retry_wait',unknown:'outcome_unknown',permanent_failure:'failed_permanent'},retry_wait:{claim:'dispatching',cancel:'cancelled'},outcome_unknown:{reconcile:'reconciled',permanent_failure:'failed_permanent'}};
export function transitionEmailState(current,event){
  if(!EMAIL_STATES.includes(current))return{error:'Unknown Email state'};
  const next=emailTransitions[current]?.[event];
  return next?{value:{from:current,event,to:next}}:{error:`${event} cannot follow ${current}`};
}

export function emailAttemptFingerprint(input={}){
  return stableHash({threadId:clean(input.threadId),draftVersion:positiveInt(input.draftVersion),contactAuthorityHash:clean(input.contactAuthorityHash),payloadDigest:clean(input.payloadDigest),idempotencyKey:clean(input.idempotencyKey)});
}

export function validateMicrosoftNotification(input={},expectedClientStateDigest=''){
  const subscriptionRef=clean(input.subscriptionRef),resourceRef=clean(input.resourceRef),eventRef=clean(input.eventRef),
    clientStateDigest=clean(input.clientStateDigest),receivedAt=iso(input.receivedAt);
  if(!subscriptionRef||!resourceRef||!eventRef||!receivedAt)return{error:'Microsoft notification references and received time are required'};
  if(!hex64(clientStateDigest)||clientStateDigest!==expectedClientStateDigest)return{error:'Microsoft notification client state is invalid'};
  return{value:{subscriptionRef,resourceRef,eventRef,clientStateDigest,receivedAt}};
}

export function rotateRefreshToken({currentGeneration,nextEncryptedReference}={}){
  const generation=positiveInt(currentGeneration),reference=clean(nextEncryptedReference);
  if(!generation||!reference)return{error:'Current generation and replacement refresh-token reference are required'};
  return{value:{priorGeneration:generation,nextGeneration:generation+1,nextEncryptedReference:reference}};
}

export function validateCalendlyHostMapping(input={}){
  const calendlyUserRef=clean(input.calendlyUserRef),brokerId=clean(input.brokerId),reason=clean(input.reason);
  if(!calendlyUserRef||!brokerId)return{error:'Exact Calendly user and active CRM broker are required'};
  if(reason.length<5)return{error:'A meaningful host-mapping reason is required'};
  return{value:{calendlyUserRef,brokerId,reason}};
}

export function validateCalendlyEventTypeMapping(input={}){
  const eventTypeRef=clean(input.eventTypeRef),kind=clean(input.kind),locationMode=clean(input.locationMode),
    durationMinutes=positiveInt(input.durationMinutes),reason=clean(input.reason);
  if(!eventTypeRef||!CALENDLY_KINDS.includes(kind))return{error:'Exact Calendly event type and controlled CRM kind are required'};
  if(!durationMinutes||durationMinutes<15||durationMinutes>480)return{error:'Duration must be 15 to 480 minutes'};
  if(!['physical','virtual','either'].includes(locationMode))return{error:'Select a controlled location mode'};
  if(kind==='property_viewing'&&locationMode!=='physical')return{error:'Property viewing event types must be physical'};
  if(reason.length<5)return{error:'A meaningful event-type mapping reason is required'};
  return{value:{eventTypeRef,kind,locationMode,durationMinutes,reason,policyVersion:CALENDLY_POLICY_VERSION}};
}

export function validateSchedulingIntent(input={}){
  const kind=clean(input.kind),leadId=clean(input.leadId),contactId=clean(input.contactId),brokerId=clean(input.brokerId),
    eventTypeMappingId=clean(input.eventTypeMappingId),eventTypeMappingVersion=positiveInt(input.eventTypeMappingVersion),
    leadAuthorityHash=clean(input.leadAuthorityHash),opportunityId=clean(input.opportunityId)||null,
    opportunityVersion=positiveInt(input.opportunityVersion),propertyMatchId=clean(input.propertyMatchId)||null,
    propertyMatchVersion=positiveInt(input.propertyMatchVersion),authorityHash=clean(input.authorityHash);
  if(!CALENDLY_KINDS.includes(kind)||!leadId||!contactId||!brokerId||!eventTypeMappingId||!eventTypeMappingVersion||!hex64(leadAuthorityHash))return{error:'Exact scheduling context and Lead authority are required'};
  if(!hex64(authorityHash))return{error:'Exact scheduling authority hash is required'};
  if(kind==='property_viewing'&&(!opportunityId||!opportunityVersion||!propertyMatchId||!propertyMatchVersion))return{error:'Property viewing requires exact Opportunity and Property Match versions'};
  if(kind==='customer_meeting'&&(opportunityId||propertyMatchId))return{error:'Customer meeting intent must not carry property-viewing context'};
  return{value:{kind,leadId,contactId,brokerId,eventTypeMappingId,eventTypeMappingVersion,leadAuthorityHash,opportunityId,opportunityVersion:opportunityVersion||null,propertyMatchId,propertyMatchVersion:propertyMatchVersion||null,authorityHash,policyVersion:CALENDLY_POLICY_VERSION}};
}

export function validateCalendlyEvent(input={}){
  const eventFamily=clean(input.eventFamily),providerEventRef=clean(input.providerEventRef),eventRef=clean(input.eventRef),
    inviteeRef=clean(input.inviteeRef),occurredAt=iso(input.occurredAt),receivedAt=iso(input.receivedAt),payloadDigest=clean(input.payloadDigest);
  if(!CALENDLY_EVENT_FAMILIES.includes(eventFamily))return{error:'Unsupported Calendly event family'};
  if(!providerEventRef||!eventRef||!inviteeRef||!occurredAt||!receivedAt||!hex64(payloadDigest))return{error:'Complete Calendly event evidence is required'};
  if(input.signatureVerified!==true||input.replayDetected===true)return{error:'Calendly signature verification failed'};
  return{value:{eventFamily,providerEventRef,eventRef,inviteeRef,occurredAt,receivedAt,payloadDigest,signatureVerified:true,replayDetected:false}};
}

export function calendlyEventKey(input={}){
  return [clean(input.eventFamily),clean(input.eventRef),clean(input.inviteeRef)].join(':');
}

export function planCalendlyProjection({kind,correlated=false,hostMapped=false,eventTypeMapped=false}={}){
  if(!CALENDLY_KINDS.includes(kind)||!correlated||!hostMapped||!eventTypeMapped)return{value:{state:'reconciliation_required',projection:null}};
  if(kind==='customer_meeting')return{value:{state:'projected',projection:'meeting_activity'}};
  return{value:{state:'pending_broker_confirmation',projection:'broker_confirmation_task'}};
}

export function evaluateViewingConfirmation(input={}){
  const blockers=[];
  if(input.assignedBrokerConfirmed!==true)blockers.push('broker_confirmation_missing');
  if(input.actorAuthorized!==true)blockers.push('actor_not_authorized');
  if(input.intentCurrent!==true)blockers.push('scheduling_intent_stale');
  if(input.opportunityCurrent!==true)blockers.push('opportunity_stale');
  if(input.propertyMatchCurrent!==true)blockers.push('property_match_stale');
  if(input.inventoryEligible!==true)blockers.push('inventory_not_eligible');
  if(input.duplicateViewing===true)blockers.push('duplicate_viewing');
  return{value:{allowed:blockers.length===0,blockers}};
}
