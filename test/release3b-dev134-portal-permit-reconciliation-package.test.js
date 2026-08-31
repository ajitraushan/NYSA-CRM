import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>readFileSync(new URL(name,base)),text=name=>read(name).toString('utf8');

test('dev.134 portal permit package is checksum-bound, cumulative and portable',()=>{
  const name='nysa-core-r3b-portal-permit-reconciliation-dev134.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex'),
    manifest=JSON.parse(text('nysa-core-r3b-portal-permit-reconciliation-dev134.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-r3b-portal-permit-reconciliation-dev134.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.134');assert.equal(manifest.baselineVersion,'2.1.0-dev.133');
  assert.equal(manifest.latestMigration,'081_release3b_portal_permit_reconciliation.sql');assert.equal(manifest.migrationCount,81);
  assert.deepEqual(manifest.requirements,['R3B-PORTAL-SINGLE-INVENTORY-77','R3B-PORTAL-PERMIT-EVIDENCE-78','R3B-PORTAL-PERMIT-RECONCILIATION-79']);
  for(const required of ['package.json','public/app.js','src/portal-publication-domain.js','src/routes/listings.js','src/migrations/080_release3b_external_portal_preparation.sql','src/migrations/081_release3b_portal_permit_reconciliation.sql','release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev134-portal-permit-reconciliation.sh','MANIFEST.sha256'])assert.ok(names.includes(required),required);
  for(const entry of names)assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'),entry);
});

test('dev.134 deployer is CRM-Test-only, rerunnable and verifies permit reconciliation contract',()=>{
  const deploy=text('deploy-crm-test-r3b-dev134-portal-permit-reconciliation.sh'),guide=text('R3B_DEV134_PORTAL_PERMIT_RECONCILIATION_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.134','PREVIOUS_VERSION=2.1.0-dev.133','BASELINE_MIGRATION=080_release3b_external_portal_preparation.sql','LATEST_MIGRATION=081_release3b_portal_permit_reconciliation.sql','EXPECTED_PACKAGE=nysa-core-r3b-portal-permit-reconciliation-dev134.zip','"81|$LATEST_MIGRATION"','pre-dev134.dump','pre-dev134-app.tar.gz',"to_regclass('public.external_portal_permit_evidence_versions') IS NOT NULL","tgname='external_portal_permit_evidence_versions_immutable'",'t|t|t|t|t|t|t|t|t|t|t|t|t|t|t|r3b-eligibility-v1'])assert.ok(deploy.includes(marker),marker);
  assert.match(deploy,/\[\[ "\$installed_version" == "\$PREVIOUS_VERSION" \|\| "\$installed_version" == "\$EXPECTED_VERSION" \]\]/);
  for(const marker of ['select one approved Inventory','same Inventory context','Upload the exact permit','property number','advertising description','submission is blocked','no action sends data'])assert.match(guide,new RegExp(marker,'i'));
});
