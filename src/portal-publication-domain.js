import { createHash } from 'node:crypto';

export const PORTAL_CODES=Object.freeze(['property_finder','bayut','dubizzle']);
export const PROPERTY_FINDER_PROPERTY_TYPES=Object.freeze([
  'apartment','villa','townhouse','duplex','penthouse','hotel-apartment','ivilla','palace','bungalow','compound','twin-house','chalet','cabin','rest-house',
  'office-space','shop','retail','show-room','restaurant','cafeteria','clinic','medical-facility','warehouse','factory','business-center','co-working-space',
  'land','farm','whole-building','full-floor','half-floor','roof','bulk-sale-unit','bulk-rent-unit','staff-accommodation','labor-camp'
]);
export const PROPERTY_FINDER_CONTENT_LIMITS=Object.freeze({title:Object.freeze({min:30,max:50}),description:Object.freeze({min:750,max:2000})});
export const PORTAL_FIELD_CATALOGUE=Object.freeze([
  ['inventory_reference','Internal Inventory reference','required','inventory'],
  ['offering_type','Sale or rent','required','portal_preparation'],
  ['uae_emirate','UAE emirate','required','portal_preparation'],
  ['property_status','Current property status','required','inventory'],
  ['property_category','Residential or commercial','required','portal_preparation'],
  ['property_type','Property type','required','inventory'],
  ['furnishing_type','Furnishing type','required','portal_preparation'],
  ['bedrooms','Bedrooms','conditional','inventory'],
  ['bathrooms','Bathrooms','conditional','portal_preparation'],
  ['price','Portal asking price','required','portal_preparation'],
  ['down_payment','Sale down-payment','conditional','portal_preparation'],
  ['currency','Currency','required','portal_preparation'],
  ['total_area','Built-up or plot area','required','inventory'],
  ['location','Portal-recognised location','required','portal_preparation'],
  ['project_status','Ready, resale or off-plan status','required','inventory'],
  ['title','Advertising title','required','portal_preparation'],
  ['description','Advertising description','required','portal_preparation'],
  ['images','Approved property images','required','approved_media'],
  ['portal_agent_reference','Portal-recognised publishing agent','required','portal_preparation'],
  ['property_reference','Regulatory property reference','required','portal_permit'],
  ['permit_number','RERA, Trakheesi or Madhmoun permit','conditional','portal_permit'],
  ['issuing_company_license_number','Real Estate Company licence number','conditional','portal_permit'],
  ['compliance_type','Portal compliance type','conditional','portal_preparation'],
  ['marketing_authority','Marketing-publication authority evidence','required','inventory_agreement','internal_only'],
  ['offplan_sale_type','New or resale','conditional','portal_preparation'],
  ['offplan_dld_waiver_percent','DLD waiver percentage','conditional','portal_preparation'],
  ['offplan_original_price','Original off-plan price','conditional','portal_preparation'],
  ['offplan_amount_paid','Amount already paid','conditional','portal_preparation']
].map(([fieldCode,businessLabel,requirementLevel,sourceKind,transmissionPolicy='outbound'])=>Object.freeze({fieldCode,businessLabel,requirementLevel,sourceKind,transmissionPolicy})));

const text=value=>String(value??'').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

export function portalPayloadHash(value){
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

const comparable=value=>text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export function mapPortalPropertyType(value){
  const normalized=comparable(value).replaceAll(' ','-'),mapped={plot:'land',flat:'apartment','town-house':'townhouse',office:'office-space',showroom:'show-room','business-centre':'business-center','co-working':'co-working-space'}[normalized]||normalized;
  return PROPERTY_FINDER_PROPERTY_TYPES.includes(mapped)?mapped:null;
}

function normalizedPortalVideoUrl(value,{youtubeOnly=false}={}){
  const raw=text(value);if(!raw)return{value:null};
  let url;try{url=new URL(raw);}catch{return{error:'Portal video links must be valid HTTPS URLs'};}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)return{error:'Portal video links must use credential-free HTTPS URLs'};
  if(youtubeOnly&&!['youtube.com','www.youtube.com','youtu.be','m.youtube.com'].includes(url.hostname.toLowerCase()))return{error:'Property Finder standard video must be a YouTube URL'};
  return{value:url.toString()};
}

