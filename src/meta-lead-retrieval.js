import crypto from 'node:crypto';
import {validateContactIdentity} from './crm-domain.js';
import {recordWebIntakeJourney} from './web-intake-workflow.js';
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
 let response;try{response=await fetchImpl(`https://graph.facebook.com/${graphVersion}/${reference.eventId}?fields=id,form_id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name`,
  {headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(10000)});}catch{problem('META_RETRIEVAL_UNAVAILABLE');}
 if(!response.ok)problem('META_RETRIEVAL_UNAVAILABLE');
 const raw=await response.text();if(Buffer.byteLength(raw)>256*1024)problem('META_LEAD_TOO_LARGE');
 let data;try{data=JSON.parse(raw);}catch{problem('META_RESPONSE_INVALID');}
 if(String(data.id)!==reference.eventId||String(data.form_id)!==reference.formId)problem('META_LEAD_BINDING_FAILED');
 return data;
}
// A caller transaction makes customer/lead linking, source evidence and outbox atomic.
export async function acceptRetrievedMetaLead({sourceId,data,mapping,actorId,ownerId=null,evidenceKey},client){
 const source=await get(client,'SELECT * FROM lead_source_inbox WHERE id=$1 FOR UPDATE',[sourceId]);if(!source)problem('SOURCE_NOT_FOUND');
 if(source.state==='accepted')return {leadId:source.lead_id||null,journeyId:source.web_intake_journey_id||null,duplicate:true};
 if(String(data.id)!==source.source_event_id||String(data.form_id)!==source.source_form_id||!mapping.pageIds?.includes(source.source_account_id))problem('META_LEAD_BINDING_FAILED');
 const sealed=sealLeadEvidence(data,evidenceKey),digest=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
 await client.query(`INSERT INTO lead_response_evidence(id,source_inbox_id,encrypted_payload,payload_digest,expires_at)
  VALUES($1,$2,$3,$4,NOW()+INTERVAL '12 months') ON CONFLICT(source_inbox_id) DO NOTHING`,[uuid(),source.id,sealed,digest]);
 const externalCampaignCode=data.campaign_id?String(data.campaign_id):null;
 const campaignMapping=externalCampaignCode?await get(client,`SELECT m.campaign_id FROM campaign_external_mappings m
  JOIN marketing_campaigns c ON c.id=m.campaign_id
  WHERE m.status='active' AND c.status<>'retired' AND LOWER(m.source_code)='meta' AND LOWER(m.external_campaign_code)=LOWER($1)`,[externalCampaignCode]):null;
 await client.query(`UPDATE lead_source_inbox SET external_campaign_code=$2,external_campaign_name=$3,external_adset_code=$4,
  external_adset_name=$5,external_ad_code=$6,external_ad_name=$7,campaign_id=$8,campaign_mapping_status=$9 WHERE id=$1`,[
   source.id,externalCampaignCode,data.campaign_name?String(data.campaign_name):null,data.adset_id?String(data.adset_id):null,
   data.adset_name?String(data.adset_name):null,data.ad_id?String(data.ad_id):null,data.ad_name?String(data.ad_name):null,
   campaignMapping?.campaign_id||null,externalCampaignCode?(campaignMapping?'mapped':'unmapped'):'not_supplied']);
 let normalized;try{normalized=mapMetaLead(data,mapping);}catch{
  await client.query("UPDATE lead_source_inbox SET state='needs_review',error_code='FORM_OR_CONTACT_REVIEW_REQUIRED' WHERE id=$1",[source.id]);return {status:'mapping_review'};
 }
 const requirementDigest=crypto.createHash('sha256').update(JSON.stringify({formId:source.source_form_id,adId:data.ad_id||null,requirements:normalized.requirements})).digest('hex');
 await client.query('UPDATE lead_source_inbox SET requirement_digest=$2 WHERE id=$1',[source.id,requirementDigest]);
 const purpose=['own_use','investment','business','other'].includes(normalized.requirements.purpose)?normalized.requirements.purpose:null;
 const payload={eventId:source.source_event_id,source:'Social media',sourceWebsite:source.source_account_id,form:'meta_instant_form',
  intakeMode:'single_step',intakeCompleteness:'complete',journeyKey:`meta_${source.source_account_id}_${source.source_event_id}`,
  campaign:externalCampaignCode,title:'Meta Instant Form enquiry',businessType:'Unconfirmed',
  contact:{fullName:normalized.fullName,email:normalized.email,phone:normalized.phone,preferredChannel:normalized.phone?'WhatsApp':'Email'},
  requirement:{purpose,propertyTypes:[],areas:normalized.requirements.area?[normalized.requirements.area]:[],budgetMin:null,budgetMax:null,
   fundingMethod:'unknown',timelineCode:normalized.requirements.timeline||null,notes:null},
  consent:{marketing:Boolean(normalized.permission.whatsapp||normalized.permission.email),aiWhatsapp:normalized.permission.whatsapp,
   aiEmail:normalized.permission.email,statementVersion:normalized.permission.statementVersion},
  location:{country:normalized.country,timeZone:normalized.timeZone,confirmed:normalized.locationConfirmed}};
 const result=await recordWebIntakeJourney({event:{id:source.id,eventId:source.source_event_id,receivedAt:source.received_at,
   external_campaign_code:externalCampaignCode,campaign_id:campaignMapping?.campaign_id||null},payload,identity:normalized,actorId,sourceSystem:'meta'},client);
 await client.query("UPDATE lead_source_inbox SET state='accepted',lead_id=NULL,processed_at=NOW(),error_code=NULL WHERE id=$1",[source.id]);
 return {...result,leadId:null};
}
