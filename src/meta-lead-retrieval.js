import crypto from 'node:crypto';
import {validateContactIdentity} from './crm-domain.js';
import {openNonvoiceCase} from './nonvoice-follow-up-store.js';
const uuid=()=>crypto.randomUUID();
const get=async(c,s,p)=>(await c.query(s,p)).rows[0];
function problem(code){throw Object.assign(new Error(code),{statusCode:409});}
export function sealLeadEvidence(value,keyHex){
 if(!/^[a-f0-9]{64}$/i.test(keyHex||''))problem('EVIDENCE_KEY_REQUIRED');
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
 const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),bytes.toString('base64')].join('.');
}
export function readLeadEvidence(sealed,keyHex){
 if(!/^[a-f0-9]{64}$/i.test(keyHex||''))problem('EVIDENCE_KEY_REQUIRED');
 const [iv,tag,body]=sealed.split('.');const cipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),Buffer.from(iv,'base64'));
 cipher.setAuthTag(Buffer.from(tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(body,'base64')),cipher.final()]).toString('utf8'));
}
export function mapMetaLead(data,mapping){
 if(!Array.isArray(data?.field_data)||data.field_data.length>80||!mapping?.formIds?.includes(String(data.form_id)))problem('FORM_MAPPING_REQUIRED');
 const fields={};for(const entry of data.field_data){if(typeof entry?.name!=='string'||!Array.isArray(entry.values)||entry.values.length!==1||typeof entry.values[0]!=='string'||entry.values[0].length>2000)problem('FORM_ANSWERS_INVALID');
  if(Object.hasOwn(fields,entry.name))problem('DUPLICATE_FORM_ANSWER');fields[entry.name]=entry.values[0].trim();}
 const identity=validateContactIdentity(fields.email,fields.phone_number);if(identity.error)problem('CONTACT_REVIEW_REQUIRED');
 const fullName=fields.full_name||[fields.first_name,fields.last_name].filter(Boolean).join(' ');if(!fullName||fullName.length>200)problem('CONTACT_NAME_REQUIRED');
 const granted=Boolean(mapping.statementVersion&&mapping.consentField&&mapping.consentAcceptedValue&&fields[mapping.consentField]===mapping.consentAcceptedValue);
 const country=fields[mapping.countryField]||null,timeZone=fields[mapping.timeZoneField]||null;
 const requirements={timeline:fields[mapping.timelineField]||null,budget:fields[mapping.budgetField]||null,
  purpose:fields[mapping.purposeField]||null,area:fields[mapping.areaField]||null};
 return {fullName,...identity,country,timeZone,locationConfirmed:((country==='AE'&&timeZone==='Asia/Dubai')||(country==='IN'&&timeZone==='Asia/Kolkata')),
  requirements,permission:{statementVersion:mapping.statementVersion||null,whatsapp:granted,email:granted},phoneVerified:false};
}
export async function retrieveMetaLead(reference,{accessToken,graphVersion,fetchImpl=fetch}){
 if(!accessToken||!/^v\d+\.\d+$/.test(graphVersion||''))problem('META_RETRIEVAL_NOT_CONFIGURED');
 if(!/^\d{1,100}$/.test(reference.eventId))problem('INVALID_META_REFERENCE');
 let response;try{response=await fetchImpl(`https://graph.facebook.com/${graphVersion}/${reference.eventId}?fields=id,form_id,created_time,field_data,ad_id`,
  {headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(10000)});}catch{problem('META_RETRIEVAL_UNAVAILABLE');}
 if(!response.ok)problem('META_RETRIEVAL_UNAVAILABLE');
 const raw=await response.text();if(Buffer.byteLength(raw)>256*1024)problem('META_LEAD_TOO_LARGE');
 let data;try{data=JSON.parse(raw);}catch{problem('META_RESPONSE_INVALID');}
 if(String(data.id)!==reference.eventId||String(data.form_id)!==reference.formId)problem('META_LEAD_BINDING_FAILED');
 return data;
}
// A caller transaction makes customer/lead linking, source evidence and outbox atomic.
export async function acceptRetrievedMetaLead({sourceId,data,mapping,actorId,ownerId,evidenceKey},client){
 const source=await get(client,'SELECT * FROM lead_source_inbox WHERE id=$1 FOR UPDATE',[sourceId]);if(!source)problem('SOURCE_NOT_FOUND');
 if(source.state==='accepted')return {leadId:source.lead_id,duplicate:true};
 if(String(data.id)!==source.source_event_id||String(data.form_id)!==source.source_form_id||!mapping.pageIds?.includes(source.source_account_id))problem('META_LEAD_BINDING_FAILED');
 const sealed=sealLeadEvidence(data,evidenceKey),digest=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
 await client.query(`INSERT INTO lead_response_evidence(id,source_inbox_id,encrypted_payload,payload_digest,expires_at)
  VALUES($1,$2,$3,$4,NOW()+INTERVAL '12 months') ON CONFLICT(source_inbox_id) DO NOTHING`,[uuid(),source.id,sealed,digest]);
 let normalized;try{normalized=mapMetaLead(data,mapping);}catch{
  await client.query("UPDATE lead_source_inbox SET state='needs_review',error_code='FORM_OR_CONTACT_REVIEW_REQUIRED' WHERE id=$1",[source.id]);return {status:'mapping_review'};
 }
 for(const value of [normalized.email,normalized.phone].filter(Boolean).sort())await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['lead-contact:'+value]);
 const matches=await client.query(`SELECT DISTINCT c.id FROM contacts c LEFT JOIN contact_channels ch ON ch.contact_id=c.id
   WHERE c.lifecycle_status='active' AND (($1::text IS NOT NULL AND (LOWER(c.email)=$1 OR (ch.channel_kind='Email' AND ch.normalized_value=$1)))
   OR ($2::text IS NOT NULL AND (c.phone=$2 OR (ch.channel_kind='Phone' AND ch.normalized_value=$2))))`,[normalized.email,normalized.phone]);
 if(matches.rows.length>1){await client.query("UPDATE lead_source_inbox SET state='needs_review',error_code='IDENTITY_CONFLICT' WHERE id=$1",[source.id]);return {status:'identity_review'};}
 const contactId=matches.rows[0]?.id||uuid();
 if(!matches.rows.length){await client.query(`INSERT INTO contacts(id,full_name,email,phone,contact_type,created_by,email_status,phone_status,source_first_seen)
  VALUES($1,$2,$3,$4,'buyer',$5,$6,$7,'Social media')`,[contactId,normalized.fullName,normalized.email,normalized.phone,actorId,normalized.emailStatus,normalized.phoneStatus]);
  await client.query("INSERT INTO contact_roles(id,contact_id,role_code,created_by) VALUES($1,$2,'buyer',$3)",[uuid(),contactId,actorId]);
  for(const [kind,value]of [['Email',normalized.email],['Phone',normalized.phone]])if(value)await client.query(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,verification_status,is_primary,created_by)
   VALUES($1,$2,$3,$4,$4,'format_valid',1,$5)`,[uuid(),contactId,kind,value,actorId]);
 }
 const requirementDigest=crypto.createHash('sha256').update(JSON.stringify({formId:source.source_form_id,adId:data.ad_id||null,requirements:normalized.requirements})).digest('hex');
 const duplicate=await get(client,`SELECT e.lead_id FROM lead_source_inbox e JOIN leads l ON l.id=e.lead_id
  WHERE e.state='accepted' AND e.requirement_digest=$1 AND l.contact_id=$2 AND e.received_at>=NOW()-INTERVAL '30 days' AND e.id<>$3 LIMIT 1`,[requirementDigest,contactId,source.id]);
 if(duplicate){await client.query("UPDATE lead_source_inbox SET state='needs_review',error_code='POSSIBLE_DUPLICATE_ENQUIRY' WHERE id=$1",[source.id]);return {status:'duplicate_review'};}
 await client.query('UPDATE lead_source_inbox SET requirement_digest=$2 WHERE id=$1',[source.id,requirementDigest]);
 const rule=await get(client,`SELECT r.* FROM routing_rules r WHERE r.active=1 AND (r.source IS NULL OR r.source='Social media') AND (r.business_type IS NULL OR r.business_type='Unconfirmed') AND r.area_id IS NULL ORDER BY r.priority,r.id LIMIT 1`,[]);
 const routedTeam=rule?.team_id?(await get(client,'SELECT id FROM teams WHERE id=$1 AND active=1',[rule.team_id]))?.id:null;
 const leadId=uuid();await client.query(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,assigned_to,assignment_status,
   received_at,external_source_id,source_page,source_form,created_by,assigned_team_id,routing_reason)
   VALUES($1,$2,'Meta Instant Form enquiry','Social media','Unconfirmed','Unassessed',NULL,'unassigned',$3,$4,$5,$6,$7,$8,$9)`,
   [leadId,contactId,source.source_created_at,'meta:'+source.source_account_id+':'+source.source_event_id,source.source_account_id,source.source_form_id,actorId,routedTeam,routedTeam?'Existing source routing rule':'Routing setup requires review; designated fallback retained']);
 await client.query(`INSERT INTO lead_assignments(id,lead_id,sequence_no,status,assigned_by,team_id) VALUES($1,$2,1,'queued',$3,$4)`,[uuid(),leadId,actorId,routedTeam]);
 await client.query("UPDATE lead_source_inbox SET state='accepted',lead_id=$2,processed_at=NOW(),error_code=NULL WHERE id=$1",[source.id,leadId]);
 const responseCase=await openNonvoiceCase({sourceInboxId:source.id,leadId,fallbackOwnerId:ownerId,actorId,country:normalized.country,
  timeZone:normalized.timeZone,locationConfirmed:normalized.locationConfirmed,consent:{...normalized.permission,evidenceRef:'source:'+source.id}},client);
 await client.query('UPDATE lead_follow_up_cases SET declared_requirements=$2::jsonb WHERE id=$1',[responseCase.id,JSON.stringify(normalized.requirements)]);
 return {leadId,caseId:responseCase.id,status:responseCase.state};
}
