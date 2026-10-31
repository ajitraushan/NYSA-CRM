import crypto from 'node:crypto';
import {Router} from './lib/http-kit.js';
import {sealLeadEvidence} from './meta-lead-retrieval.js';
export async function sendLeadWhatsAppTemplate({to,templateName,language='en',parameters=[]},{env=process.env,fetchImpl=fetch}={}){
 if(env.LEAD_WHATSAPP_ENABLED!=='true'||!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)||!env.LEAD_WHATSAPP_API_KEY)throw new Error('WHATSAPP_DISABLED');
 if(!/^\+[1-9]\d{7,14}$/.test(to)||!/^[a-z0-9_]{1,100}$/.test(templateName)||!['en','en_US','hi'].includes(language)||
 !Array.isArray(parameters)||parameters.length>5||parameters.some(v=>typeof v!=='string'||v.length>500))throw new Error('WHATSAPP_ENVELOPE_INVALID');
 if(env.LEAD_RESPONSE_ENVIRONMENT==='crm-test'&&!String(env.LEAD_WHATSAPP_TEST_RECIPIENTS||'').split(',').map(v=>v.trim()).includes(to))throw new Error('WHATSAPP_TEST_RECIPIENT_NOT_APPROVED');
 const body={messaging_product:'whatsapp',recipient_type:'individual',to:to.slice(1),type:'template',template:{name:templateName,language:{code:language},
  ...(parameters.length?{components:[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]}:{})}};
 try{
  const response=await fetchImpl('https://waba-v2.360dialog.io/messages',{method:'POST',headers:{'D360-API-KEY':env.LEAD_WHATSAPP_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok||typeof result.messages?.[0]?.id!=='string')throw new Error('NO_PROVIDER_RECEIPT');
  return {state:'accepted',providerRef:result.messages[0].id};
 }catch{throw new Error('WHATSAPP_SUBMISSION_OUTCOME_UNKNOWN');}
}
export function createNativeLeadWhatsAppRoutes({transaction,env:baseEnv=process.env,loadEnvironment}){
 const r=Router();r.post('/providers/lead-whatsapp/events',async(req,res)=>{
  let env;try{env=loadEnvironment?await loadEnvironment():baseEnv;}catch{return res.status(503).json({error:'WHATSAPP_INBOX_DISABLED'});}
  if(env.LEAD_WHATSAPP_INBOX_ENABLED!=='true'||!env.LEAD_WHATSAPP_WEBHOOK_PASSWORD||env.LEAD_WHATSAPP_WEBHOOK_PASSWORD.length<32||!env.LEAD_EVIDENCE_KEY||!env.LEAD_WHATSAPP_PHONE_ID||!env.LEAD_WHATSAPP_ACCOUNT_ID)return res.status(503).json({error:'WHATSAPP_INBOX_DISABLED'});
  const expected='Basic '+Buffer.from('nysa-lead:'+env.LEAD_WHATSAPP_WEBHOOK_PASSWORD).toString('base64');
  const provided=String(req.headers.authorization||'');const hash=value=>crypto.createHash('sha256').update(value).digest();
  if(!crypto.timingSafeEqual(hash(provided),hash(expected)))return res.status(401).json({error:'WHATSAPP_AUTH_DENIED'});
  if(Buffer.byteLength(req.rawBody||'')>256*1024||!Array.isArray(req.body.entry)||req.body.entry.length>20)return res.status(400).json({error:'WHATSAPP_EVENT_INVALID'});
  const events=[];
  for(const entry of req.body.entry){
   if(String(entry.id)!==env.LEAD_WHATSAPP_ACCOUNT_ID)return res.status(400).json({error:'WHATSAPP_ACCOUNT_MISMATCH'});
   for(const change of entry.changes||[]){const value=change.value;
    if(String(value?.metadata?.phone_number_id)!==env.LEAD_WHATSAPP_PHONE_ID)return res.status(400).json({error:'WHATSAPP_PHONE_MISMATCH'});
    for(const message of value.messages||[]){
     if(typeof message.id!=='string'||message.id.length>160||!/^\d{8,15}$/.test(message.from)||(typeof message.text?.body==='string'&&message.text.body.length>10000))return res.status(400).json({error:'WHATSAPP_MESSAGE_REVIEW_REQUIRED'});
     events.push({provider:'whatsapp',occurredAt:/^\d+$/.test(String(message.timestamp||''))?new Date(Number(message.timestamp)*1000).toISOString():null,connectionRef:'360dialog:'+env.LEAD_WHATSAPP_PHONE_ID,eventRef:message.id,sender:'+'+message.from,
      messageRef:message.context?.id||'',type:typeof message.text?.body!=='string'?'unsupported':/^\s*(stop|unsubscribe|do not contact)\b/i.test(message.text.body)?'opt_out':'reply',text:message.text?.body||'[Unsupported message content]'});
    }
    for(const status of value.statuses||[]){
     if(typeof status.id!=='string'||!['sent','delivered','read','failed'].includes(status.status)||!/^\d{8,15}$/.test(String(status.recipient_id||'')))return res.status(400).json({error:'WHATSAPP_STATUS_INVALID'});
     events.push({provider:'whatsapp',connectionRef:'360dialog:'+env.LEAD_WHATSAPP_PHONE_ID,eventRef:`status:${status.id}:${status.status}:${status.timestamp}`,sender:'+'+status.recipient_id,messageRef:status.id,type:'delivery_status',status:status.status,text:''});
    }
   }
  }
  if(events.length>100)return res.status(400).json({error:'WHATSAPP_EVENT_LIMIT'});
  try{await transaction(async c=>{
   for(const event of events){
    const digest=crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
    if(!event.messageRef){const matches=await c.query(`SELECT a.provider_ref FROM lead_response_message_attempts a JOIN lead_follow_up_jobs j ON j.id=a.job_id
      JOIN lead_follow_up_cases fc ON fc.id=j.case_id JOIN leads l ON l.id=fc.lead_id JOIN contacts ct ON ct.id=l.contact_id
      WHERE ct.phone=$1 AND j.channel='whatsapp' AND a.provider_ref IS NOT NULL ORDER BY a.created_at DESC LIMIT 2`,[event.sender]);
     if(matches.rows.length===1)event.messageRef=matches.rows[0].provider_ref;
    }
    const inserted=await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,expires_at)
      VALUES($1,'whatsapp',$2,$3,$4,$5,NOW()+INTERVAL '12 months') ON CONFLICT(provider,connection_ref,event_ref) DO NOTHING RETURNING id`,
      [crypto.randomUUID(),event.eventRef,event.connectionRef,digest,sealLeadEvidence(event,env.LEAD_EVIDENCE_KEY)]);
    if(!inserted.rows.length){const old=(await c.query("SELECT event_digest FROM lead_response_provider_inbox WHERE provider='whatsapp' AND connection_ref=$1 AND event_ref=$2",[event.connectionRef,event.eventRef])).rows[0];if(old?.event_digest!==digest)throw Object.assign(new Error('EVENT_CONFLICT'),{statusCode:409});}
   }
  });res.json({status:'durably_received'});}catch(error){res.status(error.statusCode===409?409:503).json({error:error.statusCode===409?'WHATSAPP_EVENT_CONFLICT':'WHATSAPP_RECEIPT_UNAVAILABLE'});}
 });return r;
}
export async function sendLeadWhatsAppText({to,text,lastInboundAt},{env=process.env,fetchImpl=fetch}={}){
 if(env.LEAD_WHATSAPP_ENABLED!=='true'||!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)||!env.LEAD_WHATSAPP_API_KEY)throw new Error('WHATSAPP_DISABLED');
 const age=Date.now()-new Date(lastInboundAt).valueOf();
 if(!Number.isFinite(age)||age<0||age>=24*3600000)throw new Error('WHATSAPP_CUSTOMER_WINDOW_CLOSED');
 if(!/^\+[1-9]\d{7,14}$/.test(to)||typeof text!=='string'||!text.trim()||text.length>1500)throw new Error('WHATSAPP_ENVELOPE_INVALID');
 if(env.LEAD_RESPONSE_ENVIRONMENT==='crm-test'&&!String(env.LEAD_WHATSAPP_TEST_RECIPIENTS||'').split(',').map(v=>v.trim()).includes(to))throw new Error('WHATSAPP_TEST_RECIPIENT_NOT_APPROVED');
 try{
  const response=await fetchImpl('https://waba-v2.360dialog.io/messages',{method:'POST',headers:{'D360-API-KEY':env.LEAD_WHATSAPP_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:to.slice(1),type:'text',text:{body:text}}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok||typeof result.messages?.[0]?.id!=='string')throw new Error('NO_PROVIDER_RECEIPT');return {state:'accepted',providerRef:result.messages[0].id};
 }catch{throw new Error('WHATSAPP_SUBMISSION_OUTCOME_UNKNOWN');}
}
