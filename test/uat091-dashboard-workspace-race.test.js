import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');

test('UAT-091 exits an obsolete dashboard render before binding removed controls',()=>{
  assert.match(ui,/const sourceFilter=\$\('#dashboard-source'\);if\(!sourceFilter\|\|renderSequence!==dashboardRenderSequence\)return;/);
  assert.match(ui,/sourceFilter\.addEventListener\('change'/);
  assert.doesNotMatch(ui,/\$\('#dashboard-source'\)\.addEventListener\('change'/);
});
