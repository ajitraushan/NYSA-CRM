import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Inventory verification is the single activation control',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),dashboard=read('public/dashboard-ui.js');
  assert.match(route,/workflowStatus=activated\?'approved'/);assert.match(route,/Inventory approval was consolidated into mandatory Inventory verification/);assert.match(ui,/There is no separate Inventory approval/);assert.doesNotMatch(dashboard,/likelyType==='manager'\?\[[^\]]*'Inventory approvals'/);
});

test('Inventory owner enrichment preserves governed party identity evidence',()=>{
  const route=read('src/routes/listings.js'),migration=read('src/migrations/059_release26_inventory_owner_and_activation.sql');
  for(const marker of ['inventory-owner-customers','inventory_counterparties','authorityEvidence'])assert.match(route,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(migration,/ADD COLUMN contact_id UUID REFERENCES contacts/);assert.match(migration,/ADD COLUMN identity_snapshot JSONB/);
});

test('Internal Inventory Draft starts with property and source facts, not portal or mandate fields',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Inventory headline / name','Who or what supplied this property to NYSA?','Originating NYSA Inventory agent','Owner and authority are completed after the Draft is saved'])assert.ok(ui.includes(marker),`missing ${marker}`);
  assert.doesNotMatch(ui,/Inventory ownership and authority · find or create the owner/);assert.match(ui,/External Portal Listings/);
});

test('saved Inventory drafts retain a clear owner enrichment route',()=>{
  const ui=read('public/app.js'),html=read('public/index.html'),route=read('src/routes/listings.js');
  assert.match(ui,/2A · Owner \/ represented party and Internal Inventory authority/);assert.match(ui,/id="inventory-enrichment"/);assert.match(ui,/Internal-use authority evidence/);assert.match(html,/\.inventory-authorizations input\[type="checkbox"\]\{width:auto/);
  assert.match(ui,/inventory-headline-field/);assert.match(html,/\.inventory-headline-field\{padding:10px 12px/);assert.match(ui,/No Inventory-side party maintained/);assert.match(ui,/Save Inventory owner \/ party/);
  assert.match(ui,/span3 inventory-originating-agent/);assert.match(ui,/listing\.inventoryHeadline\|\|listing\.project/);assert.match(ui,/next\.buttonLabel==='Continue draft'/);assert.match(ui,/Step 1 · Draft saved; complete Step 2 next/);assert.match(ui,/id="d-draft-media">Maintain property media/);
  assert.match(ui,/This is not a portal Listing NOC and does not authorize publication/);assert.match(route,/must not silently deactivate a verified Inventory/);assert.match(route,/restored because system-controlled verification remains valid/);assert.doesNotMatch(route,/Material changes require a new review/);assert.match(read('src/routes/crm.js'),/customer\.createdBy===req\.broker\.id/);
});

test('seller-side inheritance reads current Customer Master identity',()=>{
  for(const file of ['src/routes/opportunities.js','src/routes/transaction-representation.js']){const route=read(file);assert.match(route,/LEFT JOIN contacts c ON c\.id=p\.contact_id/);assert.match(route,/COALESCE\(c\.full_name,p\.display_name\)/);}
});

test('Inventory completion uses quarter handover and defaults Viewing from selected Inventory',()=>{
  const ui=read('public/app.js'),opportunities=read('src/routes/opportunities.js');assert.match(ui,/Expected handover quarter/);assert.match(ui,/handoverQuarterValue/);assert.match(ui,/handoverQuarterDate/);assert.match(ui,/CORE records and displays the expected quarter and year/);assert.doesNotMatch(ui,/Expected handover date \*/);assert.match(opportunities,/AS viewing_address/);assert.match(opportunities,/NULLIF\(li\.community,''\)/);assert.match(ui,/match\?\.viewingAddress/);assert.match(ui,/property\?\.addEventListener\('change',defaultLocation\)/);
});

test('Opportunity register is searchable sortable and paginates its twenty-five-row pages',()=>{
  const ui=read('public/app.js'),opportunities=read('src/routes/opportunities.js');for(const marker of ['Search Opportunities','* wildcard','All stages','My Opportunities','Sort sequence','Next action due first','Customer A–Z','Previous','Next','page'])assert.ok(ui.includes(marker),`missing ${marker}`);assert.match(ui,/pageSize:'25'/);assert.match(opportunities,/Number\.parseInt\(req\.query\.pageSize,10\)\|\|25/);assert.match(opportunities,/const sorts=\{due:/);assert.match(opportunities,/sorts\[req\.query\.sort\]\|\|sorts\.due/);
});
