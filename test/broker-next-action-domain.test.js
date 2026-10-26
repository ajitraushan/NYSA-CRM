import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrokerNextActions,previewBrokerActionDecision} from '../src/broker-next-action-domain.js';

const now='2026-08-08T12:00:00.000Z';
const response=(overrides={})=>({responseReference:'RESP-SYN-001',evidenceHash:'a'.repeat(64),outcome:'interested',occurredAt:'2026-08-08T09:00:00.000Z',responsibleAgentReference:'AGENT-SYN-001',opportunityReference:'OPP-SYN-001',requirementReference:'REQ-SYN-003',propertyReference:'NYSA-SYN-001',responseSource:'manual_fallback',workingContext:{summary:'Customer expressed interest in the reviewed property.',missingFacts:['Service charge confirmation']},...overrides});

test('broker queue ranks overdue and urgent actions deterministically',async()=>{
  const result=await prepareBrokerNextActions({now,responses:[
    response(),
    response({responseReference:'RESP-SYN-002',evidenceHash:'b'.repeat(64),outcome:'viewing_requested',occurredAt:'2026-08-08T09:30:00.000Z',propertyReference:'NYSA-SYN-002'}),
    response({responseReference:'RESP-SYN-003',evidenceHash:'c'.repeat(64),outcome:'information_required',occurredAt:'2026-08-08T11:30:00.000Z',propertyReference:'NYSA-SYN-003'})
  ]});
  assert.deepEqual(result.value.actions.map(item=>item.action.code),['coordinate_viewing','follow_up_interest','prepare_property_information']);
  assert.equal(result.value.counts.overdue,1);
  assert.equal(result.value.actions[0].priority,'critical');
  assert.equal(result.value.actions[0].changesInventory,false);
});

test('broker queue formats long overdue periods as weeks instead of large minute counts',async()=>{
  const result=await prepareBrokerNextActions({now,responses:[response({occurredAt:'2026-07-18T08:00:00.000Z'})]});
  assert.match(result.value.actions[0].ageingLabel,/Overdue by 3 weeks/);
  assert.doesNotMatch(result.value.actions[0].ageingLabel,/\d{4,} min/);
});

test('not-suitable actions respect property-only, review and confirmed requirement evidence',async()=>{
  const make=(code,index)=>response({responseReference:`RESP-SYN-NS-${index}`,evidenceHash:String(index).repeat(64),outcome:'not_suitable',notSuitableEvidence:{preferenceImpact:{code}},occurredAt:'2026-08-08T11:00:00.000Z'});
  const result=await prepareBrokerNextActions({now,responses:[make('property_only',1),make('review_required',2),make('confirmed_change',3)]});
  assert.deepEqual(new Set(result.value.actions.map(item=>item.action.code)),new Set(['continue_matching','review_preferences','version_requirement']));
});

test('action decision is a preview and cannot mutate business state',async()=>{
  const action=(await prepareBrokerNextActions({now,responses:[response()]})).value.actions[0];
  const result=await previewBrokerActionDecision(action,{decision:'complete',note:'Synthetic local completion evidence.',decidedBy:'AGENT-SYN-001',decidedAt:now});
  assert.equal(result.value.status,'preview_not_applied');
  assert.equal(result.value.automaticSend,false);
  assert.equal(result.value.changesInventory,false);
  assert.equal(result.value.changesOpportunityStage,false);
});

test('deferral requires a future time and all actions require controlled context',async()=>{
  const action=(await prepareBrokerNextActions({now,responses:[response()]})).value.actions[0];
  assert.match((await previewBrokerActionDecision(action,{decision:'defer',note:'Synthetic',decidedBy:'AGENT-SYN-001',decidedAt:now,deferUntil:'2026-08-08T11:00:00.000Z'})).error,/after/);
  assert.match((await prepareBrokerNextActions({now,responses:[response({responsibleAgentReference:null})]})).error,/Responsible agent/);
});
