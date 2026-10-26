import { readSheet } from 'read-excel-file/node';
import { validateListingIntakePayload } from './listing-intake-domain.js';

export const INVENTORY_IMPORT_CONTRACT_VERSION='inventory-import-v1.4';
export const INVENTORY_IMPORT_PAYMENT_PLANS=Object.freeze(['Developer plan','Post-handover']);
export const INVENTORY_IMPORT_OWNER_ROLES=Object.freeze(['seller','landlord','developer']);
export const INVENTORY_IMPORT_OWNER_TYPES=Object.freeze(['person','company']);
export const INVENTORY_IMPORT_HEADERS=Object.freeze([
  'external_record_id','inventory_headline','project','developer','area_code','community','unit_reference','building','property_type','bedrooms',
  'size_sqft','price','reference_price','currency','payment_plan_type','down_payment_percent','on_handover_percent',
  'post_handover_years','payment_plan_notes','handover_status','handover_expected_date','exclusivity_tier',
  'originating_agent_reference','responsible_agent_reference',
  'owner_role','owner_type','owner_name','owner_phone','owner_email','owner_source','owner_authority_evidence','contact','notes'
]);

const clean=value=>value===null||value===undefined?'':String(value).trim();
const normalizedHeader=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
const isoDate=value=>{
  if(value instanceof Date&&!Number.isNaN(value.valueOf()))return value.toISOString().slice(0,10);
  return clean(value);
};
const optionalNumber=value=>clean(value)===''?null:value;

function normalizeSourceRow(source={},index=0){
  return {
    rowNumber:Number(source.rowNumber||index+2),externalRecordId:clean(source.externalRecordId),inventoryHeadline:clean(source.inventoryHeadline),
    project:clean(source.project),developer:clean(source.developer),areaCode:clean(source.areaCode).toLowerCase(),community:clean(source.community),
    unitReference:clean(source.unitReference),building:clean(source.building),
    propertyType:clean(source.propertyType),bedrooms:clean(source.bedrooms),sizeSqft:optionalNumber(source.sizeSqft),price:optionalNumber(source.price),
    referencePrice:optionalNumber(source.referencePrice),currency:clean(source.currency)||'AED',paymentPlanType:clean(source.paymentPlanType),
    downPaymentPercent:optionalNumber(source.downPaymentPercent),onHandoverPercent:optionalNumber(source.onHandoverPercent),
    postHandoverYears:optionalNumber(source.postHandoverYears),paymentPlanNotes:clean(source.paymentPlanNotes),
    handoverStatus:clean(source.handoverStatus)||'to_be_confirmed',handoverExpectedDate:isoDate(source.handoverExpectedDate),
    exclusivityTier:clean(source.exclusivityTier)||'Off-market',originatingAgentReference:clean(source.originatingAgentReference).toLowerCase(),responsibleAgentReference:clean(source.responsibleAgentReference).toLowerCase(),
    ownerRole:clean(source.ownerRole).toLowerCase(),ownerType:clean(source.ownerType).toLowerCase(),
    ownerName:clean(source.ownerName),ownerPhone:clean(source.ownerPhone),ownerEmail:clean(source.ownerEmail).toLowerCase(),ownerSource:clean(source.ownerSource),
    ownerAuthorityEvidence:clean(source.ownerAuthorityEvidence),contact:clean(source.contact),notes:clean(source.notes)
  };
}

