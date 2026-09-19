import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Migration 114 removes only the receipt closure trigger, preserving finance records and constraints',()=>{
  const sql=read('src/migrations/114_commission_independent_transaction_closure.sql');
  assert.match(sql,/DROP TRIGGER IF EXISTS deals_commission_receipt_close_gate ON deals/);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|UPDATE\s+\w+\s+SET|DISABLE TRIGGER/i);
});

test('migration 088 adds complete commission receipt credit payout chain',()=>{const sql=read('src/migrations/088_release5_commission_receipt_realtime_payout.sql');for(const marker of ['commission_payout_policy_versions','agent_payout_adjustment_versions','deal_commission_expectation_versions','deal_commission_receipts','deal_commission_receipt_confirmations','deal_agent_credit_versions','deal_agent_credit_lines','agent_payout_calculations','agent_payout_calculation_bands','agent_payout_release_events'])assert.match(sql,new RegExp(marker));});
test('historical migration 088 documents the superseded receipt-before-closure rule',()=>{const sql=read('src/migrations/088_release5_commission_receipt_realtime_payout.sql');assert.match(sql,/enforce_commission_receipt_before_close_won/);assert.match(sql,/Confirmed actual commission receipt is required before Close Won/);assert.match(sql,/deals_commission_receipt_close_gate/);});
test('migration freezes existing Deal split percentages in credit version',()=>{const sql=read('src/migrations/088_release5_commission_receipt_realtime_payout.sql');assert.match(sql,/source_originating_split_percent/);assert.match(sql,/source_servicing_split_percent/);assert.match(sql,/source_originating_split_percent\+source_servicing_split_percent=100/);});
test('route uses existing Deal split fields and has no standard client split input',()=>{const source=read('src/routes/commission-payout.js');for(const marker of ['o.originating_agent_split_percent','o.servicing_agent_split_percent','originatingAgentSplitPercent:deal.originatingAgentSplitPercent','servicingAgentSplitPercent:deal.servicingAgentSplitPercent','frozen_from_deal_split'])assert.match(source,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.doesNotMatch(source,/req\.body\?\.originatingAgentSplitPercent|req\.body\?\.servicingAgentSplitPercent/);});
test('Close Won keeps transaction gates and no longer depends on commission receipt',()=>{
  const source=read('src/routes/opportunities.js').split("r.post('/crm/deals/:dealId/close-won'")[1].split("r.post('/crm/deals/:dealId/close-lost'")[0];
  assert.doesNotMatch(source,/commissionReceiptReady|deal_commission_receipt_confirmations|Confirmed actual commission receipt is required/);
  for(const marker of ['canApproveDeal','requireDocumentComplianceGates','Closure records are not aligned','expectedVersion',"deal.status!=='approved'"])
    assert.ok(source.includes(marker),marker);
});
test('payout APIs reserve consolidated approval for the exact Director job role',()=>{const source=read('src/routes/commission-payout.js');assert.match(source,/director=broker=>mayViewPayoutWorkspace\(broker\)/);assert.match(source,/commission-payment-batches\/:batchId\/decision'.*if\(!director\(req\.broker\)\)/);assert.match(source,/MD approval access required/);assert.match(read('src/commission-payout-domain.js'),/broker\?\.jobRole==='director'/);});
test('Accountant and MD share the selectable Commission Payments table',()=>{const app=read('public/app.js'),ui=read('public/commission-payout-ui.js');assert.match(app,/ME\.jobRole === 'director' \? '<button data-tab="payout">Commission Payments<\/button>'/);for(const marker of ['FINANCE · COMMISSION PAYMENTS','Prepare payment rows','Send selected to MD','Approve selected payments','Approved commission payments','Record batch payment'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('Admin UI maintains company slabs without exposing actual payouts',()=>{const ui=read('public/commission-payout-ui.js');for(const marker of ['Commission and payout policy','Company default slabs','Individual-agent adjustments','Agent social-media eligibility is maintained separately','Activate directly'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('bootstrap loads payout UI and server mounts payout routes',()=>{assert.match(read('public/bootstrap.js'),/commission-payout-ui\.js/);assert.match(read('src/server.js'),/commissionPayoutRoutes/);});
test('package contains no bank calendar, weekend maintenance or external payment call',()=>{const combined=[read('src/commission-payout-domain.js'),read('src/routes/commission-payout.js'),read('public/commission-payout-ui.js')].join('\n');assert.doesNotMatch(combined,/bank_working_calendar|holiday_calendar|fetch\(['"]https?:|axios|payment gateway/i);assert.match(combined,/weekendDays:\['Saturday','Sunday'\]/);});
test('Deal workspace exposes receipt readiness but keeps calculated payout Director-only',()=>{const deal=read('public/deal-ui.js'),ui=read('public/commission-payout-ui.js');assert.match(deal,/dealCommissionWorkspaceHTML/);assert.match(deal,/bindDealCommissionWorkspace/);for(const marker of ['Commission and collection','Existing Deal split','Actual receipt','Receipt status:','Calculated payout remains in Director-only Payout'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
