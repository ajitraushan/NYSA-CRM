import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeInventoryAmount,normalizeHandover,normalizeBulkUnits,fundingPaymentCompatibility,derivePublicationReadiness } from '../src/inventory-domain.js';

test('inventory amounts accept business shorthand consistently',()=>{
  for(const [input,expected] of [['1m',1000000],['1M',1000000],['1.5 m',1500000],['750k',750000],['1,000,000',1000000],['1000000',1000000]])assert.equal(normalizeInventoryAmount(input,{required:true}).value,expected);
  assert.match(normalizeInventoryAmount('-1',{required:true}).error,/positive amount/);
});

test('handover uses a governed status and an unambiguous date',()=>{
  assert.deepEqual(normalizeHandover({handoverStatus:'ready'}),{status:'ready',expectedDate:null,legacyValue:'Ready'});
  assert.deepEqual(normalizeHandover({handoverStatus:'expected',handoverExpectedDate:'2027-06-01'}),{status:'expected',expectedDate:'2027-06-01',legacyValue:'2027-06-01'});
  assert.match(normalizeHandover({handoverStatus:'expected'}).error,/requires a valid date/);
});

test('funding and inventory payment plan compatibility is explicit',()=>{
  assert.equal(fundingPaymentCompatibility('mortgage','Mortgage').compatible,true);
  assert.equal(fundingPaymentCompatibility('mortgage','Developer plan').compatible,false);
  assert.equal(fundingPaymentCompatibility('unknown','Developer plan').code,'not_assessed');
});

test('bulk deals require a complete property-level schedule',()=>{
  assert.match(normalizeBulkUnits('Bulk deal',[{unitReference:'A-101',propertyType:'Apartment',bedrooms:'2',sizeSqft:900,price:'1 M'}]).error,/at least two/);
  const valid=normalizeBulkUnits('Bulk deal',[
    {unitReference:'A-101',propertyType:'Apartment',bedrooms:'2',sizeSqft:900,price:'1 M'},
    {unitReference:'Plot 4',propertyType:'Plot',bedrooms:'',sizeSqft:4200,price:'2.5m'}
  ]);
  assert.equal(valid.error,undefined);assert.deepEqual(valid.units.map(x=>x.price),[1000000,2500000]);assert.equal(valid.units[1].bedrooms,null);
  assert.match(normalizeBulkUnits('Bulk deal',[
    {unitReference:'A',propertyType:'Apartment',bedrooms:'2',sizeSqft:900,price:1000000},
    {unitReference:'a',propertyType:'Villa',bedrooms:'4',sizeSqft:3000,price:4000000}
  ]).error,/unique/);
  assert.match(normalizeBulkUnits('Bulk deal',[
    {unitReference:'Plot 1',propertyType:'Plot',bedrooms:'2',sizeSqft:3000,price:2000000},
    {unitReference:'Plot 2',propertyType:'Plot',bedrooms:'',sizeSqft:3200,price:2100000}
  ]).error,/bedrooms do not apply to Plot/);
});

test('publication readiness is derived from recorded evidence',()=>{
  const listing={project:'Home',area:'Dubai Marina',propertyType:'Apartment',price:1500000,currency:'AED',sizeSqft:900,status:'Available',availabilityConfirmedAt:'2026-07-18T08:00:00Z',verificationStatus:'verified'};
  assert.equal(derivePublicationReadiness(listing,1,new Date('2026-07-19T08:00:00Z')).status,'ready');
  const blocked=derivePublicationReadiness({...listing,sizeSqft:null},0,new Date('2026-07-19T08:00:00Z'));
  assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.blockers.map(x=>x.code),['sizeSqft','approved_media']);
  assert.equal(derivePublicationReadiness({...listing,propertyType:'Bulk deal',sizeSqft:null,bulkUnitCount:2,incompleteBulkUnitCount:0},1,new Date('2026-07-19T08:00:00Z')).status,'ready');
  assert.deepEqual(derivePublicationReadiness({...listing,propertyType:'Bulk deal',sizeSqft:null,bulkUnitCount:1,incompleteBulkUnitCount:0},1,new Date('2026-07-19T08:00:00Z')).blockers.map(x=>x.code),['bulk_units']);
});

test('inventory browser and API enforce the governed commercial workflow',()=>{
  const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),routes=readFileSync(new URL('../src/routes/listings.js',import.meta.url),'utf8'),media=readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');
  assert.match(ui,/name="price" data-business-amount/);assert.match(ui,/name="referencePrice" data-business-amount/);
  assert.match(ui,/Handover status/);assert.match(ui,/Expected handover date/);assert.match(ui,/Listing publication readiness/);
  assert.match(ui,/Select from Area Maintenance/);assert.match(ui,/name="community"/);assert.match(ui,/Bulk deal property schedule/);
  assert.doesNotMatch(ui,/name="portalStatus"/);assert.match(ui,/Buyer funding is maintained separately/);
  assert.match(routes,/normalizeInventoryAmount/);assert.match(routes,/normalizeBulkUnits/);assert.match(routes,/replaceBulkUnits/);assert.match(routes,/Portal readiness is calculated by the system/);
  assert.match(media,/refreshListingReadiness/);
});
