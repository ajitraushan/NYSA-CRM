import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('CRM-186 blocks future receipts and dates before invoice, without using due date as a boundary',()=>{
  const route=read('src/commission-receivables.js');
  assert.match(route,/Payment realization date cannot be earlier than the invoice date/);
  assert.match(route,/Payment realization date cannot be in the future/);
  assert.match(route,/date the cheque cleared or the cash\/bank payment was received/);
  assert.doesNotMatch(route,/receivedDate>item\.dueDate/);
  assert.doesNotMatch(route,/Receipt date must be between the invoice date and today/);
});

test('CRM-186 leaves receipt date blank, constrains it from invoice date through today and renders errors in red',()=>{
  const ui=read('public/receivables-ui.js'),html=read('public/index.html');
  assert.match(ui,/min="\$\{safe\(i\.invoiceDate\)\}" max="\$\{dubaiToday\(\)\}" required/);
  assert.doesNotMatch(ui,/value="\$\{dubaiToday\(\)\}"/);
  assert.match(ui,/Payment realization date \*/);
  assert.match(ui,/classList\.add\('receivable-form-error'\)/);
  assert.match(ui,/setAttribute\('role','alert'\)/);
  assert.match(ui,/receiptDate\.addEventListener\('input',validateReceiptDate\)/);
  assert.match(ui,/receiptDate\.setCustomValidity\(message\)/);
  assert.match(html,/\.receivable-form-error\{[^}]*var\(--danger\)/);
});
