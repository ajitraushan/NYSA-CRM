import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs', import.meta.url), 'utf8');

test('DEV265 operator binds both full-schema manifests and checks every deployment phase', () => {
  for (const field of ['schemaContractHelperPath', 'schemaContractHelperSha256', 'baselineSchemaContractManifestSha256', 'expectedSchemaContractManifestSha256']) {
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
  assert.match(source, /schema-contract helper file missing/);
  assert.match(source, /schema-contract helper hash mismatch: expected/);
  assert.match(source, /schema-contract helper export missing/);
  assert.match(source, /loadSchemaContractIdentity/);
  assert.doesNotMatch(source, /path\.join\(config\.candidate,'tools','database-schema-contract\.mjs'\)/);
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

test('migration-neutral phases use the matching canonical schema and pin the installed runtime', () => {
  const settings=source.slice(source.indexOf('const migrationNeutral='),source.indexOf('if(!Array.isArray(config.expectedTriggerDriftDataChecks))'));
  const manifest='a'.repeat(64);
  const config={baselineMigrationCount:172,expectedMigrationCount:172,
    baselineSchemaContractManifestSha256:manifest,expectedSchemaContractManifestSha256:manifest,baselineRuntimeManifestSha256:manifest};
  assert.equal(vm.runInNewContext(settings+'migrationNeutral',{config}),true);
  assert.throws(()=>vm.runInNewContext(settings,{config:{...config,expectedSchemaContractManifestSha256:'b'.repeat(64)}}),/must match/);
  assert.throws(()=>vm.runInNewContext(settings,{config:{...config,baselineRuntimeManifestSha256:undefined}}),/installed runtime manifest hash/);
  assert.equal(vm.runInNewContext(settings+'migrationNeutral',{config:{...config,baselineMigrationCount:171}}),false);
  assert.match(source,/const usePriorSchema=kind==='baseline'&&!migrationNeutral/);
});
