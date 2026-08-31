import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('duplicate customers become governed drafts with an explicit Manager resolution path',()=>{
  const routes=read('src/routes/crm.js'),ui=read('public/app.js'),migration=read('src/migrations/050_release2_customer_kyc_uat_corrections.sql');
  for(const marker of ['duplicate_review_status','duplicate_match_ids','duplicate_reviewed_by'])assert.match(migration,new RegExp(marker));
  assert.match(migration,/a9dc9573-9948-4cd3-b23e-d3fea8230ab7/);
  assert.match(migration,/CARDINALITY\(matched\.match_ids\)>0/);
  assert.match(routes,/duplicateReviewRequested/);
  assert.match(routes,/duplicate_draft_created/);
  assert.match(routes,/\/crm\/contacts\/:id\/duplicate-review/);
  assert.match(routes,/A responsible Manager must approve it before a Lead can be created/);
  assert.match(routes,/duplicateReviewStatus==='rejected'/);
  assert.match(routes,/\!\['not_required','approved'\]\.includes\(contact\.duplicateReviewStatus\)/);
  assert.match(ui,/Create draft for duplicate review/);
  assert.match(ui,/Customers → Duplicate review/);
  assert.match(ui,/Pending duplicate review/);
  assert.match(ui,/Approve separate customer/);
  assert.doesNotMatch(ui,/Create a separate customer after review\?/);
});

test('KYC routes honor the authoritative team manager and Manager-owned submissions verify directly',()=>{
  const routes=read('src/routes/crm.js'),ui=read('public/app.js');
  assert.match(routes,/owner_team\.manager_id=\$\$\{params\.length\}/);
  assert.match(routes,/owner_team\.id=owner\.team_id/);
  assert.match(routes,/KYC cannot be submitted for an inactive or unresolved duplicate Customer/);
  assert.match(routes,/managerSelfVerification/);
  assert.match(routes,/kyc_manager_verified/);
  assert.match(ui,/Save and verify KYC/);
  assert.match(ui,/customer\.kycStatus==='pending_review'/);
  assert.match(ui,/Reviewer decision notes \(required for rejection or expiry\)/);
  assert.match(ui,/Rejected duplicate Customer/);
});

test('Customer identity and Leads are company-visible but Lead work is assignment-controlled',()=>{
  const policy=read('src/crm-policy.js'),routes=read('src/routes/crm.js'),ui=read('public/app.js');
  assert.match(policy,/export function canReadLead[\s\S]*return true/);
  assert.match(policy,/export function canWriteLead[\s\S]*lead\.assignedTo === broker\.id/);
  assert.match(policy,/export function contactScopeSql[\s\S]*clause:'1=1'/);
  assert.match(routes,/canWrite:canOperateLead/);
  assert.match(ui,/Company-visible Lead · read only/);
  assert.match(ui,/Only the assigned Agent can initiate operational actions/);
});

test('Customer UI explains consent evidence and uses visible confirmation dialogs',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Consent evidence:/);
  assert.match(ui,/consent statement\/version, permitted channels and scope/);
  assert.match(ui,/function showCustomerConfirmation/);
  assert.match(ui,/Customer record saved/);
});
