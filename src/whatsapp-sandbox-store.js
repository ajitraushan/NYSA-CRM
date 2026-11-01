import {randomUUID, createHmac} from 'node:crypto';
import {sealLeadEvidence, readLeadEvidence} from './meta-lead-retrieval.js';
import {buildSandboxMessage, parseSandboxEvents, submitSandboxMessage,boundedSandboxJson,sandboxCallbackToken} from './whatsapp-sandbox.js';

const error = (code, statusCode = 409) => Object.assign(new Error(code), {statusCode});
const digest = (value, key) => createHmac('sha256', key).update(value).digest('hex');
export const sandboxEnvironmentAllowed = env => ['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT);
export const sandboxSetupAllowed = env => sandboxEnvironmentAllowed(env) && env.WHATSAPP_SANDBOX_SETUP_ENABLED === 'true' && /^[a-f0-9]{64}$/i.test(env.LEAD_CONNECTION_KEY || '');
export const sandboxQuota = env => {
 const value = Number(env.WHATSAPP_SANDBOX_REQUEST_BUDGET ?? 10);
 return Number.isInteger(value) && value > 0 && value <= 25 ? value : 0;
};
async function audit(c, id, actorId, action, details = {}) {
 await c.query('INSERT INTO wa_sandbox_audit(id,connection_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5)', [randomUUID(),id,actorId,action,JSON.stringify(details)]);
}
export function sandboxCredentials(body) {
 if (!body || typeof body !== 'object' || Array.isArray(body) ||
     Object.keys(body).some(k => !['revision','apiKey','recipientKind','recipient','relaySecret'].includes(k)) ||
     !Number.isInteger(body.revision) || body.revision < 0 ||
     typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 4096 || /[\r\n]/.test(body.apiKey) ||
     typeof body.relaySecret !== 'string' || body.relaySecret.length < 32 || body.relaySecret.length > 512 ||
     typeof body.recipient !== 'string' ||
     !(body.recipientKind === 'phone' ? /^\+[1-9]\d{7,14}$/.test(body.recipient) : body.recipientKind === 'bsuid' && /^[A-Za-z0-9_.:-]{1,160}$/.test(body.recipient)))
   throw error('SANDBOX_CONFIGURATION_INVALID',400);
 return {apiKey:body.apiKey,recipientKind:body.recipientKind,recipient:body.recipient,relaySecret:body.relaySecret};
}
export async function saveSandboxConnection({body,actorId,env},c) {
 if (!sandboxSetupAllowed(env)) throw error('SANDBOX_SETUP_DISABLED',503);
 const value = sandboxCredentials(body);
 await c.query("SELECT pg_advisory_xact_lock(hashtext('wa-sandbox-setup'))");
 const old=(await c.query('SELECT * FROM wa_sandbox_connections WHERE singleton=TRUE FOR UPDATE')).rows[0];
 if ((old?.revision || 0)!==body.revision) throw error('SANDBOX_STALE_CONFIGURATION');
 if(old){
  const prior=readLeadEvidence(old.encrypted_credentials,env.LEAD_CONNECTION_KEY);
  if(prior.recipient!==value.recipient||prior.recipientKind!==value.recipientKind)throw error('SANDBOX_RECIPIENT_CHANGE_REQUIRES_REVIEW');
 }
 if (old && (await c.query("SELECT id FROM wa_sandbox_attempts WHERE connection_id=$1 AND state='submitting' LIMIT 1",[old.id])).rows.length) throw error('SANDBOX_SUBMISSION_IN_PROGRESS');
 const keyFingerprint=digest(value.apiKey,env.LEAD_CONNECTION_KEY), id=old?.id || randomUUID();
 const revision=(old?.revision || 0)+1;
 if(old) await c.query('UPDATE wa_sandbox_connections SET revision=$2,encrypted_credentials=$3,key_fingerprint=$4,paused=TRUE,updated_by=$5,updated_at=NOW() WHERE id=$1',[id,revision,sealLeadEvidence(value,env.LEAD_CONNECTION_KEY),keyFingerprint,actorId]);
 else await c.query('INSERT INTO wa_sandbox_connections(id,encrypted_credentials,key_fingerprint,updated_by) VALUES($1,$2,$3,$4)',[id,sealLeadEvidence(value,env.LEAD_CONNECTION_KEY),keyFingerprint,actorId]);
 await audit(c,id,actorId,'credentials_saved',{revision,paused:true});
 return {revision,configured:true,paused:true};
}
export async function loadSandboxConnection(c,env,{lock=false}={}) {
 if(!sandboxSetupAllowed(env)) throw error('SANDBOX_SETUP_DISABLED',503);
 const row=(await c.query('SELECT * FROM wa_sandbox_connections WHERE singleton=TRUE'+(lock?' FOR UPDATE':''))).rows[0];
 if(!row) throw error('SANDBOX_NOT_CONFIGURED');
 const value=readLeadEvidence(row.encrypted_credentials,env.LEAD_CONNECTION_KEY);
 return {...row,credentials:value};
}
export async function sandboxStatus(c,env) {
 const enabled=sandboxSetupAllowed(env);
 if(!enabled) return {setupEnabled:false,configured:false,sendingEnabled:false};
 const row=(await c.query('SELECT id,revision,paused,key_fingerprint FROM wa_sandbox_connections WHERE singleton=TRUE')).rows[0];
 if(!row) return {setupEnabled:true,configured:false,revision:0,sendingEnabled:false,budget:sandboxQuota(env)};
 const used=Number((await c.query('SELECT COUNT(*)::int AS count FROM wa_sandbox_attempts WHERE key_fingerprint=$1',[row.key_fingerprint])).rows[0].count);
 const attempts=(await c.query('SELECT id,state,result_code,delivery_state,created_at FROM wa_sandbox_attempts WHERE connection_id=$1 ORDER BY created_at DESC LIMIT 25',[row.id])).rows;
 const events=(await c.query('SELECT type,COUNT(*)::int AS count FROM wa_sandbox_events WHERE connection_id=$1 GROUP BY type',[row.id])).rows;
 const configuration=(await c.query("SELECT action FROM wa_sandbox_audit WHERE connection_id=$1 AND action IN ('webhook_configured','callback_authenticated') AND details->>'revision'=$2",[row.id,String(row.revision)])).rows;
 return {setupEnabled:true,configured:true,revision:row.revision,paused:row.paused,
   sendingEnabled:env.WHATSAPP_SANDBOX_ENABLED==='true'&&env.WHATSAPP_SANDBOX_CALLBACK_APPROVED==='true'&&!row.paused,
   relayApproved:env.WHATSAPP_SANDBOX_CALLBACK_APPROVED==='true',authMode:env.WHATSAPP_SANDBOX_AUTH_MODE==='basic'?'basic':'relay',
   webhookConfigured:configuration.some(x=>x.action==='webhook_configured'),callbackObserved:configuration.some(x=>x.action==='callback_authenticated'),
   budget:sandboxQuota(env),used,remaining:Math.max(0,sandboxQuota(env)-used),attempts,events};
}
export async function configureSandboxWebhook({actorId,env,transaction,fetchImpl=fetch}) {
 if(!sandboxSetupAllowed(env)||env.WHATSAPP_SANDBOX_AUTH_MODE!=='basic'||env.WHATSAPP_SANDBOX_PUBLIC_ORIGIN!=='https://crm-test.nysarealty.com')throw error('SANDBOX_WEBHOOK_SETUP_DISABLED',503);
 const row=await transaction(c=>loadSandboxConnection(c,env));
 if(!row.paused)throw error('SANDBOX_PAUSE_BEFORE_WEBHOOK_SETUP');
 const url='https://crm-test.nysarealty.com/api/providers/whatsapp-sandbox/events/'+sandboxCallbackToken(row);
 try{
  const response=await fetchImpl('https://waba-sandbox.360dialog.io/v1/configs/webhook',{method:'POST',redirect:'error',
   headers:{'D360-API-KEY':row.credentials.apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({url}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw error('SANDBOX_WEBHOOK_CONFIGURATION_UNCONFIRMED');}
  const receipt=await boundedSandboxJson(response);if(receipt?.url!==url)throw error('SANDBOX_WEBHOOK_CONFIGURATION_UNCONFIRMED');
 }catch{throw error('SANDBOX_WEBHOOK_CONFIGURATION_UNCONFIRMED');}
 await transaction(async c=>{const current=await loadSandboxConnection(c,env,{lock:true});if(current.revision!==row.revision)throw error('SANDBOX_STALE_CONFIGURATION');await audit(c,row.id,actorId,'webhook_configured',{revision:row.revision,authMode:'path_token'});});
 return {webhookConfigured:true,callbackVerified:false,paused:true};
}
export async function setSandboxPaused({paused,actorId,env},c) {
 if(typeof paused!=='boolean') throw error('SANDBOX_PAUSE_INVALID',400);
 const row=await loadSandboxConnection(c,env,{lock:true});
 if(!paused && (env.WHATSAPP_SANDBOX_ENABLED!=='true'||env.WHATSAPP_SANDBOX_CALLBACK_APPROVED!=='true'||!sandboxQuota(env))) throw error('SANDBOX_ACTIVATION_NOT_APPROVED');
 await c.query('UPDATE wa_sandbox_connections SET paused=$2,updated_by=$3,updated_at=NOW() WHERE id=$1',[row.id,paused,actorId]);
 await audit(c,row.id,actorId,'pause_changed',{paused}); return {paused};
}
const safeAttempt = row => ({attemptId:row.id,state:row.state==='submitting'?'outcome_unknown':row.state,
 ...(row.result_code?{code:row.result_code}:{}),...(row.delivery_state?{deliveryState:row.delivery_state}:{})});
export async function sendSandboxTest({body,actorId,env,transaction,fetchImpl=fetch}) {
 if(!sandboxSetupAllowed(env)||env.WHATSAPP_SANDBOX_ENABLED!=='true'||env.WHATSAPP_SANDBOX_CALLBACK_APPROVED!=='true') throw error('SANDBOX_DISABLED',503);
 if(!body||Object.keys(body).some(k=>!['actionKey','confirmed','type','text','templateName','parameters'].includes(k))||body.confirmed!==true||
    typeof body.actionKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.actionKey)) throw error('SANDBOX_SEND_INVALID',400);
 if(!['text','template'].includes(body.type)||(body.type==='text'&&(body.templateName!==undefined||body.parameters!==undefined))||(body.type==='template'&&body.text!==undefined))throw error('SANDBOX_SEND_INVALID',400);
 const loaded=await transaction(c=>loadSandboxConnection(c,env));
 const settings={...env,WHATSAPP_SANDBOX_API_KEY:loaded.credentials.apiKey,WHATSAPP_SANDBOX_RECIPIENT_KIND:loaded.credentials.recipientKind,WHATSAPP_SANDBOX_RECIPIENT:loaded.credentials.recipient};
 const input={recipient:loaded.credentials.recipient,type:body.type,...(body.type==='text'?{text:body.text}:{templateName:body.templateName,parameters:body.parameters})};
 if(body.type==='text') input.lastInboundAt=await transaction(async c=>(await c.query("SELECT MAX(occurred_at) AS at FROM wa_sandbox_events WHERE connection_id=$1 AND type='reply'",[loaded.id])).rows[0].at);
 // pg returns Date values; the transport deliberately takes an ISO timestamp.
 if(input.lastInboundAt instanceof Date) input.lastInboundAt=input.lastInboundAt.toISOString();
 const requestHash=digest(JSON.stringify({type:body.type,text:body.text,templateName:body.templateName,parameters:body.parameters}),env.LEAD_CONNECTION_KEY);
 const previous=await transaction(async c=>(await c.query('SELECT * FROM wa_sandbox_attempts WHERE connection_id=$1 AND action_key=$2',[loaded.id,body.actionKey])).rows[0]);
 if(previous){if(previous.request_digest!==requestHash)throw error('SANDBOX_ACTION_CONFLICT');return safeAttempt(previous);}
 buildSandboxMessage(input,{env:settings});
 try {
  const result=await submitSandboxMessage(input,{env:settings,fetchImpl,
   claimAttempt:({body:payload})=>transaction(async c=>{
    const current=await loadSandboxConnection(c,env,{lock:true});
    if(current.revision!==loaded.revision||current.paused)throw error('SANDBOX_PAUSED_OR_CHANGED');
    const existing=(await c.query('SELECT id FROM wa_sandbox_attempts WHERE connection_id=$1 AND action_key=$2',[loaded.id,body.actionKey])).rows[0];
    if(existing)throw error('SANDBOX_ACTION_EXISTS');
    if((await c.query("SELECT id FROM wa_sandbox_attempts WHERE connection_id=$1 AND state IN ('submitting','outcome_unknown') LIMIT 1",[loaded.id])).rows.length)throw error('SANDBOX_UNRESOLVED_SUBMISSION');
    const used=Number((await c.query('SELECT COUNT(*)::int AS count FROM wa_sandbox_attempts WHERE key_fingerprint=$1',[current.key_fingerprint])).rows[0].count);
    if(!sandboxQuota(env)||used>=sandboxQuota(env))throw error('SANDBOX_LOCAL_QUOTA_EXHAUSTED');
    const id=randomUUID();await c.query("INSERT INTO wa_sandbox_attempts(id,connection_id,action_key,request_digest,key_fingerprint,encrypted_payload,actor_id,state) VALUES($1,$2,$3,$4,$5,$6,$7,'submitting')",[id,current.id,body.actionKey,requestHash,current.key_fingerprint,sealLeadEvidence(payload,env.LEAD_CONNECTION_KEY),actorId]);
    await audit(c,current.id,actorId,'test_submission_reserved',{attemptId:id});return {id,state:'reserved'};
   }),
   recordOutcome:(id,outcome)=>transaction(async c=>{
    await c.query('SELECT id FROM wa_sandbox_connections WHERE id=$1 FOR UPDATE',[loaded.id]);
    await c.query('UPDATE wa_sandbox_attempts SET state=$2,provider_ref=$3,result_code=$4,http_status=$5,updated_at=NOW() WHERE id=$1',[id,outcome.state,outcome.providerRef||null,outcome.code||null,outcome.httpStatus||null]);
    if(outcome.providerRef) await reconcileSandboxDelivery(c,loaded.id,outcome.providerRef);
    await audit(c,loaded.id,actorId,'test_submission_recorded',{attemptId:id,state:outcome.state});
   })});
  return {attemptId:result.attemptId,state:result.state,...(result.code?{code:result.code}:{})};
 }catch(e){
  if(e.message==='SANDBOX_ACTION_EXISTS'){
   const existing=await transaction(async c=>(await c.query('SELECT * FROM wa_sandbox_attempts WHERE connection_id=$1 AND action_key=$2',[loaded.id,body.actionKey])).rows[0]);
   if(existing?.request_digest===requestHash)return safeAttempt(existing);
   throw error('SANDBOX_ACTION_CONFLICT');
  }
  throw e;
 }
}
async function reconcileSandboxDelivery(c,connectionId,providerRef) {
 const statuses=(await c.query("SELECT delivery_state FROM wa_sandbox_events WHERE connection_id=$1 AND provider_ref=$2 AND type='delivery_status'",[connectionId,providerRef])).rows.map(x=>x.delivery_state);
 const state=['read','delivered','failed','sent'].find(x=>statuses.includes(x));
 if(state)await c.query('UPDATE wa_sandbox_attempts SET delivery_state=$3 WHERE connection_id=$1 AND provider_ref=$2',[connectionId,providerRef,state]);
}
export async function receiveSandboxEvents({body,env,authMode},c) {
 const row=await loadSandboxConnection(c,env,{lock:true});
 const events=parseSandboxEvents(body,{recipientKind:row.credentials.recipientKind,recipient:row.credentials.recipient});
 let fresh=0;
 for(const event of events){
  const eventHash=digest(JSON.stringify(event),env.LEAD_CONNECTION_KEY);
  const inserted=await c.query('INSERT INTO wa_sandbox_events(id,connection_id,event_ref,event_digest,encrypted_payload,type,provider_ref,occurred_at,delivery_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(connection_id,event_ref) DO NOTHING RETURNING id',[randomUUID(),row.id,event.eventRef,eventHash,sealLeadEvidence(event,env.LEAD_CONNECTION_KEY),event.type,event.messageRef,event.occurredAt,event.status||null]);
  if(!inserted.rows.length){
   const old=(await c.query('SELECT event_digest FROM wa_sandbox_events WHERE connection_id=$1 AND event_ref=$2',[row.id,event.eventRef])).rows[0];
   if(old.event_digest!==eventHash)throw error('SANDBOX_EVENT_CONFLICT');
  }else fresh++;
  if(event.type==='opt_out')await c.query('UPDATE wa_sandbox_connections SET paused=TRUE WHERE id=$1',[row.id]);
  if(event.type==='delivery_status')await reconcileSandboxDelivery(c,row.id,event.messageRef);
 }
 if(fresh&&['basic','relay','path_token'].includes(authMode))await audit(c,row.id,null,'callback_authenticated',{revision:row.revision,authMode});
 return {status:'durably_received'};
}
