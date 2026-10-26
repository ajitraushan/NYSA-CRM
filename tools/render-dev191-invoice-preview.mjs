import fs from 'node:fs';
import path from 'node:path';
import {makeCommissionInvoicePdf} from '../src/commission-invoice-pdf.js';

const output=path.resolve('output/pdf/nysa-commission-tax-invoice-preview-v6.pdf');
fs.mkdirSync(path.dirname(output),{recursive:true});
const logoPath=path.resolve('public/brand/nysa/raster/nysa-horizontal-light@2x.png');
const pdf=makeCommissionInvoicePdf({
  invoice:{invoiceReference:'NYSA-INV-2026-000002',invoiceDate:'2026-09-05',dueDate:'2026-09-18',payerName:'SYNTHETIC DEVELOPER L.L.C',payerType:'developer',opportunityReference:'NYSA-OP-TEST-000001',scheduleReference:'AR-TEST-000001',instalmentNumber:1,commissionCents:4351391,vatCents:217570,totalCents:4568961,milestone:'1st Instalment',currency:'AED'},
  organization:{legalName:'NYSA REALTY L.L.C',displayName:'NYSA REALTY',tradeLicenseNumber:'SYN-TL-001',vatRegistrationNumber:'100000000000003',registeredAddress:'Synthetic office, Business Bay, Dubai, United Arab Emirates',primaryPhone:'+971 00 000 0000',bankAccountName:'NYSA REALTY L.L.C',bankName:'SYNTHETIC BANK',bankAccountNumber:'0000000000',bankIban:'AE000000000000000000000',bankSwiftCode:'SYNTAEADXXX',bankCurrency:'AED',bankBranch:'Dubai, UAE'},
  payer:{name:'SYNTHETIC DEVELOPER L.L.C',address:'Synthetic developer address, Dubai, United Arab Emirates',vatRegistrationNumber:'100000000000004'},
  transaction:{dealType:'off_plan',agreedValue:1450463.78,currency:'AED',scheduleCommissionCents:8702782,project:'Synthetic Island',unitReference:'BR-TL-A544',bookedDate:'2026-03-26'},
  logo:{buffer:fs.readFileSync(logoPath),mediaType:'image/png'}
});
fs.writeFileSync(output,pdf);
console.log(output);
