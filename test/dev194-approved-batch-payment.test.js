import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountantRequestAllowed} from '../src/accountant-access.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';

test('Accountant may record one approved batch payment but MD approval remains separate',()=>{
  const actor={jobRole:'accountant'};
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/commission-payment-batches/${id}/release`),true);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/commission-payment-batches/${id}/decision`),false);
});

test('approved payment UI aggregates by batch with expandable row details and one action',()=>{
  const ui=read('public/commission-payout-ui.js');
  for(const marker of ['One row per MD-approved batch','approvedBatches','approvedBatchRows','View details','Batch payable','Record batch payment','data-record-batch-payment'])assert.match(ui,new RegExp(marker));
  assert.doesNotMatch(ui,/data-record-agent-payment/);
});

test('batch release is atomic, auditable and excludes deferred rows',()=>{
  const route=read('src/routes/commission-payout.js');
  assert.match(route,/commission-payment-batches\/:batchId\/release/);
  assert.match(route,/bi\.status='approved' FOR UPDATE OF bi,p/);
  assert.match(route,/UPDATE agent_payout_calculations SET status='released'/);
  assert.match(route,/UPDATE commission_payment_batch_items SET status='paid'/);
  assert.match(route,/payment_status='paid'/);
  assert.match(route,/paid_by_accountant/);
  assert.match(route,/paymentDate>today/);
  assert.match(route,/paymentDate<dubaiCalendarDate\(batch\.decidedAt\)/);
  assert.match(route,/timeZone:'Asia\/Dubai'/);
});

test('migration records the batch payment state and idempotency key',()=>{
  const sql=read('src/migrations/124_commission_payment_batch_release.sql');
  for(const marker of ['payment_status','payment_date','payment_reference','payment_idempotency_key','paid_by','paid_at','commission_payment_batch_payment_state_ck'])assert.match(sql,new RegExp(marker));
});

test('payout PDF uses the connected Excel-style property, sale and tier-adjustment columns',()=>{
  const route=read('src/routes/commission-payout.js'),pdf=read('src/commission-payout-sheet-pdf.js');
  assert.match(route,/d\.agreed_value AS sale_price/);
  assert.match(route,/AS property_sold/);
  for(const marker of ['Unit particulars / Project','Sale Price','Agent Share','Split required','Commission after split','Tier Adjustment','Total Commission','Already Paid'])assert.match(pdf,new RegExp(marker));
  assert.doesNotMatch(pdf,/Opportunity amount|True-up/);
});
