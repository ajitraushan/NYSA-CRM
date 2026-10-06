import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
const crmRoutes=readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
const proposalRoutes=readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');

test('Customer and Lead KYC date controls render stored ISO expiry as YYYY-MM-DD',()=>{
  assert.match(app,/name="idDocumentExpiry" type="date" value="\$\{esc\(String\(customer\.idDocumentExpiry\|\|''\)\.slice\(0,10\)\)\}"/);
  assert.match(app,/name="idDocumentExpiry" type="date" value="\$\{esc\(String\(lead\.idDocumentExpiry\|\|''\)\.slice\(0,10\)\)\}"/);
});

test('pending or verified KYC is blocked immediately when expiry or masked identity is missing',()=>{
  assert.equal((app.match(/ID type, masked final four and expiry date are required for KYC review/g)||[]).length>=2,true);
  assert.match(crmRoutes,/\['pending_review','verified'\]\.includes\(status\)&&\(!type\|\|!last4\|\|!expiry\)/);
});

test('KYC expiry is visibly marked as required in both editable workspaces',()=>{
  assert.equal((app.match(/<label>Expiry date \*<\/label>/g)||[]).length>=2,true);
});

test('KYC business dates omit timestamps outside TAT and audit displays',()=>{
  assert.match(app,/'Expiry '\+fmtDateOnly\(c\.idDocumentExpiry\)/);
  assert.match(app,/' · expires '\+fmtDateOnly\(customer\.idDocumentExpiry\)/);
  assert.match(dashboard,/Expires \$\{x\.idDocumentExpiry\?fmtDateOnly\(x\.idDocumentExpiry\):'not recorded'\}/);
  assert.match(proposalRoutes,/'contact\.id_document_expiry':recipient\.idDocumentExpiry\?String\(recipient\.idDocumentExpiry\)\.slice\(0,10\):null/);
  assert.match(dashboard,/\$\{fmtDate\(x\.updatedAt\)\}<\/time><small>\$\{approvalAge\(x\.updatedAt\)\}/);
});
