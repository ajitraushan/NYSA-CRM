import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('DEF-093 binds Inventory stage navigation to the rendered Inventory selection pane',()=>{
  const app=read('public/app.js');
  assert.match(app,/const propertySection=inventorySelectionSection/);
  assert.match(app,/if\(propertySection\)propertySection\.dataset\.flowPane='inventory'/);
  assert.match(app,/flowPanes=\[propertySection,viewingSection,offerSection,bookingSection,dealSection\]\.filter\(Boolean\)/);
  assert.match(app,/const pane=flowPanes\.find\(item=>String\(item\.dataset\.flowPane\|\|''\)\.split\(' '\)\.includes\(step\)\)/);
});
