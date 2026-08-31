import crypto from 'node:crypto';

export const DOCUMENT_COMPLIANCE_RESOLVER_VERSION='r6-document-compliance-v1';
export const TRANSACTION_FAMILIES=Object.freeze({sale:'sale',off_plan:'sale',commercial_sale:'sale',rental:'lease',commercial_rental:'lease'});
export const PARTY_ROLES=Object.freeze(['buyer','seller','landlord','tenant']);
export const PARTY_KINDS=Object.freeze(['individual','organization']);
export const GATE_CODES=Object.freeze(['before_pending_approval','before_approval','before_close_won']);
export const REMINDER_REASONS=Object.freeze(['missing','returned','rejected','expiring','expired']);
export const DEFAULT_REMINDER_OFFSETS=Object.freeze([0,7,14,30]);

const clean=value=>String(value??'').trim();
const instant=value=>{const text=clean(value);return text&&Number.isFinite(Date.parse(text))?new Date(Date.parse(text)).toISOString():null;};
const stableCode=value=>/^[a-z][a-z0-9_]*$/.test(clean(value));
const sha=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.keys(value).sort().reduce((out,key)=>(out[key]=normalize(value[key]),out),{}):value;
export const complianceFingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
export const transactionFamily=dealType=>TRANSACTION_FAMILIES[clean(dealType)]||null;

