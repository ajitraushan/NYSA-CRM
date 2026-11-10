import crypto from 'node:crypto';
import {normalizeAudienceSegmentDefinition,normalizeWhatsAppPhone,reviewWhatsAppRecipientRows} from './whatsapp-campaign-domain.js';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const CATEGORY=new Set(['marketing','utility','authentication']);
const MATERIAL_TYPE=new Set(['brochure','floor_plan','price_list','presentation','image','video','document','other']);
const LANGUAGE=/^[a-z]{2,3}(?:_[A-Z]{2})?$/;
const VARIABLE=/^[a-z][a-z0-9_]{0,39}$/;
const TEMPLATE_NAME=/^[a-z0-9_]+$/;
const HEADER_TYPE=new Set(['none','text','image','video','document']);
const BUTTON_TYPE=new Set(['quick_reply','url','phone_number']);

const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
};

export const workspaceHash=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export function normalizeMetaTemplateName(value){
  return String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,512);
}

export function validateTemplateDraft(value={}){
  const rawName=String(value.name??'').trim(),rawHeader=String(value.headerText??'').trim(),rawBody=String(value.bodyText??'').trim(),rawFooter=String(value.footerText??'').trim();
  const name=normalizeMetaTemplateName(rawName),languageCode=clean(value.languageCode,20),category=clean(value.category,30).toLowerCase(),headerType=clean(value.headerType,20).toLowerCase()||'none',headerText=headerType==='text'?clean(rawHeader,60)||null:null,headerMaterialId=headerType==='image'||headerType==='video'||headerType==='document'?clean(value.headerMaterialId,36)||null:null,bodyText=clean(rawBody,1024),footerText=clean(rawFooter,60)||null;
  const variableNames=[...new Set((Array.isArray(value.variableNames)?value.variableNames:String(value.variableNames||'').split(',')).map(item=>clean(item,40).toLowerCase()).filter(Boolean))];
  const inputSamples=value.variableSamples&&typeof value.variableSamples==='object'&&!Array.isArray(value.variableSamples)?value.variableSamples:{},variableSamples=Object.fromEntries(variableNames.map(item=>[item,clean(inputSamples[item],200)]));
  const inputButtons=Array.isArray(value.buttons)?value.buttons:[],buttons=inputButtons.map(item=>({type:clean(item?.type,20).toLowerCase(),text:clean(item?.text,25),url:clean(item?.url,2000)||null,phoneNumber:normalizeWhatsAppPhone(item?.phoneNumber)||null,sampleValue:clean(item?.sampleValue,500)||null}));
  if(category==='marketing'&&!buttons.some(item=>item.type==='quick_reply'&&item.text.toLowerCase()==='stop promotions')){
    const stop={type:'quick_reply',text:'Stop promotions',url:null,phoneNumber:null,sampleValue:null},firstNonQuick=buttons.findIndex(item=>item.type!=='quick_reply');
    if(firstNonQuick<0)buttons.push(stop);else buttons.splice(firstNonQuick,0,stop);
  }
  const errors=[];
  if(name.length<3)errors.push('Template name must contain at least 3 characters');
  if(rawName.length>512||!TEMPLATE_NAME.test(name))errors.push('Template name could not be normalized to Meta format');
  if(!LANGUAGE.test(languageCode))errors.push('Language must use a code such as en or en_US');
  if(!CATEGORY.has(category))errors.push('Template category is invalid');
  if(!HEADER_TYPE.has(headerType))errors.push('Header type is invalid');
  if(headerType==='text'&&!headerText)errors.push('Text header is required');
  if(['image','video','document'].includes(headerType)&&!headerMaterialId)errors.push('Select header media from the Materials catalogue');
  if(rawHeader.length>60)errors.push('Header text must not exceed 60 characters');
  if(rawBody.length>1024)errors.push('Template body must not exceed 1,024 characters');
  if(rawFooter.length>60)errors.push('Footer text must not exceed 60 characters');
  if(bodyText.length<5)errors.push('Template body must contain at least 5 characters');
  if(variableNames.some(item=>!VARIABLE.test(item)))errors.push('Variable names must use lowercase letters, numbers and underscores');
  const content=`${headerText||''} ${bodyText}`,placeholders=[...content.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map(match=>match[1]),unknown=[...new Set(placeholders.filter(item=>!variableNames.includes(item)))],unused=variableNames.filter(item=>!placeholders.includes(item));
  const allPlaceholderTokens=[...content.matchAll(/\{\{([^{}]+)\}\}/g)].map(match=>match[1]);
  if(allPlaceholderTokens.some(item=>!VARIABLE.test(item)))errors.push('Header and body placeholders must use named variables such as {{project_name}}');
  if(headerText&&[...headerText.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].length>1)errors.push('Text header may contain at most one variable');
  if(/\{\{[^{}]+\}\}/.test(footerText||''))errors.push('Footer cannot contain variables');
  if(unknown.length)errors.push(`Declare template variable: ${unknown[0]}`);
  if(unused.length)errors.push(`Variable is not used in the body: ${unused[0]}`);
  const bodyPlaceholders=[...bodyText.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)];
  if(bodyPlaceholders.length&&/^\s*\{\{[^{}]+\}\}/.test(bodyText))errors.push('A variable cannot start the template body');
  if(bodyPlaceholders.length&&/\{\{[^{}]+\}\}\s*$/.test(bodyText))errors.push('A variable cannot end the template body');
  if(/\}\}\s*\{\{/.test(bodyText))errors.push('Template variables cannot be adjacent');
  const fixedBody=bodyText.replace(/\{\{[^{}]+\}\}/g,'').replace(/[^a-z0-9]+/gi,'');
  if(bodyPlaceholders.length&&fixedBody.length<Math.max(10,bodyPlaceholders.length*3))errors.push('Add more fixed text around the template variables');
  const missingSample=variableNames.find(item=>!variableSamples[item]);if(missingSample)errors.push(`Sample value is required for variable: ${missingSample}`);
  if(buttons.length>10)errors.push('A template may contain at most 10 buttons');
  if(buttons.some(item=>!BUTTON_TYPE.has(item.type)))errors.push('Button type is invalid');
  if(buttons.some(item=>!item.text))errors.push('Every button needs label text');
  if(inputButtons.some(item=>String(item?.text??'').trim().length>25))errors.push('Button text must not exceed 25 characters');
  if(inputButtons.some(item=>String(item?.url??'').trim().length>2000))errors.push('Button URL must not exceed 2,000 characters');
  const quickReplies=buttons.filter(item=>item.type==='quick_reply'),urlButtons=buttons.filter(item=>item.type==='url'),phoneButtons=buttons.filter(item=>item.type==='phone_number');
  if(quickReplies.length>10)errors.push('A template may contain at most 10 quick replies');
  if(urlButtons.length>2)errors.push('A template may contain at most 2 URL buttons');
  if(phoneButtons.length>1)errors.push('A template may contain at most 1 phone-number button');
  if(phoneButtons.some(item=>!item.phoneNumber))errors.push('Phone-number buttons require an E.164 company number');
  const typeSequence=buttons.map(item=>item.type),firstChange=typeSequence.findIndex((item,index)=>index>0&&item!==typeSequence[index-1]);
  if(firstChange>=0&&typeSequence.slice(firstChange+1).some(item=>item===typeSequence[firstChange-1]))errors.push('Quick replies and URL buttons must each remain in one group');
  for(const button of urlButtons){
    if(!button.url){errors.push('Every URL button needs a URL');continue;}
    const variables=[...button.url.matchAll(/\{\{1\}\}/g)];
    if(variables.length>1||(/\{\{[^}]+\}\}/.test(button.url)&&variables.length!==1)){errors.push('A dynamic URL may contain only {{1}}');continue;}
    if(variables.length===1&&!button.url.endsWith('{{1}}'))errors.push('The dynamic URL variable {{1}} must be at the end');
    const checkUrl=variables.length===1?button.url.slice(0,-5):button.url;
    try{const parsed=new URL(checkUrl);if(parsed.protocol!=='https:')errors.push('URL buttons must use HTTPS');}catch{errors.push('Enter a valid HTTPS URL for every URL button');}
    if(variables.length===1&&!button.sampleValue)errors.push('A dynamic URL button requires a sample value');
  }
  const result={name,languageCode,category,headerType,headerText,headerMaterialId,bodyText,footerText,variableNames,variableSamples,buttons};
  return{valid:errors.length===0,errors,value:result,contentHash:workspaceHash(result)};
}

