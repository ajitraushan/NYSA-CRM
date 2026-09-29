import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.204 no-teal rule remains under the dev.210 warm charcoal and gold palette',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.216');
  for(const marker of [
    'DEV210 login-anchored warm charcoal refinement',
    '--workspace:#0c1014',
    '--surface:#15191b',
    '--surface-muted:#1b2023',
    '--surface-raised:#24292c',
    '--ink-muted:#bdb9b0',
    '--line:#3e3b35',
    '--green:#d4ab60',
    '--blue:#a9b6bd',
    'background:linear-gradient(110deg,#080b0f,#11171c 62%,#211c14)',
    'background:#0d1114',
    'background:radial-gradient(circle at 88% 0,rgba(212,171,96,.07),transparent 34%),#0c1014',
    '#app.shell-layout table th{background:#242724;color:#e6c17b}',
    '#app.shell-layout .btn{border-color:#49453d;border-radius:6px;background:#24292c'
  ]) assert.ok(html.includes(marker),`missing superseding no-teal palette marker: ${marker}`);
});

test('dev.204 removes the rendered teal palette and preserves white print output',()=>{
  const html=read('public/index.html');
  const finalOverride=html.slice(html.indexOf('/* DEV210: one login-anchored warm charcoal workspace'));
  for(const teal of ['#69a999','#18332f','#315f55','#193f39','rgba(60,123,109']){
    assert.ok(!finalOverride.includes(teal),`rendered authenticated-shell override still contains teal ${teal}`);
  }
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
