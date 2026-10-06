import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV220 installer is CRM-Test-only, provenance-bound, backup-first and renderer-gated',()=>{
  const deploy=read('scripts/deploy-crm-test-dev220.sh');
  for(const marker of [
    'EXPECTED_VERSION=2.1.0-dev.220','PREVIOUS_VERSION=2.1.0-dev.219',
    'LATEST_MIGRATION=132_approved_documents_and_brand.sql','EXPECTED_MIGRATION_COUNT=132',
    'nysa-core-2.1.0-dev.220-origin.zip','RELEASE_PROVENANCE.json','RUNTIME_MANIFEST.sha256',
    'pg_dump','pre-dev220.dump','pre-dev220-app.tar.gz','verify_pdf_renderer',
    "renderApprovedDocumentPdf('offer_letter'",'SYNTHETIC-DEV220','rollback_application',
    'PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone',
    'Production and R2 clone snapshots: unchanged'
  ]) assert.ok(deploy.includes(marker),`missing guarded installer marker: ${marker}`);
  assert.match(deploy,/\[\[ "\$APP_ROOT" != "\$PRODUCTION_ROOT" && "\$APP_ROOT" != "\$R2_CLONE_ROOT" \]\]/);
  assert.match(deploy,/\[\[ "\$EXPECTED_COMMIT" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(deploy,/\[\[ "\$APPROVED_SHA256" =~ \^\[0-9a-f\]\{64\}\$ \]\]/);
  assert.match(deploy,/PDF_RENDER_RUNTIME_DIR="\$APP_ROOT\/tmp\/pdf-renderer"/);
  assert.match(deploy,/verify_pdf_renderer\s+restart_worker/);
});

test('DEV220 load-path keeps application restoration gated after parallel features',()=>{
  const bootstrap=read('public/bootstrap.js'),http=read('src/lib/http-kit.js');
  assert.match(bootstrap,/Promise\.all\(\[import\([^\]]+\.\.\.featureFiles\.map\(loadScript\)\]\)/);
  assert.ok(bootstrap.indexOf("await loadScript('app.js')")>bootstrap.indexOf('Promise.all'));
  assert.match(http,/max-age=31536000, immutable/);
  assert.match(http,/\.otf': 'font\/otf'/);
});