export function validateMaterialDraft(value={}){
  const title=clean(value.title,180),materialType=clean(value.materialType,40).toLowerCase(),description=clean(value.description,1000)||null,errors=[];
  if(title.length<3)errors.push('Material title must contain at least 3 characters');
  if(!MATERIAL_TYPE.has(materialType))errors.push('Material type is invalid');
  return{valid:errors.length===0,errors,value:{title,materialType,description}};
}

export function validateCampaignDraft(value={}){
  const name=clean(value.name,180),purpose=clean(value.purpose,1000),segmentId=clean(value.segmentId,36),templateVersionId=clean(value.templateVersionId,36),materialIds=[...new Set((Array.isArray(value.materialIds)?value.materialIds:[]).map(item=>clean(item,36)).filter(Boolean))],scheduledAt=clean(value.scheduledAt,50),budgetAed=Number(value.budgetAed),errors=[];
  if(name.length<3)errors.push('Campaign name must contain at least 3 characters');
  if(purpose.length<5)errors.push('Campaign purpose must contain at least 5 characters');
  if(!segmentId)errors.push('Audience segment is required');
  if(!templateVersionId)errors.push('Internally approved template version is required');
  if(!scheduledAt||!Number.isFinite(Date.parse(scheduledAt)))errors.push('Campaign schedule is required');
  if(!Number.isFinite(budgetAed)||budgetAed<=0)errors.push('Campaign budget must be greater than zero AED');
  return{valid:errors.length===0,errors,value:{name,purpose,segmentId,templateVersionId,materialIds,scheduledAt:scheduledAt||null,budgetAed:Number.isFinite(budgetAed)?budgetAed:null}};
}

