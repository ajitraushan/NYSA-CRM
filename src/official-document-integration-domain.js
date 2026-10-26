import crypto from 'node:crypto';

export const OFFICIAL_DOCUMENT_INTEGRATION_POLICY_VERSION='r4-official-document-integration-v1';
export const OFFICIAL_DOCUMENT_STEPS=Object.freeze({
  external_listing:'Prepare external listing',buyer_representation:'Confirm buyer representation',
  sale_agreement:'Complete sale agreement',transfer:'Prepare property transfer'
});
export const OFFICIAL_DOCUMENT_ACCEPTED_STATUSES=Object.freeze(['official_captured','external_verified']);
const clean=value=>String(value??'').trim();
const instant=value=>{const normalized=clean(value);return normalized&&Number.isFinite(Date.parse(normalized))?normalized:null;};
const stable=value=>/^[a-z][a-z0-9_]*$/.test(clean(value));
const sha=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const canonical=value=>JSON.stringify(Object.keys(value).sort().reduce((result,key)=>({...result,[key]:value[key]}),{}));
export const evidenceFingerprint=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');

export function validateDefinitionDraft(input={}){
  const errors=[],value={stableCode:clean(input.stableCode),label:clean(input.label),expectedIssuer:clean(input.expectedIssuer),acceptedStatus:clean(input.acceptedStatus),expiryTracked:input.expiryTracked===true};
  if(!stable(value.stableCode))errors.push('Document code must be a stable lowercase code');
  if(value.label.length<3)errors.push('Document name is required');
  if(value.expectedIssuer.length<3)errors.push('Expected issuer is required');
  if(!OFFICIAL_DOCUMENT_ACCEPTED_STATUSES.includes(value.acceptedStatus))errors.push('Select a supported accepted evidence status');
  return{valid:errors.length===0,errors,value};
}

export function validateStepRuleDraft(input={}){
  const errors=[],value={stepCode:clean(input.stepCode),definitionId:clean(input.definitionId),requirementLevel:clean(input.requirementLevel),businessReason:clean(input.businessReason)};
  if(!OFFICIAL_DOCUMENT_STEPS[value.stepCode])errors.push('Select a predefined workflow step');
  if(!value.definitionId)errors.push('Active document definition is required');
  if(!['required','advisory'].includes(value.requirementLevel))errors.push('Select Required or Advisory');
  if(value.businessReason.length<5)errors.push('Business reason is required');
  return{valid:errors.length===0,errors,value};
}

export function validateEvidenceSubmission(input={},now=new Date().toISOString()){
  const errors=[],issuedAt=instant(input.issuedAt),expiresAt=input.expiresAt?instant(input.expiresAt):null,evaluatedAt=instant(now);
  const value={definitionVersionId:clean(input.definitionVersionId),officialReference:clean(input.officialReference),issuerReference:clean(input.issuerReference),issuedAt,expiresAt,listingId:clean(input.listingId)||null,dealId:clean(input.dealId)||null,contextHash:clean(input.contextHash).toLowerCase(),idempotencyKey:clean(input.idempotencyKey),supersedesEvidenceId:clean(input.supersedesEvidenceId)||null};
  if(!evaluatedAt)errors.push('Evaluation time must be valid');
  if(!value.definitionVersionId)errors.push('Active document definition version is required');
  if(!value.officialReference)errors.push('Official document reference is required');
  if(!value.issuerReference)errors.push('Issuer reference is required');
  if(!issuedAt||Date.parse(issuedAt)>Date.parse(evaluatedAt))errors.push('Valid issue or execution time is required');
  if(input.expiresAt&&(!expiresAt||!issuedAt||Date.parse(expiresAt)<=Date.parse(issuedAt)))errors.push('Expiry must be after issue');
  if(!value.listingId&&!value.dealId)errors.push('Link evidence to Inventory and/or Deal');
  if(!sha(value.contextHash))errors.push('Exact case context hash is required');
  if(value.idempotencyKey.length<8||value.idempotencyKey.length>160)errors.push('A valid idempotency key is required');
  return{valid:errors.length===0,errors,value,requestFingerprint:errors.length?null:evidenceFingerprint(value)};
}

export function validateEvidenceReview(input={}){
  const errors=[],value={decision:clean(input.decision),reason:clean(input.reason),reviewConfirmation:input.reviewConfirmation===true};
  if(!['verified','returned','rejected'].includes(value.decision))errors.push('Select a supported review decision');
  if(value.decision!=='verified'&&value.reason.length<10)errors.push('A meaningful return or rejection reason is required');
  if(!value.reviewConfirmation)errors.push('Confirm the exact PDF and case links were reviewed');
  return{valid:errors.length===0,errors,value,requestFingerprint:errors.length?null:evidenceFingerprint(value)};
}

export function deriveEvidenceState({evidence,review,newerEvidence=false,contextHash,now=new Date().toISOString()}){
  if(!evidence)return'missing';
  if(newerEvidence)return'superseded';
  if(clean(evidence.contextHash)!==clean(contextHash))return'context_mismatch';
  if(!review)return'pending_verification';
  if(review.decision!=='verified')return review.decision;
  if(evidence.expiresAt&&Date.parse(evidence.expiresAt)<=Date.parse(now))return'expired';
  return evidence.acceptedStatus;
}

export function evaluateOfficialDocumentRequirements({rules=[],evidence=[],contextHash,now=new Date().toISOString()}){
  const requirements=rules.map(rule=>{
    const candidates=evidence.filter(item=>item.definitionId===rule.definitionId).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt)),current=candidates[0]||null;
    const state=deriveEvidenceState({evidence:current,review:current?.review,newerEvidence:false,contextHash,now});
    const satisfied=state===rule.acceptedStatus,blocking=rule.requirementLevel==='required'&&!satisfied;
    return{...rule,state,satisfied,blocking,evidenceId:current?.id||null,evidenceReference:current?.evidenceReference||null,
      documentVersionId:current?.documentVersionId||null,issuedAt:current?.issuedAt||null,expiresAt:current?.expiresAt||null,
      uploadedAt:current?.uploadedAt||null,reviewedAt:current?.review?.reviewedAt||null};
  });
  return{policyVersion:OFFICIAL_DOCUMENT_INTEGRATION_POLICY_VERSION,stepCanComplete:requirements.every(item=>!item.blocking),requirements};
}

export function followupTaskPlan({requirement,reason,ownerId,now=new Date().toISOString()}){
  if(!['missing','returned','rejected','expiring'].includes(reason))throw new Error('Unsupported follow-up reason');
  const hours=reason==='expiring'?24:reason==='missing'?8:4,dueAt=new Date(Date.parse(now)+hours*3600000).toISOString();
  return{taskType:'general',subject:`Official document follow-up — ${requirement.documentLabel}`,details:`${OFFICIAL_DOCUMENT_STEPS[requirement.stepCode]} · ${reason.replaceAll('_',' ')}`,priority:reason==='returned'||reason==='rejected'?'high':'normal',assigneeId:ownerId,dueAt};
}
