import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('offer creation submits the authoritative Opportunity property match directly',()=>{
  const ui=read('public/offer-ui.js'),app=read('public/app.js');
  assert.match(ui,/select name="propertyMatchId"/);
  assert.match(ui,/option value="\$\{esc\(x\.id\)\}"/);
  assert.doesNotMatch(app,/offerPropertySelect\.name='propertyMatchId'/);
});

test('Manager workspace includes duplicate Customer review routing',()=>{
  const route=read('src/routes/crm.js'),ui=read('public/dashboard-ui.js');
  assert.match(route,/\/crm\/duplicate-review-queue/);
  assert.match(route,/duplicate_review_status='pending'/);
  assert.match(ui,/Duplicate Customer reviews/);
  assert.match(ui,/data-duplicate-review/);
});

test('reviewed AI requirement evidence is immutable and expandable',()=>{
  const migration=read('src/migrations/053_release2_uat_evidence_and_queue.sql');
  const route=read('src/routes/lead-operations.js'),ui=read('public/app.js');
  for(const marker of ['ai_conversation_notes','ai_reviewed_evidence','ai_reviewed_at','ai_reviewed_by'])assert.match(migration,new RegExp(marker));
  assert.match(route,/reviewedAiEvidence:Boolean/);
  assert.match(ui,/View complete saved Requirement evidence/);
  assert.match(ui,/Reviewed AI requirement summary/);
  assert.match(ui,/Nothing is saved until you review a suggestion/);
  assert.match(ui,/Human-reviewed evidence/);
});

test('user contact maintenance, viewing alignment and multiple Lead entry are explicit',()=>{
  const admin=read('src/routes/admin.js'),ui=read('public/app.js'),html=read('public/index.html');
  assert.match(admin,/Enter a valid representative phone number/);
  assert.match(ui,/Edit user contact/);
  assert.match(html,/#viewing-outcome-form/);
  assert.match(ui,/A Customer may/);
  assert.match(ui,/preselectedCustomerId=null/);
});

test('new User creation requires and persists the representative phone',()=>{
  const admin=read('src/routes/admin.js'),ui=read('public/app.js');
  assert.match(ui,/<label>Phone \*<\/label><input name="phone" type="tel" required/);
  assert.match(ui,/phone:f\.phone/);
  assert.match(admin,/INSERT INTO brokers\(id,name,email,phone/);
  assert.match(admin,/valid email, phone and user classification are required/);
});

test('User management groups Add User and existing User records together',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/\['listing_policy','Listing approval policy'\],\['users','User management'\],\['user_records','User records'\],\['integration_failures','Integration failures'\],\['operations','Operations & audit'\]/);
  assert.doesNotMatch(ui,/\['listing_policy','Inventory approval policy'\]/);
  assert.match(ui,/<h2>User records<\/h2>/);
  assert.match(ui,/id="broker-table"/);
  assert.match(ui,/data-edit-user-contact/);
});
