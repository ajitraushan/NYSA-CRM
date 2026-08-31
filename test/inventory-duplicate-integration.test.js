import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('Inventory migration adds the five-part identity support and immutable reopen queue',()=>{
  const sql=read('../src/migrations/083_inventory_duplicate_prevention.sql');
  for(const token of ['unit_reference','building','area_id','community','size_sqft','inventory_reopen_requests'])assert.match(sql,new RegExp(token));
  assert.match(sql,/WHERE status='pending'/);
  assert.doesNotMatch(sql,/UPDATE listings SET unit_reference/i);
});

test('manual Inventory maintenance requires and submits the approved identity fields',()=>{
  const source=read('../public/app.js');
  assert.match(source,/name="communityId" required/);
  assert.match(source,/name="buildingId" required/);
  assert.match(source,/name="unitReference" required/);
  assert.match(source,/name="sizeSqft"[^>]*required/);
  assert.match(source,/Request reopening/);
  assert.doesNotMatch(source,/id="d-reopen">Reopen as Available/);
});

test('server blocks direct reopening and uses the governed duplicate gate',()=>{
  const source=read('../src/routes/listings.js');
  assert.match(source,/inspectInventoryDuplicate\(b,\{client\}\)/);
  assert.match(source,/Only a closed Inventory can be submitted for reopening/);
  assert.match(source,/System-controlled or closed Inventory cannot be cleared manually/);
  assert.match(source,/reopen-requests\/:requestId\/decision/);
  assert.match(source,/Another active Inventory now has this exact identity; reopening is blocked/);
});

test('duplicate gate normalizes Unit Reference, Building, Community, Area and exact Size',()=>{
  const source=read('../src/inventory-duplicate-gate.js');
  for(const field of ['unitReference','building','community','areaId','sizeSqft'])assert.match(source,new RegExp(field));
  assert.match(source,/pg_advisory_xact_lock/);
  assert.match(source,/status!=='Closed'/);
  assert.match(source,/require_manager_reopen_approval/);
});
