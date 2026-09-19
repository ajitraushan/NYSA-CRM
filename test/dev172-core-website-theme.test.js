import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(name)=>readFileSync(new URL(name,root),'utf8');

test('dev.172 shared CORE shell is preserved under the superseding DEV202 dark tokens',()=>{
  const html=read('public/index.html');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.1.0-dev.208');
  for(const marker of [
    'CORE-GLOBAL-DARK-THEME-DEV202',
    '--workspace:#171d26',
    '--charcoal:#111824',
    '--green:#d0aa64',
    '--gold:#d0aa64',
    'font-family:Inter,ui-sans-serif',
    '"Iowan Old Style","Palatino Linotype",Baskerville,Georgia,serif',
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
