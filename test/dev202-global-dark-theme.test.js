import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.202 dark NYSA shell remains present after the dev.210 palette refinement',()=>{
  const html=read('public/index.html');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.1.0-dev.210');
  for(const marker of [
    'CORE-GLOBAL-DARK-THEME-DEV202',
    '--paper:var(--workspace)',
    '#app.shell-layout>nav.tabs',
    '#app.shell-layout>main'
  ]) assert.ok(html.includes(marker),`missing global dark-theme marker: ${marker}`);
});

test('dev.202 overrides legacy light dashboard and state surfaces inside the authenticated shell',()=>{
  const html=read('public/index.html');
  const overrideStart=html.indexOf('/* DEV210: one login-anchored warm charcoal workspace');
  assert.ok(overrideStart>0,'missing final authenticated-shell override');
  const override=html.slice(overrideStart);
  for(const marker of [
    '#app.shell-layout .agent-dashboard-website-theme',
    'background:rgba(21,25,27,.97)',
    '#app.shell-layout table th',
    '#app.shell-layout table td',
    '#app.shell-layout .dialog-error',
    '#app.shell-layout .inventory-step-blocker',
    '#app.shell-layout .diary-state-upcoming'
  ]) assert.ok(override.includes(marker),`missing dark override: ${marker}`);
});

test('dev.202 keeps printable documents on white paper',()=>{
  const html=read('public/index.html');
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
