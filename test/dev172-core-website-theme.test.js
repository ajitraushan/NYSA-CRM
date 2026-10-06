import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(name)=>readFileSync(new URL(name,root),'utf8');

test('dev.172 shared CORE shell is preserved under the approved DEV218 tokens',()=>{
  const html=read('public/index.html');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.1.0-dev.219');
  for(const marker of [
    'DEV218 approved NYSA light workspace',
    '--workspace:#f4f1eb',
    '--charcoal:#14232c',
    '--green:#276749',
    '--gold:#8f6a30',
    'font-family:Inter,Arial,sans-serif',
    "font-family:'GFS Baskerville',Georgia,serif",
    'max-width:1920px',
    '#app.shell-layout .btn-primary'
  ]) assert.match(html,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('dev.172 preserves official identity and keeps the Agent dashboard theme scoped',()=>{
  const html=read('public/index.html');
  const dashboard=read('public/dashboard-ui.js');
  assert.match(html,/\/brand\/nysa\/raster\/favicon-32\.png/);
  assert.match(dashboard,/likelyType==='agent'\?'agent-dashboard-website-theme':''/);
  assert.doesNotMatch(dashboard,/Four Overlapping KPI cards removed/);
});
