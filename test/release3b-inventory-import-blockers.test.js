import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validateVerificationSubmission} from '../src/inventory-verification-domain.js';

const read=file=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

test('R3B-INVENTORY-ID-56 guarantees returns displays and searches the generated CORE Inventory ID',()=>{
  const migration=read('src/migrations/015_inventory_business_reference.sql'),intake=read('src/routes/listing-intake.js'),upload=read('src/routes/inventory-import.js'),ui=read('public/app.js'),listings=read('src/routes/listings.js');
  assert.match(migration,/ALTER COLUMN inventory_reference SET DEFAULT[\s\S]*NYSA-INV-/);
  assert.match(migration,/ALTER COLUMN inventory_reference SET NOT NULL/);
  assert.match(intake,/if\(!listing\.inventoryReference\)throw new Error\('CORE did not generate the required Inventory reference'\)/);
  assert.match(intake,/inventoryReference:listing\.inventoryReference/);
  assert.match(upload,/did not receive a CORE Inventory ID/);
  assert.match(upload,/created:result\.created,drafts:result\.created/);
  assert.match(ui,/Generated CORE Inventory IDs/);
  assert.match(ui,/data-open-imported-inventory/);
  assert.match(ui,/INTERNAL INVENTORY · \$\{esc\(l\.inventoryReference\|\|'CORE Inventory ID missing'\)\}/);
  assert.match(ui,/class="eyebrow">\$\{esc\(l\.inventoryReference\|\|'CORE Inventory ID missing'\)\}/);
  assert.match(listings,/l\.inventory_reference ILIKE/);
  assert.match(listings,/l\.inventory_headline ILIKE/);
});

test('owner policy supersedes R3B-INVENTORY-CUSTODY-57 with Listing Executive maintenance and Opportunity-specific use',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js');
  assert.doesNotMatch(route,/listing\.responsibleAgentId === broker\.id/);
  assert.doesNotMatch(ui,/l\.responsibleAgentId === ME\.id|Current custodian|Reassign responsible agent/);
  assert.match(route,/Only the Listing Executive who created this Inventory or an authorized Administrator can submit it for verification/);
  assert.match(route,/Inventory has no transferable custodian/);
  assert.match(ui,/Selecting Inventory creates an Opportunity-specific linkage; no Inventory custodian approval is required/);
});

test('R3B-INVENTORY-VERIFY-SUBMIT-58 uses visible governed evidence and creates a Pending Manager request without availability',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),start=route.indexOf("r.post('/listings/:id/verification-requests'"),end=route.indexOf("r.post('/inventory-verification-requests/:id/decision'",start),submission=route.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(submission,/INSERT INTO inventory_verification_requests/);
  assert.match(submission,/verification_status='pending'/);
  assert.match(submission,/status='pending'/);
  assert.doesNotMatch(submission,/availabilityConfirmedAt|availability_confirmed_at|seven days/i);
  assert.match(ui,/id="inventory-verification-submit-form"/);
  assert.match(ui,/data-verification-submit-status/);
  assert.match(ui,/Submitted successfully\. Request \$\{request\.id\} is Pending in the Manager verification queue/);
  const handler=ui.slice(ui.indexOf("$('#inventory-verification-submit-form'"),ui.indexOf("$('#d-media'",ui.indexOf("$('#inventory-verification-submit-form'")));
  assert.doesNotMatch(handler,/prompt\(/);
  assert.match(handler,/Submission failed: \$\{err\.message\}/);
  assert.equal(validateVerificationSubmission({currentStatus:'unverified',requestType:'verification',reason:'Owner evidence reviewed for Manager decision',evidenceReference:'TITLE-DEED-2615',availabilityConfirmedAt:null}).error,undefined);
});

test('verification separation prevents the submitter deciding their own request',()=>{
  const route=read('src/routes/listings.js');
  assert.match(route,/request\.submittedBy===req\.broker\.id/);
  assert.match(route,/person who submitted this Inventory cannot decide the same verification request/);
});

test('R3B-INVENTORY-VERIFY-SUBMIT-58 routes Pending work through the Listing Executive team',()=>{
  const listings=read('src/routes/listings.js'),guided=read('src/routes/opportunities.js');
  for(const route of [listings,guided]){
    assert.match(route,/maintainer\.id=l\.posted_by/);
    assert.match(route,/t\.id=maintainer\.team_id/);
  }
  assert.match(listings,/posted_by_team_id/);
  assert.match(listings,/postedBy:request\.postedBy,postedByTeamId:request\.postedByTeamId/);
  for(const route of [listings,guided])assert.match(route,/user_role_assignments[\s\S]*job_role='manager'[\s\S]*status='active'[\s\S]*ends_at IS NULL/);
});

test('R3B-INVENTORY-VERIFY-59 lets an authorized Manager decide a searched Pending Inventory',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/id="inventory-verification-decision-form"/);
  assert.match(ui,/Record verification decision/);
  assert.match(ui,/Server-side scope and creator separation will be checked/);
  assert.match(ui,/\/inventory-verification-requests\/\$\{pendingVerification\.id\}\/decision/);
  assert.match(ui,/Decision failed: \$\{err\.message\}/);
});

test('R3B-INVENTORY-VERIFY-60 opens the verification worklist even when selected during dashboard loading',()=>{
  const ui=read('public/dashboard-ui.js'),renderStart=ui.indexOf('window.renderCrmDashboard=async function'),loadStart=ui.indexOf("const loadCampaignOptions=async",renderStart),early=ui.slice(renderStart,loadStart);
  assert.match(ui,/let dashboardRenderSequence=0/);
  assert.match(ui,/const renderSequence=\+\+dashboardRenderSequence/);
  assert.match(early,/data-inventory-verification-shortcut/);
  assert.match(early,/addEventListener\('click',\(\)=>window\.renderCrmDashboard\(\{view:'Inventory verification'\}\)\)/);
  assert.match(ui,/if\(renderSequence!==dashboardRenderSequence\)return/);
  assert.match(ui,/activeDashboardView==='Inventory verification'\?'btn-primary':''/);
});

test('R3B-INVENTORY-VERIFY-61 uses the dedicated worklist without waiting for dashboard or guided work',()=>{
  const ui=read('public/dashboard-ui.js'),guided=read('src/routes/opportunities.js'),branchStart=ui.indexOf("if(likelyType==='manager'&&activeDashboardView==='Inventory verification')"),branchEnd=ui.indexOf('loadVerificationWorklist();return;',branchStart)+'loadVerificationWorklist();return;'.length,branch=ui.slice(branchStart,branchEnd);
  assert.ok(branchStart>0&&branchEnd>branchStart);
  assert.match(branch,/api\('\/inventory-verification-queue'\)/);
  assert.match(branch,/loadVerificationWorklist\(\);return/);
  assert.doesNotMatch(branch,/crm\/dashboard|operations\/guided-work/);
  assert.match(branch,/Inventory verification could not be loaded/);
  assert.match(guided,/vr\.request_type,vr\.request_reason/);
  assert.doesNotMatch(guided,/vr\.reason AS request_reason/);
});
