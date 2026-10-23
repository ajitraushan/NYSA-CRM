import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeHandover} from '../src/inventory-domain.js';

const source=readFileSync(new URL('../src/routes/listings.js',import.meta.url),'utf8');
const validator=source.slice(source.indexOf('function validateListingFields('),source.indexOf("r.get('/inventory-location-options'"));
const validate=vm.runInNewContext(validator+';validateListingFields',{normalizeHandover,TRANSACTION_TYPES:['sale','rent'],VERIFICATION_STATUSES:['unverified','verified','not_required']});
const stored={contact:'Synthetic direct owner',currency:'AED',portalStatus:'not_ready',availabilityConfirmedAt:'2026-10-01T10:00:00Z',availabilityExpiresAt:'2026-11-01T10:00:00Z'};

test('DEF-126 property-source edit accepts stored system readiness',()=>{
 const submitted={contact:'Synthetic corrected property source'};
 assert.equal(validate({...stored,...submitted},{submittedBody:submitted}),null);
 assert.match(source,/validateListingFields\(\{\.\.\.listing,\.\.\.req\.body\},\{submittedBody:req\.body\}\)/);
});
test('DEF-126 explicit portal-readiness writes remain rejected for create and edit',()=>{
 for(const portalStatus of ['ready','not_ready',null]){
  const submitted={contact:'Synthetic corrected source',portalStatus};
  assert.match(validate({...stored,...submitted},{submittedBody:submitted}),/cannot be edited/);
  assert.match(validate(submitted),/cannot be edited/);
 }
});
test('DEF-126 merged validation retains availability date ordering',()=>{
 const submitted={availabilityExpiresAt:'2026-09-01T10:00:00Z'};
 assert.match(validate({...stored,...submitted},{submittedBody:submitted}),/later than/);
});
