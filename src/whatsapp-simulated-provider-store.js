import {audit,execute,many,one,transaction,uuid} from './db.js';
import {classifyWhatsAppSuppression} from './whatsapp-campaign-domain.js';
import {assertSyntheticWhatsAppPhone,simulatedPayloadHash} from './whatsapp-simulated-provider.js';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

async function recordEvent(payload,{eventType,direction,outcome='processed',diagnosticCode=null,entityType=null,entityId=null,actorId=null,runId=null,client}){
  const providerEventId=clean(payload.id||payload.provider_event_id||payload.correlation_id,200);
  if(!providerEventId)throw Object.assign(new Error('Simulated provider event id is required'),{statusCode:400});
  const inserted=await one(`INSERT INTO wa_simulated_provider_events(
    id,provider_event_id,simulation_run_id,event_type,direction,payload_hash,outcome,diagnostic_code,related_entity_type,related_entity_id,actor_id,occurred_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz,NOW()))
    ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`,[
      uuid(),providerEventId,runId||payload.simulation_run_id||null,eventType,direction,simulatedPayloadHash(payload),outcome,diagnosticCode,entityType,entityId,actorId||payload.actor_id||null,payload.occurred_at||null
    ],client);
  return {duplicate:!inserted,providerEventId,eventId:inserted?.id};
}

async function validateOwner(payload,client){
  const team=await one('SELECT id,name FROM teams WHERE id=$1 AND active=1',[payload.team_id],client);
  if(!team)throw Object.assign(new Error('Select an active team for the simulated inbound message'),{statusCode:409});
  let agent=null;
  if(payload.agent_id){
    agent=await one(`SELECT b.id,b.name FROM brokers b WHERE b.id=$1 AND b.status='active' AND b.job_role='sales_agent'
      AND (b.team_id=$2 OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=$2 AND tm.broker_id=b.id AND tm.ends_at IS NULL)
      OR EXISTS(SELECT 1 FROM user_role_assignments ur WHERE ur.team_id=$2 AND ur.broker_id=b.id AND ur.status='active' AND ur.ends_at IS NULL))`,[payload.agent_id,team.id],client);
    if(!agent)throw Object.assign(new Error('Simulated owner Agent is not active in the selected team'),{statusCode:409});
  }
  const actor=await one("SELECT id FROM brokers WHERE id=$1 AND status='active'",[payload.actor_id],client);
  if(!actor)throw Object.assign(new Error('Simulated event actor is unavailable'),{statusCode:409});
  return {team,agent,actor};
}

async function applySuppression(phone,text,evidenceReference,actorId,client){
  const suppressionType=classifyWhatsAppSuppression(text);
  if(!suppressionType)return null;
  await execute(`INSERT INTO wa_contact_suppressions(normalized_phone,suppression_type,evidence_reference,recorded_by)
    VALUES($1,$2,$3,$4) ON CONFLICT(normalized_phone) DO UPDATE SET suppression_type=EXCLUDED.suppression_type,
    evidence_reference=EXCLUDED.evidence_reference,recorded_by=EXCLUDED.recorded_by,recorded_at=NOW(),audit_expires_at=NOW()+INTERVAL '12 months'`,[phone,suppressionType,evidenceReference,actorId],client);
  await execute(`UPDATE wa_campaign_recipients SET suppression_status='suppressed',suppressed_at=NOW(),suppression_reason=$2,
    consent_status=CASE WHEN $2='opt_out' THEN 'withdrawn' ELSE 'denied' END WHERE normalized_phone=$1`,[phone,suppressionType],client);
  await execute(`UPDATE wa_campaign_approval_recipients SET removed_at=COALESCE(removed_at,NOW()),removal_reason=COALESCE(removal_reason,$2)
    WHERE normalized_phone=$1`,[phone,suppressionType],client);
  return suppressionType;
}

