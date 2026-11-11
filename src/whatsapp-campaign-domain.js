import crypto from 'node:crypto';

export const WA_STAGE_B_MAX_IMPORT_ROWS=5000;
export const WA_TEMPLATE_FRESHNESS_MS=5*60*1000;
export const WA_CONSENT_STATUSES=Object.freeze(['verified','evidence_pending','withdrawn','denied']);
export const WA_SOURCE_TYPES=Object.freeze(['existing_crm','website','ctwa','property_portal','event','referral','purchased_list','other']);
const CONSENT=new Set(WA_CONSENT_STATUSES);
const TEMPLATE_STATUS=new Set(['approved','pending','rejected','paused','disabled','unknown']);
const CAMPAIGN_STATUS=new Set(['draft','pending_approval','approved','returned','retired']);
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

export function normalizeWhatsAppPhone(value){
  const raw=clean(value,40),digits=raw.replace(/[^0-9]/g,'');
  if(!digits||digits.length<8||digits.length>15||digits.startsWith('0'))return null;
  return `+${digits}`;
}

function email(value){
  const normalized=clean(value,254).toLowerCase();
  return normalized&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:null;
}

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
}

export function recipientFingerprint(row){
  return crypto.createHash('sha256').update(JSON.stringify(stable({name:row.name,phone:row.phone,email:row.email,requirements:row.requirements}))).digest('hex');
}

export function reviewWhatsAppRecipientRows(rows,{existingPhones=new Map()}={}){
  if(!Array.isArray(rows))throw new Error('Recipient rows are required');
  if(rows.length<1||rows.length>WA_STAGE_B_MAX_IMPORT_ROWS)throw new Error(`Recipient import must contain 1 to ${WA_STAGE_B_MAX_IMPORT_ROWS} rows`);
  const firstByPhone=new Map();
  const reviewed=rows.map((source,index)=>{
    const rowNumber=index+1,name=clean(source?.name,160),phone=normalizeWhatsAppPhone(source?.phone),normalizedEmail=email(source?.email),errors=[];
    if(!name)errors.push('Name is required');
    if(!phone)errors.push('Phone must be an E.164 number with country code');
    if(clean(source?.email)&&!normalizedEmail)errors.push('Email is invalid');
    const consentStatus=CONSENT.has(clean(source?.consentStatus,30))?clean(source?.consentStatus,30):'evidence_pending';
    const consentEvidenceRef=clean(source?.consentEvidenceRef,160)||null;
    if(consentStatus==='verified'&&!consentEvidenceRef)errors.push('Verified consent requires an evidence reference');
    const requirements=source?.requirements&&typeof source.requirements==='object'&&!Array.isArray(source.requirements)?stable(source.requirements):{};
    const tags=Array.isArray(source?.tags)?[...new Set(source.tags.map(item=>clean(item,80)).filter(Boolean))].sort():[];
    const duplicateInFile=phone&&firstByPhone.has(phone)?firstByPhone.get(phone):null;
    if(phone&&!firstByPhone.has(phone))firstByPhone.set(phone,rowNumber);
    const existing=phone?(existingPhones.get(phone)||null):null;
    const action=errors.length?'invalid':duplicateInFile||existing?'review_required':'ready';
    const normalized={rowNumber,name,phone,email:normalizedEmail,requirements,tags,source:clean(source?.source,80)||'bulk_upload',consentStatus,consentEvidenceRef,duplicateInFile,existingMatch:existing,action,errors};
    return {...normalized,fingerprint:errors.length?null:recipientFingerprint(normalized)};
  });
  return {rows:reviewed,counts:Object.fromEntries(['ready','review_required','invalid'].map(action=>[action,reviewed.filter(row=>row.action===action).length]))};
}

