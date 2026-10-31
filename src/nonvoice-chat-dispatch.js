import {readLeadEvidence} from './meta-lead-retrieval.js';
import {channelWindow,evaluateChatContinuation} from './lead-follow-up-domain.js';
import {sendLeadEmail} from './cpanel-lead-email.js';
import {sendLeadWhatsAppText} from './lead-whatsapp.js';
export async function dispatchAiReplies({transaction,env=process.env,emailSend=sendLeadEmail,whatsappSend=sendLeadWhatsAppText,now=()=>new Date()}){
 if(env.LEAD_RESPONSE_LIVE_ENABLED!=='true'||env.LEAD_AI_CHAT_ENABLED!=='true'||!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT))return {status:'disabled'};
 const pending=await transaction(async c=>(await c.query("SELECT id,case_id FROM lead_response_chat_drafts WHERE state='ready' ORDER BY created_at LIMIT 5")).rows);
 let submitted=0;
 for(const item of pending)await transaction(async c=>{
  const current=(await c.query(`SELECT fc.*,ct.email,ct.phone,ct.do_not_contact,l.assigned_to FROM lead_follow_up_cases fc JOIN leads l ON l.id=fc.lead_id
   JOIN contacts ct ON ct.id=l.contact_id WHERE fc.id=$1 FOR UPDATE OF fc,l,ct`,[item.case_id])).rows[0];
  const draft=(await c.query('SELECT d.*,i.provider,i.encrypted_payload FROM lead_response_chat_drafts d JOIN lead_response_provider_inbox i ON i.id=d.provider_inbox_id WHERE d.id=$1 FOR UPDATE OF d',[item.id])).rows[0];
  if(draft.state!=='ready')return;
  const control=(await c.query('SELECT paused FROM lead_integration_setup WHERE singleton=TRUE FOR SHARE')).rows[0];if(control?.paused!==false)return;
  const gate=evaluateChatContinuation({openedAt:current.chat_opened_at,now:now(),repliesWithoutProgress:current.chat_replies_without_progress,
   restricted:Boolean(current.do_not_contact),humanTakenOver:Boolean(current.assigned_to),booked:current.state==='booked'});
  if(!gate.allowed||current.generation!==draft.generation||current.state!=='engaged'||new Date(draft.conversation_expires_at)<=now()){
   await c.query("UPDATE lead_response_chat_drafts SET state='cancelled' WHERE id=$1",[draft.id]);return;
  }
  const window=channelWindow({channel:draft.provider,country:current.country,locationConfirmed:current.location_confirmed,timeZone:current.time_zone,at:now()});
  if(!window.allowed)return;
  const content=readLeadEvidence(draft.encrypted_reply,env.LEAD_EVIDENCE_KEY),source=readLeadEvidence(draft.encrypted_payload,env.LEAD_EVIDENCE_KEY);
  try{
   const result=draft.provider==='email'?await emailSend({to:current.email,subject:'Your NYSA enquiry',text:content.reply,attemptRef:draft.id},{env}):
    await whatsappSend({to:current.phone,text:content.reply,lastInboundAt:source.occurredAt},{env});
   await c.query("UPDATE lead_response_chat_drafts SET state='sent',provider_ref=$2 WHERE id=$1",[draft.id,result.providerRef]);
   await c.query('UPDATE lead_follow_up_cases SET chat_replies_without_progress=chat_replies_without_progress+1 WHERE id=$1',[current.id]);
   if(current.chat_replies_without_progress+1>=10){await c.query("UPDATE lead_follow_up_cases SET state='handoff_pending',handoff_requested_at=COALESCE(handoff_requested_at,NOW()) WHERE id=$1",[current.id]);
    await c.query("UPDATE tasks SET subject='Human follow-up: AI reply limit reached',priority='high',updated_at=NOW() WHERE id=$1",[current.next_action_task_id]);}
   submitted++;
  }catch{
   await c.query("UPDATE lead_response_chat_drafts SET state='outcome_unknown' WHERE id=$1",[draft.id]);
   await c.query("UPDATE lead_follow_up_cases SET state='outcome_unknown',generation=generation+1,updated_at=NOW() WHERE id=$1",[current.id]);
   await c.query("UPDATE tasks SET subject='Reconcile AI reply delivery',priority='urgent',updated_at=NOW() WHERE id=$1",[current.next_action_task_id]);
  }
 });return {submitted};
}