export function normalizePortalPreparation(body={}){
  const portalCode=text(body.portalCode||body.channel).toLowerCase().replace(/[ -]+/g,'_');
  if(!PORTAL_CODES.includes(portalCode))return{error:'Select Property Finder, Bayut or Dubizzle'};
  const publicationTitle=text(body.publicationTitle),publicationDescription=text(body.publicationDescription),
    offeringType=text(body.offeringType).toLowerCase(),
    propertyCategory=text(body.propertyCategory).toLowerCase(),bathrooms=text(body.bathrooms),
    furnishingType=text(body.furnishingType).toLowerCase(),uaeEmirate=text(body.uaeEmirate).toLowerCase(),
    currency=text(body.currency).toUpperCase(),portalLocationReference=text(body.portalLocationReference),portalPropertyReference=text(body.portalPropertyReference),
    portalAgentReference=text(body.portalAgentReference),propertyType=mapPortalPropertyType(body.propertyType);
  const video=normalizedPortalVideoUrl(body.videoUrl,{youtubeOnly:portalCode==='property_finder'}),virtualTour=normalizedPortalVideoUrl(body.virtualTourUrl);
  if(video.error)return{error:video.error};if(virtualTour.error)return{error:virtualTour.error};
  const publicationPrice=Number(String(body.publicationPrice??'').replaceAll(',',''));
  if(!publicationTitle)return{error:'Advertising title is required'};
  if(!publicationDescription)return{error:'Advertising description is required'};
  if(portalCode==='property_finder'&&(publicationTitle.length<PROPERTY_FINDER_CONTENT_LIMITS.title.min||publicationTitle.length>PROPERTY_FINDER_CONTENT_LIMITS.title.max))
    return{error:`Property Finder advertising title must contain ${PROPERTY_FINDER_CONTENT_LIMITS.title.min} to ${PROPERTY_FINDER_CONTENT_LIMITS.title.max} characters; currently ${publicationTitle.length}`};
  if(portalCode==='property_finder'&&(publicationDescription.length<PROPERTY_FINDER_CONTENT_LIMITS.description.min||publicationDescription.length>PROPERTY_FINDER_CONTENT_LIMITS.description.max))
    return{error:`Property Finder advertising description must contain ${PROPERTY_FINDER_CONTENT_LIMITS.description.min} to ${PROPERTY_FINDER_CONTENT_LIMITS.description.max} characters; currently ${publicationDescription.length}`};
  if(portalCode==='property_finder'&&(!/^[\x20-\x7E\r\n\t]*$/.test(publicationTitle)||!/^[\x20-\x7E\r\n\t]*$/.test(publicationDescription)))
    return{error:'Property Finder English title and description must use supported ASCII text without emojis, symbols or HTML'};
  if(!['sale','rent'].includes(offeringType))return{error:'Select whether the portal posting is for Sale or Rent'};
  if(!['residential','commercial'].includes(propertyCategory))return{error:'Select Residential or Commercial as the portal category; Land and Farm are property types'};
  if(!['unfurnished','semi-furnished','furnished'].includes(furnishingType))return{error:'Select the Property Finder furnishing type'};
  if(!['dubai','abu_dhabi','northern_emirates'].includes(uaeEmirate))return{error:'Select the UAE emirate'};
  if(!Number.isFinite(publicationPrice)||publicationPrice<=0)return{error:'Portal asking price must be a positive amount'};
  if(!/^[A-Z]{3}$/.test(currency))return{error:'Currency must be a three-letter ISO code'};
  if(!portalLocationReference)return{error:'Portal-recognised location is required'};
  if(!portalPropertyReference)return{error:'Property reference from the regulatory permit is required'};
  if(!portalAgentReference)return{error:'Portal publishing-agent reference is required'};
  if(!propertyType)return{error:'Select a Property Finder-supported property type'};
  const downPayment=Number(String(body.downPayment??'').replaceAll(',',''));
  if(offeringType==='sale'&&(!Number.isFinite(downPayment)||downPayment<0))return{error:'Sale down-payment is required and cannot be negative'};
  const fields={publicationTitle,publicationDescription,offeringType,uaeEmirate,propertyCategory,furnishingType,bathrooms:bathrooms||null,
    publicationPrice,downPayment:offeringType==='sale'?downPayment:null,currency,
    portalLocationReference,portalPropertyReference,portalAgentReference,propertyType,offplanSaleType:text(body.offplanSaleType)||null,
    offplanDldWaiverPercent:text(body.offplanDldWaiverPercent)||null,offplanOriginalPrice:text(body.offplanOriginalPrice)||null,
    offplanAmountPaid:text(body.offplanAmountPaid)||null,complianceType:text(body.complianceType).toLowerCase()||null,
    videoUrl:video.value,virtualTourUrl:virtualTour.value,
    internalAuditPurpose:`Governed internal preparation for ${portalCode}; no portal transmission`};
  if(['dubai','abu_dhabi'].includes(uaeEmirate)&&!fields.complianceType)return{error:'Compliance type is required for Dubai and Abu Dhabi portal postings'};
  if(portalCode==='property_finder'&&uaeEmirate==='dubai'&&fields.complianceType!=='rera')return{error:'Property Finder Dubai listings require RERA as the API compliance type'};
  if(portalCode==='property_finder'&&uaeEmirate==='abu_dhabi'&&fields.complianceType!=='adrec')return{error:'Property Finder Abu Dhabi listings require ADREC as the API compliance type'};
  if(portalCode==='bayut'&&fields.offplanSaleType&&!['new','resale'].includes(fields.offplanSaleType.toLowerCase()))
    return{error:'Bayut off-plan sale type must be New or Resale'};
  return{portalCode,fields};
}

