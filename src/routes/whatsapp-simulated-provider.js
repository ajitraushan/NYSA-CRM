import crypto from 'node:crypto';
import {Router} from '../lib/http-kit.js';
import {requireAuth} from '../auth.js';
import {audit,execute,many,one,transaction,uuid} from '../db.js';
import {
  assertSimulatedProviderEnvironment,assertSyntheticWhatsAppPhone,buildSimulatedInbound,buildSimulatedOutbound,
  normalizeBackdateHours,normalizeSimulationFault,normalizeSimulationRate,simulatedPayloadHash,simulatedProviderConfig,simulationStatusSequence
} from '../whatsapp-simulated-provider.js';
import {
  applySimulatedMessageStatus,applySimulatedTemplateStatus,cleanupAllSimulatedRecords,cleanupSimulationRun,ensureSimulatedCampaignConversation,ingestSimulatedInbound,recordSimulatedOutbound
} from '../whatsapp-simulated-provider-store.js';
import {assertReplySendAllowed,refreshReplyLockAfterSend,replyLockState,selectConversationWithReplyLock,whatsAppReplyLockConfig} from '../whatsapp-reply-lock.js';
import {getContactSuppression} from '../contact-suppression.js';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const milliseconds=value=>value instanceof Date?value.getTime():Date.parse(value||'');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const operational=new Set(['sales_agent','manager','director']);
const reportCallbackFailure=()=>console.error(JSON.stringify({component:'whatsapp-simulator',event:'callback-delivery-failed'}));

function providerFailure(message,statusCode,details={}){
  return Object.assign(new Error(message),{statusCode,responseBody:{error:message,...details}});
}

function sendProviderFailure(res,error){
  const status=Number(error?.statusCode)||500;
  res.status(status).json(error?.responseBody||{error:status===500?'Simulated provider request failed':error.message});
}

function equalSecret(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);
}

function currentConfig(){return assertSimulatedProviderEnvironment(process.env);}
function requireSimulation(req,res){
  let config;
  try{config=currentConfig();}catch(error){res.status(409).json({error:error.message});return null;}
  if(!config.enabled){res.status(404).json({error:'WhatsApp simulator is disabled'});return null;}
  return config;
}
function requireInternalToken(req,res,config,{pathToken=null}={}){
  const presented=pathToken||req.headers['x-nysa-simulation-token'];
  if(!equalSecret(presented,config.callbackToken)){res.status(401).json({error:'Invalid simulator callback credential'});return false;}
  return true;
}
async function control(client){return one('SELECT * FROM wa_simulated_provider_control WHERE singleton=TRUE',[],client);}
async function acceptSimulatedEvent(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw providerFailure('Simulator event body must be an object',400);
  let result;
  if(payload.type==='inbound_message')result=await ingestSimulatedInbound(payload);
  else if(payload.type==='message_status')result=await applySimulatedMessageStatus(payload);
  else if(payload.type==='template_status')result=await applySimulatedTemplateStatus(payload);
  else throw providerFailure('Unsupported simulator event type',400);
  return {statusCode:result.duplicate?200:202,body:{accepted:true,simulation:true,...result}};
}

async function postCallback(payload,delayMs=25){
  await wait(delayMs);
  return acceptSimulatedEvent(payload);
}