export function normalizeReminderOffsets(value=DEFAULT_REMINDER_OFFSETS){
  const input=Array.isArray(value)?value:String(value??'').split(','),numbers=[...new Set(input.map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);
  return numbers.length&&numbers.every(x=>x>=0&&x<=365)?numbers:null;
}

export function validateRequirementDraft(input={}){
  const errors=[],offsets=normalizeReminderOffsets(input.reminderOffsetsDays),authority=clean(input.evidenceAuthority),officialDefinitionId=clean(input.officialDefinitionId)||null,officialDefinitionVersionId=clean(input.officialDefinitionVersionId)||null,documentType=clean(input.documentType)||null;
  const value={requirementCode:clean(input.requirementCode),label:clean(input.label),businessReason:clean(input.businessReason),transactionFamily:clean(input.transactionFamily),partyRole:clean(input.partyRole),partyKind:clean(input.partyKind),gateCode:clean(input.gateCode),requirementLevel:clean(input.requirementLevel),evidenceAuthority:authority,documentType,officialDefinitionId,officialDefinitionVersionId,reviewRequired:input.reviewRequired!==false&&input.reviewRequired!=='false',expiryMode:clean(input.expiryMode),reminderOffsetsDays:offsets,effectiveFrom:instant(input.effectiveFrom)};
  if(!stableCode(value.requirementCode))errors.push('Requirement code must be lowercase snake_case');
  if(value.label.length<3)errors.push('Document label is required');
  if(value.businessReason.length<10)errors.push('A meaningful business reason is required');
  if(!['sale','lease'].includes(value.transactionFamily))errors.push('Select Sale or Lease');
  if(!PARTY_ROLES.includes(value.partyRole))errors.push('Select Buyer, Seller, Landlord or Tenant');
  if(!PARTY_KINDS.includes(value.partyKind))errors.push('Select Individual or Organization');
  if(!GATE_CODES.includes(value.gateCode))errors.push('Select a supported Deal transition gate');
  if(!['required','advisory'].includes(value.requirementLevel))errors.push('Select Required or Advisory');
  if(!['generic_document','official_document'].includes(authority))errors.push('Select a supported evidence authority');
  if(authority==='generic_document'&&(!documentType||officialDefinitionId||officialDefinitionVersionId))errors.push('Generic evidence requires one document type and no official definition');
  if(authority==='official_document'&&(!officialDefinitionId||!officialDefinitionVersionId||documentType))errors.push('Official evidence requires the exact definition/version and no generic type');
  if(!['not_tracked','optional','required'].includes(value.expiryMode))errors.push('Select a supported expiry mode');
  if(!offsets)errors.push('Reminder offsets must be unique ascending calendar days from 0 to 365');
  if(!value.effectiveFrom)errors.push('A valid effective time is required');
  return{valid:errors.length===0,errors,value};
}

export function resolveComplianceMatrix({deal,parties=[],requirements=[]}){
  const family=transactionFamily(deal?.dealType),activeParties=parties.filter(x=>!x.effectiveTo&&PARTY_ROLES.includes(x.partyRole)),unsupportedParties=activeParties.filter(x=>x.transactionCounterpartyId).map(x=>({dealPartyId:x.id,partyRole:x.partyRole,state:'governed_party_required'}));
  if(!family)return{valid:false,error:'Unsupported Deal type',transactionFamily:null,instances:[],unsupportedParties};
  const governed=activeParties.filter(x=>x.contactId||x.companyId),instances=[];
  for(const party of governed){
    const kind=party.contactId?'individual':'organization';
    for(const rule of requirements.filter(x=>x.status==='active'&&x.transactionFamily===family&&x.partyRole===party.partyRole&&x.partyKind===kind)){
      const instance={dealId:deal.id,dealChecklistId:deal.checklistId,dealPartyId:party.id,requirementId:rule.requirementId,requirementVersionId:rule.id,partyRole:party.partyRole,partyKind:kind,gateCode:rule.gateCode,requirementLevel:rule.requirementLevel,evidenceAuthority:rule.evidenceAuthority,label:rule.label,responsibleAgentId:deal.ownerId};
      instance.instanceFingerprint=complianceFingerprint(instance);instances.push(instance);
    }
  }
  instances.sort((a,b)=>[a.partyRole,a.partyKind,a.gateCode,a.label,a.requirementVersionId].join('|').localeCompare([b.partyRole,b.partyKind,b.gateCode,b.label,b.requirementVersionId].join('|')));
  const partyContext=governed.map(x=>({id:x.id,partyRole:x.partyRole,contactId:x.contactId||null,companyId:x.companyId||null,effectiveFrom:x.effectiveFrom?new Date(x.effectiveFrom).toISOString():null})).sort((a,b)=>a.id.localeCompare(b.id));
  const partyContextHash=complianceFingerprint({dealId:deal.id,dealType:deal.dealType,parties:partyContext});
  const requestFingerprint=complianceFingerprint({dealChecklistId:deal.checklistId,partyContextHash,resolverVersion:DOCUMENT_COMPLIANCE_RESOLVER_VERSION,requirementVersions:instances.map(x=>x.requirementVersionId)});
  return{valid:true,transactionFamily:family,partyContextHash,requestFingerprint,instances,unsupportedParties};
}

export function validateGenericEvidence(input={},now=new Date().toISOString()){
  const errors=[],issuedAt=instant(input.issuedAt),expiresAt=input.expiresAt?instant(input.expiresAt):null,value={requirementInstanceId:clean(input.requirementInstanceId),issuedAt,expiresAt,idempotencyKey:clean(input.idempotencyKey),supersedesEvidenceId:clean(input.supersedesEvidenceId)||null};
  if(!value.requirementInstanceId)errors.push('Requirement instance is required');
  if(!issuedAt||Date.parse(issuedAt)>Date.parse(now))errors.push('A valid issue or receipt time is required');
  if(input.expiresAt&&(!expiresAt||Date.parse(expiresAt)<=Date.parse(issuedAt)))errors.push('Expiry must be after issue or receipt');
  if(value.idempotencyKey.length<8||value.idempotencyKey.length>160)errors.push('A valid idempotency key is required');
  return{valid:errors.length===0,errors,value};
}

export function validateComplianceReview(input={}){
  const errors=[],value={decision:clean(input.decision),reason:clean(input.reason),reviewConfirmation:input.reviewConfirmation===true};
  if(!['accepted','returned','rejected'].includes(value.decision))errors.push('Select Accept, Return or Reject');
  if(value.decision!=='accepted'&&value.reason.length<10)errors.push('A meaningful return or rejection reason is required');
  if(!value.reviewConfirmation)errors.push('Confirm the exact evidence and party/case links were reviewed');
  return{valid:errors.length===0,errors,value,requestFingerprint:errors.length?null:complianceFingerprint(value)};
}

export function deriveComplianceState({instance,evidence=null,review=null,officialState=null,newerAccepted=false,contextMatches=true,now=new Date().toISOString()}){
  if(!contextMatches)return'context_mismatch';
  if(instance?.governedPartyRequired)return'governed_party_required';
  if(instance?.evidenceAuthority==='official_document')return officialState||'missing';
  if(!evidence)return'missing';
  if(newerAccepted)return'superseded';
  if(instance.reviewRequired&& !review)return'pending_review';
  if(review&&review.decision!=='accepted')return review.decision;
  if(evidence.expiresAt&&Date.parse(evidence.expiresAt)<=Date.parse(now))return'expired';
  if(evidence.expiresAt){const days=(Date.parse(evidence.expiresAt)-Date.parse(now))/86400000,max=Math.max(...(instance.reminderOffsetsDays||DEFAULT_REMINDER_OFFSETS));if(days>0&&days<=max)return'expiring';}
  return'accepted';
}

export function evaluateComplianceGate({instances=[],gateCode}){
  const applicable=instances.filter(x=>x.gateCode===gateCode),blocking=applicable.filter(x=>x.requirementLevel==='required'&&!['accepted','expiring'].includes(x.state));
  return{gateCode,canProceed:blocking.length===0,requirements:applicable,blocking:blocking.map(x=>({instanceId:x.id,label:x.label,state:x.state,partyRole:x.partyRole}))};
}

export function complianceTaskPlan({instance,reason,now=new Date().toISOString(),reminderOffsetDays=0}){
  if(!REMINDER_REASONS.includes(reason))throw new Error('Unsupported compliance follow-up reason');
  const priority=['returned','rejected','expired'].includes(reason)?'high':'normal',dueAt=reason==='expiring'&&instance.expiresAt?new Date(Date.parse(instance.expiresAt)-Number(reminderOffsetDays)*86400000).toISOString():new Date(Date.parse(now)+(reason==='missing'?8:4)*3600000).toISOString();
  return{taskType:'document_compliance_follow_up',subject:`Document follow-up — ${instance.label}`,details:`${instance.partyRole.replaceAll('_',' ')} · ${reason.replaceAll('_',' ')} · Deal ${instance.dealReference||'reference'}`,assigneeId:instance.responsibleAgentId,priority,dueAt};
}

export function validateContextHash(value){return sha(value);}
