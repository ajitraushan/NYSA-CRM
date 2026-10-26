import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const script = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'deploy-crm-test-dev210.sh'),
  'utf8',
);

test('DEV210 deployment is locked to CRM Test and protects production roots', () => {
  assert.match(script, /APP_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(script, /PRODUCTION_ROOT=\/home\/nysareal\/nysa-crm/);
  assert.match(script, /R2_CLONE_ROOT=\/home\/nysareal\/nysa-r2-prod-clone/);
  assert.match(script, /Production and R2 clone were not targeted/);
  assert.match(script, /protected environment changed/);
});

test('DEV210 deployment requires the approved origin provenance and checksums', () => {
  assert.match(script, /REPOSITORY_URL=https:\/\/github\.com\/ajitraushan\/NYSA-CRM\.git/);
  assert.match(script, /EXPECTED_COMMIT.*\{40\}/);
  assert.match(script, /APPROVED_SHA256.*\{64\}/);
  assert.match(script, /manifest identity or test receipt mismatch/);
  assert.match(script, /embedded provenance mismatch/);
  assert.match(script, /RUNTIME_MANIFEST\.sha256/);
  assert.match(script, /RELEASE_PROVENANCE\.json/);
});

test('DEV210 deployment accepts only DEV208 or an idempotent DEV210 baseline', () => {
  assert.match(script, /EXPECTED_VERSION=2\.1\.0-dev\.210/);
  assert.match(script, /PREVIOUS_VERSION=2\.1\.0-dev\.208/);
  assert.match(script, /EXPECTED_MIGRATION_COUNT=127/);
  assert.match(script, /127_governed_purchased_data_intake\.sql/);
});

test('DEV210 deployment backs up and verifies the resulting service', () => {
  assert.match(script, /pg_dump/);
  assert.match(script, /pre-dev210-app\.tar\.gz/);
  assert.match(script, /api\/health/);
  assert.match(script, /api\/readiness/);
  assert.match(script, /verify_worker_socket/);
  assert.match(script, /verify_switches/);
  assert.match(script, /verify_contract/);
});
