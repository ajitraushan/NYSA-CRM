import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const script=fs.readFileSync(new URL('../scripts/deploy-crm-test-dev223.sh',import.meta.url),'utf8');

test('DEV223 guarded installer accepts only DEV222 CRM Test or an exact rerun',()=>{
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.223','PREVIOUS_VERSION=2.1.0-dev.222','PREVIOUS_MIGRATION=132_approved_documents_and_brand.sql','LATEST_MIGRATION=133_customer_identity_documents.sql','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','requires exact DEV222 baseline or DEV223 rerun'])assert.match(script,new RegExp(marker.replaceAll('.','\\.')));
  assert.match(script,/manifest identity or test receipt mismatch/);
});

test('DEV223 installer is backup-first, rollback-ready and verifies the customer document schema',()=>{
  for(const marker of ['pre-dev223.dump','pre-dev223-app.tar.gz','rollback_application','pg_restore --list','customer_document_requirement_versions','customer_identity_documents','company_identity_documents','column_name=\'company_id\''])assert.match(script,new RegExp(marker));
  assert.match(script,/Production and R2 clone snapshots: unchanged/);
});
