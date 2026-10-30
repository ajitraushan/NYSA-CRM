import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  intakeMissingFields,maskWebIdentity,nextCustomerWindow,openWebIdentity,sealWebIdentity,
  structuredIntakeSummary,webIdentityMatchHash,webIntakeMode
} from '../src/web-intake-workflow.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV248 assigns explicit single-step and multi-step journey modes',()=>{
  assert.equal(webIntakeMode('website','contact_form'),'single_step');
  assert.equal(webIntakeMode('website','contact_enquiry_v2'),'single_step');
  assert.equal(webIntakeMode('website','ai_advisory_v1'),'multi_step');
  assert.equal(webIntakeMode('meta','any_meta_form'),'single_step');
  assert.throws(()=>webIntakeMode('other',null),/not configured/);
});

test('DEV247 protects provisional identity with randomized encryption and keyed matching',()=>{
  const key='11'.repeat(32),identity={fullName:'Synthetic Customer',email:'synthetic@example.invalid',phone:'+971500000000'};
  const first=sealWebIdentity(identity,key),second=sealWebIdentity(identity,key);
  assert.notEqual(first,second);
  assert.deepEqual(openWebIdentity(first,key),identity);
  assert.equal(webIdentityMatchHash(identity.phone,'a'.repeat(32)).length,64);
  assert.notEqual(webIdentityMatchHash(identity.phone,'a'.repeat(32)),webIdentityMatchHash(identity.phone,'b'.repeat(32)));
  assert.deepEqual(maskWebIdentity(identity),{maskedName:'S… C',maskedEmail:'s***@example.invalid',maskedPhone:'••••0000'});
});

test('DEV248 structured summary preserves declarations, classification and missing promotion facts',()=>{
  const summary=structuredIntakeSummary({businessType:'Sale',customerObjective:'buy',marketStageRequirement:'off_plan',propertySegmentRequirement:'residential',contact:{preferredChannel:'WhatsApp'},requirement:{purpose:'investment',propertyTypes:['Apartment'],
    areas:['Dubai Marina'],budgetMin:1000000,budgetMax:1500000,fundingMethod:'cash',timelineCode:'0_3_months',bedroomsMin:2,bedroomsMax:3},
    consent:{marketing:true,statementVersion:'test-v1'}});
  assert.equal(summary.purpose,'investment');
  assert.equal(summary.marketStageRequirement,'off_plan');
  assert.deepEqual(summary.propertyTypes,['Apartment']);
  assert.deepEqual(intakeMissingFields(summary,'promotion'),[]);
  assert.deepEqual(intakeMissingFields({...summary,areas:[],declaredLocation:null,budgetMin:null,budgetMax:null},'promotion'),['location or area','budget band']);
});

test('DEV247 customer-window helper defers an after-hours task',()=>{
  const result=nextCustomerWindow('2026-10-29T22:00:00+04:00','Asia/Dubai');
  assert.equal(result.dueAtOpen,true);
  assert.equal(result.dueAt.toISOString(),'2026-10-30T05:00:00.000Z');
});

test('DEV248 migration adds governed closure history without rewriting prior data',()=>{
  const migration=read('src/migrations/158_web_intake_phase1_foundation.sql');
  const correction=read('src/migrations/159_dev248_intake_corrections.sql');
  assert.match(migration,/CREATE TABLE web_intake_journeys/);
  assert.match(migration,/CREATE TABLE web_intake_provisional_identities/);
  assert.match(migration,/ALTER TABLE lead_follow_up_cases ALTER COLUMN lead_id DROP NOT NULL/);
  assert.match(migration,/tasks_one_open_primary_follow_up_idx/);
  assert.match(migration,/WHERE follow_up_case_id IS NOT NULL AND is_primary_next_action AND status IN \('open','in_progress'\)/);
  assert.match(migration,/provisional_retention_days INTEGER NOT NULL DEFAULT 30/);
  assert.match(correction,/ADD COLUMN closed_at TIMESTAMPTZ/);
  assert.match(correction,/not_genuine/);
});

test('DEV248 source paths defer Lead creation until owner confirmation',()=>{
  const website=read('src/routes/website-intake.js'),meta=read('src/meta-lead-retrieval.js'),workflow=read('src/web-intake-workflow.js');
  assert.match(website,/recordWebIntakeJourney\(\{event,payload:b,identity:checked\.identity,actorId:actor\.id\}/);
  assert.doesNotMatch(meta,/INSERT INTO leads/);
  assert.match(workflow,/SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(workflow,/Only an active Sales Agent or Manager can pick up WEB intake/);
  assert.match(workflow,/lead_id=NULL,case_kind=\$3/);
  assert.match(workflow,/intake_confirmed_and_promoted/);
});

test('DEV247 UI uses the approved operational names and removes abstract response KPIs',()=>{
  const app=read('public/app.js'),ui=read('public/web-intake-phase1-ui.js'),roles=read('src/role-access.js');
  assert.match(app,/incomingLeads:'WEB Intake Leads'/);
  assert.match(app,/leadResponse:'My Lead Queue'/);
  assert.match(ui,/Dropped \/ incomplete/);
  assert.match(ui,/Available to pick up/);
  assert.doesNotMatch(ui,/Contact rate|Callbacks per 10 leads|Average acceptance/);
  assert.match(roles,/workspaceTabs:frozen\(\['admin','incomingLeads','purchasedDataImport'/);
});

test('DEV248 release identity and design evidence are present',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.248');
  assert.match(read('docs/change-requests/NYSA-CRM-20261030-DEV248-WEB-INTAKE-CORRECTIONS.md'),/Approved sequential boundary/);
  assert.match(read('docs/change-requests/NYSA-CRM-20261029-LEAD-003-WEB-INTAKE-DETAILED-DESIGN-v1.3-developer.md'),/Phase 1 — Journey and pickup foundation/);
});
