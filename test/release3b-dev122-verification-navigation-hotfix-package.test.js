import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { unzipSync } from 'fflate';
const root=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),text=name=>read(name).toString('utf8');

test('Release 3B dev.122 navigation hotfix is checksum-bound portable and migration-neutral',()=>{
  const name='nysa-core-r3b-verification-navigation-hotfix-dev122.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex'),manifest=JSON.parse(text('nysa-core-r3b-verification-navigation-hotfix-dev122.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries),deployer='release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev122-verification-navigation-hotfix.sh';
  assert.equal(text('nysa-core-r3b-verification-navigation-hotfix-dev122.sha256.txt').trim(),`${sha}  ${name}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.122');assert.equal(manifest.baselineVersion,'2.1.0-dev.121');assert.equal(manifest.latestMigration,'078_release3b_inventory_progressive_governance.sql');assert.equal(manifest.migrationCount,78);assert.deepEqual(manifest.requirements,['R3B-INVENTORY-VERIFY-60']);assert.ok(names.every(x=>!x.includes('\\')&&!x.startsWith('/')&&!x.split('/').includes('..')));
  for(const required of ['package.json','public/dashboard-ui.js','public/app.js','src/routes/listings.js','src/migrations/078_release3b_inventory_progressive_governance.sql',deployer,'MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.122');
  const prior=unzipSync(read('nysa-core-r3b-verification-scope-hotfix-dev121.zip'));for(const migration of ['075_release3b_governed_inventory_matching.sql','076_release3b_match_decisions_and_feedback.sql','077_release3b_requirement_confirmation.sql','078_release3b_inventory_progressive_governance.sql'])assert.deepEqual(Buffer.from(entries[`src/migrations/${migration}`]),Buffer.from(prior[`src/migrations/${migration}`]));
});

test('dev.122 deployment controls require dev.121 CRM Test and preserve rollback',()=>{
  const deploy=text('deploy-crm-test-r3b-dev122-verification-navigation-hotfix.sh'),guide=text('RELEASE_3B_DEV122_VERIFICATION_NAVIGATION_HOTFIX_DEPLOYMENT_AND_UAT.md');for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.122','PREVIOUS_VERSION=2.1.0-dev.121','expected installed dev.121 or dev.122','78|$LATEST_MIGRATION','pre-dev122.dump','pre-dev122-app.tar.gz','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing ${marker}`);assert.doesNotMatch(deploy,/dev121|dev\.120/);for(const marker of ['Files to upload','Deploy to CRM Test only','Rollback','Focused UAT'])assert.ok(guide.includes(marker));
});
