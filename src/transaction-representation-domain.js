const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
export const REPRESENTATION_PATHS=['buyer','inventory','dual'];

export function validateCounterparty(body={}){
  const displayName=clean(body.displayName),partyType=body.partyType,role=body.role,source=clean(body.source),evidenceReference=clean(body.evidenceReference);
  const partyTypes=['existing_customer','existing_contact','company','inventory_owner','external_broker','external_agency','transaction_only'];
  const roles=['buyer','seller','landlord','tenant','buyer_agent','seller_agent','buyer_agency','seller_agency','referrer','other'];
  if(!displayName)return {error:'Counterparty name is required'};
  if(!partyTypes.includes(partyType))return {error:'Select a valid counterparty type'};
  if(!roles.includes(role))return {error:'Select a valid transaction role'};
  if(!source||!evidenceReference)return {error:'Counterparty source and evidence are required'};
  if(partyType==='existing_customer'&&!body.contactId)return {error:'Select the existing Customer'};
  return {value:{displayName,partyType,role,source,evidenceReference,contactId:body.contactId||null,companyId:body.companyId||null,phone:clean(body.phone),email:clean(body.email),representedParty:clean(body.representedParty)}};
}

export function validateExternalProperty(body={}){
  const projectOrBuilding=clean(body.projectOrBuilding),propertyAddress=clean(body.propertyAddress),source=clean(body.source),sourceEvidence=clean(body.sourceEvidence);
  if(!projectOrBuilding||!propertyAddress)return {error:'External property identity and address are required'};
  if(!source||!sourceEvidence)return {error:'External property source and evidence are required'};
  const askingPrice=body.askingPrice===undefined||body.askingPrice===null||body.askingPrice===''?null:Number(body.askingPrice);
  if(askingPrice!==null&&(!Number.isFinite(askingPrice)||askingPrice<0))return {error:'Asking price must be a non-negative amount'};
  return {value:{projectOrBuilding,propertyAddress,source,sourceEvidence,askingPrice,currency:clean(body.currency)||'AED',propertyType:clean(body.propertyType),permitReference:clean(body.permitReference),ownerCounterpartyId:body.ownerCounterpartyId||null,sellerAgentCounterpartyId:body.sellerAgentCounterpartyId||null,sellerAgencyCounterpartyId:body.sellerAgencyCounterpartyId||null}};
}

export function validateRepresentation(body={}){
  const representationPath=body.representationPath,propertySource=body.propertySource,buyerSource=body.buyerSource,authorityEvidence=clean(body.authorityEvidence),disclosureEvidence=clean(body.disclosureEvidence);
  if(!REPRESENTATION_PATHS.includes(representationPath))return {error:'Select how NYSA is participating in this Opportunity'};
  if(!['nysa_inventory','external_cobroker'].includes(propertySource))return {error:'Select NYSA Inventory or an external/co-broker property'};
  if(!['nysa_customer','external_buyer_agent'].includes(buyerSource))return {error:'Select a NYSA Customer Lead or external buyer agent'};
  if(representationPath==='buyer'&&!body.leadId)return {error:'Buyer Representation must start from a qualified Customer Lead'};
  if(representationPath==='inventory'&&!body.listingId)return {error:'Inventory Representation must start from approved NYSA Inventory'};
  if(representationPath==='dual'&&(!body.leadId||!body.listingId))return {error:'Dual-Sided NYSA requires both a Customer Lead and NYSA Inventory'};
  if(representationPath==='inventory'&&propertySource!=='nysa_inventory')return {error:'Inventory Representation must use approved NYSA Inventory'};
  if(representationPath==='dual'&&(propertySource!=='nysa_inventory'||buyerSource!=='nysa_customer'))return {error:'Dual-Sided NYSA must link both a NYSA Customer Lead and NYSA Inventory'};
  if(propertySource==='nysa_inventory'&&!body.listingId)return {error:'Select approved NYSA Inventory'};
  if(propertySource==='external_cobroker'&&!body.externalPropertyId)return {error:'Select a governed provisional external/co-broker property'};
  if(buyerSource==='nysa_customer'&&!body.leadId)return {error:'Select a qualified NYSA Customer Lead'};
  if(buyerSource==='external_buyer_agent'&&!body.buyerCounterpartyId)return {error:'Select the external buyer or buyer representative counterparty'};
  if(!body.buyerSideAgentId&&representationPath!=='inventory')return {error:'Select the NYSA buyer-side agent'};
  if(!body.inventorySideAgentId&&representationPath!=='buyer')return {error:'Select the NYSA Inventory-side agent'};
  if(!authorityEvidence)return {error:'Authority or mandate evidence is required'};
  if(representationPath==='dual'&&!disclosureEvidence)return {error:'Dual-Sided NYSA requires disclosure and conflict evidence'};
  return {value:{representationPath,propertySource,buyerSource,authorityEvidence,disclosureEvidence,leadId:body.leadId||null,listingId:body.listingId||null,externalPropertyId:body.externalPropertyId||null,buyerSideAgentId:body.buyerSideAgentId||null,inventorySideAgentId:body.inventorySideAgentId||null,buyerCounterpartyId:body.buyerCounterpartyId||null,sellerCounterpartyId:body.sellerCounterpartyId||null,buyerAgencyCounterpartyId:body.buyerAgencyCounterpartyId||null,sellerAgencyCounterpartyId:body.sellerAgencyCounterpartyId||null,buyerSideCommission:Number(body.buyerSideCommission)||null,sellerSideCommission:Number(body.sellerSideCommission)||null,interagencySplit:clean(body.interagencySplit),internalAgentSplit:clean(body.internalAgentSplit),referralFee:Number(body.referralFee)||null}};
}
