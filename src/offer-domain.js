export const OFFER_TYPES=['purchase','rental','off_plan','commercial'];
export const OFFER_STATUSES=['draft','sent','viewed','countered','accepted','rejected','expired','withdrawn'];
export const OFFER_EVENT_TYPES=['viewed','acknowledged','countered','accepted','rejected','expired','withdrawn'];
export const OFFER_COUNTERPARTY_ROLES=['customer','seller','landlord','developer','agent','other'];

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const amount=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);return Number.isFinite(number)?number:null;
};

export function validateOfferRevision(body={},revisionNumber=1){
  const offerType=body.offerType,direction=body.direction||'outbound',proposerRole=body.proposerRole||'customer',
    value=amount(body.amount),depositAmount=amount(body.depositAmount),currency=clean(body.currency)?.toUpperCase(),
    expiry=new Date(body.validityExpiresAt),reason=clean(body.materialCorrectionReason);
  if(revisionNumber===1&&!OFFER_TYPES.includes(offerType))return {error:'Select a valid offer type'};
  if(!['outbound','inbound'].includes(direction))return {error:'Select whether this revision is outbound or inbound'};
  if(!OFFER_COUNTERPARTY_ROLES.includes(proposerRole))return {error:'Select who proposed these terms'};
  if(value===null||value<=0)return {error:'Offer amount must be greater than zero'};
  if(!currency||!/^[A-Z]{3}$/.test(currency))return {error:'Use a three-letter currency code'};
  if(depositAmount!==null&&(depositAmount<0||depositAmount>value))return {error:'Deposit must be between zero and the offer amount'};
  if(!body.validityExpiresAt||Number.isNaN(expiry.valueOf())||expiry<=new Date())return {error:'Offer validity must end in the future'};
  if(revisionNumber>1&&!reason)return {error:'A reason is required for every material correction or revised offer'};
  return {value:{offerType,direction,proposerRole,amount:value,depositAmount,currency,
    financingMethod:clean(body.financingMethod),paymentTerms:clean(body.paymentTerms),
    conditions:clean(body.conditions),validityExpiresAt:expiry.toISOString(),materialCorrectionReason:reason}};
}

const transitions={
  sent:['viewed','acknowledged','countered','accepted','rejected','expired','withdrawn'],
  viewed:['acknowledged','countered','accepted','rejected','expired','withdrawn'],
  countered:['accepted','rejected','expired','withdrawn'],
  draft:['withdrawn']
};

export function validateOfferEvent(currentStatus,body={}){
  const eventType=body.eventType,reason=clean(body.reason),summary=clean(body.summary),
    counterpartyRole=body.counterpartyRole||'customer',direction=body.direction||'inbound';
  if(!OFFER_EVENT_TYPES.includes(eventType))return {error:'Select a valid negotiation event'};
  if(!OFFER_STATUSES.includes(currentStatus)||!(transitions[currentStatus]||[]).includes(eventType)){
    return {error:`${eventType} cannot follow an offer in ${currentStatus} status`};
  }
  if(['rejected','withdrawn'].includes(eventType)&&!reason)return {error:`A reason is required when an offer is ${eventType}`};
  if(!OFFER_COUNTERPARTY_ROLES.includes(counterpartyRole))return {error:'Select the counterparty role'};
  if(!['outbound','inbound','internal'].includes(direction))return {error:'Select a valid negotiation direction'};
  return {value:{eventType,reason,summary:summary||{
    viewed:'Offer viewed by counterparty',acknowledged:'Offer acknowledged by counterparty',
    countered:'Counterparty returned a counter position',accepted:'Exact offer revision accepted',
    rejected:'Offer rejected',expired:'Offer validity expired',withdrawn:'Offer withdrawn'
  }[eventType],counterpartyRole,direction}};
}

export function offerStatusAfterRevision(direction){
  return direction==='inbound'?'countered':'draft';
}
