import assert from 'node:assert/strict';
import test from 'node:test';
import {restartCrmTest} from '../tools/crm-test-controlled-restart.mjs';

function fixture({pids=[3769785,3585328],after=[42]}={}) {
  const calls=[];
  const ready={version:'2.1.0-dev.272',database:'ready',workerCount:after.length,
    workers:after.map(pid=>({pid}))};
  return {calls,ready,options:{
    inspect:()=>pids.map(pid=>({pid})),
    getRegistration:()=>({app_status:calls.includes('stop')?'stopped':'started',
      env_vars:{PROSPECT_DIGEST_EMAIL_ENABLED:'false',PROSPECT_DIGEST_SCHEDULE_ENABLED:'false'}}),
    control:action=>calls.push(action),
    stopWorkers:async (_root,guards)=>{
      assert.equal(await guards.assertStopped(),true);
      assert.deepEqual(guards.inspect().map(worker=>worker.pid),pids);
      calls.push('reconcile');
    },
    readiness:async ()=>{calls.push('readiness');return ready;},
  }};
}

const reviewed=[3585328,3769785];
test('two reviewed workers reconcile before start regardless of enumeration order',async ()=>{
  const {calls,options}=fixture();
  assert.equal((await restartCrmTest(reviewed,options)).workers[0].pid,42);
  assert.deepEqual(calls,['stop','reconcile','start','readiness']);
});

test('a changed worker set prevents selector actions',async ()=>{
  const {calls,options}=fixture({pids:[3585328,99]});
  await assert.rejects(restartCrmTest(reviewed,options),/worker set changed/);
  assert.deepEqual(calls,[]);
});

test('post-start verification refuses zero, duplicate and old workers',async ()=>{
  for(const after of [[],[42,43],[3585328]]){
    const {calls,options}=fixture({after});
    await assert.rejects(restartCrmTest(reviewed,options),/exactly one new worker/);
    assert.deepEqual(calls,['stop','reconcile','start','readiness']);
  }
});