export function validateInventoryImportRows(sourceRows,{sourceCode='inventory_excel',existingRecords=[],inventoryRecords=[],activeAreaCodes=[],agentDirectory=[],defaultOriginatingAgentReference='',defaultResponsibleAgentReference=''}={}){
  const existing=new Set(existingRecords.map(item=>`${clean(item.sourceProvider).toLowerCase()}|${clean(item.externalRecordId).toLowerCase()}`));
  const activeAreas=new Set(activeAreaCodes.map(value=>clean(value).toLowerCase()));
  const agentsByReference=new Map();for(const agent of agentDirectory){const reference=clean(agent.email).toLowerCase();if(!reference)continue;const matches=agentsByReference.get(reference)||[];matches.push(agent);agentsByReference.set(reference,matches);}
  const resolveAgent=(label,reference)=>{
    if(!reference)return{agent:null,error:`${label} agent reference or an explicit default ${label.toLowerCase()} agent is required`};
    const matches=agentsByReference.get(reference)||[];
    if(!matches.length)return{agent:null,error:`${label} agent reference is not a maintained NYSA login email`};
    if(matches.length!==1)return{agent:null,error:`${label} agent reference is ambiguous because more than one maintained user has this email`};
    const agent=matches[0],status=clean(agent.status).toLowerCase();
    if(status&&status!=='active')return{agent:null,error:`${label} agent reference identifies an inactive NYSA user`};
    if(agent.eligible===false)return{agent:null,error:`${label} agent reference does not identify an Inventory-eligible Sales Agent or Listing Executive`};
    if(agent.inScope===false)return{agent:null,error:`${label} agent reference is outside your Inventory assignment scope`};
    return{agent,error:''};
  };
  const workbook=new Map();
  const identityPart=value=>clean(value).replace(/\s+/g,' ').toLowerCase();
  const identity=value=>[value.areaCode,value.community,value.unitReference,value.building,Number(value.sizeSqft)].map(identityPart).join('|');
  const inventoryByIdentity=new Map();
  for(const item of inventoryRecords){const key=identity(item);if(!inventoryByIdentity.has(key))inventoryByIdentity.set(key,[]);inventoryByIdentity.get(key).push(item);}
  return sourceRows.map((source,index)=>{
    const row=normalizeSourceRow(source,index),errors=[],warnings=[],originatingAgentReference=row.originatingAgentReference||clean(defaultOriginatingAgentReference).toLowerCase(),
      responsibleAgentReference=row.responsibleAgentReference||clean(defaultResponsibleAgentReference).toLowerCase()||originatingAgentReference,
      originatingResolution=resolveAgent('Originating',originatingAgentReference),responsibleResolution=resolveAgent('Responsible',responsibleAgentReference),
      originatingAgent=originatingResolution.agent,responsibleAgent=responsibleResolution.agent;
    if(originatingResolution.error)errors.push(originatingResolution.error);
    if(responsibleResolution.error)errors.push(responsibleResolution.error);
    const ownerValues=[row.ownerRole,row.ownerType,row.ownerName,row.ownerPhone,row.ownerEmail,row.ownerSource,row.ownerAuthorityEvidence],hasOwner=ownerValues.some(Boolean),
      owner=hasOwner?{partyRole:row.ownerRole,partyType:row.ownerType,displayName:row.ownerName,phone:row.ownerPhone,email:row.ownerEmail,source:row.ownerSource,authorityEvidence:row.ownerAuthorityEvidence}:null;
    const payload={eventId:`preview-${row.rowNumber}`,provider:sourceCode,externalRecordId:row.externalRecordId,
      mappingVersion:INVENTORY_IMPORT_CONTRACT_VERSION,sourceKind:'import',listing:{...row,originatingAgentId:originatingAgent?.id||null,
        responsibleAgentId:responsibleAgent?.id||originatingAgent?.id||null,...(owner?{owner}:{})}};
    for(const field of ['rowNumber','externalRecordId','originatingAgentReference','responsibleAgentReference','ownerRole','ownerType','ownerName','ownerPhone','ownerEmail','ownerSource','ownerAuthorityEvidence'])delete payload.listing[field];
    if(!row.inventoryHeadline)errors.push('Inventory headline is required');
    for(const [field,label] of [['community','Community'],['unitReference','Unit Reference / Unit Number'],['building','Building']])if(!row[field])errors.push(`${label} is required for duplicate prevention`);
    const checked=validateListingIntakePayload(payload);
    if(checked.error)errors.push(checked.error);
    if(row.paymentPlanType&&!INVENTORY_IMPORT_PAYMENT_PLANS.includes(row.paymentPlanType))
      errors.push('Inventory payment plan must describe property-specific developer or post-handover terms; customer Cash or Mortgage funding belongs in the customer requirement');
    if(hasOwner&&row.ownerRole&&!INVENTORY_IMPORT_OWNER_ROLES.includes(row.ownerRole))errors.push('Owner role must be Seller, Landlord or Developer');
    if(hasOwner&&row.ownerType&&!INVENTORY_IMPORT_OWNER_TYPES.includes(row.ownerType))errors.push('Owner type must be Person or Company');
    if(row.areaCode&&activeAreas.size&&!activeAreas.has(row.areaCode))errors.push('Area code is not active in NYSA Area Maintenance');
    const key=`${sourceCode.toLowerCase()}|${row.externalRecordId.toLowerCase()}`,signature=JSON.stringify(payload.listing),prior=workbook.get(key);
    let skipReason='',duplicateOutcome=null,matchedInventory=null;
    if(row.externalRecordId&&existing.has(key))skipReason='This source record already exists in NYSA CORE — skipped; existing Inventory is never overwritten';
    else if(row.externalRecordId&&prior){
      if(prior.signature===signature)skipReason=`Exact duplicate of Excel row ${prior.rowNumber} — skipped`;
      else errors.push(`External record ID conflicts with Excel row ${prior.rowNumber}`);
    }
    if(!errors.length){
      const matches=inventoryByIdentity.get(identity(row))||[],active=matches.find(item=>identityPart(item.status)!=='closed'),closed=matches.find(item=>identityPart(item.status)==='closed');
      matchedInventory=active||closed||null;
      if(active){duplicateOutcome='active_duplicate';skipReason=`Active Inventory ${active.inventoryReference} already exists — open the existing record; no second Inventory will be created`;}
      else if(closed){duplicateOutcome='closed_match';skipReason=`Closed Inventory ${closed.inventoryReference} already exists — request Manager approval to reopen the same record`;}
    }
    if(row.externalRecordId&&!prior)workbook.set(key,{rowNumber:row.rowNumber,signature});
    if(!row.developer)warnings.push('Developer is blank and should be enriched before verification');
    if(!row.contact)warnings.push('Source contact is blank');
    if(hasOwner&&!row.ownerPhone&&!row.ownerEmail)warnings.push('Owner phone and email are both blank; confirm a contact route before operational use');
    if(!hasOwner)warnings.push('Owner is not supplied; add owner and authority evidence before verification');
    return {...row,originatingAgentReference,responsibleAgentReference,originatingAgentId:originatingAgent?.id||null,responsibleAgentId:responsibleAgent?.id||originatingAgent?.id||null,
      originatingAgentName:originatingAgent?.name||'',responsibleAgentName:responsibleAgent?.name||'',errors:[...new Set(errors)],warnings,skipped:Boolean(skipReason)&&!errors.length,skipReason:errors.length?'':skipReason,
      intake:checked.value||null,duplicateOutcome,matchedListingId:matchedInventory?.id||null,matchedInventoryReference:matchedInventory?.inventoryReference||null,
      matchedInventoryStatus:matchedInventory?.status||null};
  });
}

export async function parseInventoryWorkbook(buffer){
  const workbookRows=await readSheet(buffer,{sheet:'Inventory Upload'});
  if(!workbookRows.length)throw new Error('The Inventory Upload sheet is empty');
  const headers=workbookRows[0].map(normalizedHeader);
  if(headers.length!==INVENTORY_IMPORT_HEADERS.length||INVENTORY_IMPORT_HEADERS.some((header,index)=>headers[index]!==header))
    throw new Error(`Use the approved template with these columns in this order: ${INVENTORY_IMPORT_HEADERS.join(', ')}`);
  const rows=workbookRows.slice(1).map((cells,index)=>({index,source:Object.fromEntries(INVENTORY_IMPORT_HEADERS.map((header,column)=>[
    header.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),cells[column]
  ]))})).filter(item=>Object.values(item.source).some(value=>clean(value)!=='')).map(item=>normalizeSourceRow(item.source,item.index));
  if(!rows.length)throw new Error('The workbook contains no Inventory rows');
  if(rows.length>1000)throw new Error('A single Inventory import cannot contain more than 1,000 rows');
  return rows;
}
