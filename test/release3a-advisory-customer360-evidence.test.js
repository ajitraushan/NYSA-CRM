import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
const intake=read('src/routes/website-intake.js');
const app=read('public/app.js');
const migration=read('src/migrations/071_release3a_advisory_customer360_evidence.sql');
const deployment=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev107-complete.sh');
const questionIds=['residency','rent','household','daily_anchor','zone','budget','funding','monthly','rent_replace','horizon','goal','risk'];

test('R3A-ADVISORY-EVIDENCE-63 captures all 12 governed questions with readable answer labels',()=>{
  for(const id of questionIds){
    assert.match(bridge,new RegExp(`\\['${id}',`));
    assert.match(plugin,new RegExp(`'${id}' => array\\(`));
    assert.match(intake,new RegExp(`\\['${id}',`));
  }
  assert.match(bridge,/advisoryAnswerEvidence/);
  assert.match(bridge,/answerLabel/);
  assert.match(bridge,/advisory_evidence/);
  assert.match(bridge,/answers_json: JSON\.stringify\(structuredAnswers\)/);
  assert.match(plugin,/'advisoryEvidence' =>/);
});

test('R3A-ADVISORY-EVIDENCE-63 retains the generated advisory direction separately from the answers',()=>{
  for(const field of ['clientProfile','recommendedRoute','summary','focusAreas','whatToAvoid']){
    assert.match(bridge,new RegExp(field));
    assert.match(plugin,new RegExp(`'${field}'`));
    assert.match(intake,new RegExp(field));
  }
  assert.match(bridge,/advisory_summary/);
  assert.match(bridge,/advisory_summary_json/);
  assert.match(intake,/advisory_summary/);
});

test('R3A-ADVISORY-EVIDENCE-63 exposes the latest structured journey in Customer 360',()=>{
  assert.match(intake,/advisory_answer_\$\{questionId\}/);
  assert.match(intake,/rows\.slice\(0,12\)/);
  assert.match(app,/AI Advisory evidence/);
  assert.match(app,/Generated advisory direction/);
  assert.match(app,/Customer answers/);
  assert.match(app,/advisoryAnswers\.length/);
  assert.match(app,/supports the broker conversation but is not KYC, financial advice or verified fact/);
});

test('R3A-ADVISORY-EVIDENCE-63 migration governs advisory facts and safely backfills retained journeys',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  assert.match(migration,/fact_group IN \('identity','enquiry','requirement','profile','attribution','consent','advisory'\)/);
  assert.match(migration,/jsonb_each_text\(COALESCE\(e\.received_payload/);
  assert.match(migration,/advisory_answer_'\|\|a\.question_id/);
  assert.match(migration,/Backfilled from retained accepted AI Advisory intake evidence/);
  assert.match(migration,/ON CONFLICT\(intake_event_id,fact_code\) DO NOTHING/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/);
});

test('dev.107 deployment is cumulative, rerunnable and isolated to CRM Test',()=>{
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.107','PREVIOUS_VERSION=2.1.0-dev.103','PREVIOUS_MIGRATION=070_release3a_email_only_intake_gate.sql','LATEST_MIGRATION=071_release3a_advisory_customer360_evidence.sql','EXPECTED_PACKAGE=nysa-core-r3a-advisory-customer360-dev107.zip','Deployment already confirmed','Production and R2 clone snapshots: unchanged']){
    assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(deployment,/pg_dump/);
  assert.match(deployment,/pre-dev107-app\.tar\.gz/);
  assert.match(deployment,/Previously discovered CRM Test PID \$pid already exited; continuing safely/);
  assert.doesNotMatch(deployment,/\/dev\/fd|process substitution/);
});
