import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  evaluateCommunicationPolicy,validateCommunicationAttempt,evaluateDispatchGate,
  transitionCommunicationState,validateProviderEventEnvelope,providerEventIdempotencyKey,
  findSensitiveEnvelopeKey
} from '../src/communication-domain.js';
import {createDisabledCommunicationConnector,requireEnabledCommunicationConnector} from '../src/communication-connector.js';

const refs={
  subjectRef:'subject-ref-a',scopeRef:'scope-ref-a',channelRef:'channel-ref-a',actorRef:'actor-ref-a',
  purpose:'transactional_share',channel:'whatsapp',policyVersion:'policy-v1',
  evaluatedAt:'2030-01-01T10:00:00.000Z',validUntil:'2030-01-01T10:05:00.000Z'
};

test('communication policy fails closed and returns controlled reason codes',()=>{
  const denied=evaluateCommunicationPolicy({...refs,actorAuthorized:true,channelEligible:true,
    consentPermits:false,restrictionClear:true,subjectEligible:true});
  assert.equal(denied.value.outcome,'denied');
  assert.deepEqual(denied.value.reasonCodes,['consentPermits']);
  const allowed=evaluateCommunicationPolicy({...refs,actorAuthorized:true,channelEligible:true,
    consentPermits:true,restrictionClear:true,subjectEligible:true});
  assert.equal(allowed.value.outcome,'allowed');
});

test('communication attempts retain references and digests without communication content',()=>{
  const result=validateCommunicationAttempt({id:'attempt-ref-a',...refs,policyDecisionRef:'policy-ref-a',
    payloadRef:'restricted-ref-a',payloadDigest:'digest-a',state:'policy_approved'});
  assert.equal(result.value.payloadRef,'restricted-ref-a');
  assert.equal(Object.hasOwn(result.value,'message'),false);
  assert.equal(Object.hasOwn(result.value,'contactValue'),false);
  assert.match(validateCommunicationAttempt({id:'attempt-ref-a',...refs,policyDecisionRef:'policy-ref-a',
    payloadRef:'restricted-ref-a',payloadDigest:'digest-a',messageBody:''}).error,/prohibited direct sensitive field/);
});

test('dispatch remains disabled and requires fresh matching policy evidence',()=>{
  const attempt={id:'attempt-ref-a',...refs,policyDecisionRef:'policy-ref-a',state:'queued'};
  const policyDecision={id:'policy-ref-a',...refs,outcome:'allowed'};
  assert.equal(evaluateDispatchGate({attempt,policyDecision,connectorEnabled:false,now:'2030-01-01T10:01:00.000Z'}).reasonCode,'connector_disabled');
  assert.equal(evaluateDispatchGate({attempt,policyDecision,connectorEnabled:true,now:'2030-01-01T10:06:00.000Z'}).reasonCode,'policy_expired');
  assert.equal(evaluateDispatchGate({attempt,policyDecision,connectorEnabled:true,now:'2030-01-01T10:01:00.000Z'}).allowed,true);
});

test('communication state transitions distinguish provider acceptance from delivery and read',()=>{
  assert.equal(transitionCommunicationState('dispatching','provider_accept').value.nextState,'accepted');
  assert.equal(transitionCommunicationState('accepted','confirm_delivery').value.nextState,'delivered');
  assert.equal(transitionCommunicationState('delivered','confirm_read').value.nextState,'read');
  assert.match(transitionCommunicationState('accepted','confirm_read').error,/cannot follow/);
  assert.equal(transitionCommunicationState('dispatching','unknown_outcome').value.nextState,'outcome_unknown');
});

test('provider envelopes require verification, reject replay and prohibit sensitive fields',()=>{
  const safe={providerEventRef:'event-ref-a',providerCorrelationRef:'correlation-ref-a',eventType:'delivered',
    occurredAt:'2030-01-01T10:00:00.000Z',receivedAt:'2030-01-01T10:00:01.000Z',
    signatureVerified:true,replayDetected:false};
  assert.equal(validateProviderEventEnvelope(safe).value.eventType,'delivered');
  assert.match(validateProviderEventEnvelope({...safe,signatureVerified:false}).error,/not verified/);
  assert.match(validateProviderEventEnvelope({...safe,replayDetected:true}).error,/replay/);
  assert.ok(findSensitiveEnvelopeKey({...safe,messageBody:''}));
  assert.match(validateProviderEventEnvelope({...safe,messageBody:''}).error,/prohibited sensitive field/);
});

test('provider event idempotency is based only on opaque provider references',()=>{
  assert.equal(providerEventIdempotencyKey({providerKey:'provider-a',providerEventRef:'event-ref-a'}),'provider-a:event-ref-a');
  assert.equal(providerEventIdempotencyKey({providerKey:'provider-a'}),null);
});

test('the only available connector is disabled and cannot pass the enabled guard',async()=>{
  const connector=createDisabledCommunicationConnector();
  assert.equal(connector.enabled,false);
  assert.deepEqual(await connector.dispatch(),{accepted:false,reasonCode:'connector_disabled',retryable:false});
  assert.throws(()=>requireEnabledCommunicationConnector(connector),/disabled/);
});

test('the non-executable schema proposal excludes grants and direct sensitive-value columns',()=>{
  const migration=fs.readFileSync(new URL('../docs/schema-proposals/release3d_communication_core_scaffold.sql.proposed',import.meta.url),'utf8');
  assert.match(migration,/CREATE TABLE communication_policy_decisions/);
  assert.match(migration,/CREATE TABLE communication_outbox/);
  assert.match(migration,/UNIQUE \(provider_key,provider_event_ref\)/);
  assert.match(migration,/communication_attempts_provider_correlation_idx/);
  assert.match(migration,/No grants are included/);
  assert.doesNotMatch(migration,/recipient_phone|sender_phone|message_body|access_token|api_key/i);
});
