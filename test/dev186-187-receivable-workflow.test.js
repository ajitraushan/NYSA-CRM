import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const route=read('src/commission-receivables.js');
const ui=read('public/receivables-ui.js');
const css=read('public/index.html');
const migration=read('src/migrations/118_dev186_187_receivable_workflow.sql');
const access=read('src/accountant-access.js');

test('CRM-186 generates an immutable annual invoice reference and invoice date on issue',()=>{
  assert.match(route,/commission_invoice_number_counters/);
  assert.match(route,/NYSA-INV-\$\{year\}-\$\{String\(counter\.lastNumber\)\.padStart\(6,'0'\)\}/);
  assert.match(route,/const invoiceDate=dubaiToday\(\)/);
  assert.doesNotMatch(ui,/input\('invoiceReference'/);
  assert.doesNotMatch(ui,/input\('invoiceDate'/);
  assert.match(ui,/Generate invoice/);
});

test('CRM-186 presents scalable dark register with an in-page receivable workspace',()=>{
  assert.match(ui,/Closed Opportunity → commission due → invoice → payment realization/);
  assert.match(ui,/ar-stage-strip/);
  assert.match(ui,/id="ar-overview"/);
  assert.match(ui,/class="ar-workspace"/);
  assert.match(css,/\.receivables-dark\{/);
  assert.match(css,/background:radial-gradient\(circle at 88% 0,rgba\(92,108,132,\.18\),transparent 34%\),#171d26/);
  assert.match(css,/\.ar-workspace\{/);
  assert.doesNotMatch(css,/\.ar-drawer\{position:fixed/);
  assert.match(ui,/pipeline-table-wrap/);
});

test('CRM-187 limits direct cancellation to unissued instalments',()=>{
  assert.match(route,/item\.state!==['"]planned['"]/);
  assert.match(route,/Issued invoices require an Accountant request and MD approval/);
  assert.match(ui,/Cancel this unissued instalment/);
});

test('CRM-187 routes issued invoice cancellation and amendment from Accountant to MD',()=>{
  assert.match(route,/Only the Accountant may request/);
  assert.match(route,/Only the MD\/Director may approve or reject/);
  assert.match(route,/requestType.*cancel.*amend/s);
  assert.match(route,/replacementInvoiceId/);
  assert.match(route,/replaces_invoice_id/);
  assert.match(route,/superseded_by_invoice_id IS NOT NULL THEN 'superseded'/);
  assert.match(ui,/Send to MD for approval/);
  assert.match(ui,/Invoice approvals/);
  assert.match(access,/adjustment-requests/);
  assert.doesNotMatch(route,/credit note/i);
});

test('CRM-187 migration retains immutable request and replacement lineage',()=>{
  assert.match(migration,/commission_receivable_adjustment_requests/);
  assert.match(migration,/commission_receivable_one_pending_adjustment_uq/);
  assert.match(migration,/protect_receivable_adjustment_request/);
  assert.match(migration,/replaces_invoice_id/);
  assert.match(migration,/superseded_by_invoice_id/);
});
