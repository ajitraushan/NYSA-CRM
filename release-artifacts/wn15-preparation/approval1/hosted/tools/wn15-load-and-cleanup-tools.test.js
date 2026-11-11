import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deterministicRandom,syntheticPhoneAt} from '../src/whatsapp-simulated-provider.js';
import {buildSimulationJobs,validateLoadTargets,validatePhoneStartOffset} from '../tools/whatsapp-simulation-load.mjs';
import {assertScopeMatches,removeRunEvidenceFromRestrictions,validateCleanupProof,validateRunId} from '../tools/whatsapp-simulation-cleanup.mjs';

const simulatorConfig={syntheticPrefix:'+971509',syntheticDigits:6};

test('WN-15 phoneStartOffset validates and records the approved non-overlapping ranges',()=>{
  assert.deepEqual(validatePhoneStartOffset(100000,{conversationCount:500,syntheticDigits:6}),{offset:100000,endOffset:100499,capacity:1000000});
  assert.deepEqual(validatePhoneStartOffset(101000,{conversationCount:2000,syntheticDigits:6}),{offset:101000,endOffset:102999,capacity:1000000});
  assert.deepEqual(validatePhoneStartOffset(110000,{conversationCount:10000,syntheticDigits:6}),{offset:110000,endOffset:119999,capacity:1000000});
  assert.throws(()=>validatePhoneStartOffset(-1,{conversationCount:500,syntheticDigits:6}),/non-negative whole number/);
  assert.throws(()=>validatePhoneStartOffset(999500,{conversationCount:501,syntheticDigits:6}),/exceeds/);
});

test('WN-15 load plan applies the offset to conversations, thread and STOP jobs',()=>{
  const plan=buildSimulationJobs({seed:'wn15-a',requestedConversations:3,requestedMessages:2,requestedOptOuts:2},100000,simulatorConfig,{deterministicRandom,syntheticPhoneAt});
  assert.equal(plan.phoneStartOffset,100000);
  assert.equal(plan.phoneEndOffset,100002);
  assert.equal(plan.firstPhone,'+971509100000');
  assert.equal(plan.lastPhone,'+971509100002');
  assert.deepEqual(plan.jobs.filter(job=>job.kind==='conversation').map(job=>job.phoneIndex),[100000,100001,100002]);
  assert.deepEqual(plan.jobs.filter(job=>job.kind==='thread').map(job=>job.phoneIndex),[100000,100000]);
  assert.deepEqual(plan.jobs.filter(job=>job.kind==='optout').map(job=>job.phoneIndex),[100000,100001]);
});

test('WN-15 load source requires a fresh receipt and records the offset in the API result and receipt',()=>{
  const source=fs.readFileSync(new URL('../tools/whatsapp-simulation-load.mjs',import.meta.url),'utf8');
  assert.match(source,/--receipt is required/);
  assert.match(source,/flag:'wx'/);
  assert.match(source,/phoneStartOffset:plan\.phoneStartOffset/);
  assert.match(source,/body:\{failed:failed>0,result\}/);
  assert.match(source,/nysa\.wn15\.load\.v1/);
});

