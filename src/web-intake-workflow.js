import crypto from 'node:crypto';
import {validateBudget,normalizeDelimitedValues} from './crm-domain.js';

const SINGLE_STEP_FORMS=new Set(['contact_form','contact_us','speak_to_advisor_v2','brochure_download_v2','meta_instant_form']);
const OPEN_CASE_STATES=['unassigned','ai_handling','awaiting_pickup_urgent','human_owned','promoted','released','needs_attention','no_response'];
const TERMINAL_OUTCOMES=new Set(['wrong_number','opted_out','meeting_confirmed','not_interested']);
const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const row=async(client,sql,params=[])=>(await client.query(sql,params)).rows[0];
const rows=async(client,sql,params=[])=>(await client.query(sql,params)).rows;
const uuid=()=>crypto.randomUUID();
const problem=(message,statusCode=409,responseBody)=>{throw Object.assign(new Error(message),{statusCode,responseBody});};
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

export function webIntakeMode(sourceSystem,formId,declaredMode){
  if(declaredMode&& !['single_step','multi_step'].includes(declaredMode))problem('Invalid intake mode',400);
  if(declaredMode)return declaredMode;
  if(sourceSystem==='meta'||SINGLE_STEP_FORMS.has(String(formId||'').toLowerCase()))return 'single_step';
  if(formId)return 'multi_step';
  problem('Source intake mode is not configured',409);
}

export function maskWebIdentity({fullName,email,phone}={}){
  const name=clean(fullName),mail=clean(email),number=clean(phone);
  const [local,domain]=String(mail||'').split('@');
  return {
    maskedName:name?`${name.slice(0,1)}${name.includes(' ')?'… '+name.split(/\s+/).at(-1).slice(0,1):'…'}`:null,
    maskedEmail:local&&domain?`${local.slice(0,1)}***@${domain}`:null,
    maskedPhone:number?`••••${number.replace(/\D/g,'').slice(-4)}`:null
  };
}

function requireIdentitySecrets(env){
  const encryptionKey=env.WEB_INTAKE_IDENTITY_KEY,matchKey=env.WEB_INTAKE_MATCH_KEY;
  if(!/^[a-f0-9]{64}$/i.test(encryptionKey||'')||typeof matchKey!=='string'||matchKey.length<32)
    problem('WEB intake identity protection is not configured',503);
  return {encryptionKey,matchKey,matchKeyVersion:clean(env.WEB_INTAKE_MATCH_KEY_VERSION)||'v1'};
}

export function sealWebIdentity(value,keyHex){
  if(!/^[a-f0-9]{64}$/i.test(keyHex||''))problem('WEB intake identity protection is not configured',503);
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}

export function openWebIdentity(sealed,keyHex){
  if(!/^[a-f0-9]{64}$/i.test(keyHex||''))problem('WEB intake identity protection is not configured',503);
  const [iv,tag,body]=String(sealed||'').split('.');
  if(!iv||!tag||!body)problem('WEB intake identity evidence is invalid',409);
  const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64')),decipher.final()]).toString('utf8'));
}

export function webIdentityMatchHash(normalizedValue,matchKey){
  const value=clean(normalizedValue);
  return value?crypto.createHmac('sha256',matchKey).update(value).digest('hex'):null;
}

export function structuredIntakeSummary(payload={}){
  const requirement=payload.requirement||{},profile=payload.profile||{},budget=validateBudget(requirement.budgetMin,requirement.budgetMax);
  const propertyTypes=normalizeDelimitedValues(requirement.propertyTypes),areas=normalizeDelimitedValues(requirement.areas);
  return {
    title:clean(payload.title),businessType:clean(payload.businessType),purpose:clean(requirement.purpose),
    propertyTypes,areas,budgetMin:budget.error?null:budget.min,budgetMax:budget.error?null:budget.max,
    fundingMethod:clean(requirement.fundingMethod),timelineCode:clean(requirement.timelineCode),
    bedroomsMin:requirement.bedroomsMin??null,bedroomsMax:requirement.bedroomsMax??null,
    readiness:clean(requirement.readiness),declaredLocation:clean(requirement.declaredLocation),notes:clean(requirement.notes),
    declaredPriorities:normalizeDelimitedValues(profile.declaredPriorities),preferences:normalizeDelimitedValues(profile.preferences),
    preferredChannel:clean(payload.contact?.preferredChannel),customerTimezone:clean(payload.location?.timeZone),
    requestedCallbackAt:clean(payload.requestedCallbackAt),requestedMeetingAt:clean(payload.requestedMeetingAt),
    consent:{statementVersion:clean(payload.consent?.statementVersion),marketing:payload.consent?.marketing===true,
      whatsapp:payload.consent?.aiWhatsapp===true,email:payload.consent?.aiEmail===true}
  };
}

export function intakeMissingFields(summary,mode='completed'){
  const missing=[];
  if(!summary.purpose)missing.push('purpose');
  if(!summary.timelineCode)missing.push('timing');
  if(mode==='promotion'){
    if(!summary.propertyTypes?.length)missing.push('property type');
    if(!summary.areas?.length&&summary.declaredLocation!=='open_to_suggestions')missing.push('location or area');
    if(summary.budgetMin===null&&summary.budgetMax===null&&summary.budgetBand!=='customer_undecided')missing.push('budget band');
  }
  return missing;
}

