import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const script=fs.readFileSync(new URL('../scripts/deploy-crm-test-dev224.sh',import.meta.url),'utf8');
test('DEV224 deployment is constrained to DEV223 CRM Test baseline and migration 134',()=>{
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.224','PREVIOUS_VERSION=2.1.0-dev.223','PREVIOUS_MIGRATION=133_customer_identity_documents.sql','PREVIOUS_MIGRATION_COUNT=133','LATEST_MIGRATION=134_customer_identity_audit_types.sql','EXPECTED_MIGRATION_COUNT=134','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','requires exact DEV223 baseline or DEV224 rerun','pre-dev224.dump','pre-dev224-app.tar.gz','rollback_application','pg_restore --list','Production and R2 clone snapshots: unchanged'])assert.ok(script.includes(marker),marker);
  assert.ok(script.indexOf('Verified pre-deployment backup:')<script.indexOf('mutated=1'));
});
