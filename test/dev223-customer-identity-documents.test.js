import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import {deriveCustomerKycStatus,effectiveIdentityState,validateCustomerDocumentRequirement,validateIdentitySubmission,validateCompanyDocumentSubmission} from'../src/customer-document-domain.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('customer identity accepts passport, Emirates ID or both with one valid document sufficient',()=>{
  const input={requirementCode:'individual_identity',label:'Individual customer identity',businessReason:'Reusable Customer identity across every transaction role',customerKind:'individual',acceptedDocumentTypes:['passport','emirates_id','power_of_attorney'],requiredDocumentGroups:[['passport','emirates_id']],minimumValidDocuments:1,reviewRequired:true,expiryRequired:true,reminderOffsetsDays:[0,7,14,30],effectiveFrom:'2026-10-08T00:00:00Z'},checked=validateCustomerDocumentRequirement(input);
  assert.equal(checked.valid,true);
  assert.equal(deriveCustomerKycStatus([{documentType:'passport',status:'verified',expiryDate:'2030-01-01'}],checked.value,Date.parse('2026-10-08')), 'verified');
  assert.equal(deriveCustomerKycStatus([{documentType:'passport',status:'expired',expiryDate:'2025-01-01'},{documentType:'emirates_id',status:'verified',expiryDate:'2030-01-01'}],checked.value,Date.parse('2026-10-08')), 'verified');
  assert.equal(deriveCustomerKycStatus([{documentType:'passport',status:'pending_review',expiryDate:'2030-01-01'}],checked.value,Date.parse('2026-10-08')), 'pending_review');
});

test('expired identity cannot remain effectively verified and submissions are minimized',()=>{
  assert.equal(effectiveIdentityState({status:'verified',expiryDate:'2026-10-07'},Date.parse('2026-10-08')),'expired');
  assert.equal(validateIdentitySubmission({documentType:'passport',maskedFinalFour:'a9z1',expiryDate:'2030-01-01',documentId:'d',documentVersionId:'v'},Date.parse('2026-10-08')).valid,true);
  assert.equal(validateIdentitySubmission({documentType:'passport',maskedFinalFour:'FULLNUMBER',expiryDate:'2030-01-01'},Date.parse('2026-10-08')).valid,false);
  assert.equal(validateIdentitySubmission({documentType:'power_of_attorney'},Date.parse('2026-10-08')).valid,true);
  assert.equal(deriveCustomerKycStatus([{documentType:'power_of_attorney',status:'verified'}],{requiredDocumentGroups:[['passport','emirates_id']],minimumValidDocuments:1},Date.parse('2026-10-08')),'unverified');
});

test('company requires registration evidence, MoA and Power of Attorney',()=>{
  const requirement={requirementCode:'corporate_identity',label:'Corporate identity and authority',businessReason:'Corporate registration, constitutional and authority evidence',customerKind:'organization',acceptedDocumentTypes:['trade_license','certificate_of_incorporation','memorandum_of_association','power_of_attorney'],requiredDocumentGroups:[['trade_license','certificate_of_incorporation'],['memorandum_of_association'],['power_of_attorney']],minimumValidDocuments:3,reviewRequired:true,expiryRequired:true,reminderOffsetsDays:[0,7,14,30],effectiveFrom:'2026-10-08T00:00:00Z'},checked=validateCustomerDocumentRequirement(requirement),now=Date.parse('2026-10-08');
  assert.equal(checked.valid,true);
  assert.equal(deriveCustomerKycStatus([{documentType:'trade_license',status:'verified',expiryDate:'2030-01-01'},{documentType:'memorandum_of_association',status:'verified'},{documentType:'power_of_attorney',status:'verified'}],checked.value,now),'verified');
  assert.equal(deriveCustomerKycStatus([{documentType:'certificate_of_incorporation',status:'verified'},{documentType:'memorandum_of_association',status:'verified'}],checked.value,now),'unverified');
  assert.equal(validateCompanyDocumentSubmission({documentType:'trade_license',maskedFinalFour:'1234',expiryDate:'2030-01-01'},now).valid,true);
  assert.equal(validateCompanyDocumentSubmission({documentType:'trade_license',maskedFinalFour:'1234'},now).valid,false);
  assert.equal(validateCompanyDocumentSubmission({documentType:'power_of_attorney'},now).valid,true);
});

test('migration separates reusable customer identity from transaction documents',()=>{
  const migration=read('src/migrations/133_customer_identity_documents.sql'),routes=read('src/routes/crm.js'),admin=read('public/document-compliance-ui.js'),ui=read('public/app.js');
  for(const marker of ['customer_document_requirement_versions','customer_identity_documents','company_identity_documents','passport','emirates_id','power_of_attorney','memorandum_of_association','minimum_valid_documents'])assert.match(migration,new RegExp(marker));
  assert.match(migration,/Replaced by reusable Customer Master identity requirements/);
  assert.match(routes,/identity-documents\/:documentType/);
  assert.match(routes,/syncCustomerKycSummary/);
  assert.match(routes,/companies\/:id\/identity-documents/);
  assert.match(admin,/<h2>Customer documents<\/h2>/);
  assert.match(admin,/<h2>Transaction documents<\/h2>/);
  assert.match(admin,/Customer identity is maintained once in Customer Master/);
  assert.match(ui,/Passport and Emirates ID are separate Customer Master records/);
  assert.match(ui,/reused whether this customer is a buyer, seller, tenant or landlord/);
  assert.match(ui,/Power of Attorney are both mandatory/);
});
