import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCommunicationPolicy,validateCommunicationAttempt,evaluateDispatchGate,
  transitionCommunicationState,validateProviderEventEnvelope,providerEventIdempotencyKey
} from '../src/communication-domain.js';
import {requireEnabledCommunicationConnector} from '../src/communication-connector.js';
import {createLocalCommunicationConnector,validateLocalDispatchCommand} from '../src/communication-local-connector.js';

const fixedClock=()=>new Date('2031-02-03T04:05:06.000Z');
const basePolicy={
  subjectRef:'subject-ref-local',scopeRef:'scope-ref-local',channelRef:'channel-ref-local',actorRef:'actor-ref-local',
  purpose:'transactional_share',channel:'whatsapp',policyVersion:'policy-v-local',
  evaluatedAt:'2031-02-03T04:00:00.000Z',validUntil:'2031-02-03T04:10:00.000Z',
  actorAuthorized:true,channelEligible:true,consentPermits:true,restrictionClear:true,subjectEligible:true
};

const attemptInput={
  id:'attempt-ref-local',subjectRef:'subject-ref-local',scopeRef:'scope-ref-local',channelRef:'channel-ref-local',
  actorRef:'actor-ref-local',policyDecisionRef:'policy-ref-local',purpose:'transactional_share',channel:'whatsapp',
  direction:'outbound',state:'queued',payloadRef:'restricted-ref-local',payloadDigest:'digest-local'
};

test('local connector has no network capability and accepts only opaque dispatch references',()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock});
  assert.equal(requireEnabledCommunicationConnector(connector),connector);
  assert.equal(connector.networkCapable,false);
  assert.equal(validateLocalDispatchCommand({attemptRef:'attempt-ref-local',dispatchGeneration:1,
    payloadRef:'restricted-ref-local',payloadDigest:'digest-local'}).value.dispatchGeneration,1);
  assert.match(validateLocalDispatchCommand({attemptRef:'attempt-ref-local',dispatchGeneration:1,
    payloadRef:'restricted-ref-local',payloadDigest:'digest-local',messageBody:''}).error,/prohibited field/);
});

test('local accepted dispatch is idempotent and emits one verified normalized event',async()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock});
  const command={attemptRef:'attempt-ref-local',dispatchGeneration:1,payloadRef:'restricted-ref-local',payloadDigest:'digest-local'};
  const first=await connector.dispatch(command),duplicate=await connector.dispatch(command);
  assert.deepEqual(duplicate,first);
  assert.equal(connector.getDispatchCount('attempt-ref-local'),1);
  const events=connector.drainEvents();
  assert.equal(events.length,1);
  assert.equal(validateProviderEventEnvelope(events[0]).value.eventType,'accepted');
});

test('temporary failure moves to retry and a new generation can later be accepted',async()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock,
    scenarioByAttempt:{'attempt-ref-retry':['temporary_failure','accepted']}});
  const first=await connector.dispatch({attemptRef:'attempt-ref-retry',dispatchGeneration:1,
    payloadRef:'restricted-ref-retry',payloadDigest:'digest-retry'});
  assert.equal(first.retryable,true);
  assert.equal(transitionCommunicationState('dispatching','temporary_failure').value.nextState,'retry_wait');
  const second=await connector.dispatch({attemptRef:'attempt-ref-retry',dispatchGeneration:2,
    payloadRef:'restricted-ref-retry',payloadDigest:'digest-retry'});
  assert.equal(second.accepted,true);
  assert.equal(connector.getDispatchCount('attempt-ref-retry'),2);
});

test('permanent failure and unknown outcome take different recovery paths',async()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock,scenarioByAttempt:{
    'attempt-ref-permanent':['permanent_failure'],'attempt-ref-unknown':['outcome_unknown']
  }});
  const permanent=await connector.dispatch({attemptRef:'attempt-ref-permanent',dispatchGeneration:1,
    payloadRef:'restricted-ref-permanent',payloadDigest:'digest-permanent'});
  assert.equal(permanent.retryable,false);
  assert.equal(transitionCommunicationState('dispatching','permanent_failure').value.nextState,'failed_permanent');
  const unknown=await connector.dispatch({attemptRef:'attempt-ref-unknown',dispatchGeneration:1,
    payloadRef:'restricted-ref-unknown',payloadDigest:'digest-unknown'});
  assert.equal(unknown.outcomeUnknown,true);
  assert.equal(transitionCommunicationState('dispatching','unknown_outcome').value.nextState,'outcome_unknown');
  assert.equal(transitionCommunicationState('outcome_unknown','reconcile').value.nextState,'reconciled');
});

test('delivery and read events preserve lifecycle ordering',async()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock});
  const accepted=await connector.dispatch({attemptRef:'attempt-ref-events',dispatchGeneration:1,
    payloadRef:'restricted-ref-events',payloadDigest:'digest-events'});
  connector.drainEvents();
  connector.emitProviderEvent(accepted.providerCorrelationRef,'delivered');
  connector.emitProviderEvent(accepted.providerCorrelationRef,'read');
  const events=connector.drainEvents();
  assert.deepEqual(events.map(event=>event.eventType),['delivered','read']);
  assert.equal(transitionCommunicationState('accepted','confirm_delivery').value.nextState,'delivered');
  assert.equal(transitionCommunicationState('delivered','confirm_read').value.nextState,'read');
  assert.ok(events.every(event=>validateProviderEventEnvelope(event).value));
});

test('duplicate events collapse to one idempotency key and explicit replay is rejected',async()=>{
  const connector=createLocalCommunicationConnector({clock:fixedClock});
  const accepted=await connector.dispatch({attemptRef:'attempt-ref-duplicate',dispatchGeneration:1,
    payloadRef:'restricted-ref-duplicate',payloadDigest:'digest-duplicate'});
  const acceptedEvents=connector.drainEvents();
  connector.duplicateProviderEvent(acceptedEvents[0].providerEventRef);
  assert.equal(connector.drainEvents()[0].providerEventRef,acceptedEvents[0].providerEventRef);
  const delivered=connector.emitProviderEvent(accepted.providerCorrelationRef,'delivered');
  connector.duplicateProviderEvent(delivered.providerEventRef);
  const duplicates=connector.drainEvents();
  const keys=new Set(duplicates.map(event=>providerEventIdempotencyKey({providerKey:connector.providerKey,...event})));
  assert.equal(duplicates.length,2);
  assert.equal(keys.size,1);
  const replay=connector.emitReplay(accepted.providerCorrelationRef,'read');
  assert.match(validateProviderEventEnvelope(replay).error,/replay/);
});

test('local end-to-end gate uses matching fresh policy and stores no direct content',async()=>{
  const policy=evaluateCommunicationPolicy(basePolicy).value;
  policy.id='policy-ref-local';
  const attempt=validateCommunicationAttempt(attemptInput).value;
  assert.equal(evaluateDispatchGate({attempt,policyDecision:policy,connectorEnabled:true,
    now:'2031-02-03T04:05:06.000Z'}).allowed,true);
  const connector=createLocalCommunicationConnector({clock:fixedClock});
  const result=await connector.dispatch({attemptRef:attempt.id,dispatchGeneration:1,
    payloadRef:attempt.payloadRef,payloadDigest:attempt.payloadDigest});
  assert.equal(result.accepted,true);
  assert.equal(Object.hasOwn(result,'message'),false);
  assert.equal(Object.hasOwn(result,'contactValue'),false);
});