export function nextCustomerWindow(value,timeZone='Asia/Dubai',startMinute=540,endMinute=1260){
  let date=new Date(value);if(!Number.isFinite(date.valueOf()))date=new Date();
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  const minute=Number(parts.hour)*60+Number(parts.minute);
  if(minute>=startMinute&&minute<endMinute)return {dueAt:date,dueAtOpen:false};
  const localStartUtc=new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const offsetGuess=(new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`).valueOf()-date.valueOf())/60000;
  if(minute>=endMinute)localStartUtc.setUTCDate(localStartUtc.getUTCDate()+1);
  localStartUtc.setUTCMinutes(startMinute-offsetGuess);
  return {dueAt:localStartUtc,dueAtOpen:true};
}

function addLandingDelay(at,minutes,timeZone,config){
  return nextCustomerWindow(new Date(new Date(at).valueOf()+minutes*60000),timeZone||'Asia/Dubai',config.outbound_start_minute,config.outbound_end_minute);
}

async function currentConfiguration(client){
  return row(client,`SELECT * FROM web_intake_configuration_versions WHERE scope_code='default' AND superseded_at IS NULL ORDER BY version_no DESC LIMIT 1`);
}

async function writeAudit(client,entityType,entityId,action,performedBy,details={}){
  await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [uuid(),entityType,entityId,action,performedBy,JSON.stringify(details)]);
}

async function createProvisionalIdentity({sourceSystem,identity,payload,actorId},client,env){
  const secrets=requireIdentitySecrets(env),masked=maskWebIdentity({fullName:payload.contact?.fullName,email:identity.email,phone:identity.phone});
  const config=await currentConfiguration(client);
  const phoneHash=webIdentityMatchHash(identity.phone,secrets.matchKey),emailHash=webIdentityMatchHash(identity.email,secrets.matchKey);
  const matches=await rows(client,`SELECT DISTINCT contact_id FROM web_intake_contact_match_keys
    WHERE match_key_version=$1 AND ((channel_kind='Phone' AND match_hash=$2) OR (channel_kind='Email' AND match_hash=$3))`,
    [secrets.matchKeyVersion,phoneHash,emailHash]);
  const matchedContactId=matches.length===1?matches[0].contact_id:null,confidence=matches.length===1?'deterministic':matches.length>1?'candidate':'none';
  const permitted=['marketing',payload.consent?.aiWhatsapp===true?'whatsapp':null,payload.consent?.aiEmail===true?'email':null].filter(Boolean);
  const id=uuid();
  await client.query(`INSERT INTO web_intake_provisional_identities(id,source_system,encrypted_identity,masked_name,masked_email,masked_phone,
    phone_match_hash,email_match_hash,match_key_version,matched_contact_id,match_confidence,consent_statement_ref,permitted_channels,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()+($14 * INTERVAL '1 day'))`,[
      id,sourceSystem,sealWebIdentity({fullName:clean(payload.contact?.fullName),email:identity.email,phone:identity.phone,
        emailStatus:identity.emailStatus,phoneStatus:identity.phoneStatus},secrets.encryptionKey),masked.maskedName,masked.maskedEmail,masked.maskedPhone,
      phoneHash,emailHash,secrets.matchKeyVersion,matchedContactId,confidence,clean(payload.consent?.statementVersion),permitted,
      config.provisional_retention_days
    ]);
  await writeAudit(client,'WebIntakeIdentity',id,'provisional_identity_created',actorId,{sourceSystem,matchConfidence:confidence,hasPhone:Boolean(identity.phone),hasEmail:Boolean(identity.email)});
  return row(client,'SELECT * FROM web_intake_provisional_identities WHERE id=$1',[id]);
}

async function refreshProvisionalIdentity(claim,identity,payload,client,env){
  const secrets=requireIdentitySecrets(env),masked=maskWebIdentity({fullName:payload.contact?.fullName,email:identity.email,phone:identity.phone});
  const config=await currentConfiguration(client);
  const phoneHash=webIdentityMatchHash(identity.phone,secrets.matchKey),emailHash=webIdentityMatchHash(identity.email,secrets.matchKey);
  const matches=await rows(client,`SELECT DISTINCT contact_id FROM web_intake_contact_match_keys
    WHERE match_key_version=$1 AND ((channel_kind='Phone' AND match_hash=$2) OR (channel_kind='Email' AND match_hash=$3))`,
    [secrets.matchKeyVersion,phoneHash,emailHash]);
  const matchedContactId=matches.length===1?matches[0].contact_id:null,confidence=matches.length===1?'deterministic':matches.length>1?'candidate':'none';
  await client.query(`UPDATE web_intake_provisional_identities SET encrypted_identity=$2,masked_name=$3,masked_email=$4,masked_phone=$5,
    phone_match_hash=$6,email_match_hash=$7,match_key_version=$8,matched_contact_id=$9,match_confidence=$10,
    consent_statement_ref=$11,permitted_channels=$12,expires_at=NOW()+($13 * INTERVAL '1 day'),updated_at=NOW() WHERE id=$1`,[
      claim.id,sealWebIdentity({fullName:clean(payload.contact?.fullName),email:identity.email,phone:identity.phone,
        emailStatus:identity.emailStatus,phoneStatus:identity.phoneStatus},secrets.encryptionKey),masked.maskedName,masked.maskedEmail,masked.maskedPhone,
      phoneHash,emailHash,secrets.matchKeyVersion,matchedContactId,confidence,clean(payload.consent?.statementVersion),
      ['marketing',payload.consent?.aiWhatsapp===true?'whatsapp':null,payload.consent?.aiEmail===true?'email':null].filter(Boolean),
      config.provisional_retention_days
    ]);
  return row(client,'SELECT * FROM web_intake_provisional_identities WHERE id=$1',[claim.id]);
}

async function addContactMatchKeys(contactId,identity,client,secrets){
  for(const [kind,value] of [['Email',identity.email],['Phone',identity.phone]]){
    const matchHash=webIdentityMatchHash(value,secrets.matchKey);if(!matchHash)continue;
    await client.query(`INSERT INTO web_intake_contact_match_keys(contact_id,channel_kind,match_key_version,match_hash)
      VALUES($1,$2,$3,$4) ON CONFLICT(contact_id,channel_kind,match_key_version) DO UPDATE SET match_hash=EXCLUDED.match_hash`,
      [contactId,kind,secrets.matchKeyVersion,matchHash]);
  }
}

async function resolveProvisionalIdentity(claim,payload,identity,actorId,resolutionEvent,client,env){
  if(claim.state==='resolved')return {contactId:claim.resolved_contact_id,ambiguous:false,reused:true};
  if(claim.match_confidence==='candidate')return {contactId:null,ambiguous:true,reused:false};
  const secrets=requireIdentitySecrets(env);let contactId=claim.matched_contact_id;
  if(contactId){
    const active=await row(client,"SELECT id FROM contacts WHERE id=$1 AND lifecycle_status='active'",[contactId]);
    if(!active)contactId=null;
  }
  if(!contactId){
    contactId=uuid();
    const role=payload.businessType==='Rental'?'tenant':'buyer';
    await client.query(`INSERT INTO contacts(id,full_name,email,phone,contact_type,preferred_channel,owner_id,created_by,email_status,phone_status,source_first_seen)
      VALUES($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10)`,[contactId,clean(payload.contact?.fullName),identity.email,identity.phone,role,
      clean(payload.contact?.preferredChannel),actorId,identity.email?identity.emailStatus:'unverified',identity.phoneStatus,
      payload.source==='Social media'?'Social media':'Website']);
    await client.query(`INSERT INTO contact_roles(id,contact_id,role_code,created_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[uuid(),contactId,role,actorId]);
    for(const [kind,value] of [['Email',identity.email],['Phone',identity.phone]])if(value)await client.query(`INSERT INTO contact_channels
      (id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by) VALUES($1,$2,$3,$4,$4,'format_valid',1,$5)`,
      [uuid(),contactId,kind,value,actorId]);
  }
  await addContactMatchKeys(contactId,identity,client,secrets);
  await client.query(`UPDATE web_intake_provisional_identities SET state='resolved',resolved_contact_id=$2,resolved_at=NOW(),resolved_by_event=$3,
    matched_contact_id=COALESCE(matched_contact_id,$2),match_confidence=CASE WHEN matched_contact_id IS NULL THEN 'none' ELSE 'deterministic' END,updated_at=NOW() WHERE id=$1`,
    [claim.id,contactId,resolutionEvent]);
  await writeAudit(client,'WebIntakeIdentity',claim.id,'provisional_identity_resolved',actorId,{resolutionEvent,contactId,reused:Boolean(claim.matched_contact_id)});
  return {contactId,ambiguous:false,reused:Boolean(claim.matched_contact_id)};
}

async function sourceInboxForJourney({journey,event,payload},client){
  const sourceAccount=clean(payload.sourceWebsite)||journey.source_account_id,sourceEvent=clean(payload.eventId)||String(event?.eventId||journey.id),form=clean(payload.form)||journey.source_form_id;
  const referenceDigest=digest({sourceEvent,form,journeyId:journey.id,payloadHash:event?.payloadHash||null});
  let source=await row(client,`INSERT INTO lead_source_inbox(id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,
    source_created_at,received_at,state,processed_at,website_intake_event_id,web_intake_journey_id,external_campaign_code,campaign_id,campaign_mapping_status)
    VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),NOW(),'accepted',NOW(),$8,$9,$10,$11,$12)
    ON CONFLICT(source_system,source_account_id,source_event_id) DO NOTHING RETURNING *`,[
      uuid(),journey.source_system,sourceAccount,sourceEvent,form,referenceDigest,payload.profile?.completedAt||null,
      journey.source_system==='website'?(event?.id||null):null,journey.id,clean(payload.campaign),journey.campaign_id,journey.campaign_mapping_status
    ]);
  if(!source)source=await row(client,'SELECT * FROM lead_source_inbox WHERE web_intake_journey_id=$1 OR (source_system=$2 AND source_account_id=$3 AND source_event_id=$4)',
    [journey.id,journey.source_system,sourceAccount,sourceEvent]);
  if(!source)problem('WEB intake receipt could not be reconciled',409);
  if(!source.web_intake_journey_id){
    await client.query('UPDATE lead_source_inbox SET web_intake_journey_id=$2 WHERE id=$1',[source.id,journey.id]);
    source.web_intake_journey_id=journey.id;
  }
  return source;
}

