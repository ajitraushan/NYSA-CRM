import {parseResourceUsage} from './wn15-resource-usage.mjs';
import fs from 'node:fs';
import {inspectWorkers} from './hosted-worker-lifecycle.mjs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {api,command,context,freshBackup,productionUrl,quota,requireCondition,root,teams,testUrl,toolsDir,verifyRange,verifyTeams,workspace} from './wn15-dev272-common.mjs';

const website='https://www.nysarealty.com';
const probes=[testUrl+'/api/health',testUrl+'/api/readiness',testUrl+'/',productionUrl+'/api/health',productionUrl+'/api/readiness',productionUrl+'/',website+'/'];
const seed='wn15-run-a-dev272-20261113';
const output=workspace+'/run-a-dev272';
const {db,query,simEnv}=await context();
freshBackup();
verifyTeams(query,1);
verifyRange(db);
requireCondition(query("SELECT count(*) FROM wa_simulation_runs WHERE seed='"+seed+"'")==='0','Run A seed already exists');
const simulator=await api('/admin/whatsapp-simulation');
requireCondition(simulator.enabled===true&&simulator.environment==='crm-test'&&simulator.externalNetwork===false&&simulator.state?.paused===true&&simulator.state?.faultMode==='none','Running simulator state mismatch');

// Require the account registration to identify the website as local.
const domains=JSON.parse(command('uapi',['--output=json','DomainInfo','list_domains'])).result;
requireCondition(Number(domains?.status)===1&&domains.data?.main_domain==='nysarealty.com','Cannot establish website account mapping');

function resourceSample(){
  return parseResourceUsage(JSON.parse(command('uapi',['--output=json','ResourceUsage','get_usages'],process.env,1000)));
}

async function sample(){
  const timed=await Promise.all(probes.map(async url=>{
    const start=performance.now();
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(3000)});
    requireCondition(response.ok,'Probe failed: '+url+' HTTP '+response.status);
    if(url.endsWith('/api/health')||url.endsWith('/api/readiness')){
      const body=await response.json();
      requireCondition(body.ok===true,'Probe unhealthy: '+url);
      requireCondition(body.version==='2.1.0-dev.272','Version drift: '+url);
      if(url.endsWith('/api/readiness'))requireCondition(body.database==='ready','Readiness drift: '+url);
    }else await response.body?.cancel();
    return Math.round(performance.now()-start);
  }));
  const workers=inspectWorkers(root);
  requireCondition(workers.length===1,'Expected one exact-root CRM Test worker');
  const resources=resourceSample(),accountQuota=quota(1000);
  console.log(JSON.stringify({at:new Date().toISOString(),probes:Object.fromEntries(probes.map((url,i)=>[url,timed[i]])),workers,resources,accountQuota}));
  return {timed,pid:workers[0].pid};
}

const baseline=[];
for(let i=0;i<3;i++){
  const started=Date.now();
  baseline.push(await sample());
  if(i<2)await delay(Math.max(0,5000-(Date.now()-started)));
}
const median=probes.map((_,i)=>baseline.map(row=>row.timed[i]).sort((a,b)=>a-b)[1]);
const consecutive=probes.map(()=>0);
let previous=baseline[0];
function assess(observed,compareLatency=true){
  requireCondition(observed.pid===previous.pid,'CRM Test worker changed');
  for(const [i,ms] of observed.timed.entries()){
    consecutive[i]=compareLatency&&ms>2*median[i]&&ms>median[i]+500?consecutive[i]+1:0;
    requireCondition(ms<3000&&consecutive[i]<2,'Response time stop threshold: '+probes[i]);
  }
  previous=observed;
}
for(const observed of baseline)assess(observed,false);

process.umask(0o077);
requireCondition(fs.realpathSync(workspace)===workspace,'Unexpected WN-15 workspace');
fs.mkdirSync(output);
const {run}=await api('/admin/whatsapp-simulation/runs','POST',{
  seed,conversations:500,messages:0,optOuts:0,rate:5,
  configuration:{phoneStartOffset:100000,teamCount:2,agentCount:2,teams:teams.map(({name,...team})=>team)},
});
requireCondition(/^[a-f0-9-]{36}$/.test(run?.id||''),'Run UUID missing');
console.log(JSON.stringify({runId:run.id}));
const receipt=output+'/WN15_RUN_A_LOAD_RECEIPT.json';
const child=spawn(process.execPath,[toolsDir+'/whatsapp-simulation-load.mjs','--app-root',root,'--run',run.id,'--url',testUrl,'--phone-start-offset','100000',
  '--team-count','2','--agent-count','2','--workers','5','--receipt',receipt],
  {env:{...simEnv,NYSA_SIMULATION_SESSION_TOKEN:process.env.NYSA_SIMULATION_SESSION_TOKEN},stdio:'inherit'});
console.log(JSON.stringify({loadPid:child.pid}));
const finished=new Promise(resolve=>{
  child.once('error',()=>resolve({error:true}));
  child.once('exit',(code,signal)=>resolve({code,signal}));
});
try{
  const deadline=Date.now()+5*60000;
  let nextSample=Date.now()+5000;
  while(true){
    const result=await Promise.race([finished,delay(Math.max(0,nextSample-Date.now()))]);
    if(result){
      requireCondition(result.code===0,'Load process failed');
      break;
    }
    requireCondition(Date.now()<deadline,'Run A exceeded five minutes');
    nextSample=Date.now()+5000;
    assess(await sample());
  }
}catch(error){
  if(child.exitCode===null&&child.signalCode===null&&child.pid)child.kill('SIGTERM');
  await finished;
  throw error;
}
assess(await sample());
const result=JSON.parse(fs.readFileSync(receipt));
requireCondition(result.runId===run.id&&result.requested===500&&result.completed===500&&result.failed===0,'Load receipt mismatch');
