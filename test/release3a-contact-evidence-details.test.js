import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessContactCredibility,checkEmailCredibility } from '../src/email-credibility-domain.js';

test('R3A-PREKYC-EVIDENCE-50 records an explainable result for every email check',async()=>{
  const evidence=await checkEmailCredibility('client@example.com',{resolveMx:async()=>[{exchange:'mail.example.com',priority:10}]});
  assert.equal(evidence.status,'credible_domain');
  assert.deepEqual(evidence.checks.map(x=>x.code),['format','disposable_domain','placeholder_mailbox','role_mailbox','mx_domain']);
  assert.deepEqual(evidence.checks.map(x=>x.status),['passed','passed','passed','passed','passed']);
  assert.ok(evidence.checks.every(x=>x.label&&x.detail));
  assert.ok(evidence.checkedAt);
});

test('R3A-PREKYC-EVIDENCE-50 retains incomplete and flagged checks without claiming identity verification',async()=>{
  const invalid=await checkEmailCredibility('invalid');
  assert.equal(invalid.checks[0].status,'failed');
  assert.ok(invalid.checks.slice(1).every(x=>x.status==='not_checked'));
  const shared=await checkEmailCredibility('sales@example.com');
  assert.equal(shared.status,'review_advised');
  assert.equal(shared.checks.find(x=>x.code==='role_mailbox').status,'flagged');
});

test('R3A-PREKYC-EVIDENCE-50 persists and displays detailed email and Apollo evidence inside KYC',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const intake=fs.readFileSync(new URL('../src/routes/website-intake.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const domain=fs.readFileSync(new URL('../src/email-credibility-domain.js',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../src/migrations/069_release3a_contact_credibility_details.sql',import.meta.url),'utf8');
  assert.match(crm,/email_credibility_evidence=\$4::jsonb/);
  assert.match(crm,/email_professional_evidence=\$1::jsonb/);
  assert.match(intake,/email_credibility_evidence=\$4::jsonb/);
  assert.doesNotMatch(intake,/email_professional_evidence/);
  assert.match(migration,/ADD COLUMN email_credibility_evidence JSONB/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  for(const label of ['Format validity','Disposable-domain check','Placeholder/test mailbox check','Shared/role mailbox check','MX/mail-server check'])assert.match(domain,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const label of ['Run pre-KYC email check','Run paid Apollo professional check','View pre-KYC evidence details','Apollo match status','Apollo provider availability','Apollo company','Apollo position','Apollo seniority','Apollo company domain','Evidence checked'])assert.match(ui,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/emailChecks\.map\(check=>/);
  assert.match(ui,/does not verify the customer's identity and does not replace KYC/);
});

test('R3A-APOLLO-COST-CONTROL-51 calls Apollo only through the explicit paid action',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const intake=fs.readFileSync(new URL('../src/routes/website-intake.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(crm,/\/crm\/customers\/:id\/apollo-professional-evidence/);
  assert.match(crm,/paidProviderCall:true/);
  assert.match(crm,/apolloCalled:false/);
  assert.match(ui,/confirm\('Run one paid Apollo professional evidence request for this Customer\?'\)/);
  assert.match(ui,/Uses a paid Apollo request only when selected/);
  assert.doesNotMatch(intake,/checkApolloProfessionalEvidence|assessContactCredibility/);
});

test('R3A-APOLLO-COST-CONTROL-51 combined assessment defaults safely to no Apollo call',async()=>{
  let calls=0;
  const result=await assessContactCredibility('client@example.com',{email:{resolveMx:async()=>[{exchange:'mail.example.com'}]},apollo:{env:{APOLLO_API_KEY:'secret'},fetchImpl:async()=>{calls++;throw new Error('must not call');}}});
  assert.equal(calls,0);
  assert.equal(result.apolloCalled,false);
  assert.equal(result.professionalEvidence.status,'not_requested');
});
