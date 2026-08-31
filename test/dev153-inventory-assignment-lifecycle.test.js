import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../src/migrations/099_dev153_inventory_assignment_lifecycle.sql',import.meta.url),'utf8');
const opportunities=fs.readFileSync(new URL('../src/routes/opportunities.js',import.meta.url),'utf8');
const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
const listings=fs.readFileSync(new URL('../src/routes/listings.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const uat=fs.readFileSync(new URL('../docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md',import.meta.url),'utf8');

test('UAT-037 keeps discovery matches separate from formal assignments',()=>{
  assert.match(migration,/CREATE TABLE inventory_assignments/);
  assert.match(migration,/property_match_id UUID NOT NULL REFERENCES property_matches/);
  assert.match(migration,/predecessor_assignment_id UUID REFERENCES inventory_assignments/);
  assert.doesNotMatch(migration,/ALTER TABLE property_matches\s+ADD COLUMN IF NOT EXISTS assignment_/);
});

test('effective Inventory status is computed without an idle worker',()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION nysa_inventory_effective_status/);
  assert.match(migration,/status='reserved' AND expires_at>NOW\(\)/);
  assert.match(migration,/state='active' AND starts_at<=NOW\(\) AND expires_at>NOW\(\)/);
  assert.match(migration,/RETURN 'Assigned'/);
  assert.match(migration,/RETURN 'Available'/);
});

test('master status contract retires Under offer and separates terminal outcomes',()=>{
  for(const status of ['Available','Assigned','Reserved','Sold','Rented','Closed'])assert.match(migration,new RegExp(`'${status}'`));
  assert.match(migration,/WHERE status='Under offer'/);
  assert.match(listings,/system-controlled by Inventory assignments, Booking or Deal closure/);
  assert.match(opportunities,/inventoryOutcome=.*'Rented':'Sold'/);
});

test('assignment expiry defaults to seven days and Manager changes are audited',()=>{
  assert.match(migration,/expires_at TIMESTAMPTZ NOT NULL DEFAULT \(NOW\(\)\+INTERVAL '7 days'\)/);
  assert.match(migration,/CREATE TABLE inventory_assignment_expiry_changes/);
  assert.match(opportunities,/responsible team Manager may change assignment expiry/);
  assert.match(opportunities,/inventory_assignment_expiry_changes/);
  assert.match(opportunities,/event_type,reason,actor_id,event_data/);
});

test('reservation is exclusive while assignments remain shared',()=>{
  assert.match(opportunities,/Inventory already has an active assignment to the Opportunity/);
  assert.match(opportunities,/another current reservation or terminal closure blocks this Booking/);
  assert.match(opportunities,/reservation_won/);
  assert.match(opportunities,/reservation_released/);
  assert.match(opportunities,/nysa_inventory_effective_status/);
});

test('Opportunity creation formalizes every selected starting Inventory as a seven-day assignment',()=>{
  assert.match(opportunities,/Starting Inventory explicitly assigned when the Opportunity was created/);
  assert.match(opportunities,/source:'qualified_lead_conversion'/);
  assert.match(opportunities,/INSERT INTO inventory_assignments\(id,opportunity_id,listing_id,property_match_id,created_by\)/);
});

test('Deal current linkage is authoritative and cross-table mirrors use a deferred constraint trigger',()=>{
  assert.match(migration,/CREATE TABLE deal_inventory_linkages/);
  assert.match(migration,/ALTER TABLE deals ADD COLUMN current_inventory_linkage_id/);
  assert.match(migration,/CREATE CONSTRAINT TRIGGER deals_current_inventory_linkage_consistency/);
  assert.match(migration,/DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration,/must mirror the authoritative current linkage/);
});

test('historical terminal assignments close during migration and a detached retained Deal may close lost',()=>{
  assert.match(migration,/Historical terminal Deal formalized during dev\.153 migration/);
  assert.match(migration,/l\.status IN \('Sold','Rented','Closed'\)/);
  assert.match(opportunities,/current_link\.change_kind AS current_linkage_kind/);
  assert.match(opportunities,/!deal\.bookingId&&deal\.currentLinkageKind!=='detached'/);
  assert.match(opportunities,/WHERE opportunity_id=\$2 AND state='active' RETURNING id,listing_id/);
});

test('Offer and assignment predecessor lineage is explicit',()=>{
  assert.match(migration,/predecessor_assignment_id/);
  assert.match(migration,/predecessor_offer_id/);
  assert.match(opportunities,/predecessor_offer_id/);
});

test('Manager delink withdraws a mutable Offer atomically but blocks Reserved Inventory',()=>{
  assert.match(opportunities,/inventory-assignments\/:assignmentId\/delink/);
  assert.match(opportunities,/Reserved Inventory cannot be detached/);
  assert.match(opportunities,/Offer withdrawn atomically because its Inventory assignment was delinked/);
  assert.match(opportunities,/state='delinked'/);
});

test('Opportunity reassignment changes servicing ownership without rewriting the external Offer',()=>{
  assert.match(crm,/UPDATE offers SET owner_id=\$1,updated_at=NOW\(\)/);
  assert.match(crm,/servicing_agent_reassigned/);
  assert.match(crm,/offerIdentityPreserved:true,offerAuthorshipPreserved:true/);
  assert.doesNotMatch(crm,/Offer withdrawn because Opportunity responsibility changed/);
  assert.match(crm,/opportunity_assignment_history/);
});

test('both Opportunity and Inventory workspaces expose formal assignment lifecycle',()=>{
  assert.match(ui,/inventoryAssignments=\[\]/);
  assert.match(ui,/Assign Inventory for 7 days/);
  assert.match(ui,/Inventory lifecycle linkages/);
  assert.match(ui,/blocked_by_reservation/);
  assert.match(ui,/data-assignment-delink/);
});

test('UAT record contains the approved separate-assignment contract',()=>{
  assert.match(uat,/UAT-037/);
  assert.match(uat,/Inventory approval\/verification is independent/);
  assert.match(uat,/Opportunity ID and Deal ID remain stable/);
});
