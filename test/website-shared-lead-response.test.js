import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {websiteFollowUpInput} from '../src/website-follow-up-intake.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('website follow-up normalization only enables the approved UAE/India locations and explicit channels',()=>{
  const ready=websiteFollowUpInput({form:'contact_enquiry_v2',intakeCompleteness:'complete',
    location:{country:'AE',timeZone:'Asia/Dubai',confirmed:true},
    consent:{statementVersion:'response-v1',aiWhatsapp:true,aiEmail:true},
    requirement:{purpose:'investment',timelineCode:'within_3_months',fundingMethod:'cash',budgetMin:1000000,budgetMax:2000000,areas:['Dubai Marina']}});
  assert.equal(ready.locationConfirmed,true);
  assert.deepEqual(ready.consent,{statementVersion:'response-v1',whatsapp:true,email:true});
  assert.equal(ready.declaredRequirements.source,'website');
  assert.equal(ready.declaredRequirements.completeness,'complete');

  const partial=websiteFollowUpInput({intakeCompleteness:'partial',location:{country:'US',timeZone:'America/New_York',confirmed:true},consent:{statementVersion:'nia-v1'}});
  assert.equal(partial.locationConfirmed,false);
  assert.equal(partial.consent.whatsapp,false);
  assert.equal(partial.consent.email,false);
  assert.equal(partial.declaredRequirements.completeness,'partial');
});

test('migration and worker keep website intake out of Meta retrieval while sharing the case pipeline',()=>{
  const migration=read('src/migrations/155_website_shared_lead_response.sql');
  const route=read('src/routes/website-intake.js');
  const worker=read('src/nonvoice-worker.js');
  assert.match(migration,/source_system IN \('meta','website'\)/);
  assert.match(migration,/website_intake_event_id UUID UNIQUE REFERENCES website_intake_events/);
  assert.match(route,/openWebsiteFollowUp/);
  assert.match(route,/followUpCaseId/);
  assert.match(worker,/source_system='meta' AND state='pending_retrieval'/);
});

test('WordPress bridge signs one CORE endpoint and durably captures both contact and NIA routes',()=>{
  const plugin=read('integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php');
  const contact=read('integrations/wordpress/staging-overrides/page-contact-us.php');
  const themePatch=read('integrations/wordpress/staging-overrides/apply-functions-contact-core-hook.mjs');
  for(const marker of ['nysa_core_lead_outbox','X-NYSA-Timestamp','X-NYSA-Signature','hash_hmac','capture_contact_saved','capture_nia','retry_due','NYSA_CORE_INTAKE_URL','NYSA_CORE_INTAKE_SECRET'])assert.match(plugin,new RegExp(marker));
  assert.match(plugin,/add_action\('nysa_contact_lead_saved'/);
  assert.doesNotMatch(plugin,/admin_post_nopriv_nysa_contact_enquiry.*capture_contact/);
  assert.doesNotMatch(plugin,/my\.remapp\.ae|rem_token|send_to_rem/);
  assert.match(themePatch,/660cd1b1f407676924c4b783b56c1c208080d83e549f952a5cc73bbf21daa719/);
  assert.match(themePatch,/do_action\('nysa_contact_lead_saved'/);
  assert.match(contact,/name="country"/);
  assert.match(contact,/name="purpose"/);
  assert.match(contact,/name="timeline"/);
  assert.match(contact,/name="ai_assisted_contact"/);
  assert.match(contact,/CRM Test only/);
});

test('origin package scope includes the governed WordPress bridge artifacts',()=>{
  const builder=read('tools/release-origin-core.mjs');
  assert.match(builder,/name\.startsWith\('integrations\/wordpress\/'\)/);
});
