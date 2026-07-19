import { parseBusinessAmount } from './crm-domain.js';

export const HANDOVER_STATUSES = Object.freeze(['ready','expected','to_be_confirmed']);
export const PAYMENT_PLANS = Object.freeze(['Cash','Mortgage','Developer plan','Post-handover']);
export const FUNDING_METHODS = Object.freeze(['cash','mortgage','mixed','unknown']);

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

export function derivePublicationReadiness(listing={},approvedMediaCount=0,now=new Date()){
  const blockers=[];
  const requireValue=(field,label)=>{if(listing[field]===null||listing[field]===undefined||String(listing[field]).trim()==='')blockers.push({code:field,label});};
  for(const [field,label] of [['project','Project'],['area','Area / community'],['propertyType','Property type'],['price','Asking price'],['currency','Currency'],['sizeSqft','Built-up area']])requireValue(field,label);
  if(listing.status!=='Available')blockers.push({code:'availability_status',label:'Listing must be Available'});
  const confirmed=listing.availabilityConfirmedAt?new Date(listing.availabilityConfirmedAt):null;
  if(!confirmed||Number.isNaN(confirmed.valueOf())||(now-confirmed)>7*86400000)blockers.push({code:'availability_confirmation',label:'Availability must be confirmed within the last 7 days'});
  if(!['verified','not_required'].includes(listing.verificationStatus))blockers.push({code:'verification',label:'Verification must be verified or not required'});
  if(listing.verificationExpiresAt&&new Date(listing.verificationExpiresAt)<=now)blockers.push({code:'verification_expiry',label:'Verification has expired'});
  if(listing.permitExpiresAt&&new Date(listing.permitExpiresAt)<=now)blockers.push({code:'permit_expiry',label:'Permit has expired'});
  if(Number(approvedMediaCount)<1)blockers.push({code:'approved_media',label:'At least one approved property image is required'});
  return{status:blockers.length?'blocked':'ready',ready:blockers.length===0,blockers};
}
