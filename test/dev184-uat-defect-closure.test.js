import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('pipeline counts every scoped Opportunity once and only keeps pre-Opportunity leads',()=>{
  const route=read('src/routes/dashboards.js'),ui=read('public/dashboard-ui.js');
  assert.match(route,/FROM opportunities o JOIN leads l ON l\.id=o\.lead_id/);
  assert.match(route,/WHEN 'Booking' THEN 'Booking'/);
  assert.match(route,/WHEN 'Closed Won' THEN 'Won'/);
  assert.match(route,/NOT EXISTS\(SELECT 1 FROM opportunities child_o WHERE child_o\.lead_id=l\.id/);
  assert.match(route,/entityType:'opportunity'/);
  assert.match(ui,/each current Opportunity counted at its present stage/);
  assert.match(ui,/exact records/);
});

test('My Tasks includes active Opportunity actions',()=>{
  const route=read('src/routes/lead-operations.js'),ui=read('public/app.js');
  assert.match(route,/taskType:'opportunity_action'/);
  assert.match(route,/o\.stage NOT IN \('Closed Won','Closed Lost'\)/);
  assert.match(ui,/data-task-opportunity/);
});

test('closed Opportunities hand off automatically to Accountant invoice work',()=>{
  const route=read('src/commission-receivables.js'),receivables=read('public/receivables-ui.js'),accountant=read('public/accountant-workspace-ui.js');
  assert.match(route,/\/finance\/receivables\/awaiting/);
  assert.match(route,/o\.stage='Closed Won'/);
  assert.match(route,/status='closed_won'/);
  assert.match(receivables,/Closed Opportunities awaiting invoicing/);
  assert.match(accountant,/Commission work requiring action/);
});

test('manager no longer edits or freezes referral commission and API rejects incomplete legacy input clearly',()=>{
  const ui=read('public/commission-payout-ui.js'),route=read('src/routes/commission-payout.js'),receivables=read('public/receivables-ui.js');
  assert.match(ui,/Commission invoicing and referral settlement are handled by the Accountant in Receivables/);
  assert.match(ui,/managerSetup\.replaceWith/);
  assert.match(route,/Select the referral partner before confirming a referral fee/);
  assert.match(receivables,/Referral fee recorded on Opportunity/);
});

test('Deal wording and approval layout are operational and aligned',()=>{
  const deal=read('public/deal-ui.js'),html=read('public/index.html');
  assert.doesNotMatch(deal,/Create governed Deal/);
  assert.match(deal,/Create Deal from active reservation/);
  assert.match(html,/#deal-approval-form\{align-items:start\}/);
});