async function findExistingOwner(contactId,client){
  if(!contactId)return null;
  const activeCase=await row(client,`SELECT c.id AS case_id,c.fallback_owner_id AS owner_id,c.lead_id,b.status,b.job_role
    FROM lead_follow_up_cases c JOIN brokers b ON b.id=c.fallback_owner_id
    WHERE c.fallback_owner_id IS NOT NULL AND c.state=ANY($2::text[]) AND
      (c.lead_id IN (SELECT id FROM leads WHERE contact_id=$1) OR c.journey_id IN (SELECT id FROM web_intake_journeys WHERE contact_id=$1))
    ORDER BY c.updated_at DESC LIMIT 1`,[contactId,OPEN_CASE_STATES]);
  if(activeCase)return {...activeCase,kind:'case'};
  const openLead=await row(client,`SELECT l.id AS lead_id,l.assigned_to AS owner_id,l.assigned_team_id,b.status,b.job_role
    FROM leads l JOIN brokers b ON b.id=l.assigned_to WHERE l.contact_id=$1 AND l.stage NOT IN ('Won','Lost')
    ORDER BY l.updated_at DESC LIMIT 1`,[contactId]);
  return openLead?{...openLead,kind:'lead'}:null;
}

async function createPrimaryTask({caseRow,ownerId,actorId,kind,priority,dueAt,dueBasis,dueAtOpen=false,subject,details,leadId=null,contactId=null,timeZone=null,attemptNumber=1},client){
  const existing=await row(client,`SELECT id,due_at,landing_priority FROM tasks WHERE follow_up_case_id=$1 AND is_primary_next_action
    AND status IN ('open','in_progress') FOR UPDATE`,[caseRow.id]);
  if(existing){
    await client.query(`UPDATE tasks SET assignee_id=$2,subject=$3,details=$4,priority=$5,due_at=LEAST(due_at,$6),landing_priority=LEAST(COALESCE(landing_priority,8),$7),
      task_kind=$8,due_basis=$9,due_at_open=(due_at_open OR $10),customer_timezone=COALESCE($11,customer_timezone),updated_at=NOW() WHERE id=$1`,
      [existing.id,ownerId,subject,details,priority<=2?'urgent':priority<=4?'high':'normal',dueAt,priority,kind,dueBasis,dueAtOpen,timeZone]);
    await client.query('UPDATE lead_follow_up_cases SET next_action_task_id=$2,updated_at=NOW() WHERE id=$1',[caseRow.id,existing.id]);
    return existing.id;
  }
  const taskId=uuid();
  await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,created_by,task_type,
    follow_up_case_id,task_kind,landing_priority,due_basis,due_at_open,customer_timezone,attempt_number,is_primary_next_action)
    VALUES($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,'web_intake_follow_up',$10,$11,$12,$13,$14,$15,$16,TRUE)`,[
      taskId,leadId,contactId,subject,details,ownerId,priority<=2?'urgent':priority<=4?'high':'normal',dueAt,actorId,caseRow.id,kind,priority,
      dueBasis,dueAtOpen,timeZone,attemptNumber
    ]);
  await client.query('UPDATE lead_follow_up_cases SET next_action_task_id=$2,updated_at=NOW() WHERE id=$1',[caseRow.id,taskId]);
  return taskId;
}

async function createOrRouteCase({journey,event,payload,actorId,contactId,identityAmbiguous=false},client){
  const existing=await row(client,'SELECT * FROM lead_follow_up_cases WHERE chain_root_journey_id=$1 AND state NOT IN (\'closed\',\'complete\',\'opted_out\',\'wrong_person\') FOR UPDATE',[journey.chain_root_journey_id]);
  if(existing){
    await client.query('UPDATE web_intake_journeys SET follow_up_case_id=$2 WHERE id=$1',[journey.id,existing.id]);
    if(existing.fallback_owner_id){
      const due=new Date(Date.now()+2*60*60*1000);
      await createPrimaryTask({caseRow:existing,ownerId:existing.fallback_owner_id,actorId,kind:'review_new_enquiry',priority:7,dueAt:due,dueBasis:'routing',
        subject:'Review new web enquiry',details:'A new journey was received for an existing customer. Review what changed before creating a new requirement version.',
        leadId:existing.lead_id,contactId,timeZone:payload.location?.timeZone},client);
    }
    return existing;
  }
  const source=await sourceInboxForJourney({journey,event,payload},client),owner=identityAmbiguous?null:await findExistingOwner(contactId,client);
  const config=await currentConfiguration(client),completed=journey.state==='completed';
  const escalationDueAt=new Date(new Date(completed?journey.completed_at:journey.dropped_at).valueOf()+
    (completed?config.completed_escalation_minutes:config.dropped_escalation_business_minutes)*60000);
  const caseId=uuid(),caseKind=owner?'routed_to_owner':completed?'completed_intake':'incomplete_recovery';
  const state=identityAmbiguous?'needs_attention':owner?'human_owned':journey.state==='completed'?'unassigned':'unassigned';
  const ownerActive=owner?.status==='active'&&['sales_agent','manager'].includes(owner?.job_role);
  const ownerId=ownerActive?owner.owner_id:null;
  await client.query(`INSERT INTO lead_follow_up_cases(id,source_inbox_id,lead_id,fallback_owner_id,created_by,policy_version,country,time_zone,
    location_confirmed,consent_statement_version,consent_evidence_ref,whatsapp_permitted,email_permitted,generation,state,next_action_task_id,
    assignment_due_at,response_owner_assigned_at,response_owner_assigned_by,journey_id,chain_root_journey_id,case_kind,picked_up_by,picked_up_at,
    escalation_due_at,exception_owner_id,declared_requirements)
    VALUES($1,$2,$3,$4,$5,'WEB-INTAKE-v1.3',$6,$7,$8,$9,$10,FALSE,FALSE,1,$11,NULL,$12,$13,$14,$15,$16,$17,$18,$19,$12,NULL,$20::jsonb)`,[
      caseId,source.id,owner?.lead_id||null,ownerId,actorId,clean(payload.location?.country),clean(payload.location?.timeZone),payload.location?.confirmed===true,
      clean(payload.consent?.statementVersion),`web-journey:${journey.id}`,state,escalationDueAt,ownerId?new Date():null,ownerId?actorId:null,
      journey.id,journey.chain_root_journey_id,caseKind,ownerId,ownerId?new Date():null,JSON.stringify(journey.structured_summary||{})
    ]);
  const created=await row(client,'SELECT * FROM lead_follow_up_cases WHERE id=$1',[caseId]);
  await client.query('UPDATE web_intake_journeys SET follow_up_case_id=$2 WHERE id=$1',[journey.id,caseId]);
  if(identityAmbiguous){
    await client.query(`INSERT INTO web_intake_configuration_exceptions(id,case_id,exception_code,details)
      VALUES($1,$2,'identity_ambiguous',$3::jsonb)`,[uuid(),caseId,JSON.stringify({journeyId:journey.id})]);
  } else if(ownerId){
    const dueInfo=addLandingDelay(new Date(),120,payload.location?.timeZone,config);
    await createPrimaryTask({caseRow:created,ownerId,actorId,kind:'review_new_enquiry',priority:7,dueAt:dueInfo.dueAt,dueBasis:'routing',dueAtOpen:dueInfo.dueAtOpen,
      subject:'Review new enquiry',details:'New web intake for an existing customer. Review changes; do not create a new requirement version automatically.',
      leadId:owner?.lead_id||null,contactId,timeZone:payload.location?.timeZone},client);
  }
  await writeAudit(client,'WebIntakeCase',caseId,ownerId?'journey_routed_to_existing_owner':'follow_up_case_opened',actorId,
    {journeyId:journey.id,caseKind,state,ownerId:ownerId||null,identityAmbiguous});
  return created;
}

export async function recordWebIntakeJourney({event,payload,identity,actorId,sourceSystem='website',forcedContactId=null},client,env=process.env){
  const config=await currentConfiguration(client);
  const formId=clean(payload.form)||'website_intake',sourceAccountId=clean(payload.sourceWebsite)||(sourceSystem==='meta'?'meta':'nysarealty.com');
  const rawCampaign=clean(payload.campaign)||event.external_campaign_code||null;
  const campaignMapping=rawCampaign?await row(client,`SELECT m.campaign_id FROM campaign_external_mappings m JOIN marketing_campaigns c ON c.id=m.campaign_id
    WHERE m.status='active' AND c.status<>'retired' AND LOWER(m.source_code)=LOWER($1) AND LOWER(m.external_campaign_code)=LOWER($2)`,
    [sourceSystem==='meta'?'Meta':payload.source||'Website',rawCampaign]):null;
  const campaignId=campaignMapping?.campaign_id||event.campaign_id||event.campaignId||null;
  const campaignMappingStatus=!rawCampaign?'not_supplied':campaignId?'mapped':'unmapped';
  if(sourceSystem==='website')await client.query('UPDATE website_intake_events SET campaign_id=$2,campaign_mapping_status=$3 WHERE id=$1',[event.id,campaignId,campaignMappingStatus]);
  const mode=webIntakeMode(sourceSystem,formId,payload.intakeMode),complete=mode==='single_step'||payload.intakeCompleteness!=='partial';
  const journeyKey=clean(payload.journeyKey)||`${mode}:${clean(payload.eventId)||event.id}`;
  let journey=mode==='multi_step'?await row(client,`SELECT * FROM web_intake_journeys WHERE source_system=$1 AND source_account_id=$2 AND journey_key=$3
    AND state='in_progress' FOR UPDATE`,[sourceSystem,sourceAccountId,journeyKey]):null;
  let claim;
  if(journey){
    claim=await row(client,'SELECT * FROM web_intake_provisional_identities WHERE id=$1 FOR UPDATE',[journey.provisional_identity_id]);
    claim=await refreshProvisionalIdentity(claim,identity,payload,client,env);
  }else{
    const predecessor=await row(client,`SELECT * FROM web_intake_journeys WHERE source_system=$1 AND source_account_id=$2 AND journey_key=$3
      ORDER BY started_at DESC LIMIT 1`,[sourceSystem,sourceAccountId,journeyKey]);
    if(predecessor?.state==='completed')problem('Journey is already complete',409);
    claim=await createProvisionalIdentity({sourceSystem,identity,payload,actorId},client,env);
    const id=uuid(),start=event.receivedAt||new Date(),rootId=predecessor?.chain_root_journey_id||id;
    const eventRecordId=sourceSystem==='website'?event.id:null;
    await client.query(`INSERT INTO web_intake_journeys(id,source_system,source_account_id,source_form_id,journey_key,predecessor_journey_id,
      chain_root_journey_id,prefilled_from_journey_id,provisional_identity_id,intake_mode,state,started_at,last_activity_at,resume_expires_at,
      completed_at,current_event_id,final_event_id,final_snapshot,structured_summary,missing_fields,source_campaign_code,campaign_id,campaign_mapping_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$6,$8,$9,$10,$11,$11,$12,$13,$14,$14,$15::jsonb,$16::jsonb,$17,$18,$19,$20)`,[
        id,sourceSystem,sourceAccountId,formId,journeyKey,predecessor?.id||null,rootId,claim.id,mode,complete?'completed':'in_progress',start,
        complete?null:new Date(new Date(start).valueOf()+config.journey_inactivity_minutes*60000),complete?start:null,eventRecordId,complete?JSON.stringify(payload):null,
        JSON.stringify(structuredIntakeSummary(payload)),intakeMissingFields(structuredIntakeSummary(payload)),rawCampaign,campaignId,campaignMappingStatus
      ]);
    journey=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1',[id]);
  }
  if(forcedContactId){
    await client.query(`UPDATE web_intake_provisional_identities SET matched_contact_id=$2,match_confidence='deterministic',updated_at=NOW() WHERE id=$1`,[claim.id,forcedContactId]);
    claim=await row(client,'SELECT * FROM web_intake_provisional_identities WHERE id=$1',[claim.id]);
  }
  const summary=structuredIntakeSummary(payload),missing=intakeMissingFields(summary);
  if(journey.state==='in_progress')await client.query(`UPDATE web_intake_journeys SET source_form_id=$2,last_activity_at=NOW(),resume_expires_at=NOW()+($6 * INTERVAL '1 minute'),
    current_event_id=$3,structured_summary=$4::jsonb,missing_fields=$5,source_campaign_code=$7,campaign_id=$8,campaign_mapping_status=$9,updated_at=NOW() WHERE id=$1`,
  [journey.id,formId,sourceSystem==='website'?event.id:null,JSON.stringify(summary),missing,config.journey_inactivity_minutes,rawCampaign,campaignId,campaignMappingStatus]);
  if(complete){
    const resolved=await resolveProvisionalIdentity(claim,payload,identity,actorId,'completion',client,env);
    await client.query(`UPDATE web_intake_journeys SET state='completed',contact_id=$2,last_activity_at=NOW(),resume_expires_at=NULL,completed_at=NOW(),
      current_event_id=$3,final_event_id=$3,final_snapshot=$4::jsonb,structured_summary=$5::jsonb,missing_fields=$6,updated_at=NOW() WHERE id=$1`,
      [journey.id,resolved.contactId,sourceSystem==='website'?event.id:null,JSON.stringify(payload),JSON.stringify(summary),missing]);
    journey=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1',[journey.id]);
    const responseCase=await createOrRouteCase({journey,event,payload,actorId,contactId:resolved.contactId,identityAmbiguous:resolved.ambiguous},client);
    if(sourceSystem==='website'&&resolved.contactId&&payload.consent?.statementVersion)await client.query(`INSERT INTO consent_evidence(id,contact_id,evidence_type,status,statement_version,source_event_id,captured_at,evidence_hash)
      VALUES($1,$2,'website_form',$3,$4,$5,NOW(),$6)`,[uuid(),resolved.contactId,payload.consent.marketing?'granted':'denied',payload.consent.statementVersion,event.id,digest(payload.consent)]);
    if(sourceSystem==='website')await client.query("UPDATE website_intake_events SET status='accepted',contact_id=$2,lead_id=NULL,processed_at=NOW(),error_code=NULL,web_intake_journey_id=$3,intake_stage='final' WHERE id=$1",
      [event.id,resolved.contactId,journey.id]);
    await writeAudit(client,'WebIntakeJourney',journey.id,'journey_completed',actorId,{eventId:event.eventId,caseId:responseCase.id,contactId:resolved.contactId,missingFields:missing});
    return {eventId:event.eventId,journeyId:journey.id,caseId:responseCase.id,contactId:resolved.contactId,leadId:null,status:resolved.ambiguous?'needs_attention':'completed_unassigned',intakeMode:mode};
  }
  if(sourceSystem==='website')await client.query("UPDATE website_intake_events SET status='accepted',contact_id=NULL,lead_id=NULL,processed_at=NOW(),error_code=NULL,web_intake_journey_id=$2,intake_stage='provisional' WHERE id=$1",[event.id,journey.id]);
  await writeAudit(client,'WebIntakeJourney',journey.id,'journey_step_saved',actorId,{eventId:event.eventId,resumeExpiresAt:journey.resume_expires_at});
  return {eventId:event.eventId,journeyId:journey.id,contactId:null,leadId:null,status:'in_progress',intakeMode:mode,resumeExpiresAt:new Date(Date.now()+config.journey_inactivity_minutes*60000)};
}

async function createLeadAndRequirement(caseRow,journey,owner,actorId,summary,client){
  if(caseRow.lead_id)return row(client,'SELECT * FROM leads WHERE id=$1',[caseRow.lead_id]);
  if(!journey.contact_id)problem('Resolve the customer identity before creating the Lead',409);
  const purpose=clean(summary.purpose),timeline=clean(summary.timelineCode);
  if(!['own_use','investment','business','other'].includes(purpose)||!timeline)
    problem('The completed intake is missing a governed purpose or timing; resolve it before pickup',409,{error:'Completed intake needs attention',missingFields:intakeMissingFields(summary)});
  const businessType=['Sale','Rental','Off-plan','Commercial','Unconfirmed'].includes(summary.businessType)?summary.businessType:'Unconfirmed';
  const budget=validateBudget(summary.budgetMin,summary.budgetMax);if(budget.error)problem(budget.error,409);
  const leadId=uuid(),receivedAt=journey.completed_at||journey.last_activity_at;
  await client.query(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,budget_min,budget_max,preferred_areas,property_requirements,
    assigned_team_id,assigned_to,assignment_status,received_at,external_source_id,campaign_code,source_page,source_form,accepted_at,created_by,campaign_id,routing_reason)
    VALUES($1,$2,$3,$4,$5,'Unassessed',$6,$7,$8,$9,$10,$11,'assigned',$12,$13,$14,$15,$16,NOW(),$17,$18,'Picked up from WEB Intake Leads')`,[
      leadId,journey.contact_id,summary.title||`${businessType} web enquiry`,journey.source_system==='meta'?'Social media':'Website',businessType,budget.min,budget.max,
      summary.areas?.join(', ')||null,summary.notes||null,owner.team_id||null,owner.id,receivedAt,`web-intake:${journey.id}`,journey.source_campaign_code,
      journey.source_account_id,journey.source_form_id,actorId,journey.campaign_id
    ]);
  await client.query(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,responded_at,assigned_by)
    VALUES($1,$2,1,$3,$4,'accepted',NOW(),$5)`,[uuid(),leadId,owner.team_id||null,owner.id,actorId]);
  await client.query(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,
    funding_method,bedrooms_min,bedrooms_max,timeline_code,notes,created_by,declared_priorities,preferences,source_kind,source_event_id,requirement_fingerprint)
    VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'website_profile',$17,$18)`,[
      uuid(),leadId,businessType,purpose,summary.propertyTypes||[],summary.areas||[],budget.min,budget.max,
      ['cash','mortgage','mixed','unknown'].includes(summary.fundingMethod)?summary.fundingMethod:'unknown',summary.bedroomsMin,summary.bedroomsMax,
      timeline,summary.notes,actorId,summary.declaredPriorities||[],summary.preferences||[],journey.final_event_id,digest(summary)
    ]);
  await client.query('UPDATE lead_source_inbox SET lead_id=$2 WHERE id=$1',[caseRow.source_inbox_id,leadId]);
  await client.query(`UPDATE customer_evidence_facts SET contact_id=$2,lead_id=$3,review_status='active',reviewed_at=NOW(),review_reason='Promoted from completed WEB intake'
    WHERE intake_event_id=$1 AND review_status='pending_review'`,[journey.final_event_id,journey.contact_id,leadId]);
  return row(client,'SELECT * FROM leads WHERE id=$1',[leadId]);
}