const allowedSegmentKeys=new Set(['batchIds','sources','tagsAny','areasAny','businessTypes','transactionTypes','projects','propertyTypes','bedroomsMin','bedroomsMax','timeframes','languages','ownerIds','consentStatus','budgetMin','budgetMax']);
export function normalizeAudienceSegmentDefinition(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Segment definition must be an object');
  const unknown=Object.keys(value).filter(key=>!allowedSegmentKeys.has(key));
  if(unknown.length)throw new Error(`Unsupported segment filter: ${unknown[0]}`);
  const list=key=>[...new Set((Array.isArray(value[key])?value[key]:[]).map(item=>clean(item,160)).filter(Boolean))].sort();
  const consentStatus=value.consentStatus===undefined?null:clean(value.consentStatus,30);
  if(consentStatus&&!CONSENT.has(consentStatus))throw new Error('Invalid segment consent status');
  const number=key=>value[key]===undefined||value[key]===null||value[key]===''?null:Number(value[key]);
  const budgetMin=number('budgetMin'),budgetMax=number('budgetMax'),bedroomsMin=number('bedroomsMin'),bedroomsMax=number('bedroomsMax');
  if((budgetMin!==null&&!Number.isFinite(budgetMin))||(budgetMax!==null&&!Number.isFinite(budgetMax))||(budgetMin!==null&&budgetMax!==null&&budgetMin>budgetMax))throw new Error('Invalid segment budget range');
  if((bedroomsMin!==null&&!Number.isFinite(bedroomsMin))||(bedroomsMax!==null&&!Number.isFinite(bedroomsMax))||(bedroomsMin!==null&&bedroomsMax!==null&&bedroomsMin>bedroomsMax))throw new Error('Invalid segment bedroom range');
  const transactionTypes=list('transactionTypes').length?list('transactionTypes'):list('businessTypes');
  return {batchIds:list('batchIds'),sources:list('sources'),tagsAny:list('tagsAny'),areasAny:list('areasAny'),transactionTypes,projects:list('projects'),propertyTypes:list('propertyTypes'),bedroomsMin,bedroomsMax,timeframes:list('timeframes'),languages:list('languages'),ownerIds:list('ownerIds'),consentStatus,budgetMin,budgetMax};
}

export function recipientMatchesSegment(recipient,definition){
  const filter=normalizeAudienceSegmentDefinition(definition),requirements=recipient?.requirements||{},recipientTags=new Set(recipient?.tags||[]),areas=new Set(requirements.areas||requirements.preferredAreas||[]);
  if(filter.batchIds.length&&!filter.batchIds.includes(String(recipient?.batchId||'')))return false;
  if(filter.sources.length&&!filter.sources.includes(String(recipient?.source||'')))return false;
  if(filter.tagsAny.length&&!filter.tagsAny.some(tag=>recipientTags.has(tag)))return false;
  if(filter.areasAny.length&&!filter.areasAny.some(area=>areas.has(area)))return false;
  if(filter.transactionTypes.length&&!filter.transactionTypes.includes(String(requirements.transactionType||requirements.businessType||'')))return false;
  if(filter.projects.length&&!filter.projects.includes(String(requirements.project||'')))return false;
  if(filter.propertyTypes.length&&!filter.propertyTypes.includes(String(requirements.propertyType||'')))return false;
  const bedrooms=Number(requirements.bedrooms??NaN);
  if(filter.bedroomsMin!==null&&(!Number.isFinite(bedrooms)||bedrooms<filter.bedroomsMin))return false;
  if(filter.bedroomsMax!==null&&(!Number.isFinite(bedrooms)||bedrooms>filter.bedroomsMax))return false;
  if(filter.timeframes.length&&!filter.timeframes.includes(String(requirements.timeframe||'')))return false;
  if(filter.languages.length&&!filter.languages.includes(String(requirements.language||'')))return false;
  if(filter.ownerIds.length&&!filter.ownerIds.includes(String(requirements.ownerId||'')))return false;
  if(filter.consentStatus&&filter.consentStatus!==recipient?.consentStatus)return false;
  const budget=Number(requirements.budgetMax??requirements.budget??NaN);
  if(filter.budgetMin!==null&&(!Number.isFinite(budget)||budget<filter.budgetMin))return false;
  if(filter.budgetMax!==null&&(!Number.isFinite(budget)||budget>filter.budgetMax))return false;
  return true;
}

export function uniqueSegmentPhoneCount(recipients,definition){
  return new Set((Array.isArray(recipients)?recipients:[]).filter(item=>recipientMatchesSegment(item,definition)).map(item=>normalizeWhatsAppPhone(item?.phone||item?.normalizedPhone)).filter(Boolean)).size;
}

export function recipientEligibility(recipient){
  if(!normalizeWhatsAppPhone(recipient?.phone))return{eligible:false,reason:'invalid_phone'};
  if(recipient?.suppressed===true||['withdrawn','denied'].includes(recipient?.consentStatus))return{eligible:false,reason:'suppressed'};
  if(recipient?.consentStatus!=='verified'||!clean(recipient?.consentEvidenceRef,160))return{eligible:false,reason:'consent_not_verified'};
  return{eligible:true,reason:'eligible'};
}

