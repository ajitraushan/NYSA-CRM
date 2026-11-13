import test from 'node:test';import assert from 'node:assert/strict';
import {inspectInstallWorkers,verifiedWorker,inspectWorkers,verifyReadinessWorker,stopVerifiedWorkers} from '../tools/hosted-worker-lifecycle.mjs';
const root='/home/nysareal/nysa-crm',marker=`lsnode:${root}/`,worker={pid:23,command:marker,cwd:root};
test('hosted worker verification requires both exact process marker and exact working directory',()=>{
 assert.deepEqual(verifiedWorker(root,23,{readFile:()=>marker+'\0',realpath:()=>root}),worker);
 assert.equal(verifiedWorker(root,23,{readFile:()=>marker+'\0',realpath:()=>root+'-old'}),null);
 assert.equal(verifiedWorker(root,23,{readFile:()=>marker+'other\0',realpath:()=>root}),null);
 assert.deepEqual(inspectWorkers(root,{ps:()=>`23 ${marker}\n24 lsnode:/home/nysareal/other/\n25 node task.js`,verify:()=>worker}),[worker]);
});
test('readiness precedes worker acceptance; zero or duplicate workers fail after the request',async()=>{
 for(const count of[0,1,2]){const order=[],args={root,expectedVersion:'2.1.0-dev.251',request:async()=>{order.push('readiness');return{status:200,json:async()=>({ok:true,database:'ready',version:'2.1.0-dev.251'})};},inspect:()=>{order.push('workers');return Array.from({length:count},(_,i)=>({...worker,pid:23+i}));}};if(count===1)assert.equal((await verifyReadinessWorker(args)).workerCount,1);else await assert.rejects(()=>verifyReadinessWorker(args),error=>error.message.endsWith(count===0?'Found 0 (PIDs: none)':'Found 2 (PIDs: 23, 24)'));assert.deepEqual(order,['readiness','workers']);}
});
test('worker reconciliation never signals a mismatched or reused PID and requires a stopped registration',async()=>{
 const signals=[];let calls=0;await assert.rejects(()=>stopVerifiedWorkers(root,{assertStopped:async()=>false}),/must be stopped/);
 const result=await stopVerifiedWorkers(root,{assertStopped:async()=>true,inspect:()=>calls++===0?[worker]:[],verify:()=>null,signal:(...args)=>signals.push(args)});assert.equal(result.stopped,1);assert.deepEqual(signals,[]);
 calls=0;await stopVerifiedWorkers(root,{assertStopped:async()=>true,inspect:()=>calls++===0?[worker]:[],verify:()=>worker,signal:(...args)=>signals.push(args)});assert.deepEqual(signals,[[23,'SIGTERM']]);
});

test('pre-install inventory accepts one, two or three verified workers with start times',()=>{
 for(const count of [1,2,3]){
  const workers=Array.from({length:count},(_,i)=>({...worker,pid:23+i}));
  const inventory=inspectInstallWorkers(root,{inspect:()=>workers,verify:pid=>workers.find(row=>row.pid===pid),
   readStart:pid=>'start '+pid});
  assert.deepEqual(inventory,workers.map(row=>({...row,startedAt:'start '+row.pid})));
 }
 assert.throws(()=>inspectInstallWorkers(root,{inspect:()=>[]}),/At least one/);
});
test('post-start readiness rejects a pre-install PID',async()=>{
 const options={root,expectedVersion:'2.1.0-dev.273',previousWorkers:[worker],inspect:()=>[worker],
  request:async()=>({status:200,json:async()=>({ok:true,database:'ready',version:'2.1.0-dev.273'})})};
 await assert.rejects(verifyReadinessWorker(options),/pre-install worker PID: 23/);
 assert.equal((await verifyReadinessWorker({...options,inspect:()=>[{...worker,pid:24}]})).workerCount,1);
});
