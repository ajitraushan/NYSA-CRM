import test from 'node:test';
import assert from 'node:assert/strict';
import {commissionDateText,reconcileCommissionReceipt,workingDayDeadline,receiptQuarterKey} from '../src/commission-payout-domain.js';

test('Commission receipt dates preserve PostgreSQL local calendar dates through reconciliation',()=>{
  const date=new Date(2026,8,2);
  assert.equal(commissionDateText(date),'2026-09-02');
  const result=reconcileCommissionReceipt({expectedCompanyReceipt:100,receipts:[{id:'receipt',entryType:'receipt',amount:100,receivedDate:date}]});
  assert.equal(result.receiptDate,'2026-09-02');assert.equal(result.varianceAmount,0);
  assert.equal(workingDayDeadline(date).receiptDate,'2026-09-02');
  assert.equal(workingDayDeadline(date).releaseDueDate,'2026-09-07');
  assert.equal(receiptQuarterKey(date),'2026-Q3');
});
test('Invalid receipt calendar dates cannot reach a database DATE insert',()=>{
  assert.throws(()=>reconcileCommissionReceipt({expectedCompanyReceipt:1,receipts:[{id:'bad',entryType:'receipt',amount:1,receivedDate:'2026-02-30'}]}),/valid date/);
});
