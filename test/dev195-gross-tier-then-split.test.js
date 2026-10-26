import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRealtimePayout} from '../src/commission-payout-domain.js';

const slabs=[
  {lowerAmount:0,upperAmount:100000,agentPercent:55},
  {lowerAmount:100000,upperAmount:200000,agentPercent:60},
  {lowerAmount:200000,upperAmount:300000,agentPercent:65},
  {lowerAmount:300000,upperAmount:400000,agentPercent:70},
  {lowerAmount:400000,upperAmount:null,agentPercent:75}
];
const calculate=overrides=>calculateRealtimePayout({agentId:'agent',dealReference:'NYSA-DL-TEST',currency:'AED',receiptDate:'2026-09-05',priorGrossCommissionAmount:0,currentGrossCommissionAmount:100000,agentSharePercent:100,priorAgentCommissionBasisAmount:0,priorBasePayoutAmount:0,triggerMethod:'attained_trigger',slabs,policyVersionId:'policy',...overrides});

test('AED 100,000 at 55% creates the Agent pool before the 75/25 Deal split',()=>{
  const servicing=calculate({agentSharePercent:75}),originating=calculate({agentSharePercent:25});
  assert.equal(servicing.currentGrossCommissionAmount,100000);
  assert.equal(servicing.bands[0].agentPercent,55);
  assert.equal(servicing.currentCreditedAmount,75000);
  assert.equal(servicing.agentPayoutAmount,41250);
  assert.equal(originating.agentPayoutAmount,13750);
  assert.equal(servicing.agentPayoutAmount+originating.agentPayoutAmount,55000);
});

test('tier threshold is tested on company gross, not the post-split amount',()=>{
  const result=calculate({currentGrossCommissionAmount:110000,agentSharePercent:75});
  assert.equal(result.resultingGrossCommissionAmount,110000);
  assert.equal(result.bands[0].agentPercent,60);
  assert.equal(result.currentCreditedAmount,82500);
  assert.equal(result.agentPayoutAmount,49500);
});

test('Option 1 Tier increase adjustment preserves each earlier Deal split',()=>{
  const first=calculate({currentGrossCommissionAmount:100000,agentSharePercent:25,triggerMethod:'quarter_achieved_rate'});
  const second=calculate({priorGrossCommissionAmount:100000,currentGrossCommissionAmount:100000,agentSharePercent:75,priorAgentCommissionBasisAmount:25000,priorBasePayoutAmount:first.agentPayoutAmount,triggerMethod:'quarter_achieved_rate'});
  assert.equal(first.agentPayoutAmount,13750);
  assert.equal(second.bands[0].agentPercent,60);
  assert.equal(second.currentCreditedAmount,75000);
  assert.equal(second.quarterTrueUpAmount,1250);
  assert.equal(second.agentPayoutAmount,46250);
  assert.equal(first.agentPayoutAmount+second.agentPayoutAmount,60000);
});

test('route stores the governed gross-tier-then-split basis without rewriting legacy rows',()=>{
  const route=readFileSync(new URL('../src/routes/commission-payout.js',import.meta.url),'utf8'),migration=readFileSync(new URL('../src/migrations/125_agent_payout_gross_tier_then_split.sql',import.meta.url),'utf8');
  for(const marker of ['currentGrossCommissionAmount:line.confirmedActualReceived','agentSharePercent:line.totalCreditPercent','priorAgentCommissionBasisAmount','priorBasePayoutAmount','calculation_basis_version','current_gross_commission_amount','agent_share_percent'])assert.match(route,new RegExp(marker));
  assert.match(migration,/legacy_split_then_tier/);
  assert.match(migration,/gross_tier_then_split_v1/);
  assert.doesNotMatch(migration,/UPDATE agent_payout_calculations/);
});

