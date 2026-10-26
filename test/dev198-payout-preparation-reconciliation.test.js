import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateRealtimePayout} from '../src/commission-payout-domain.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const slabs=[
  {displayOrder:1,lowerAmount:0,upperAmount:100000,agentPercent:55},
  {displayOrder:2,lowerAmount:100000,upperAmount:200000,agentPercent:60},
  {displayOrder:3,lowerAmount:200000,upperAmount:300000,agentPercent:65},
  {displayOrder:4,lowerAmount:300000,upperAmount:400000,agentPercent:70},
  {displayOrder:5,lowerAmount:400000,upperAmount:null,agentPercent:75}
];

test('75/25 preparation reconciles the persisted band and preserves the full company receipt',()=>{
  const calculation=calculateRealtimePayout({agentId:'synthetic-servicing-agent',tierAgentId:'synthetic-executing-agent',dealReference:'NYSA-DL-SYN-198',receiptDate:'2026-09-05',priorGrossCommissionAmount:0,currentGrossCommissionAmount:23809.52,agentSharePercent:75,priorAgentCommissionBasisAmount:0,priorBasePayoutAmount:0,triggerMethod:'quarter_achieved_rate',slabs,policyVersionId:'synthetic-policy'}),band=calculation.bands[0];
  assert.equal(calculation.currentGrossCommissionAmount,23809.52);
  assert.equal(calculation.currentCreditedAmount,17857.14);
  assert.equal(calculation.agentSharePercent,75);
  assert.equal(calculation.agentPayoutAmount,9821.43);
  assert.equal(band.grossPortionAmount,23809.52);
  assert.equal(band.portionAmount,17857.14);
  assert.equal(band.portionAmount,band.agentPayoutAmount+band.companyRetainedAmount);
});

test('prepare route persists the reconciled Agent basis and keeps company gross separately',()=>{
  const route=read('src/routes/commission-payout.js'),domain=read('src/commission-payout-domain.js');
  assert.match(domain,/grossPortionAmount:currentGross,portionAmount:current/);
  assert.match(route,/band\.portionAmount,band\.agentPercent,band\.agentPayoutAmount,band\.companyRetainedAmount/);
  assert.match(route,/currentGrossCommissionAmount:line\.confirmedActualReceived,agentSharePercent:line\.totalCreditPercent/);
});

test('legacy display reads the immutable collection gross and frozen Deal split',()=>{
  const route=read('src/routes/commission-payout.js'),ui=read('public/commission-payout-ui.js');
  assert.match(route,/collection\.net_commission_cents\/100\.0,p\.current_gross_commission_amount,credit\.confirmed_actual_received/);
  assert.match(route,/line\.total_credit_percent AS agent_commission_share_percent/);
  assert.match(ui,/grossCommissionReceivedExVat\?\?row\.currentGrossCommissionAmount\?\?row\.currentCreditedAmount/);
  assert.match(ui,/agentCommissionSharePercent\?\?p\.agentSharePercent\?\?100/);
});

test('print and attachment PDF omit the rejected explanatory paragraph',()=>{
  const pdf=read('src/commission-payout-sheet-pdf.js');
  for(const text of ['Company Gross commission means','When a Deal crosses a tier','Any retrospective increase is shown adjusted'])assert.doesNotMatch(pdf,new RegExp(text));
});
