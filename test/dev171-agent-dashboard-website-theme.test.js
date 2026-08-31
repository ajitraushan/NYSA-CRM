import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('public/index.html',root),'utf8');
const dashboard=readFileSync(new URL('public/dashboard-ui.js',root),'utf8');
const app=readFileSync(new URL('public/app.js',root),'utf8');
const pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));

test('dev.171 scopes the NYSA website palette and typography to Agent dashboards',()=>{
  assert.equal(pkg.version,'2.1.0-dev.174');
  assert.match(dashboard,/agent-dashboard-website-theme/);
  for(const marker of [
    '--panel:#fff','--panel2:#eef0eb','--text:#0a2233','--muted:#5f6d73',
    '--gold:#d0aa64','--gold-strong:#a9783a','--green:#315f55',
    'font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-family:"Iowan Old Style","Palatino Linotype",Baskerville,Georgia,serif'
  ])assert.ok(html.includes(marker),`missing website theme marker ${marker}`);
});

test('dev.171 keeps sizing proportional and preserves the approved NYSA logo assets',()=>{
  assert.match(html,/font-size:clamp\(32px,4vw,48px\)/);
  assert.match(html,/font-size:clamp\(24px,3vw,34px\)/);
  assert.match(app,/nysa-horizontal-dark\.svg/);
  assert.match(app,/nysa-app-icon\.svg/);
  assert.doesNotMatch(dashboard,/class="mark"|>N<\/span>/);
});

test('dev.171 preserves governed urgency colours and dashboard controls',()=>{
  for(const marker of ['attention-overdue','attention-urgent','attention-due-today','agent-dashboard-command-bar','agent-dashboard-filter-drawer'])assert.ok(dashboard.includes(marker)||html.includes(marker),`missing ${marker}`);
  assert.match(html,/--danger:#a4483d/);
  assert.match(html,/--amber:#a9783a/);
});
