import crypto from 'node:crypto';

export const REQUIREMENT_CONFIRMATION_BASES=['direct_customer','documented_customer_instruction','reviewed_first_party_evidence'];
export const REQUIREMENT_CONFLICT_RESOLUTIONS=['confirmed_current_value','requires_new_version'];

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const fields=[
  ['business_line','businessLine'],['purpose','purpose'],['property_types','propertyTypes'],['areas','areas'],
  ['budget_min','budgetMin'],['budget_max','budgetMax'],['funding_method','fundingMethod'],
  ['bedrooms_min','bedroomsMin'],['bedrooms_max','bedroomsMax'],['timeline_code','timelineCode'],
  ['size_sqft_min','sizeSqftMin'],['size_sqft_max','sizeSqftMax'],
  ['declared_priorities','declaredPriorities'],['must_haves','mustHaves'],['preferences','preferences'],
  ['exclusions','exclusions'],['acceptable_trade_offs','acceptableTradeOffs']
];

const comparable=value=>Array.isArray(value)?[...new Set(value.map(item=>String(item).trim().toLocaleLowerCase()).filter(Boolean))].sort():
  value===null||value===undefined||value===''?null:typeof value==='number'||/^\d+(?:\.\d+)?$/.test(String(value))?Number(value):String(value).trim().toLocaleLowerCase();

export function requirementAuthoritySnapshot(requirement){
  return Object.fromEntries(fields.map(([fieldCode,key])=>[key,requirement[key]??null]));
}

export function requirementAuthorityHash(requirement){
  return crypto.createHash('sha256').update(JSON.stringify(requirementAuthoritySnapshot(requirement))).digest('hex');
}

export function detectWebsiteRequirementConflicts(previous,incoming={}){
  if(!previous)return[];
  return fields.flatMap(([fieldCode,key])=>{
    if(incoming[key]===undefined)return[];
    const prior=previous[key]??null,website=incoming[key]??null;
    return JSON.stringify(comparable(prior))===JSON.stringify(comparable(website))?[]:[{fieldCode,governedValue:prior,websiteValue:website}];
  });
}

export function validateRequirementConfirmation(body={}){
  const confirmationBasis=body.confirmationBasis,confirmationNotes=clean(body.confirmationNotes);
  if(!REQUIREMENT_CONFIRMATION_BASES.includes(confirmationBasis))return{error:'Select how the requirement was confirmed'};
  if(!confirmationNotes)return{error:'Confirmation notes are required'};
  if(confirmationNotes.length>2000)return{error:'Confirmation notes must be 2,000 characters or fewer'};
  return{value:{confirmationBasis,confirmationNotes}};
}

export function validateRequirementConflictResolution(body={}){
  const resolution=body.resolution,resolutionNotes=clean(body.resolutionNotes);
  if(!REQUIREMENT_CONFLICT_RESOLUTIONS.includes(resolution))return{error:'Select a valid website conflict resolution'};
  if(!resolutionNotes)return{error:'Conflict resolution notes are required'};
  if(resolutionNotes.length>2000)return{error:'Conflict resolution notes must be 2,000 characters or fewer'};
  return{value:{resolution,resolutionNotes}};
}
