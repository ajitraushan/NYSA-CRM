import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.204 no-teal rule remains under the DEV218 navy and gold palette',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.222');
  for(const marker of [
    'DEV218 approved NYSA light workspace',
    '--workspace:#f4f1eb',
    '--surface:#ffffff',
    '--surface-muted:#f4f1eb',
    '--surface-raised:#eef0f2',
    '--ink-muted:#5b6770',
    '--line:#b9c0c6',
    '--green:#276749',
    '--blue:#285b75',
    '#app.shell-layout>header,#app.shell-layout>nav.tabs{background:#14232c;color:#fff}',
    '#app.shell-layout table th{background:#14232c;color:#fff}',
    '#app.shell-layout .btn{border-color:#8d979e;border-radius:6px;background:#fff'
  ]) assert.ok(html.includes(marker),`missing superseding no-teal palette marker: ${marker}`);
});

test('dev.204 removes the rendered teal palette and preserves white print output',()=>{
  const html=read('public/index.html');
  const finalOverride=html.slice(html.indexOf('/* DEV218 approved NYSA light workspace'));
  for(const teal of ['#69a999','#18332f','#315f55','#193f39','rgba(60,123,109']){
    assert.ok(!finalOverride.includes(teal),`rendered authenticated-shell override still contains teal ${teal}`);
  }
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
