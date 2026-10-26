import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateInventoryEligibilityV2 } from '../src/inventory-eligibility-domain.js';
import { validatePropertyMatch } from '../src/matching-viewing-domain.js';

const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const opportunities=fs.readFileSync(new URL('../src/routes/opportunities.js',import.meta.url),'utf8');

const listing=overrides=>({
  id:'inventory-1',inventoryReference:'NYSA-INV-000045',workflowStatus:'approved',
  verificationStatus:'not_required',status:'Available',effectiveStatus:'Available',transactionTypes:['Sale'],
  price:800000,availabilityConfirmedAt:null,...overrides
});
const requirement={businessLine:'Sale',budgetMin:700000,budgetMax:800000};

test('UAT assignment recovery distinguishes Available from ready to assign and opens exact reasons',()=>{
  assert.match(ui,/“Available” alone does not mean “ready to assign”/);
  assert.match(ui,/Why Inventory is not ready to assign/);
  assert.match(ui,/data-correct-ineligible-inventory/);
  assert.match(ui,/Correct Inventory and return/);
});

test('UAT assignment recovery returns to the same Opportunity after correcting true eligibility blockers',()=>{
  assert.match(ui,/openListingForm\(listing,\{focusField:field,afterSave:\(\)=>openOpportunityDetail\(id\)\}\)/);
  assert.match(ui,/async function openListingForm\(l = null,\{focusField=null,afterSave=null\}=\{\}\)/);
  assert.match(ui,/if\(afterSave\)return afterSave\(saved\.id\|\|l\.id\)/);
});

test('Inventory at the exact maximum budget remains eligible without a dated availability record',()=>{
  const missing=evaluateInventoryEligibilityV2({listing:listing(),requirement,checkedAt:'2026-08-17T08:00:00.000Z'});
  assert.equal(missing.state,'eligible');
  assert.deepEqual(missing.reasons,[]);
  assert.ok(missing.advisories.some(reason=>reason.code==='availability_confirmation'));
  const confirmed=evaluateInventoryEligibilityV2({listing:listing({availabilityConfirmedAt:'2026-08-17T07:00:00.000Z'}),requirement,checkedAt:'2026-08-17T08:00:00.000Z'});
  assert.equal(confirmed.state,'eligible');
  assert.equal(confirmed.eligible,true);
});

test('old availability history remains advisory while assignment requires explicit broker confirmation',()=>{
  const stale=evaluateInventoryEligibilityV2({listing:listing({availabilityConfirmedAt:'2026-08-01T07:00:00.000Z'}),requirement,checkedAt:'2026-08-17T08:00:00.000Z'});
  assert.equal(stale.state,'eligible');
  assert.ok(stale.advisories.some(reason=>reason.code==='availability_confirmation'));
  assert.match(ui,/The previous availability date is advisory and never removes Inventory from this list/);
  assert.match(ui,/I confirm this Inventory is likely to be available/);
});

test('UAT-038 matching includes Inventory with blank or old availability history',()=>{
  const boundaryStart=opportunities.indexOf('function liveInventoryEligibility');
  const boundaryEnd=opportunities.indexOf('async function requireOpportunityInventory',boundaryStart);
  const listStart=opportunities.indexOf("r.get('/crm/opportunities/:id/matching-inventory'");
  const listEnd=opportunities.indexOf("r.post('/crm/opportunities/:id/matches'",listStart);
  const boundary=opportunities.slice(boundaryStart,boundaryEnd),matchingList=opportunities.slice(listStart,listEnd);
  assert.ok(boundaryStart>0&&boundaryEnd>boundaryStart&&listStart>0&&listEnd>listStart);
  assert.doesNotMatch(boundary,/availability_confirmed_at|INTERVAL\s+'7 days'/i);
  assert.match(matchingList,/liveInventoryEligibility\('li','\$1'\)/);
  assert.equal(evaluateInventoryEligibilityV2({listing:listing(),requirement}).eligible,true);
  assert.equal(evaluateInventoryEligibilityV2({listing:listing({availabilityConfirmedAt:'2026-01-01T00:00:00.000Z'}),requirement}).eligible,true);
});

test('UAT-038 assignment requires broker acknowledgement and records immutable evidence',()=>{
  const missing=validatePropertyMatch({listingId:'inventory-1',fitStatus:'strong_fit',rationale:'Exact requirement match'});
  assert.equal(missing.error,'Confirm that this Inventory is likely to be available before assigning it');
  const confirmed=validatePropertyMatch({listingId:'inventory-1',fitStatus:'strong_fit',rationale:'Exact requirement match',availabilityLikelyConfirmed:true});
  assert.equal(confirmed.value.availabilityLikelyConfirmed,true);
  assert.match(ui,/type="checkbox" name="availabilityLikelyConfirmed" required/);
  assert.match(opportunities,/event_data[\s\S]*?availabilityLikelyConfirmed:v\.availabilityLikelyConfirmed,priorAvailabilityConfirmedAt:listing\.availabilityConfirmedAt\|\|null/);
});

test('UAT-038 viewing revalidation does not impose an availability-age gate',()=>{
  const start=opportunities.indexOf("r.post('/crm/opportunities/:id/viewings'");
  const end=opportunities.indexOf("r.patch('/crm/opportunities/:id/viewings/",start);
  const route=opportunities.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(route,/requireLiveInventory\(match\.listingId,opportunity\.id,client\)/);
  assert.doesNotMatch(route,/availability_confirmed_at|seven-day availability|current availability confirmation/i);
});

test('UAT-038 Offer revalidation does not impose an availability-age gate',()=>{
  const start=opportunities.indexOf("r.post('/crm/opportunities/:id/offers'");
  const end=opportunities.indexOf("r.post('/crm/offers/:offerId/revisions'",start);
  const route=opportunities.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(route,/requireLiveInventory\(match\.listingId,opportunity\.id,client\)/);
  assert.doesNotMatch(route,/availability_confirmed_at|seven-day availability|current availability confirmation/i);
});

test('UAT-038 reservation revalidation does not impose an availability-age gate',()=>{
  const start=opportunities.indexOf("r.post('/crm/offers/:offerId/bookings'");
  const end=opportunities.indexOf("r.post('/crm/bookings/:bookingId/",start);
  const route=opportunities.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(route,/requireLiveInventory\(offer\.listingId,offer\.opportunityId,client\)/);
  assert.doesNotMatch(route,/availability_confirmed_at|seven-day availability|current availability confirmation/i);
  assert.match(route,/FOR UPDATE OF b/);
});

test('Inventory detail presents simple operational readiness and separates expiry concepts',()=>{
  assert.match(ui,/Ready to select in an Opportunity/);
  assert.match(ui,/Not ready for Opportunity assignment/);
  assert.match(ui,/Inventory status<\/b>\$\{esc\(effectiveInventoryStatus\)\} · no automatic expiry/);
  assert.match(ui,/Assignment expiry/);
  assert.match(ui,/Not applicable until linked to an Opportunity/);
  assert.match(ui,/Reservation expiry/);
  assert.match(ui,/Optional advisory: Market intelligence/);
});
