import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.202 shell structure remains present under the approved DEV218 light workspace',()=>{
  const html=read('public/index.html');
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.1.0-dev.220');
  for(const marker of [
    'DEV218 approved NYSA light workspace',
    '--workspace:#f4f1eb',
    '#app.shell-layout>nav.tabs',
    '#app.shell-layout>main'
  ]) assert.ok(html.includes(marker),`missing global dark-theme marker: ${marker}`);
});

test('dev.202 authenticated surfaces use the approved DEV218 light workspace',()=>{
  const html=read('public/index.html');
  const overrideStart=html.indexOf('/* DEV218 approved NYSA light workspace');
  assert.ok(overrideStart>0,'missing final authenticated-shell override');
  const override=html.slice(overrideStart);
  for(const marker of [
    '#app.shell-layout .agent-dashboard-website-theme',
    '--panel:#ffffff',
    '#app.shell-layout table th',
    '#app.shell-layout table td',
    '#app.shell-layout .dialog-error',
    '#app.shell-layout .inventory-step-blocker',
    '#app.shell-layout .diary-state-upcoming'
  ]) assert.ok(override.includes(marker),`missing DEV218 workspace override: ${marker}`);
});

test('dev.202 keeps printable documents on white paper',()=>{
  const html=read('public/index.html');
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
