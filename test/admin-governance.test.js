import test from 'node:test';
import assert from 'node:assert/strict';
import { stableCodeError,timeToMinutes,minutesToTime,DASHBOARD_METRICS,validateFeeItems,calculateFeeItems,validateProposalConfiguration } from '../src/admin-governance.js';

test('controlled-value stable codes enforce lowercase snake_case',()=>{
  assert.equal(stableCodeError('loss_reason'),null);
  assert.match(stableCodeError('Loss_Reason'),/lowercase snake_case/);
  assert.match(stableCodeError('loss reason'),/lowercase snake_case/);
  assert.match(stableCodeError(''),/required/);
});

test('business time selectors convert exactly to stored SLA minutes',()=>{
  assert.equal(timeToMinutes('09:00'),540);assert.equal(timeToMinutes('18:30'),1110);
  assert.equal(minutesToTime(540),'09:00');assert.equal(minutesToTime(1110),'18:30');
  assert.equal(timeToMinutes('25:00'),null);
});

test('structured percentage fixed and tiered fees calculate deterministically',()=>{
  const items=[
    {code:'transfer_fee',label:'Transfer fee',calculationType:'percentage',ratePercent:4},
    {code:'admin_fee',label:'Administration fee',calculationType:'fixed',amount:5000},
    {code:'tiered_fee',label:'Tiered fee',calculationType:'tiered',tiers:[{from:0,to:500000,ratePercent:1},{from:500000,to:null,ratePercent:2}]}
  ];
  assert.equal(validateFeeItems(items),null);
  const result=calculateFeeItems(items,1000000);
  assert.deepEqual(result.values,{transfer_fee:40000,admin_fee:5000,tiered_fee:15000});assert.equal(result.total,60000);
  assert.match(validateFeeItems([{code:'Bad Code',label:'Bad',calculationType:'fixed',amount:1}]),/lowercase snake_case/);
});

test('proposal designer validates curated mapped and agent-input sections',()=>{
  const sections=[{code:'customer_name',label:'Customer name',source:'system',field:'contact.full_name',mandatory:true},{code:'highlights',label:'Highlights',source:'agent_input',mandatory:true}];
  assert.equal(validateProposalConfiguration({sections}),null);
  assert.match(validateProposalConfiguration({sections:[{code:'customer_name',label:'Customer',source:'system'}]}),/mapping/);
});

test('dashboard KPI catalogue owns units definitions and threshold direction',()=>{
  assert.equal(DASHBOARD_METRICS.sla_breaches.unit,'leads');assert.equal(DASHBOARD_METRICS.sla_breaches.direction,'high_bad');
  assert.match(DASHBOARD_METRICS.won_leads.definition,/Won/);
});
