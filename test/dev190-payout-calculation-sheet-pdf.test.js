import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeCommissionPayoutSheetPdf} from '../src/commission-payout-sheet-pdf.js';
import {buildQuarterPayoutStatement} from '../src/commission-payout-domain.js';
import {accountantRequestAllowed} from '../src/accountant-access.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const agentId='11111111-1111-4111-8111-111111111111';
const rows=[{receiptDate:'2026-07-05',quarterKey:'2026-Q3',opportunityReference:'NYSA-OP-202607-000001',dealReference:'NYSA-DL-202607-000001',propertySold:'NYSA-INV-000101 · Synthetic Tower · Unit 1204',salePrice:10000000,dealGrossCommissionExVat:200000,grossCommissionReceivedExVat:100000,quarterGrossCumulative:100000,agentCommissionSharePercent:75,agentRoleSplit:'Servicing 75.00%',eligibleCommissionPool:55000,currentCreditedAmount:75000,resultingCumulativeAmount:75000,achievedRate:55,currentDealPayout:41250,quarterTrueUpAmount:0,agentPayoutAmount:41250}];

test('NYSA Agent-quarter payout calculation sheet is a printable PDF containing the Opportunity calculation',()=>{
  const statement=buildQuarterPayoutStatement(rows.map(row=>({...row,releasedAmount:0})));
  const pdf=makeCommissionPayoutSheetPdf({agent:'Synthetic Agent',quarter:'2026-Q3',currency:'AED',rows:statement.rows,summary:statement.summary,organization:{displayName:'NYSA Realty',proposalFooter:'NYSA Realty | Internal'},generatedDate:'2026-09-05'});
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  const text=pdf.toString('latin1');
  assert.match(text,/\/MediaBox \[0 0 842 595\]/);
  for(const expected of ['AGENT PAYOUT CALCULATION SHEET','Synthetic Agent','NYSA-OP-202607-000001','Unit particulars','Internal ref no','Sale Price','Company Gross','Commission','Received','Cumulative','Agent','Share','Split','Tier','Adjustment','Total','Already Paid','10,000,000.00','AED 100,000.00','55.00%','75.00%','41.25%','AED 41,250.00'])assert.match(text,new RegExp(expected));
});

test('calculation-sheet route sources the transparent commission chain from immutable Deal and credit records',()=>{
  const route=read('src/routes/commission-payout.js');
  assert.match(route,/d\.agreed_value AS sale_price/);
  assert.match(route,/AS property_sold/);
  assert.match(route,/expectation\.expected_gross_amount AS deal_gross_commission_ex_vat/);
  assert.match(route,/COALESCE\(collection\.net_commission_cents\/100\.0,p\.current_gross_commission_amount,credit\.confirmed_actual_received\) AS gross_commission_received_ex_vat/);
  assert.match(route,/line\.total_credit_percent AS agent_commission_share_percent/);
  assert.match(route,/AS quarter_gross_cumulative/);
  assert.match(route,/row\.eligibleCommissionPool/);
});

test('Accountant may print or download only the scoped Agent-quarter calculation document',()=>{
  const actor={jobRole:'accountant'};
  assert.equal(accountantRequestAllowed(actor,'GET',`/api/finance/agent-payouts/${agentId}/quarters/2026-Q3/document`),true);
  assert.equal(accountantRequestAllowed(actor,'POST',`/api/finance/agent-payouts/${agentId}/quarters/2026-Q3/document`),false);
  const route=read('src/routes/commission-payout.js'),ui=read('public/commission-payout-ui.js');
  assert.match(route,/makeCommissionPayoutSheetPdf/);assert.match(route,/Content-Disposition/);
  assert.match(ui,/Print \/ view NYSA PDF/);assert.match(ui,/Download email attachment/);assert.match(ui,/row\.opportunityReference/);
});
