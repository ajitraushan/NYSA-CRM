import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity, isManager } from '../crm-policy.js';
import { validateContactIdentity, validateBudget, SOURCES, BUSINESS_TYPES } from '../crm-domain.js';
import { calculateDeadlines } from './lead-operations.js';

const r=Router();
const MAX_CLOCK_SKEW_MS=5*60*1000;
const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');

function safeEqual(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);
}
function authenticate(req){
  const secret=process.env.WEBSITE_INTAKE_SECRET||'';
  const timestamp=String(req.headers['x-nysa-timestamp']||'');
  const signature=String(req.headers['x-nysa-signature']||'').replace(/^sha256=/,'');
  if(secret.length<32)return {status:503,error:'Website intake is not configured'};
  const time=Number(timestamp);if(!Number.isFinite(time)||Math.abs(Date.now()-time)>MAX_CLOCK_SKEW_MS)return {status:401,error:'Invalid or expired request authentication'};
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${req.rawBody||''}`).digest('hex');
  if(!safeEqual(signature,expected))return {status:401,error:'Invalid or expired request authentication'};
  return null;
}
function validatePayload(b){
  const identity=validateContactIdentity(b?.contact?.email,b?.contact?.phone);
  if(!clean(b?.eventId)||!clean(b?.contact?.fullName)||identity.error)return {error:identity.error||'eventId and contact.fullName are required'};
  if(b.contact.preferredChannel&&!['Phone','Email','WhatsApp','SMS'].includes(b.contact.preferredChannel))return {error:'Invalid preferred contact channel'};
  if((b.source||'Website')!=='Website'||!SOURCES.includes(b.source||'Website')||!BUSINESS_TYPES.includes(b.businessType))return {error:'Invalid source or businessType'};
  if(!['own_use','investment','business','other'].includes(b?.requirement?.purpose)||!['cash','mortgage','mixed','unknown'].includes(b?.requirement?.fundingMethod||'unknown')||
    !clean(b?.requirement?.timelineCode)||typeof b?.consent?.marketing!=='boolean'||!clean(b?.consent?.statementVersion))
    return {error:'requirement purpose/timeline and explicit consent evidence are required'};
  const budget=validateBudget(b.requirement.budgetMin,b.requirement.budgetMax);if(budget.error)return {error:budget.error};
  return {identity};
}
async function intakeActor(){
  const id=process.env.WEBSITE_INTAKE_ACTOR_ID;
  return id?one("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role IN ('admin','internal_broker')",[id]):null;
}
async function processEvent(event,b,identity,actor){
  return transaction(async client=>{
    let contact=identity.email?await one('SELECT c.* FROM contacts c JOIN contact_channels ch ON ch.contact_id=c.id WHERE ch.channel_kind=\'Email\' AND ch.normalized_value=$1 AND c.lifecycle_status=\'active\' LIMIT 1',[identity.email],client):null;
    if(!contact&&identity.phone)contact=await one('SELECT c.* FROM contacts c JOIN contact_channels ch ON ch.contact_id=c.id WHERE ch.channel_kind=\'Phone\' AND ch.normalized_value=$1 AND c.lifecycle_status=\'active\' LIMIT 1',[identity.phone],client);
    if(!contact){
      const contactId=uuid();contact=await one(`INSERT INTO contacts(id,full_name,email,phone,contact_type,preferred_channel,owner_id,created_by,email_status,phone_status,source_first_seen)
        VALUES($1,$2,$3,$4,'buyer',$5,NULL,$6,$7,$8,'Website') RETURNING *`,[contactId,clean(b.contact.fullName),identity.email,identity.phone,b.contact.preferredChannel||null,actor.id,identity.emailStatus,identity.phoneStatus],client);
      if(identity.email)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by)
        VALUES($1,$2,'Email',$3,$4,'format_valid',1,$5)`,[uuid(),contact.id,b.contact.email,identity.email,actor.id],client);
      if(identity.phone)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by)
        VALUES($1,$2,'Phone',$3,$4,'format_valid',1,$5)`,[uuid(),contact.id,b.contact.phone,identity.phone,actor.id],client);
    }
    const rule=await one(`SELECT * FROM routing_rules WHERE active=1 AND (source IS NULL OR source=$1) AND (business_type IS NULL OR business_type=$2)
      ORDER BY priority,id LIMIT 1`,[b.source||'Website',b.businessType],client);
    const receivedAt=new Date(),deadlines=await calculateDeadlines(receivedAt,client),leadId=uuid();
    const lead=await one(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,budget_min,budget_max,preferred_areas,property_requirements,
      assigned_team_id,assigned_to,assignment_status,received_at,external_source_id,campaign_code,source_page,source_form,assignment_due_at,
      original_acceptance_due_at,first_contact_due_at,sla_policy_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20,$21,$22) RETURNING *`,
      [leadId,contact.id,clean(b.title)||`${b.businessType} website enquiry`,b.source||'Website',b.businessType,b.temperature||'Warm',b.requirement.budgetMin??null,b.requirement.budgetMax??null,
       Array.isArray(b.requirement.areas)?b.requirement.areas.join(', '):null,clean(b.requirement.notes),rule?.teamId||null,rule?.agentId||null,rule?.agentId?'assigned':'unassigned',receivedAt,event.eventId,
       clean(b.campaign),clean(b.page),clean(b.form),deadlines.acceptanceDueAt,deadlines.firstContactDueAt,deadlines.policy?.id||null,actor.id],client);
    if(rule){
      const status=rule.agentId?'offered':'queued';
      await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,$4,$5,$6,$7)`,
        [uuid(),lead.id,rule.teamId,rule.agentId,status,deadlines.acceptanceDueAt,actor.id],client);
    }
    const reqId=uuid();await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,timeline_code,notes,created_by)
      VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[reqId,lead.id,b.businessType,b.requirement.purpose,Array.isArray(b.requirement.propertyTypes)?b.requirement.propertyTypes:[],Array.isArray(b.requirement.areas)?b.requirement.areas:[],b.requirement.budgetMin??null,b.requirement.budgetMax??null,b.requirement.fundingMethod||'unknown',b.requirement.timelineCode,clean(b.requirement.notes),actor.id],client);
    await execute(`INSERT INTO consent_evidence(id,contact_id,evidence_type,status,statement_version,source_event_id,captured_at,evidence_hash)
      VALUES($1,$2,'website_form',$3,$4,$5,$6,$7)`,[uuid(),contact.id,b.consent.marketing?'granted':'denied',b.consent.statementVersion,event.id,receivedAt,hash(JSON.stringify(b.consent))],client);
    await execute("UPDATE website_intake_events SET status='accepted',contact_id=$1,lead_id=$2,processed_at=NOW(),error_code=NULL WHERE id=$3",[contact.id,lead.id,event.id],client);
    await audit('WebsiteIntake',event.id,'accepted',actor.id,{leadId:lead.id,eventId:event.eventId},client);
    return {eventId:event.eventId,contactId:contact.id,leadId:lead.id,status:'accepted'};
  });
}

r.post('/intake/website',async(req,res)=>{
  const auth=authenticate(req);if(auth)return res.status(auth.status).json({error:auth.error});
  const b=req.body||{},checked=validatePayload(b);if(checked.error)return res.status(400).json({error:checked.error});
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  const payloadHash=hash(req.rawBody||'');
  const existing=await one('SELECT * FROM website_intake_events WHERE event_id=$1',[b.eventId]);
  if(existing){
    if(existing.payloadHash!==payloadHash)return res.status(409).json({error:'Event identifier was already used with different data'});
    if(existing.status==='accepted')return res.json({eventId:existing.eventId,contactId:existing.contactId,leadId:existing.leadId,status:'accepted',idempotent:true});
    return res.status(409).json({error:'Event requires authorized support replay'});
  }
  const event=await one(`INSERT INTO website_intake_events(id,event_id,payload_hash,status) VALUES($1,$2,$3,'processing') RETURNING *`,[uuid(),b.eventId,payloadHash]);
  try{return res.status(201).json(await processEvent(event,b,checked.identity,actor));}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='PROCESSING_FAILED' WHERE id=$1",[event.id]);throw error;}
});

function supportOnly(req,res,next){
  if(!hasInternalCrmIdentity(req.broker)||!isManager(req.broker))return res.status(403).json({error:'Manager or administrator access required'});
  next();
}
r.get('/admin/website-intake',requireAuth,supportOnly,async(req,res)=>{
  const status=['processing','accepted','failed'].includes(req.query.status)?req.query.status:null;
  res.json({events:await many(`SELECT id,event_id,status,contact_id,lead_id,received_at,processed_at,attempt_count,error_code,replayed_by
    FROM website_intake_events WHERE ($1::text IS NULL OR status=$1) ORDER BY received_at DESC LIMIT 200`,[status])});
});
r.post('/admin/website-intake/:eventId/replay',requireAuth,supportOnly,async(req,res)=>{
  const checked=validatePayload(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  if(req.body.eventId!==req.params.eventId)return res.status(400).json({error:'eventId must match the failed event'});
  const event=await transaction(async client=>{
    const current=await one('SELECT * FROM website_intake_events WHERE event_id=$1 FOR UPDATE',[req.params.eventId],client);
    if(!current)return null;if(current.status!=='failed')return {conflict:true};
    return one(`UPDATE website_intake_events SET status='processing',payload_hash=$1,attempt_count=attempt_count+1,replayed_by=$2,error_code=NULL WHERE id=$3 RETURNING *`,
      [hash(JSON.stringify(req.body)),req.broker.id,current.id],client);
  });
  if(!event)return res.status(404).json({error:'Website event not found'});if(event.conflict)return res.status(409).json({error:'Only failed events can be replayed'});
  const actor=await intakeActor();if(!actor)return res.status(503).json({error:'Website intake is not configured'});
  try{const result=await processEvent(event,req.body,checked.identity,actor);await audit('WebsiteIntake',event.id,'replayed',req.broker.id);res.json(result);}
  catch(error){await execute("UPDATE website_intake_events SET status='failed',processed_at=NOW(),error_code='PROCESSING_FAILED' WHERE id=$1",[event.id]);throw error;}
});

export { processEvent, validatePayload };
export default r;
