import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,base));
const text=name=>read(name).toString('utf8');

test('dev.158 consolidated package is deterministic, checksum-bound and complete',()=>{
  const name='nysa-core-consolidated-crm-test-dev158.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest=JSON.parse(text('nysa-core-consolidated-crm-test-dev158.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-consolidated-crm-test-dev158.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.158');assert.equal(manifest.baselineVersion,'2.1.0-dev.155');
  assert.equal(manifest.latestMigration,'100_dev158_uat040_048_operational_corrections.sql');assert.equal(manifest.migrationCount,100);
  assert.deepEqual(manifest.requirements,['B-04','C-02 / P-05','F-04','G-02 / K-03','G-06','J / M-04','O-03 / Q','UAT-038','UAT-046 / Test 156 / Test 157','UAT-047 / UAT-048','UAT-040','UAT-041','UAT-042','UAT-043','UAT-044','UAT-045']);
  for(const required of ['package.json','public/app.js','public/dashboard-ui.js','public/inventory-workspace-ui.js','src/routes/listings.js','src/routes/opportunities.js','src/migrations/100_dev158_uat040_048_operational_corrections.sql','docs/CRM_TEST_DEV158_COMBINED_LOCAL_COMPLETION.md','release-artifacts/release-3/consolidated/dev158-final-package-db-evidence.tap','release-artifacts/release-3/consolidated/dev158-uat037-final-archive-evidence.tap','release-artifacts/release-3/consolidated/dev158-full-regression.tap','release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev158.sh','RUNTIME_MANIFEST.sha256','MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  for(const entry of names){assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'));assert.doesNotMatch(entry,/^(?:\.env$|storage\/|node_modules\/|test\/|tools\/|outputs?\/|\.git\/)/);}
});

test('dev.158 deployer is CRM-Test-only, backup-first, rerunnable and one-worker safe',()=>{
  const deploy=text('deploy-crm-test-consolidated-dev158.sh');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_VERSION=2.1.0-dev.158','PREVIOUS_VERSION=2.1.0-dev.155','BASELINE_MIGRATION=099_dev153_inventory_assignment_lifecycle.sql','LATEST_MIGRATION=100_dev158_uat040_048_operational_corrections.sql','EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev158.zip','pre-dev158.dump','pre-dev158-app.tar.gz','expected exactly one live CRM Test worker','expected exactly one new CRM Test worker','availability_expires_at','legal_structure','inventory_assignments','deal_inventory_linkages','deals_current_inventory_linkage_consistency','Property Finder safe default missing'])assert.ok(deploy.includes(marker),`missing deployment control: ${marker}`);
  assert.doesNotMatch(deploy,/PRODUCTION_ROOT.*cp |R2_CLONE_ROOT.*cp /);
});
