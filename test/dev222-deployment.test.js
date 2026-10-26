import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV222 guarded installer accepts only DEV221 CRM Test and its verified origin package',()=>{
  const script=read('scripts/deploy-crm-test-dev222.sh');
  for(const marker of [
    'EXPECTED_VERSION=2.1.0-dev.222','PREVIOUS_VERSION=2.1.0-dev.221',
    'EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','nysa-core-2.1.0-dev.222-origin.zip',
    'full expected Git commit is required','package differs from approved candidate',
    'manifest identity or test receipt mismatch','requires exact DEV221 baseline or DEV222 rerun'
  ])assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('DEV222 installer is backup-first rollback-ready and protects Production and R2 clone',()=>{
  const script=read('scripts/deploy-crm-test-dev222.sh');
  for(const marker of ['pre-dev222.dump','pre-dev222-app.tar.gz','rollback_application','pg_restore --list',
    'RUNTIME_MANIFEST.sha256','verify_worker_socket','verify_switches','Production and R2 clone snapshots: unchanged'])
    assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(script,/APP_ROOT" != "\$PRODUCTION_ROOT/);
  assert.match(script,/APP_ROOT" != "\$R2_CLONE_ROOT/);
});

test('DEV222 is migration-neutral and verifies the signed-document schema plus PDF runtime',()=>{
  const script=read('scripts/deploy-crm-test-dev222.sh');
  assert.match(script,/LATEST_MIGRATION=132_approved_documents_and_brand\.sql/);
  assert.match(script,/EXPECTED_MIGRATION_COUNT=132/);
  assert.match(script,/deal_document_compliance_snapshots/);
  assert.match(script,/deal_document_requirement_instances/);
  assert.match(script,/verifyApprovedDocumentRuntime/);
});
