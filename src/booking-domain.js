import { parseBusinessAmount } from './crm-domain.js';

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
export const BOOKING_TERMINAL_STATUSES=Object.freeze(['released','expired','cancelled']);
export function validateBookingCreate(input={}){
  const amount=parseBusinessAmount(input.bookingAmount),start=new Date(input.reservationStartsAt),expiry=new Date(input.expiresAt),
    currency=String(input.currency||'').trim().toUpperCase(),refundableState=input.refundableState,
    evidence=input.evidence||{};
  if(!Number.isFinite(amount)||amount<=0)return{error:'Reservation amount must be greater than zero'};
  if(!/^[A-Z]{3}$/.test(currency))return{error:'Currency must use a three-letter code'};
  if(!['refundable','non_refundable','conditional'].includes(refundableState))return{error:'Select the refundable state'};
  if(Number.isNaN(start.valueOf())||Number.isNaN(expiry.valueOf())||expiry<=start)return{error:'Reservation expiry must be after its start'};
  if(expiry<=new Date())return{error:'Reservation expiry must be in the future'};
  if(!evidence.fileName||!evidence.mediaType||!evidence.base64)return{error:'Reservation evidence document is required'};
  return{value:{bookingAmount:amount,currency,refundableState,reservationStartsAt:start.toISOString(),expiresAt:expiry.toISOString(),evidence,notes:clean(input.notes)}};
}
export function validateBookingTransition(status,input={},now=new Date()){
  const toStatus=input.toStatus,reason=clean(input.reason);
  if(status!=='reserved')return{error:'Only an active reservation can be released, expired or cancelled'};
  if(!BOOKING_TERMINAL_STATUSES.includes(toStatus))return{error:'Select release, expiry or cancellation'};
  if(['released','cancelled'].includes(toStatus)&&!reason)return{error:'A reason is required for release or cancellation'};
  if(toStatus==='expired'&&new Date(input.expiresAt)>now)return{error:'The reservation has not reached its expiry time'};
  return{value:{toStatus,reason}};
}
