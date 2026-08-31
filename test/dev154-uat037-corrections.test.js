import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBookingCreate} from '../src/booking-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const opportunities=read('src/routes/opportunities.js');
const crm=read('src/routes/crm.js');
const listings=read('src/routes/listings.js');
const offerUi=read('public/offer-ui.js');
const app=read('public/app.js');
const migration=read('src/migrations/099_dev153_inventory_assignment_lifecycle.sql');
const uat=read('docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md');

test('G-02 live Inventory revalidation binds only the listing parameter used by its SQL',()=>{
  assert.match(opportunities,/async function requireLiveInventory[\s\S]*?FOR UPDATE OF l`,\[listingId\],client\);/);
  assert.doesNotMatch(opportunities,/FOR UPDATE OF l`,\[listingId,opportunityId\|\|null\],client\);/);
});

test('G-02 and K-03 acceptance completes Negotiation before the separate atomic Booking transaction',()=>{
  assert.match(opportunities,/eventType==='accepted'/);
  assert.match(opportunities,/accepted:'accepted_at'/);
  assert.match(opportunities,/sets\.push\(`accepted_revision_id=\$\$\{params\.length\}`\)/);
  assert.match(opportunities,/INSERT INTO bookings[\s\S]*acceptedRevision\.id/);
  assert.match(opportunities,/FOR UPDATE OF l/);
  assert.match(opportunities,/Property is already reserved under/);
  assert.match(opportunities,/Accepted Offer Inventory cannot be detached/);
  assert.match(offerUi,/countered:\['accepted'/);
  assert.match(offerUi,/Customer acceptance is already recorded in Negotiation/);
  assert.match(offerUi,/Create seven-day reservation/);
});

test('G-06 initial reservation ignores client timestamps and is exactly seven days',()=>{
  const now=new Date('2030-01-01T08:00:00.000Z'),result=validateBookingCreate({
    refundableState:'refundable',reservationStartsAt:'2040-01-01',expiresAt:'2050-01-01',
    evidence:{fileName:'synthetic.pdf',mediaType:'application/pdf',base64:'JVBERi0='}
  },now);
  assert.equal(result.value.reservationStartsAt,now.toISOString());
  assert.equal(result.value.expiresAt,'2030-01-08T08:00:00.000Z');
  assert.match(offerUi,/Exactly 7 days from confirmation/);
});

test('F-04 expired assignment blocks Offer send and revision as well as reservation',()=>{
  assert.match(opportunities,/Reassign the Inventory before creating another revision/);
  assert.match(opportunities,/Reassign the Inventory before sending the Offer/);
  assert.match(opportunities,/exact Offer Inventory has no active unexpired assignment/i);
});

test('C-02 and P-05 administrative closure is responsible-Manager-only and never auto-ends assignments',()=>{
  assert.match(listings,/canAdministrativelyClose/);
  assert.match(listings,/broker\.jobRole==='manager'/);
  assert.match(listings,/End or expire every active Inventory assignment before administrative closure/);
  const statusRoute=listings.slice(listings.indexOf("r.patch('/listings/:id/status'"),listings.indexOf("r.delete('/listings/:id'"));
  assert.doesNotMatch(statusRoute,/UPDATE inventory_assignments SET state='closed'/);
});

test('J and M reassignment transfers servicing authority without changing Offer identity or authorship',()=>{
  assert.match(opportunities,/responsibleManager\(broker,opportunity\)\|\|opportunity\.ownerId===broker\.id/);
  assert.doesNotMatch(opportunities,/offer&&offer\.createdBy===broker\.id/);
  assert.match(crm,/UPDATE offers SET owner_id=\$1,updated_at=NOW\(\)/);
  assert.match(crm,/servicing_agent_reassigned/);
  assert.match(crm,/offerIdentityPreserved:true,offerAuthorshipPreserved:true/);
  const reassignment=crm.slice(crm.indexOf("r.post('/crm/leads/:id/coordinated-reassignment'"),crm.indexOf("r.post('/crm/leads/:id/activities'"));
  assert.doesNotMatch(reassignment,/UPDATE offers SET status='withdrawn'/);
  assert.doesNotMatch(reassignment,/accepted\. Complete, release or expire/);
});

test('B-04 legacy Under offer value is preserved as immutable migration evidence',()=>{
  assert.match(migration,/legacy_under_offer_migrated/);
  assert.match(migration,/preservedAsImmutableHistory/);
  assert.match(migration,/fromStatus','Under offer'/);
});

test('Q workspaces separate current and historical linkages and expose both servicing and origin actors',()=>{
  for(const marker of ['Active linkages','Historical linkages','Current servicing agent','Originally assigned by','Offer originally created by','Immutable linkage history'])assert.match(app,new RegExp(marker));
  assert.match(listings,/offer_created_by_name/);
  assert.match(listings,/inventory_assignment_events/);
  assert.match(opportunities,/offer_created_by_name/);
});

test('O-03 detached Deal state remains an auditable linkage row, not a null-pointer shortcut',()=>{
  assert.match(migration,/change_kind='detached'/);
  assert.match(migration,/current_inventory_linkage_id UUID REFERENCES deal_inventory_linkages/);
  assert.match(migration,/CREATE CONSTRAINT TRIGGER deals_current_inventory_linkage_consistency/);
});

test('approved dev.154 contract records the final authority and atomicity rulings',()=>{
  for(const marker of ['2.1.0-dev.154','acceptance and the\\s+exact seven-day reservation are one atomic transaction','authority continues','offers.created_by','former\\s+agent loses write authority','separate active from historical linkages'])assert.match(uat,new RegExp(marker));
});
