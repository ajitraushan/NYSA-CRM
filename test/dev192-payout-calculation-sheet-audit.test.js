import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountantRequestAllowed} from '../src/accountant-access.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('payout calculation sheet document audit type is permitted by migration 123',()=>{
  const route=read('src/routes/commission-payout.js');
  const migration=read('src/migrations/123_agent_payout_calculation_sheet_audit.sql');
  assert.match(route,/audit\('AgentPayoutCalculationSheet'/);
  assert.match(migration,/DROP CONSTRAINT audit_log_entity_type_check/);
  assert.match(migration,/entity_type = ''AgentPayoutCalculationSheet''/);
});

test('print and attachment use the same corrected audited document route',()=>{
  const ui=read('public/commission-payout-ui.js');
  assert.match(ui,/Print \/ view NYSA PDF/);
  assert.match(ui,/Download email attachment/);
  assert.match(ui,/documentUrl\}\?download=1/);
});

test('commission payment tables provide bulk selection and aligned identifiers',()=>{
  const ui=read('public/commission-payout-ui.js');
  const html=read('public/index.html');
  for(const id of ['select-all-preparable','clear-all-preparable','select-all-ready','clear-all-ready'])assert.match(ui,new RegExp(id));
  assert.match(ui,/const setSelection=/);
  assert.match(ui,/class="commission-payment-table"/);
  assert.match(html,/\.commission-payment-table td small\{display:block/);
  assert.match(html,/\.commission-payment-table td b\{display:block/);
});

test('MD receives each submitted payout as a selectable row in the primary approval table',()=>{
  const ui=read('public/commission-payout-ui.js');
  assert.match(ui,/MD approval batch ·/);
  assert.match(ui,/batch\.items\.map\(item=>`<tr>/);
  assert.match(ui,/data-batch-calculation/);
  assert.match(ui,/data-select-md-all/);
  assert.match(ui,/data-clear-md-all/);
  assert.match(ui,/<th>Agent<\/th><th>Opportunity<\/th><th>Commission basis<\/th><th>Payable<\/th><th>Due date<\/th><th>Status<\/th>/);
  assert.match(ui,/The Accountant must send prepared payment rows before MD can approve them/);
  assert.ok(ui.indexOf("${isMD?(batchCards")<ui.indexOf('${calculationRegisterSection}'));
});

test('Agent payout calculations use one connected Agent-quarter table with a totals summary',()=>{
  const ui=read('public/commission-payout-ui.js');
  assert.match(ui,/<h3>Commission payment register<\/h3>/);
  assert.match(ui,/approved Excel model/);
  assert.match(ui,/Unit particulars \/ Project<\/th><th>Internal ref no/);
  assert.match(ui,/Commission after split \(%\)/);
  assert.match(ui,/Total Commission Earned/);
  assert.match(ui,/calculationRegisterGroups=/);
  assert.match(ui,/mapping-version-card/);
});

test('Prepare selected uses one atomic ordered request and unique per-credit payout references',()=>{
  const ui=read('public/commission-payout-ui.js'),route=read('src/routes/commission-payout.js');
  assert.equal(accountantRequestAllowed({jobRole:'accountant'},'POST','/api/finance/agent-payouts/prepare-batch'),true);
  assert.match(ui,/api\('\/finance\/agent-payouts\/prepare-batch'/);
  assert.match(ui,/body:\{creditLineIds,idempotencyKey:idempotency\(\)\}/);
  assert.doesNotMatch(ui,/for\(const id of ids\)await api\(`\/finance\/deal-agent-credit-lines/);
  assert.match(route,/r\.post\('\/finance\/agent-payouts\/prepare-batch'/);
  assert.match(route,/transaction\(async client=>/);
  assert.match(route,/ORDER BY c\.receipt_date,COALESCE\(collection\.created_at,v\.frozen_at\),d\.deal_reference,b\.name,l\.id/);
  assert.match(route,/String\(line\.id\)\.slice\(0,8\)/);
});

test('Accountant register retains submitted rows as Pending with MD',()=>{
  const ui=read('public/commission-payout-ui.js');
  assert.match(ui,/pendingApproval=payouts\.filter\(p=>p\.status==='calculated'&&p\.batchId&&p\.batchItemStatus==='submitted'\)/);
  assert.match(ui,/<h3>Pending with MD<\/h3>/);
  assert.match(ui,/Submitted commission-payment rows awaiting MD decision/);
  assert.match(ui,/pendingApprovalRows/);
  assert.match(ui,/Approval batch<\/th><th>Payable<\/th><th>Due date<\/th><th>Status/);
  assert.match(ui,/>Pending with MD<\/td>/);
});
