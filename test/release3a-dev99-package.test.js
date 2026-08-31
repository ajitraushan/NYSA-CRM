import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('dev.99 CRM Test package accepts dev.98 migration 069 and applies evidence migration 070',()=>{
  const script=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev99-complete.sh');
  assert.match(script,/EXPECTED_VERSION=2\.1\.0-dev\.99/);
  assert.match(script,/EXPECTED_PACKAGE=nysa-core-r3a-website-intake-dev99\.zip/);
  assert.match(script,/CONTACT_DETAILS_MIGRATION=069_release3a_contact_credibility_details\.sql/);
  assert.match(script,/LATEST_MIGRATION=070_release3a_email_only_intake_gate\.sql/);
  assert.match(script,/69\|\$CONTACT_DETAILS_MIGRATION/);
  assert.match(script,/70\|\$LATEST_MIGRATION/);
  assert.match(script,/2\.1\.0-dev\.98\|2\.1\.0-dev\.99/);
  assert.match(script,/pgrep -afu "\$USER" '\[n\]ode'/);
  assert.match(script,/\$2 == label/);
  assert.match(script,/APOLLO_API_KEY/);
  assert.match(script,/Production and R2 clone snapshots: unchanged/);
  assert.doesNotMatch(script,/\/dev\/fd|<\(/);
});

test('dev.99 traceability covers Customer 360, workflow and quarantined evidence',()=>{
  const trace=read('release-artifacts/release-3/r3a/RELEASE_3A_DEV99_WEBSITE_INTAKE_TRACEABILITY.md');
  for(const marker of ['Customer 360','Lead detail','Structured Requirement','Broker priority','Manager recovery','Campaign','Opportunity','345/345'])assert.match(trace,new RegExp(marker));
});
