import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const crm=read('src/routes/crm.js');

function leadCaptureSource(){
  return app.match(/async function openNewLeadForm\(preselectedCustomerId=null\)([\s\S]*?)\nasync function openLead\(/)?.[1]||'';
}

test('Customer Master lead creation resolves the exact scoped Customer by ID',()=>{
  const source=leadCaptureSource();
  assert.match(source,/api\(`\/crm\/customers\/\$\{encodeURIComponent\(preselectedCustomerId\)\}`\)/);
  assert.match(source,/preselectedCustomer=customerResponse\?\.customer\|\|null/);
  assert.match(source,/preselectedCustomer\.lifecycleStatus!==['"]active['"]/);
  assert.match(source,/\['not_required','approved'\]\.includes\(preselectedCustomer\.duplicateReviewStatus\)/);
  assert.doesNotMatch(source,/preselectedCustomerId\?contacts\.find/);
  assert.doesNotMatch(source,/api\(['"]\/crm\/contacts['"]\)/);
});

test('Lead customer search queries the full permitted register instead of a prefetched first page',()=>{
  const source=leadCaptureSource();
  const lookup=readFileSync(new URL('../public/customer-lookup-ui.js',import.meta.url),'utf8');
  assert.match(source,/installCustomerLookup/);
  assert.match(lookup,/pageSize:'25'/);
  assert.match(lookup,/api\('\/crm\/contacts\?'/);
  assert.match(lookup,/data-next/);
  assert.match(lookup,/passportLast4/);
  assert.doesNotMatch(source,/filter\(customer=>customerSearchText\(customer\)\.includes\(query\)\)/);
  assert.doesNotMatch(source,/\.slice\(0,12\)/);
});

test('server search applies partial and wildcard matching before its presentation limit',()=>{
  const route=crm.match(/r\.get\('\/crm\/contacts',[\s\S]*?\n\}\);/)?.[0]||'';
  assert.match(route,/replaceAll\('\*','%'\)/);
  assert.match(route,/c\.full_name ILIKE/);
  assert.match(route,/c\.email ILIKE/);
  assert.match(route,/c\.phone ILIKE/);
  assert.ok(route.indexOf('ILIKE')<route.indexOf('LIMIT $'),'database search must be applied before result pagination');
  assert.match(route,/OFFSET \$\$\{params\.length\+2\}/);
  assert.match(route,/COUNT\(\*\)::int AS count/);
});
