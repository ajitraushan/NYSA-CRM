import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dev.98 CRM Test package preserves migration 068, applies 069 and accepts the live dev.97 baseline',()=>{
  const script=fs.readFileSync(new URL('../release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev98-complete.sh',import.meta.url),'utf8');
  assert.match(script,/EXPECTED_VERSION=2\.1\.0-dev\.98/);
  assert.match(script,/EXPECTED_PACKAGE=nysa-core-r3a-release-sync-dev98\.zip/);
  assert.match(script,/2\.1\.0-dev\.97\|2\.1\.0-dev\.98/);
  assert.match(script,/\(96\|97\|98\)/);
  assert.match(script,/68\|\$CONTACT_ENRICHMENT_MIGRATION/);
  assert.match(script,/69\|\$LATEST_MIGRATION/);
  assert.match(script,/for attempt in \$\(seq 1 30\)/);
  assert.match(script,/pgrep -afu "\$USER" '\[n\]ode'/);
  assert.match(script,/\$2 == label/);
  assert.doesNotMatch(script,/pgrep -afu "\$USER" node/);
  assert.doesNotMatch(script,/\/dev\/fd|<\(/);
});
