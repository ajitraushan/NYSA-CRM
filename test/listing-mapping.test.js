import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyListingMappings, validateMappingEntry, validateMappingTransition, validateMappingVersion } from '../src/listing-mapping-domain.js';

test('provider listing mappings translate external business values without guessing',()=>{
  const source={listing:{areaCode:'Dubai Marina',propertyType:'Condo',bedrooms:'Two Bed'}};
  const result=applyListingMappings(source,[
    {fieldCode:'areaCode',externalValue:'dubai marina',coreValue:'dubai_marina'},
    {fieldCode:'propertyType',externalValue:'Condo',coreValue:'Apartment'}
  ]);
  assert.equal(result.payload.listing.areaCode,'dubai_marina');assert.equal(result.payload.listing.propertyType,'Apartment');assert.equal(result.payload.listing.bedrooms,'Two Bed');assert.equal(result.applied.length,2);
});

test('mapping version and entries require stable provider codes and governed values',()=>{
  assert.equal(validateMappingVersion({providerCode:'crm_test_feed',versionCode:'2026.08',name:'Test mappings'}).error,undefined);
  assert.match(validateMappingVersion({providerCode:'CRM Feed',versionCode:'1',name:'x'}).error,/lowercase snake_case/);
  assert.equal(validateMappingEntry({fieldCode:'propertyType',externalValue:'Condo',coreValue:'Apartment'},['Apartment']).error,undefined);
  assert.match(validateMappingEntry({fieldCode:'propertyType',externalValue:'Condo',coreValue:'Unknown'},['Apartment']).error,/not currently governed/);
  assert.match(validateMappingEntry({fieldCode:'areaCode',externalValue:'Marina',coreValue:'dubai_marina'},[]).error,/not currently governed/);
});

test('mapping lifecycle is sequential and requires reason and evidence',()=>{
  assert.equal(validateMappingTransition('draft','test',{reason:'Sample event passed',evidence:'evt-1'}).value.nextStatus,'tested');
  assert.equal(validateMappingTransition('tested','approve',{reason:'Reviewed',evidence:'CAB-1'}).value.nextStatus,'approved');
  assert.equal(validateMappingTransition('approved','activate',{reason:'Effective now',evidence:'Approval CAB-1'}).value.nextStatus,'active');
  assert.match(validateMappingTransition('draft','activate',{reason:'Skip',evidence:'x'}).error,/cannot be activated/);
  assert.match(validateMappingTransition('draft','test',{reason:'Tested'}).error,/evidence/);
});

test('admin mapping API and UI govern versions while intake applies only active exact mappings',()=>{
  const route=readFileSync(new URL('../src/routes/listing-mappings.js',import.meta.url),'utf8'),intake=readFileSync(new URL('../src/routes/listing-intake.js',import.meta.url),'utf8'),migration=readFileSync(new URL('../src/migrations/037_listing_mapping_governance.sql',import.meta.url),'utf8'),ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(route,/Full Administrator access is required/);assert.match(route,/Only Draft mapping versions can be edited/);assert.match(route,/provider_code=\$3 AND status='active'/);
  assert.match(route,/pg_advisory_xact_lock/);assert.match(route,/status='retired'/);assert.match(route,/Add at least one mapping before testing/);
  assert.match(intake,/status='active'/);assert.match(intake,/UNMAPPED_MAPPING_VERSION/);assert.match(intake,/currentActive:true/);assert.match(intake,/applyListingMappings/);assert.match(intake,/source_mapping_version_id/);assert.match(intake,/received_mapping_version/);assert.match(intake,/received_payload_hash/);assert.match(intake,/mapping_version_id/);
  assert.match(migration,/listing_mapping_one_active_provider_uq/);assert.match(migration,/LOWER\(external_value\)/);assert.match(migration,/ListingMappingVersion/);
  assert.match(ui,/Provider listing mappings/);assert.match(ui,/Draft → Tested → Approved → Active/);assert.match(ui,/Unknown values remain in the intake attention queue and are never guessed/);
});