export function inventoryPortalSnapshot(listing={}){
  return Object.freeze({listingId:listing.id,inventoryReference:listing.inventoryReference,inventoryHeadline:listing.inventoryHeadline,
    project:listing.project,developer:listing.developer,area:listing.area,community:listing.community,propertyType:listing.propertyType,
    bedrooms:listing.bedrooms,sizeSqft:listing.sizeSqft,askingPrice:listing.price,currency:listing.currency,
    handoverStatus:listing.handoverStatus,status:listing.status,workflowStatus:listing.workflowStatus,
    verificationStatus:listing.verificationStatus,availabilityConfirmedAt:listing.availabilityConfirmedAt,
    sourceProvider:listing.sourceProvider,externalRecordId:listing.externalRecordId,
    permitNumber:listing.permitNumber,permitExpiresAt:listing.permitExpiresAt,sourceUpdatedAt:listing.updatedAt});
}

export function normalizePortalPermitEvidence(body={}){
  const portalCode=text(body.portalCode).toLowerCase().replace(/[ -]+/g,'_'),complianceType=text(body.complianceType).toLowerCase(),
    permitNumber=text(body.permitNumber),issuingCompanyLicenseNumber=text(body.issuingCompanyLicenseNumber),propertyReference=text(body.propertyReference),
    advertisingPurpose=text(body.advertisingPurpose).toLowerCase(),permittedPropertyType=mapPortalPropertyType(body.permittedPropertyType),
    permittedLocation=text(body.permittedLocation),advertisingCopy=text(body.advertisingCopy),currency=text(body.currency).toUpperCase();
  const rawPermittedPrice=text(body.permittedPrice),permittedPrice=rawPermittedPrice?Number(rawPermittedPrice.replaceAll(',','')):null,permitType=text(body.permitType).toLowerCase();
  if(!PORTAL_CODES.includes(portalCode))return{error:'Select Property Finder, Bayut or Dubizzle'};
  if(!['rera','adrec'].includes(complianceType))return{error:'Select the Property Finder compliance type: RERA for Dubai or ADREC for Abu Dhabi'};
  if(!permitNumber)return{error:'Permit number is required'};
  if(!['property','project'].includes(permitType))return{error:'Select whether the DLD permit is a Property or Project permit'};
  if(!issuingCompanyLicenseNumber)return{error:'Real Estate Company licence number is required'};
  if(!propertyReference)return{error:'Property number or regulatory property reference is required'};
  if(!['sale','rent'].includes(advertisingPurpose))return{error:'Permit advertising purpose must be Sale or Rent'};
  if(!permittedPropertyType)return{error:'Select the governed property type shown on the permit'};
  if(!permittedLocation)return{error:'Zone or location shown on the permit is required'};
  if(permittedPrice!==null&&(!Number.isFinite(permittedPrice)||permittedPrice<=0))return{error:'Regulatory advertised price must be a positive amount when stated'};
  if(!/^[A-Z]{3}$/.test(currency))return{error:'Permit currency must be a three-letter ISO code'};
  if(!advertisingCopy)return{error:'Advertisement copy or description shown on the permit is required'};
  let permitExpiresAt=null;if(text(body.permitExpiresAt)){permitExpiresAt=new Date(body.permitExpiresAt);if(Number.isNaN(permitExpiresAt.valueOf()))return{error:'Permit expiry must be a valid date/time'};permitExpiresAt=permitExpiresAt.toISOString();}
  return{portalCode,complianceType,permitType,permitNumber,issuingCompanyLicenseNumber,propertyReference,advertisingPurpose,permittedPropertyType,
    permittedLocation,permittedPrice,currency,advertisingCopy,permitExpiresAt};
}

