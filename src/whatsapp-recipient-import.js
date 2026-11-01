import {readSheet} from 'read-excel-file/node';
import {WA_SOURCE_TYPES} from './whatsapp-campaign-domain.js';

export const WA_RECIPIENT_HEADERS=Object.freeze(['name','phone','email','tags','source_detail','consent_status','consent_evidence_ref','transaction_type','area','budget_max','project','property_type','bedrooms','timeframe','language','owner_id']);
const clean=value=>value===null||value===undefined?'':String(value).trim();
const header=value=>clean(value).replace(/^\uFEFF/,'').toLowerCase().replace(/[\s-]+/g,'_');
const list=value=>clean(value).split('|').map(item=>item.trim()).filter(Boolean);

function csvRows(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let index=0;index<String(text).length;index++){
    const char=text[index],next=text[index+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"';index++;continue;}
    if(char==='"'){quoted=!quoted;continue;}
    if(!quoted&&char===','){row.push(cell);cell='';continue;}
    if(!quoted&&(char==='\n'||char==='\r')){if(char==='\r'&&next==='\n')index++;row.push(cell);if(row.some(item=>clean(item)))rows.push(row);row=[];cell='';continue;}
    cell+=char;
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted value');
  row.push(cell);if(row.some(item=>clean(item)))rows.push(row);return rows;
}

function fileRows(buffer,mediaType){return mediaType==='text/csv'?csvRows(buffer.toString('utf8')):readSheet(buffer,'Recipients');}

function mappingFor(rows,inputMapping={}){
  if(!rows.length)throw new Error('The recipient file is empty');
  const labels=rows[0].map(clean),normalized=labels.map(header),mapping={};
  for(const field of WA_RECIPIENT_HEADERS){
    const supplied=inputMapping?.[field];
    if(supplied!==undefined&&supplied!==null&&supplied!=='')mapping[field]=Number(supplied);
    else{const index=normalized.indexOf(field==='transaction_type'&&normalized.includes('business_type')?'business_type':field);if(index>=0)mapping[field]=index;}
  }
  return{labels,normalized,mapping};
}

function normalizeRows(rows,inputMapping={}){
  if(!rows.length)throw new Error('The recipient file is empty');
  const {mapping}=mappingFor(rows,inputMapping),missing=['name','phone'].filter(item=>!Number.isInteger(mapping[item]));
  if(missing.length)throw new Error(`Map the required recipient column: ${missing[0]}`);
  const selected=Object.entries(mapping).filter(([,index])=>Number.isInteger(index));
  const duplicateIndex=selected.find(([,index],position)=>selected.findIndex(([,other])=>other===index)!==position);
  if(duplicateIndex)throw new Error('Each file column may be mapped only once');
  const records=rows.slice(1).map(cells=>Object.fromEntries(selected.map(([key,column])=>[key,cells[column]]))).filter(record=>Object.values(record).some(value=>clean(value)));
  if(!records.length)throw new Error('The recipient file contains no data rows');
  return records.map((record,index)=>({
    rowNumber:index+2,name:clean(record.name),phone:clean(record.phone),email:clean(record.email)||null,
    tags:list(record.tags),source:clean(record.source_detail)||'bulk_upload',consentStatus:header(record.consent_status)||'evidence_pending',consentEvidenceRef:clean(record.consent_evidence_ref)||null,
    requirements:{transactionType:clean(record.transaction_type)||null,areas:list(record.area),budgetMax:clean(record.budget_max)===''?null:Number(String(record.budget_max).replace(/,/g,'')),project:clean(record.project)||null,propertyType:clean(record.property_type)||null,bedrooms:clean(record.bedrooms)===''?null:Number(record.bedrooms),timeframe:clean(record.timeframe)||null,language:clean(record.language)||null,ownerId:clean(record.owner_id)||null}
  }));
}

export async function inspectWhatsAppRecipientFile({buffer,mediaType}){
  const rows=await fileRows(buffer,mediaType),{labels,normalized,mapping}=mappingFor(rows);
  return{headers:labels.map((label,index)=>({index,label:label||`Column ${index+1}`,normalized:normalized[index],suggestedField:Object.entries(mapping).find(([,column])=>column===index)?.[0]||null})),rowCount:Math.max(0,rows.length-1)};
}

export async function parseWhatsAppRecipientFile({buffer,mediaType,columnMapping={}}){
  const rows=await fileRows(buffer,mediaType);
  return normalizeRows(rows,columnMapping);
}

export function validateRecipientBatchMetadata(value={}){
  const sourceType=header(value.sourceType),sourceDescription=clean(value.sourceDescription),supplierName=clean(value.supplierName),supplierBatchReference=clean(value.supplierBatchReference),acquisitionDate=clean(value.acquisitionDate),sourceEvidenceRef=clean(value.sourceEvidenceRef),errors=[];
  if(!WA_SOURCE_TYPES.includes(sourceType))errors.push('Select a maintained source type');
  if(sourceType==='other'&&!sourceDescription)errors.push('Describe the Other source type');
  if(sourceType==='purchased_list'){
    if(!supplierName)errors.push('Purchased lists require supplier name');
    if(!supplierBatchReference)errors.push('Purchased lists require supplier batch reference');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(acquisitionDate))errors.push('Purchased lists require acquisition date');
    if(!sourceEvidenceRef)errors.push('Purchased lists require source evidence reference');
  }
  return{valid:errors.length===0,errors,value:{sourceType,sourceDescription:sourceDescription||null,supplierName:supplierName||null,supplierBatchReference:supplierBatchReference||null,acquisitionDate:acquisitionDate||null,sourceEvidenceRef:sourceEvidenceRef||null}};
}
