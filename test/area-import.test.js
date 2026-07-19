import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAreaImportRows,AREA_IMPORT_HEADERS,UAE_EMIRATES } from '../src/area-import.js';

test('area import uses the governed four-column Excel contract',()=>{
  assert.deepEqual(AREA_IMPORT_HEADERS,['stable_area_code','customer_facing_area','emirate','display_order']);
  assert.equal(UAE_EMIRATES.length,7);
  const rows=validateAreaImportRows([{rowNumber:2,stableCode:'dubai_marina',businessLabel:'Dubai Marina',emirate:'Dubai',displayOrder:10}]);
  assert.deepEqual(rows[0].errors,[]);
});

test('area import identifies invalid rows and automatically skips existing areas',()=>{
  const rows=validateAreaImportRows([
    {rowNumber:2,stableCode:'Dubai Marina',businessLabel:'Dubai Marina',emirate:'Dubai',displayOrder:10},
    {rowNumber:3,stableCode:'dubai_marina',businessLabel:'Dubai Marina',emirate:'Invalid Emirate',displayOrder:-1},
    {rowNumber:4,stableCode:'arjan',businessLabel:'Arjan',emirate:'Dubai',displayOrder:20}
  ],{existingAreas:[{stableCode:'arjan',businessLabel:'Arjan',emirate:'Dubai'}]});
  assert.match(rows[0].errors.join(' '),/lowercase snake_case/);
  assert.match(rows[1].errors.join(' '),/seven maintained UAE Emirates/);
  assert.deepEqual(rows[2].errors,[]);
  assert.equal(rows[2].skipped,true);
  assert.match(rows[2].skipReason,/skipped automatically/);
});

test('area import skips an exact repeated workbook row without blocking new rows',()=>{
  const rows=validateAreaImportRows([
    {rowNumber:2,stableCode:'meydan',businessLabel:'Meydan',emirate:'Dubai',displayOrder:10},
    {rowNumber:3,stableCode:'meydan',businessLabel:'Meydan',emirate:'Dubai',displayOrder:10},
    {rowNumber:4,stableCode:'business_bay',businessLabel:'Business Bay',emirate:'Dubai',displayOrder:20}
  ]);
  assert.equal(rows[0].skipped,false);
  assert.equal(rows[1].skipped,true);
  assert.match(rows[1].skipReason,/Excel row 2/);
  assert.equal(rows[2].skipped,false);
  assert.equal(rows.every(row=>!row.errors.length),true);
});

test('area import blocks a reused stable code mapped to a different area',()=>{
  const [row]=validateAreaImportRows([
    {rowNumber:2,stableCode:'arjan',businessLabel:'Different Area',emirate:'Dubai',displayOrder:20}
  ],{existingAreas:[{stableCode:'arjan',businessLabel:'Arjan',emirate:'Dubai'}]});
  assert.equal(row.skipped,false);
  assert.match(row.errors.join(' '),/mapped to a different maintained area/);
});

test('area Excel upload is previewed and committed atomically with audit evidence',()=>{
  const routes=readFileSync(new URL('../src/routes/lead-operations.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(routes,/\/admin\/areas\/import\/preview/);
  assert.match(routes,/\/admin\/areas\/import\/commit/);
  assert.match(routes,/await transaction\(async client/);
  assert.match(routes,/'bulk_imported'/);
  assert.match(app,/Download Excel template/);
  assert.match(app,/Review Excel upload/);
  assert.match(app,/Import reviewed areas/);
  assert.match(app,/Nothing has been imported/);
});

test('area maintenance displays the business label and stable code on separate lines',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/class="area-name"/);
  assert.match(app,/class="mono area-code"/);
  assert.match(html,/\.area-code\{display:block/);
  assert.match(html,/\.area-maintenance-table table\{table-layout:fixed\}/);
});
