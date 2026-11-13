import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const optionalCount=(value,label)=>{
  if(value===undefined||value===null||value==='')return null;
  const count=Number(value);
  if(!Number.isSafeInteger(count))throw new Error(`${label} must be a whole number`);
  return count;
};

export function validateLoadTargets(rawTeams,{expectedTeamCount,expectedAgentCount}={}){
  if(!Array.isArray(rawTeams))throw new Error('The load configuration teams must be an array');
  if(rawTeams.length<1||rawTeams.length>3)throw new Error('The load configuration must contain between one and three synthetic target teams');
  const seenTeams=new Set(),seenAgents=new Set(),teams=rawTeams.map((team,index)=>{
    const teamId=String(team?.teamId||'').trim(),agentIds=Array.isArray(team?.agentIds)?team.agentIds.map(value=>String(value||'').trim()):[];
    if(!UUID.test(teamId))throw new Error(`Synthetic target team ${index+1} must have a valid teamId`);
    if(seenTeams.has(teamId))throw new Error(`Synthetic target team ${teamId} is duplicated`);
    seenTeams.add(teamId);
    for(const agentId of agentIds){
      if(!UUID.test(agentId))throw new Error(`Synthetic target team ${teamId} contains an invalid Agent id`);
      if(seenAgents.has(agentId))throw new Error(`Synthetic target Agent ${agentId} is duplicated across teams`);
      seenAgents.add(agentId);
    }
    return{teamId,agentIds};
  });
  const teamCount=teams.length,agentCount=seenAgents.size;
  if(agentCount<2||agentCount>10)throw new Error('The load configuration must contain between two and ten synthetic target Agents');
  const requiredTeams=optionalCount(expectedTeamCount,'teamCount'),requiredAgents=optionalCount(expectedAgentCount,'agentCount');
  if(requiredTeams!==null&&requiredTeams!==teamCount)throw new Error(`Configured team count mismatch: expected ${requiredTeams}, observed ${teamCount}`);
  if(requiredAgents!==null&&requiredAgents!==agentCount)throw new Error(`Configured Agent count mismatch: expected ${requiredAgents}, observed ${agentCount}`);
  return{teams,teamCount,agentCount,agents:teams.flatMap(team=>team.agentIds.map(agentId=>({teamId:team.teamId,agentId}))),teamTargets:teams.map(team=>({teamId:team.teamId,agentCount:team.agentIds.length}))};
}

export function validatePhoneStartOffset(value,{conversationCount,syntheticDigits}){
  const offset=Number(value),count=Number(conversationCount),digits=Number(syntheticDigits),capacity=10**digits;
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('phoneStartOffset must be a non-negative whole number');
  if(!Number.isSafeInteger(count)||count<1)throw new Error('requestedConversations must be a positive whole number');
  if(!Number.isSafeInteger(digits)||digits<4||digits>9)throw new Error('Synthetic phone suffix digits are invalid');
  if(offset+count>capacity)throw new Error(`phoneStartOffset ${offset} plus ${count} conversations exceeds the ${capacity}-number synthetic range`);
  return{offset,endOffset:offset+count-1,capacity};
}