export async function ingestSimulatedInbound(payload,{client:providedClient}={}){
  const work=async client=>{
    const phone=assertSyntheticWhatsAppPhone(payload.from),owner=await validateOwner(payload,client);
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`wa-simulation:${phone}`],client);
    const recorded=await recordEvent(payload,{eventType:'inbound_message',direction:'stub_to_core',actorId:owner.actor.id,runId:payload.simulation_run_id,client});
    if(recorded.duplicate)return {duplicate:true,providerEventId:recorded.providerEventId};
    let conversation=await one('SELECT * FROM wa_conversations WHERE normalized_phone=$1 AND simulated=TRUE AND simulation_run_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 1',[phone,payload.simulation_run_id||null],client);
    let contactId=conversation?.contactId||null,leadId=conversation?.leadId||null;
    if(!conversation){
      contactId=uuid();
      await execute(`INSERT INTO contacts(id,full_name,phone,contact_type,preferred_channel,owner_id,created_by,notes)
        VALUES($1,$2,$3,'buyer','WhatsApp',$4,$5,'DEV262 synthetic WhatsApp simulation record')`,[contactId,clean(payload.name,160)||'Synthetic WhatsApp Prospect',phone,owner.agent?.id||null,owner.actor.id],client);
      leadId=uuid();
      await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,assigned_team_id,assigned_to,created_by)
        VALUES($1,$2,$3,'WhatsApp','Sale',$4,$5,$6)`,[leadId,contactId,`Synthetic WhatsApp enquiry ${phone.slice(-4)}`,owner.team.id,owner.agent?.id||null,owner.actor.id],client);
      conversation=await one(`INSERT INTO wa_conversations(id,conversation_reference,normalized_phone,display_name,source_type,source_reference,
        contact_id,lead_id,owner_team_id,owner_agent_id,last_customer_message_at,ctwa_entry_at,last_activity_at,simulated,simulation_run_id,simulation_seed)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,TRUE,$13,$14) RETURNING *`,[
          uuid(),`WA-SIM-${uuid().slice(0,8).toUpperCase()}`,phone,clean(payload.name,160)||'Synthetic WhatsApp Prospect',
          payload.source_type||'other',payload.ctwa_referral?.source_url||'DEV262 simulator',contactId,leadId,owner.team.id,owner.agent?.id||null,
          payload.occurred_at||new Date().toISOString(),payload.ctwa_referral?payload.occurred_at||new Date().toISOString():null,payload.simulation_run_id||null,payload.seed||null
        ],client);
    }
    const messageType=payload.media?.type||'text';
    const body=payload.button?.text||payload.text||payload.media?.caption||`[${messageType}]`;
    const message=await one(`INSERT INTO wa_conversation_messages(id,conversation_id,direction,message_type,body,occurred_at,retention_expires_at,
      simulated,provider_message_id,provider_status,provider_status_at,provider_payload_hash)
      VALUES($1,$2,'inbound',$3,$4,$5,$5::timestamptz+INTERVAL '12 months',TRUE,$6,'delivered',$5,$7) RETURNING *`,[
        uuid(),conversation.id,messageType,clean(body,4096),payload.occurred_at||new Date().toISOString(),recorded.providerEventId,simulatedPayloadHash(payload)
      ],client);
    await execute(`UPDATE wa_conversations SET last_customer_message_at=$1,last_activity_at=$1,ctwa_entry_at=COALESCE(ctwa_entry_at,$2),updated_at=NOW()
      WHERE id=$3`,[message.occurredAt,payload.ctwa_referral?message.occurredAt:null,conversation.id],client);
    if(owner.agent)await execute(`INSERT INTO wa_inbox_notifications(id,conversation_id,broker_id,notification_type) VALUES($1,$2,$3,'new_message')`,[uuid(),conversation.id,owner.agent.id],client);
    const suppressionType=await applySuppression(phone,body,`SIM-${recorded.providerEventId}`,owner.actor.id,client);
    if(suppressionType)await execute('UPDATE contacts SET do_not_contact=1,contact_restriction_reason=$1,updated_at=NOW() WHERE id=$2',[`Simulated WhatsApp ${suppressionType}`,contactId],client);
    await audit('WhatsAppConversation',conversation.id,'simulated_inbound_received',owner.actor.id,{providerEventId:recorded.providerEventId,messageId:message.id,simulation:true,suppressionType,ctwa:Boolean(payload.ctwa_referral)},client);
    return {duplicate:false,conversationId:conversation.id,messageId:message.id,leadId,contactId,suppressionType,providerEventId:recorded.providerEventId};
  };
  return providedClient?work(providedClient):transaction(work);
}

export async function applySimulatedMessageStatus(payload,{client:providedClient}={}){
  const work=async client=>{
    const recorded=await recordEvent(payload,{eventType:'message_status',direction:'stub_to_core',actorId:payload.actor_id,runId:payload.simulation_run_id,client});
    if(recorded.duplicate)return {duplicate:true};
    const status=clean(payload.status,20);
    if(!['sent','delivered','read','failed'].includes(status))throw Object.assign(new Error('Unsupported simulated message status'),{statusCode:400});
    const message=await one(`UPDATE wa_conversation_messages SET provider_status=$1,provider_status_at=COALESCE($2::timestamptz,NOW())
      WHERE provider_message_id=$3 AND simulated=TRUE RETURNING *`,[status,payload.occurred_at||null,payload.message_id],client);
    if(!message)throw Object.assign(new Error('Simulated provider message was not found'),{statusCode:404});
    await execute(`UPDATE wa_campaign_approval_recipients SET simulated_status=$1,simulated_status_at=COALESCE($2::timestamptz,NOW()),
      simulated_last_error=CASE WHEN $1='failed' THEN COALESCE($4,'SIMULATED_PROVIDER_FAILURE') ELSE NULL END
      WHERE simulated_provider_message_id=$3`,[status,payload.occurred_at||null,payload.message_id,clean(payload.error_code,120)||null],client);
    return {duplicate:false,messageId:message.id,status};
  };
  return providedClient?work(providedClient):transaction(work);
}

export async function applySimulatedTemplateStatus(payload,{client:providedClient}={}){
  const work=async client=>{
    const recorded=await recordEvent(payload,{eventType:'template_status',direction:'stub_to_core',actorId:payload.actor_id,client});
    if(recorded.duplicate)return {duplicate:true};
    const status=clean(payload.status,20);
    if(!['pending','approved','rejected','paused'].includes(status))throw Object.assign(new Error('Unsupported simulated template status'),{statusCode:400});
    const reason=status==='rejected'?clean(payload.reason,500)||'Rejected by simulated provider rule':null;
    const version=await one(`UPDATE wa_message_template_versions SET simulated_provider_status=$1,simulated_provider_status_at=COALESCE($2::timestamptz,NOW()),simulated_provider_reason=$4,updated_at=NOW()
      WHERE id=$3 RETURNING id,template_id,simulated_provider_status,simulated_provider_reason`,[status,payload.occurred_at||null,payload.template_version_id,reason],client);
    if(!version)throw Object.assign(new Error('Template version was not found'),{statusCode:404});
    return {duplicate:false,templateVersionId:version.id,status};
  };
  return providedClient?work(providedClient):transaction(work);
}

export async function ensureSimulatedCampaignConversation({phone,displayName,teamId,actorId,campaignId,sourceType='other'}){
  return transaction(async client=>{
    const normalized=assertSyntheticWhatsAppPhone(phone);
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`wa-simulation:${normalized}`],client);
    const existing=await one('SELECT * FROM wa_conversations WHERE normalized_phone=$1 AND simulated=TRUE AND simulation_run_id IS NULL ORDER BY created_at DESC LIMIT 1',[normalized],client);
    if(existing)return existing;
    const team=await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId],client);
    if(!team)throw Object.assign(new Error('Campaign team is unavailable for simulated delivery'),{statusCode:409});
    const agent=await one(`SELECT DISTINCT b.id FROM brokers b WHERE b.status='active' AND b.job_role='sales_agent' AND
      (b.team_id=$1 OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=$1 AND tm.broker_id=b.id AND tm.ends_at IS NULL)
      OR EXISTS(SELECT 1 FROM user_role_assignments ur WHERE ur.team_id=$1 AND ur.broker_id=b.id AND ur.status='active' AND ur.ends_at IS NULL))
      ORDER BY b.id LIMIT 1`,[teamId],client);
    if(!agent)throw Object.assign(new Error('Campaign team has no active Sales Agent for simulated inbox ownership'),{statusCode:409});
    const contactId=uuid(),leadId=uuid(),conversationId=uuid(),safeSource=sourceType==='purchased_list'?'purchased_list':'other';
    await execute(`INSERT INTO contacts(id,full_name,phone,contact_type,preferred_channel,owner_id,created_by,notes)
      VALUES($1,$2,$3,'buyer','WhatsApp',$4,$5,'DEV262 synthetic campaign simulation record')`,[contactId,clean(displayName,160)||'Synthetic Campaign Recipient',normalized,agent.id,actorId],client);
    await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,assigned_team_id,assigned_to,created_by)
      VALUES($1,$2,$3,'WhatsApp','Sale',$4,$5,$6)`,[leadId,contactId,`Synthetic campaign recipient ${normalized.slice(-4)}`,teamId,agent.id,actorId],client);
    const conversation=await one(`INSERT INTO wa_conversations(id,conversation_reference,normalized_phone,display_name,source_type,source_reference,
      contact_id,lead_id,owner_team_id,owner_agent_id,last_activity_at,simulated)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),TRUE) RETURNING *`,[
        conversationId,`WA-SIM-${conversationId.slice(0,8).toUpperCase()}`,normalized,clean(displayName,160)||'Synthetic Campaign Recipient',safeSource,`SIM-CAMPAIGN-${campaignId}`,contactId,leadId,teamId,agent.id
      ],client);
    await audit('WhatsAppConversation',conversation.id,'simulated_campaign_conversation_created',actorId,{campaignId,simulation:true,leadId},client);
    return conversation;
  });
}

