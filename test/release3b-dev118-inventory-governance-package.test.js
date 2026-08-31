import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

const root=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),text=name=>read(name).toString('utf8');

test('Release 3B dev.118 Inventory governance package is checksum-bound portable and complete',()=>{
  const packageName='nysa-core-r3b-inventory-governance-dev118.zip',zip=read(packageName),sha=crypto.createHash('sha256').update(zip).digest('hex'),checksum=text('nysa-core-r3b-inventory-governance-dev118.sha256.txt').trim(),manifest=JSON.parse(text('nysa-core-r3b-inventory-governance-dev118.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries),deployerPath='release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev118-inventory-governance.sh';
  assert.equal(checksum,`${sha}  ${packageName}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.118');assert.equal(manifest.latestMigration,'078_release3b_inventory_progressive_governance.sql');assert.equal(manifest.migrationCount,78);assert.equal(manifest.zipPathSeparator,'/');
  assert.ok(names.every(name=>!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')));
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','public/dashboard-ui.js','public/templates/inventory-import-template.xlsx','src/inventory-import.js','src/routes/inventory-import.js','src/routes/listing-intake.js','src/routes/listings.js','src/routes/opportunities.js','src/migrations/078_release3b_inventory_progressive_governance.sql',deployerPath,'MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.118');assert.deepEqual(Buffer.from(entries[deployerPath]),read('deploy-crm-test-r3b-dev118-inventory-governance.sh'));
  const prior=unzipSync(read('nysa-core-r3b-inventory-import-hotfix-dev117.zip'));
  for(const migration of ['075_release3b_governed_inventory_matching.sql','076_release3b_match_decisions_and_feedback.sql','077_release3b_requirement_confirmation.sql'])assert.deepEqual(Buffer.from(entries[`src/migrations/${migration}`]),Buffer.from(prior[`src/migrations/${migration}`]),`protected migration changed: ${migration}`);
  assert.equal(names.filter(name=>/^src\/migrations\/\d+_/.test(name)).sort().at(-1),'src/migrations/078_release3b_inventory_progressive_governance.sql');
  const internal=Buffer.from(entries['MANIFEST.sha256']).toString('utf8');for(const file of ['public/app.js','public/dashboard-ui.js','public/templates/inventory-import-template.xlsx','src/inventory-import.js','src/routes/listings.js','src/migrations/078_release3b_inventory_progressive_governance.sql'])assert.match(internal,new RegExp(`  ${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'m'));
});

test('dev.118 deployer is rerunnable CRM-Test-only and verifies migration rollback health and isolation',()=>{
  const deploy=text('deploy-crm-test-r3b-dev118-inventory-governance.sh'),guide=text('RELEASE_3B_DEV118_INVENTORY_GOVERNANCE_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.118','PREVIOUS_VERSION=2.1.0-dev.117','BASELINE_MIGRATION=077_release3b_requirement_confirmation.sql','LATEST_MIGRATION=078_release3b_inventory_progressive_governance.sql','nysa-core-r3b-inventory-governance-dev118.sha256.txt','nysa-core-r3b-inventory-governance-dev118.manifest.json','expected installed dev.117 or dev.118','pre-dev118.dump','pre-dev118-app.tar.gz','78|$LATEST_MIGRATION','inventory_agent_assignment_history_immutable','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing deploy control ${marker}`);
  assert.doesNotMatch(deploy,/Release 3B dev\.117|partial dev\.117 recovery|dev\.117 health\/version/);
  for(const marker of ['Files to upload','Deploy to CRM Test only','Required success result','Health and database verification','Rollback','Concise business UAT','Production and R2 remain prohibited targets'])assert.ok(guide.includes(marker),`missing guide section ${marker}`);
});
