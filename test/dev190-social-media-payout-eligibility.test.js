import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applySocialMediaPayoutBonus,calculateRealtimePayout} from '../src/commission-payout-domain.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const slabs=[
  {lowerAmount:0,upperAmount:100000,agentPercent:55},
  {lowerAmount:100000,upperAmount:200000,agentPercent:60},
  {lowerAmount:200000,upperAmount:300000,agentPercent:65},
  {lowerAmount:300000,upperAmount:400000,agentPercent:70},
  {lowerAmount:400000,upperAmount:null,agentPercent:75}
];

test('social-media increment applies only to the first three slabs',()=>{
  assert.deepEqual(applySocialMediaPayoutBonus(slabs,true).map(x=>x.agentPercent),[60,65,70,70,75]);
  assert.deepEqual(applySocialMediaPayoutBonus(slabs,false).map(x=>x.agentPercent),[55,60,65,70,75]);
});

test('calculation preserves the effective Agent eligibility evidence',()=>{
  const result=calculateRealtimePayout({agentId:'agent-1',dealReference:'NYSA-DL-TEST',receiptDate:'2026-09-05',
    priorCumulativeAmount:0,currentCreditedAmount:50000,triggerMethod:'attained_trigger',
    slabs:applySocialMediaPayoutBonus(slabs,true),policyVersionId:'policy-1',socialMediaStatusVersionId:'social-1',socialMediaBonusPercent:5});
  assert.equal(result.agentPayoutAmount,30000);
  assert.equal(result.socialMediaStatusVersionId,'social-1');
  assert.equal(result.socialMediaBonusPercent,5);
  assert.equal(result.quarterKey,'2026-Q3');
});

test('quarterly achieved rate records the prior-Deal difference on the crossing Deal',()=>{
  const result=calculateRealtimePayout({agentId:'agent-1',dealReference:'NYSA-DL-CROSS',receiptDate:'2026-09-05',
    priorCumulativeAmount:90000,currentCreditedAmount:20000,triggerMethod:'quarter_achieved_rate',slabs,policyVersionId:'policy-1'});
  assert.equal(result.agentPayoutAmount,16500);
  assert.equal(result.quarterTrueUpAmount,4500);
  assert.equal(result.companyRetainedAmount,3500);
});

test('crossing Deal only applies the achieved rate to the current Deal and leaves prior Deals untouched',()=>{
  const result=calculateRealtimePayout({agentId:'agent-1',dealReference:'NYSA-DL-CROSS',receiptDate:'2026-09-05',
    priorCumulativeAmount:90000,currentCreditedAmount:20000,triggerMethod:'attained_trigger',slabs,policyVersionId:'policy-1'});
  assert.equal(result.agentPayoutAmount,12000);
  assert.equal(result.quarterTrueUpAmount,0);
});

test('migration stores effective-dated status and calculation provenance',()=>{
  const sql=read('src/migrations/121_agent_social_media_payout_eligibility.sql');
  assert.match(sql,/CREATE TABLE agent_social_media_payout_status_versions/);
  assert.match(sql,/prevent_agent_social_media_status_overlap/);
  assert.match(sql,/social_media_status_version_id/);
  assert.match(sql,/social_media_bonus_percent/);
});

test('Admin can maintain Agent status and Accountant sees policy readiness before calculation',()=>{
  const admin=read('src/routes/admin.js'),route=read('src/routes/commission-payout.js'),ui=read('public/commission-payout-ui.js'),app=read('public/app.js');
  assert.match(admin,/\/admin\/users\/:id\/social-media-payout-status/);
  assert.match(admin,/Admin access is required/);
  assert.match(app,/Social-media payout eligibility/);
  assert.match(route,/policy_ready/);
  assert.match(route,/applySocialMediaPayoutBonus/);
  assert.match(ui,/Blocked — no active policy for receipt date/);
  assert.match(ui,/Gross received ex VAT/);
});

test('requested five-slab schedule is the draft form default but trigger method requires a decision',()=>{
  const ui=read('public/commission-payout-ui.js');
  for(const text of ['upperAmount:100000,agentPercent:55','lowerAmount:100000,upperAmount:200000,agentPercent:60','lowerAmount:200000,upperAmount:300000,agentPercent:65','lowerAmount:300000,upperAmount:400000,agentPercent:70','lowerAmount:400000,upperAmount:null,agentPercent:75'])assert.match(ui,new RegExp(text));
  assert.match(ui,/<option value="">Select calculation method<\/option>/);
  assert.match(ui,/Option 1 — Quarterly achieved rate/);
  assert.match(ui,/Option 2 — Crossing Deal only/);
});

test('Commission Payments shows a unified calculation register with Agent-quarter documents and Opportunity-level transparency',()=>{
  const ui=read('public/commission-payout-ui.js');
  for(const heading of ['Commission payment register','Month','Unit particulars / Project','Internal ref no','Total Deal Commission','Company Gross Commission Received','Commission Received in This Tranche','Cumulative Commission','Agent Share','Split required','Commission after split','Commission Amount','Tier Adjustment','Total Commission','Already Paid'])assert.match(ui,new RegExp(heading));
  assert.match(ui,/row\.dealReference/);
  assert.match(ui,/first\.quarterKey/);
  assert.match(ui,/payoutMonth\(row\.receiptDate\)/);
});
