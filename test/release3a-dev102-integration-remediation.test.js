import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A dev.102 is superseded by the isolation-corrected dev.103 release',()=>{
  const packageJson=JSON.parse(read('package.json'));
  const deployment=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev102-complete.sh');
  assert.equal(packageJson.version,'2.1.0-dev.174');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.102','PREVIOUS_VERSION=2.1.0-dev.101','EXPECTED_PACKAGE=nysa-core-r3a-integration-remediation-dev102.zip','LATEST_MIGRATION=070_release3a_email_only_intake_gate.sql','Deployment already confirmed','Production and R2 clone snapshots: unchanged'])assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('R3A WordPress connector carries the isolation correction',()=>{
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/Version: 1\.9\.4/);
  assert.match(plugin,/const VERSION = '1\.9\.4'/);
});
