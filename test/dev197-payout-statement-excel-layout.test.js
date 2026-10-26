import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildQuarterPayoutStatement} from '../src/commission-payout-domain.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const row=(overrides={})=>({receiptDate:'2026-09-05',quarterKey:'2026-Q3',currency:'AED',agentName:'Synthetic Agent',tierAgentName:'Synthetic Agent',propertySold:'Synthetic Project · Unit 1',opportunityReference:'NYSA-OP-SYN-1',dealReference:'NYSA-DL-SYN-1',salePrice:2500000,currentGrossCommissionAmount:50000,resultingGrossCommissionAmount:50000,currentCreditedAmount:50000,agentCommissionSharePercent:100,agentSharePercent:100,achievedRate:55,quarterTrueUpAmount:0,agentPayoutAmount:27500,releasedAmount:0,status:'calculated',...overrides});

test('corrected Excel scenario allocates the 100k crossing adjustment to the earlier Deal',()=>{
  const statement=buildQuarterPayoutStatement([
    row({payoutReference:'PAY-1',releasedAmount:27500}),
    row({payoutReference:'PAY-2',opportunityReference:'NYSA-OP-SYN-2',dealReference:'NYSA-DL-SYN-2',salePrice:3000000,currentGrossCommissionAmount:60000,resultingGrossCommissionAmount:110000,currentCreditedAmount:45000,agentCommissionSharePercent:75,agentSharePercent:75,achievedRate:60,quarterTrueUpAmount:2500,agentPayoutAmount:29500}),
    row({payoutReference:'PAY-3',opportunityReference:'NYSA-OP-SYN-3',dealReference:'NYSA-DL-SYN-3',salePrice:2700000,currentGrossCommissionAmount:54000,resultingGrossCommissionAmount:164000,currentCreditedAmount:54000,achievedRate:60,agentPayoutAmount:32400})
  ]);
  assert.deepEqual(statement.rows.map(item=>({commission:item.commissionAmount,adjustment:item.tierAdjustment,total:item.totalCommission,paid:item.alreadyPaid,due:item.amountDue,tierChanged:item.tierChanged})),[
    {commission:27500,adjustment:2500,total:30000,paid:27500,due:2500,tierChanged:false},
    {commission:27000,adjustment:0,total:27000,paid:0,due:27000,tierChanged:true},
    {commission:32400,adjustment:0,total:32400,paid:0,due:32400,tierChanged:false}
  ]);
  assert.deepEqual(statement.summary,{totalCommissionEarned:89400,alreadyPaid:27500,tierAdjustmentDue:2500,toBePaid:61900,status:'Partially paid'});
});

test('actual release is split transparently between current Deal commission and earlier tier adjustment',()=>{
  const statement=buildQuarterPayoutStatement([
    row({payoutReference:'PAY-1',releasedAmount:27500}),
    row({payoutReference:'PAY-2',currentGrossCommissionAmount:60000,resultingGrossCommissionAmount:110000,currentCreditedAmount:45000,agentCommissionSharePercent:75,agentSharePercent:75,achievedRate:60,quarterTrueUpAmount:2500,agentPayoutAmount:29500,releasedAmount:27000})
  ]);
  assert.equal(statement.rows[0].alreadyPaid,27500);
  assert.equal(statement.rows[0].amountDue,2500);
  assert.equal(statement.rows[1].alreadyPaid,27000);
  assert.deepEqual(statement.summary,{totalCommissionEarned:57000,alreadyPaid:54500,tierAdjustmentDue:2500,toBePaid:2500,status:'Partially paid'});
});

test('screen and landscape PDF use the approved connected headers, full values and summary',()=>{
  const ui=read('../public/commission-payout-ui.js'),pdf=read('../src/commission-payout-sheet-pdf.js'),route=read('../src/routes/commission-payout.js');
  for(const label of ['Unit particulars / Project','Internal ref no','Sale Price','Total Deal Commission','Company Gross Commission Received','Commission Received in This Tranche (%)','Cumulative Commission','Agent Share (%)','Split required','Split %','Commission after split (%)','Commission Amount','Tier Adjustment','Total Commission','Already Paid']){
    assert.ok(ui.includes(label),`UI missing ${label}`);assert.ok(pdf.includes(label),`PDF missing ${label}`);
  }
  for(const label of ['Total Commission Earned','Already Paid','Tier Adjustment','To be Paid','Status']){assert.ok(ui.includes(label));assert.ok(pdf.includes(label));}
  assert.match(pdf,/width:842,height:595/);
  assert.match(pdf,/toLocaleString\('en-US'/);
  assert.match(pdf,/column===8&&row\.tierChanged/);
  assert.match(route,/buildQuarterPayoutStatement\(rows\)/);
  assert.match(route,/p\.agent_payout_amount-ROUND\(p\.current_credited_amount/);
  assert.doesNotMatch(route,/p\.agent_payout_amount-COALESCE\(\(SELECT SUM\(ROUND\(pb\.portion_amount/);
});
