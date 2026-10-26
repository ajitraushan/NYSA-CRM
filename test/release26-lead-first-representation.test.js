import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('standalone Opportunity creation is retired in favor of qualified Lead conversion',()=>{
  const ui=read('public/app.js'),route=read('src/routes/transaction-representation.js');
  assert.doesNotMatch(ui,/id="opportunity-origin-create"/);
  assert.match(ui,/Every representation path starts from this assigned, qualified Lead/);
  assert.match(route,/Every Opportunity must be created by converting an assigned, qualified Lead/);
});

test('Inventory preserves originating and responsible agent identities',()=>{
  const migration=read('src/migrations/058_release26_lead_first_representation.sql'),route=read('src/routes/listings.js'),ui=read('public/app.js');
  assert.match(migration,/originating_agent_id UUID REFERENCES brokers/);
  assert.match(route,/b\.responsibleAgentId=b\.originatingAgentId/);
  assert.match(ui,/Originating NYSA Inventory agent/);
  assert.match(ui,/Immutable attribution/);
});

test('Lead conversion inherits Inventory seller and mandate but uses the assigned Sales Agent',()=>{
  const route=read('src/routes/opportunities.js');
  assert.match(route,/inventory_counterparties/);
  assert.match(route,/inventory_agreements/);
  assert.match(route,/inventorySideAgentId=\['inventory','dual'\]\.includes\(input\.representationPath\)\?lead\.assignedTo:null/);
  assert.doesNotMatch(route,/representationListing\.responsibleAgentId/);
  assert.match(route,/inventoryOriginatingAgentId:representationListing\?\.originatingAgentId/);
  assert.match(route,/the qualified Lead party must be the owner maintained on the selected Inventory/);
});

test('commission percentages and optional minimums are governed',()=>{
  const domain=read('src/opportunity-domain.js'),migration=read('src/migrations/058_release26_lead_first_representation.sql');
  assert.match(domain,/buyerCommissionPercent=percent\(body\.buyerCommissionPercent,'Buyer-side commission'\)/);
  assert.match(domain,/must be between 0% and 100%/);
  assert.match(domain,/split percentages must both be entered and total 100%/);
  assert.match(migration,/buyer_commission_minimum/);
  assert.match(migration,/seller_commission_percent/);
});

test('Warm Lead to Opportunity conversion is a visible KPI',()=>{
  const route=read('src/routes/dashboards.js'),ui=read('public/dashboard-ui.js');
  assert.match(route,/warm_converted/);
  assert.match(route,/warmConversionRate/);
  assert.match(ui,/Warm converted to Opportunity/);
  assert.match(ui,/Warm awaiting Opportunity/);
});
