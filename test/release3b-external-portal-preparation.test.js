import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTAL_FIELD_CATALOGUE,PROPERTY_FINDER_CONTENT_LIMITS,PROPERTY_FINDER_PROPERTY_TYPES,inventoryPortalSnapshot,mapPortalPropertyType,
  normalizePortalPreparation,portalPayloadHash,portalReadiness,normalizePortalPermitEvidence,portalPermitReconciliation,
  validatePortalFieldMapping,validatePortalMappingVersion } from '../src/portal-publication-domain.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const validDescription=('Approved property description with accurate amenities, location and transaction facts. ').repeat(11).slice(0,800);
const valid=()=>({portalCode:'property_finder',offeringType:'sale',uaeEmirate:'dubai',furnishingType:'furnished',downPayment:'500,000',complianceType:'rera',propertyType:'apartment',
  publicationTitle:'Sea-facing two-bedroom apartment',publicationDescription:validDescription,
  propertyCategory:'residential',bathrooms:'2',publicationPrice:'2,500,000',currency:'aed',portalLocationReference:'are.1.50',
  portalPropertyReference:'1215',portalAgentReference:'PF-AGENT-17'});
const permit=()=>({id:'permit-1',portalCode:'property_finder',complianceType:'rera',permitType:'property',permitNumber:'6511157694',issuingCompanyLicenseNumber:'CN-100',
  propertyReference:'1215',advertisingPurpose:'sale',permittedPropertyType:'Apartment',permittedLocation:'Marina',permittedPrice:2500000,currency:'AED',
  advertisingCopy:validDescription,fileHash:'a'.repeat(64),permitExpiresAt:'2027-08-04T00:00:00.000Z'});

test('portal preparation captures only common mandatory advertising and portal identity fields',()=>{
  const normalized=normalizePortalPreparation(valid());
  assert.equal(normalized.error,undefined);assert.equal(normalized.portalCode,'property_finder');
  assert.equal(normalized.fields.publicationPrice,2500000);assert.equal(normalized.fields.currency,'AED');
  for(const key of ['publicationTitle','publicationDescription','offeringType','uaeEmirate','furnishingType','propertyCategory','propertyType','portalLocationReference','portalPropertyReference','portalAgentReference']){
    const value=valid();delete value[key];assert.ok(normalizePortalPreparation(value).error,key);
  }
  assert.match(normalizePortalPreparation({...valid(),portalCode:'other'}).error,/Property Finder/);
  assert.match(normalizePortalPreparation({...valid(),portalCode:'bayut',offplanSaleType:'unknown'}).error,/New or Resale/);
});

test('Property Finder preparation exposes governed property types and exact current content guidance',()=>{
  for(const type of ['apartment','villa','townhouse'])assert.ok(PROPERTY_FINDER_PROPERTY_TYPES.includes(type));
  assert.equal(mapPortalPropertyType('Town House'),'townhouse');assert.equal(mapPortalPropertyType('Plot'),'land');
  assert.deepEqual(PROPERTY_FINDER_CONTENT_LIMITS,{title:{min:30,max:50},description:{min:750,max:2000}});
  assert.match(normalizePortalPreparation({...valid(),publicationTitle:'Too short'}).error,/30 to 50/);
  assert.match(normalizePortalPreparation({...valid(),publicationDescription:'Too short'}).error,/750 to 2000/);
  assert.match(normalizePortalPreparation({...valid(),publicationDescription:validDescription+' 🚨'}).error,/ASCII/);
});

test('portal preparation freezes deterministic Inventory evidence and readiness without connector transmission',()=>{
  const listing={id:'listing-1',inventoryReference:'NYSA-INV-000040',inventoryHeadline:'Sea Facing',project:'Meera',area:'Marina',community:'Meera',
    propertyType:'Apartment',bedrooms:'2',sizeSqft:1600,price:2500000,currency:'AED',handoverStatus:'ready',status:'Available',effectiveStatus:'Available',workflowStatus:'approved',
    verificationStatus:'verified',permitNumber:'MADH-100',updatedAt:'2026-08-04T00:00:00.000Z'},fields=normalizePortalPreparation(valid()).fields,
    snapshot=inventoryPortalSnapshot(listing),a=portalPayloadHash({portalCode:'property_finder',inventory:snapshot,fields}),
    b=portalPayloadHash({fields,inventory:snapshot,portalCode:'property_finder'}),readiness=portalReadiness({listing,fields,marketingAgreementCount:1,approvedMediaCount:5,permitEvidence:permit(),now:new Date('2026-08-04T00:00:00Z')});
  assert.equal(a,b);assert.match(a,/^[a-f0-9]{64}$/);assert.equal(readiness.ready,true);assert.equal(readiness.noConnectorTransmission,true);
  assert.equal(portalReadiness({listing,fields,marketingAgreementCount:0,approvedMediaCount:0}).ready,false);
});

