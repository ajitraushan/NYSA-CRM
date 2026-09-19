import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptAmount} from '../public/money-input.js';
test('Receipt amount accepts exact plain, grouped, K and M values without rounding cents',()=>{
  for(const [value,expected] of [[100,100],['100K',100000],['100k',100000],['2.5k',2500],['1.5M',1500000],['.5m',500000],[' 2.25 K ',2250],['100,000.25',100000.25],['1.23456K',1234.56],['0.01',.01]])
    assert.equal(parseReceiptAmount(value),expected,String(value));
});
test('Receipt amount rejects malformed, nonpositive, imprecise and unsafe amounts',()=>{
  for(const value of ['',null,0,'0K','-1M','1e5','100abc','12,34','1.2.3','1KM','Infinity','1.001','0.000001K','999999999999999999999999M'])
    assert.throws(()=>parseReceiptAmount(value),undefined,String(value));
});
