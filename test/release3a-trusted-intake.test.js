import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyEmailEvidence,checkEmailCredibility,EMAIL_CREDIBILITY_POLICY } from '../src/email-credibility-domain.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A-INTAKE-EMAIL-42 explains credibility without claiming person verification',async()=>{
  assert.equal(classifyEmailEvidence('buyer@mailinator.com').status,'review_advised');
  assert.equal(classifyEmailEvidence('info@nysarealty.com',{mxRecords:[{exchange:'mail.example'}]}).status,'review_advised');
  const credible=await checkEmailCredibility('buyer@nysarealty.com',{resolveMx:async()=>[{exchange:'mail.example'}]});
  assert.equal(credible.status,'credible_domain');assert.match(credible.reason,/does not verify the person/i);
  const unavailable=await checkEmailCredibility('buyer@nysarealty.com',{resolveMx:async()=>{throw new Error('offline');}});
  assert.equal(unavailable.status,'check_unavailable');assert.match(unavailable.reason,/enquiry remains accepted/i);
  assert.equal(EMAIL_CREDIBILITY_POLICY.personVerificationClaimed,false);
});

test('R3A-DUPLICATE-43 retains conflicting identities for governed review instead of guessing',()=>{
  const route=read('src/routes/website-intake.js'),migration=read('src/migrations/063_release3a_trusted_intake_evidence.sql'),ui=read('public/app.js');
  for(const marker of ['emailContact&&phoneContact&&emailContact.id!==phoneContact.id','identity_review','IDENTITY_CONFLICT','forcedContactId','resolve-identity'])assert.match(route,new RegExp(marker.replaceAll('&&','\\&\\&')));
  assert.match(route,/Resolution reason is required/);assert.match(route,/received_payload/);assert.match(route,/checkEmailCredibility/);assert.doesNotMatch(route,/checkApolloProfessionalEvidence|assessContactCredibility/);
  assert.match(migration,/identity_conflict_contact_ids/);assert.match(migration,/email_credibility_status/);assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(ui,/Use email Customer/);assert.match(ui,/Use mobile Customer/);assert.match(ui,/CORE will not guess/);
});

