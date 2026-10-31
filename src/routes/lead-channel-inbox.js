import crypto from 'node:crypto';
import {Router} from '../lib/http-kit.js';
import {sealLeadEvidence,readLeadEvidence} from '../meta-lead-retrieval.js';
import {applyNonvoiceEvent} from '../nonvoice-follow-up-store.js';
const safeEqual=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(),crypto.createHash('sha256').update(b).digest());
export function createLeadChannelInboxRoutes({transaction,env=process.env}){
 const r=Router();
 // This is the explicitly documented NYSA relay contract. It does not pretend to
 // validate an arbitrary email provider's native signature. The relay must verify it first.
 r.post('/providers/lead-response/events',async(req,res)=>{
  const secret=env.LEAD_CHANNEL_RELAY_SECRET;
  if(env.LEAD_CHANNEL_INBOX_ENABLED!=='true'||!secret||secret.length<32||!env.LEAD_EVIDENCE_KEY)return res.status(503).json({error:'CHANNEL_INBOX_DISABLED'});
  const timestamp=req.headers['x-nysa-timestamp'],sig=req.headers['x-nysa-signature'];
  if(typeof timestamp!=='string'||!Number.isFinite(Number(timestamp))||Math.abs(Date.now()-Number(timestamp))>300000||typeof sig!=='string'||!/^sha256=[a-f0-9]{64}$/.test(sig))return res.status(401).json({error:'CHANNEL_AUTH_DENIED'});
  const expected='sha256='+crypto.createHmac('sha256',secret).update(timestamp+'.'+req.rawBody).digest('hex');
  if(!safeEqual(sig,expected))return res.status(401).json({error:'CHANNEL_AUTH_DENIED'});
  const body=req.body;
  if(Buffer.byteLength(req.rawBody||'')>65536||!['whatsapp','email'].includes(body.provider)||typeof body.eventRef!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(body.eventRef)||
   typeof body.connectionRef!=='string'||body.connectionRef!==env.LEAD_CHANNEL_CONNECTION_REF||typeof body.messageRef!=='string'||body.messageRef.length>200||
   !['reply','opt_out','wrong_person'].includes(body.type)||typeof body.sender!=='string'||body.sender.length>200||typeof body.text!=='string'||body.text.length>10000)return res.status(400).json({error:'CHANNEL_EVENT_INVALID'});
  try{
   const digest=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
   await transaction(async c=>{
    const result=await c.query(`INSERT INTO lead_response_provider_inbox(id,provider,event_ref,connection_ref,event_digest,encrypted_payload,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '12 months') ON CONFLICT(provider,connection_ref,event_ref) DO NOTHING RETURNING id`,
     [crypto.randomUUID(),body.provider,body.eventRef,body.connectionRef,digest,sealLeadEvidence(body,env.LEAD_EVIDENCE_KEY)]);
    if(!result.rows.length){const old=(await c.query('SELECT event_digest FROM lead_response_provider_inbox WHERE provider=$1 AND connection_ref=$2 AND event_ref=$3',[body.provider,body.connectionRef,body.eventRef])).rows[0];if(old?.event_digest!==digest)throw Object.assign(new Error('EVENT_CONFLICT'),{statusCode:409});}
   });res.json({status:'durably_received'});
  }catch(e){res.status(e.statusCode===409?409:503).json({error:e.statusCode===409?'CHANNEL_EVENT_CONFLICT':'CHANNEL_RECEIPT_UNAVAILABLE'});}
 });return r;
}
export async function processLeadChannelInbox({id,evidenceKey},client){
 const row=(await client.query('SELECT * FROM lead_response_provider_inbox WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!row||row.state!=='received')return {duplicate:true};
 const event=readLeadEvidence(row.encrypted_payload,evidenceKey);
 if(!['reply','opt_out','wrong_person','delivery_status'].includes(event.type)){await client.query("UPDATE lead_response_provider_inbox SET state='needs_review',error_code='UNSUPPORTED_CHANNEL_EVENT' WHERE id=$1",[id]);return {reviewRequired:true};}
 const links=await client.query(`SELECT c.id,c.generation,ct.email,ct.phone FROM lead_follow_up_cases c JOIN leads l ON l.id=c.lead_id JOIN contacts ct ON ct.id=l.contact_id
 WHERE c.id IN (SELECT j.case_id FROM lead_response_message_attempts a JOIN lead_follow_up_jobs j ON j.id=a.job_id WHERE a.provider_ref=$1 AND j.channel=$2
 UNION SELECT d.case_id FROM lead_response_chat_drafts d JOIN lead_response_provider_inbox i ON i.id=d.provider_inbox_id WHERE d.provider_ref=$1 AND i.provider=$2)`,[event.messageRef,event.provider]);
 const senderMatches=links.rows.length===1&&(event.provider==='email'?String(links.rows[0].email||'').toLowerCase()===String(event.sender||'').toLowerCase():Boolean(event.sender)&&String(links.rows[0].phone||'')===event.sender);
 if(!senderMatches){await client.query("UPDATE lead_response_provider_inbox SET state='needs_review',error_code='UNMATCHED_REPLY' WHERE id=$1",[id]);return {reviewRequired:true};}
 if(event.type==='delivery_status'){
  if(!['sent','delivered','read','failed'].includes(event.status))throw new Error('INVALID_DELIVERY_EVIDENCE');
  for(const table of ['lead_response_message_attempts','lead_response_chat_drafts'])await client.query(`UPDATE ${table} SET delivery_state=CASE
   WHEN delivery_state='read' THEN delivery_state WHEN $2='read' THEN 'read' WHEN delivery_state='delivered' THEN delivery_state
   WHEN $2='delivered' THEN 'delivered' WHEN $2='failed' THEN 'failed' WHEN delivery_state='failed' THEN delivery_state ELSE 'sent' END WHERE provider_ref=$1`,[event.messageRef,event.status]);
  await client.query("UPDATE lead_response_provider_inbox SET state='processed' WHERE id=$1",[id]);return {statusRecorded:true};
 }
 const interpretedType=/^\s*(stop|unsubscribe|do not contact)\b/i.test(event.text)?'opt_out':event.type;
 const result=await applyNonvoiceEvent({caseId:links.rows[0].id,generation:links.rows[0].generation,type:interpretedType,
  connectionRef:event.connectionRef,eventRef:'provider:'+crypto.createHash('sha256').update(event.eventRef).digest('hex')},client);
 await client.query("UPDATE lead_response_provider_inbox SET state='processed' WHERE id=$1",[id]);return result;
}
