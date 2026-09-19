import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('My Tasks includes current Opportunity work without a generic completion bypass',()=>{
  const route=read('src/routes/lead-operations.js'),ui=read('public/app.js');
  assert.match(route,/opportunityScopeSql/);
  assert.match(route,/o\.stage NOT IN \('Closed Won','Closed Lost'\)/);
  assert.match(route,/taskType:'opportunity_action'/);
  assert.match(route,/LOWER\(TRIM\(existing\.subject\)\)=LOWER\(TRIM\(o\.next_action\)\)/);
  assert.match(ui,/isOpportunityActionTask/);
  assert.match(ui,/data-task-opportunity/);
  assert.match(ui,/This item closes only when the named Opportunity action changes the workflow/);
  assert.match(ui,/isOpportunityActionTask\(t\)\?`<button class="btn btn-primary btn-sm" data-task-opportunity/);
});

test('Accountant starts from Closed Won commission invoice work',()=>{
  const receivables=read('public/receivables-ui.js'),accountant=read('public/accountant-workspace-ui.js');
  for(const marker of ['Create commission invoice','Closed Opportunities awaiting invoicing','Commission pending','Add another invoice','Generate and issue invoice(s)'])assert.match(receivables,new RegExp(marker.replace(/[()]/g,'\\$&')));
  assert.doesNotMatch(receivables,/Create payment schedule/);
  assert.match(accountant,/Commission work requiring action/);
  assert.match(accountant,/Closed Won Opportunities appear here until their first commission invoice is created/);
  assert.match(accountant,/\/finance\/receivables\/awaiting/);
});

test('Negotiation exposes priced counteroffer revision and represented-party acceptance',()=>{
  const ui=read('public/offer-ui.js');
  assert.match(ui,/Step 1 · Record the counteroffer amount and terms/);
  assert.match(ui,/A counteroffer note does not change the agreed price/);
  assert.match(ui,/Save priced counteroffer as new revision/);
  assert.match(ui,/NYSA \/ represented party accepted this priced counteroffer/);
  assert.match(ui,/acceptingInbound\?'internal':'inbound'/);
  assert.doesNotMatch(ui,/offer-revision-form flow-offer-only/);
});
