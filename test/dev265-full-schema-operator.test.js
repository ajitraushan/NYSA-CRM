import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs', import.meta.url), 'utf8');

test('DEV265 operator binds both full-schema manifests and checks every deployment phase', () => {
  for (const field of ['baselineSchemaContractManifestSha256', 'expectedSchemaContractManifestSha256']) {
    assert.match(source, new RegExp(`'${field}'`));
  }
  for (const marker of [
    "schemaContractComparison(pool,'baseline','stage')",
    "schemaContractComparison(pool,'baseline','backup')",
    "schemaContractComparison(pool,'baseline','pre-install')",
    "schemaContractComparison(verificationPool,'canonical','post-deployment')",
  ]) assert.ok(source.includes(marker), marker);
  assert.match(source, /for\(const name of \['constraints','indexes','columns','functions','sequencesViews','triggers'\]\)/);
  assert.match(source, /full schema-contract mismatch/);
});

test('DEV265 operator records the full-schema result in the scoped backup and failure evidence', () => {
  assert.match(source, /schemaContractComparison:report\.schemaContractComparison/);
  assert.match(source, /failedSchemaContractComparison=error\.schemaContractComparison/);
  assert.match(source, /if\(!comparison\.matches\)throw Object\.assign/);
});

test('DEV265 operator retains the governed rollback boundary', () => {
  assert.doesNotMatch(source, /pg_restore\W+--clean/);
  assert.match(source, /if\(readinessAccepted\)report\.result='POST_READINESS_CHECK_FAILED_APP_PRESERVED'/);
  assert.match(source, /databaseRestorePerformed:false/);
});
