const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const DAY_MS=24*60*60*1000;
export const BOOKING_TERMINAL_STATUSES=Object.freeze(['released','expired','cancelled']);
export function validateBookingCreate(input={},now=new Date()){
  const start=new Date(now),expiry=new Date(start.getTime()+7*DAY_MS),refundableState=input.refundableState,
    evidence=input.evidence||{};
  if(!['refundable','non_refundable','conditional'].includes(refundableState))return{error:'Select the refundable state'};
  if(!evidence.fileName||!evidence.mediaType||!evidence.base64)return{error:'Reservation evidence document is required'};
  return{value:{refundableState,reservationStartsAt:start.toISOString(),expiresAt:expiry.toISOString(),evidence,notes:clean(input.notes)}};
}
export function validateBookingExtension(booking,input={},now=new Date()){
  const currentExpiry=new Date(booking.expiresAt),start=new Date(booking.reservationStartsAt),nextExpiry=new Date(input.expiresAt),reason=clean(input.reason);
  if(booking.status!=='reserved')return{error:'Only an active reservation can be extended'};
  if(Number.isNaN(currentExpiry.valueOf())||Number.isNaN(start.valueOf())||Number.isNaN(nextExpiry.valueOf()))return{error:'Select a valid extension expiry'};
  if(currentExpiry<=now)return{error:'An expired reservation cannot be extended; record its expiry and create a new governed reservation if required'};
  if(nextExpiry<=currentExpiry)return{error:'The approved expiry must be later than the current expiry'};
  if(nextExpiry-start>14*DAY_MS)return{error:'Reservation extensions cannot exceed fourteen cumulative days from the original start'};
  if(!reason||reason.length<10)return{error:'Manager extension reason must contain at least ten characters'};
  return{value:{expiresAt:nextExpiry.toISOString(),reason}};
}
export function validateBookingTransition(status,input={},now=new Date()){
  const toStatus=input.toStatus,reason=clean(input.reason);
  if(status!=='reserved')return{error:'Only an active reservation can be released, expired or cancelled'};
  if(!BOOKING_TERMINAL_STATUSES.includes(toStatus))return{error:'Select release, expiry or cancellation'};
  if(['released','cancelled'].includes(toStatus)&&!reason)return{error:'A reason is required for release or cancellation'};
  if(toStatus==='expired'&&new Date(input.expiresAt)>now)return{error:'The reservation has not reached its expiry time'};
  return{value:{toStatus,reason}};
}
