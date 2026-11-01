import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('DEV261 operator is versioned, direct-node compatible and has no hard-coded backup path',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/args\['backup-path'\]/);
  assert.doesNotMatch(source,/const backup\s*=\s*['"]\/home\/nysareal\/backup-/);
  assert.match(source,/mode:'stage-and-deploy-once'/);
  assert.match(source,/totalTimeoutMinutes/);
  assert.match(source,/backupMaxAgeMinutes/);
  assert.match(source,/STAGE_RESULT\.json/);
  assert.match(source,/DEPLOYED_TECHNICAL_CHECKS_PASSED/);
  assert.match(source,/report\.cleanup=cleanAfterHealth/);
  assert.match(source,/inspectWorkers\(config\.root\)/);
});
