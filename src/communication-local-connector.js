import {PROVIDER_EVENT_TYPES} from './communication-domain.js';

const OUTCOMES=['accepted','temporary_failure','permanent_failure','outcome_unknown'];
const COMMAND_KEYS=new Set(['attemptRef','dispatchGeneration','payloadRef','payloadDigest']);
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(value)?value:null;

export function validateLocalDispatchCommand(command={}){
  const unexpected=Object.keys(command).find(key=>!COMMAND_KEYS.has(key));
  if(unexpected)return {error:'Local dispatch command contains a prohibited field',sensitivePath:`root.${unexpected}`};
  const attemptRef=opaque(command.attemptRef),payloadRef=opaque(command.payloadRef),payloadDigest=opaque(command.payloadDigest),
    dispatchGeneration=Number(command.dispatchGeneration);
  if(!attemptRef||!payloadRef||!payloadDigest)return {error:'Opaque attempt, payload reference, and digest are required'};
  if(!Number.isInteger(dispatchGeneration)||dispatchGeneration<1)return {error:'Dispatch generation must be a positive integer'};
  return {value:{attemptRef,dispatchGeneration,payloadRef,payloadDigest}};
}

export function createLocalCommunicationConnector({scenarioByAttempt={},clock=()=>new Date()}={}){
  const outcomes=new Map(),dispatchCounts=new Map(),dispatchResults=new Map(),correlations=new Set(),events=[],eventHistory=new Map();
  let eventSequence=0;

  for(const [attemptRef,sequence] of Object.entries(scenarioByAttempt)){
    if(!opaque(attemptRef))throw new Error('Local scenario attempt reference must be opaque');
    if(!Array.isArray(sequence)||!sequence.length||sequence.some(outcome=>!OUTCOMES.includes(outcome))){
      throw new Error('Local scenario contains an unsupported outcome');
    }
    outcomes.set(attemptRef,[...sequence]);
  }

  const timestamp=()=>{
    const parsed=new Date(clock());
    if(Number.isNaN(parsed.valueOf()))throw new Error('Local connector clock returned an invalid timestamp');
    return parsed.toISOString();
  };

  const nextEvent=(providerCorrelationRef,eventType)=>{
    eventSequence+=1;
    const occurredAt=timestamp();
    return Object.freeze({providerEventRef:`local-event-${eventSequence}`,providerCorrelationRef,eventType,
      occurredAt,receivedAt:occurredAt,signatureVerified:true,replayDetected:false});
  };

  const queueEvent=(providerCorrelationRef,eventType)=>{
    if(!correlations.has(providerCorrelationRef))throw new Error('Local provider correlation reference is unknown');
    if(!PROVIDER_EVENT_TYPES.includes(eventType))throw new Error('Local provider event type is unsupported');
    const event=nextEvent(providerCorrelationRef,eventType);
    events.push(event);
    eventHistory.set(event.providerEventRef,event);
    return event;
  };

  return Object.freeze({
    enabled:true,
    providerKey:'local-simulator',
    networkCapable:false,

    async dispatch(command={}){
      const validated=validateLocalDispatchCommand(command);
      if(validated.error)return {accepted:false,retryable:false,reasonCode:'invalid_local_command',error:validated.error};
      const value=validated.value,idempotencyKey=`${value.attemptRef}:${value.dispatchGeneration}`;
      if(dispatchResults.has(idempotencyKey))return dispatchResults.get(idempotencyKey);

      const count=(dispatchCounts.get(value.attemptRef)||0)+1;
      dispatchCounts.set(value.attemptRef,count);
      const sequence=outcomes.get(value.attemptRef)||['accepted'];
      const outcome=sequence[Math.min(count-1,sequence.length-1)];
      let result;

      if(outcome==='accepted'){
        const providerCorrelationRef=`local-correlation-${value.attemptRef}`;
        correlations.add(providerCorrelationRef);
        const acceptedEvent=queueEvent(providerCorrelationRef,'accepted');
        result=Object.freeze({accepted:true,retryable:false,reasonCode:'provider_accepted',
          providerCorrelationRef,providerEventRef:acceptedEvent.providerEventRef});
      }else if(outcome==='temporary_failure'){
        result=Object.freeze({accepted:false,retryable:true,reasonCode:'provider_temporarily_unavailable'});
      }else if(outcome==='permanent_failure'){
        result=Object.freeze({accepted:false,retryable:false,reasonCode:'provider_rejected'});
      }else{
        result=Object.freeze({accepted:false,retryable:false,outcomeUnknown:true,reasonCode:'provider_outcome_unknown'});
      }
      dispatchResults.set(idempotencyKey,result);
      return result;
    },

    emitProviderEvent(providerCorrelationRef,eventType){return queueEvent(providerCorrelationRef,eventType);},

    duplicateProviderEvent(providerEventRef){
      const original=eventHistory.get(providerEventRef);
      if(!original)throw new Error('Local provider event reference is unknown');
      events.push(original);
      return original;
    },

    emitReplay(providerCorrelationRef,eventType){
      const event=queueEvent(providerCorrelationRef,eventType);
      const replay=Object.freeze({...event,replayDetected:true});
      events[events.length-1]=replay;
      eventHistory.set(replay.providerEventRef,replay);
      return replay;
    },

    drainEvents(){return events.splice(0,events.length);},
    getDispatchCount(attemptRef){return dispatchCounts.get(attemptRef)||0;}
  });
}
