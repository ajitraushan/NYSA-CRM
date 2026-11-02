import {deterministicRandom,syntheticPhoneAt} from '../src/whatsapp-simulated-provider.js';

const args=Object.fromEntries(process.argv.slice(2).reduce((items,item,index,list)=>{
  if(item.startsWith('--'))items.push([item.slice(2),list[index+1]&&!list[index+1].startsWith('--')?list[index+1]:true]);
  return items;
},[]));
const runId=String(args.run||'').trim(),baseUrl=String(args.url||process.env.NYSA_SIMULATION_BASE_URL||'').replace(/\/$/,''),token=String(process.env.NYSA_SIMULATION_SESSION_TOKEN||'');
if(!runId||!baseUrl||token.length<32)throw new Error('Use --run, --url (or NYSA_SIMULATION_BASE_URL) and the private NYSA_SIMULATION_SESSION_TOKEN environment variable');

const request=async(path,{method='GET',body}={})=>{
  const response=await fetch(`${baseUrl}/api${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${method} ${path} returned ${response.status}: ${data.error||'Unknown error'}`);
  return data;
};
const {run}=await request(`/admin/whatsapp-simulation/runs/${runId}`),configuration=run.configuration||{},teams=Array.isArray(configuration.teams)?configuration.teams:[];
if(teams.length!==3)throw new Error('The load configuration must contain exactly three synthetic target teams');
const agents=teams.flatMap(team=>(team.agentIds||[]).map(agentId=>({teamId:team.teamId,agentId})));
if(agents.length!==10)throw new Error('The load configuration must contain exactly ten synthetic target Agents');
const random=deterministicRandom(run.seed),rate=Number(run.requestedRate),workers=Math.min(20,Number(args.workers||20)),interval=Math.max(1,Math.ceil(1000/rate));
const jobs=[];
for(let index=0;index<Number(run.requestedConversations);index++)jobs.push({kind:'conversation',index,ctwa:random()<0.30,unread:random()<0.20,hoursBack:Math.floor(random()*97)});
for(let index=0;index<Number(run.requestedMessages);index++)jobs.push({kind:'thread',index});
for(let index=0;index<Math.min(Number(run.requestedOptOuts),Number(run.requestedConversations));index++)jobs.push({kind:'optout',index});
let cursor=0,completed=0,failed=0;
const executeJob=async job=>{
  const phone=syntheticPhoneAt(job.kind==='thread'?0:job.index),owner=agents[job.index%agents.length];
  const payload={from:phone,name:`Synthetic Prospect ${String(job.index+1).padStart(5,'0')}`,teamId:owner.teamId,agentId:owner.agentId,
    sourceType:'other',ctwa:Boolean(job.ctwa),occurredAt:job.kind==='conversation'?new Date(Date.now()-(job.hoursBack*60*60*1000)).toISOString():undefined,
    simulationRunId:run.id,eventId:`${run.id}:${job.kind}:${job.index}`,text:job.kind==='optout'?'STOP':job.kind==='thread'?`Synthetic load message ${job.index+1}`:'Synthetic WhatsApp enquiry'};
  const received=await request('/admin/whatsapp-simulation/inbound',{method:'POST',body:payload});
  if(job.kind==='conversation'&&!job.unread&&received.conversationId)await request(`/admin/whatsapp-simulation/conversations/${received.conversationId}/read`,{method:'POST',body:{}});
};
const worker=async()=>{while(true){const index=cursor++;if(index>=jobs.length)return;try{await executeJob(jobs[index]);completed++;}catch(error){failed++;process.stderr.write(`${error.message}\n`);}await new Promise(resolve=>setTimeout(resolve,interval*workers));}};
await Promise.all(Array.from({length:workers},worker));
const result={seed:run.seed,requested:jobs.length,completed,failed,conversations:Number(run.requestedConversations),threadMessages:Number(run.requestedMessages),optOuts:Number(run.requestedOptOuts),rate,workers};
await request(`/admin/whatsapp-simulation/runs/${run.id}/complete`,{method:'POST',body:{failed:failed>0,result}});
process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
if(failed)process.exitCode=1;
