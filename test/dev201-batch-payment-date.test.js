import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const route=readFileSync(new URL('../src/routes/commission-payout.js',import.meta.url),'utf8');

test('batch payment compares calendar dates in Dubai instead of a Date object string',()=>{
  assert.match(route,/const dubaiCalendarDate=/);
  assert.match(route,/today=dubaiCalendarDate\(new Date\(\)\)/);
  assert.match(route,/paymentDate<dubaiCalendarDate\(batch\.decidedAt\)/);
  assert.doesNotMatch(route,/String\(batch\.decidedAt\|\|''\)\.slice/);
});
