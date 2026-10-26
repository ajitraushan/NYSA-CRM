export const COMMUNICATION_CHANNELS=['whatsapp'];
export const COMMUNICATION_DIRECTIONS=['outbound','inbound'];
export const COMMUNICATION_PURPOSES=['transactional_share','service_follow_up'];
export const COMMUNICATION_STATES=[
  'draft','policy_approved','queued','dispatching','accepted','delivered','read','retry_wait',
  'failed_permanent','outcome_unknown','reconciled','cancelled'
];
export const PROVIDER_EVENT_TYPES=['accepted','delivered','read','failed','inbound_received'];

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const iso=value=>{
  const parsed=new Date(value);
  return value&&!Number.isNaN(parsed.valueOf())?parsed.toISOString():null;
};

const sensitiveKeyPattern=/(authorization|credential|secret|token_value|access_token|api_key|phone|sender|recipient|contact_value|message|content|body|text|payload)/i;
const directAttemptSensitiveKeyPattern=/(authorization|credential|secret|token_value|access_token|api_key|phone|sender|recipient|contact_value|message|content|body|text|raw_event)/i;

export function findSensitiveEnvelopeKey(value,path='root'){
  if(!value||typeof value!=='object')return null;
  for(const [key,nested] of Object.entries(value)){
    const nextPath=`${path}.${key}`;
    if(sensitiveKeyPattern.test(key))return nextPath;
    const nestedMatch=findSensitiveEnvelopeKey(nested,nextPath);
    if(nestedMatch)return nestedMatch;
  }
  return null;
}

export function evaluateCommunicationPolicy(input={}){
  const subjectRef=clean(input.subjectRef),scopeRef=clean(input.scopeRef),channelRef=clean(input.channelRef),
    actorRef=clean(input.actorRef),purpose=input.purpose,channel=input.channel,
    policyVersion=clean(input.policyVersion),evaluatedAt=iso(input.evaluatedAt),validUntil=iso(input.validUntil);
  if(!subjectRef||!scopeRef||!channelRef||!actorRef||!policyVersion)return {error:'Policy references are required'};
  if(!COMMUNICATION_CHANNELS.includes(channel))return {error:'Select a supported communication channel'};
  if(!COMMUNICATION_PURPOSES.includes(purpose))return {error:'Select a supported communication purpose'};
  if(!evaluatedAt||!validUntil||new Date(validUntil)<=new Date(evaluatedAt))return {error:'Policy validity must end after evaluation'};

  const checks={
    actorAuthorized:input.actorAuthorized===true,
    channelEligible:input.channelEligible===true,
    consentPermits:input.consentPermits===true,
    restrictionClear:input.restrictionClear===true,
    subjectEligible:input.subjectEligible===true
  };
  const failedChecks=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
  return {value:{subjectRef,scopeRef,channelRef,actorRef,purpose,channel,policyVersion,evaluatedAt,validUntil,
    outcome:failedChecks.length?'denied':'allowed',reasonCodes:failedChecks}};
}

export function validateCommunicationAttempt(input={}){
  const directSensitiveKey=Object.keys(input).find(key=>directAttemptSensitiveKeyPattern.test(key));
  if(directSensitiveKey)return {error:'Attempt contains a prohibited direct sensitive field',sensitivePath:`root.${directSensitiveKey}`};
  const id=clean(input.id),subjectRef=clean(input.subjectRef),scopeRef=clean(input.scopeRef),
    channelRef=clean(input.channelRef),actorRef=clean(input.actorRef),policyDecisionRef=clean(input.policyDecisionRef),
    payloadRef=clean(input.payloadRef),payloadDigest=clean(input.payloadDigest),purpose=input.purpose,
    channel=input.channel,direction=input.direction||'outbound',state=input.state||'draft';
  if(!id||!subjectRef||!scopeRef||!channelRef||!actorRef||!policyDecisionRef)return {error:'Attempt references are required'};
  if(!COMMUNICATION_CHANNELS.includes(channel))return {error:'Select a supported communication channel'};
  if(!COMMUNICATION_DIRECTIONS.includes(direction))return {error:'Select a valid communication direction'};
  if(!COMMUNICATION_PURPOSES.includes(purpose))return {error:'Select a supported communication purpose'};
  if(!COMMUNICATION_STATES.includes(state))return {error:'Select a valid communication state'};
  if(!payloadRef||!payloadDigest)return {error:'Restricted payload reference and integrity digest are required'};
  if(sensitiveKeyPattern.test(payloadRef))return {error:'Payload reference must not contain sensitive field names'};
  return {value:{id,subjectRef,scopeRef,channelRef,actorRef,policyDecisionRef,payloadRef,payloadDigest,
    purpose,channel,direction,state}};
}

