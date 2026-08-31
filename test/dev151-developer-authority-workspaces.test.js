import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const listingRoutes=read('src/routes/listings.js');
const partnerRoutes=read('src/routes/partner-organizations.js');
const migration=read('src/migrations/098_developer_arrangement_and_listing_noc.sql');

test('UAT-033 stores Developer arrangements and property-specific NOCs separately and immutably',()=>{
  assert.match(migration,/CREATE TABLE developer_brokerage_arrangement_versions/);
  assert.match(migration,/CREATE TABLE property_listing_noc_versions/);
  assert.match(migration,/listing_id UUID NOT NULL REFERENCES listings/);
  assert.match(migration,/document_version_id UUID NOT NULL REFERENCES document_versions/);
  assert.match(migration,/prevent_developer_arrangement_fact_mutation/);
  assert.match(migration,/prevent_property_listing_noc_fact_mutation/);
  assert.match(partnerRoutes,/brokerage-arrangements/);
  assert.match(partnerRoutes,/listing-nocs/);
  assert.match(partnerRoutes,/The evidence uploader cannot review their own submission/);
});

test('UAT-033 gates only external listing preparation and lifecycle',()=>{
  assert.match(listingRoutes,/async function developerExternalListingAuthority/);
  assert.match(listingRoutes,/An active Developer Brokerage Arrangement is required/);
  assert.match(listingRoutes,/property-specific Developer Listing NOC is required/);
  assert.match(listingRoutes,/r\.post\('\/listings\/:id\/external-publications'/);
  assert.match(listingRoutes,/r\.post\('\/external-publications\/:id\/preparations'/);
  assert.match(listingRoutes,/r\.patch\('\/external-publications\/:id\/status'/);
  const verificationRoute=listingRoutes.match(/r\.post\('\/listings\/:id\/verification-requests',[\s\S]*?\n\}\);/)?.[0]||'';
  assert.doesNotMatch(verificationRoute,/developerExternalListingAuthority/);
});

test('UAT-033 administration UI exposes both exact evidence registers',()=>{
  assert.match(app,/Developer Brokerage Arrangement/);
  assert.match(app,/Property Listing NOC/);
  assert.match(app,/id="developer-arrangement-form"/);
  assert.match(app,/id="property-listing-noc-form"/);
  assert.match(app,/name="file" type="file" accept="application\/pdf,\.pdf"/);
  assert.match(app,/application\/pdf/);
});

test('UAT-035 uses route-backed record workspaces for all four core records',()=>{
  assert.match(app,/const RECORD_WORKSPACE_TABS=\{inventory:'listings',customer:'customers',lead:'crm',opportunity:'opportunities'\}/);
  assert.match(app,/recordWorkspaceUrl/);
  assert.match(app,/window\.addEventListener\('popstate'/);
  assert.match(app,/type:'customer',id,returnTab:'customers'/);
  assert.match(app,/type:'lead',id,returnTab:'crm'/);
  assert.match(app,/type:'opportunity',id,returnTab:'opportunities'/);
  assert.match(app,/type:'inventory',id,returnTab:'listings'/);
  assert.match(app,/type:'customer',id:'new',returnTab:'customers'/);
  assert.match(app,/type:'lead',id:preselectedCustomerId\?`new:\$\{preselectedCustomerId\}`:'new'/);
  assert.match(app,/type:'opportunity',id:`new:\$\{lead\.id\}`/);
});

test('UAT-035 preserves context and requires an explicit dirty-form decision',()=>{
  assert.match(app,/document\.createDocumentFragment/);
  assert.match(app,/scrollTop=main\?\.scrollTop/);
  assert.match(app,/Unsaved changes/);
  assert.match(app,/Save current section/);
  assert.match(app,/Discard unsaved changes and leave/);
  assert.match(app,/if \(e\.target === o&&!o\.querySelector\('form'\)\) o\.remove/);
  assert.doesNotMatch(app,/addEventListener\(['"]keydown['"][\s\S]{0,200}Escape/);
});

test('UAT-035 Inventory flow uses explicit save language and owner-before-verification order',()=>{
  assert.match(app,/Save as draft/);
  assert.match(app,/Save property facts/);
  assert.match(app,/2A · Owner \/ represented party/);
  assert.match(app,/authoritySection\?\.append\(verificationSection\)/);
  assert.match(app,/id="inventory-step-external"/);
  assert.match(app,/Inventory draft saved; add the owner \/ represented party next/);
});

test('dev.151 combined candidate is versioned, complete and excludes private runtime',()=>{
  const stem='release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev151',zip=readFileSync(new URL(`../${stem}.zip`,import.meta.url)),entries=Object.keys(unzipSync(zip)),manifest=JSON.parse(read(`${stem}.manifest.json`)),deployer=read('release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev151.sh');
  assert.equal(manifest.version,'2.1.0-dev.151');
  assert.equal(manifest.migrationCount,98);
  assert.equal(manifest.latestMigration,'098_developer_arrangement_and_listing_noc.sql');
  assert.ok(entries.includes('src/migrations/098_developer_arrangement_and_listing_noc.sql'));
  assert.ok(entries.includes('RUNTIME_MANIFEST.sha256'));
  assert.ok(entries.includes('MANIFEST.sha256'));
  assert.ok(!entries.includes('.env'),'archive contains .env');
  for(const prohibited of ['storage/','node_modules/','test/','tools/','outputs/','.git/'])assert.ok(!entries.some(name=>name.startsWith(prohibited)),`archive contains ${prohibited}`);
  assert.match(deployer,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.148/);
  assert.match(deployer,/LATEST_MIGRATION=098_developer_arrangement_and_listing_noc\.sql/);
  assert.match(deployer,/expected exactly one new CRM Test worker/);
});
