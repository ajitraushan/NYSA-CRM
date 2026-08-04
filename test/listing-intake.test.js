import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateListingIntakePayload } from '../src/listing-intake-domain.js';

const valid=()=>({eventId:'evt-2026-001',provider:'example_feed',externalRecordId:'EXT-77',mappingVersion:'2026.07',sourceKind:'integration',listing:{project:'Harbour Residence',areaCode:'dubai_marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:1250,price:'2.5m',currency:'AED',handoverStatus:'ready'}});

test('provider-neutral listing intake normalizes a governed draft payload',()=>{
  const result=validateListingIntakePayload(valid());
  assert.equal(result.error,undefined);assert.equal(result.value.provider,'example_feed');assert.equal(result.value.listing.price,2500000);assert.equal(result.value.listing.handoverDate,'Ready');
});

test('listing intake rejects missing stable identifiers and unmapped controlled values',()=>{
  for(const [change,code] of [
    [x=>x.eventId='', 'INVALID_EVENT_ID'],[x=>x.provider='Example Feed','INVALID_PROVIDER'],[x=>x.externalRecordId='','INVALID_EXTERNAL_RECORD_ID'],[x=>x.mappingVersion='','INVALID_MAPPING_VERSION'],
    [x=>x.listing.areaCode='Dubai Marina','UNMAPPED_AREA'],[x=>x.listing.propertyType='Condo','UNMAPPED_PROPERTY_TYPE'],[x=>x.listing.bedrooms='7','UNMAPPED_BEDROOMS']
  ]){const payload=valid();change(payload);assert.equal(validateListingIntakePayload(payload).code,code);}
});

test('listing intake requires complete property data and never treats bulk data as an ordinary listing',()=>{
  const badSize=valid();badSize.listing.sizeSqft=0;assert.equal(validateListingIntakePayload(badSize).code,'INVALID_SIZE');
  const bulk=valid();bulk.listing.propertyType='Bulk deal';assert.equal(validateListingIntakePayload(bulk).code,'UNMAPPED_BULK_DEAL');
  const plot=valid();plot.listing.propertyType='Plot';plot.listing.bedrooms=null;assert.equal(validateListingIntakePayload(plot).error,undefined);
});

test('listing intake route enforces authentication idempotency draft-only creation and controlled queues',()=>{
  const route=readFileSync(new URL('../src/routes/listing-intake.js',import.meta.url),'utf8'),migration=readFileSync(new URL('../src/migrations/036_provider_neutral_listing_intake.sql',import.meta.url),'utf8'),server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(route,/createHmac\('sha256'/);assert.match(route,/timingSafeEqual/);assert.match(route,/MAX_BODY_BYTES/);
  assert.match(route,/Event identifier was already used with different data/);assert.match(route,/idempotent:true/);assert.match(route,/duplicate_review/);
  assert.match(route,/pg_advisory_xact_lock/);assert.match(route,/ON CONFLICT\(provider_code,event_id\) DO NOTHING/);assert.match(route,/managedTeamIds/);
  assert.match(route,/portal_status,workflow_status,source_kind/);assert.match(route,/'blocked','draft'/);assert.doesNotMatch(route,/workflow_status[^\n]+approved/);
  assert.match(route,/Existing inventory requires review; no listing was created or overwritten/);assert.match(route,/Only failed or unmapped events can be corrected and replayed/);
  assert.match(migration,/UNIQUE INDEX listings_provider_external_record_uq/);assert.match(migration,/payload_hash CHAR\(64\)/);assert.match(server,/listingIntakeRoutes/);
  const listings=readFileSync(new URL('../src/routes/listings.js',import.meta.url),'utf8');
  assert.match(ui,/Integration \/ import intake/);assert.match(ui,/Review draft/);assert.match(ui,/Retry after correction/);assert.match(ui,/Intake attention/);assert.match(listings,/counts\.intakeAttention/);
});
