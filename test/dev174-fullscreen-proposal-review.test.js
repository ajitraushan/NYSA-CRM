import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('proposal PDF review opens a separate browser tab without replacing CORE',()=>{
  const app=read('../public/app.js');
  assert.match(app,/window\.open\('about:blank',`nysa-pdf-/);
  assert.match(app,/tab\.location\.replace/);
  assert.match(app,/PDF opened in a separate tab/);
  assert.doesNotMatch(app,/o\.classList\.add\('proposal-review-overlay'\)/);
});

test('separate-tab review preserves exact PDF and visible return controls',()=>{
  const app=read('../public/app.js');
  for(const marker of ['Open PDF again','Back to Proposal','I reviewed this exact immutable PDF in the separate tab.','Request changes','Approve for external delivery'])assert.match(app,new RegExp(marker));
});