test('uploaded permit facts must reconcile to the same Inventory and exact portal preparation',()=>{
  const normalized=normalizePortalPermitEvidence({...permit(),permittedPrice:'2,500,000'});assert.equal(normalized.error,undefined);
  const listing={propertyType:'Apartment',area:'Marina',community:'Meera',project:'Meera'},fields=normalizePortalPreparation(valid()).fields;
  assert.equal(portalPermitReconciliation({listing,fields,permitEvidence:permit(),now:new Date('2026-08-04T00:00:00Z')}).matched,true);
  for(const [key,value] of [['propertyReference','999'],['advertisingPurpose','rent'],['permittedPropertyType','Villa'],['permittedLocation','Nadd Hessa'],['permittedPrice',2600000],['advertisingCopy','Different advertisement']]){
    const result=portalPermitReconciliation({listing,fields,permitEvidence:{...permit(),[key]:value},now:new Date('2026-08-04T00:00:00Z')});assert.equal(result.matched,false,key);
  }
  assert.equal(portalReadiness({listing:{...listing,status:'Available',effectiveStatus:'Available',workflowStatus:'approved',verificationStatus:'verified'},fields,marketingAgreementCount:1,approvedMediaCount:1,permitEvidence:null}).ready,false);
});

test('connector mapping is versioned and validates exact source-to-target ETL entries',()=>{
  assert.equal(validatePortalMappingVersion({portalCode:'bayut',versionCode:'xml-2026.08',specificationReference:'Bayut partner document 2026-08'}).error,undefined);
  assert.equal(validatePortalFieldMapping({sourceField:'price',targetField:'price',requirementLevel:'required',transformRule:'direct'}).error,undefined);
  assert.match(validatePortalFieldMapping({sourceField:'marketing_authority',targetField:'owner.authority',requirementLevel:'required',transformRule:'direct'}).error,/cannot be mapped/);
  assert.match(validatePortalFieldMapping({sourceField:'inventory_reference',targetField:'ownerName',requirementLevel:'optional',transformRule:'direct'}).error,/prohibited external payload targets/);
  assert.ok(validatePortalFieldMapping({sourceField:'unknown',targetField:'x',requirementLevel:'required',transformRule:'direct'}).error);
  for(const required of ['title','description','images','portal_agent_reference','permit_number','marketing_authority','uae_emirate','furnishing_type','down_payment','compliance_type'])assert.ok(PORTAL_FIELD_CATALOGUE.some(field=>field.fieldCode===required));
});

test('portal routes use the same preparation boundary, fix the SMALLINT authority query and never call a connector',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),activeUi=ui.slice(ui.indexOf('async function renderExternalPortalListings')),
    migration=read('src/migrations/080_release3b_external_portal_preparation.sql'),permitMigration=read('src/migrations/081_release3b_portal_permit_reconciliation.sql');
  assert.match(route,/a\.marketing_authorized=1/);assert.doesNotMatch(route,/marketing_authorized=TRUE/);
  for(const marker of ['normalizePortalPreparation','external_listing_preparation_versions','portalPayloadHash','portalReadiness','noConnectorTransmission:true','external-publication-mappings'])assert.match(route,new RegExp(marker));
  for(const marker of ['Start here, select approved Internal Inventory','Property reference shown on permit','Real Estate Company licence number','Upload permit evidence','Select Inventory once','PF public-profile reference','UAE emirate','Furnishing type','Sale down-payment','compliance type','Apartment, Villa and Townhouse','Property Finder: 30–50','Property Finder: 750–2,000','Internal audit record is automatic','Owner identity, contact details, agreements and private evidence remain internal-only','Save internal permit evidence and reconcile','Connector ETL mapping register','Revise preparation','New immutable preparation revision saved','nothing was transmitted'])assert.match(activeUi,new RegExp(marker,'i'));
  assert.doesNotMatch(activeUi,/id="external-agreement-create"/);assert.doesNotMatch(activeUi,/name="counterpartyId" required disabled/);
  for(const marker of ['external_portal_mapping_versions','external_portal_field_mappings','external_listing_preparation_versions','payload_hash','prevent_release2_immutable_evidence_mutation'])assert.match(migration,new RegExp(marker));
  for(const marker of ['external_portal_permit_evidence_versions','issuing_company_license_number','property_reference','advertising_copy','storage_key','file_hash','prevent_release2_immutable_evidence_mutation'])assert.match(permitMigration,new RegExp(marker));
  for(const marker of ['external-permit-evidence','decodeAndValidateFile','permitEvidence'])assert.match(route,new RegExp(marker));
  assert.doesNotMatch(route,/res\.json\(\{inventories,publications,inventoryParties/);
  assert.doesNotMatch(route,/fetch\(['"]https?:\/\//);assert.doesNotMatch(route,/axios|propertyfinder\.ae|bayut\.com/);
});