export function portalPermitReconciliation({listing={},fields={},permitEvidence=null,now=new Date()}={}){
  const checks=[];const add=(code,label,passed,expected=null,actual=null)=>checks.push({code,label,passed:Boolean(passed),expected,actual});
  add('permit_evidence','An immutable permit file is uploaded',Boolean(permitEvidence?.fileHash));
  if(!permitEvidence)return{matched:false,checks};
  add('permit_expiry','The uploaded permit is not expired',!permitEvidence.permitExpiresAt||new Date(permitEvidence.permitExpiresAt)>now,null,permitEvidence.permitExpiresAt||null);
  add('permit_property_reference','Posting property reference matches the permit',comparable(fields.portalPropertyReference)===comparable(permitEvidence.propertyReference),fields.portalPropertyReference,permitEvidence.propertyReference);
  add('permit_purpose','Sale or rent matches the permit',comparable(fields.offeringType)===comparable(permitEvidence.advertisingPurpose),fields.offeringType,permitEvidence.advertisingPurpose);
  add('permit_property_type','Portal property type matches the permit',mapPortalPropertyType(fields.propertyType)===mapPortalPropertyType(permitEvidence.permittedPropertyType),fields.propertyType,permitEvidence.permittedPropertyType);
  const maintainedLocations=[listing.area,listing.community,listing.project].map(comparable).filter(Boolean),permitLocation=comparable(permitEvidence.permittedLocation);
  add('permit_location','Internal maintained location matches the permit zone/location',maintainedLocations.some(value=>value===permitLocation||value.includes(permitLocation)||permitLocation.includes(value)),maintainedLocations.join(' / '),permitEvidence.permittedLocation);
  add('permit_price','Portal asking price matches maintained regulatory evidence when a price is stated',permitEvidence.permittedPrice===null||permitEvidence.permittedPrice===undefined||Number(fields.publicationPrice)===Number(permitEvidence.permittedPrice),fields.publicationPrice,permitEvidence.permittedPrice);
  add('permit_currency','Portal currency matches the permit',text(fields.currency).toUpperCase()===text(permitEvidence.currency).toUpperCase(),fields.currency,permitEvidence.currency);
  add('permit_advertising_copy','Portal description matches the permit advertisement copy',comparable(fields.publicationDescription)===comparable(permitEvidence.advertisingCopy),fields.publicationDescription,permitEvidence.advertisingCopy);
  return{matched:checks.every(check=>check.passed),permitEvidenceId:permitEvidence.id,permitFileHash:permitEvidence.fileHash,checks};
}