const OPT_OUT_KEYWORDS=new Set(['stop','stop promotions','unsubscribe','توقف','إيقاف','إلغاء الاشتراك','أوقف الرسائل','لا أريد رسائل']);
const WRONG_NUMBER_KEYWORDS=new Set(['wrong number','not my number','you have the wrong number','ليس رقمي','رقم خاطئ','الرقم غير صحيح']);
export function normalizeOptOutText(value){return clean(value,160).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('und');}
export function isWhatsAppOptOut(value){return OPT_OUT_KEYWORDS.has(normalizeOptOutText(value));}
export function classifyWhatsAppSuppression(value){const normalized=normalizeOptOutText(value);if(OPT_OUT_KEYWORDS.has(normalized))return'opt_out';if(WRONG_NUMBER_KEYWORDS.has(normalized))return'wrong_number';return null;}

export function normalize360dialogTemplates(payload,{syncedAt=new Date().toISOString()}={}){
  const items=Array.isArray(payload)?payload:Array.isArray(payload?.waba_templates)?payload.waba_templates:Array.isArray(payload?.data)?payload.data:[];
  return items.map(item=>{
    const name=clean(item?.name,160),language=clean(item?.language,20),providerStatus=clean(item?.status,30).toLowerCase();
    if(!name||!language)return null;
    const status=TEMPLATE_STATUS.has(providerStatus)?providerStatus:'unknown';
    return{providerTemplateId:clean(item?.id,160)||null,name,language,category:clean(item?.category,40).toLowerCase()||null,status,components:Array.isArray(item?.components)?stable(item.components):[],syncedAt};
  }).filter(Boolean);
}

export function templateEligibility(template,{now=Date.now()}={}){
  if(template?.status!=='approved')return{eligible:false,reason:'template_not_approved'};
  const synced=Date.parse(template?.syncedAt||'');
  if(!Number.isFinite(synced)||now-synced>WA_TEMPLATE_FRESHNESS_MS)return{eligible:false,reason:'template_catalogue_stale'};
  return{eligible:true,reason:'eligible'};
}

export function campaignCommand(campaign,command,{actorId,actorRole,managedTeamIds=[],activeApproverCount=0,reason=null}={}){
  const current=campaign?.status||'draft';
  if(!CAMPAIGN_STATUS.has(current))throw new Error('Invalid campaign state');
  if(!actorId||!['sales_agent','manager','director'].includes(actorRole))throw new Error('Operational campaign role is required');
  const ownerTeamId=String(campaign?.ownerTeamId||'');
  const managerInScope=actorRole==='manager'&&managedTeamIds.map(String).includes(ownerTeamId);
  const approver=actorRole==='director'||managerInScope;
  const transitions={submit:['draft','returned'],approve:['pending_approval'],return:['pending_approval'],retire:['draft','pending_approval','approved','returned']};
  if(!transitions[command]?.includes(current))throw new Error(`Campaign cannot ${command} from ${current}`);
  if(command==='submit'&&String(campaign?.preparedBy)!==String(actorId)&&!managerInScope)throw new Error('Only the preparer or their Manager may submit this campaign');
  if(['approve','return'].includes(command)&&!approver)throw new Error('Manager or Director approval in campaign scope is required');
  if(command==='retire'){
    const ownAgentDraft=actorRole==='sales_agent'&&String(campaign?.preparedBy)===String(actorId)&&['draft','returned'].includes(current);
    const leadership=approver&&['draft','pending_approval','approved','returned'].includes(current);
    if(!ownAgentDraft&&!leadership)throw new Error('Only the owning Agent may retire their draft or returned campaign; Manager/Director scope is required for pending or approved campaigns');
  }
  // Addendum 2 expressly permits Manager/Director self-approval. The route
  // records that fact in the immutable decision audit.
  if(['return','retire'].includes(command)&&!clean(reason,500))throw new Error('A decision reason is required');
  const status={submit:'pending_approval',approve:'approved',return:'returned',retire:'retired'}[command];
  return{...campaign,status,decisionReason:clean(reason,500)||null,decisionBy:['approve','return'].includes(command)?actorId:campaign?.decisionBy||null,decisionAt:['approve','return'].includes(command)?new Date().toISOString():campaign?.decisionAt||null};
}

export function assertStageBDispatchDisabled(){
  const error=new Error('WA_STAGE_B_DISPATCH_NOT_IMPLEMENTED');
  error.code='WA_STAGE_B_DISPATCH_NOT_IMPLEMENTED';
  throw error;
}
