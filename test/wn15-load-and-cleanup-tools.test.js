import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSimulationJobs,validatePhoneStartOffset} from '../tools/whatsapp-simulation-load.mjs';
import {assertScopeMatches,removeRunEvidenceFromRestrictions,validateRunId} from '../tools/whatsapp-simulation-cleanup.mjs';

const simulatorConfig={syntheticPrefix:'+971509',syntheticDigits:6};

test('WN-15 phoneStartOffset validates and records the approved non-overlapping ranges',()=>{
  assert.deepEqual(validatePhoneStartOffset(100000,{conversationCount:500,syntheticDigits:6}),{offset:100000,endOffset:100499,capacity:1000000});
  assert.deepEqual(validatePhoneStartOffset(101000,{conversationCount:2000,syntheticDigits:6}),{offset:101000,endOffset:102999,capacity:1000000});
  assert.deepEqual(validatePhoneStartOffset(110000,{conversationCount:10000,syntheticDigits:6}),{offset:110000,endOffset:119999,capacity:1000000});
  assert.throws(()=>validatePhoneStartOffset(-1,{conversationCount:500,syntheticDigits:6}),/non-negative whole number/);
  assert.throws(()=>validatePhoneStartOffset(999500,{conversationCount:501,syntheticDigits:6}),/exceeds/);
});

test('WN-15 load plan applies the offset to conversations, thread and STOP jobs',()=>{
  const plan=buildSimulationJobs({seed:'wn15-a',requestedConversations:3,requestedMessages:2,requestedOptOuts:2},100000,simulatorConfig);
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

test('WN-15 cleanup source requires dry-run receipt, transaction, audit and zero proof without range selection',()=>{
  const source=fs.readFileSync(new URL('../tools/whatsapp-simulation-cleanup.mjs',import.meta.url),'utf8');
  assert.match(source,/--app-root is required/);
  assert.match(source,/pathToFileURL\(dbModule\)/);
  assert.match(source,/BEGIN TRANSACTION READ ONLY/);
  assert.match(source,/dry-run-receipt/);
  assert.match(source,/Dry-run receipt hash mismatch/);
  assert.match(source,/Cleanup count mismatch/);
  assert.match(source,/run_scoped_cleanup_completed/);
  assert.match(source,/proveZero/);
  assert.match(source,/simulation_run_id=\$1/);
  assert.match(source,/evidenceReference'=ANY/);
  assert.doesNotMatch(source,/LIKE\s+['"]\+971509|name\s+LIKE/i);
});

test('WN-15 inventory scripts are read-only, bounded and preserve the database state',()=>{
  for(const script of ['wn15-unused-range-readonly.sql','wn15-synthetic-user-inventory-readonly.sql']){
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
});
