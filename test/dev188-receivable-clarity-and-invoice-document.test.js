import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commissionInvoiceApprovedDocument} from '../src/commission-invoice-pdf.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const ui=read('public/receivables-ui.js'),css=read('public/index.html'),route=read('src/commission-receivables.js'),app=read('public/app.js');

test('Receivables register names the record and gives state-specific next actions',()=>{
  assert.match(ui,/Commission Receivables Register/);
  assert.match(ui,/Receivable \/ Opportunity \/ instalment/);
  assert.match(ui,/Generate invoice.*Record payment.*View receipt \/ details/s);
  assert.doesNotMatch(ui,/>Open invoice</);
});

test('New instalments are issued immediately with generated identities',()=>{
  assert.match(ui,/issueInvoices:true/);
  assert.match(ui,/Generate and issue invoice\(s\)/);
  assert.match(route,/body\.issueInvoices===true\?await issueInvoice/);
  assert.match(route,/NYSA-INV-\$\{year\}/);
});

test('Invoice editor is in-page, added rows are removable and dark dates expose picker',()=>{
  assert.match(ui,/id="ar-overview"/);
  assert.match(ui,/class="ar-workspace"/);
  assert.match(ui,/Remove this invoice/);
  assert.match(ui,/Required first invoice/);
  assert.match(css,/input\[type="date"\]\{color-scheme:dark\}/);
  assert.doesNotMatch(ui,/ar-editor-backdrop/);
});

test('Application shell uses a responsive left navigation',()=>{
  assert.match(app,/shell-layout/);
  assert.match(css,/#app\.shell-layout\{display:grid/);
  assert.match(css,/#app\.shell-layout>nav\.tabs/);
});

test('Paper invoice is available with explicit payout linkage wording',()=>{
  assert.match(route,/\/finance\/receivables\/:id\/document/);
  assert.match(ui,/href="\/api\/finance\/receivables\/\$\{safe\(i\.id\)\}\/document"/);
  assert.match(ui,/Preview \/ print invoice/);
  assert.match(ui,/How this links to payout/);
  assert.match(ui,/Creating an invoice does not create or approve an agent payout/);
  const approved=commissionInvoiceApprovedDocument({invoice:{invoiceReference:'NYSA-INV-2026-000001',invoiceDate:'2026-09-05',dueDate:'2026-09-18',payerName:'Test Payer',payerType:'developer',opportunityReference:'NYSA-OP-TEST',scheduleReference:'AR-TEST',instalmentNumber:1,commissionCents:300000,vatCents:15000,totalCents:315000,milestone:'First instalment',currency:'AED'},organization:{displayName:'NYSA Realty'},transaction:{agreedValue:100000,currency:'AED',scheduleCommissionCents:600000,project:'Test Project',unitReference:'A-1'}});
  assert.equal(approved.table.rows[0][4],'3,000.00');
  assert.equal(approved.labelValues.find(x=>x.label==='VAT Amount').value,'150.00');
  assert.equal(approved.labelValues.find(x=>x.label==='TOTAL AMOUNT DUE (AED)').value,'3,150.00');
});

test('Payment evidence fields use plain language and enforce either proof or reference',()=>{
  assert.match(ui,/Incoming payment reference \*/);
  assert.match(ui,/Payment proof already uploaded/);
  assert.match(ui,/Payment evidence reference \(required only if no proof is selected\)/);
  assert.match(ui,/You do not need both/);
  assert.match(ui,/evidence\.required=!hasProof;evidence\.disabled=hasProof/);
  assert.match(route,/text\(body\.financeReference,'Incoming payment reference'\)/);
  assert.match(route,/text\(body\.evidenceReference,'Payment evidence reference'\)/);
});

test('Monetary fields use the shared decimal shorthand normalizer',()=>{
  assert.match(app,/input\[name="amount"\]/);
  assert.match(app,/input\[name\$="Amount"\]/);
  assert.match(app,/input\[name\$="Price"\]/);
  assert.match(app,/input\[name\$="Budget"\]/);
  assert.match(app,/input\[name\$="Rent"\]/);
  assert.match(app,/input\[name\$="Costs"\]/);
  assert.match(ui,/name="instalmentAmount"[^>]*data-business-amount/);
  assert.match(ui,/input\('amount','Collected including VAT \(AED\) \*','text','data-business-amount/);
});

test('Empty awaiting-invoice queue is hidden instead of showing redundant text',()=>{
  assert.match(ui,/id="ar-awaiting-panel"[^>]*hidden/);
  assert.match(ui,/panel\.hidden=!data\.opportunities\.length/);
  assert.doesNotMatch(ui,/No Closed Won Opportunities are awaiting their first commission invoice/);
});

test('Invoice creation selects an uninvoiced commission receivable, not a general Opportunity',()=>{
  assert.match(ui,/Commission receivable \/ Closed Opportunity \*/);
  assert.match(ui,/Find commission receivables/);
  assert.match(ui,/row\.displayParty/);
  assert.match(ui,/row\.outstandingCommissionCents/);
  assert.match(ui,/NYSA assigns each invoice number beginning with NYSA-INV-/);
  assert.match(route,/This is a receivable selector, not a general Opportunity lookup/);
  assert.match(route,/o\.stage='Closed Won'/);
  assert.match(route,/outstandingCommissionCents/);
  assert.match(route,/\.filter\(Boolean\)\.slice\(0,50\)/);
  assert.match(route,/Select a commission receivable from a Closed Won Opportunity/);
  assert.match(route,/Commission available for invoicing is AED/);
});
