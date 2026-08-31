import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { canOperateLead,canReadLead,canWriteOpportunity } from '../crm-policy.js';
import { savePrivate,removePrivate } from '../private-files.js';
import {
  stableHash,validateEmailDraft,validateEmailSend,emailAttemptFingerprint,
  validateCalendlyHostMapping,validateCalendlyEventTypeMapping,validateSchedulingIntent,
  validateCalendlyEvent,planCalendlyProjection,evaluateViewingConfirmation
} from '../email-calendly-domain.js';

const r=Router(),clean=value=>typeof value==='string'?value.trim():'';
const fullAdmin=broker=>broker?.role==='admin'&&broker?.jobRole==='admin';
const enabled=name=>process.env[name]==='1';
const configured=names=>names.every(name=>Boolean(process.env[name]));
const emailConfigured=()=>configured(['MICROSOFT365_TENANT_ID','MICROSOFT365_CLIENT_ID','MICROSOFT365_CLIENT_SECRET','MICROSOFT365_REDIRECT_URI','MICROSOFT365_WEBHOOK_CLIENT_STATE_SECRET','INTEGRATION_ENCRYPTION_KEY','INTEGRATION_SERVICE_ACTOR_ID']);
const calendlyConfigured=()=>configured(['CALENDLY_CLIENT_ID','CALENDLY_CLIENT_SECRET','CALENDLY_REDIRECT_URI','CALENDLY_WEBHOOK_SIGNING_KEY','INTEGRATION_ENCRYPTION_KEY','INTEGRATION_SERVICE_ACTOR_ID']);
const digest=value=>crypto.createHash('sha256').update(String(value||'')).digest('hex');
const safeEqual=(left,right)=>{const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);};