export function evaluateDispatchGate({attempt,policyDecision,connectorEnabled=false,now=new Date()}={}){
  if(connectorEnabled!==true)return {allowed:false,reasonCode:'connector_disabled'};
  if(!attempt||!['policy_approved','queued','retry_wait'].includes(attempt.state))return {allowed:false,reasonCode:'attempt_not_dispatchable'};
  if(!policyDecision||policyDecision.outcome!=='allowed')return {allowed:false,reasonCode:'policy_denied'};
  if(attempt.policyDecisionRef!==policyDecision.id&&attempt.policyDecisionRef!==policyDecision.policyDecisionRef){
    return {allowed:false,reasonCode:'policy_reference_mismatch'};
  }
  const validUntil=iso(policyDecision.validUntil);
  if(!validUntil||new Date(validUntil)<=new Date(now))return {allowed:false,reasonCode:'policy_expired'};
  if(attempt.subjectRef!==policyDecision.subjectRef||attempt.scopeRef!==policyDecision.scopeRef||
    attempt.channelRef!==policyDecision.channelRef||attempt.channel!==policyDecision.channel||
    attempt.purpose!==policyDecision.purpose)return {allowed:false,reasonCode:'policy_scope_mismatch'};
  return {allowed:true,reasonCode:'dispatch_allowed'};
}

const transitions={
  draft:{approve_policy:'policy_approved',cancel:'cancelled'},
  policy_approved:{queue:'queued',cancel:'cancelled'},
  queued:{claim_dispatch:'dispatching',cancel:'cancelled'},
  dispatching:{provider_accept:'accepted',temporary_failure:'retry_wait',permanent_failure:'failed_permanent',unknown_outcome:'outcome_unknown'},
  accepted:{confirm_delivery:'delivered',permanent_failure:'failed_permanent',unknown_outcome:'outcome_unknown'},
  delivered:{confirm_read:'read',unknown_outcome:'outcome_unknown'},
  retry_wait:{claim_dispatch:'dispatching',cancel:'cancelled'},
  outcome_unknown:{reconcile:'reconciled',permanent_failure:'failed_permanent'},
  reconciled:{confirm_delivery:'delivered',confirm_read:'read',permanent_failure:'failed_permanent'}
};

export function transitionCommunicationState(currentState,eventType){
  if(!COMMUNICATION_STATES.includes(currentState))return {error:'Unknown communication state'};
  const nextState=transitions[currentState]?.[eventType];
  if(!nextState)return {error:`${eventType} cannot follow ${currentState}`};
  return {value:{previousState:currentState,eventType,nextState}};
}

export function validateProviderEventEnvelope(input={}){
  const sensitivePath=findSensitiveEnvelopeKey(input);
  if(sensitivePath)return {error:'Provider envelope contains a prohibited sensitive field',sensitivePath};
  const providerEventRef=clean(input.providerEventRef),providerCorrelationRef=clean(input.providerCorrelationRef),
    eventType=input.eventType,occurredAt=iso(input.occurredAt),receivedAt=iso(input.receivedAt);
  if(!providerEventRef||!providerCorrelationRef)return {error:'Provider event references are required'};
  if(!PROVIDER_EVENT_TYPES.includes(eventType))return {error:'Unsupported provider event type'};
  if(!occurredAt||!receivedAt)return {error:'Provider event timestamps are required'};
  if(input.signatureVerified!==true)return {error:'Provider event signature is not verified'};
  if(input.replayDetected===true)return {error:'Provider event replay detected'};
  return {value:{providerEventRef,providerCorrelationRef,eventType,occurredAt,receivedAt,
    signatureVerified:true,replayDetected:false}};
}

export function providerEventIdempotencyKey(envelope={}){
  const providerKey=clean(envelope.providerKey),providerEventRef=clean(envelope.providerEventRef);
  if(!providerKey||!providerEventRef)return null;
  return `${providerKey}:${providerEventRef}`;
}
