import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.204 applies the approved charcoal, neutral navy, warm grey and gold palette',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.209');
  for(const marker of [
    'DEV204 no-teal charcoal-navy refinement',
    '--workspace:#171d26',
    '--surface:#1d2530',
    '--surface-muted:#222a35',
    '--surface-raised:#2a323e',
    '--ink-muted:#b2b7bf',
    '--line:#444e5a',
    '--green:#d0aa64',
    '--blue:#8fa2bd',
    'background:linear-gradient(110deg,#0b1320,#172131 62%,#252c38)',
    'background:#121820',
    'background:radial-gradient(circle at 88% 0,rgba(92,108,132,.18),transparent 34%),#171d26',
    '#app.shell-layout table th{background:#2a333f;color:#e8c67f}',
    '#app.shell-layout .btn{border-color:#555f6c;background:#2a323e'
  ]) assert.ok(html.includes(marker),`missing DEV204 palette marker: ${marker}`);
});

test('dev.204 removes the rendered teal palette and preserves white print output',()=>{
  const html=read('public/index.html');
  const finalOverride=html.slice(html.indexOf('/* DEV202: one consistent dark NYSA workspace'));
  for(const teal of ['#69a999','#18332f','#315f55','#193f39','rgba(60,123,109']){
    assert.ok(!finalOverride.includes(teal),`rendered authenticated-shell override still contains teal ${teal}`);
  }
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
