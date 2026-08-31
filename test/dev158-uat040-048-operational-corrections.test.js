import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateInventoryEligibilityV2,inventoryEvaluatorProjection } from '../src/inventory-eligibility-domain.js';
import { CUSTOMER_ROLE_INPUT_TYPES } from '../src/crm-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-040 Developer Master models a corporate legal form without a personal owner or typed hash',()=>{
  const ui=read('public/app.js'),route=read('src/routes/partner-organizations.js'),migration=read('src/migrations/100_dev158_uat040_048_operational_corrections.sql');
  for(const marker of ['Listed company','Private company','Sole establishment / proprietorship','Partnership','Government entity','No personal owner is required','technical evidence digest automatically'])assert.match(ui,new RegExp(marker,'i'));
  assert.doesNotMatch(ui,/Source evidence SHA-256 \*/);
  assert.match(route,/isGovernanceAuthority/);assert.match(route,/verification_auto_activated/);assert.match(route,/evidenceDigest/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS legal_structure/);
});

test('UAT-057 removes Developer from every new Customer-role input while retaining corporate governance',()=>{
  const ui=read('public/app.js'),crm=read('src/routes/crm.js'),governance=read('src/routes/governance.js');
  assert.deepEqual(CUSTOMER_ROLE_INPUT_TYPES,['buyer','seller','landlord','tenant','investor','other']);
  assert.match(ui,/Corporate Developers are maintained in Companies → Governance, not as Customers/);
  assert.match(ui,/\#customer-role-form option\[value="developer"\].*remove/);
  assert.match(crm,/Developers must be maintained as governed Companies/);
  assert.match(governance,/allowed=\['buyer','seller','landlord','tenant','investor','other'\]/);
});

test('UAT-041 owner and internal-use authority are first, explicit and do not create a Customer',()=>{
  const ui=read('public/app.js'),route=read('src/routes/listings.js');
  assert.ok(ui.indexOf('2A · Owner / represented party')<ui.indexOf("verificationSection.querySelector('b').prepend('2B · ')"));
  for(const marker of ['How was this party identified?','Evidence permitting NYSA to maintain this Internal Inventory','Internal-use authority only; not marketing consent','does not create a Customer'])assert.match(ui,new RegExp(marker,'i'));
  const block=route.slice(route.indexOf("r.post('/listings/:id/counterparties'"),route.indexOf("r.post('/listings/:id/agreements'"));
  assert.doesNotMatch(block,/INSERT INTO contacts|INSERT INTO customers/);
});

test('UAT-042 market evidence and linked organization purpose are explained without operational mutation',()=>{
  const market=read('public/market-intelligence-ui.js'),ui=read('public/app.js');
  for(const marker of ['Comparable market evidence','not a valuation','never changes Inventory price, availability, verification or lifecycle status','Comparable-sales Community','Why does this Inventory belong to this Community?','Save Community mapping','Comparable evidence not ready'])assert.match(market,new RegExp(marker,'i'));
  for(const marker of ['Linked organizations and source history','never changes the owner/party, price, availability','Organizations are maintained in CRM'])assert.match(ui,new RegExp(marker,'i'));
});

test('UAT-043 Manager verification queue opens the exact Inventory before deciding',()=>{
  const ui=read('public/dashboard-ui.js'),route=read('src/routes/listings.js');
  assert.match(ui,/data-open-verification-inventory/);assert.match(ui,/Review Inventory/);assert.match(ui,/openVerificationInventoryFromTarget\(e\.target,id=>openDetail\(id,\{afterWorkflow:load\}\)\)/);
  assert.match(route,/SELECT vr\.\*,l\.inventory_reference/);
});

test('UAT-054 through UAT-056 return to the queue and remove verification-stage custody',()=>{
  const app=read('public/app.js'),dashboard=read('public/dashboard-ui.js'),routes=read('src/routes/listings.js'),opportunities=read('src/routes/opportunities.js');
  assert.match(app,/Checker action: review the property facts/);
  assert.match(app,/if\(afterWorkflow\)return afterWorkflow\(\);openDetail\(l\.id\)/);
  assert.match(dashboard,/openDetail\(open\.dataset\.openVerificationInventory,\{afterWorkflow:loadVerificationWorklist\}\)/);
  assert.match(dashboard,/id=>openDetail\(id,\{afterWorkflow:load\}\)/);
  assert.doesNotMatch(app,/Current custodian|Reassign responsible agent|inventory-agent-reassignment/);
  assert.match(routes,/Inventory has no transferable custodian/);
  assert.match(opportunities,/inventorySideAgentId=\['inventory','dual'\]\.includes\(input\.representationPath\)\?lead\.assignedTo:null/);
});

test('UAT-044 and UAT-045 keep hierarchy in My Team and render long ageing as weeks',()=>{
  const ui=read('public/dashboard-ui.js'),app=read('public/app.js');
  assert.match(ui,/dashboardViewsFor/);assert.match(ui,/showingMyTeam\?myTeamBody/);
  assert.match(app,/id="lx-my-team"/);assert.match(app,/renderCrmDashboard\(\{view:'My Team'\}\)/);
  assert.match(ui,/if\(days<7\)/);assert.match(ui,/return `\$\{weeks\} week/);
});

test('UAT-048 Listing Agent quick action records an explicit effective and expiry period',()=>{
  const ui=read('public/app.js'),route=read('src/routes/listings.js'),migration=read('src/migrations/100_dev158_uat040_048_operational_corrections.sql');
  assert.match(ui,/data-dashboard-availability/);assert.match(ui,/Confirmation valid until/);assert.match(ui,/CORE does not invent a seven-day expiry/);
  assert.match(route,/availability_expires_at=\$2/);assert.match(route,/Availability expiry must be in the future/);
  assert.match(migration,/availability_expires_at TIMESTAMPTZ/);assert.match(migration,/listings_availability_window_check/);
});

test('UAT-048 explicit expiry is part of the shared evaluator and fails closed after expiry',()=>{
  assert.match(inventoryEvaluatorProjection('l'),/l\.availability_expires_at/);
  const base={id:'inventory-1',inventoryReference:'NYSA-INV-1',workflowStatus:'approved',verificationStatus:'verified',effectiveStatus:'Available',transactionTypes:['Sale'],price:500000,sizeSqft:500,availabilityConfirmedAt:'2026-08-17T00:00:00Z'};
  const expired=evaluateInventoryEligibilityV2({listing:{...base,availabilityExpiresAt:'2026-08-18T00:00:00Z'},requirement:{businessLine:'Sale',budgetMax:600000},checkedAt:'2026-08-18T00:00:01Z'});
  assert.equal(expired.eligible,false);assert.equal(expired.reasons.some(reason=>reason.code==='availability_expired'),true);
  const current=evaluateInventoryEligibilityV2({listing:{...base,availabilityExpiresAt:'2026-08-19T00:00:00Z'},requirement:{businessLine:'Sale',budgetMax:600000},checkedAt:'2026-08-18T00:00:01Z'});
  assert.equal(current.eligible,true);
});