async function pickupOwner(actorId,client){
  const owner=await row(client,`SELECT id,name,job_role,team_id FROM brokers WHERE id=$1 AND status='active' AND role='internal_broker'
    AND job_role IN ('sales_agent','manager') FOR UPDATE`,[actorId]);
  if(!owner)problem('Only an active Sales Agent or Manager can pick up WEB intake',403);
  return owner;
}

export async function pickupWebIntake(caseId,broker,client,env=process.env){
  const owner=await pickupOwner(broker.id,client);await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`web-intake-pickup:${owner.id}`]);
  const caseRow=await row(client,'SELECT * FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[caseId]);
  if(!caseRow?.journey_id)problem('WEB intake case not found',404);
  if(caseRow.fallback_owner_id===owner.id&&caseRow.picked_up_at)return {caseId:caseRow.id,leadId:caseRow.lead_id,ownerId:owner.id,idempotent:true};
  if(caseRow.fallback_owner_id){
    const current=await row(client,'SELECT name FROM brokers WHERE id=$1',[caseRow.fallback_owner_id]);
    problem(`This intake was already picked up by ${current?.name||'another person'}`,409,{error:'Intake already picked up',ownerName:current?.name||'Assigned owner'});
  }
  if(!['unassigned','released','needs_attention'].includes(caseRow.state))problem('This intake is not available for pickup',409);
  if(caseRow.state==='needs_attention')problem('Resolve the intake exception before pickup',409);
  const config=await currentConfiguration(client);
  const held=await rows(client,`SELECT c.id,j.structured_summary,t.due_at FROM lead_follow_up_cases c JOIN web_intake_journeys j ON j.id=c.journey_id
    LEFT JOIN tasks t ON t.id=c.next_action_task_id WHERE c.fallback_owner_id=$1 AND c.last_contact_attempt_at IS NULL
    AND c.state IN ('human_owned','promoted') FOR UPDATE OF c`,[owner.id]);
  if(held.length>=config.pickup_cap)problem('Pickup limit reached. Contact or release existing items first.',409,
    {error:'Pickup limit reached',pickupCap:config.pickup_cap,uncontactedItems:held.map(item=>({caseId:item.id,dueAt:item.due_at,summary:item.structured_summary}))});
  const journey=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1 FOR UPDATE',[caseRow.journey_id]);
  let contactId=journey.contact_id;
  if(!contactId){
    const claim=await row(client,'SELECT * FROM web_intake_provisional_identities WHERE id=$1 FOR UPDATE',[journey.provisional_identity_id]);
    const identity=openWebIdentity(claim.encrypted_identity,requireIdentitySecrets(env).encryptionKey);
    const resolved=await resolveProvisionalIdentity(claim,journey.final_snapshot||{contact:identity,consent:{}},identity,broker.id,'pickup',client,env);
    if(resolved.ambiguous)problem('Resolve the possible Customer match before pickup',409);
    contactId=resolved.contactId;await client.query('UPDATE web_intake_journeys SET contact_id=$2,updated_at=NOW() WHERE id=$1',[journey.id,contactId]);
    journey.contact_id=contactId;
  }
  let lead=null,taskKind,subject,details,priority,dueInfo;
  if(journey.state==='completed'){
    lead=await createLeadAndRequirement(caseRow,journey,owner,broker.id,journey.structured_summary,client);
    taskKind='first_contact';subject='First contact';details='Completed WEB intake. Review the structured summary and make the first personal contact.';priority=5;
    dueInfo=addLandingDelay(new Date(),15,journey.structured_summary?.customerTimezone,config);
  }else if(journey.state==='dropped_incomplete'){
    taskKind='recovery_contact';subject='Recover incomplete enquiry';details=`Continue from the saved answers. Missing: ${(journey.missing_fields||[]).join(', ')||'confirm minimum facts'}.`;priority=6;
    dueInfo=nextCustomerWindow(new Date(),journey.structured_summary?.customerTimezone||'Asia/Dubai',config.outbound_start_minute,config.outbound_end_minute);
  }else problem('In-progress journeys cannot be picked up before the 30-minute window closes',409);
  await client.query(`UPDATE lead_follow_up_cases SET fallback_owner_id=$2,picked_up_by=$2,picked_up_at=NOW(),response_owner_assigned_at=NOW(),
    response_owner_assigned_by=$2,generation=generation+1,state='human_owned',lead_id=$3,case_kind=$4,stale_notice_due_at=$5::timestamptz+($6::int * INTERVAL '1 minute'),
    stale_release_due_at=$5::timestamptz+(($6::int+$7::int) * INTERVAL '1 minute'),previous_owner_id=NULL,released_reason=NULL,updated_at=NOW() WHERE id=$1`,[
      caseRow.id,owner.id,lead?.id||null,journey.state==='completed'?'completed_intake':'incomplete_recovery',dueInfo.dueAt,
      config.stale_notice_minutes,config.stale_release_minutes
    ]);
  await client.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE case_id=$1 AND state IN ('waiting','queued')",[caseRow.id]);
  const updated={...caseRow,lead_id:lead?.id||null};
  const taskId=await createPrimaryTask({caseRow:updated,ownerId:owner.id,actorId:broker.id,kind:taskKind,priority,dueAt:dueInfo.dueAt,dueBasis:'pickup',dueAtOpen:dueInfo.dueAtOpen,
    subject,details,leadId:lead?.id||null,contactId,timeZone:journey.structured_summary?.customerTimezone},client);
  if(lead)await client.query('UPDATE leads SET next_follow_up_at=$2 WHERE id=$1',[lead.id,dueInfo.dueAt]);
  await writeAudit(client,'WebIntakeCase',caseRow.id,'intake_picked_up',broker.id,{journeyId:journey.id,ownerId:owner.id,leadId:lead?.id||null,taskId,generation:caseRow.generation+1});
  return {caseId:caseRow.id,journeyId:journey.id,leadId:lead?.id||null,contactId,ownerId:owner.id,ownerName:owner.name,taskId,state:'human_owned'};
}

