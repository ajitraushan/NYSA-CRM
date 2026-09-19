import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountantRequestAllowed} from '../src/accountant-access.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';

test('Accountant can prepare, submit and record approved commission payments but cannot approve',()=>{
  const actor={jobRole:'accountant'};
  assert.equal(accountantRequestAllowed(actor,'GET','/api/finance/agent-payouts'),true);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/deal-agent-credit-lines/${id}/payout/calculate`),true);
  assert.equal(accountantRequestAllowed(actor,'POST','/api/finance/commission-payment-batches'),true);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/agent-payout-calculations/${id}/release`),false);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/commission-payment-batches/${id}/release`),true);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/commission-payment-batches/${id}/decision`),false);
});

test('Commission Payments uses consolidated selectable MD approval',()=>{
  const ui=read('public/commission-payout-ui.js');
  assert.match(ui,/Commission Payments/);
  assert.match(ui,/data-submit-calculation/);
  assert.match(ui,/Send selected to MD/);
  assert.match(ui,/data-batch-calculation/);
  assert.match(ui,/data-select-batch-all/);
  assert.match(ui,/Approve selected payments/);
  assert.match(ui,/Deselected|remain pending/i);
});

test('Batch routes preserve role separation and deferred rows',()=>{
  const route=read('src/routes/commission-payout.js');
  assert.match(route,/commission-payment-batches/);
  assert.match(route,/if\(!accountant\(req\.broker\)\).*submit commission payments/);
  assert.match(route,/if\(!director\(req\.broker\)\).*MD approval access required/);
  assert.match(route,/THEN 'approved' ELSE 'deferred'/);
  assert.match(route,/MD approval is required before recording payment/);
});

test('Invoice payment automatically creates confirmation and instalment credit basis',()=>{
  const posting=read('src/receivable-receipt-posting.js'),migration=read('src/migrations/120_commission_payment_batches.sql');
  assert.match(posting,/confirmed_from_invoice_payment/);
  assert.match(posting,/created_from_invoice_payment/);
  assert.match(posting,/source_collection_id/);
  assert.match(migration,/deal_agent_credit_collection_uq/);
  assert.match(migration,/commission_payment_one_active_batch_item/);
});

test('Navigation calls the shared Commission Payments table for Accountant and MD',()=>{
  const shell=read('public/app.js'),accountant=read('public/accountant-workspace-ui.js');
  assert.match(shell,/data-tab="payout">Commission Payments/);
  assert.match(shell,/financeReceipts' \? window\.renderCommissionPayments/);
  assert.match(accountant,/financeReceipts',label:'Commission Payments'/);
  assert.doesNotMatch(accountant,/Open Finance Receipts/);
});
