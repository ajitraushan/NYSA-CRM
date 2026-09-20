import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('dev.203 charcoal-navy shell remains present after the dev.204 no-teal refinement',()=>{
  const html=read('public/index.html');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.209');
  for(const marker of [
    'no-teal charcoal-navy refinement',
    '--workspace:#171d26',
    '--surface:#1d2530',
    '--surface-muted:#222a35',
    '--ink:#f3efe7',
    '--ink-muted:#b2b7bf',
    '--line:#444e5a',
    'background:#121820',
    'background:radial-gradient(circle at 88% 0,rgba(92,108,132,.18),transparent 34%),#171d26',
    '#app.shell-layout .agent-dashboard-website-theme',
    '#app.shell-layout table th{background:#2a333f;color:#e8c67f}',
    '#app.shell-layout input,#app.shell-layout select,#app.shell-layout textarea{background:#1a212b'
  ]) assert.ok(html.includes(marker),`missing charcoal-navy marker: ${marker}`);
});

test('dev.203 keeps gold primary actions and white print under the no-teal refinement',()=>{
  const html=read('public/index.html');
  assert.ok(html.includes('--green:#d0aa64'));
  assert.ok(html.includes('.btn-primary{border-color:#b98e43;background:#b98e43;color:#071116}'));
  assert.match(html,/@media print\{body\{background:#fff\}/);
  assert.match(html,/\.proposal-preview\{display:block!important;background:#fff;color:#111\}/);
});
