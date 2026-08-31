import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A-WEBSITE-PROFILE-46C retains governed intake evidence and promotes only accepted facts',()=>{
  const migration=read('src/migrations/070_release3a_email_only_intake_gate.sql'),route=read('src/routes/website-intake.js');
  for(const marker of ['customer_evidence_facts','pending_review','active','rejected','superseded','evidence_kind','retention_policy_code'])assert.match(migration,new RegExp(marker));
  assert.match(route,/retainIntakeEvidence/);
  assert.match(route,/review_status='active'/);
  assert.match(route,/review_status='rejected'/);
  assert.match(route,/contact_id=\$1,lead_id=\$2/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
});

test('R3A-WEBSITE-INTAKE-RUNTIME-52 uses the database pool when evidence retention has no transaction client',()=>{
  const route=read('src/routes/website-intake.js');
  assert.match(route,/async function retainIntakeEvidence\(event,b,identity,client=undefined\)/);
  assert.doesNotMatch(route,/retainIntakeEvidence\(event,b,identity,client=null\)/);
  assert.match(route,/await retainIntakeEvidence\(event,b,checked\.identity\)/);
});

test('R3A-INTAKE-EMAIL-42 archives an unusable email instead of promoting it when mobile is usable',()=>{
  const route=read('src/routes/website-intake.js');
  assert.match(route,/const trustedEmail=/);
  assert.match(route,/event\.emailCredibility\?\.status==='credible_domain'/);
  assert.match(route,/event\.resolution==='approve_email_only'/);
  assert.match(route,/phoneContact\|\|emailContact/);
  assert.match(route,/preferredChannel=!trustedEmail/);
  assert.match(route,/fact_code='submitted_email'/);
  assert.match(route,/not promoted to an active Customer contact channel/);
});

test('R3A-PROFILE-46 integrates accepted intake into Customer 360 and connected Lead screens',()=>{
  const crm=read('src/routes/crm.js'),ui=read('public/app.js');
  assert.match(crm,/intakeEvidence/);
  assert.match(crm,/f\.contact_id=\$1 AND f\.review_status='active'/);
  assert.match(crm,/f\.lead_id=\$1 AND f\.review_status='active'/);
  assert.match(ui,/Website declarations and source evidence/);
  assert.match(ui,/Original website declarations and attribution/);
  assert.match(ui,/feed this Lead, its structured requirement, Customer 360 and broker priority actions/);
});

test('R3A-INTAKE-EVIDENCE-58 promotes complete attribution and presents it in business language',()=>{
  const route=read('src/routes/website-intake.js'),ui=read('public/app.js');
  for(const marker of ['form_version','referrer','utm_source','utm_medium','utm_campaign','utm_content','utm_term'])assert.match(route,new RegExp(marker));
  for(const marker of ['How this enquiry reached NYSA','Original website page','Website form or AI tool','UTM source','UTM medium','UTM campaign','UTM content','UTM term','Not supplied'])assert.match(ui,new RegExp(marker));
  assert.match(ui,/Investment approach/);
  assert.match(ui,/Funding:/);
  assert.match(ui,/Holding period:/);
  assert.match(ui,/NYSA Investment Advisory Diagnostic/);
  assert.match(ui,/NYSA Investment Property Shortlist/);
});

test('R3A-INTEGRATION-FAILURES-55 separates recoverable intake from immutable audit history',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Integration Failures','integration_failures','What happened','What to do','Technical reference','No website integration failures'])assert.match(ui,new RegExp(marker));
  assert.match(ui,/\['failed','email_review','identity_review','duplicate_review'\]/);
  assert.match(ui,/x\.campaignMappingStatus==='unmapped'/);
  assert.match(ui,/Website intake history/);
  assert.doesNotMatch(ui,/id="audit-table">Loading…<\/div><div id="intake-table"/);
});

test('R3A-LEAKAGE-44 accepted intake uses normal Lead clocks while blocked evidence uses manager recovery',()=>{
  const intake=read('src/routes/website-intake.js'),priority=read('src/routes/opportunities.js');
  for(const marker of ['calculateDeadlines','lead_assignments','lead_requirements','consent_evidence'])assert.match(intake,new RegExp(marker));
  for(const marker of ['intake_email_review','intake_identity_review','intake_duplicate_review','intake_failed'])assert.match(priority,new RegExp(marker));
});
