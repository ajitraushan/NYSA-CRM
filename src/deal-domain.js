import { parseBusinessAmount } from './crm-domain.js';

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
export const DEAL_TYPES=Object.freeze(['sale','rental','off_plan','commercial_sale','commercial_rental']);
export const DEAL_LOST_REASONS=Object.freeze(['customer_withdrew','finance_failed','legal_or_compliance','seller_or_landlord_withdrew','terms_not_agreed','reservation_expired','other']);
export const DEAL_PARTY_ROLES=Object.freeze(['buyer','seller','tenant','landlord','developer','buyer_representative','seller_representative','tenant_representative','landlord_representative','other']);
export const REQUIRED_PARTIES=Object.freeze({
  sale:['buyer','seller'],
  rental:['tenant','landlord'],
  off_plan:['buyer','developer'],
  commercial_sale:['buyer','seller'],
  commercial_rental:['tenant','landlord']
});

export function dealTypeForOffer(offerType,commercialMode){
  if(offerType==='purchase')return'sale';
  if(offerType==='rental')return'rental';
  if(offerType==='off_plan')return'off_plan';
  if(offerType==='commercial'&&['sale','rental'].includes(commercialMode))return`commercial_${commercialMode}`;
  return null;
}

export function validateDealCreate(input={},context={}){
  const dealType=dealTypeForOffer(context.offerType,input.commercialMode);
  if(!dealType)return{error:'Select whether this Commercial deal is a sale or rental'};
  const target=new Date(input.targetCompletionAt);
  if(!input.targetCompletionAt||Number.isNaN(target.valueOf()))return{error:'A valid target completion date is required'};
  if(target<=new Date())return{error:'Target completion must be in the future'};
  const agreedValue=parseBusinessAmount(context.agreedValue);
  if(!Number.isFinite(agreedValue)||agreedValue<=0)return{error:'The exact accepted offer value is not valid'};
  return{value:{dealType,targetCompletionAt:target.toISOString(),agreedValue,currency:String(context.currency||'').toUpperCase()}};
}

export function validateDealParty(input={}){
  const role=input.partyRole,side=input.side,contactId=clean(input.contactId),companyId=clean(input.companyId),
    representation=clean(input.representation)||'direct',sourceEvidence=clean(input.sourceEvidence);
  if(!DEAL_PARTY_ROLES.includes(role))return{error:'Select a valid transaction-party role'};
  if(!['buyer_side','seller_side','neutral'].includes(side))return{error:'Select the party side'};
  if(Boolean(contactId)===Boolean(companyId))return{error:'Select exactly one Contact or Company'};
  if(!sourceEvidence)return{error:'Record the source evidence for this party'};
  return{value:{partyRole:role,side,contactId,companyId,representation,isPrimary:input.isPrimary===true||input.isPrimary==='on',sourceEvidence}};
}

export function validateDealApproval(input={}){
  const reason=clean(input.reason),evidenceReference=clean(input.evidenceReference);
  if(!reason||reason.length<5)return{error:'Record the approval reason or decision basis'};
  if(!evidenceReference)return{error:'Record the approval evidence reference'};
  return{value:{reason,evidenceReference}};
}

export function validateDealCloseWon(input={},now=new Date()){
  const evidenceReference=clean(input.evidenceReference),completionNote=clean(input.completionNote),
    actualCompletionAt=new Date(input.actualCompletionAt);
  if(input.confirmAuthoritativeClosure!==true)return{error:'Confirm that the transaction is complete and should be authoritatively closed won'};
  if(!evidenceReference)return{error:'Record the final completion evidence reference'};
  if(!completionNote||completionNote.length<5)return{error:'Record a final completion note'};
  if(!input.actualCompletionAt||Number.isNaN(actualCompletionAt.valueOf()))return{error:'Record the actual completion date and time'};
  if(actualCompletionAt>now)return{error:'Actual completion cannot be in the future'};
  return{value:{evidenceReference,completionNote,actualCompletionAt:actualCompletionAt.toISOString()}};
}

export function validateDealCloseLost(input={}){
  const reasonCode=clean(input.reasonCode),reason=clean(input.reason),evidenceReference=clean(input.evidenceReference);
  if(!DEAL_LOST_REASONS.includes(reasonCode))return{error:'Select a controlled reason why the transaction did not complete'};
  if(!reason||reason.length<5)return{error:'Record a clear explanation for closing the Deal as lost'};
  if(!evidenceReference)return{error:'Record the evidence reference for the failed transaction'};
  if(input.confirmCloseLost!==true)return{error:'Confirm that the Deal and Opportunity should close lost and the reservation should be released'};
  return{value:{reasonCode,reason,evidenceReference}};
}

export function dealClosureGates({deal,parties=[],items=[]}={}){
  if(!deal)return[{code:'deal',label:'Create the governed Deal record',complete:false}];
  const roles=new Set(parties.filter(x=>!x.effectiveTo).map(x=>x.partyRole));
  const required=REQUIRED_PARTIES[deal.dealType]||[];
  const missing=required.filter(role=>!roles.has(role));
  const incomplete=items.filter(item=>item.required&& !['completed','waived'].includes(item.status));
  return[
    {code:'terms',label:'Exact accepted offer terms linked',complete:Boolean(deal.acceptedOfferRevisionId)},
    {code:'reservation',label:'Governed reservation preserved',complete:['reserved','completed'].includes(deal.bookingStatus)},
    {code:'parties',label:missing.length?`Add mandatory parties: ${missing.join(', ')}`:'Mandatory parties recorded',complete:missing.length===0},
    {code:'checklist',label:incomplete.length?`Complete ${incomplete.length} required checklist item${incomplete.length===1?'':'s'}`:'Required checklist items complete',complete:incomplete.length===0},
    {code:'approval',label:'Manager/Director closure approval recorded',complete:Boolean(deal.approvedAt)},
    {code:'closure',label:'Authoritative Closed Won recorded',complete:deal.status==='closed_won'}
  ];
}
