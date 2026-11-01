import crypto from 'node:crypto';
import {normalizeAudienceSegmentDefinition,normalizeWhatsAppPhone,reviewWhatsAppRecipientRows} from './whatsapp-campaign-domain.js';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const CATEGORY=new Set(['marketing','utility','authentication']);
const MATERIAL_TYPE=new Set(['brochure','floor_plan','price_list','presentation','image','other']);
const LANGUAGE=/^[a-z]{2,3}(?:_[A-Z]{2})?$/;
const VARIABLE=/^[a-z][a-z0-9_]{0,39}$/;

const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
};

export const workspaceHash=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export function validateTemplateDraft(value={}){
  const name=clean(value.name,160),languageCode=clean(value.languageCode,20),category=clean(value.category,30).toLowerCase(),headerText=clean(value.headerText,120)||null,bodyText=clean(value.bodyText,4096),footerText=clean(value.footerText,120)||null;
  const variableNames=[...new Set((Array.isArray(value.variableNames)?value.variableNames:String(value.variableNames||'').split(',')).map(item=>clean(item,40).toLowerCase()).filter(Boolean))];
  const errors=[];
  if(name.length<3)errors.push('Template name must contain at least 3 characters');
  if(!LANGUAGE.test(languageCode))errors.push('Language must use a code such as en or en_US');
  if(!CATEGORY.has(category))errors.push('Template category is invalid');
  if(bodyText.length<5)errors.push('Template body must contain at least 5 characters');
  if(variableNames.some(item=>!VARIABLE.test(item)))errors.push('Variable names must use lowercase letters, numbers and underscores');
  const placeholders=[...bodyText.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map(match=>match[1]),unknown=[...new Set(placeholders.filter(item=>!variableNames.includes(item)))],unused=variableNames.filter(item=>!placeholders.includes(item));
  if(unknown.length)errors.push(`Declare template variable: ${unknown[0]}`);
  if(unused.length)errors.push(`Variable is not used in the body: ${unused[0]}`);
  const result={name,languageCode,category,headerText,bodyText,footerText,variableNames};
  return{valid:errors.length===0,errors,value:result,contentHash:workspaceHash(result)};
}

export function validateMaterialDraft(value={}){
  const title=clean(value.title,180),materialType=clean(value.materialType,40).toLowerCase(),description=clean(value.description,1000)||null,errors=[];
  if(title.length<3)errors.push('Material title must contain at least 3 characters');
  if(!MATERIAL_TYPE.has(materialType))errors.push('Material type is invalid');
  return{valid:errors.length===0,errors,value:{title,materialType,description}};
}

export function validateCampaignDraft(value={}){
  const name=clean(value.name,180),purpose=clean(value.purpose,1000),segmentId=clean(value.segmentId,36),templateVersionId=clean(value.templateVersionId,36),materialIds=[...new Set((Array.isArray(value.materialIds)?value.materialIds:[]).map(item=>clean(item,36)).filter(Boolean))],errors=[];
  if(name.length<3)errors.push('Campaign name must contain at least 3 characters');
  if(purpose.length<5)errors.push('Campaign purpose must contain at least 5 characters');
  if(!segmentId)errors.push('Audience segment is required');
  if(!templateVersionId)errors.push('Internally approved template version is required');
  return{valid:errors.length===0,errors,value:{name,purpose,segmentId,templateVersionId,materialIds}};
}

export function validateRecipientImport(value={}){
  const originalFileName=clean(value.originalFileName,240),rows=Array.isArray(value.rows)?value.rows:[],review=reviewWhatsAppRecipientRows(rows,{existingPhones:value.existingPhones||new Map()}),errors=[];
  if(!originalFileName.toLowerCase().endsWith('.csv'))errors.push('Recipient import must be a CSV file');
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
  if(row.action==='invalid')return{include:false,disposition:'excluded',error:null};
  if(row.action==='ready')return{include:decision.include!==false,disposition:decision.include===false?'excluded':'unique',error:null};
  const disposition=clean(decision.disposition,40);
  if(!['linked','kept_separate','excluded'].includes(disposition))return{include:false,disposition:null,error:`Row ${row.rowNumber}: choose Link, Keep separate or Exclude`};
  return{include:disposition!=='excluded',disposition,error:null};
}

export {normalizeWhatsAppPhone};
