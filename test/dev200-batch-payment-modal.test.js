import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../public/commission-payout-ui.js',import.meta.url),'utf8');

test('approved batch payment uses an on-page governed form and no browser prompts',()=>{
  assert.match(ui,/Record consolidated batch payment/);
  assert.match(ui,/data-batch-payment-form/);
  assert.match(ui,/name="paymentDate" type="date"/);
  assert.match(ui,/name="paymentReference" required minlength="3"/);
  assert.match(ui,/name="paymentConfirmed" type="checkbox" required/);
  assert.match(ui,/data-batch-payment-error/);
  assert.doesNotMatch(ui,/const paymentDate=prompt\('Actual batch payment date/);
});

test('active payout tables show date-only values',()=>{
  assert.match(ui,/const dateOnly=value=>safe\(String\(value\|\|''\)\.slice\(0,10\)\)/);
  assert.match(ui,/dateOnly\(p\.releaseDueDate\)/);
  assert.doesNotMatch(ui,/<td>\$\{safe\(p\.releaseDueDate\)\}<\/td>/);
});

test('batch payment form submits one release request and refreshes after success',()=>{
  assert.match(ui,/commission-payment-batches\/\$\{encodeURIComponent\(batch\.id\)\}\/release/);
  assert.match(ui,/paymentDate:body\.paymentDate,paymentReference:body\.paymentReference,idempotencyKey:idempotency\(\)/);
  assert.match(ui,/dialog\.remove\(\);renderCommissionPayments\(\)/);
});
