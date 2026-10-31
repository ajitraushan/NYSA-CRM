import {claimNonvoiceJobs} from './nonvoice-follow-up-store.js';
import {reserveMessageBudget,recordMessageSubmission} from './nonvoice-message-dispatch.js';
import {sendLeadEmail} from './cpanel-lead-email.js';
import {sendLeadWhatsAppTemplate} from './lead-whatsapp.js';
export async function dispatchNonvoiceCycle({transaction,env=process.env,emailSend=sendLeadEmail,whatsappSend=sendLeadWhatsAppTemplate}){
 if(env.LEAD_RESPONSE_LIVE_ENABLED!=='true'||!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT))return {status:'disabled',submitted:0};
 // All live recipient/transport configuration is still gated independently by each adapter.
 const jobs=await transaction(c=>claimNonvoiceJobs({liveEnabled:true,limit:2},c));let submitted=0,review=0;
 for(const job of jobs){
  if(job.channel==='handoff'){
   await transaction(async c=>{
    const row=(await c.query('SELECT * FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[job.case_id])).rows[0];
    if(row.state!=='ready'||row.generation!==job.generation)return;
    await c.query("UPDATE lead_follow_up_cases SET state='handoff_pending',tier_suggestion=$2::jsonb,handoff_requested_at=NOW() WHERE id=$1",[row.id,JSON.stringify({score:null,suggestedTier:'Unreached',humanConfirmationRequired:true})]);
    await c.query("UPDATE tasks SET subject='Unreached enquiry — personal follow-up',due_at=NOW()+INTERVAL '48 hours',updated_at=NOW() WHERE id=$1",[row.next_action_task_id]);
    await c.query("UPDATE lead_follow_up_jobs SET state='complete' WHERE id=$1",[job.id]);
   });continue;
  }
  // Missing approved copy/templates never turns into invented pricing or empty messages.
  const emailText=env[`LEAD_EMAIL_STEP_${job.step}_TEXT`],emailSubject=env[`LEAD_EMAIL_STEP_${job.step}_SUBJECT`];
  const templateName=env[`LEAD_WHATSAPP_STEP_${job.step}_TEMPLATE`];
  const maxCost=Number(job.channel==='email'?env.LEAD_EMAIL_MAX_COST_USD:env.LEAD_WHATSAPP_MAX_COST_USD);
  if(!env.LEAD_MESSAGE_CONTENT_VERSION||(job.channel==='email'?(!emailText||!emailSubject):!templateName)||!maxCost){
   await transaction(async c=>{await c.query('SELECT id FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[job.case_id]);
    await c.query("UPDATE lead_follow_up_cases SET state='needs_review',updated_at=NOW() WHERE id=$1 AND state='ready'",[job.case_id]);
    await c.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE case_id=$1 AND state IN ('waiting','queued','claimed')",[job.case_id]);
    await c.query("UPDATE tasks SET subject='Configure approved message content and cost',updated_at=NOW() WHERE id=(SELECT next_action_task_id FROM lead_follow_up_cases WHERE id=$1)",[job.case_id]);
   });review++;continue;
  }
  let reservation;
  try{reservation=await transaction(c=>reserveMessageBudget({jobId:job.id,leaseToken:job.lease_token,maxCostUsd:maxCost},c));}
  catch{
   await transaction(async c=>{
    await c.query('SELECT id FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[job.case_id]);
    await c.query("UPDATE lead_follow_up_cases SET state='needs_review',updated_at=NOW() WHERE id=$1 AND state='ready'",[job.case_id]);
    await c.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE id=$1 AND state='claimed'",[job.id]);
    await c.query("UPDATE tasks SET subject='Review message eligibility or daily budget',updated_at=NOW() WHERE id=(SELECT next_action_task_id FROM lead_follow_up_cases WHERE id=$1)",[job.case_id]);
   });review++;continue;
  }
  if(reservation.duplicate)continue;
  await transaction(async c=>{
   const state=(await c.query(`SELECT fc.*,ct.email,ct.phone,ct.do_not_contact,l.assigned_to FROM lead_follow_up_cases fc JOIN leads l ON l.id=fc.lead_id
     JOIN contacts ct ON ct.id=l.contact_id WHERE fc.id=$1 FOR UPDATE OF fc,l,ct`,[job.case_id])).rows[0];
   const control=(await c.query('SELECT paused FROM lead_integration_setup WHERE singleton=TRUE FOR SHARE')).rows[0];
   const lease=(await c.query('SELECT * FROM lead_follow_up_jobs WHERE id=$1 FOR UPDATE',[job.id])).rows[0];
   if(control?.paused!==false||state.state!=='ready'||state.generation!==job.generation||state.do_not_contact||state.assigned_to||lease.state!=='claimed'||new Date(lease.lease_expires_at)<=new Date()){
    await recordMessageSubmission({attemptId:reservation.attempt.id,outcome:'cancelled'},c);return;
   }
   try{
    const result=job.channel==='email'?await emailSend({to:state.email,subject:emailSubject,text:emailText,attemptRef:reservation.attempt.id},{env}):
     await whatsappSend({to:state.phone,templateName,language:env.LEAD_WHATSAPP_LANGUAGE||'en',parameters:[]},{env});
    await recordMessageSubmission({attemptId:reservation.attempt.id,outcome:'accepted',providerRef:result.providerRef},c);submitted++;
   }catch{
    // Submission may have crossed the external boundary: never assume failure means unsent.
    await recordMessageSubmission({attemptId:reservation.attempt.id,outcome:'outcome_unknown'},c);
    await c.query("UPDATE lead_follow_up_cases SET state='outcome_unknown',generation=generation+1,updated_at=NOW() WHERE id=$1",[state.id]);
    await c.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE case_id=$1 AND state IN ('queued','waiting')",[state.id]);
    await c.query("UPDATE tasks SET subject='Reconcile provider submission',priority='urgent',updated_at=NOW() WHERE id=$1",[state.next_action_task_id]);review++;
   }
  });
 }
 return {status:'processed',submitted,review};
}
