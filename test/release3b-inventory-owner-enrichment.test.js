import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInventoryPartyInput } from '../src/inventory-party-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('an imported Inventory Draft can capture its first governed owner-side party',()=>{
  const common={partyType:'person',displayName:'Property Owner',source:'Imported Inventory follow-up',authorityEvidence:'Owner instruction reference'};
  for(const partyRole of ['seller','landlord','lessor','developer','authorized_representative']){
    assert.equal(validateInventoryPartyInput({...common,partyRole}),null,partyRole);
  }
  assert.equal(validateInventoryPartyInput({...common,partyRole:'buyer'}),'Select a valid Inventory owner or representative role');
  assert.equal(validateInventoryPartyInput({...common,partyRole:'seller',authorityEvidence:''}),'Authority evidence is required');
});

test('Inventory owner enrichment is clearly saved without creating a Customer or publication',()=>{
  const ui=read('public/app.js'),route=read('src/routes/listings.js');
  for(const marker of ['Add the Inventory owner or represented party','This Draft has no saved owner-side party','Save Inventory owner / party','does not create a Customer or publish an external Listing'])assert.ok(ui.includes(marker),`missing UI marker: ${marker}`);
  assert.match(route,/validateInventoryPartyInput\(b\)/);
  assert.match(route,/Add and save the Inventory owner or represented party before submitting for verification/);
  assert.doesNotMatch(route,/Additional free-text parties may only be authorized representatives/);
});
