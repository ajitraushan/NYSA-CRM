import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('all Opportunity workflow stages use one top-level focused viewport page',()=>{
  assert.match(app,/stagePage=document\.createElement\('section'\)/);
  assert.match(app,/document\.body\.append\(stagePage\)/);
  assert.doesNotMatch(app,/stageSurface\?\.insertAdjacentHTML/);
  assert.match(app,/document\.body\.classList\.add\('opportunity-stage-open'\)/);
  assert.match(app,/document\.body\.classList\.remove\('opportunity-stage-open'\)/);
  for(const step of ['inventory','viewing','offer','negotiation','booking','deal'])assert.match(app,new RegExp(`flowButton\\('${step}'`));
  assert.match(css,/\.opportunity-stage-page\{box-sizing:border-box;width:100vw;height:100dvh;isolation:isolate/);
});

test('leaving the Opportunity removes any owned stage page',()=>{
  assert.match(app,/querySelectorAll\('\[data-opportunity-stage-owner\]'\)/);
  assert.match(app,/page\.dataset\.opportunityStageOwner===String\(state\.id\)\)page\.remove\(\)/);
});
