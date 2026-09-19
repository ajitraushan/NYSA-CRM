import {readSheet} from 'read-excel-file/node';

export const PURCHASED_DATA_IMPORT_VERSION='purchased-data-v1';
export const BATCH_IMPORT_FIELDS=Object.freeze(['contract_version','module_type','source_system_code','supplier_name','acquisition_batch_reference','acquisition_date','campaign_reference','processing_basis']);
export const CUSTOMER_IMPORT_HEADERS=Object.freeze(['external_row_reference','full_name','email','phone','preferred_channel','source_notes','restriction_status']);
export const LEAD_IMPORT_HEADERS=Object.freeze(['external_row_reference','customer_reference','email','phone','lead_title','business_type','budget_min','budget_max','preferred_areas','property_type','bedrooms_min','objective','purpose','timeline','campaign_reference','source_notes']);

const clean=value=>value===null||value===undefined?'':String(value).trim();
const key=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
const camel=value=>value.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
const dateOnly=value=>value instanceof Date?value.toISOString().slice(0,10):clean(value).slice(0,10);
export const normalizeEmail=value=>clean(value).toLowerCase();
export const normalizePhone=value=>clean(value).replace(/[^0-9+]/g,'').replace(/^00/,'+');
const emailValid=value=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const phoneValid=value=>!value||/^\+?[0-9]{7,15}$/.test(value);
const amount=value=>clean(value)===''?null:Number(String(value).replace(/,/g,''));
const list=value=>clean(value).split(/[;,]/).map(item=>item.trim()).filter(Boolean);

export async function parsePurchasedWorkbook(buffer,moduleType){
  const rowSheet=moduleType==='customer_only'?'Customers':'Leads',expected=moduleType==='customer_only'?CUSTOMER_IMPORT_HEADERS:LEAD_IMPORT_HEADERS;
  const [batchRows,dataRows]=await Promise.all([readSheet(buffer,'Batch'),readSheet(buffer,rowSheet)]);
  if(batchRows.length<2||batchRows[0].map(key).join('|')!=='field|value')throw new Error('The Batch sheet must use the approved field and value columns');
  const rawMetadata=Object.fromEntries(batchRows.slice(1).map(row=>[key(row[0]),row[1]]));
  const missing=BATCH_IMPORT_FIELDS.filter(field=>!(field in rawMetadata));
  if(missing.length)throw new Error(`The Batch sheet is missing: ${missing.join(', ')}`);
  const metadata=Object.fromEntries(BATCH_IMPORT_FIELDS.map(field=>[camel(field),field==='acquisition_date'?dateOnly(rawMetadata[field]):clean(rawMetadata[field])]));
  if(metadata.contractVersion!==PURCHASED_DATA_IMPORT_VERSION)throw new Error(`Template contract must be ${PURCHASED_DATA_IMPORT_VERSION}`);
  if(metadata.moduleType!==moduleType)throw new Error(`This workbook is for ${metadata.moduleType||'an unknown module'}, not ${moduleType}`);
  if(!dataRows.length)throw new Error(`The ${rowSheet} sheet is empty`);
  const actual=dataRows[0].map(key);
  if(actual.length!==expected.length||expected.some((item,index)=>item!==actual[index]))throw new Error(`Use the approved ${rowSheet} template with columns in the documented order`);
  const rows=dataRows.slice(1).map((cells,index)=>({rowNumber:index+2,...Object.fromEntries(expected.map((field,column)=>[camel(field),cells[column]]))})).filter(row=>Object.entries(row).some(([field,value])=>field!=='rowNumber'&&clean(value)!==''));
  if(!rows.length)throw new Error('The workbook contains no data rows');
  if(rows.length>1000)throw new Error('A batch cannot contain more than 1,000 rows');
  return{metadata,rows};
}

