import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Area Maintenance is the sole user-facing master for Market Intelligence areas',()=>{
  const ui=read('public/market-intelligence-ui.js');
  assert.match(ui,/Market areas supplied by Area Maintenance/);
  assert.match(ui,/Administration → Area Maintenance/);
  assert.match(ui,/Active CORE Area/);
  assert.doesNotMatch(ui,/id="market-community-form"/);
  assert.doesNotMatch(ui,/Draft canonical Community/);
  assert.doesNotMatch(ui,/data-market-community-(?:activate|retire)/);
});

test('new single and bulk Area records receive an internal Market Intelligence projection atomically',()=>{
  const route=read('src/routes/lead-operations.js');
  const projection=read('src/market-area-projection.js');
  assert.match(route,/ensureMarketAreaProjection\(area,req\.broker\.id,client\)/);
  assert.ok((route.match(/ensureMarketAreaProjection\(area,req\.broker\.id,client\)/g)||[]).length>=2);
  assert.match(projection,/managed_from_area=1/);
  assert.match(projection,/area_projection_created/);
  assert.match(projection,/source:'area_maintenance'/);
});

test('Market Intelligence reads current identity from Area Maintenance and preserves technical history',()=>{
  const route=read('src/routes/dld-market-intelligence.js');
  const migration=read('src/migrations/108_dev174_single_area_maintenance.sql');
  assert.match(route,/areaMaintenanceIsAuthoritative:true/);
  assert.match(route,/a\.stable_code/);
  assert.match(route,/a\.business_label/);
  assert.match(route,/Maintain the stable code, area label, Emirate and active state once under Area Maintenance/);
  assert.match(migration,/ADD COLUMN managed_from_area/);
  assert.match(migration,/market_communities_area_projection_uq/);
  assert.match(migration,/Existing market community identities remain as compatibility projections/);
  assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('DLD crosswalk creation and activation require an active Area-maintained projection',()=>{
  const route=read('src/routes/dld-market-intelligence.js');
  assert.ok((route.match(/c\.managed_from_area=1/g)||[]).length>=5);
  assert.match(route,/The mapped Area is no longer active in Area Maintenance/);
  assert.match(route,/Select the exact active Area supplied by Area Maintenance/);
});