test('R3A-INTAKE-EMAIL-42 gates non-credible email-only traffic before Customer creation',()=>{
  const route=read('src/routes/website-intake.js'),migration=read('src/migrations/070_release3a_email_only_intake_gate.sql'),ui=read('public/app.js'),priority=read('src/routes/opportunities.js');
  assert.match(route,/function emailOnlyGate/);
  assert.match(route,/identity\.phone\|\|!identity\.email/);
  assert.match(route,/emailCredibility\?\.status==='credible_domain'/);
  assert.match(route,/EMAIL_ONLY_CREDIBILITY_REVIEW/);
  assert.match(route,/email_only_review_required/);
  assert.match(route,/resolve-email/);
  assert.match(route,/approve_email_only/);
  assert.match(route,/email_only_rejected/);
  assert.match(route,/phoneContact\|\|emailContact/);
  assert.match(migration,/email_review/);
  assert.match(migration,/intake_email_review/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(ui,/Approve genuine enquiry/);
  assert.match(ui,/Reject dummy \/ bot/);
  assert.match(priority,/review_intake_email/);
});

test('R3A-DUPLICATE-43 controls materially repeated Leads without blocking distinct requirements',()=>{
  const route=read('src/routes/website-intake.js'),migration=read('src/migrations/066_release3a_duplicate_lead_review.sql'),ui=read('public/app.js');
  assert.match(route,/requirementFingerprint/);assert.match(route,/INTERVAL '30 days'/);assert.match(route,/POSSIBLE_DUPLICATE_LEAD/);assert.match(route,/forceDistinctLead/);
  for(const marker of ['use_existing_lead','create_distinct_lead','reject_invalid','resolve-lead-duplicate','Duplicate resolution reason is required'])assert.match(route,new RegExp(marker));
  assert.match(route,/duplicate_lead_linked/);assert.match(route,/distinct_lead_approved/);
  assert.match(migration,/duplicate_candidate_lead_id/);assert.match(migration,/requirement_fingerprint/);assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(ui,/Use existing Lead/);assert.match(ui,/Create distinct Lead/);assert.match(ui,/Possible duplicate Lead resolved/);
});

test('R3A-CAMPAIGN-45 governs campaign identity while preserving raw intake evidence',()=>{
  const route=read('src/routes/website-intake.js'),campaigns=read('src/routes/campaigns.js'),migration=read('src/migrations/065_release3a_campaign_governance.sql'),server=read('src/server.js'),ui=read('public/app.js');
  for(const marker of ['source_code','campaign_code','source_page','source_form'])assert.match(route,new RegExp(marker));
  assert.match(route,/campaign_external_mappings/);assert.match(route,/campaignMappingStatus/);assert.match(route,/governedCampaignCode/);
  for(const marker of ['marketing_campaigns','campaign_external_mappings','campaign_mapping_status','planned_budget','operational_targets'])assert.match(migration,new RegExp(marker));
  assert.match(campaigns,/Administrator or Director campaign authority is required/);assert.match(campaigns,/campaign_status_changed|status_changed/);assert.match(campaigns,/reconciledEvents/);assert.match(campaigns,/campaign_mapping_status='unmapped'/);
  for(const metric of ['accepted_count','responded_count','qualified_count','opportunity_count','won_count'])assert.match(campaigns,new RegExp(metric));
  assert.match(server,/campaignRoutes/);assert.match(ui,/Campaign governance/);assert.match(ui,/Unmapped incoming campaign values/);assert.match(ui,/original campaign value/);
  assert.match(ui,/Operational outcomes/);assert.match(ui,/Financial ROI remains outside Release 3A/);
  assert.match(ui,/Original page not recorded/);assert.match(ui,/Secrets and sensitive payloads are never displayed here/);
});

test('R3A-LEAKAGE-44 puts unresolved website identity work on the manager priority landing',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/dashboard-ui.js');
  assert.match(route,/intakeReviewCases/);assert.match(route,/Customer identity conflict is blocking website enquiry creation/);assert.match(route,/review_intake_identity/);
  assert.match(route,/review_duplicate_lead/);assert.match(route,/possible repeated Lead requires a governed decision/i);
  assert.match(ui,/data-guided-intake/);assert.match(ui,/Review intake/);assert.match(ui,/WebsiteIntake/);
});

test('R3A-LEAKAGE-44 consolidates durable manager recovery and closes only cleared conditions',()=>{
  const route=read('src/routes/opportunities.js'),migration=read('src/migrations/067_release3a_lead_recovery_cases.sql'),ui=read('public/dashboard-ui.js'),html=read('public/index.html');
  for(const marker of ['intake_identity_review','intake_duplicate_review','intake_failed','unassigned_ageing','acceptance_breach','first_contact_breach','no_next_action','overdue_next_action','overdue_task','repeated_reassignment'])assert.match(migration,new RegExp(marker));
  assert.match(route,/refreshRecoveryCases/);assert.match(route,/ON CONFLICT\(case_key\)/);assert.match(route,/authoritative_condition_cleared/);assert.match(route,/recoveryCases/);
  assert.match(ui,/Lead leakage recovery/);assert.match(ui,/Cases close automatically only after the underlying governed condition is corrected/);assert.match(ui,/data-recovery-lead/);assert.match(ui,/data-recovery-intake/);
  assert.match(html,/manager-recovery-register/);assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
});

test('R3A-WEBSITE-PROFILE-46C imports declared website-tool evidence without broker re-entry',()=>{
  const migration=read('src/migrations/064_release3a_website_profile_evidence.sql'),intake=read('src/routes/website-intake.js'),customer=read('src/routes/crm.js'),ui=read('public/app.js');
  for(const marker of ['declared_priorities','must_haves','preferences','exclusions','acceptable_trade_offs','source_tool_code','source_tool_version'])assert.match(migration,new RegExp(marker));
  assert.match(intake,/buyer_profile/);assert.match(intake,/investment_profile/);assert.match(intake,/website_profile/);assert.match(intake,/source_event_id/);
  assert.match(customer,/requirement_declared_priorities/);assert.match(customer,/requirement_source_tool_code/);
  assert.match(ui,/What matters to the customer/);assert.match(ui,/Imported from/);assert.match(ui,/Broker-recorded evidence/);
});
