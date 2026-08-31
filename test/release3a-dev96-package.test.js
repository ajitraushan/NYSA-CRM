import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Release 3A dev.96 CRM Test deployment is checksum-bound, Apollo-aware and environment-isolated',()=>{
  const script=fs.readFileSync(new URL('../release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev96-complete.sh',import.meta.url),'utf8');
  for(const marker of [
    'EXPECTED_VERSION=2.1.0-dev.96',
    'EXPECTED_PACKAGE=nysa-core-r3a-contact-credibility-dev96.zip',
    'LATEST_MIGRATION=068_release3a_contact_enrichment_evidence.sql',
    'Package checksum verified',
    'Secure CRM Test DB settings loaded from stable live PID',
    "grep -q '^APOLLO_API_KEY=.'",
    'Production and R2 clone snapshots: unchanged'
  ])assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(script,/68\|\$LATEST_MIGRATION/);
  assert.match(script,/refusing non-CRM-Test application root/);
  assert.match(script,/ZIP contains an absolute, traversal, or Windows-backslash path/);
  assert.doesNotMatch(script,/APOLLO_API_KEY=\$\{|echo.*APOLLO_API_KEY/i);
  assert.doesNotMatch(script,/\/dev\/fd|<\(/);
});
