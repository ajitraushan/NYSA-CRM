import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>readFileSync(new URL(name,base)),text=name=>read(name).toString('utf8');

test('dev.133 package is checksum-bound, cumulative and uses safe ZIP paths',()=>{
  const name='nysa-core-r3b-portal-preparation-etl-mapping-dev133.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex'),manifest=JSON.parse(text('nysa-core-r3b-portal-preparation-etl-mapping-dev133.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-r3b-portal-preparation-etl-mapping-dev133.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.133');assert.equal(manifest.latestMigration,'080_release3b_external_portal_preparation.sql');assert.equal(manifest.migrationCount,80);
  assert.deepEqual(manifest.baselineVersions,['2.1.0-dev.129','2.1.0-dev.130','2.1.0-dev.131','2.1.0-dev.132']);
  for(const required of ['package.json','public/app.js','src/portal-publication-domain.js','src/routes/listings.js','src/migrations/079_release3b_reservation_expiry_governance.sql','src/migrations/080_release3b_external_portal_preparation.sql','release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev133-portal-preparation-etl-mapping.sh','MANIFEST.sha256'])assert.ok(names.includes(required),required);
  for(const entry of names)assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'),entry);
});

test('dev.133 deployer is CRM-Test-only, rerunnable and verifies migrations 079-080',()=>{
  const deploy=text('deploy-crm-test-r3b-dev133-portal-preparation-etl-mapping.sh'),guide=text('R3B_DEV133_PORTAL_PREPARATION_ETL_MAPPING_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.133','PREVIOUS_VERSION=2.1.0-dev.129','INTERMEDIATE_VERSION_3=2.1.0-dev.132','INTERMEDIATE_MIGRATION=079_release3b_reservation_expiry_governance.sql','LATEST_MIGRATION=080_release3b_external_portal_preparation.sql','EXPECTED_PACKAGE=nysa-core-r3b-portal-preparation-etl-mapping-dev133.zip','[[ "$after_migration" == "80|$LATEST_MIGRATION" ]]','pre-dev133.dump','pre-dev133-app.tar.gz',"to_regclass('public.external_portal_mapping_versions') IS NOT NULL","tgname='external_listing_preparation_versions_immutable'"])assert.ok(deploy.includes(marker),marker);
  for(const marker of ['single cumulative package','dev.130–dev.132','Select Inventory to post','Revise preparation','no API transmission','Rollback'])assert.ok(guide.includes(marker),marker);
});
