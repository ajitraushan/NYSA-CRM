import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const css=read('public/index.html');
const routes=read('src/routes/opportunities.js');

test('UAT-036 is superseded by formal Inventory assignment maintenance through Deal',()=>{
  for(const stage of ['Requirements','Matching','Viewing','Offer','Negotiation']){
    assert.match(app,new RegExp(`['\"]${stage}['\"]`));
    assert.match(routes,new RegExp(`['\"]${stage}['\"]`));
  }
  assert.match(app,/Assign Inventory to this Opportunity/);
  assert.match(app,/Delink assignment/);
  assert.match(app,/Create another Inventory assignment/);
  assert.match(routes,/inventory_assignments/);
  assert.match(routes,/property matches cannot be maintained on a closed Opportunity/i);
});

test('UAT-036/037 retains acceptance and reservation locks without freezing shared assignment',()=>{
  assert.match(routes,/This Offer Inventory has no active unexpired assignment/);
  assert.match(routes,/Inventory is exclusively reserved under/);
  assert.match(routes,/Reserved Inventory cannot be detached/);
  assert.match(routes,/Deal ID will remain active/);
  assert.match(routes,/requireLiveInventory\(checked\.value\.listingId,opportunity\.id,client\)/);
});

test('UAT-036 exposes all eligible and excluded Inventory without a narrow activity-row layout',()=>{
  const matchingRoute=routes.match(/r\.get\('\/crm\/opportunities\/:id\/matching-inventory',[\s\S]*?\n\}\);/)?.[0]||'';
  assert.doesNotMatch(matchingRoute,/LIMIT 50|LIMIT 200|\.slice\(0,50\)/);
  assert.match(app,/opportunity-eligibility-list/);
  assert.match(app,/Why Inventory is not ready to assign/);
  assert.doesNotMatch(app,/Why other Inventory is not addable/);
  assert.match(css,/\.opportunity-eligibility-list\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(280px,1fr\)\)/);
  assert.match(css,/max-height:520px;overflow:auto/);
});

test('UAT-036/037 keeps ended assignments separate from matching evidence',()=>{
  assert.match(app,/endedAssignments=inventoryAssignments\.filter/);
  assert.match(app,/Assignment history/);
  assert.match(app,/Matching evidence remains separate/);
  assert.match(routes,/property_match_id/);
});

test('dev.152 package is cumulative, deterministic and private-runtime safe',()=>{
  const stem='release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev152';
  const zip=readFileSync(new URL(`../${stem}.zip`,import.meta.url));
  const entries=Object.keys(unzipSync(zip));
  const manifest=JSON.parse(read(`${stem}.manifest.json`));
  const deployer=read('release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev152.sh');
  assert.equal(manifest.version,'2.1.0-dev.152');
  assert.equal(manifest.migrationCount,98);
  assert.equal(manifest.latestMigration,'098_developer_arrangement_and_listing_noc.sql');
  assert.ok(entries.includes('src/migrations/098_developer_arrangement_and_listing_noc.sql'));
  assert.ok(entries.includes('docs/CRM_TEST_DEV152_COMBINED_LOCAL_COMPLETION.md'));
  assert.ok(entries.includes('RUNTIME_MANIFEST.sha256'));
  assert.ok(entries.includes('MANIFEST.sha256'));
  assert.ok(!entries.includes('.env'));
  for(const prohibited of ['storage/','node_modules/','test/','tools/','outputs/','.git/'])assert.ok(!entries.some(name=>name.startsWith(prohibited)),`archive contains ${prohibited}`);
  assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.152/);
  assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.148/);
  assert.match(deployer,/expected exactly one new CRM Test worker/);
});
