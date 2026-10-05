import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commissionPayoutApprovedDocument} from '../src/commission-payout-sheet-pdf.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sample={receiptDate:'2026-09-05',quarterKey:'2026-Q3',currency:'AED',tierAgentName:'Synthetic Agent',propertySold:'Synthetic Tower - Unit 897',opportunityReference:'NYSA-OP-SYN-1',dealReference:'NYSA-DL-SYN-1',salePrice:2000000,dealGrossCommissionExVat:100000,grossCommissionReceivedExVat:23809.52,quarterGrossCumulative:17857.14,agentCommissionSharePercent:75,achievedRate:55,commissionAmount:9821.43,tierAdjustment:0,totalCommission:9821.43,alreadyPaid:0};

test('register sources total Deal commission and discloses a partial receipt tranche',()=>{
  const route=read('../src/routes/commission-payout.js'),ui=read('../public/commission-payout-ui.js');
  assert.match(route,/expectation\.expected_gross_amount AS deal_gross_commission_ex_vat/);
  assert.match(ui,/Total Deal Commission — Excluding VAT/);
  assert.match(ui,/Company Gross Commission Received — Excluding VAT/);
  assert.match(ui,/Commission Received in This Tranche \(%\)/);
  assert.match(ui,/received\/total\*100/);
  assert.match(ui,/Partial payment/);
});

test('approved payout mapping shows the total Deal commission and tranche percentage',()=>{
  const approved=commissionPayoutApprovedDocument({agent:'Synthetic Agent',quarter:'2026-Q3',rows:[sample],generatedDate:'2026-09-15'}),row=approved.rows[0];
  assert.equal(row.dealCommission,'100,000.00');assert.equal(row.grossReceived,'23,809.52');assert.equal(row.tranche,'23.81%');assert.match(row.references,/NYSA-OP-SYN-1/);
});