export function portalReadiness({listing={},fields={},marketingAgreementCount=0,approvedMediaCount=0,permitEvidence=null,now=new Date()}={}){
  const checks=[];const add=(code,label,passed)=>checks.push({code,label,passed:Boolean(passed)});
  add('inventory_workflow','Internal Inventory is approved',listing.workflowStatus==='approved');
  add('inventory_verification','Inventory verification is current',['verified','not_required'].includes(listing.verificationStatus));
  const effectiveStatus=listing.effectiveStatus;
  if(!effectiveStatus)add('inventory_status','Canonical Inventory status available',false);
  add('inventory_available','Inventory remains marketable',!['Closed','Sold','Rented'].includes(effectiveStatus));
  add('marketing_authority','Active marketing-publication authority is recorded',Number(marketingAgreementCount)>0);
  add('approved_media','At least one approved, rights-cleared photograph is available',Number(approvedMediaCount)>=1);
  const permit=portalPermitReconciliation({listing,fields,permitEvidence,now});
  for(const check of permit.checks)add(check.code,check.label,check.passed);
  for(const [code,label,value] of [
    ['title','Advertising title is complete',fields.publicationTitle],['description','Advertising description is complete',fields.publicationDescription],
    ['offering_type','Sale or rent is selected',['sale','rent'].includes(fields.offeringType)],
    ['uae_emirate','UAE emirate is selected',['dubai','abu_dhabi','northern_emirates'].includes(fields.uaeEmirate)],
    ['furnishing_type','Furnishing type is selected',['unfurnished','semi-furnished','furnished'].includes(fields.furnishingType)],
    ['category','Portal property category is selected',fields.propertyCategory],['property_type','Portal property type is mapped from Internal Inventory',mapPortalPropertyType(fields.propertyType)===mapPortalPropertyType(listing.propertyType)],['price','Portal asking price is recorded',Number(fields.publicationPrice)>0],
    ['currency','Currency is recorded',/^[A-Z]{3}$/.test(text(fields.currency))],['location','Portal-recognised location is recorded',fields.portalLocationReference],
    ['agent','Portal publishing-agent reference is recorded',fields.portalAgentReference]
  ])add(code,label,Boolean(value));
  const propertyType=text(listing.propertyType).toLowerCase().replaceAll('_','-').replaceAll(' ','-');
  add('bathrooms','Bathrooms are recorded unless the property is Land or Farm',['land','farm'].includes(propertyType)||/^\d+$/.test(text(fields.bathrooms)));
  add('down_payment','Sale down-payment is recorded',fields.offeringType!=='sale'||Number(fields.downPayment)>=0);
  add('compliance_type','Compliance type is recorded for Dubai and Abu Dhabi',!['dubai','abu_dhabi'].includes(fields.uaeEmirate)||Boolean(fields.complianceType));
  return{ready:checks.every(check=>check.passed),checks,permitReconciliation:permit,checkedAt:now.toISOString(),noConnectorTransmission:true};
}

export function validatePortalMappingVersion(body={}){
  const portalCode=text(body.portalCode).toLowerCase().replace(/[ -]+/g,'_'),versionCode=text(body.versionCode),specificationReference=text(body.specificationReference);
  if(!PORTAL_CODES.includes(portalCode))return{error:'Select Property Finder, Bayut or Dubizzle'};
  if(!versionCode)return{error:'Mapping version code is required'};
  if(!specificationReference)return{error:'Specification reference is required'};
  return{portalCode,versionCode,specificationReference,notes:text(body.notes)||null};
}

export function validatePortalFieldMapping(body={}){
  const sourceField=text(body.sourceField),targetField=text(body.targetField),requirementLevel=text(body.requirementLevel).toLowerCase(),transformRule=text(body.transformRule);
  if(!PORTAL_FIELD_CATALOGUE.some(field=>field.fieldCode===sourceField))return{error:'Select a maintained CORE source field'};
  if(PORTAL_FIELD_CATALOGUE.find(field=>field.fieldCode===sourceField)?.transmissionPolicy==='internal_only')return{error:'Internal authority, owner identity and private evidence cannot be mapped to an external portal payload'};
  if(!targetField)return{error:'Connector target field or path is required'};
  if(/(^|\.)(owner(name)?|owner_contact|counterparty|agreement|authority|evidence)(\.|$)/i.test(targetField))return{error:'Owner identity, contact details, agreements, authority records and private evidence are prohibited external payload targets'};
  if(!['required','conditional','optional'].includes(requirementLevel))return{error:'Requirement level must be required, conditional or optional'};
  if(!transformRule)return{error:'Transformation rule is required; use direct when no conversion is needed'};
  return{sourceField,targetField,requirementLevel,transformRule,conditionExpression:text(body.conditionExpression)||null};
}