export async function recordSimulatedOutbound({providerMessageId,conversationId,templateVersionId=null,text,type='text',actorId,payload,runId=null},{client:providedClient,auditAccepted=true}={}){
  const work=async client=>{
    const conversation=await one('SELECT * FROM wa_conversations WHERE id=$1 AND simulated=TRUE FOR UPDATE',[conversationId],client);
    if(!conversation)throw Object.assign(new Error('Simulated conversation not found'),{statusCode:404});
    const eventPayload={...payload,id:`outbound:${providerMessageId}`};
    const recorded=await recordEvent(eventPayload,{eventType:'outbound_request',direction:'core_to_stub',actorId,runId,entityType:'conversation',entityId:conversationId,client});
    if(recorded.duplicate)return {duplicate:true,providerMessageId};
    const now=new Date().toISOString(),message=await one(`INSERT INTO wa_conversation_messages(id,conversation_id,direction,message_type,body,template_version_id,occurred_at,retention_expires_at,
      simulated,provider_message_id,provider_status,provider_status_at,provider_payload_hash)
      VALUES($1,$2,'outbound',$3,$4,$5,$6,$6::timestamptz+INTERVAL '12 months',TRUE,$7,'accepted',$6,$8) RETURNING *`,[
        uuid(),conversationId,type,clean(text,4096),templateVersionId,now,providerMessageId,simulatedPayloadHash(payload)
      ],client);
    await execute('UPDATE wa_conversations SET last_activity_at=$1,updated_at=NOW() WHERE id=$2',[now,conversationId],client);
    if(auditAccepted)await audit('WhatsAppConversation',conversationId,'simulated_outbound_accepted',actorId,{providerMessageId,messageId:message.id,simulation:true},client);
    return {duplicate:false,messageId:message.id,providerMessageId};
  };
  return providedClient?work(providedClient):transaction(work);
}

