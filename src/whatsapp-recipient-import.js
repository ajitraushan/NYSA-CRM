import {readSheet} from 'read-excel-file/node';
import {WA_SOURCE_TYPES} from './whatsapp-campaign-domain.js';

export const WA_RECIPIENT_HEADERS=Object.freeze(['name','phone','email','tags','source_detail','consent_status','consent_evidence_ref','business_type','area','budget_max']);
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

function normalizeRows(rows){
  if(!rows.length)throw new Error('The recipient file is empty');
  const headers=rows[0].map(header),missing=['name','phone'].filter(item=>!headers.includes(item));
  if(missing.length)throw new Error(`Recipient file is missing required column: ${missing[0]}`);
  const duplicate=headers.find((item,index)=>item&&headers.indexOf(item)!==index);
  if(duplicate)throw new Error(`Recipient file contains duplicate column: ${duplicate}`);
  const unknown=headers.filter(item=>item&&!WA_RECIPIENT_HEADERS.includes(item));
  if(unknown.length)throw new Error(`Unsupported recipient column: ${unknown[0]}`);
  const records=rows.slice(1).map((cells,index)=>Object.fromEntries(headers.map((key,column)=>[key,cells[column]]))).filter(record=>Object.values(record).some(value=>clean(value)));
  if(!records.length)throw new Error('The recipient file contains no data rows');
  return records.map((record,index)=>({
    rowNumber:index+2,name:clean(record.name),phone:clean(record.phone),email:clean(record.email)||null,
    tags:list(record.tags),source:clean(record.source_detail)||'bulk_upload',consentStatus:header(record.consent_status)||'evidence_pending',consentEvidenceRef:clean(record.consent_evidence_ref)||null,
    requirements:{businessType:clean(record.business_type)||null,areas:list(record.area),budgetMax:clean(record.budget_max)===''?null:Number(String(record.budget_max).replace(/,/g,''))}
  }));
}

export async function parseWhatsAppRecipientFile({buffer,mediaType}){
  const rows=mediaType==='text/csv'?csvRows(buffer.toString('utf8')):await readSheet(buffer,'Recipients');
  return normalizeRows(rows);
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
