import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inspectWorkers,verifiedWorker,stopVerifiedWorkers,verifyReadinessWorker} from './hosted-worker-lifecycle.mjs';
import {setTimeout as sleep} from 'node:timers/promises';

const productionRoot='/home/nysareal/nysa-crm';
const node='/opt/alt/alt-nodejs24/root/usr/bin/node';
const staleExe=node+' (deleted)';

function verifyExecutable(exe,pid){
  assert.ok(exe===node||exe===staleExe,'Unexpected executable for exact-root Production worker PID '+pid);
}

export function inspectProductionWorkers({
  inspect=()=>inspectWorkers(productionRoot,{ps:()=>execFileSync('ps',['-e','-o','pid=,args='],{encoding:'utf8',timeout:10000})}),
  verify=pid=>verifiedWorker(productionRoot,pid),
  readExe=pid=>fs.readlinkSync('/proc/'+pid+'/exe'),
  readProcess=pid=>execFileSync('ps',['-p',String(pid),'-o','user:32=','-o','lstart='],{encoding:'utf8',timeout:10000}).trim()
}={}){
  return inspect().map(worker=>{
    assert.ok(Number.isInteger(worker.pid)&&worker.pid>1,'Invalid Production worker PID');
    assert.equal(worker.command,`lsnode:${productionRoot}/`);
    assert.equal(worker.cwd,productionRoot);
    const exe=readExe(worker.pid);
    const processRow=/^(\S+)\s+(.+)$/.exec(readProcess(worker.pid));
    assert.ok(processRow,'Production worker process metadata unavailable for PID '+worker.pid);
    const [,user,startedAt]=processRow;
    assert.equal(user,'nysareal','Unexpected owner for exact-root Production worker PID '+worker.pid);
    verifyExecutable(exe,worker.pid);
    assert.ok(startedAt,'Production worker start time unavailable for PID '+worker.pid);
    assert.deepEqual(verify(worker.pid),worker,'Production worker identity changed while collecting evidence');
    return {...worker,user,startedAt,exe,stale:exe===staleExe};
  });
}

export async function quiesceProductionWorkers(report,{selectorStop,isStopped,
  inspect=inspectProductionWorkers,reconcile=stopVerifiedWorkers,
  verify=pid=>{
    const worker=verifiedWorker(productionRoot,pid);
    if(worker)verifyExecutable(fs.readlinkSync('/proc/'+pid+'/exe'),pid);
    return worker;
  },
  signal=(pid,name)=>process.kill(pid,name)
}){
  report.workersBefore=inspect();
  report.staleWorkersFound=report.workersBefore.filter(worker=>worker.stale);
  report.workerSignals=[];
  await selectorStop();
  assert.equal(await isStopped(),true,'Production selector did not report stopped');
  report.workersAfterSelectorStop=inspect();
  const stale=new Map([...report.staleWorkersFound,...report.workersAfterSelectorStop.filter(worker=>worker.stale)]
    .map(worker=>[worker.pid,worker]));
  report.staleWorkersFound=[...stale.values()];
  const inspectAndRecord=()=>{
    const workers=inspect();
    for(const worker of workers)if(worker.stale)stale.set(worker.pid,worker);
    report.staleWorkersFound=[...stale.values()];
    return workers;
  };
  await reconcile(productionRoot,{assertStopped:isStopped,inspect:inspectAndRecord,verify,signal:(pid,name)=>{
    signal(pid,name);
    report.workerSignals.push({pid,signal:name,at:new Date().toISOString()});
  }});
  report.workersAfterQuiesce=inspectAndRecord();
  assert.equal(report.workersAfterQuiesce.length,0,'Production must have zero verified workers before start');
  report.staleWorkersStopped=[...stale.values()];
}

export async function acceptProductionReadiness(report,version,{
  verify=verifyReadinessWorker,
  request=url=>fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)}),
  inspect=inspectProductionWorkers,pause=sleep,attempts=15
}={}){
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      report.readiness=await verify({root:productionRoot,expectedVersion:version,inspect:()=>{
        report.workersAfterReadiness=inspect();
        return report.workersAfterReadiness;
      },request:async url=>{
        const response=await request(url);
        const body=await response.clone().json().catch(()=>null);
        if(response.status===200&&body?.ok===true&&body.database==='ready'&&body.version===version){
          report.readinessAccepted=true;
        }
        return response;
      }});
      return report.readiness;
    }catch(error){
      if(report.readinessAccepted||attempt===attempts-1)throw error;
      await pause(2000);
    }
  }
}