export async function promoteRecoveryCase(caseId,input,broker,client){
  const caseRow=await row(client,'SELECT * FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[caseId]);
  if(!caseRow||caseRow.case_kind!=='incomplete_recovery'||caseRow.state!=='human_owned')problem('Active recovery case not found',404);
  if(caseRow.fallback_owner_id!==broker.id)problem('Only the recovery owner can promote this intake',403);
  if(input.customerConfirmed!==true)problem('Customer confirmation is required before promotion',409);
  const journey=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1 FOR UPDATE',[caseRow.journey_id]);
  const summary={...journey.structured_summary,...input.requirement,budgetBand:clean(input.requirement?.budgetBand)};
  const missing=intakeMissingFields(summary,'promotion');if(missing.length)problem('Minimum recovery facts are missing',409,{error:'Minimum recovery facts are missing',missingFields:missing});
  const owner=await pickupOwner(broker.id,client),lead=await createLeadAndRequirement(caseRow,journey,owner,broker.id,summary,client);
  const current=await row(client,`UPDATE tasks SET status='completed',outcome='promoted',outcome_at=NOW(),completed_at=NOW(),updated_at=NOW()
    WHERE follow_up_case_id=$1 AND is_primary_next_action AND status IN ('open','in_progress') RETURNING id`,[caseRow.id]);
  if(current)await client.query(`INSERT INTO web_intake_contact_attempts(id,case_id,task_id,actor_id,outcome,notes) VALUES($1,$2,$3,$4,'promoted',$5)`,
    [uuid(),caseRow.id,current.id,broker.id,clean(input.notes)]);
  await client.query(`UPDATE lead_follow_up_cases SET lead_id=$2,state='promoted',promoted_at=NOW(),last_contact_attempt_at=NOW(),updated_at=NOW() WHERE id=$1`,[caseRow.id,lead.id]);
  const config=await currentConfiguration(client),dueInfo=addLandingDelay(new Date(),24*60,summary.customerTimezone,config),updated={...caseRow,lead_id:lead.id};
  const taskId=await createPrimaryTask({caseRow:updated,ownerId:broker.id,actorId:broker.id,kind:'qualify_lead',priority:8,dueAt:dueInfo.dueAt,dueBasis:'promotion',dueAtOpen:dueInfo.dueAtOpen,
    subject:'Qualify Lead',details:'Recovery confirmed and promoted. Review Requirement Version 1 and confirm any remaining unknown facts.',leadId:lead.id,contactId:journey.contact_id,
    timeZone:summary.customerTimezone},client);
  await writeAudit(client,'WebIntakeCase',caseRow.id,'recovery_promoted',broker.id,{journeyId:journey.id,leadId:lead.id,taskId});
  return {caseId:caseRow.id,leadId:lead.id,taskId,state:'promoted'};
}

export async function recordWebIntakeTaskOutcome(taskId,input,broker,client){
  const task=await row(client,`SELECT t.*,c.fallback_owner_id,c.state AS case_state,c.generation,c.lead_id AS case_lead_id,c.journey_id
    FROM tasks t JOIN lead_follow_up_cases c ON c.id=t.follow_up_case_id WHERE t.id=$1 FOR UPDATE OF t,c`,[taskId]);
  if(!task||!task.is_primary_next_action||!['open','in_progress'].includes(task.status))problem('Open WEB intake task not found',404);
  if(task.fallback_owner_id!==broker.id)problem('Only the assigned owner can record this outcome',403);
  const allowed=['contacted','no_answer','left_message','wrong_number','opted_out','meeting_confirmed','callback_rescheduled','not_interested'];
  if(!allowed.includes(input.outcome))problem('Choose a governed contact outcome',400);
  await client.query(`UPDATE tasks SET status='completed',outcome=$2,outcome_at=NOW(),completed_at=NOW(),updated_at=NOW() WHERE id=$1`,[task.id,input.outcome]);
  const attemptId=uuid();await client.query(`INSERT INTO web_intake_contact_attempts(id,case_id,task_id,actor_id,outcome,notes)
    VALUES($1,$2,$3,$4,$5,$6)`,[attemptId,task.follow_up_case_id,task.id,broker.id,input.outcome,clean(input.notes)]);
  await client.query('UPDATE lead_follow_up_cases SET last_contact_attempt_at=NOW(),stale_notice_due_at=NULL,stale_notified_at=NULL,stale_release_due_at=NULL,updated_at=NOW() WHERE id=$1',[task.follow_up_case_id]);
  let successorTaskId=null,nextState=task.case_state;
  if(['wrong_number','opted_out','not_interested'].includes(input.outcome)){
    nextState='closed';await client.query(`UPDATE lead_follow_up_cases SET state='closed',close_outcome=$2,updated_at=NOW() WHERE id=$1`,[
      task.follow_up_case_id,input.outcome==='wrong_number'?'wrong_person':input.outcome]);
  }else if(input.outcome==='meeting_confirmed'){
    nextState='human_owned';
  }else{
    const attempt=Number(task.attempt_number||1),journey=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1',[task.journey_id]),config=await currentConfiguration(client);
    if(['no_answer','left_message'].includes(input.outcome)&&attempt>=4){
      nextState='no_response';await client.query("UPDATE lead_follow_up_cases SET state='no_response',updated_at=NOW() WHERE id=$1",[task.follow_up_case_id]);
    }else{
      const delay=attempt===1?120:attempt===2?24*60:attempt===3?48*60:24*60,dueInfo=addLandingDelay(new Date(),delay,journey?.structured_summary?.customerTimezone,config);
      successorTaskId=await createPrimaryTask({caseRow:{id:task.follow_up_case_id},ownerId:broker.id,actorId:broker.id,kind:'follow_up_attempt',priority:5,dueAt:dueInfo.dueAt,
        dueBasis:'attempt_cadence',dueAtOpen:dueInfo.dueAtOpen,subject:input.outcome==='contacted'?'Continue customer follow-up':'Retry customer contact',
        details:'Successor task created from the governed WEB intake attempt cadence.',leadId:task.case_lead_id,contactId:task.contact_id,
        timeZone:journey?.structured_summary?.customerTimezone,attemptNumber:attempt+1},client);
      await client.query('UPDATE web_intake_contact_attempts SET successor_task_id=$2 WHERE id=$1',[attemptId,successorTaskId]);
    }
  }
  await writeAudit(client,'WebIntakeCase',task.follow_up_case_id,'contact_outcome_recorded',broker.id,{taskId:task.id,outcome:input.outcome,successorTaskId,nextState});
  return {caseId:task.follow_up_case_id,outcome:input.outcome,successorTaskId,state:nextState};
}

async function createEscalation(caseRow,actorId,client){
  const managers=await rows(client,`SELECT DISTINCT b.id FROM brokers b LEFT JOIN team_memberships tm ON tm.broker_id=b.id AND tm.ends_at IS NULL
    WHERE b.status='active' AND b.role='internal_broker' AND b.job_role='manager'
      AND ($1::uuid IS NULL OR b.team_id=$1 OR tm.team_id=$1)`,[caseRow.assigned_team_id||null]);
  if(!managers.length){
    await client.query(`INSERT INTO web_intake_configuration_exceptions(id,case_id,exception_code,details)
      VALUES($1,$2,'no_escalation_recipient',$3::jsonb) ON CONFLICT(case_id,exception_code) WHERE state='open' DO NOTHING`,[
        uuid(),caseRow.id,JSON.stringify({reason:'No active Manager for intake scope'})]);
    return {recipientCount:0};
  }
  for(const manager of managers){
    await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,created_by,task_type,
      follow_up_case_id,task_kind,is_primary_next_action)
      VALUES($1,$2,$3,'WEB intake escalation','An intake is still unpicked or requires stale-owner review. Escalation never auto-assigns.',$4,'urgent','open',NOW(),$5,
      'web_intake_follow_up',$6,'intake_escalation',FALSE)`,[uuid(),caseRow.lead_id,caseRow.contact_id,manager.id,actorId,caseRow.id]);
  }
  return {recipientCount:managers.length};
}

export async function reconcileWebIntake({actorId,limit=100}={},client){
  if(!actorId)problem('A configured WEB intake system actor is required',503);
  const bounded=Math.max(1,Math.min(Number(limit)||100,500)),now=new Date();
  const expiring=await rows(client,`SELECT * FROM web_intake_journeys WHERE state='in_progress' AND resume_expires_at<=NOW()
    ORDER BY resume_expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`,[bounded]);
  let dropped=0,escalated=0,staleNotified=0,released=0,deidentified=0;
  for(const journey of expiring){
    await client.query(`UPDATE web_intake_journeys SET state='dropped_incomplete',dropped_at=resume_expires_at,resume_expires_at=NULL,updated_at=NOW() WHERE id=$1`,[journey.id]);
    const updated=await row(client,'SELECT * FROM web_intake_journeys WHERE id=$1',[journey.id]);
    const event=updated.current_event_id?await row(client,'SELECT * FROM website_intake_events WHERE id=$1',[updated.current_event_id]):null;
    const payload=event?.received_payload||{eventId:event?.event_id,form:updated.source_form_id,contact:{},consent:{},location:{}};
    const claim=await row(client,'SELECT matched_contact_id,match_confidence FROM web_intake_provisional_identities WHERE id=$1',[updated.provisional_identity_id]);
    await createOrRouteCase({journey:updated,event,payload,actorId,
      contactId:claim?.match_confidence==='deterministic'?claim.matched_contact_id:null,
      identityAmbiguous:claim?.match_confidence==='candidate'},client);dropped++;
    await writeAudit(client,'WebIntakeJourney',journey.id,'journey_dropped_incomplete',actorId,{lastActivityAt:journey.last_activity_at,droppedAt:journey.resume_expires_at});
  }
  const dueCases=await rows(client,`SELECT c.*,l.assigned_team_id,j.contact_id FROM lead_follow_up_cases c JOIN web_intake_journeys j ON j.id=c.journey_id
    LEFT JOIN leads l ON l.id=c.lead_id WHERE c.fallback_owner_id IS NULL AND c.escalated_at IS NULL AND c.escalation_due_at<=NOW()
    ORDER BY c.escalation_due_at,c.id LIMIT $1 FOR UPDATE OF c SKIP LOCKED`,[bounded]);
  for(const item of dueCases){const result=await createEscalation(item,actorId,client);await client.query('UPDATE lead_follow_up_cases SET escalated_at=NOW(),updated_at=NOW() WHERE id=$1',[item.id]);escalated++;
    await writeAudit(client,'WebIntakeCase',item.id,'pickup_escalated',actorId,{recipientCount:result.recipientCount});}
  const staleNotices=await rows(client,`SELECT c.*,j.contact_id FROM lead_follow_up_cases c JOIN web_intake_journeys j ON j.id=c.journey_id
    WHERE c.fallback_owner_id IS NOT NULL AND c.last_contact_attempt_at IS NULL AND c.stale_notified_at IS NULL
      AND c.stale_notice_due_at<=NOW() AND c.state IN ('human_owned','promoted')
    ORDER BY c.stale_notice_due_at,c.id LIMIT $1 FOR UPDATE OF c SKIP LOCKED`,[bounded]);
  for(const item of staleNotices){
    await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,created_by,task_type,
      follow_up_case_id,task_kind,is_primary_next_action)
      VALUES($1,$2,$3,'WEB intake ownership reminder','No contact attempt has been recorded. Act before the item is released to the shared intake desk.',
      $4,'high','open',NOW(),$5,'web_intake_follow_up',$6,'stale_owner_notice',FALSE)`,
    [uuid(),item.lead_id,item.contact_id,item.fallback_owner_id,actorId,item.id]);
    const result=await createEscalation(item,actorId,client);
    await client.query('UPDATE lead_follow_up_cases SET stale_notified_at=NOW(),updated_at=NOW() WHERE id=$1',[item.id]);staleNotified++;
    await writeAudit(client,'WebIntakeCase',item.id,'stale_ownership_notified',actorId,{ownerId:item.fallback_owner_id,managerRecipientCount:result.recipientCount});
  }
  const stale=await rows(client,`SELECT * FROM lead_follow_up_cases WHERE fallback_owner_id IS NOT NULL AND last_contact_attempt_at IS NULL
    AND stale_release_due_at<=NOW() AND state IN ('human_owned','promoted') ORDER BY stale_release_due_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`,[bounded]);
  for(const item of stale){
    await client.query(`UPDATE tasks SET status='cancelled',outcome='released_stale',outcome_at=NOW(),completed_at=NOW(),updated_at=NOW()
      WHERE follow_up_case_id=$1 AND is_primary_next_action AND status IN ('open','in_progress')`,[item.id]);
    await client.query(`UPDATE lead_follow_up_cases SET state='released',previous_owner_id=fallback_owner_id,released_from_owner=fallback_owner_id,released_at=NOW(),
      released_reason='No contact attempt after stale ownership timers',fallback_owner_id=NULL,picked_up_by=NULL,picked_up_at=NULL,next_action_task_id=NULL,
      generation=generation+1,stale_notice_due_at=NULL,stale_release_due_at=NULL,updated_at=NOW() WHERE id=$1`,[item.id]);released++;
    await writeAudit(client,'WebIntakeCase',item.id,'stale_ownership_released',actorId,{previousOwnerId:item.fallback_owner_id,releasedAt:now});
  }
  const claims=await rows(client,`SELECT id FROM web_intake_provisional_identities WHERE state='provisional' AND expires_at<=NOW()
    ORDER BY expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`,[bounded]);
  for(const claim of claims){await client.query(`UPDATE web_intake_provisional_identities SET state='expired',encrypted_identity=NULL,masked_name=NULL,masked_email=NULL,
    masked_phone=NULL,phone_match_hash=NULL,email_match_hash=NULL,consent_statement_ref=NULL,permitted_channels=ARRAY[]::text[],deidentified_at=NOW(),updated_at=NOW() WHERE id=$1`,[claim.id]);deidentified++;
    await writeAudit(client,'WebIntakeIdentity',claim.id,'provisional_identity_deidentified',actorId,{});}
  return {dropped,escalated,staleNotified,released,deidentified};
}

