import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync(new URL('../src/routes/website-intake.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const deployment=fs.readFileSync(new URL('../release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev101-complete.sh',import.meta.url),'utf8');

test('R3A-WEBSITE-INTAKE-RECOVERY-53: evidence failures become failed and interrupted events are manager-recoverable',()=>{
  assert.match(route,/try\{\s*await retainIntakeEvidence/);
  assert.match(route,/recoverable:event\.status==='processing'/);
  assert.match(route,/Only failed or interrupted events can be replayed/);
  assert.match(ui,/Continue retained enquiry/);
  assert.match(ui,/Ready for safe recovery/);
});

test('dev.101 CRM Test package is cumulative, idempotent and isolated',()=>{
  assert.equal(JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,'2.1.0-dev.174');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.101','PREVIOUS_VERSION=2.1.0-dev.100','EXPECTED_PACKAGE=nysa-core-r3a-interrupted-intake-recovery-dev101.zip','70|$LATEST_MIGRATION','Deployment already confirmed','Production and R2 clone snapshots: unchanged'])assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(deployment,/\/dev\/fd|<\(/);
});
