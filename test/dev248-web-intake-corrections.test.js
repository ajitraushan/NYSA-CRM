import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV248 enforces the sequential shared desk to owner confirmation boundary',()=>{
  const workflow=read('src/web-intake-workflow.js'),ui=read('public/web-intake-phase1-ui.js');
  assert.match(workflow,/lead_id=NULL,case_kind=\$3/);
  assert.match(workflow,/\['completed_intake','incomplete_recovery'\]\.includes\(caseRow\.case_kind\)/);
  assert.match(workflow,/intake_confirmed_and_promoted/);
  assert.match(ui,/No Lead will be created until you confirm the enquiry/);
  assert.match(ui,/Confirm and create Lead/);
});

test('DEV248 exposes governed closed intake history',()=>{
  const migration=read('src/migrations/159_dev248_intake_corrections.sql'),workflow=read('src/web-intake-workflow.js'),ui=read('public/web-intake-phase1-ui.js');
  assert.match(migration,/closed_at TIMESTAMPTZ/);
  assert.match(migration,/closed_by UUID REFERENCES brokers/);
  assert.match(workflow,/close_outcome=\$2,closed_at=NOW\(\),closed_by=\$3/);
  assert.match(ui,/Closed history/);
  for(const outcome of ['not_genuine','duplicate','spam','invalid'])assert.match(workflow,new RegExp(outcome));
});

test('DEV248 repairs the Contact Form contract and keeps invalid numbers visible at entry',()=>{
  const plugin=read('integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php'),page=read('integrations/wordpress/staging-overrides/page-contact-us.php');
  assert.match(plugin,/Version: 1\.2\.0/);
  assert.match(plugin,/contact_enquiry_v2/);
  assert.match(plugin,/normalize_phone/);
  assert.match(plugin,/!empty\(\$response\['journeyId'\]\) && !empty\(\$response\['caseId'\]\)/);
  assert.match(page,/name="property_type"/);
  assert.match(page,/Market stage \*/);
  assert.match(page,/setCustomValidity/);
  assert.match(page,/queued for CRM Test/);
});

test('DEV248 maps NIA declarations to governed classification while retaining raw answers',()=>{
  const plugin=read('integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php');
  for(const marker of ["'customerObjective' => 'buy'","'marketStageRequirement' => $market_stage","'propertySegmentRequirement' => $property_segment","'answers' => $answers","'emailVerificationStatus'"])
    assert.match(plugin,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

