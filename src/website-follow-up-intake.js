import crypto from 'node:crypto';
import {openNonvoiceCase} from './nonvoice-follow-up-store.js';

const one=async(client,sql,params)=>(await client.query(sql,params)).rows[0];
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function websiteFollowUpInput(payload={}) {
  const location=payload.location&&typeof payload.location==='object'?payload.location:{};
  const country=text(location.country),timeZone=text(location.timeZone);
  const locationConfirmed=location.confirmed===true&&(
    (country==='AE'&&timeZone==='Asia/Dubai')||(country==='IN'&&timeZone==='Asia/Kolkata')
  );
  const consent=payload.consent&&typeof payload.consent==='object'?payload.consent:{};
  return {
    country,timeZone,locationConfirmed,
    consent:{
      statementVersion:text(consent.statementVersion),
      whatsapp:consent.aiWhatsapp===true,
      email:consent.aiEmail===true
    },
    declaredRequirements:{
      source:'website',
      form:text(payload.form)||'website_intake',
      completeness:payload.intakeCompleteness==='partial'?'partial':'complete',
      purpose:text(payload.requirement?.purpose),
      timeline:text(payload.requirement?.timelineCode),
      budgetMin:payload.requirement?.budgetMin??null,
      budgetMax:payload.requirement?.budgetMax??null,
      fundingMethod:text(payload.requirement?.fundingMethod),
      areas:Array.isArray(payload.requirement?.areas)?payload.requirement.areas:[],
      propertyTypes:Array.isArray(payload.requirement?.propertyTypes)?payload.requirement.propertyTypes:[]
    }
  };
}

export async function openWebsiteFollowUp({event,lead,payload,actorId},client) {
  const sourceEventId=text(payload.eventId),sourceForm=text(payload.form)||'website_intake';
  if(!event?.id||!lead?.id||!sourceEventId)return {status:'not_opened'};
  const referenceDigest=digest({eventId:sourceEventId,form:sourceForm,leadId:lead.id,payloadHash:event.payloadHash||null});
  let source=await one(client,`INSERT INTO lead_source_inbox
    (id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,source_created_at,received_at,state,lead_id,processed_at,website_intake_event_id)
    VALUES($1,'website',$2,$3,$4,$5,COALESCE($6::timestamptz,$7::timestamptz,NOW()),COALESCE($7::timestamptz,NOW()),'accepted',$8,NOW(),$9)
    ON CONFLICT(source_system,source_account_id,source_event_id) DO NOTHING RETURNING *`,[
      crypto.randomUUID(),text(payload.sourceWebsite)||'nysarealty.com',sourceEventId,sourceForm,referenceDigest,
      payload.profile?.completedAt||null,event.receivedAt||null,lead.id,event.id
    ]);
  if(!source){
    source=await one(client,"SELECT * FROM lead_source_inbox WHERE source_system='website' AND source_account_id=$1 AND source_event_id=$2",[text(payload.sourceWebsite)||'nysarealty.com',sourceEventId]);
    if(!source||source.reference_digest!==referenceDigest||source.lead_id!==lead.id)throw Object.assign(new Error('ALTERED_WEBSITE_EVENT'),{statusCode:409});
  }
  const existing=await one(client,'SELECT * FROM lead_follow_up_cases WHERE source_inbox_id=$1 OR lead_id=$2 ORDER BY created_at LIMIT 1',[source.id,lead.id]);
  if(existing)return {status:existing.state,caseId:existing.id,duplicate:true,sourceInboxId:source.id};
  const setup=await one(client,'SELECT draft FROM lead_integration_setup WHERE singleton=TRUE',[]),ownerId=text(setup?.draft?.fallbackOwnerId);
  if(!ownerId)return {status:'setup_required',sourceInboxId:source.id};
  const owner=await one(client,"SELECT id FROM brokers WHERE id=$1 AND status='active' AND role='internal_broker' AND job_role IN ('sales_agent','manager')",[ownerId]);
  if(!owner)return {status:'setup_required',sourceInboxId:source.id};
  const input=websiteFollowUpInput(payload);
  const responseCase=await openNonvoiceCase({sourceInboxId:source.id,leadId:lead.id,fallbackOwnerId:owner.id,actorId,
    country:input.country,timeZone:input.timeZone,locationConfirmed:input.locationConfirmed,
    consent:{...input.consent,evidenceRef:`website:${event.id}`}},client);
  await client.query('UPDATE lead_follow_up_cases SET declared_requirements=$2::jsonb WHERE id=$1',[responseCase.id,JSON.stringify(input.declaredRequirements)]);
  return {status:responseCase.state,caseId:responseCase.id,sourceInboxId:source.id};
}
