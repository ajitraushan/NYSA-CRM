import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A-BROKER-PRIORITY-46A renders customer-centred time bands and explainability',()=>{
  const ui=read('public/dashboard-ui.js'),route=read('src/routes/opportunities.js');
  for(const marker of ['Immediate attention','New enquiries','Due today','High-potential opportunities','Waiting and monitor','Why now','Open and act','priorityRulesVersion'])assert.match(ui,new RegExp(marker));
  assert.match(route,/sortCustomerPriorityCases/);assert.match(route,/priorityRulesVersion:'r3a-dev94-v1'/);assert.match(route,/current_status/);assert.match(route,/last_interaction_at/);
});

test('R3A-PROFILE-46 exposes Customer 360 needs, readiness and engagement',()=>{
  const ui=read('public/app.js'),route=read('src/routes/crm.js');
  for(const marker of ['CUSTOMER 360','What needs attention now','What the customer wants','Readiness and missing evidence','Suggested action · safe deterministic fallback','Open pursuit and act'])assert.match(ui,new RegExp(marker));
  assert.match(route,/buildCustomer360Profile/);assert.match(route,/requirement_purpose/);assert.match(route,/last_interaction_at/);assert.match(route,/pursuits:leads,profile/);
});
