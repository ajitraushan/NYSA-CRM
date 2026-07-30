import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Inventory verification is the single activation control',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),dashboard=read('public/dashboard-ui.js');
  assert.match(route,/workflowStatus=activated\?'approved'/);
  assert.match(route,/Inventory approval was consolidated into mandatory Inventory verification/);
  assert.match(ui,/There is no separate Inventory approval/);
  assert.doesNotMatch(dashboard,/likelyType==='manager'\?\[[^\]]*'Inventory approvals'/);
});

test('Inventory owner is Customer-linked with duplicate protection and unverified KYC',()=>{
  const route=read('src/routes/listings.js'),migration=read('src/migrations/059_release26_inventory_owner_and_activation.sql');
  for(const marker of ['inventory-owner-customers','ownerContactId','contact_id','identity_snapshot',
    "kyc_status,lifecycle_status,duplicate_review_status","'unverified','active','not_required'",
    'A matching Customer already exists'])
    assert.match(route,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(migration,/ADD COLUMN contact_id UUID REFERENCES contacts/);
  assert.match(migration,/ADD COLUMN identity_snapshot JSONB/);
});

test('Inventory owner fields and headline satisfy 022 A-M UI acceptance',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Inventory headline / name','Inventory ownership and authority · find or create the owner','Search Customer Master','Use matching Customer',
    'No matching Customer — enter a new owner below','new Customer only','Owner address','Originating NYSA Inventory agent'])
    assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(ui,/<label>Inventory contact<\/label>/);
});

test('saved Inventory drafts retain a clear enrichment route and aligned authority choices',()=>{
  const ui=read('public/app.js'),html=read('public/index.html'),route=read('src/routes/listings.js');
  assert.match(ui,/Continue Inventory enrichment/);
  assert.match(ui,/id="inventory-enrichment"/);
  assert.match(ui,/Authority permissions/);
  assert.match(html,/\.inventory-authorizations input\[type="checkbox"\]\{width:auto/);
  assert.match(ui,/inventory-headline-field/);
  assert.match(html,/\.inventory-headline-field\{padding:10px 12px/);
  assert.match(ui,/query&&ownerCustomers\.length===1\)form\.elements\.ownerContactId\.value=ownerCustomers\[0\]\.id/);
  assert.match(ui,/data-new-owner-field/);
  assert.match(ui,/New Customer intake is unavailable while matches are shown/);
  assert.match(ui,/const query=event\.target\.value\.trim\(\);if\(query\)form\.elements\.ownerName\.value=query/);
  assert.match(ui,/span3 inventory-originating-agent/);
  assert.match(ui,/listing\.inventoryHeadline\|\|listing\.project/);
  assert.match(ui,/next\.buttonLabel==='Continue draft'/);
  assert.match(ui,/Continue this Inventory draft/);
  assert.match(ui,/id="d-draft-media">Add property media/);
  assert.match(ui,/Add another Inventory party \(optional\)/);
  assert.match(route,/must not silently deactivate a verified Inventory/);
  assert.match(route,/restored because system-controlled verification remains valid/);
  assert.doesNotMatch(route,/Material changes require a new review/);
  assert.match(read('src/routes/crm.js'),/customer\.createdBy===req\.broker\.id/);
});

test('seller-side inheritance reads current Customer Master identity',()=>{
  for(const file of ['src/routes/opportunities.js','src/routes/transaction-representation.js']){
    const route=read(file);
    assert.match(route,/LEFT JOIN contacts c ON c\.id=p\.contact_id/);
    assert.match(route,/COALESCE\(c\.full_name,p\.display_name\)/);
  }
});

test('Inventory completion uses quarter handover and defaults Viewing from selected Inventory',()=>{
  const ui=read('public/app.js'),opportunities=read('src/routes/opportunities.js');
  assert.match(ui,/Expected handover quarter/);
  assert.match(ui,/handoverQuarterValue/);
  assert.match(ui,/handoverQuarterDate/);
  assert.match(ui,/CORE records and displays the expected quarter and year/);
  assert.doesNotMatch(ui,/Expected handover date \*/);
  assert.match(opportunities,/AS viewing_address/);
  assert.match(opportunities,/NULLIF\(li\.community,''\)/);
  assert.match(ui,/match\?\.viewingAddress/);
  assert.match(ui,/property\?\.addEventListener\('change',defaultLocation\)/);
});

test('Opportunity register is searchable sortable and deliberately capped at ten results',()=>{
  const ui=read('public/app.js'),opportunities=read('src/routes/opportunities.js');
  for(const marker of ['Search Opportunities','* wildcard','All stages','My Opportunities','Sort sequence','Next action due first','Customer A–Z','showing first'])
    assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/pageSize:'10'/);
  assert.match(opportunities,/Number\.parseInt\(req\.query\.pageSize,10\)\|\|10/);
  assert.match(opportunities,/const sorts=\{due:/);
  assert.match(opportunities,/sorts\[req\.query\.sort\]\|\|sorts\.due/);
});
