import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('proposal PDF review uses the full browser viewport',()=>{
  const app=read('../public/app.js'),html=read('../public/index.html');
  assert.match(app,/o\.classList\.add\('proposal-review-overlay'\)/);
  assert.match(html,/\.proposal-review-overlay\{align-items:stretch;padding:8px;overflow:hidden\}/);
  assert.match(html,/\.proposal-review-modal\{position:relative;display:flex;flex-direction:column;width:100%;max-width:none;height:calc\(100vh - 16px\)/);
  assert.match(html,/\.proposal-pdf-frame\{display:block;flex:1 1 auto;width:100%;min-height:0;height:auto/);
});

test('full-screen review preserves exact PDF and review controls',()=>{
  const app=read('../public/app.js');
  for(const marker of ['Download PDF','proposal-pdf-frame','I reviewed this exact immutable PDF on screen.','Request changes','Approve for external delivery'])assert.match(app,new RegExp(marker));
});
