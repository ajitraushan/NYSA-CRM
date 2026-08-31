export const PARTNER_ORGANIZATION_POLICY_VERSION = 'r4-partner-master-integration-v1';
export const PARTNER_ORGANIZATION_CLASSIFICATIONS = Object.freeze(['developer','external_agency','referral_partner','service_provider']);
export const PARTNER_ORGANIZATION_LEGAL_STRUCTURES = Object.freeze(['listed_company','private_company','sole_establishment','partnership','government_entity','other']);
export const PARTNER_COMPANY_ROLE = Object.freeze({developer:'developer',external_agency:'agency',referral_partner:'referral_partner',service_provider:'service_provider'});
export const INVENTORY_ORGANIZATION_RELATIONSHIPS = Object.freeze(['developer','listing_source_agency','referral_source']);
export const INVENTORY_RELATIONSHIP_CLASSIFICATION = Object.freeze({developer:'developer',listing_source_agency:'external_agency',referral_source:'referral_partner'});

const clean=value=>String(value??'').trim();
const instant=value=>{const normalized=clean(value);return normalized&&Number.isFinite(Date.parse(normalized))?new Date(normalized).toISOString():null;};

export function normalizePartnerOrganizationName(value){
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}

export function normalizePartnerLicenceReference(value){
  return clean(value).toLowerCase().replace(/\s+/g,' ');
}

export function validatePartnerOrganizationVersionInput(input={}){
  const errors=[];
  const classification=clean(input.classification);
  const legalStructure=clean(input.legalStructure);
  const legalName=clean(input.legalName);
  const tradeName=clean(input.tradeName)||null;
  const licenceReference=clean(input.licenceReference)||null;
  const licenceIssuer=clean(input.licenceIssuer)||null;
  const licenceExpiresAt=input.licenceExpiresAt?instant(input.licenceExpiresAt):null;
  const sourceEvidenceReference=clean(input.sourceEvidenceReference);
  if(!PARTNER_ORGANIZATION_CLASSIFICATIONS.includes(classification))errors.push('Select a supported governed classification');
  if(!PARTNER_ORGANIZATION_LEGAL_STRUCTURES.includes(legalStructure))errors.push('Select the organization legal structure');
  if(legalName.length<3)errors.push('Legal organization name is required');
  if(legalName.length>240)errors.push('Legal organization name is too long');
  if(tradeName&&tradeName.length>240)errors.push('Trade name is too long');
  if(input.licenceExpiresAt&&!licenceExpiresAt)errors.push('Licence expiry must be a valid date or timestamp');
  if((licenceIssuer||licenceExpiresAt)&&!licenceReference)errors.push('Licence reference is required when other licence facts are supplied');
  if(!sourceEvidenceReference)errors.push('A source or verification reference is required');
  if(sourceEvidenceReference.length>240)errors.push('Source evidence reference is too long');
  return{valid:errors.length===0,errors,value:errors.length?null:{
    policyVersion:PARTNER_ORGANIZATION_POLICY_VERSION,classification,legalStructure,legalName,tradeName,
    normalizedLegalName:normalizePartnerOrganizationName(legalName),licenceReference,
    normalizedLicenceReference:licenceReference?normalizePartnerLicenceReference(licenceReference):null,
    licenceIssuer,licenceExpiresAt,licenceEvidenceStatus:licenceReference?'provided':'not_provided',
    sourceEvidenceReference
  }};
}

export function findPartnerOrganizationDuplicates(candidate,existing=[]){
  if(!candidate)return[];
  const seen=new Set();
  return existing.filter(item=>item&&item.status!=='retired').flatMap(item=>{
    const companyId=clean(item.companyId||item.id),matches=[];
    if(candidate.normalizedLicenceReference&&normalizePartnerLicenceReference(item.normalizedLicenceReference||item.licenceReference)===candidate.normalizedLicenceReference)matches.push('exact_licence');
    if(normalizePartnerOrganizationName(item.normalizedLegalName||item.legalName||item.name)===candidate.normalizedLegalName)matches.push('normalized_legal_name');
    return matches.map(matchBasis=>({companyId,companyReference:clean(item.companyReference)||companyId,legalName:clean(item.legalName||item.name),classification:item.classification||null,matchBasis}));
  }).filter(item=>{const key=`${item.companyId}:${item.matchBasis}`;if(seen.has(key))return false;seen.add(key);return true;});
}

export function validatePartnerDuplicateDecision(input={}){
  const decision=clean(input.decision),reason=clean(input.reason),existingCompanyId=clean(input.existingCompanyId)||null;
  const errors=[];
  if(!['use_existing','continue_distinct'].includes(decision))errors.push('Select use existing Company or continue as distinct');
  if(reason.length<10)errors.push('A meaningful duplicate-review reason is required');
  if(decision==='use_existing'&&!existingCompanyId)errors.push('Existing Company is required when using an existing identity');
  return{valid:errors.length===0,errors,value:errors.length?null:{decision,reason,existingCompanyId}};
}

export function validatePartnerVerificationDecision(input={},version={},now=new Date().toISOString()){
  const decision=clean(input.decision),reason=clean(input.reason),evaluatedAt=instant(now),errors=[];
  if(!['activate','reject'].includes(decision))errors.push('Select activate or reject');
  if(reason.length<10)errors.push('A meaningful verification reason is required');
  if(!evaluatedAt)errors.push('Verification time is invalid');
  if(decision==='activate'&&version.licenceExpiresAt&&evaluatedAt&&Date.parse(version.licenceExpiresAt)<=Date.parse(evaluatedAt))errors.push('An expired licence cannot be activated');
  return{valid:errors.length===0,errors,value:errors.length?null:{decision,reason,evaluatedAt}};
}

export function validateInventoryOrganizationLinkEvent(input={},currentEvent=null){
  const action=clean(input.action),relationship=clean(input.relationship),partnerVersionId=clean(input.partnerVersionId)||null,reason=clean(input.reason),errors=[];
  if(!['linked','replaced','unlinked'].includes(action))errors.push('Select a supported organization-link action');
  if(!INVENTORY_ORGANIZATION_RELATIONSHIPS.includes(relationship))errors.push('Select a supported Inventory organization relationship');
  if(['linked','replaced'].includes(action)&&!partnerVersionId)errors.push('Active governed organization version is required');
  if(action==='unlinked'&&partnerVersionId)errors.push('Unlink cannot introduce another organization version');
  if(action==='linked'&&currentEvent)errors.push('Use replace when a current relationship already exists');
  if(['replaced','unlinked'].includes(action)&&!currentEvent)errors.push('There is no current relationship to replace or unlink');
  if(reason.length<10)errors.push('A meaningful relationship reason is required');
  return{valid:errors.length===0,errors,value:errors.length?null:{policyVersion:PARTNER_ORGANIZATION_POLICY_VERSION,action,relationship,partnerVersionId,reason,supersedesEventId:currentEvent?.id||null}};
}

export function partnerClassificationForRelationship(relationship){return INVENTORY_RELATIONSHIP_CLASSIFICATION[relationship]||null;}
