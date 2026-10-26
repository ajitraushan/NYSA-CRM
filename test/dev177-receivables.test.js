import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceAmounts,invoiceState,moneyCents,dateOnly,scheduleInput} from '../src/receivables-domain.js';
test('Receivables calculate requested 5% VAT in integer fils per invoice',()=>{
  assert.deepEqual(invoiceAmounts('10000.00'),{commissionCents:1000000,vatCents:50000,totalCents:1050000});
  assert.equal(invoiceAmounts('0.10').vatCents,1);
  assert.equal(invoiceAmounts('33.33').vatCents,167);
  for(const value of ['1.001','-1','NaN','Infinity','1e4','',null])assert.throws(()=>moneyCents(value));
  assert.throws(()=>invoiceAmounts('0'));
  assert.equal(moneyCents('100K'),10000000);
  assert.equal(moneyCents('1.5M'),150000000);
  assert.equal(moneyCents('40,000.25'),4000025);
  assert.throws(()=>moneyCents('10B'));
  assert.throws(()=>moneyCents('10000000000'));
  assert.throws(()=>moneyCents('0.000001K'));
});
test('Receivables reject invalid dates and non-reconciling schedules',()=>{
  for(const date of ['2026-02-29','2026-02-30','2026-13-01','2026-9-2'])assert.throws(()=>dateOnly(date));
  assert.equal(dateOnly('2028-02-29'),'2028-02-29');
  const body={payerType:'developer',payerId:'payer',opportunityId:'opp',commissionAmount:'100',instalments:[{commissionAmount:'40',dueDate:'2026-09-02'},{commissionAmount:'60',dueDate:'2026-10-02'}]};
  assert.equal(scheduleInput(body).instalments.length,2);
  assert.throws(()=>scheduleInput({...body,commissionAmount:101}),/must equal/);
  assert.throws(()=>scheduleInput({...body,instalments:[]}),/1 and 60/);
  assert.throws(()=>scheduleInput({...body,payerType:'other'}));
});
test('Status and overdue are derived from issued amount and actual collection, not navigation',()=>{
  const row={state:'issued',totalCents:10500,commissionCents:10000,vatCents:500,dueDate:'2026-09-01'};
  assert.equal(invoiceState(row,'2026-09-02').status,'unpaid');
  assert.equal(invoiceState({...row,collectedCents:5000},'2026-09-02').status,'part_paid');
  assert.equal(invoiceState({...row,collectedCents:5000},'2026-09-02').overdue,true);
  assert.equal(invoiceState({...row,collectedCents:10500},'2026-09-02').overdue,false);
  assert.equal(invoiceState({...row,collectedCents:10500}).status,'paid');
  assert.equal(invoiceState({...row,state:'planned'},'2026-09-02').status,'scheduled');
  assert.equal(invoiceState({...row,state:'planned'},'2026-09-02').overdue,false);
  assert.equal(invoiceState({...row,state:'cancelled'}).balanceCents,0);
});