export function validatePurchasedRows(sourceRows,{moduleType,sourceSystemCode='',acquisitionBatchReference='',existingSourceRows=[],identityMatches=[]}={}){
  const prior=new Set(existingSourceRows.map(row=>`${clean(row.sourceSystemCode)}|${clean(row.acquisitionBatchReference)}|${clean(row.externalRowReference)}`.toLowerCase())),seen=new Set(),byEmail=new Map(),byPhone=new Map(),byReference=new Map(),bySourceRow=new Map();
  const add=(map,value,row)=>{if(value)map.set(value,(map.get(value)||[]).concat(row));};
  for(const row of identityMatches){add(byEmail,normalizeEmail(row.email),row);add(byPhone,normalizePhone(row.phone),row);add(byReference,clean(row.customerReference).toLowerCase(),row);add(bySourceRow,`${clean(row.sourceSystemCode)}|${clean(row.acquisitionBatchReference)}|${clean(row.externalRowReference)}`.toLowerCase(),row);}
  return sourceRows.map(source=>{
    const externalRowReference=clean(source.externalRowReference),email=normalizeEmail(source.email),phone=normalizePhone(source.phone),errors=[],rowKey=externalRowReference.toLowerCase(),sourceKey=`${sourceSystemCode}|${acquisitionBatchReference}|${externalRowReference}`.toLowerCase();
    if(!externalRowReference)errors.push('External row reference is required');
    if(/^replace[-_]/i.test(externalRowReference))errors.push('Replace or remove the example row before upload');
    if(seen.has(rowKey))errors.push('External row reference is repeated in this workbook');seen.add(rowKey);
    if(!emailValid(email))errors.push('Email format is invalid');if(!phoneValid(phone))errors.push('Phone format is invalid');
    if(prior.has(sourceKey))return{rowNumber:Number(source.rowNumber),externalRowReference,normalized:{...source,externalRowReference,email,phone},matchedContact:null,action:'skipped',errors:[]};
    let candidates=[];
    if(moduleType==='customer_only'){
      if(!clean(source.fullName))errors.push('Full name is required');if(!email&&!phone)errors.push('Email or phone is required');
      if(clean(source.preferredChannel)&&!['Phone','Email','WhatsApp','SMS'].includes(clean(source.preferredChannel)))errors.push('Preferred channel must be Phone, Email, WhatsApp or SMS');
      if(clean(source.restrictionStatus)&&!['allowed','restricted','do_not_contact'].includes(clean(source.restrictionStatus)))errors.push('Restriction status must be allowed, restricted or do_not_contact');
      const emailMatches=email?byEmail.get(email)||[]:[],phoneMatches=phone?byPhone.get(phone)||[]:[];
      candidates=[...new Map([...emailMatches,...phoneMatches].map(item=>[item.id,item])).values()];
      if(emailMatches.length&&phoneMatches.length&&!emailMatches.some(e=>phoneMatches.some(p=>p.id===e.id)))errors.push('Email and phone identify different Customers');
    }else{
      if(!clean(source.leadTitle))errors.push('Lead title is required');
      if(!['Sale','Rental','Off-plan','Commercial'].includes(clean(source.businessType)))errors.push('Business type must be Sale, Rental, Off-plan or Commercial');
      if(clean(source.objective)&&!['buy','sell','rent','rent_out','not_confirmed'].includes(clean(source.objective)))errors.push('Objective must be buy, sell, rent, rent_out or not_confirmed');
      const reference=clean(source.customerReference).toLowerCase();
      candidates=reference?(byReference.get(reference)||[]):email?(byEmail.get(email)||[]):phone?(byPhone.get(phone)||[]):(bySourceRow.get(sourceKey)||[]);
      if(candidates.length!==1)errors.push(candidates.length?'Customer identity is ambiguous':'Existing Customer could not be resolved');
      const min=amount(source.budgetMin),max=amount(source.budgetMax),bedrooms=clean(source.bedroomsMin)===''?null:Number(source.bedroomsMin);
      if((min!==null&&!Number.isFinite(min))||(max!==null&&!Number.isFinite(max))||(min!==null&&max!==null&&max<min))errors.push('Budget range is invalid');
      if(bedrooms!==null&&(!Number.isInteger(bedrooms)||bedrooms<0))errors.push('Minimum bedrooms must be a whole number');
      const enriched=[min,max,clean(source.preferredAreas),clean(source.propertyType),bedrooms,clean(source.objective),clean(source.purpose),clean(source.timeline)].some(value=>value!==null&&value!=='');
      if(enriched&&!['own_use','investment','business','other'].includes(clean(source.purpose)))errors.push('Enriched rows require purpose: own_use, investment, business or other');
      if(enriched&&!clean(source.timeline))errors.push('Enriched rows require an explicit timing value; missing timing is not invented');
    }
    const normalized={...source,externalRowReference,email,phone,budgetMin:amount(source.budgetMin),budgetMax:amount(source.budgetMax),bedroomsMin:clean(source.bedroomsMin)===''?null:Number(source.bedroomsMin),preferredAreas:list(source.preferredAreas)};
    const identityReview=errors.some(message=>/different Customers|ambiguous/.test(message));
    return{rowNumber:Number(source.rowNumber),externalRowReference,normalized,matchedContact:candidates.length===1?candidates[0]:null,action:identityReview?'review_required':errors.length?'invalid':candidates.length===1?(moduleType==='customer_only'?'linked':'create'):'create',errors};
  });
}