function calendlySignatureValid(req){
  const secret=process.env.CALENDLY_WEBHOOK_SIGNING_KEY,header=clean(req.headers['calendly-webhook-signature']);
  if(!secret||!header||!req.rawBody)return false;
  const parts=Object.fromEntries(header.split(',').map(item=>item.trim().split('='))),timestamp=parts.t,signature=parts.v1;
  if(!timestamp||!signature||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
  return safeEqual(crypto.createHmac('sha256',secret).update(`${timestamp}.${req.rawBody}`).digest('hex'),signature);
}

// Microsoft validates the public notification URL with a short-lived validation token.
r.post('/webhooks/microsoft-graph/mail',async(req,res)=>{
  if(req.query.validationToken){res.setHeader('Content-Type','text/plain');return res.end(String(req.query.validationToken).slice(0,2048));}
  if(!emailConfigured()||!enabled('MICROSOFT365_EMAIL_ENABLED'))return res.status(503).json({error:'Microsoft 365 Email connector is disabled'});
  const notifications=Array.isArray(req.body?.value)?req.body.value:[];
  for(const event of notifications){
    const subscriptionRef=clean(event.subscriptionId),resourceRef=clean(event.resource),clientState=clean(event.clientState);
    const lease=await one("SELECT l.*,c.id AS mailbox_connection_id FROM microsoft365_subscription_leases l JOIN microsoft365_mailbox_connections c ON c.id=l.mailbox_connection_id AND c.status='active' WHERE l.subscription_ref=$1 AND l.status IN('active','renewal_due')",[subscriptionRef]);
    if(!lease||!safeEqual(digest(clientState),lease.clientStateDigest))continue;
    const providerEventRef=stableHash({subscriptionRef,resourceRef,changeType:clean(event.changeType),sequence:clean(event.sequenceNumber)});
    const eventId=uuid(),inserted=await one(`INSERT INTO email_provider_events(id,mailbox_connection_id,subscription_ref,provider_event_ref,resource_ref,client_state_digest,received_at)
      VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(mailbox_connection_id,provider_event_ref) DO NOTHING RETURNING id`,[eventId,lease.mailboxConnectionId,subscriptionRef,providerEventRef,resourceRef,lease.clientStateDigest]);
    if(inserted)await execute("INSERT INTO email_provider_event_processing(id,provider_event_id,sequence,state,processed_by) VALUES($1,$2,1,'received',$3)",[uuid(),inserted.id,process.env.INTEGRATION_SERVICE_ACTOR_ID]);
  }
  res.status(202).json({accepted:true});
});

r.post('/webhooks/calendly',async(req,res)=>{
  if(!calendlyConfigured()||!enabled('CALENDLY_ENABLED'))return res.status(503).json({error:'Calendly connector is disabled'});
  if(!calendlySignatureValid(req))return res.status(401).json({error:'Calendly webhook signature is invalid'});
  const connection=await one("SELECT * FROM calendly_connections WHERE status='active'");
  if(!connection)return res.status(409).json({error:'Calendly organization is not connected'});
  const payload=req.body?.payload||{},eventFamily=clean(req.body?.event),eventRef=clean(payload.event||payload.scheduled_event?.uri),inviteeRef=clean(payload.invitee||payload.uri),providerEventRef=clean(req.headers['calendly-webhook-id'])||stableHash({eventFamily,eventRef,inviteeRef,createdAt:req.body?.created_at}),payloadDigest=digest(req.rawBody);
  const checked=validateCalendlyEvent({eventFamily,eventRef,inviteeRef,providerEventRef,occurredAt:req.body?.created_at||new Date().toISOString(),receivedAt:new Date().toISOString(),payloadDigest,signatureVerified:true,replayDetected:false});
  if(checked.error)return res.status(400).json({error:checked.error});
  const serviceActor=clean(process.env.INTEGRATION_SERVICE_ACTOR_ID),eventId=uuid();
  await transaction(async client=>{
    const inserted=await one(`INSERT INTO calendly_provider_events(id,calendly_connection_id,provider_event_ref,event_family,event_ref,invitee_ref,occurred_at,received_at,signature_verified,payload_digest,restricted_raw_event_ref)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10) ON CONFLICT(calendly_connection_id,provider_event_ref) DO NOTHING RETURNING *`,[eventId,connection.id,checked.value.providerEventRef,checked.value.eventFamily,checked.value.eventRef,checked.value.inviteeRef,checked.value.occurredAt,checked.value.receivedAt,checked.value.payloadDigest,`not-retained://${eventId}`],client);
    if(inserted)await execute("INSERT INTO calendly_provider_event_processing(id,provider_event_id,sequence,state,processed_by) VALUES($1,$2,1,'received',$3)",[uuid(),inserted.id,serviceActor],client);
  });
  res.status(202).json({accepted:true});
});

r.use(requireAuth);

r.get('/integrations/microsoft365-email/status',async(req,res)=>{
  if(!emailConfigured()||!enabled('MICROSOFT365_EMAIL_ENABLED'))return res.json({configured:emailConfigured(),enabled:false,connection:null,leases:[],mailboxScope:'own_mailbox_only'});
  const connection=await one('SELECT id,status,granted_scopes,connected_at,updated_at FROM microsoft365_mailbox_connections WHERE broker_id=$1 ORDER BY connected_at DESC LIMIT 1',[req.broker.id]);
  const leases=connection?await many('SELECT folder_scope,status,expires_at,last_renewed_at,last_error_code FROM microsoft365_subscription_leases WHERE mailbox_connection_id=$1 ORDER BY folder_scope',[connection.id]):[];
  res.json({configured:emailConfigured(),enabled:enabled('MICROSOFT365_EMAIL_ENABLED'),connection,leases,mailboxScope:'own_mailbox_only'});
});

r.get('/integrations/microsoft365-email/connect',async(req,res)=>{
  if(!emailConfigured()||!enabled('MICROSOFT365_EMAIL_ENABLED'))return res.status(503).json({error:'Microsoft 365 Email is disabled until provider-sandbox authorization'});
  return res.status(501).json({error:'Provider OAuth registration is a separately authorized sandbox activity'});
});

r.post('/integrations/microsoft365-email/disconnect',async(req,res)=>{
  const reason=clean(req.body?.reason);if(reason.length<5)return res.status(400).json({error:'A meaningful disconnect reason is required'});
  const row=await one("UPDATE microsoft365_mailbox_connections SET status='disconnected',disconnected_by=$1,disconnected_at=NOW(),disconnect_reason=$2,encrypted_refresh_token='revoked',updated_at=NOW() WHERE broker_id=$1 AND status<>'disconnected' RETURNING id,status,disconnected_at",[req.broker.id,reason]);
  if(!row)return res.status(404).json({error:'Active mailbox connection not found'});await audit('Broker',req.broker.id,'microsoft365_mailbox_disconnected',req.broker.id,{connectionId:row.id,reason});res.json(row);
});

async function leadContext(req,leadId,write=false,client){
  const lead=await one(`SELECT l.*,c.email AS contact_email,c.updated_at AS contact_updated_at,c.archived_at AS contact_archived_at
    FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE l.id=$1`,[leadId],client);
  if(!lead)return null;const allowed=write?canOperateLead(req.broker,lead):canReadLead(req.broker,lead);return allowed?lead:false;
}

r.get('/crm/leads/:leadId/emails',async(req,res)=>{
  const lead=await leadContext(req,req.params.leadId);if(lead===null)return res.status(404).json({error:'Lead not found'});if(lead===false)return res.status(403).json({error:'Lead is outside your scope'});
  const rows=await many(`SELECT e.id,e.attempt_reference,e.direction,e.purpose,e.initial_state,e.provider_occurred_at,e.created_at,e.activity_id,t.thread_reference,t.status AS thread_status
    FROM email_message_evidence e JOIN email_threads t ON t.id=e.thread_id WHERE t.lead_id=$1 ORDER BY e.created_at DESC`,[lead.id]);res.json({emails:rows});
});

r.post('/crm/leads/:leadId/email-drafts',async(req,res)=>{
  const lead=await leadContext(req,req.params.leadId,true);if(lead===null)return res.status(404).json({error:'Lead not found'});if(lead===false)return res.status(403).json({error:'Lead is outside your writable scope'});
  if(!lead.contactEmail||lead.contactArchivedAt)return res.status(409).json({error:'Maintain an active Customer email before preparing Email'});
  const mailbox=await one("SELECT * FROM microsoft365_mailbox_connections WHERE broker_id=$1 AND status='active'",[req.broker.id]);if(!mailbox)return res.status(409).json({error:'Connect your own Microsoft 365 mailbox before preparing Email'});
  const contactAuthorityHash=stableHash({contactId:lead.contactId,email:lead.contactEmail.toLowerCase(),updatedAt:new Date(lead.contactUpdatedAt).toISOString()}),checked=validateEmailDraft({...req.body,leadId:lead.id,contactId:lead.contactId,mailboxConnectionId:mailbox.id,contactAuthorityHash});
  if(checked.error)return res.status(400).json({error:checked.error});
  const payload=Buffer.from(JSON.stringify({subject:checked.value.subject,body:checked.value.body})),payloadDigest=digest(payload),key=await savePrivate(payload,'.email.json');
  try{const result=await transaction(async client=>{
    let thread=await one('SELECT * FROM email_threads WHERE mailbox_connection_id=$1 AND lead_id=$2 AND contact_id=$3 AND opportunity_id IS NOT DISTINCT FROM $4 AND status=$5 FOR UPDATE',[mailbox.id,lead.id,lead.contactId,checked.value.opportunityId,'active'],client);
    if(!thread)thread=await one(`INSERT INTO email_threads(id,thread_reference,mailbox_connection_id,lead_id,opportunity_id,contact_id,owner_id,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,'active',$7) RETURNING *`,[uuid(),`EMT-${Date.now()}-${lead.id.slice(0,8)}`,mailbox.id,lead.id,checked.value.opportunityId,lead.contactId,req.broker.id],client);
    const draft=await one(`INSERT INTO email_drafts(id,thread_id,purpose,contact_authority_hash,template_version_id,restricted_payload_ref,payload_digest,sender_digest,recipient_digest,status,version,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',1,$10) RETURNING id,thread_id,purpose,status,version,payload_digest,created_at`,[uuid(),thread.id,checked.value.purpose,contactAuthorityHash,checked.value.templateVersionId,key,payloadDigest,digest(req.broker.email),digest(lead.contactEmail.toLowerCase()),req.broker.id],client);
    await audit('Activity',draft.id,'email_draft_created',req.broker.id,{leadId:lead.id,threadReference:thread.threadReference,purpose:draft.purpose,payloadDigest},client);return{draft,threadReference:thread.threadReference};});res.status(201).json(result);
  }catch(error){await removePrivate(key);throw error;}
});

r.post('/crm/leads/:leadId/email-drafts/:draftId/send',async(req,res)=>{
  const checked=validateEmailSend({...req.body,idempotencyKey:clean(req.headers['x-idempotency-key'])||req.body?.idempotencyKey});if(checked.error)return res.status(400).json({error:checked.error});
  const result=await transaction(async client=>{
    const prior=await one('SELECT * FROM email_message_evidence WHERE idempotency_key=$1',[checked.value.idempotencyKey],client);if(prior)return{message:prior,replayed:true};
    const draft=await one(`SELECT d.*,t.lead_id,t.contact_id,t.owner_id,t.thread_reference,t.mailbox_connection_id,c.email AS contact_email,c.updated_at AS contact_updated_at,c.archived_at AS contact_archived_at
      FROM email_drafts d JOIN email_threads t ON t.id=d.thread_id JOIN contacts c ON c.id=t.contact_id WHERE d.id=$1 AND t.lead_id=$2 FOR UPDATE`,[req.params.draftId,req.params.leadId],client);
    if(!draft)return{code:404,error:'Email draft not found'};if(draft.ownerId!==req.broker.id)return{code:403,error:'Only the mailbox owner may send this Email'};
    if(draft.status!=='draft'||Number(draft.version)!==checked.value.draftVersion)return{code:409,error:'Email draft changed; review it again'};
    const authority=stableHash({contactId:draft.contactId,email:clean(draft.contactEmail).toLowerCase(),updatedAt:new Date(draft.contactUpdatedAt).toISOString()});if(draft.contactArchivedAt||authority!==draft.contactAuthorityHash)return{code:409,error:'Customer Email authority changed; prepare a new draft'};
    const messageId=uuid(),attemptReference=`EMA-${Date.now()}-${messageId.slice(0,8)}`,fingerprint=emailAttemptFingerprint({threadId:draft.threadId,draftVersion:draft.version,contactAuthorityHash:authority,payloadDigest:draft.payloadDigest,idempotencyKey:checked.value.idempotencyKey});
    await execute("UPDATE email_drafts SET status='confirmed',confirmed_at=NOW(),updated_at=NOW() WHERE id=$1",[draft.id],client);
    const message=await one(`INSERT INTO email_message_evidence(id,thread_id,attempt_reference,direction,purpose,initial_state,draft_id,draft_version,contact_authority_hash,template_version_id,restricted_payload_ref,payload_digest,sender_digest,recipient_digest,idempotency_key,confirmed_by,confirmed_at,created_by)
      VALUES($1,$2,$3,'outbound',$4,'confirmed',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$14) RETURNING *`,[messageId,draft.threadId,attemptReference,draft.purpose,draft.id,draft.version,authority,draft.templateVersionId,draft.restrictedPayloadRef,draft.payloadDigest,draft.senderDigest,draft.recipientDigest,checked.value.idempotencyKey,req.broker.id],client);
    await execute("INSERT INTO email_message_state_events(id,message_evidence_id,sequence,from_state,to_state,event_type,controlled_reason_code,performed_by) VALUES($1,$2,1,'confirmed','queued','queue','staff_confirmed',$3)",[uuid(),message.id,req.broker.id],client);
    await execute("INSERT INTO email_outbox(id,message_evidence_id,dispatch_generation,state,last_reason_code) VALUES($1,$2,1,'pending',$3)",[uuid(),message.id,fingerprint],client);
    await audit('Activity',message.id,'email_queued',req.broker.id,{leadId:draft.leadId,threadReference:draft.threadReference,attemptReference,payloadDigest:draft.payloadDigest},client);return{message:{id:message.id,attemptReference,state:'queued',createdAt:message.createdAt},replayed:false};
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(result.replayed?200:202).json(result);
});

r.get('/integrations/calendly/status',async(req,res)=>{if(!calendlyConfigured()||!enabled('CALENDLY_ENABLED'))return res.json({configured:calendlyConfigured(),enabled:false,connection:null,host:null,eventTypes:[]});const connection=await one("SELECT id,status FROM calendly_connections WHERE status='active' ORDER BY connected_at DESC LIMIT 1"),host=connection?await one("SELECT id,version,status FROM calendly_host_mappings WHERE calendly_connection_id=$1 AND broker_id=$2 AND status='active'",[connection.id,req.broker.id]):null,eventTypes=connection?await many("SELECT id,mapping_version,kind,duration_minutes,location_mode FROM calendly_event_type_mappings WHERE calendly_connection_id=$1 AND status='active' ORDER BY kind,duration_minutes",[connection.id]):[];res.json({configured:true,enabled:true,connection,host,eventTypes});});
r.get('/admin/integrations/calendly/status',async(req,res)=>{if(!fullAdmin(req.broker)&&req.broker.jobRole!=='director')return res.status(403).json({error:'Administrator or Director access required'});if(!calendlyConfigured()||!enabled('CALENDLY_ENABLED'))return res.json({configured:calendlyConfigured(),enabled:false,connection:null,hosts:[],eventTypes:[]});const connection=await one('SELECT id,status,granted_scopes,webhook_status,connected_at,updated_at FROM calendly_connections ORDER BY connected_at DESC LIMIT 1'),hosts=connection?await many("SELECT id,broker_id,version,status,effective_from FROM calendly_host_mappings WHERE calendly_connection_id=$1 ORDER BY created_at DESC",[connection.id]):[],eventTypes=connection?await many("SELECT id,mapping_version,kind,duration_minutes,location_mode,status,effective_from FROM calendly_event_type_mappings WHERE calendly_connection_id=$1 ORDER BY created_at DESC",[connection.id]):[];res.json({configured:true,enabled:true,connection,hosts,eventTypes});});
r.get('/admin/integrations/calendly/connect',async(req,res)=>{if(!fullAdmin(req.broker))return res.status(403).json({error:'Full Administrator access required'});if(!calendlyConfigured()||!enabled('CALENDLY_ENABLED'))return res.status(503).json({error:'Calendly is disabled until provider-sandbox authorization'});res.status(501).json({error:'Provider OAuth registration is a separately authorized sandbox activity'});});
r.post('/admin/integrations/calendly/host-mappings',async(req,res)=>{if(!fullAdmin(req.broker))return res.status(403).json({error:'Full Administrator access required'});const checked=validateCalendlyHostMapping(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});const connection=await one("SELECT id FROM calendly_connections WHERE status='active'");if(!connection)return res.status(409).json({error:'Calendly organization is not connected'});const broker=await one("SELECT id FROM brokers WHERE id=$1 AND status='active'",[checked.value.brokerId]);if(!broker)return res.status(409).json({error:'Select an active CRM user'});const version=await one('SELECT COALESCE(MAX(version),0)::int AS n FROM calendly_host_mappings WHERE calendly_connection_id=$1 AND calendly_user_ref=$2',[connection.id,checked.value.calendlyUserRef]);await execute("UPDATE calendly_host_mappings SET status='retired',effective_until=NOW() WHERE calendly_connection_id=$1 AND (calendly_user_ref=$2 OR broker_id=$3) AND status='active'",[connection.id,checked.value.calendlyUserRef,broker.id]);const row=await one(`INSERT INTO calendly_host_mappings(id,calendly_connection_id,calendly_user_ref,broker_id,version,status,reason,created_by) VALUES($1,$2,$3,$4,$5,'active',$6,$7) RETURNING *`,[uuid(),connection.id,checked.value.calendlyUserRef,broker.id,Number(version.n)+1,checked.value.reason,req.broker.id]);await audit('CalendarConnection',connection.id,'calendly_host_mapped',req.broker.id,{brokerId:broker.id,version:row.version,reason:row.reason});res.status(201).json(row);});
r.post('/admin/integrations/calendly/event-type-mappings',async(req,res)=>{if(!fullAdmin(req.broker))return res.status(403).json({error:'Full Administrator access required'});const checked=validateCalendlyEventTypeMapping(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});const connection=await one("SELECT id FROM calendly_connections WHERE status='active'");if(!connection)return res.status(409).json({error:'Calendly organization is not connected'});const version=await one('SELECT COALESCE(MAX(mapping_version),0)::int AS n FROM calendly_event_type_mappings WHERE calendly_connection_id=$1 AND event_type_ref=$2',[connection.id,checked.value.eventTypeRef]);await execute("UPDATE calendly_event_type_mappings SET status='retired',effective_until=NOW() WHERE calendly_connection_id=$1 AND event_type_ref=$2 AND status='active'",[connection.id,checked.value.eventTypeRef]);const row=await one(`INSERT INTO calendly_event_type_mappings(id,calendly_connection_id,event_type_ref,mapping_version,kind,duration_minutes,location_mode,status,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'active',$8,$9) RETURNING *`,[uuid(),connection.id,checked.value.eventTypeRef,Number(version.n)+1,checked.value.kind,checked.value.durationMinutes,checked.value.locationMode,checked.value.reason,req.broker.id]);await audit('CalendarConnection',connection.id,'calendly_event_type_mapped',req.broker.id,{kind:row.kind,version:row.mappingVersion,reason:row.reason});res.status(201).json(row);});

async function prepareIntent(req,res,kind){
  const leadId=kind==='customer_meeting'?req.params.leadId:null,opportunityId=kind==='property_viewing'?req.params.opportunityId:null;
  let context;if(kind==='customer_meeting'){context=await leadContext(req,leadId,true);if(context===null)return res.status(404).json({error:'Lead not found'});if(context===false)return res.status(403).json({error:'Lead is outside your writable scope'});}else{context=await one(`SELECT o.*,l.id AS lead_id,l.contact_id,l.updated_at AS lead_updated_at,pm.id AS property_match_id,pm.version AS property_match_version
    FROM opportunities o JOIN leads l ON l.id=o.lead_id JOIN property_matches pm ON pm.opportunity_id=o.id AND pm.id=$2 WHERE o.id=$1`,[opportunityId,req.params.matchId]);if(!context)return res.status(404).json({error:'Opportunity Property Match not found'});if(!canWriteOpportunity(req.broker,context))return res.status(403).json({error:'Opportunity is outside your writable scope'});}
  const mapping=await one("SELECT * FROM calendly_event_type_mappings WHERE id=$1 AND kind=$2 AND status='active'",[req.body?.eventTypeMappingId,kind]);const host=await one("SELECT * FROM calendly_host_mappings WHERE broker_id=$1 AND status='active'",[req.broker.id]);const connection=await one("SELECT id FROM calendly_connections WHERE status='active'");if(!mapping||!host||!connection)return res.status(409).json({error:'Active Calendly connection, host and matching event type are required'});
  if(!enabled('CALENDLY_ENABLED'))return res.status(503).json({error:'Calendly link preparation remains disabled until sandbox authorization'});
  return res.status(501).json({error:'Live scheduling-link preparation requires separately authorized provider sandbox activation'});
}
r.post('/crm/leads/:leadId/calendly/meeting-intents',(req,res)=>prepareIntent(req,res,'customer_meeting'));
r.post('/crm/opportunities/:opportunityId/matches/:matchId/calendly/viewing-intents',(req,res)=>prepareIntent(req,res,'property_viewing'));

r.get('/crm/calendly/intents/:intentId',async(req,res)=>{const intent=await one('SELECT * FROM calendly_scheduling_intents WHERE id=$1',[req.params.intentId]);if(!intent)return res.status(404).json({error:'Calendly scheduling intent not found'});const lead=await leadContext(req,intent.leadId);if(lead===false)return res.status(403).json({error:'Scheduling intent is outside your scope'});res.json({intent:{...intent,restrictedProviderLinkRef:undefined,correlationRef:undefined}});});

r.post('/crm/calendly/bookings/:bookingId/confirm-viewing',async(req,res)=>{
  const booking=await one(`SELECT b.*,i.broker_id,i.opportunity_id,i.opportunity_version,i.property_match_id,i.property_match_version,t.id AS task_id,t.assignee_id,t.status AS task_status
    FROM calendly_bookings b JOIN calendly_scheduling_intents i ON i.id=b.scheduling_intent_id LEFT JOIN calendly_projection_events p ON p.booking_id=b.id AND p.projection_type='viewing_confirmation_task' LEFT JOIN tasks t ON t.id=p.task_id WHERE b.id=$1`,[req.params.bookingId]);
  if(!booking)return res.status(404).json({error:'Calendly booking not found'});if(booking.brokerId!==req.broker.id&&booking.assigneeId!==req.broker.id&&req.broker.jobRole!=='manager'&&req.broker.jobRole!=='director')return res.status(403).json({error:'Only the assigned broker, Manager or Director may confirm this viewing'});
  const check=evaluateViewingConfirmation({assignedBrokerConfirmed:req.body?.confirmation==='CONFIRM_VIEWING',actorAuthorized:true,intentCurrent:booking.status==='pending_broker_confirmation',opportunityCurrent:false,propertyMatchCurrent:false,inventoryEligible:false,duplicateViewing:false});
  if(!check.value.allowed)return res.status(409).json({error:'Viewing confirmation requires transactional Opportunity, Property Match and live Inventory revalidation',blockers:check.value.blockers});
  res.status(409).json({error:'Viewing confirmation remains fail-closed until migration rehearsal validates the complete transaction'});
});

export default r;
