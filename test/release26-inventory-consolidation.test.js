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
  for(const marker of ['Inventory headline / name','Search existing Customer owner','Select existing Customer',
    'Create a new Customer owner below','Owner address','Originating NYSA Inventory agent'])
    assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(ui,/<label>Inventory contact<\/label>/);
});

test('seller-side inheritance reads current Customer Master identity',()=>{
  for(const file of ['src/routes/opportunities.js','src/routes/transaction-representation.js']){
    const route=read(file);
    assert.match(route,/LEFT JOIN contacts c ON c\.id=p\.contact_id/);
    assert.match(route,/COALESCE\(c\.full_name,p\.display_name\)/);
  }
});
