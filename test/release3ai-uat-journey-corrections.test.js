import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('same-customer Property Selection promotes a corrected credible email without losing the prior channel',()=>{
  const route=read('src/routes/website-intake.js');
  assert.match(route,/journeyContact=journeyKey&&b\.form==='ai_property_selection_v1'/);
  assert.match(route,/phoneContact\|\|emailContact\|\|journeyContact/);
  assert.match(route,/identityContactIds\.length>1/);
  assert.match(route,/if\(trustedEmail&&contact\.email&&contact\.email\.toLowerCase\(\)!==trustedEmail\.toLowerCase\(\)\)/);
  assert.match(route,/WHERE contact_id=\$2 AND channel_kind='Email'/);
  assert.match(route,/usage_label=CASE WHEN normalized_value=\$1 THEN 'Primary' ELSE 'Previous' END/);
  assert.match(route,/UPDATE contacts SET email=\$1,email_status=\$2/);
  assert.match(route,/website_journey_primary_email_changed/);
  assert.match(route,/previousEmail,newEmail:trustedEmail/);
});

test('advisory budget answer codes are promoted to AED amounts rather than literal code digits',()=>{
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/'b_1_2' => array\('min' => 1000000, 'max' => 2000000\)/);
  assert.match(plugin,/'b_2_5' => array\('min' => 2000000, 'max' => 5000000\)/);
  assert.match(plugin,/'b_5plus' => array\('min' => 5000000, 'max' => null\)/);
  assert.match(plugin,/if \(isset\(\$advisory_ranges\[\$answer_code\]\)\)/);
});

test('manager integration review exposes decision-ready submitted evidence without returning the raw payload',()=>{
  const route=read('src/routes/website-intake.js'),app=read('public/app.js');
  assert.match(route,/reviewEvidence:intakeReviewEvidence\(receivedPayload\)/);
  assert.match(route,/const \{receivedPayload,\.\.\.safeEvent\}=event/);
  for(const marker of ['Customer / enquiry','Review submitted enquiry','Customer message','Property requirement','Marketing consent'])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(app,/r\.fullName\|\|'Customer name unavailable'/);
  assert.match(app,/\[r\.email,r\.phone\]/);
});

test('combined final UAT fixes advance only the CRM Test and staging connector candidates',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/Version: 1\.9\.4/);assert.match(plugin,/VERSION = '1\.9\.4'/);assert.match(plugin,/nysa-wordpress-bridge-1\.9\.4/);
  const deploy=read('release-artifacts/release-3/r3a/deploy-crm-test-r3ai-dev112-final-uat-fixes.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.112','PREVIOUS_VERSION=2.1.0-dev.111','EXPECTED_PACKAGE=nysa-core-r3ai-final-uat-fixes-dev112.zip','LATEST_MIGRATION=074_release3ai_governed_website_routing.sql','74|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.match(deploy,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