async function submitSimulatedMessage(config,body,{client,deferCallbacks=false}={}){
  const state=await control(client);
  if(state?.paused)throw providerFailure('Simulator sending is paused',423,{code:'SIMULATOR_PAUSED'});
  const fault=state?.faultMode||'none';
  if(fault==='timeout'){await wait(150);throw providerFailure('Simulated provider timeout',504);}
  if(fault==='rate_limited')throw providerFailure('Simulated provider rate limit',429,{retryAfter:30});
  if(fault==='server_error')throw providerFailure('Simulated provider server error',503);
  if(fault==='invalid_number')throw providerFailure('Simulated provider rejected the recipient number',400,{code:'SIMULATED_INVALID_NUMBER'});
  if(fault==='invalid_payload')return {unexpected:true};
  let phone;
  try{phone=assertSyntheticWhatsAppPhone(body?.to,config);}catch(error){throw providerFailure(error.message,error.statusCode||409,{code:error.code});}
  if(!body?.conversation_id||!body?.actor_id)throw providerFailure('conversation_id and actor_id are required',400);
  const idempotencyKey=clean(body?.idempotency_key||body?.correlation_id,240);
  if(!idempotencyKey)throw providerFailure('A simulator idempotency key is required',400);
  const providerMessageId=`wamid.sim.${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0,24)}`;
  const result={messages:[{id:providerMessageId}],simulation:true,to:phone};
  const sequence=simulationStatusSequence({failure:Boolean(body?.simulate_failure)});
  const statusCallbacks=sequence.map((status,index)=>({payload:{
    id:`status:${providerMessageId}:${status}`,type:'message_status',message_id:providerMessageId,status,actor_id:body.actor_id,
    simulation_run_id:body.simulation_run_id||null,occurred_at:new Date(Date.now()+(index+1)*1000).toISOString()
  },delayMs:500+(index*250)}));
  if(!deferCallbacks)statusCallbacks.forEach(item=>void postCallback(item.payload,item.delayMs).catch(reportCallbackFailure));
  return deferCallbacks?{response:result,statusCallbacks}:result;
}

async function submitSimulatedTemplate(body){
  const state=await control();
  if(state?.paused)throw providerFailure('Simulator sending is paused',423,{code:'SIMULATOR_PAUSED'});
  if(state?.faultMode==='template_paused')throw providerFailure('Simulated template is paused',409,{code:'SIMULATED_TEMPLATE_PAUSED'});
  const requested=clean(body?.outcome,20)||'approved';
  if(!['approved','rejected','pending'].includes(requested))throw providerFailure('Template outcome must be approved, rejected or pending',400);
  if(!body?.template_version_id||!body?.actor_id)throw providerFailure('template_version_id and actor_id are required',400);
  const submissionId=`watsim.${crypto.randomBytes(10).toString('hex')}`;
  void postCallback({id:`template:${submissionId}:pending`,type:'template_status',template_version_id:body.template_version_id,status:'pending',actor_id:body.actor_id,occurred_at:new Date().toISOString()},500).catch(reportCallbackFailure);
  if(requested!=='pending')void postCallback({id:`template:${submissionId}:${requested}`,type:'template_status',template_version_id:body.template_version_id,status:requested,reason:requested==='rejected'?clean(body?.reason,500)||'Rejected by configured simulator rule':null,actor_id:body.actor_id,occurred_at:new Date(Date.now()+1000).toISOString()},750).catch(reportCallbackFailure);
  return {id:submissionId,status:'pending',simulation:true};
}

export function createWhatsAppSimulatedProviderRoutes(){
  const r=Router();
  r.get('/providers/whatsapp-simulated/health',(req,res)=>{
    const config=requireSimulation(req,res);if(!config||!requireInternalToken(req,res,config))return;
    res.json({ok:true,provider:'simulated',environment:config.environment,externalNetwork:false});
  });
  r.post('/providers/whatsapp-simulated/messages',async(req,res)=>{
    const config=requireSimulation(req,res);if(!config||!requireInternalToken(req,res,config))return;
    try{res.status(202).json(await submitSimulatedMessage(config,req.body));}catch(error){sendProviderFailure(res,error);}
  });
  r.post('/providers/whatsapp-simulated/templates',async(req,res)=>{
    const config=requireSimulation(req,res);if(!config||!requireInternalToken(req,res,config))return;
    try{res.status(202).json(await submitSimulatedTemplate(req.body));}catch(error){sendProviderFailure(res,error);}
  });
  r.post('/providers/whatsapp-simulated/events/:token',async(req,res)=>{
    const config=requireSimulation(req,res);if(!config||!requireInternalToken(req,res,config,{pathToken:req.params.token}))return;
    try{const result=await acceptSimulatedEvent(req.body);res.status(result.statusCode).json(result.body);}catch(error){sendProviderFailure(res,error);}
  });
  return r;
}