export async function listWebIntakeDesk(broker,filters,client){
  const role=broker?.role==='admin'?'admin':broker?.role==='internal_broker'?broker.jobRole:null;
  if(!['admin','sales_agent','manager'].includes(role))problem('WEB Intake Leads access required',403);
  const view=clean(filters.view)||'all',source=clean(filters.source)||'all',campaign=clean(filters.campaign)||'all';
  const allowedViews=['all','in_progress','dropped','completed','assigned','needs_attention','escalated','released'];
  if(!allowedViews.includes(view)||!['all','contact_form','nia','meta','other'].includes(source))problem('Invalid WEB intake filter',400);
  const data=await rows(client,`WITH latest AS (
    SELECT DISTINCT ON (j.chain_root_journey_id) j.*,c.state AS case_state,c.case_kind,c.fallback_owner_id,c.escalation_due_at,c.escalated_at,c.lead_id,
      c.requested_callback_at,c.requested_meeting_at,
      c.previous_owner_id,c.next_action_task_id,p.masked_name,p.masked_email,p.masked_phone,p.match_confidence,b.name AS owner_name,t.subject AS next_action,t.due_at
    FROM web_intake_journeys j JOIN web_intake_provisional_identities p ON p.id=j.provisional_identity_id
    LEFT JOIN lead_follow_up_cases c ON c.id=j.follow_up_case_id LEFT JOIN brokers b ON b.id=c.fallback_owner_id LEFT JOIN tasks t ON t.id=c.next_action_task_id
    ORDER BY j.chain_root_journey_id,j.started_at DESC,j.id
  ) SELECT * FROM latest WHERE
    ($1='all' OR ($1='in_progress' AND state='in_progress') OR ($1='dropped' AND state='dropped_incomplete') OR
     ($1='completed' AND state='completed' AND case_state='unassigned') OR ($1='assigned' AND fallback_owner_id IS NOT NULL) OR
     ($1='needs_attention' AND case_state='needs_attention') OR ($1='escalated' AND escalated_at IS NOT NULL) OR ($1='released' AND case_state='released'))
    AND ($2='all' OR ($2='meta' AND source_system='meta') OR ($2='nia' AND source_form_id LIKE 'ai_%') OR
      ($2='contact_form' AND source_form_id IN ('contact_form','contact_us','speak_to_advisor_v2','brochure_download_v2')) OR
      ($2='other' AND source_system<>'meta' AND source_form_id NOT LIKE 'ai_%' AND source_form_id NOT IN ('contact_form','contact_us','speak_to_advisor_v2','brochure_download_v2')))
    AND ($3='all' OR ($3='none' AND source_campaign_code IS NULL) OR ($3='unmapped' AND campaign_mapping_status='unmapped') OR campaign_id::text=$3)
    ORDER BY CASE WHEN requested_meeting_at IS NOT NULL THEN 1 WHEN requested_callback_at IS NOT NULL THEN 2 WHEN escalated_at IS NOT NULL THEN 3 ELSE 4 END,
      COALESCE(due_at,escalation_due_at,last_activity_at),id LIMIT 200`,[view,source,campaign]);
  return data.map(item=>({...item,canPickup:role!=='admin'&&['unassigned','released'].includes(item.case_state),isReadOnly:item.state==='in_progress'||role==='admin'}));
}

