import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commissionInvoiceApprovedDocument} from '../src/commission-invoice-pdf.js';
import {buildApprovedDocumentHtml} from '../src/approved-document-renderer.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const route=read('src/commission-receivables.js'),pdfSource=read('src/commission-invoice-pdf.js'),pdfPrimitive=read('src/proposal-pdf.js'),organization=read('src/organization-domain.js'),admin=read('public/app.js'),crm=read('src/routes/crm.js'),migration=read('src/migrations/122_commission_invoice_legal_and_bank_details.sql');

const sample={
  invoice:{invoiceReference:'NYSA-INV-2026-000002',invoiceDate:'2026-09-05',dueDate:'2026-09-18',payerName:'Synthetic Developer LLC',payerType:'developer',opportunityReference:'NYSA-OP-TEST',scheduleReference:'AR-TEST',instalmentNumber:1,commissionCents:4351391,vatCents:217570,totalCents:4568961,milestone:'1st Instalment',currency:'AED'},
  organization:{legalName:'NYSA REALTY L.L.C',displayName:'NYSA REALTY',tradeLicenseNumber:'SYN-TL-001',vatRegistrationNumber:'100000000000003',registeredAddress:'Synthetic office, Dubai, UAE',primaryPhone:'+971 00 000 0000',bankAccountName:'NYSA REALTY L.L.C',bankName:'Synthetic Bank',bankAccountNumber:'0000000000',bankIban:'AE000000000000000000000',bankSwiftCode:'SYNTAEADXXX',bankCurrency:'AED',bankBranch:'Dubai, UAE'},
  payer:{name:'Synthetic Developer LLC',address:'Synthetic developer address, Dubai, UAE',vatRegistrationNumber:'100000000000004'},
  transaction:{dealType:'off_plan',agreedValue:1450463.78,currency:'AED',scheduleCommissionCents:8702782,project:'Synthetic Island',unitReference:'BR-TL-A544',bookedDate:'2026-03-26'}
};

test('invoice mapping follows the supplied tax-invoice structure and reconciles quantity, subtotal, VAT and total',()=>{
  const approved=commissionInvoiceApprovedDocument(sample),html=buildApprovedDocumentHtml('tax_invoice',approved),row=approved.table.rows[0];
  assert.deepEqual(row.slice(0,3),[1,'Agency commission · 1st Instalment',1]);assert.equal(row[3],'43,513.91');assert.equal(row[4],'43,513.91');
  assert.equal(approved.labelValues.find(x=>x.label==='Subtotal (excl. VAT)').value,'43,513.91');assert.equal(approved.labelValues.find(x=>x.label==='VAT Rate').value,'5%');assert.equal(approved.labelValues.find(x=>x.label==='VAT Amount').value,'2,175.70');assert.equal(approved.labelValues.find(x=>x.label==='TOTAL AMOUNT DUE (AED)').value,'45,689.61');
  for(const expected of ['TAX INVOICE','Invoice No.','Client Name','Property / Unit','Qty','Unit Price','Amount excl. VAT','Subtotal','VAT Rate','TOTAL AMOUNT DUE','PAYMENT DETAILS','IBAN','SWIFT','Authorised Signatory'])assert.match(html,new RegExp(expected,'i'));
  assert.doesNotMatch(html,/PRIVATE BUYER|financial illustration/i);assert.match(pdfSource,/renderApprovedDocumentPdf\('tax_invoice'/);assert.match(pdfPrimitive,/canvas\(defaultInk=C\.ink,page=PAGE\)/);
});

test('invoice identity and bank data are governed through Administration',()=>{
  for(const field of ['vat_registration_number','bank_account_name','bank_name','bank_account_number','bank_iban','bank_swift_code','bank_currency','bank_branch'])assert.match(migration,new RegExp(field));
  for(const field of ['vatRegistrationNumber','bankAccountName','bankName','bankAccountNumber','bankIban','bankSwiftCode','bankCurrency','bankBranch']){assert.match(organization,new RegExp(field));assert.match(admin,new RegExp(field));}
  assert.match(crm,/vat_registration_number/);
  assert.match(admin,/Company invoice details/);
});

test('off-plan receivables require the maintained Developer and printable legal details',()=>{
  assert.match(route,/opportunity\.dealType==='off_plan'/);
  assert.match(route,/must be raised to the maintained Developer/);
  assert.match(route,/deal_parties[\s\S]*party_role='developer'/);
  assert.match(route,/inventory_organization_link_events[\s\S]*relationship='developer'/);
  assert.match(route,/FROM deals d LEFT JOIN bookings b ON b\.id=d\.booking_id/);
  assert.match(route,/Complete and activate Organisation Settings before printing this tax invoice/);
  assert.match(route,/Complete the Developer registered address and VAT registration number/);
  assert.match(route,/nysa-horizontal-light@2x\.png/);
});
