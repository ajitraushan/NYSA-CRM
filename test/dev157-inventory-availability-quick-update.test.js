import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('UAT-047/048 Inventory cards expose the explicit availability period and one-step update action',()=>{
  const app=read('public/app.js');
  assert.match(app,/Availability effective period/);
  assert.match(app,/data-update-inventory-availability/);
  assert.match(app,/function openInventoryAvailabilityUpdate\(listing,\{afterSave=loadListings\}=\{\}\)/);
  assert.match(app,/Use current date and time/);
  assert.match(app,/Confirmation valid until/);
  assert.match(app,/CORE does not invent a seven-day expiry/);
});

test('UAT-047 card action does not open the full Inventory record and refreshes the register after save',()=>{
  const app=read('public/app.js');
  assert.match(app,/event\.stopPropagation\(\)/);
  assert.match(app,/api\(`\/listings\/\$\{listing\.id\}\/availability`,\{method:'PATCH'/);
  assert.match(app,/dialog\.remove\(\);afterSave\(\)/);
  assert.match(app,/data-dashboard-availability/);
});

test('UAT-047 availability endpoint is scoped, rejects future confirmations and writes explicit audit evidence',()=>{
  const route=read('src/routes/listings.js');
  assert.match(route,/r\.patch\('\/listings\/:id\/availability'/);
  assert.match(route,/if\(!canEdit\(req\.broker,listing\)\)return res\.status\(403\)/);
  assert.match(route,/Availability confirmation cannot be recorded in the future/);
  assert.match(route,/Availability expiry must be later than the effective confirmation time/);
  assert.match(route,/availability_expires_at/);
  assert.match(route,/availability_reconfirmed/);
  assert.match(route,/source:'inventory_workspace_quick_action'/);
});
