import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

const root=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),text=name=>read(name).toString('utf8');

test('Release 3B dev.121 verification hotfix is checksum-bound portable and complete',()=>{
  const packageName='nysa-core-r3b-verification-scope-hotfix-dev121.zip',zip=read(packageName),sha=crypto.createHash('sha256').update(zip).digest('hex'),checksum=text('nysa-core-r3b-verification-scope-hotfix-dev121.sha256.txt').trim(),manifest=JSON.parse(text('nysa-core-r3b-verification-scope-hotfix-dev121.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries),deployerPath='release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev121-verification-scope-hotfix.sh';
  assert.equal(checksum,`${sha}  ${packageName}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.121');assert.equal(manifest.baselineVersion,'2.1.0-dev.120');assert.equal(manifest.latestMigration,'078_release3b_inventory_progressive_governance.sql');assert.equal(manifest.migrationCount,78);assert.deepEqual(manifest.requirements,['R3B-INVENTORY-VERIFY-59']);
  assert.ok(names.every(name=>!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')));
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','public/dashboard-ui.js','src/routes/listings.js','src/routes/opportunities.js','src/migrations/078_release3b_inventory_progressive_governance.sql',deployerPath,'MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.121');assert.deepEqual(Buffer.from(entries[deployerPath]),read('deploy-crm-test-r3b-dev121-verification-scope-hotfix.sh'));
  const prior=unzipSync(read('nysa-core-r3b-inventory-import-blockers-dev120.zip'));for(const migration of ['075_release3b_governed_inventory_matching.sql','076_release3b_match_decisions_and_feedback.sql','077_release3b_requirement_confirmation.sql','078_release3b_inventory_progressive_governance.sql'])assert.deepEqual(Buffer.from(entries[`src/migrations/${migration}`]),Buffer.from(prior[`src/migrations/${migration}`]),`protected migration changed: ${migration}`);
});

test('dev.121 deployer is rerunnable CRM-Test-only and retains migration 078',()=>{
  const deploy=text('deploy-crm-test-r3b-dev121-verification-scope-hotfix.sh'),guide=text('RELEASE_3B_DEV121_VERIFICATION_SCOPE_HOTFIX_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.121','PREVIOUS_VERSION=2.1.0-dev.120','BASELINE_MIGRATION=078_release3b_inventory_progressive_governance.sql','LATEST_MIGRATION=078_release3b_inventory_progressive_governance.sql','nysa-core-r3b-verification-scope-hotfix-dev121.sha256.txt','nysa-core-r3b-verification-scope-hotfix-dev121.manifest.json','expected installed dev.120 or dev.121','pre-dev121.dump','pre-dev121-app.tar.gz','78|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing deploy control ${marker}`);
  assert.doesNotMatch(deploy,/dev120|dev\.119|77\|\$BASELINE_MIGRATION/);
  for(const marker of ['Files to upload','Verify and deploy to CRM Test only','Required success result','Rollback','Focused UAT','Production and R2 remain prohibited targets'])assert.ok(guide.includes(marker),`missing guide section ${marker}`);
});