export async function listMyWebIntakeQueue(broker,filter,client){
  if(broker?.role!=='internal_broker'||!['sales_agent','manager'].includes(broker.jobRole))problem('My Lead Queue access required',403);
  const view=clean(filter)||'active';if(!['active','due_today','overdue','recovery','no_response','closed'].includes(view))problem('Invalid queue filter',400);
  return rows(client,`SELECT c.id AS case_id,c.case_kind,c.state,c.lead_id,c.journey_id,j.source_system,j.source_form_id,j.source_campaign_code,
    j.structured_summary,j.missing_fields,p.masked_name,p.masked_email,p.masked_phone,t.id AS task_id,t.subject AS next_action,t.due_at,t.status AS task_status,
    t.landing_priority,t.attempt_number,c.last_contact_attempt_at
    FROM lead_follow_up_cases c JOIN web_intake_journeys j ON j.id=c.journey_id JOIN web_intake_provisional_identities p ON p.id=j.provisional_identity_id
    LEFT JOIN tasks t ON t.id=c.next_action_task_id WHERE c.fallback_owner_id=$1 AND
      ($2='active' AND c.state NOT IN ('closed','complete') OR $2='due_today' AND t.due_at::date=(NOW() AT TIME ZONE 'Asia/Dubai')::date OR
       $2='overdue' AND t.due_at<NOW() AND t.status IN ('open','in_progress') OR $2='recovery' AND c.case_kind='incomplete_recovery' OR
       $2='no_response' AND c.state='no_response' OR $2='closed' AND c.state IN ('closed','complete'))
    ORDER BY COALESCE(t.landing_priority,9),t.due_at NULLS LAST,c.updated_at DESC`,[broker.id,view]);
}

