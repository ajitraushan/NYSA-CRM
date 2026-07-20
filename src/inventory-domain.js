import { parseBusinessAmount } from './crm-domain.js';

export const HANDOVER_STATUSES = Object.freeze(['ready','expected','to_be_confirmed']);
export const PAYMENT_PLANS = Object.freeze(['Cash','Mortgage','Developer plan','Post-handover']);
export const FUNDING_METHODS = Object.freeze(['cash','mortgage','mixed','unknown']);
export const PROPERTY_TYPES = Object.freeze(['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal']);
export const UNIT_PROPERTY_TYPES = Object.freeze(PROPERTY_TYPES.filter(value=>value!=='Bulk deal'));
export const BEDROOMS = Object.freeze(['Studio','1','2','3','4','5+']);

export function normalizeInventoryAmount(value,{required=false,label='Amount'}={}) {
  if(value===null||value===undefined||String(value).trim()==='')return required?{error:`${label} is required`}:{value:null};
  const amount=parseBusinessAmount(value);
  if(!Number.isFinite(amount)||amount<0||(required&&amount<=0))return{error:`${label} must be ${required?'a positive':'a non-negative'} amount such as 1 M, 750K or 1000000`};
  return{value:amount};
}

export function normalizeHandover(body={}) {
  let status=body.handoverStatus,expectedDate=body.handoverExpectedDate;
  if(!status&&body.handoverDate){status=body.handoverDate==='Ready'?'ready':/^\d{4}-\d{2}-\d{2}$/.test(String(body.handoverDate))?'expected':'to_be_confirmed';expectedDate=status==='expected'?body.handoverDate:null;}
  status=status||'to_be_confirmed';
  if(!HANDOVER_STATUSES.includes(status))return{error:'Handover status must be Ready, Expected on a maintained date, or To be confirmed'};
  if(status==='expected'&&!/^\d{4}-\d{2}-\d{2}$/.test(String(expectedDate||'')))return{error:'Expected handover requires a valid date'};
  if(status!=='expected')expectedDate=null;
  return{status,expectedDate,legacyValue:status==='ready'?'Ready':status==='expected'?expectedDate:null};
}

export function fundingPaymentCompatibility(fundingMethod,paymentPlanType){
  if(!fundingMethod||fundingMethod==='unknown'||!paymentPlanType)return{compatible:true,code:'not_assessed',label:'Compatibility not assessed'};
  const allowed={cash:['Cash','Developer plan','Post-handover'],mortgage:['Mortgage','Cash'],mixed:['Mortgage','Developer plan','Post-handover','Cash']}[fundingMethod]||[];
  const compatible=allowed.includes(paymentPlanType);
  return{compatible,code:compatible?'compatible':'incompatible',label:compatible?'Funding and payment plan are compatible':`${paymentPlanType} requires customer confirmation for ${fundingMethod} funding`};
}

export function normalizeBulkUnits(propertyType,source=[]){
  if(propertyType!=='Bulk deal')return{units:[]};
  if(!Array.isArray(source)||source.length<2)return{error:'Bulk deal requires at least two property or unit rows'};
  const units=[];
  for(let index=0;index<source.length;index++){
    const input=source[index]||{},position=index+1,unitReference=String(input.unitReference||'').trim(),unitPropertyType=String(input.propertyType||'').trim();
    if(!unitReference)return{error:`Bulk deal row ${position}: unit / property reference is required`};
    if(!UNIT_PROPERTY_TYPES.includes(unitPropertyType))return{error:`Bulk deal row ${position}: select a property type`};
    const bedroomValue=String(input.bedrooms||'').trim();
    if(unitPropertyType!=='Plot'&&!BEDROOMS.includes(bedroomValue))return{error:`Bulk deal row ${position}: bedrooms are required for ${unitPropertyType}`};
    if(unitPropertyType==='Plot'&&bedroomValue)return{error:`Bulk deal row ${position}: bedrooms do not apply to Plot`};
    const sizeSqft=Number(input.sizeSqft);
    if(!Number.isFinite(sizeSqft)||sizeSqft<=0)return{error:`Bulk deal row ${position}: built-up / plot area must be positive`};
    const price=normalizeInventoryAmount(input.price,{required:true,label:`Bulk deal row ${position} asking price`});
    if(price.error)return{error:price.error};
    units.push({unitReference,propertyType:unitPropertyType,bedrooms:bedroomValue||null,sizeSqft,price:price.value});
  }
  const references=units.map(item=>item.unitReference.toLowerCase());
  if(new Set(references).size!==references.length)return{error:'Bulk deal unit / property references must be unique within the deal'};
  return{units};
}

export function derivePublicationReadiness(listing={},approvedMediaCount=0,now=new Date()){
  const blockers=[];
  const requireValue=(field,label)=>{if(listing[field]===null||listing[field]===undefined||String(listing[field]).trim()==='')blockers.push({code:field,label});};
  for(const [field,label] of [['project','Project'],['area','Area'],['propertyType','Property type'],['price','Asking price'],['currency','Currency']])requireValue(field,label);
  if(listing.propertyType==='Bulk deal'){
    if(Number(listing.bulkUnitCount||0)<2)blockers.push({code:'bulk_units',label:'At least two complete bulk-deal property rows are required'});
    if(Number(listing.incompleteBulkUnitCount||0)>0)blockers.push({code:'bulk_unit_completeness',label:'Every bulk-deal property row must be complete'});
  }else requireValue('sizeSqft','Built-up area');
  if(listing.status!=='Available')blockers.push({code:'availability_status',label:'Listing must be Available'});
  const confirmed=listing.availabilityConfirmedAt?new Date(listing.availabilityConfirmedAt):null;
  if(!confirmed||Number.isNaN(confirmed.valueOf())||(now-confirmed)>7*86400000)blockers.push({code:'availability_confirmation',label:'Availability must be confirmed within the last 7 days'});
  if(!['verified','not_required'].includes(listing.verificationStatus))blockers.push({code:'verification',label:'Verification must be verified or not required'});
  if(listing.verificationExpiresAt&&new Date(listing.verificationExpiresAt)<=now)blockers.push({code:'verification_expiry',label:'Verification has expired'});
  if(listing.permitExpiresAt&&new Date(listing.permitExpiresAt)<=now)blockers.push({code:'permit_expiry',label:'Permit has expired'});
  if(Number(approvedMediaCount)<1)blockers.push({code:'approved_media',label:'At least one approved property image is required'});
  return{status:blockers.length?'blocked':'ready',ready:blockers.length===0,blockers};
}