export async function cleanupSimulationRun(runId,actorId){
  return transaction(async client=>{
    const run=await one('SELECT * FROM wa_simulation_runs WHERE id=$1 FOR UPDATE',[runId],client);
    if(!run)throw Object.assign(new Error('Simulation run not found'),{statusCode:404});
    const conversations=await many('SELECT id,lead_id,contact_id FROM wa_conversations WHERE simulated=TRUE AND simulation_run_id=$1',[runId],client);
    const leadIds=conversations.map(item=>item.leadId).filter(Boolean),contactIds=conversations.map(item=>item.contactId).filter(Boolean);
    if(conversations.length)await execute('DELETE FROM wa_conversations WHERE id=ANY($1::uuid[])',[conversations.map(item=>item.id)],client);
    if(leadIds.length)await execute('DELETE FROM leads WHERE id=ANY($1::uuid[])',[leadIds],client);
    if(contactIds.length)await execute('DELETE FROM contacts WHERE id=ANY($1::uuid[])',[contactIds],client);
    await execute(`UPDATE wa_simulation_runs SET status='cleaned',cleaned_at=NOW(),result=result||$2::jsonb WHERE id=$1`,[runId,JSON.stringify({cleanedConversations:conversations.length,cleanedLeads:leadIds.length,cleanedContacts:contactIds.length})],client);
    await execute(`INSERT INTO wa_simulated_provider_events(id,provider_event_id,simulation_run_id,event_type,direction,payload_hash,outcome,actor_id)
      VALUES($1,$2,$3,'cleanup','internal',$4,'cleaned',$5)`,[uuid(),`cleanup:${runId}:${Date.now()}`,runId,simulatedPayloadHash({runId,conversations:conversations.length}),actorId],client);
    return {runId,conversations:conversations.length,leads:leadIds.length,contacts:contactIds.length};
  });
}

