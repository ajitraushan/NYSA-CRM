import {retrieveMetaLead,acceptRetrievedMetaLead} from './meta-lead-retrieval.js';
import {expireNonvoiceClaims} from './nonvoice-follow-up-store.js';
import {processLeadChannelInbox} from './routes/lead-channel-inbox.js';
import {prepareAiReply} from './nonvoice-ai-chat.js';
import {ensureResponseNextActions,purgeExpiredResponseEvidence,escalateOverdueHotResponses} from './nonvoice-recovery.js';
import {recoverWebsiteFollowUpCases} from './website-follow-up-intake.js';
export async function runNonvoiceCycle({transaction,env=process.env,fetchImpl=fetch}){
 const recovery=await transaction(c=>expireNonvoiceClaims(c));
 if(env.LEAD_RESPONSE_WORKER_ENABLED!=='true')return {recovery,intake:'disabled'};
 if(!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT))throw new Error('NONVOICE_ENVIRONMENT_NOT_APPROVED');
 await transaction(c=>ensureResponseNextActions(c));
 await transaction(c=>escalateOverdueHotResponses(c));
 await transaction(c=>purgeExpiredResponseEvidence(c));
 const setup=await transaction(async c=>(await c.query('SELECT draft FROM lead_integration_setup WHERE singleton=TRUE')).rows[0]?.draft);
 const websiteActorId=env.WEBSITE_INTAKE_ACTOR_ID||env.LEAD_INTAKE_ACTOR_ID;
 const websiteRecovery=websiteActorId
  ?await transaction(c=>recoverWebsiteFollowUpCases({actorId:websiteActorId},c))
  :{status:'actor_required',opened:0,existing:0,invalid:0};
 if(!env.LEAD_INTAKE_ACTOR_ID||!env.LEAD_EVIDENCE_KEY)return {recovery,websiteRecovery,intake:'setup_required'};
 if(setup?.fallbackOwnerId)await transaction(c=>c.query("UPDATE lead_source_inbox SET review_owner_id=$1,review_due_at=COALESCE(review_due_at,received_at+INTERVAL '2 minutes') WHERE state IN ('pending_retrieval','needs_review') AND review_owner_id IS NULL",[setup.fallbackOwnerId]));
 const events=await transaction(async c=>(await c.query("SELECT * FROM lead_source_inbox WHERE source_system='meta' AND state='pending_retrieval' AND next_attempt_at<=NOW() ORDER BY next_attempt_at,received_at LIMIT 5")).rows);
 let accepted=0,review=0;
 for(const event of events){
  try{
   const data=await retrieveMetaLead({eventId:event.source_event_id,formId:event.source_form_id},{accessToken:env.META_LEAD_ACCESS_TOKEN,graphVersion:env.META_GRAPH_VERSION,fetchImpl});
   const result=await transaction(c=>acceptRetrievedMetaLead({sourceId:event.id,data,mapping:setup,actorId:env.LEAD_INTAKE_ACTOR_ID,
    ownerId:setup?.fallbackOwnerId||null,evidenceKey:env.LEAD_EVIDENCE_KEY},c));
   if(['identity_review','mapping_review','duplicate_review'].includes(result.status))review++;else accepted++;
  }catch{
   // Keep source receipt recoverable. No token, form answers or provider errors reach logs.
   await transaction(c=>c.query("UPDATE lead_source_inbox SET error_code='RETRIEVAL_OR_MAPPING_REQUIRES_REVIEW',attempt_count=attempt_count+1,next_attempt_at=NOW()+make_interval(secs=>LEAST(900,30*POWER(2,LEAST(attempt_count,5)))::integer),state=CASE WHEN attempt_count>=9 THEN 'needs_review' ELSE state END WHERE id=$1 AND state='pending_retrieval'",[event.id]));review++;
  }
 }
 if(setup?.fallbackOwnerId)await transaction(c=>c.query("UPDATE lead_response_provider_inbox SET review_owner_id=$1,review_due_at=COALESCE(review_due_at,received_at+INTERVAL '10 minutes') WHERE state IN ('received','needs_review') AND review_owner_id IS NULL",[setup.fallbackOwnerId]));
 const inbox=await transaction(async c=>(await c.query("SELECT id FROM lead_response_provider_inbox WHERE state='received' ORDER BY received_at LIMIT 20")).rows);
 for(const event of inbox){
  await transaction(c=>processLeadChannelInbox({id:event.id,evidenceKey:env.LEAD_EVIDENCE_KEY},c));
  await prepareAiReply({inboxId:event.id,evidenceKey:env.LEAD_EVIDENCE_KEY,aiEnabled:env.LEAD_AI_CHAT_ENABLED==='true',maxCostUsd:Number(env.LEAD_AI_REPLY_MAX_COST_USD),transaction});
 }
 return {recovery,websiteRecovery,accepted,review,inboundProcessed:inbox.length,liveSendingEnabled:false};
}
