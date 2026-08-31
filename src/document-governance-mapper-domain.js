export const DOCUMENT_MAPPER_POLICY_VERSION='r4-document-mapper-v1';
export const DOCUMENT_STEP_POLICY_VERSION='r4-document-step-requirements-v1';
const MODES=new Set(['core_generated','official_system_preparation','external_evidence_capture']);
const EDITABILITY=new Set(['locked','controlled','agent_input']);
const VERIFICATION=new Set(['snapshot_required','current_verified','reviewed_generated_version','official_contract_captured','external_issuer_verified']);
const SOURCE_SCHEMA={organization:['legalName','licenceReference'],agent:['brokerReference'],seller_authority:['partyReference','authorityEvidenceReference'],inventory:['inventoryReference','propertyDescription','askingPrice','titleEvidenceReference'],commercial_terms:['mandateType','commissionTerms'],customer:['customerReference','displayName','identityStatus'],requirement:['requirementReference','purchaseObjective','budget'],accepted_offer:['amount','revisionReference'],booking:['bookingReference','status'],deal_terms:['targetCompletion','additionalTerms'],consent_terms:['scope','channels','effectiveDate','expiryDate'],developer:['developerReference'],transfer_context:['transferReference']};
const clean=value=>String(value??'').trim(),stable=value=>/^[a-z][a-z0-9_]*$/.test(clean(value));
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}

export async function validateDocumentMapperDraft(draft={}){
  const errors=[];
  if(!stable(draft.documentType))errors.push('Document type must be a stable lowercase code');
  if(!Number.isInteger(Number(draft.version))||Number(draft.version)<1)errors.push('Version must be a positive integer');
  if(draft.status!=='draft')errors.push('Only a draft mapper version can be validated');
  if(!MODES.has(draft.mode))errors.push('Select a supported output mode');
  if(draft.mode==='core_generated'&&(!clean(draft.templateRef)||!/^[a-f0-9]{64}$/i.test(clean(draft.templateHash))))errors.push('CORE-generated documents require an approved template reference and SHA-256');
  if(draft.mode==='official_system_preparation'&&!clean(draft.officialSystem))errors.push('Official preparation requires the official system');
  if(draft.mode==='external_evidence_capture'&&!clean(draft.issuerType))errors.push('External evidence requires an issuer type');
  if(!Array.isArray(draft.mappings)||!draft.mappings.length)errors.push('At least one field mapping is required');
  const placeholders=new Set();
  for(const [index,row] of (draft.mappings??[]).entries()){
    const prefix=`Mapping ${index+1}`;
    if(!stable(row.placeholder))errors.push(`${prefix}: placeholder must be a stable code`);
    else if(placeholders.has(row.placeholder))errors.push(`${prefix}: duplicate placeholder`);else placeholders.add(row.placeholder);
    if(!SOURCE_SCHEMA[row.sourceObject]?.includes(row.sourceField))errors.push(`${prefix}: unsupported CORE source field`);
    if(!EDITABILITY.has(row.editability))errors.push(`${prefix}: invalid editability`);
    if(!VERIFICATION.has(row.verification))errors.push(`${prefix}: invalid verification rule`);
    if(row.required!==true&&row.required!==false)errors.push(`${prefix}: required flag must be explicit`);
    if(row.editability==='locked'&&row.sourceObject==='commercial_terms')errors.push(`${prefix}: commercial terms must remain controlled, not silently locked`);
  }
  const normalized={policyVersion:DOCUMENT_MAPPER_POLICY_VERSION,documentType:clean(draft.documentType),label:clean(draft.label),purpose:clean(draft.purpose),version:Number(draft.version),status:'draft',mode:draft.mode,templateRef:clean(draft.templateRef)||null,templateHash:clean(draft.templateHash)||null,officialSystem:clean(draft.officialSystem)||null,issuerType:clean(draft.issuerType)||null,supersedesVersion:draft.supersedesVersion??null,mappings:(draft.mappings??[]).map(row=>({placeholder:clean(row.placeholder),sourceObject:clean(row.sourceObject),sourceField:clean(row.sourceField),required:row.required===true,editability:row.editability,verification:row.verification}))};
  return{valid:errors.length===0,errors,normalized,mappingHash:errors.length?null:await digest(normalized),activationPerformed:false};
}

export function createNextMapperDraft(active={}){
  if(active.status!=='active')throw new Error('An active mapper version is required');
  return{...structuredClone(active),version:Number(active.version)+1,status:'draft',supersedesVersion:Number(active.version),approvedBy:null,approvedAt:null,activeFrom:null};
}

export function mapperProfileForAssembly(active={}){
  if(active.status!=='active'||!/^[a-f0-9]{64}$/i.test(clean(active.mappingHash)))throw new Error('Only an approved active mapper version can be used for assembly');
  return{id:`${active.documentType}-mapper-v${active.version}`,version:active.version,hash:active.mappingHash,status:'active',label:active.label,purpose:active.purpose,mode:active.mode,officialSystem:active.officialSystem,issuerType:active.issuerType,requiredSources:[...new Set(active.mappings.filter(row=>row.required).map(row=>row.sourceObject))],fields:active.mappings.map(row=>[row.placeholder,row.sourceObject,row.sourceField,row.editability])};
}

export function evaluateStepDocumentRequirements({stepProfile={},evidence=[],contextHash,now}){
  if(stepProfile.status!=='active')throw new Error('Only an active step requirement profile can advise agents');
  const evaluatedAt=new Date(now);if(Number.isNaN(evaluatedAt.getTime()))throw new Error('now must be an ISO timestamp');
  const rows=(stepProfile.requirements??[]).map(requirement=>{
    const candidates=evidence.filter(item=>item.documentType===requirement.documentType).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),item=candidates[0]??null;
    let state='missing';
    if(item){if(item.contextHash!==contextHash)state='context_mismatch';else if(item.expiresAt&&Date.parse(item.expiresAt)<=evaluatedAt.getTime())state='expired';else if(!requirement.acceptedStatuses.includes(item.status))state='pending_verification';else state='verified';}
    const blocking=requirement.level==='required'&&state!=='verified';
    return{...requirement,state,blocking,evidenceRef:item?.evidenceRef??null,mappingVersion:item?.mappingVersion??null,nextAction:state==='missing'?'Prepare or obtain document':state==='pending_verification'?'Complete document verification':state==='expired'?'Obtain a current version':state==='context_mismatch'?'Prepare a version for this exact case':'No document action required',taskAdvice:blocking?{subject:`Resolve ${requirement.label} for ${stepProfile.label}`,useExistingCrmTask:true,taskCreated:false,stepCode:stepProfile.stepCode}:null};
  });
  return{policyVersion:DOCUMENT_STEP_POLICY_VERSION,profileVersion:stepProfile.version,stepCode:stepProfile.stepCode,label:stepProfile.label,stepCanComplete:!rows.some(row=>row.blocking),requirements:rows,tracking:{contextHash,authoritativeWorkItem:'existing_crm_task',parallelQueueCreated:false}};
}
