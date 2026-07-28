import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('Release 2.6 persists multi-property WhatsApp sharing and customer responses',()=>{
  const migration=read('src/migrations/054_release26_consolidated.sql');
  const routes=read('src/routes/opportunities.js');
  const ui=read('public/app.js');
  for(const marker of ['opportunity_property_shares','opportunity_property_share_items','response_status','property_snapshot'])
    assert.match(migration,new RegExp(marker));
  assert.match(routes,/\/crm\/opportunities\/:id\/property-shares/);
  assert.match(routes,/up to 10 properties/);
  assert.match(routes,/OpportunityPropertyShare/);
  assert.match(ui,/WhatsApp property sharing/);
  assert.match(ui,/propertyMatchIds/);
  assert.match(ui,/Record customer response/);
  assert.match(ui,/https:\/\/wa\.me/);
});

test('Release 2.6 separates Internal Inventory from optional external portal Listings',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/listings.js');
  assert.match(ui,/Step 1: maintain Inventory/);
  assert.match(ui,/external Listing and submit it to a portal/);
  assert.match(ui,/External listing publications/);
  assert.match(routes,/external_listing_publications/);
  assert.match(routes,/workflow_auto_approved_by_policy/);
  assert.match(routes,/External publication cannot move from/);
});

test('Release 2.6 repairs Customer selection and User record layout contracts',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  for(const marker of ['customer-picker-results','data-customer-choice','Selected existing Customer','Create a new Customer instead'])
    assert.match(ui,new RegExp(marker));
  assert.match(styles,/#broker-table table\{min-width:1180px;table-layout:fixed\}/);
  assert.match(styles,/#broker-table td:first-child b,#broker-table td:first-child small\{display:block/);
});