export function validateRecipientImport(value={}){
  const originalFileName=clean(value.originalFileName,240),rows=Array.isArray(value.rows)?value.rows:[],review=reviewWhatsAppRecipientRows(rows,{existingPhones:value.existingPhones||new Map()}),errors=[];
  if(!/\.(csv|xlsx)$/i.test(originalFileName))errors.push('Recipient import must be a CSV or XLSX file');
  return{valid:errors.length===0&&review.rows.length>0,errors,originalFileName,review,fileHash:workspaceHash(rows)};
}

export function normalizeSegmentDraft(value={}){
  const name=clean(value.name,160),description=clean(value.description,1000)||null,definition=normalizeAudienceSegmentDefinition(value.definition||{}),errors=[];
  if(name.length<3)errors.push('Segment name must contain at least 3 characters');
  return{valid:errors.length===0,errors,value:{name,description,definition}};
}

export function displayMetaStatus(value){
  const status=clean(value,40).toLowerCase();
  return status==='not_submitted'?'Not submitted':status.charAt(0).toUpperCase()+status.slice(1).replaceAll('_',' ');
}

export function recipientDecision(row,decision={}){
  if(['invalid','suppressed'].includes(row.action))return{include:false,disposition:'excluded',error:null};
  if(row.action==='ready')return{include:decision.include!==false,disposition:decision.include===false?'excluded':'unique',error:null};
  const disposition=clean(decision.disposition,40);
  if(!['linked','kept_separate','excluded'].includes(disposition))return{include:false,disposition:null,error:`Row ${row.rowNumber}: choose Link, Keep separate or Exclude`};
  return{include:disposition!=='excluded',disposition,error:null};
}

export {normalizeWhatsAppPhone};
