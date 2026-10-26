import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRealtimePayout} from '../src/commission-payout-domain.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const slabs=[
  {displayOrder:1,lowerAmount:0,upperAmount:100000,agentPercent:55},
  {displayOrder:2,lowerAmount:100000,upperAmount:200000,agentPercent:60},
  {displayOrder:3,lowerAmount:200000,upperAmount:300000,agentPercent:65},
  {displayOrder:4,lowerAmount:300000,upperAmount:400000,agentPercent:70},
  {displayOrder:5,lowerAmount:400000,upperAmount:null,agentPercent:75}
];

test('payout uses only gross commission credited to NYSA, not full Deal commission or sale price',()=>{
  const common={agentId:'agent-1',dealReference:'NYSA-DL-SYN',currency:'AED',receiptDate:'2026-09-06',priorGrossCommissionAmount:0,priorAgentCommissionBasisAmount:0,priorBasePayoutAmount:0,triggerMethod:'quarter_achieved_rate',slabs,policyVersionId:'policy-1'};
  const servicing=calculateRealtimePayout({...common,currentGrossCommissionAmount:100000,agentSharePercent:75});
  const originating=calculateRealtimePayout({...common,agentId:'agent-2',currentGrossCommissionAmount:100000,agentSharePercent:25});
  assert.equal(servicing.resultingGrossCommissionAmount,100000);
  assert.equal(servicing.agentPayoutAmount,41250);
  assert.equal(originating.agentPayoutAmount,13750);
  assert.equal(servicing.agentPayoutAmount+originating.agentPayoutAmount,55000);
});

test('full Deal gross is disclosed separately while received commission drives the payout sheet',()=>{
  const route=read('../src/routes/commission-payout.js');
  const pdf=read('../src/commission-payout-sheet-pdf.js');
  const ui=read('../public/commission-payout-ui.js');
  assert.match(route,/expectation\.expected_gross_amount AS deal_gross_commission_ex_vat/);
  assert.match(route,/collection\.net_commission_cents\/100\.0,p\.current_gross_commission_amount,credit\.confirmed_actual_received\) AS gross_commission_received_ex_vat/);
  assert.match(route,/commission_receivable_collections collection ON collection\.id=credit\.source_collection_id/);
  assert.match(route,/eligibleCommissionPool=Number\(row\.grossCommissionReceivedExVat\)\*Number\(row\.achievedRate\)\/100/);
  assert.match(pdf,/Company Gross Commission Received/);
  assert.doesNotMatch(pdf,/Company Gross commission means the amount actually received by NYSA excluding VAT/);
  assert.doesNotMatch(pdf,/When a Deal crosses a tier, its new rate is bold/);
  assert.doesNotMatch(pdf,/Any retrospective increase is shown/);
  assert.match(ui,/Company Gross Commission Received/);
  assert.match(ui,/Cumulative Commission/);
  assert.match(ui,/grossCommissionReceivedExVat\?\?row\.currentGrossCommissionAmount\?\?row\.currentCreditedAmount/);
  assert.match(ui,/agentCommissionSharePercent\?\?p\.agentSharePercent\?\?100/);
});

test('executing Agent owns the tier and social uplift requires a 100 percent executing share',()=>{
  const route=read('../src/routes/commission-payout.js');
  const domain=read('../src/commission-payout-domain.js');
  const migration=read('../src/migrations/126_executing_agent_tier_and_social_uplift.sql');
  const ui=read('../public/commission-payout-ui.js');
  assert.match(route,/d\.owner_id AS executing_agent_id/);
  assert.match(route,/socialUpliftEligible=social\?\.status==='active'&&Number\(executingShare\.share\)===100/);
  assert.match(route,/agentId:line\.agentId,tierAgentId:line\.executingAgentId/);
  assert.match(route,/p\.tier_agent_id=\$1/);
  assert.match(route,/GROUP BY l\.credit_version_id/);
  assert.match(domain,/calculationBasisVersion:'executing_agent_received_gross_v1'/);
  assert.match(migration,/tier_agent_id UUID REFERENCES brokers/);
  assert.match(migration,/social_media_bonus_percent=0 OR social_media_uplift_eligible/);
  assert.match(ui,/Active, but no uplift because executing share is below 100%/);
  assert.match(ui,/Tier earned by/);
});
