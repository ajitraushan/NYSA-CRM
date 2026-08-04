import { BEDROOMS, PAYMENT_PLANS, PROPERTY_TYPES, normalizeHandover, normalizeInventoryAmount } from './inventory-domain.js';

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const CODE=/^[a-z][a-z0-9_]{1,63}$/;
const TIERS=['Exclusive to Nysa','Shared network','Off-market'];

export function validateListingIntakePayload(body={}){
  const eventId=clean(body.eventId),provider=clean(body.provider)?.toLowerCase(),externalRecordId=clean(body.externalRecordId),mappingVersion=clean(body.mappingVersion),sourceKind=clean(body.sourceKind)||'integration',listing=body.listing;
  if(!eventId||eventId.length>128)return{error:'eventId is required and must not exceed 128 characters',code:'INVALID_EVENT_ID'};
  if(!provider||!CODE.test(provider))return{error:'provider must be a lowercase stable code',code:'INVALID_PROVIDER'};
  if(!externalRecordId||externalRecordId.length>160)return{error:'externalRecordId is required and must not exceed 160 characters',code:'INVALID_EXTERNAL_RECORD_ID'};
  if(!mappingVersion||mappingVersion.length>64)return{error:'mappingVersion is required and must not exceed 64 characters',code:'INVALID_MAPPING_VERSION'};
  if(!['integration','import'].includes(sourceKind))return{error:'sourceKind must be integration or import',code:'INVALID_SOURCE_KIND'};
  if(!listing||typeof listing!=='object'||Array.isArray(listing))return{error:'listing object is required',code:'INVALID_LISTING'};
  const project=clean(listing.project),areaCode=clean(listing.areaCode)?.toLowerCase(),propertyType=clean(listing.propertyType);
  if(!project||project.length>250)return{error:'listing.project is required and must not exceed 250 characters',code:'INVALID_PROJECT'};
  if(!areaCode||!CODE.test(areaCode))return{error:'listing.areaCode must be a governed lowercase stable code',code:'UNMAPPED_AREA'};
  if(!PROPERTY_TYPES.includes(propertyType))return{error:'listing.propertyType is not mapped to a governed value',code:'UNMAPPED_PROPERTY_TYPE'};
  if(propertyType==='Bulk deal')return{error:'Bulk deal integration intake requires a future governed child-property mapping',code:'UNMAPPED_BULK_DEAL'};
  const bedrooms=clean(listing.bedrooms);
  if(bedrooms&&!BEDROOMS.includes(bedrooms))return{error:'listing.bedrooms is not mapped to a governed value',code:'UNMAPPED_BEDROOMS'};
  if(propertyType!=='Plot'&&!bedrooms)return{error:'listing.bedrooms is required for built property types',code:'INVALID_BEDROOMS'};
  if(propertyType==='Plot'&&bedrooms)return{error:'listing.bedrooms does not apply to Plot',code:'INVALID_BEDROOMS'};
  const sizeSqft=Number(listing.sizeSqft);if(!Number.isFinite(sizeSqft)||sizeSqft<=0)return{error:'listing.sizeSqft must be a positive number',code:'INVALID_SIZE'};
  const price=normalizeInventoryAmount(listing.price,{required:true,label:'listing.price'});if(price.error)return{error:price.error,code:'INVALID_PRICE'};
  const reference=normalizeInventoryAmount(listing.referencePrice,{label:'listing.referencePrice'});if(reference.error)return{error:reference.error,code:'INVALID_REFERENCE_PRICE'};
  const currency=clean(listing.currency)||'AED';if(!/^[A-Z]{3}$/.test(currency))return{error:'listing.currency must be a 3-letter ISO code',code:'INVALID_CURRENCY'};
  const paymentPlanType=clean(listing.paymentPlanType);if(paymentPlanType&&!PAYMENT_PLANS.includes(paymentPlanType))return{error:'listing.paymentPlanType is not mapped to a governed value',code:'UNMAPPED_PAYMENT_PLAN'};
  for(const field of ['downPaymentPercent','onHandoverPercent','postHandoverYears'])if(listing[field]!==undefined&&listing[field]!==null&&listing[field]!==''&&(!Number.isFinite(Number(listing[field]))||Number(listing[field])<0))return{error:`listing.${field} must be a non-negative number`,code:'INVALID_COMMERCIAL_TERMS'};
  for(const field of ['downPaymentPercent','onHandoverPercent'])if(listing[field]!==undefined&&listing[field]!==null&&Number(listing[field])>100)return{error:`listing.${field} cannot exceed 100`,code:'INVALID_COMMERCIAL_TERMS'};
  const exclusivityTier=clean(listing.exclusivityTier)||'Off-market';if(!TIERS.includes(exclusivityTier))return{error:'listing.exclusivityTier is not mapped to a governed value',code:'UNMAPPED_EXCLUSIVITY'};
  const handover=normalizeHandover(listing);if(handover.error)return{error:handover.error,code:'INVALID_HANDOVER'};
  return{value:{eventId,provider,externalRecordId,mappingVersion,sourceKind,listing:{
    project,developer:clean(listing.developer),areaCode,community:clean(listing.community),propertyType,bedrooms,sizeSqft,price:price.value,referencePrice:reference.value,currency,
    paymentPlanType,downPaymentPercent:listing.downPaymentPercent??null,onHandoverPercent:listing.onHandoverPercent??null,postHandoverYears:listing.postHandoverYears??null,
    paymentPlanNotes:clean(listing.paymentPlanNotes),handoverDate:handover.legacyValue,handoverStatus:handover.status,handoverExpectedDate:handover.expectedDate,
    exclusivityTier,contact:clean(listing.contact),notes:clean(listing.notes)
  }}};
}

export function isMappingException(code=''){return String(code).startsWith('UNMAPPED_');}
