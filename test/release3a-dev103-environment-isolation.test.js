import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A dev.103 deploys cumulatively from the still-deployed CRM Test dev.101 state',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  const deployment=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev103-complete.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.103','PREVIOUS_VERSION=2.1.0-dev.101','EXPECTED_PACKAGE=nysa-core-r3a-environment-isolation-dev103.zip','LATEST_MIGRATION=070_release3a_email_only_intake_gate.sql','Production and R2 clone snapshots: unchanged'])assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('R3A-ENV-ISOLATION-61 prevents the staging AI request reaching a legacy callback',()=>{
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/Version: 1\.9\.4/);
  assert.match(plugin,/add_filter\('rest_pre_dispatch'/);
  assert.match(plugin,/intercept_ai_lead_capture/);
  assert.match(plugin,/!self::is_staging_site\(\)/);
  assert.doesNotMatch(plugin,/rest_request_after_callbacks/);
  assert.match(plugin,/\$retained \? 201 : 503/);
});