export function buildSimulationJobs(run,phoneStartOffset,config,{deterministicRandom,syntheticPhoneAt}){
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
  const loadAbort=new AbortController();
  if(!runId||!baseUrl||token.length<32)throw new Error('Use --run, --url (or NYSA_SIMULATION_BASE_URL) and the private NYSA_SIMULATION_SESSION_TOKEN environment variable');
  if(!args['app-root'])throw new Error('--app-root is required');
  const appRoot=await fs.realpath(path.resolve(String(args['app-root']))),providerModule=path.join(appRoot,'src','whatsapp-simulated-provider.js');
  if(!(await fs.stat(providerModule).catch(()=>null))?.isFile())throw new Error(`Deployed simulator module is missing at ${providerModule}`);
  const provider=await import(pathToFileURL(providerModule).href),config=provider.assertSimulatedProviderEnvironment(env);
  if(!config.enabled||config.environment!=='crm-test')throw new Error('The WN-15 load tool requires the enabled CRM Test simulator');
  if(!args.receipt||args.receipt===true)throw new Error('--receipt is required and must point to a new output file');
  const request=async(requestPath,{method='GET',body,loadRequest=false}={})=>{
    const timeout=AbortSignal.timeout(15000),signal=loadRequest?AbortSignal.any([timeout,loadAbort.signal]):timeout;
    const response=await fetch(`${baseUrl}/api${requestPath}`,{method,redirect:'error',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`${method} ${requestPath} returned ${response.status}`);
    return data;
  };
  const {run}=await request(`/admin/whatsapp-simulation/runs/${runId}`),configuration=run.configuration||{};
  const targets=validateLoadTargets(configuration.teams,{
    expectedTeamCount:args['team-count']??configuration.teamCount,
    expectedAgentCount:args['agent-count']??configuration.agentCount
  }),agents=targets.agents;
  const offsetInput=args['phone-start-offset']??configuration.phoneStartOffset;
  if(offsetInput===undefined||offsetInput===true)throw new Error('Use --phone-start-offset (or the run configuration phoneStartOffset); an implicit zero offset is not permitted');
  const plan=buildSimulationJobs(run,offsetInput,config,provider),rate=Number(run.requestedRate),workers=Math.min(20,Number(args.workers||20)),interval=Math.max(1,Math.ceil(1000/rate));
  let cursor=0,attempted=0,completed=0,failed=0,firstFailure=null;
  const executeJob=async job=>{
    attempted++;
    const phone=syntheticPhoneAt(job.phoneIndex,config),owner=agents[job.index%agents.length];
    const payload={from:phone,name:`Synthetic Prospect ${String(job.index+1).padStart(5,'0')}`,teamId:owner.teamId,agentId:owner.agentId,
      sourceType:'other',ctwa:Boolean(job.ctwa),occurredAt:job.kind==='conversation'?new Date(Date.now()-(job.hoursBack*60*60*1000)).toISOString():undefined,
      simulationRunId:run.id,eventId:`${run.id}:${job.kind}:${job.index}`,text:job.kind==='optout'?'STOP':job.kind==='thread'?`Synthetic load message ${job.index+1}`:'Synthetic WhatsApp enquiry'};
    const received=await request('/admin/whatsapp-simulation/inbound',{method:'POST',body:payload,loadRequest:true});
    if(job.kind==='conversation'&&!job.unread&&received.conversationId)await request(`/admin/whatsapp-simulation/conversations/${received.conversationId}/read`,{method:'POST',body:{},loadRequest:true});
  };
  let nextStart=performance.now();
  const worker=async()=>{while(!firstFailure){
    const index=cursor++;
    if(index>=plan.jobs.length)return;
    const scheduled=Math.max(nextStart,performance.now());
    nextStart=scheduled+interval;
    await new Promise(resolve=>setTimeout(resolve,Math.ceil(scheduled-performance.now())));
    if(firstFailure)return;
    try{await executeJob(plan.jobs[index]);completed++;}catch(error){
    if(!firstFailure){failed=1;firstFailure={jobIndex:index,message:String(error?.message||'Load request failed').slice(0,500)};loadAbort.abort();process.stderr.write(`${firstFailure.message}\n`);}
    return;
  }}};
  await Promise.all(Array.from({length:workers},worker));
  const result={runId:run.id,seed:run.seed,requested:plan.jobs.length,attempted,completed,failed,aborted:Boolean(firstFailure),firstFailure,appRoot,conversations:Number(run.requestedConversations),threadMessages:Number(run.requestedMessages),optOuts:Number(run.requestedOptOuts),rate,workers,
    teamCount:targets.teamCount,agentCount:targets.agentCount,teamTargets:targets.teamTargets,
    phoneStartOffset:plan.phoneStartOffset,phoneEndOffset:plan.phoneEndOffset,firstPhone:plan.firstPhone,lastPhone:plan.lastPhone};
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
