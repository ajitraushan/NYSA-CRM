import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('closure document workspace uses clear transaction wording and no seller promotion prompt',()=>{
  const ui=read('public/document-compliance-ui.js');
  for(const text of ['TRANSACTION DOCUMENTS','Required documents','Document checklist not configured','Refresh document checklist','Document checklist refreshed for the current transaction details'])assert.match(ui,new RegExp(text));
  assert.doesNotMatch(ui,/Promote the transaction-only party/);
  assert.doesNotMatch(ui,/Current party-document checklist resolved and frozen/);
  const route=read('src/routes/document-compliance.js');
  assert.match(route,/gateCode!=='before_close_won'/);
});

test('transaction completion documents are Deal-level and configurable without party records',()=>{
  const migration=read('src/migrations/117_transaction_completion_documents.sql'),domain=read('src/document-compliance-domain.js'),route=read('src/routes/document-compliance.js'),gate=read('src/document-compliance-gate.js'),ui=read('public/document-compliance-ui.js');
  assert.match(migration,/party_role IN\('transaction','buyer','seller','landlord','tenant'\)/);
  assert.match(migration,/ALTER COLUMN deal_party_id DROP NOT NULL/);
  assert.match(domain,/dealPartyId:null/);
  assert.match(route,/LEFT JOIN deal_parties dp ON dp\.id=i\.deal_party_id/);
  assert.match(gate,/'transaction'::text AS party_role/);
  assert.match(ui,/Transaction completion document/);
  assert.match(ui,/Sale Deed, Transfer Deed, Oqood, Ejari/);
});

test('pipeline ranks closed pursuits ahead of historical active stages',()=>{
  const source=read('src/dashboard-pipeline.js');
  assert.match(source,/WHEN 'Closed Won' THEN 10 WHEN 'Closed Lost' THEN 9 WHEN 'Deal' THEN 8/);
});

test('Receivables exposes closed Opportunities before schedules exist',()=>{
  const route=read('src/commission-receivables.js'),ui=read('public/receivables-ui.js');
  assert.match(route,/\/finance\/receivables\/awaiting/);
  assert.match(route,/o\.stage='Closed Won'/);
  assert.match(route,/NOT EXISTS\(\s*SELECT 1 FROM commission_receivable_schedules/);
  assert.match(route,/typed\.match\(\/NYSA-OP-/);
  assert.match(ui,/Closed Opportunities awaiting invoicing/);
  assert.match(ui,/data-ar-start/);
  assert.match(ui,/preselectedOpportunityReference/);
  assert.match(ui,/loadAwaiting\(\)/);
});

test('commission workspace uses plain operational wording',()=>{
  const ui=read('public/commission-payout-ui.js');
  for(const text of ['Commission and collection','Transaction value','Agreed agent split','Expected commission','Commission received','handled by the Accountant in Receivables'])assert.match(ui,new RegExp(text));
  assert.match(ui,/Review the commission agreed on this Opportunity/);
});
