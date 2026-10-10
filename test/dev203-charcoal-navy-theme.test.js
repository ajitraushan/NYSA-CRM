import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.203 navy identity remains present under the DEV218 light workspace',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.226');
  for(const marker of [
    'DEV218 approved NYSA light workspace',
    '--workspace:#f4f1eb',
    '--surface:#ffffff',
    '--surface-muted:#f4f1eb',
    '--ink:#14232c',
    '--ink-muted:#5b6770',
    '--line:#b9c0c6',
    'background:#14232c',
    '#app.shell-layout .agent-dashboard-website-theme',
    '#app.shell-layout table th{background:#14232c;color:#fff}',
    '#app.shell-layout input,#app.shell-layout select,#app.shell-layout textarea{background:#fff'
  ]) assert.ok(html.includes(marker),`missing inherited dark-shell marker: ${marker}`);
});

test('dev.203 keeps gold primary actions and white print under DEV218',()=>{
  const html=read('public/index.html');
  assert.ok(html.includes('--gold:#8f6a30'));
  assert.ok(html.includes('.btn-primary{border-color:#8f6a30;background:#8f6a30;color:#fff}'));
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