export async function backfillContactMatchKeys({limit=500}={},client,env=process.env){
  const secrets=requireIdentitySecrets(env),bounded=Math.max(1,Math.min(Number(limit)||500,2000));
  const channels=await rows(client,`SELECT ch.contact_id,ch.channel_kind,ch.normalized_value FROM contact_channels ch JOIN contacts c ON c.id=ch.contact_id
    WHERE c.lifecycle_status='active' AND ch.channel_kind IN ('Email','Phone') AND ch.normalized_value IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM web_intake_contact_match_keys k WHERE k.contact_id=ch.contact_id AND k.channel_kind=ch.channel_kind AND k.match_key_version=$1)
    ORDER BY ch.contact_id,ch.channel_kind LIMIT $2`,[secrets.matchKeyVersion,bounded]);
  for(const channel of channels)await client.query(`INSERT INTO web_intake_contact_match_keys(contact_id,channel_kind,match_key_version,match_hash)
    VALUES($1,$2,$3,$4) ON CONFLICT(contact_id,channel_kind,match_key_version) DO NOTHING`,[
      channel.contact_id,channel.channel_kind,secrets.matchKeyVersion,webIdentityMatchHash(channel.normalized_value,secrets.matchKey)
    ]);
  return {processed:channels.length,keyVersion:secrets.matchKeyVersion};
}
