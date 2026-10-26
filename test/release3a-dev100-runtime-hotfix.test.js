import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('dev.100 fixes website intake evidence retention without a schema change',()=>{
  const route=read('src/routes/website-intake.js');
  assert.match(route,/retainIntakeEvidence\(event,b,identity,client=undefined\)/);
  assert.doesNotMatch(route,/client=null/);
  assert.match(JSON.parse(read('package.json')).version,/^2\.1\.0-dev\.(?:100|10[1-9]|1[1-9]\d|[2-9]\d{2,})$/);
});

test('dev.100 CRM Test deployment is cumulative, idempotent and environment isolated',()=>{
  const script=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev100-complete.sh');
  for(const marker of [
    'EXPECTED_VERSION=2.1.0-dev.100',
    'PREVIOUS_VERSION=2.1.0-dev.99',
    'EXPECTED_PACKAGE=nysa-core-r3a-website-intake-runtime-dev100.zip',
    'LATEST_MIGRATION=070_release3a_email_only_intake_gate.sql',
    '70|$LATEST_MIGRATION',
    'WEBSITE_INTAKE_SECRET',
    'WEBSITE_INTAKE_ACTOR_ID',
    'APOLLO_API_KEY',
    'Deployment already confirmed',
    'Production and R2 clone snapshots: unchanged'
  ]) assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(script,/pg_dump/);
  assert.match(script,/pre-dev100-app\.tar\.gz/);
  assert.match(script,/sha256sum -c/);
  assert.match(script,/refusing to terminate unverified PID/);
  assert.doesNotMatch(script,/\/dev\/fd|<\(/);
});
