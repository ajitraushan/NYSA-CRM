import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('creating and viewing a Value Brief preserve the Lead workspace',()=>{
  const viewer=app.slice(app.indexOf('async function openValueBriefs'),app.indexOf('/* ============ LISTINGS ============ */'));
  assert.doesNotMatch(viewer,/parent\?\.remove\(\)/);
  assert.match(app,/openValueBriefForm\(lead,listings,o\)/);
  assert.match(app,/openValueBriefs\(lead,o\)/);
  assert.match(app,/Value brief created'[\s\S]*o\.remove\(\);openValueBriefs\(lead,parent\)/);
});
