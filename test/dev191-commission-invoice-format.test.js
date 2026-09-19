import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeCommissionInvoicePdf} from '../src/commission-invoice-pdf.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const route=read('src/commission-receivables.js'),pdfSource=read('src/commission-invoice-pdf.js'),pdfPrimitive=read('src/proposal-pdf.js'),organization=read('src/organization-domain.js'),admin=read('public/app.js'),crm=read('src/routes/crm.js'),migration=read('src/migrations/122_commission_invoice_legal_and_bank_details.sql');

const sample={
  invoice:{invoiceReference:'NYSA-INV-2026-000002',invoiceDate:'2026-09-05',dueDate:'2026-09-18',payerName:'Synthetic Developer LLC',payerType:'developer',opportunityReference:'NYSA-OP-TEST',scheduleReference:'AR-TEST',instalmentNumber:1,commissionCents:4351391,vatCents:217570,totalCents:4568961,milestone:'1st Instalment',currency:'AED'},
  organization:{legalName:'NYSA REALTY L.L.C',displayName:'NYSA REALTY',tradeLicenseNumber:'SYN-TL-001',vatRegistrationNumber:'100000000000003',registeredAddress:'Synthetic office, Dubai, UAE',primaryPhone:'+971 00 000 0000',bankAccountName:'NYSA REALTY L.L.C',bankName:'Synthetic Bank',bankAccountNumber:'0000000000',bankIban:'AE000000000000000000000',bankSwiftCode:'SYNTAEADXXX',bankCurrency:'AED',bankBranch:'Dubai, UAE'},
  payer:{name:'Synthetic Developer LLC',address:'Synthetic developer address, Dubai, UAE',vatRegistrationNumber:'100000000000004'},
  transaction:{dealType:'off_plan',agreedValue:1450463.78,currency:'AED',scheduleCommissionCents:8702782,project:'Synthetic Island',unitReference:'BR-TL-A544',bookedDate:'2026-03-26'}
};

test('invoice PDF follows the supplied tax-invoice section and column structure without proposal content',()=>{
  const pdf=makeCommissionInvoicePdf(sample),text=pdf.toString('latin1');
  assert.equal(pdf.subarray(0,8).toString(),'%PDF-1.4');
  for(const expected of ['TAX INVOICE','Invoice Number:','Company Name:','Trade Licence No.:','Company TRN:','Payer TRN:','NYSA Office Address:','Recipient Address:','Commission Details','Unit No.','Booked Date','Total','Eligible','Commission %','Bank A/C Details','IBAN Number:','Swift Code:'])assert.match(text,new RegExp(expected));
  assert.ok(text.includes('VAT \\(5%\\)'), 'escaped VAT heading is present in the PDF content stream');
  assert.doesNotMatch(text,/proposal|PRIVATE BUYER|financial illustration/i);
  assert.match(text,/Authorised Signatory/);
  assert.equal((text.match(/Synthetic Developer LLC/g)||[]).length,1,'payer appears only in Invoice To details');
  assert.match(pdfSource,/d\.line\(16,96,579,96,C\.gold,1\.5\)[\s\S]*Invoice Number:/);
  assert.match(pdfSource,/draw\.rect\(x,y,width,height,fill,BORDER,\.25\)/);
  assert.match(pdfPrimitive,/canvas\(defaultInk=C\.ink,page=PAGE\)/);
  assert.match(pdfSource,/const TEXT=\[\.2,\.2,\.2\]/);
  assert.match(pdfSource,/const BORDER=\[\.902,\.882,\.847\]/);
  assert.match(pdfSource,/const detailRow=20,addressRow=32/);
  assert.match(pdfSource,/index\*20/);
  assert.match(pdfSource,/306,width,44/);
  assert.doesNotMatch(text,/duplicated in another invoicing system|discharging its VAT liability/i);
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
