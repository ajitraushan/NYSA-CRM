import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('qualified Lead conversion uses a prominent dedicated action style',()=>{
  assert.match(app,/class="btn btn-primary opportunity-conversion-action" id="lead-opportunity">Create opportunity/);
  assert.doesNotMatch(app,/btn-primary btn-sm" id="lead-opportunity"/);
  assert.match(html,/\.opportunity-conversion-action\{[^}]*min-height:44px[^}]*font-size:18\.4px/);
});
