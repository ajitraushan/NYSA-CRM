import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('R3A-NAV-ORDER-46D presents the customer-centred primary workspace sequence',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const markers=['data-tab="dashboard"','data-tab="diary"','data-tab="customers"','data-tab="crm"','data-tab="listings"','data-tab="opportunities"'];
  const positions=markers.map(marker=>app.indexOf(marker));
  assert.ok(positions.every(position=>position>=0));
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
  assert.ok(app.indexOf('id="assignment-queue-nav"')>app.indexOf('data-tab="opportunities"'));
});
