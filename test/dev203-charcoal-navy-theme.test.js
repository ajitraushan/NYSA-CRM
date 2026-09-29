import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.203 dark shell remains present under the dev.210 login-anchored refinement',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.216');
  for(const marker of [
    'DEV210 login-anchored warm charcoal refinement',
    '--workspace:#0c1014',
    '--surface:#15191b',
    '--surface-muted:#1b2023',
    '--ink:#f7f4ed',
    '--ink-muted:#bdb9b0',
    '--line:#3e3b35',
    'background:#0d1114',
    'background:radial-gradient(circle at 88% 0,rgba(212,171,96,.07),transparent 34%),#0c1014',
    '#app.shell-layout .agent-dashboard-website-theme',
    '#app.shell-layout table th{background:#242724;color:#e6c17b}',
    '#app.shell-layout input,#app.shell-layout select,#app.shell-layout textarea{background:#101416'
  ]) assert.ok(html.includes(marker),`missing inherited dark-shell marker: ${marker}`);
});

test('dev.203 keeps gold primary actions and white print under the login-anchored refinement',()=>{
  const html=read('public/index.html');
  assert.ok(html.includes('--green:#d4ab60'));
  assert.ok(html.includes('.btn-primary{border-color:#d4ab60;background:#d4ab60;color:#151006}'));
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
