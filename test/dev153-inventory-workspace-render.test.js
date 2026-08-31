import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const componentSource=read('public/inventory-workspace-ui.js');
const app=read('public/app.js');
const page=read('public/index.html');
const bootstrap=read('public/bootstrap.js');
const sandbox={};
vm.runInNewContext(componentSource,sandbox);
const ui=sandbox.NysaInventoryWorkspaceUI;

test('UAT-035 renders a real three-stage Inventory journey for a new draft',()=>{
  const html=ui.journeyMarkup({mode:'create'});
  assert.equal((html.match(/class="inventory-journey-step/g)||[]).length,3);
  assert.match(html,/aria-label="Inventory journey"/);
  assert.match(html,/Build the Inventory draft/);
  assert.match(html,/Establish authority and activate/);
  assert.match(html,/Prepare an external Listing/);
  assert.match(html,/You are here/);
  assert.equal((html.match(/disabled aria-disabled="true"/g)||[]).length,2);
});

test('UAT-035 saved-record journey requires owner authority before verification and unlocks optional publication only after activation',()=>{
  const awaiting=ui.journeyMarkup({mode:'detail',verificationStatus:'unverified',partyCount:0});
  assert.match(awaiting,/Owner and authority required/);
  assert.match(awaiting,/Available after activation/);
  const active=ui.journeyMarkup({mode:'detail',verificationStatus:'verified',partyCount:1});
  assert.match(active,/Inventory active/);
  assert.match(active,/Optional next journey/);
  assert.equal((active.match(/disabled aria-disabled="true"/g)||[]).length,0);
});

test('UAT-035 Inventory property form is visibly grouped and does not mix verification controls into Draft facts',()=>{
  const start=app.indexOf('async function openListingForm');
  const end=app.indexOf('function openCloseModal',start);
  const form=app.slice(start,end);
  const markers=['Property identity','Commercial terms and handover','Source, responsibility and readiness','Originating NYSA Inventory agent','Save as draft'];
  let previous=-1;
  for(const marker of markers){const position=form.indexOf(marker);assert.ok(position>previous,`${marker} must follow the prior section`);previous=position;}
  assert.doesNotMatch(form,/<label>Inventory verification<\/label>/);
  assert.doesNotMatch(form,/<label>Verification expiry<\/label>/);
  assert.match(form,/Owner and authority are completed after the Draft is saved/);
});

test('UAT-035 saved Inventory orders property, authority and optional publication as governed sections',()=>{
  for(const marker of ['id="inventory-step-property"','id="inventory-step-authority"','2A · Owner \/ represented party','2B · ','id="inventory-step-external"'])assert.match(app,new RegExp(marker));
  assert.match(app,/authoritySection\?\.append\(verificationSection\)/);
  assert.match(app,/inventory-step-edit-property/);
  assert.doesNotMatch(app,/id="d-draft-edit"/);
  assert.doesNotMatch(app,/id="d-edit"/);
  assert.match(app,/Complete 2A before submitting/);
  assert.match(app,/\(l\.inventoryCounterparties\|\|\[\]\)\.length\?`<form id="inventory-verification-submit-form"/);
});

test('UAT-035 action bar remains in normal document flow and responsive journey stacks without covering fields',()=>{
  assert.match(page,/\.record-workspace-surface\.listing-edit-modal \.modal-actions\{position:static/);
  assert.doesNotMatch(page,/record-workspace-surface\.listing-edit-modal \.modal-actions\{[^}]*bottom:0/);
  assert.match(page,/@media\(max-width:900px\)\{\.inventory-journey\{grid-template-columns:1fr\}/);
  assert.ok(bootstrap.indexOf("'inventory-workspace-ui.js'")<bootstrap.indexOf("'app.js'"));
});
