import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV219 installer is CRM-Test-only, provenance-bound, backup-first and migration-neutral',()=>{
  const deploy=read('scripts/deploy-crm-test-dev219.sh');
  for(const marker of [
    'EXPECTED_VERSION=2.1.0-dev.219',
    'PREVIOUS_VERSION=2.1.0-dev.218',
    'PREVIOUS_MIGRATION=132_approved_documents_and_brand.sql',
    'PREVIOUS_MIGRATION_COUNT=132',
    'LATEST_MIGRATION=132_approved_documents_and_brand.sql',
    'EXPECTED_MIGRATION_COUNT=132',
    'nysa-core-2.1.0-dev.219-origin.zip',
    'RELEASE_PROVENANCE.json',
    'RUNTIME_MANIFEST.sha256',
    'pg_dump',
    'pre-dev219.dump',
    'pre-dev219-app.tar.gz',
    'PRODUCTION_ROOT=/home/nysareal/nysa-crm',
    'R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone',
    'Production and R2 clone snapshots: unchanged'
  ]) assert.ok(deploy.includes(marker),`missing guarded installer marker: ${marker}`);
  assert.match(deploy,/\[\[ "\$APP_ROOT" != "\$PRODUCTION_ROOT" && "\$APP_ROOT" != "\$R2_CLONE_ROOT" \]\]/);
  assert.match(deploy,/\[\[ "\$EXPECTED_COMMIT" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(deploy,/\[\[ "\$APPROVED_SHA256" =~ \^\[0-9a-f\]\{64\}\$ \]\]/);
});
