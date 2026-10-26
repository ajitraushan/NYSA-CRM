export const INVENTORY_HISTORY_POLICY_VERSION='r4-inventory-history-v1';
export const INVENTORY_AVAILABILITY_STATES=Object.freeze(['available','reserved','under_offer','sold','rented','withdrawn','unknown']);
const clean=value=>String(value??'').trim(),instant=value=>{const x=clean(value);return x&&Number.isFinite(Date.parse(x))?x:null;};

export function prepareInventoryHistoryEvent(input={},existing=[]){
  const errors=[],recordedAt=instant(input.recordedAt),effectiveAt=instant(input.effectiveAt);
  if(!clean(input.inventoryRef))errors.push('Inventory reference is required');
  if(!['price','availability'].includes(input.eventType))errors.push('Select price or availability');
  if(!recordedAt||!effectiveAt||Date.parse(effectiveAt)>Date.parse(recordedAt))errors.push('Valid effective and recorded timestamps are required');
  if(!clean(input.sourceEvidenceRef)||!/^[a-f0-9]{64}$/i.test(clean(input.sourceEvidenceHash)))errors.push('Source evidence reference and SHA-256 are required');
  if(!clean(input.recordedByRef))errors.push('Recorder reference is required');
  if(input.eventType==='price'&&(!Number.isFinite(Number(input.value))||Number(input.value)<=0||clean(input.currency)!=='AED'))errors.push('Price must be a positive AED amount');
  if(input.eventType==='availability'&&!INVENTORY_AVAILABILITY_STATES.includes(input.value))errors.push('Select a supported availability state');
  const sameType=existing.filter(item=>item.inventoryRef===input.inventoryRef&&item.eventType===input.eventType),prior=[...sameType].sort((a,b)=>Date.parse(b.effectiveAt)-Date.parse(a.effectiveAt))[0]??null;
  const conflict=sameType.find(item=>item.effectiveAt===effectiveAt&&String(item.value)!==String(input.value)&&!['rejected','returned'].includes(item.status));
  if(errors.length)return{valid:false,errors,event:null,conflict:null};const sequence=sameType.length+1;
  return{valid:true,errors:[],conflict:conflict?{eventRef:conflict.eventRef,value:conflict.value}:null,event:{policyVersion:INVENTORY_HISTORY_POLICY_VERSION,eventRef:`${input.inventoryRef}-${input.eventType.toUpperCase()}-${sequence}`,inventoryRef:clean(input.inventoryRef),eventType:input.eventType,value:input.eventType==='price'?Number(input.value):input.value,currency:input.eventType==='price'?'AED':null,effectiveAt,recordedAt,sourceType:clean(input.sourceType)||'other',sourceEvidenceRef:clean(input.sourceEvidenceRef),sourceEvidenceHash:clean(input.sourceEvidenceHash),recordedByRef:clean(input.recordedByRef),status:conflict?'conflict_review':'pending_review',priorEffectiveEventRef:prior?.eventRef??null,immutable:true}};
}

export function reviewInventoryHistoryEvent({event,decision,reason,reviewedByRef,reviewedAt}){
  if(!event?.immutable||!['pending_review','conflict_review'].includes(event.status))throw new Error('Only a pending history event can be reviewed');
  if(!['accepted','returned','rejected'].includes(decision))throw new Error('Unsupported review decision');
  if(event.status==='conflict_review'&&decision==='accepted'&&clean(reason).length<10)throw new Error('Conflict acceptance requires a meaningful reason');
  if(decision!=='accepted'&&clean(reason).length<10)throw new Error('A meaningful reason is required');
  if(!clean(reviewedByRef))throw new Error('Reviewer reference is required');const at=instant(reviewedAt);if(!at)throw new Error('reviewedAt must be an ISO timestamp');
  return{...structuredClone(event),status:decision,review:{decision,reason:clean(reason)||null,reviewedByRef:clean(reviewedByRef),reviewedAt:at},immutable:true};
}

export function deriveInventoryHistoryState({inventoryRef,events=[],now,availabilityStaleAfterDays=7}){
  const evaluatedAt=instant(now);if(!evaluatedAt)throw new Error('now must be an ISO timestamp');
  const accepted=events.filter(item=>item.inventoryRef===inventoryRef&&item.status==='accepted');
  const latest=type=>accepted.filter(item=>item.eventType===type).sort((a,b)=>Date.parse(b.effectiveAt)-Date.parse(a.effectiveAt)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt))[0]??null;
  const price=latest('price'),availability=latest('availability'),previousPrice=accepted.filter(item=>item.eventType==='price'&&item.eventRef!==price?.eventRef).sort((a,b)=>Date.parse(b.effectiveAt)-Date.parse(a.effectiveAt))[0]??null;
  const change=price&&previousPrice?price.value-previousPrice.value:null,percent=change===null?null:Number(((change/previousPrice.value)*100).toFixed(2));
  const stale=availability?Date.parse(evaluatedAt)-Date.parse(availability.effectiveAt)>availabilityStaleAfterDays*86400000:true;
  return{policyVersion:INVENTORY_HISTORY_POLICY_VERSION,inventoryRef,currentPrice:price?{amount:price.value,currency:price.currency,eventRef:price.eventRef,effectiveAt:price.effectiveAt}:null,currentAvailability:availability?{state:availability.value,eventRef:availability.eventRef,effectiveAt:availability.effectiveAt,stale}:null,priceChange:change===null?null:{amount:change,percent,priorEventRef:previousPrice.eventRef},pendingReviewCount:events.filter(item=>item.inventoryRef===inventoryRef&&['pending_review','conflict_review'].includes(item.status)).length,derivedAt:evaluatedAt,inventoryMutationPerformed:false};
}
