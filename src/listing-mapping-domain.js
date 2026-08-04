import { BEDROOMS, HANDOVER_STATUSES, PAYMENT_PLANS, PROPERTY_TYPES } from './inventory-domain.js';

const CODE=/^[a-z][a-z0-9_]{1,63}$/;
const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

export const LISTING_MAPPING_FIELDS=Object.freeze({
  areaCode:{label:'Area',dynamic:'areas'},
  propertyType:{label:'Property type',values:PROPERTY_TYPES.filter(value=>value!=='Bulk deal')},
  bedrooms:{label:'Bedrooms',values:BEDROOMS},
  paymentPlanType:{label:'Payment plan',values:PAYMENT_PLANS},
  exclusivityTier:{label:'Exclusivity tier',values:['Exclusive to Nysa','Shared network','Off-market']},
  handoverStatus:{label:'Handover status',values:HANDOVER_STATUSES},
  currency:{label:'Currency',values:['AED','USD','EUR','GBP','SAR']}
});

export function validateMappingVersion(body={}){
  const providerCode=clean(body.providerCode)?.toLowerCase(),versionCode=clean(body.versionCode),name=clean(body.name),description=clean(body.description);
  if(!providerCode||!CODE.test(providerCode))return{error:'Provider code must be lowercase snake_case'};
  if(!versionCode||versionCode.length>64)return{error:'Mapping version is required and must not exceed 64 characters'};
  if(!name||name.length>160)return{error:'Mapping version name is required and must not exceed 160 characters'};
  return{value:{providerCode,versionCode,name,description,cloneFromId:clean(body.cloneFromId)}};
}

export function validateMappingEntry(body={},validCoreValues=null){
  const fieldCode=clean(body.fieldCode),externalValue=clean(body.externalValue),coreValue=clean(body.coreValue);
  if(!LISTING_MAPPING_FIELDS[fieldCode])return{error:'Select a supported listing mapping field'};
  if(!externalValue||externalValue.length>250)return{error:'External value is required and must not exceed 250 characters'};
  if(!coreValue)return{error:'Select a governed CORE value'};
  if(Array.isArray(validCoreValues)&&!validCoreValues.includes(coreValue))return{error:'The selected CORE value is not currently governed for this field'};
  return{value:{fieldCode,externalValue,coreValue}};
}

export function validateMappingTransition(status,action,{reason,evidence}={}){
  const next={draft:{test:'tested'},tested:{approve:'approved'},approved:{activate:'active'},active:{retire:'retired'}}[status]?.[action];
  const past={test:'tested',approve:'approved',activate:'activated',retire:'retired'}[action]||action;
  if(!next)return{error:`A ${status} mapping version cannot be ${past}`};
  if(!clean(reason))return{error:'A lifecycle reason is required'};
  if(['test','approve','activate'].includes(action)&&!clean(evidence))return{error:'Test or approval evidence is required'};
  return{value:{nextStatus:next,reason:clean(reason),evidence:clean(evidence)}};
}

export function applyListingMappings(payload={},entries=[]){
  const listing={...(payload.listing||{})},applied=[];
  for(const entry of entries){
    const actual=listing[entry.fieldCode];
    if(actual===undefined||actual===null)continue;
    if(String(actual).trim().toLocaleLowerCase('en')!==String(entry.externalValue).trim().toLocaleLowerCase('en'))continue;
    listing[entry.fieldCode]=entry.coreValue;
    applied.push({fieldCode:entry.fieldCode,externalValue:String(actual),coreValue:entry.coreValue});
  }
  return{payload:{...payload,listing},applied};
}
