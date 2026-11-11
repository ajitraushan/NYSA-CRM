import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deterministicRandom,simulatedProviderConfig,syntheticPhoneAt} from '../src/whatsapp-simulated-provider.js';

export function validatePhoneStartOffset(value,{conversationCount,syntheticDigits}){
  const offset=Number(value),count=Number(conversationCount),digits=Number(syntheticDigits),capacity=10**digits;
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('phoneStartOffset must be a non-negative whole number');
  if(!Number.isSafeInteger(count)||count<1)throw new Error('requestedConversations must be a positive whole number');
  if(!Number.isSafeInteger(digits)||digits<4||digits>9)throw new Error('Synthetic phone suffix digits are invalid');
  if(offset+count>capacity)throw new Error(`phoneStartOffset ${offset} plus ${count} conversations exceeds the ${capacity}-number synthetic range`);
  return{offset,endOffset:offset+count-1,capacity};
}

export function buildSimulationJobs(run,phoneStartOffset,config=simulatedProviderConfig()){
  const requestedConversations=Number(run.requestedConversations),validated=validatePhoneStartOffset(phoneStartOffset,{conversationCount:requestedConversations,syntheticDigits:config.syntheticDigits});
  const random=deterministicRandom(run.seed),jobs=[];
  for(let index=0;index<requestedConversations;index++)jobs.push({kind:'conversation',index,phoneIndex:validated.offset+index,ctwa:random()<0.30,unread:random()<0.20,hoursBack:Math.floor(random()*97)});
  for(let index=0;index<Number(run.requestedMessages);index++)jobs.push({kind:'thread',index,phoneIndex:validated.offset});
  for(let index=0;index<Math.min(Number(run.requestedOptOuts),requestedConversations);index++)jobs.push({kind:'optout',index,phoneIndex:validated.offset+index});
  return{jobs,phoneStartOffset:validated.offset,phoneEndOffset:validated.endOffset,firstPhone:syntheticPhoneAt(validated.offset,config),lastPhone:syntheticPhoneAt(validated.endOffset,config)};
}

const parseArgs=argv=>Object.fromEntries(argv.reduce((items,item,index,list)=>{
  if(item.startsWith('--'))items.push([item.slice(2),list[index+1]&&!list[index+1].startsWith('--')?list[index+1]:true]);
  return items;
},[]));

export async function main(argv=process.argv.slice(2),env=process.env){
  const args=parseArgs(argv),runId=String(args.run||'').trim(),baseUrl=String(args.url||env.NYSA_SIMULATION_BASE_URL||'').replace(/\/$/,''),token=String(env.NYSA_SIMULATION_SESSION_TOKEN||'');
  if(!runId||!baseUrl||token.length<32)throw new Error('Use --run, --url (or NYSA_SIMULATION_BASE_URL) and the private NYSA_SIMULATION_SESSION_TOKEN environment variable');
  if(!args.receipt||args.receipt===true)throw new Error('--receipt is required and must point to a new output file');
  const request=async(requestPath,{method='GET',body}={})=>{
    const response=await fetch(`${baseUrl}/api${requestPath}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`${method} ${requestPath} returned ${response.status}: ${data.error||'Unknown error'}`);
    return data;
  };
  const {run}=await request(`/admin/whatsapp-simulation/runs/${runId}`),configuration=run.configuration||{},teams=Array.isArray(configuration.teams)?configuration.teams:[];
  if(teams.length!==3)throw new Error('The load configuration must contain exactly three synthetic target teams');
  const agents=teams.flatMap(team=>(team.agentIds||[]).map(agentId=>({teamId:team.teamId,agentId})));
  if(agents.length!==10)throw new Error('The load configuration must contain exactly ten synthetic target Agents');
  const offsetInput=args['phone-start-offset']??configuration.phoneStartOffset;
  if(offsetInput===undefined||offsetInput===true)throw new Error('Use --phone-start-offset (or the run configuration phoneStartOffset); an implicit zero offset is not permitted');
  const config=simulatedProviderConfig(env),plan=buildSimulationJobs(run,offsetInput,config),rate=Number(run.requestedRate),workers=Math.min(20,Number(args.workers||20)),interval=Math.max(1,Math.ceil(1000/rate));
  let cursor=0,completed=0,failed=0;
  const executeJob=async job=>{
    const phone=syntheticPhoneAt(job.phoneIndex,config),owner=agents[job.index%agents.length];
    const payload={from:phone,name:`Synthetic Prospect ${String(job.index+1).padStart(5,'0')}`,teamId:owner.teamId,agentId:owner.agentId,
      sourceType:'other',ctwa:Boolean(job.ctwa),occurredAt:job.kind==='conversation'?new Date(Date.now()-(job.hoursBack*60*60*1000)).toISOString():undefined,
      simulationRunId:run.id,eventId:`${run.id}:${job.kind}:${job.index}`,text:job.kind==='optout'?'STOP':job.kind==='thread'?`Synthetic load message ${job.index+1}`:'Synthetic WhatsApp enquiry'};
    const received=await request('/admin/whatsapp-simulation/inbound',{method:'POST',body:payload});
    if(job.kind==='conversation'&&!job.unread&&received.conversationId)await request(`/admin/whatsapp-simulation/conversations/${received.conversationId}/read`,{method:'POST',body:{}});
  };
  const worker=async()=>{while(true){const index=cursor++;if(index>=plan.jobs.length)return;try{await executeJob(plan.jobs[index]);completed++;}catch(error){failed++;process.stderr.write(`${error.message}\n`);}await new Promise(resolve=>setTimeout(resolve,interval*workers));}};
  await Promise.all(Array.from({length:workers},worker));
  const result={runId:run.id,seed:run.seed,requested:plan.jobs.length,completed,failed,conversations:Number(run.requestedConversations),threadMessages:Number(run.requestedMessages),optOuts:Number(run.requestedOptOuts),rate,workers,phoneStartOffset:plan.phoneStartOffset,phoneEndOffset:plan.phoneEndOffset,firstPhone:plan.firstPhone,lastPhone:plan.lastPhone};
  await request(`/admin/whatsapp-simulation/runs/${run.id}/complete`,{method:'POST',body:{failed:failed>0,result}});
  const receipt={schema:'nysa.wn15.load.v1',generatedAt:new Date().toISOString(),...result},receiptPath=path.resolve(String(args.receipt));
  await fs.mkdir(path.dirname(receiptPath),{recursive:true});
  await fs.writeFile(receiptPath,`${JSON.stringify(receipt,null,2)}\n`,{flag:'wx'});
  const receiptSha256=crypto.createHash('sha256').update(await fs.readFile(receiptPath)).digest('hex');
  process.stdout.write(`${JSON.stringify({...receipt,receiptPath,receiptSha256},null,2)}\n`);
  if(failed)process.exitCode=1;
  return result;
}

const invokedPath=process.argv[1]?path.resolve(process.argv[1]):null;
if(invokedPath&&invokedPath===path.resolve(fileURLToPath(import.meta.url)))await main();