test('WN-15 load targets allow one to three teams and two to ten unique Agents',()=>{
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const runA=validateLoadTargets([
    {teamId:id(1),agentIds:[id(11),id(12)]},
    {teamId:id(2),agentIds:[]}
  ],{expectedTeamCount:2,expectedAgentCount:2});
  assert.equal(runA.teamCount,2);
  assert.equal(runA.agentCount,2);
  assert.deepEqual(runA.teamTargets,[{teamId:id(1),agentCount:2},{teamId:id(2),agentCount:0}]);
  assert.deepEqual(runA.agents,[{teamId:id(1),agentId:id(11)},{teamId:id(1),agentId:id(12)}]);
  assert.equal(validateLoadTargets([{teamId:id(1),agentIds:[id(11),id(12)]}]).teamCount,1);
  assert.equal(validateLoadTargets([
    {teamId:id(1),agentIds:[id(11),id(12),id(13),id(14)]},
    {teamId:id(2),agentIds:[id(15),id(16),id(17)]},
    {teamId:id(3),agentIds:[id(18),id(19),id(20)]}
  ]).agentCount,10);
  assert.throws(()=>validateLoadTargets([{teamId:id(1),agentIds:[id(11)]}]),/between two and ten/);
  assert.throws(()=>validateLoadTargets([
    {teamId:id(1),agentIds:[id(11),id(12)]},{teamId:id(2),agentIds:[]},{teamId:id(3),agentIds:[]},{teamId:id(4),agentIds:[]}
  ]),/between one and three/);
  assert.throws(()=>validateLoadTargets([{teamId:id(1),agentIds:[id(11),id(12)]}],{expectedTeamCount:2}),/team count mismatch/);
  assert.throws(()=>validateLoadTargets([{teamId:id(1),agentIds:[id(11),id(12)]}],{expectedAgentCount:3}),/Agent count mismatch/);
  assert.throws(()=>validateLoadTargets([{teamId:id(1),agentIds:[id(11)]},{teamId:id(2),agentIds:[id(11)]}]),/duplicated across teams/);
});