export async function cleanupAllSimulatedRecords(actorId){
  return transaction(async client=>{
    const conversations=await many('SELECT id,lead_id,contact_id FROM wa_conversations WHERE simulated=TRUE',[],client);
    const conversationIds=conversations.map(item=>item.id),leadIds=[...new Set(conversations.map(item=>item.leadId).filter(Boolean))],contactIds=[...new Set(conversations.map(item=>item.contactId).filter(Boolean))];
    const messages=conversationIds.length?await one('SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=ANY($1::uuid[])',[conversationIds],client):{count:0};
    if(conversationIds.length){
      await execute('DELETE FROM wa_conversation_assignment_history WHERE conversation_id=ANY($1::uuid[])',[conversationIds],client);
      await execute('UPDATE wa_campaign_approval_recipients SET simulated_conversation_id=NULL,simulated_provider_message_id=NULL,simulated_status=NULL,simulated_status_at=NULL,simulated_sent_at=NULL,simulated_last_error=NULL WHERE simulated_conversation_id=ANY($1::uuid[])',[conversationIds],client);
      await execute('DELETE FROM wa_conversations WHERE id=ANY($1::uuid[])',[conversationIds],client);
    }
    if(leadIds.length)await execute('DELETE FROM leads WHERE id=ANY($1::uuid[])',[leadIds],client);
    if(contactIds.length)await execute('DELETE FROM contacts WHERE id=ANY($1::uuid[])',[contactIds],client);
    const runs=await execute(`UPDATE wa_simulation_runs SET status='cleaned',cleaned_at=COALESCE(cleaned_at,NOW()),result=result||$1::jsonb WHERE status<>'cleaned'`,[JSON.stringify({cleanedByAllCommand:true})],client);
    const templates=await execute(`UPDATE wa_message_template_versions SET simulated_provider_status='not_submitted',simulated_provider_status_at=NULL,simulated_provider_reason=NULL WHERE simulated_provider_status<>'not_submitted'`,[],client);
    const result={conversations:conversationIds.length,messages:Number(messages.count||0),leads:leadIds.length,contacts:contactIds.length,runs:runs.rowCount,templatesReset:templates.rowCount,auditEventsRetained:true};
    await execute(`INSERT INTO wa_simulated_provider_events(id,provider_event_id,event_type,direction,payload_hash,outcome,actor_id)
      VALUES($1,$2,'cleanup','internal',$3,'cleaned',$4)`,[uuid(),`cleanup:all:${Date.now()}`,simulatedPayloadHash(result),actorId],client);
    return result;
  });
}
