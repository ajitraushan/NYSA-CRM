import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Inventory draft is progressive and does not create owner or portal agreement records',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),migration=read('src/migrations/078_release3b_inventory_progressive_governance.sql');
  assert.match(route,/noOwnerCreated:true,noAgreementCreated:true/);assert.match(ui,/Who or what supplied this property to NYSA\?/);assert.match(ui,/Enter the owner only when the owner contacted NYSA directly/);assert.doesNotMatch(ui,/Owner \/ represented party name \(new Customer only\)/);assert.match(ui,/Owner and authority are completed after the Draft is saved/);assert.match(migration,/inventory_agent_assignment_history/);
});

test('Opportunity seller-side inheritance remains linked to Inventory counterparty',()=>{
  const route=read('src/routes/transaction-representation.js');assert.match(route,/inventory_counterparties/);assert.match(route,/v\.sellerCounterpartyId=inherited\.id/);
});

test('legacy Inventory attribution remains immutable without an active custodian control',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js');assert.match(route,/r\.get\('\/inventory-agents'/);assert.match(route,/inventoryAgentEligibilitySql/);assert.match(route,/inventoryAgentScopeSql/);assert.match(route,/inventory_agent_assignment_history/);assert.match(route,/Inventory has no transferable custodian/);assert.match(ui,/api\('\/inventory-agents'\)/);assert.match(ui,/Historical Inventory attribution evidence/);assert.doesNotMatch(ui,/Reassign responsible agent|Current custodian/);
});

test('Inventory verification reuses its transaction client instead of exhausting the pool',()=>{
  const route=read('src/routes/listings.js');assert.match(route,/canReview\(req\.broker,\{postedBy:request\.postedBy,postedByTeamId:request\.postedByTeamId\},client\)/);assert.match(route,/refreshReadiness\(request\.listingId,client\)/);assert.match(route,/async function refreshReadiness\(id,client\)/);assert.match(route,/async function canReview\(broker,listing,client\)/);
});
