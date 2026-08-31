import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('CUSTOMER-REGISTER-49 preserves the selected server sort for the returned twenty-five Customers',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  assert.match(crm,/ORDER BY array_position\(\$1::uuid\[\],c\.id\)/);
  assert.match(crm,/pageSize=Math\.min\(100,Math\.max\(1,[\s\S]*\|\|25\)\)/);
});

test('CUSTOMER-REGISTER-49 defaults to newest and resets all filters with an immediate reload',()=>{
  const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(ui,/option value="newest" selected>Most recently created/);
  assert.match(ui,/reset\.textContent='Reset filters'/);
  assert.match(ui,/reset\.addEventListener\('click',[\s\S]*customer-q'[\s\S]*customer-kyc'[\s\S]*customer-duplicate'[\s\S]*customer-sort'\)\.value='newest';restart\(\)/);
  assert.match(ui,/await renderCustomers\(\);showCustomerConfirmation/);
});