test('WN-15 load receipt records actual team, Agent and per-team allocation counts',()=>{
  const source=fs.readFileSync(new URL('../tools/whatsapp-simulation-load.mjs',import.meta.url),'utf8');
  assert.match(source,/teamCount:targets\.teamCount/);
  assert.match(source,/agentCount:targets\.agentCount/);
  assert.match(source,/teamTargets:targets\.teamTargets/);
  assert.match(source,/expectedTeamCount:args\['team-count'\]/);
  assert.match(source,/expectedAgentCount:args\['agent-count'\]/);
  assert.match(source,/loadAbort\.abort\(\)/);
  assert.match(source,/while\(!firstFailure\)/);
  assert.match(source,/aborted:Boolean\(firstFailure\)/);
  assert.match(source,/firstFailure=\{jobIndex:index/);
  assert.match(source,/--app-root is required/);
  assert.match(source,/assertSimulatedProviderEnvironment\(env\)/);
  assert.doesNotMatch(source,/from ['"]\.\.\/src\//);
});

test('WN-15 cleanup removes only restrictions backed by exact run event evidence',()=>{
  const restrictions={
    opt_out:{active:true,evidenceReference:'SIM-11111111-1111-4111-8111-111111111111:optout:0'},
    dncr:{active:true,evidenceReference:'MANUAL-DNCR-42'},
    wrong_number:{active:false,evidenceReference:'SIM-other-run:optout:0'}
  };
  const changed=removeRunEvidenceFromRestrictions(restrictions,['SIM-11111111-1111-4111-8111-111111111111:optout:0']);
  assert.deepEqual(changed.removed,['opt_out']);
  assert.equal(changed.strongest,'dncr');
  assert.deepEqual(Object.keys(changed.retained).sort(),['dncr','wrong_number']);
  assert.equal(changed.retained.wrong_number.evidenceReference,'SIM-other-run:optout:0');
});

test('WN-15 cleanup fails closed on run, count or fingerprint drift',()=>{
  const approved={runId:'11111111-1111-4111-8111-111111111111',counts:{conversations:500,suppressionRestrictions:20},scopeFingerprint:'a'.repeat(64)};
  assert.doesNotThrow(()=>assertScopeMatches(structuredClone(approved),approved));
  assert.throws(()=>assertScopeMatches({...approved,counts:{...approved.counts,conversations:499}},approved),/count mismatch/);
  assert.throws(()=>assertScopeMatches({...approved,scopeFingerprint:'b'.repeat(64)},approved),/fingerprint mismatch/);
  assert.throws(()=>validateRunId('WN15-A'),/exact simulation run UUID/);
});

test('WN-15 cleanup proof retains only the cleaned run record and provider events',()=>{
  const scope={counts:{providerEvents:500}};
  const proof=validateCleanupProof({remainingGeneratedRows:{conversations:0,messages:0,notifications:0,assignmentHistory:0,leads:0,contacts:0,suppressionRestrictions:0},retainedRun:[{status:'cleaned',cleaned_at:'2026-11-11T00:00:00Z'}],retainedProviderEvents:500},scope);
  assert.deepEqual(proof.retainedEvidence,{runRecords:1,providerEvents:500,status:'cleaned'});
  assert.throws(()=>validateCleanupProof({remainingGeneratedRows:{messages:1},retainedRun:[{status:'cleaned',cleaned_at:'x'}],retainedProviderEvents:500},scope),/cleanup verification failed/);
  assert.throws(()=>validateCleanupProof({remainingGeneratedRows:{messages:0},retainedRun:[],retainedProviderEvents:500},scope),/exactly one cleaned run/);
  assert.throws(()=>validateCleanupProof({remainingGeneratedRows:{messages:0},retainedRun:[{status:'cleaned',cleaned_at:'x'}],retainedProviderEvents:499},scope),/retention mismatch/);
});

test('WN-15 cleanup source retains the run evidence and deletes only exact generated records',()=>{
  const source=fs.readFileSync(new URL('../tools/whatsapp-simulation-cleanup.mjs',import.meta.url),'utf8');
  assert.match(source,/--app-root is required/);
  assert.match(source,/pathToFileURL\(dbModule\)/);
  assert.match(source,/BEGIN TRANSACTION READ ONLY/);
  assert.match(source,/dry-run-receipt/);
  assert.match(source,/Dry-run receipt hash mismatch/);
  assert.match(source,/Cleanup count mismatch/);
  assert.match(source,/run_scoped_cleanup_completed/);
  assert.match(source,/proveCleanup/);
  assert.match(source,/status='cleaned'/);
  assert.match(source,/providerEventsRetained/);
  assert.match(source,/retainedProviderEvents/);
  assert.match(source,/refuses .*campaign recipient link/);
  assert.match(source,/simulation_run_id=\$1/);
  assert.match(source,/evidenceReference'=ANY/);
  assert.doesNotMatch(source,/DELETE FROM wa_simulation_runs/);
  assert.doesNotMatch(source,/DELETE FROM wa_simulated_provider_events/);
  assert.doesNotMatch(source,/LIKE\s+['"]\+971509|name\s+LIKE/i);
});

test('WN-15 inventory scripts are read-only, bounded and preserve the database state',()=>{
  for(const script of ['wn15-unused-range-readonly.sql','wn15-synthetic-user-inventory-readonly.sql','wn15-team-state-readonly.sql']){
    const source=fs.readFileSync(new URL(`../tools/${script}`,import.meta.url),'utf8');
    assert.match(source,/BEGIN TRANSACTION READ ONLY;/);
    assert.match(source,/statement_timeout = '60s'/);
    assert.match(source,/ROLLBACK;/);
    assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
  }
  const range=fs.readFileSync(new URL('../tools/wn15-unused-range-readonly.sql',import.meta.url),'utf8');
  assert.match(range,/971509100000/);
  assert.match(range,/971509119999/);
  const users=fs.readFileSync(new URL('../tools/wn15-synthetic-user-inventory-readonly.sql',import.meta.url),'utf8');
  assert.doesNotMatch(users,/password|credential|secret/i);
  const teams=fs.readFileSync(new URL('../tools/wn15-team-state-readonly.sql',import.meta.url),'utf8');
  assert.match(teams,/d2000000-0000-4000-8000-000000000001/);
  assert.match(teams,/d2000000-0000-4000-8000-000000000002/);
  assert.doesNotMatch(teams,/d1000000-0000-4000-8000-000000000006/);
});
