import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,base));
const text=name=>read(name).toString('utf8');

test('dev.155 consolidated package is deterministic, checksum-bound and complete',()=>{
  const name='nysa-core-consolidated-crm-test-dev155.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest=JSON.parse(text('nysa-core-consolidated-crm-test-dev155.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-consolidated-crm-test-dev155.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.155');assert.equal(manifest.baselineVersion,'2.1.0-dev.154');
  assert.equal(manifest.latestMigration,'099_dev153_inventory_assignment_lifecycle.sql');assert.equal(manifest.migrationCount,99);
  assert.deepEqual(manifest.requirements,['UAT-037']);
  for(const required of ['package.json','public/app.js','public/inventory-workspace-ui.js','src/routes/opportunities.js','src/migrations/099_dev153_inventory_assignment_lifecycle.sql','docs/CRM_TEST_DEV155_BOOKING_BIND_HOTFIX.md','release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev155.sh','RUNTIME_MANIFEST.sha256','MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  for(const entry of names){assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'));assert.doesNotMatch(entry,/^(?:\.env$|storage\/|node_modules\/|test\/|tools\/|outputs?\/|\.git\/)/);}
});

test('dev.155 deployer is CRM-Test-only, backup-first, rerunnable and one-worker safe',()=>{
  const deploy=text('deploy-crm-test-consolidated-dev155.sh');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_VERSION=2.1.0-dev.155','PREVIOUS_VERSION=2.1.0-dev.154','BASELINE_MIGRATION=099_dev153_inventory_assignment_lifecycle.sql','LATEST_MIGRATION=099_dev153_inventory_assignment_lifecycle.sql','EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev155.zip','pre-dev155.dump','pre-dev155-app.tar.gz','expected exactly one live CRM Test worker','expected exactly one new CRM Test worker','inventory_assignments','deal_inventory_linkages','deals_current_inventory_linkage_consistency','Property Finder safe default missing'])assert.ok(deploy.includes(marker),`missing deployment control: ${marker}`);
  assert.doesNotMatch(deploy,/PRODUCTION_ROOT.*cp |R2_CLONE_ROOT.*cp /);
});