async function scopedConversation(id,broker,{client,forUpdate=false}={}){
  const conversation=await selectConversationWithReplyLock(client,id,{forUpdate});
  if(!conversation?.simulated)return undefined;
  if(broker.jobRole==='sales_agent'&&String(conversation.ownerAgentId)!==String(broker.id))return undefined;
  if(broker.jobRole==='manager'){
    const teams=[...(broker.managedTeamIds||[]),broker.teamId].filter(Boolean).map(String);
    if(!teams.includes(String(conversation.ownerTeamId)))return undefined;
  }
  return conversation;
}

async function submitInProcess(config,path,body,options){
  if(path==='messages')return submitSimulatedMessage(config,body,options);
  if(path==='templates')return submitSimulatedTemplate(body);
  const eventPrefix='events/';
  if(path.startsWith(eventPrefix)){
    const token=decodeURIComponent(path.slice(eventPrefix.length));
    if(!equalSecret(token,config.callbackToken))throw providerFailure('Invalid simulator callback credential',401);
    return (await acceptSimulatedEvent(body)).body;
  }
  throw providerFailure('Unsupported in-process simulator operation',404);
}

export function createWhatsAppSimulationControlRoutes(){
  const r=Router();
  r.use(requireAuth);

  r.get('/admin/whatsapp-simulation',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const config=simulatedProviderConfig(),state=await control(),counts=await one(`SELECT
      COUNT(*) FILTER(WHERE simulated=TRUE)::int AS conversations,
      (SELECT COUNT(*)::int FROM wa_conversation_messages WHERE simulated=TRUE) AS messages,
      (SELECT COUNT(*)::int FROM wa_simulated_provider_events) AS events,
      (SELECT COUNT(*)::int FROM wa_simulation_runs WHERE status<>'cleaned') AS active_runs
      FROM wa_conversations`);
    res.setHeader('Cache-Control','no-store');
    res.json({provider:'simulated',environment:config.environment,enabled:config.enabled,externalNetwork:false,syntheticRange:`${config.syntheticPrefix}${'0'.repeat(config.syntheticDigits)}–${config.syntheticPrefix}${'9'.repeat(config.syntheticDigits)}`,replyLockTimeoutMinutes:whatsAppReplyLockConfig().timeoutMinutes,state,counts,badge:'SIMULATED'});
  });
  r.post('/admin/whatsapp-simulation/control',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const config=requireSimulation(req,res);if(!config)return;
    let fault;try{fault=normalizeSimulationFault(req.body?.faultMode);}catch(error){return res.status(400).json({error:error.message});}
    const paused=req.body?.paused!==false;
    const state=await one(`UPDATE wa_simulated_provider_control SET paused=$1,fault_mode=$2,updated_by=$3,updated_at=NOW() WHERE singleton=TRUE RETURNING *`,[paused,fault,req.broker.id]);
    await audit('WhatsAppConversation',uuid(),'simulated_provider_control_changed',req.broker.id,{simulation:true,paused,faultMode:fault});
    res.json({state,simulation:true});
  });
  r.post('/admin/whatsapp-simulation/inbound',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const config=requireSimulation(req,res);if(!config)return;
    let payload;
    try{payload=buildSimulatedInbound({...req.body,actorId:req.broker.id},config);}catch(error){return res.status(error.statusCode||400).json({error:error.message,code:error.code});}
    const data=await submitInProcess(config,`events/${encodeURIComponent(config.callbackToken)}`,payload);
    res.status(202).json(data);
  });
  r.post('/admin/whatsapp-simulation/runs',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const config=requireSimulation(req,res);if(!config)return;
    const count=Number(req.body?.conversations||1),messages=Number(req.body?.messages||0),optOuts=Number(req.body?.optOuts||0);
    if(!Number.isInteger(count)||count<1||count>10000)return res.status(400).json({error:'Conversation count must be between 1 and 10,000'});
    if(!Number.isInteger(messages)||messages<0||messages>200000)return res.status(400).json({error:'Message count must be between 0 and 200,000'});
    if(!Number.isInteger(optOuts)||optOuts<0||optOuts>10000)return res.status(400).json({error:'Opt-out count must be between 0 and 10,000'});
    let rate;try{rate=normalizeSimulationRate(req.body?.rate);}catch(error){return res.status(400).json({error:error.message});}
    const seed=clean(req.body?.seed,120);if(!seed)return res.status(400).json({error:'Repeatable simulation seed is required'});
    const run=await one(`INSERT INTO wa_simulation_runs(id,seed,requested_conversations,requested_messages,requested_opt_outs,requested_rate,configuration,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[uuid(),seed,count,messages,optOuts,rate,req.body?.configuration||{},req.broker.id]);
    res.status(201).json({run,generatorCommand:`node tools/whatsapp-simulation-load.mjs --run ${run.id}`,simulation:true});
  });
  r.get('/admin/whatsapp-simulation/runs/:id',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const run=await one('SELECT * FROM wa_simulation_runs WHERE id=$1',[req.params.id]);
    if(!run)return res.status(404).json({error:'Simulation run not found'});
    res.json({run,simulation:true});
  });
  r.post('/admin/whatsapp-simulation/runs/:id/complete',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const run=await one(`UPDATE wa_simulation_runs SET status=$1,completed_at=NOW(),result=$2 WHERE id=$3 AND status='running' RETURNING *`,[
      req.body?.failed?'failed':'completed',req.body?.result||{},req.params.id
    ]);
    if(!run)return res.status(409).json({error:'Simulation run is not running'});
    res.json({run,simulation:true});
  });
  r.post('/admin/whatsapp-simulation/runs/:id/cleanup',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    if(!requireSimulation(req,res))return;
    res.json({cleanup:await cleanupSimulationRun(req.params.id,req.broker.id),simulation:true});
  });
  r.post('/admin/whatsapp-simulation/cleanup',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    if(!requireSimulation(req,res))return;
    res.json({cleanup:await cleanupAllSimulatedRecords(req.broker.id),simulation:true});
  });
  r.post('/admin/whatsapp-simulation/conversations/:id/backdate',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    if(!requireSimulation(req,res))return;
    let hours;try{hours=normalizeBackdateHours(req.body?.hours);}catch(error){return res.status(400).json({error:error.message});}
    const conversation=await one(`UPDATE wa_conversations SET last_customer_message_at=NOW()-($1*INTERVAL '1 hour'),
      ctwa_entry_at=CASE WHEN source_type IN ('ctwa','website_ctwa') THEN NOW()-($1*INTERVAL '1 hour') ELSE ctwa_entry_at END,updated_at=NOW()
      WHERE id=$2 AND simulated=TRUE RETURNING *`,[hours,req.params.id]);
    if(!conversation)return res.status(404).json({error:'Simulated conversation not found'});
    res.json({conversation,hours,simulation:true});
  });
  r.post('/admin/whatsapp-simulation/conversations/:id/read',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    if(!requireSimulation(req,res))return;
    const conversation=await one('SELECT id FROM wa_conversations WHERE id=$1 AND simulated=TRUE',[req.params.id]);
    if(!conversation)return res.status(404).json({error:'Simulated conversation not found'});
    const changed=await execute('UPDATE wa_inbox_notifications SET read_at=COALESCE(read_at,NOW()) WHERE conversation_id=$1',[conversation.id]);
    res.json({conversationId:conversation.id,notificationsMarkedRead:changed.rowCount,simulation:true});
  });
  r.get('/admin/whatsapp-simulation/events',async(req,res)=>{
    if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
    const rows=await many(`SELECT id,provider_event_id,simulation_run_id,event_type,direction,payload_hash,outcome,diagnostic_code,
      related_entity_type,related_entity_id,occurred_at FROM wa_simulated_provider_events ORDER BY occurred_at DESC LIMIT 500`);
    res.json({events:rows.map(row=>({...row,badge:'SIMULATED'})),simulation:true,badge:'SIMULATED'});
  });

  r.post('/crm/whatsapp-workspace/template-versions/:id/simulated-submit',async(req,res)=>{
    if(req.broker.role!=='internal_broker'||!operational.has(req.broker.jobRole))return res.status(403).json({error:'Operational WhatsApp workspace access required'});
    const config=requireSimulation(req,res);if(!config)return;
    const version=await one(`SELECT v.*,t.owner_team_id FROM wa_message_template_versions v JOIN wa_message_templates t ON t.id=v.template_id WHERE v.id=$1`,[req.params.id]);
    if(!version)return res.status(404).json({error:'Template version not found'});
    if(version.internalStatus!=='approved')return res.status(409).json({error:'Internal approval is required before simulated provider submission'});
    if(req.broker.jobRole==='sales_agent'&&String(req.broker.teamId)!==String(version.ownerTeamId))return res.status(403).json({error:'Template is outside your team'});
    const result=await submitInProcess(config,'templates',{template_version_id:version.id,actor_id:req.broker.id,outcome:req.body?.outcome||'approved',payload_hash:version.contentHash});
    await execute(`UPDATE wa_message_template_versions SET simulated_provider_status='pending',simulated_provider_status_at=NOW(),updated_at=NOW() WHERE id=$1`,[version.id]);
    res.status(202).json({submission:result,simulation:true});
  });
  r.post('/crm/whatsapp-workspace/conversations/:id/simulated-send',async(req,res)=>{
    if(req.broker.role!=='internal_broker'||!operational.has(req.broker.jobRole))return res.status(403).json({error:'Operational WhatsApp workspace access required'});
    const config=requireSimulation(req,res);if(!config)return;
    const result=await transaction(async client=>{
      const conversation=await scopedConversation(req.params.id,req.broker,{client,forUpdate:true});
      if(!conversation)return{code:404,error:'Simulated conversation not found or outside your scope'};
      const suppression=await getContactSuppression(conversation.normalizedPhone,client);
      if(suppression.blocked){
        const optOutAt=milliseconds(suppression.restrictions.opt_out?.recordedAt),lastInbound=milliseconds(conversation.lastCustomerMessageAt),serviceReply=suppression.strongest==='opt_out'&&Number.isFinite(optOutAt)&&lastInbound>optOutAt&&Date.now()-lastInbound<=24*60*60*1000;
        if(!serviceReply)return{code:409,error:`Outbound WhatsApp is blocked by ${suppression.strongest}`,response:{error:`Outbound WhatsApp is blocked by ${suppression.strongest}`,code:'CONTACT_SUPPRESSED'}};
      }
      let lockBefore;
      try{lockBefore=assertReplySendAllowed(conversation,req.broker);}
      catch(error){if(error.code==='WHATSAPP_REPLY_LOCK_HELD')return{code:409,error:error.message,response:error.responseBody};throw error;}
      const now=Date.now(),replyOpen=Boolean(conversation.lastCustomerMessageAt&&now-milliseconds(conversation.lastCustomerMessageAt)<=24*60*60*1000);
      const templateVersionId=clean(req.body?.templateVersionId,36)||null,text=clean(req.body?.text,4096);
      if(!replyOpen&&!templateVersionId)return{code:409,error:'The 24-hour reply window is closed; select a simulated-approved template'};
      if(replyOpen&&!text&&!templateVersionId)return{code:400,error:'Enter reply text or select a template'};
      if(templateVersionId){const template=await one(`SELECT v.id,v.body_text,v.simulated_provider_status,t.owner_team_id FROM wa_message_template_versions v JOIN wa_message_templates t ON t.id=v.template_id WHERE v.id=$1`,[templateVersionId],client);if(!template||template.simulatedProviderStatus!=='approved'||String(template.ownerTeamId)!==String(conversation.ownerTeamId))return{code:409,error:'Select a simulated-approved template from this team'};}
      let payload;
      try{
        payload=buildSimulatedOutbound({to:conversation.normalizedPhone,type:templateVersionId?'template':'text',text,templateVersionId,actorId:req.broker.id,conversationId:conversation.id},config);
        payload.idempotency_key=clean(req.body?.idempotencyKey,240)||payload.correlation_id;
        payload.simulate_failure=req.body?.simulateFailure===true;
      }catch(error){return{code:error.statusCode||400,error:error.message,response:{error:error.message,code:error.code}};}
      let submission;
      try{submission=await submitInProcess(config,'messages',payload,{client,deferCallbacks:true});}
      catch(error){return{code:error.statusCode||500,error:error.message,response:{error:error.message,code:error.code||'SIMULATED_PROVIDER_ERROR'}};}
      const response=submission?.response,providerMessageId=response?.messages?.[0]?.id;
      if(!providerMessageId)return{code:502,error:'Simulated provider response did not contain a message id'};
      const recorded=await recordSimulatedOutbound({providerMessageId,conversationId:conversation.id,templateVersionId,text,type:templateVersionId?'template':'text',actorId:req.broker.id,payload},{client,auditAccepted:false});
      const refreshed=recorded.duplicate?{refreshed:false,state:lockBefore}:await refreshReplyLockAfterSend(client,conversation,req.broker);
      if(!recorded.duplicate)await audit('WhatsAppConversation',conversation.id,'simulated_outbound_accepted',req.broker.id,{providerMessageId,messageId:recorded.messageId,simulation:true,replyLockRefreshed:refreshed.refreshed,replyLockExpiresAt:refreshed.refreshed?refreshed.state.expiresAt:null},client);
      return{provider:response,message:recorded,replyLock:refreshed.state,replyLockRefreshed:refreshed.refreshed,statusCallbacks:recorded.duplicate?[]:submission.statusCallbacks};
    });
    if(result.error)return res.status(result.code).json(result.response||{error:result.error});
    for(const item of result.statusCallbacks)void postCallback(item.payload,item.delayMs).catch(reportCallbackFailure);
    res.status(202).json({provider:result.provider,message:result.message,replyLock:result.replyLock,replyLockRefreshed:result.replyLockRefreshed,simulation:true});
  });
  r.post('/crm/whatsapp-workspace/campaigns/:id/simulated-send',async(req,res)=>{
    if(req.broker.role!=='internal_broker'||!['manager','director'].includes(req.broker.jobRole))return res.status(403).json({error:'Manager or Director approval is required to launch a simulated campaign'});
    const config=requireSimulation(req,res);if(!config)return;
    const campaign=await one(`SELECT c.*,v.simulated_provider_status FROM wa_campaign_drafts c JOIN wa_message_template_versions v ON v.id=c.template_version_id WHERE c.id=$1`,[req.params.id]);
    if(!campaign)return res.status(404).json({error:'Campaign not found'});
    const teams=req.broker.jobRole==='director'?null:[...(req.broker.managedTeamIds||[]),req.broker.teamId].filter(Boolean).map(String);
    if(teams&&!teams.includes(String(campaign.ownerTeamId)))return res.status(403).json({error:'Campaign is outside your management scope'});
    if(campaign.status!=='approved'||!campaign.approvedRevision)return res.status(409).json({error:'Campaign must be internally approved before simulated launch'});
    if(campaign.simulatedProviderStatus!=='approved')return res.status(409).json({error:'The campaign template must be approved by the simulated provider'});
    const recipients=await many(`SELECT a.*,r.source_code FROM wa_campaign_approval_recipients a JOIN wa_campaign_recipients r ON r.id=a.recipient_id
      WHERE a.campaign_id=$1 AND a.revision=$2 AND a.removed_at IS NULL ORDER BY a.normalized_phone`,[campaign.id,campaign.approvedRevision]);
    if(!recipients.length)return res.status(409).json({error:'Approved campaign snapshot has no remaining recipients'});
    try{for(const recipient of recipients)assertSyntheticWhatsAppPhone(recipient.normalizedPhone,config);}catch(error){return res.status(error.statusCode||409).json({error:'Every simulated campaign recipient must be in the agreed synthetic range',code:error.code});}
    let accepted=0,unchanged=0,failed=0;const errors=[];
    for(const recipient of recipients){
      if(recipient.simulatedProviderMessageId){unchanged++;continue;}
      try{
        const conversation=await ensureSimulatedCampaignConversation({phone:recipient.normalizedPhone,displayName:recipient.displayName,teamId:campaign.ownerTeamId,actorId:req.broker.id,campaignId:campaign.id,sourceType:recipient.sourceCode});
        const idempotencyKey=`campaign:${campaign.id}:${campaign.approvedRevision}:${recipient.normalizedPhone}`;
        const payload=buildSimulatedOutbound({to:recipient.normalizedPhone,type:'template',text:recipient.renderedMessage,templateVersionId:campaign.templateVersionId,actorId:req.broker.id,conversationId:conversation.id,correlationId:idempotencyKey},config);
        payload.idempotency_key=idempotencyKey;payload.campaign_id=campaign.id;payload.campaign_revision=campaign.approvedRevision;
        const provider=await submitInProcess(config,'messages',payload),providerMessageId=provider.messages?.[0]?.id;
        if(!providerMessageId)throw Object.assign(new Error('Simulated provider response did not contain a message id'),{statusCode:502});
        const recorded=await recordSimulatedOutbound({providerMessageId,conversationId:conversation.id,templateVersionId:campaign.templateVersionId,text:recipient.renderedMessage,type:'template',actorId:req.broker.id,payload});
        const recovered=recorded.duplicate?await one('SELECT provider_status,provider_status_at FROM wa_conversation_messages WHERE provider_message_id=$1 AND simulated=TRUE',[providerMessageId]):null;
        await execute(`UPDATE wa_campaign_approval_recipients SET simulated_conversation_id=$1,simulated_provider_message_id=$2,simulated_status=$6,simulated_status_at=COALESCE($7,NOW()),simulated_sent_at=COALESCE(simulated_sent_at,NOW()),simulated_last_error=NULL
          WHERE campaign_id=$3 AND revision=$4 AND normalized_phone=$5 AND simulated_provider_message_id IS NULL`,[conversation.id,providerMessageId,campaign.id,campaign.approvedRevision,recipient.normalizedPhone,recovered?.providerStatus||'accepted',recovered?.providerStatusAt||null]);
        accepted++;
      }catch(error){failed++;errors.push({phoneSuffix:String(recipient.normalizedPhone).slice(-4),error:clean(error.message,240)});await execute(`UPDATE wa_campaign_approval_recipients SET simulated_last_error=$1,simulated_status_at=NOW() WHERE campaign_id=$2 AND revision=$3 AND normalized_phone=$4`,[clean(error.message,500),campaign.id,campaign.approvedRevision,recipient.normalizedPhone]);}
    }
    await audit('WhatsAppCampaign',campaign.id,'simulated_campaign_launched',req.broker.id,{simulation:true,revision:campaign.approvedRevision,frozenRecipientCount:recipients.length,accepted,unchanged,failed});
    res.status(failed?207:202).json({simulation:true,campaignId:campaign.id,revision:campaign.approvedRevision,frozenRecipientCount:recipients.length,accepted,unchanged,failed,errors});
  });
  return r;
}
