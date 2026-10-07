import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
const crmRoutes=readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
const proposalRoutes=readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');

test('Customer identity date controls render each stored document expiry as YYYY-MM-DD',()=>{
  assert.match(app,/name="expiryDate" type="date" value="\$\{esc\(String\(item\?\.expiryDate\|\|''\)\.slice\(0,10\)\)\}"/);
  assert.match(app,/Passport and Emirates ID are separate Customer Master records/);
});

test('Passport and Emirates ID require masked reference and expiry before review',()=>{
  assert.match(crmRoutes,/validateIdentitySubmission/);
  assert.match(crmRoutes,/restricted identity document/);
});

test('KYC expiry is visibly required for identity documents except optional individual POA',()=>{
  assert.match(app,/Expiry date\$\{optional\?' \(optional\)':' \*'\}/);
});

test('KYC business dates omit timestamps outside TAT and audit displays',()=>{
  assert.match(app,/'Expiry '\+fmtDateOnly\(c\.idDocumentExpiry\)/);
  assert.match(app,/item\.expiryDate\?' · expires '\+fmtDateOnly\(item\.expiryDate\)/);
  assert.match(dashboard,/Expires \$\{x\.idDocumentExpiry\?fmtDateOnly\(x\.idDocumentExpiry\):'not recorded'\}/);
  assert.match(proposalRoutes,/'contact\.id_document_expiry':recipient\.idDocumentExpiry\?String\(recipient\.idDocumentExpiry\)\.slice\(0,10\):null/);
  assert.match(dashboard,/\$\{fmtDate\(x\.updatedAt\)\}<\/time><small>\$\{approvalAge\(x\.updatedAt\)\}/);
});
