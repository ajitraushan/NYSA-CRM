import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentSplit} from '../src/receivables-domain.js';
test('Partial invoice payments allocate exact net/VAT and finish at invoice totals',()=>{
  assert.deepEqual(paymentSplit({totalCents:1050000,commissionCents:1000000},262500),{netCommissionCents:250000,vatCents:12500});
  for(const commissionCents of [1,10,3333,1000000,999999999999]){
    const totalCents=commissionCents+Math.floor((commissionCents*5+50)/100);
    let collectedCents=0,net=0,vat=0;
    for(const amount of [1,1,Math.floor(totalCents/3),totalCents]){
      const gross=Math.min(amount,totalCents-collectedCents);if(!gross)continue;
      const split=paymentSplit({totalCents,commissionCents,collectedCents},gross,net);
      assert.ok(split.netCommissionCents>=0&&split.vatCents>=0);
      assert.equal(split.netCommissionCents+split.vatCents,gross);
      net+=split.netCommissionCents;vat+=split.vatCents;collectedCents+=gross;
    }
    assert.equal(net,commissionCents);assert.equal(net+vat,totalCents);
  }
});
test('Allocation safely catches up after exact historical split reversal',()=>{
  assert.deepEqual(paymentSplit({totalCents:11,commissionCents:10,collectedCents:5},6,4),{netCommissionCents:6,vatCents:0});
  assert.deepEqual(paymentSplit({totalCents:11,commissionCents:10,collectedCents:10},1,10),{netCommissionCents:0,vatCents:1});
});
