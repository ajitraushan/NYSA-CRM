import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

const root=new URL('../release-artifacts/release-3/r3b/',import.meta.url),read=name=>fs.readFileSync(new URL(name,root)),text=name=>read(name).toString('utf8');

test('Release 3B dev.117 Inventory import hotfix package is checksum-bound portable and complete',()=>{
  const packageName='nysa-core-r3b-inventory-import-hotfix-dev117.zip',zip=read(packageName),sha=crypto.createHash('sha256').update(zip).digest('hex'),
    checksum=text('nysa-core-r3b-inventory-import-hotfix-dev117.sha256.txt').trim(),manifest=JSON.parse(text('nysa-core-r3b-inventory-import-hotfix-dev117.manifest.json')),
    entries=unzipSync(zip),names=Object.keys(entries),deployerPath='release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev117-inventory-import-hotfix.sh';
  assert.equal(checksum,`${sha}  ${packageName}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.117');
  assert.equal(manifest.latestMigration,'077_release3b_requirement_confirmation.sql');assert.equal(manifest.migrationCount,77);assert.equal(manifest.zipPathSeparator,'/');
  assert.ok(names.every(name=>!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')));
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','public/templates/inventory-import-template.xlsx','src/inventory-import.js','src/routes/inventory-import.js','src/routes/listing-intake.js','src/migrations/077_release3b_requirement_confirmation.sql',deployerPath,'MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.117');
  assert.deepEqual(Buffer.from(entries[deployerPath]),read('deploy-crm-test-r3b-dev117-inventory-import-hotfix.sh'));
  const prior=unzipSync(read('nysa-core-r3b-inventory-import-dev116.zip'));
  for(const migration of ['075_release3b_governed_inventory_matching.sql','076_release3b_match_decisions_and_feedback.sql','077_release3b_requirement_confirmation.sql'])
    assert.deepEqual(Buffer.from(entries[`src/migrations/${migration}`]),Buffer.from(prior[`src/migrations/${migration}`]),`protected migration changed: ${migration}`);
  assert.equal(names.filter(name=>/^src\/migrations\/\d+_/.test(name)).sort().at(-1),'src/migrations/077_release3b_requirement_confirmation.sql');
  const internal=Buffer.from(entries['MANIFEST.sha256']).toString('utf8');
  for(const file of ['public/app.js','public/templates/inventory-import-template.xlsx','src/inventory-import.js','src/routes/inventory-import.js','src/routes/listing-intake.js'])assert.match(internal,new RegExp(`  ${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'m'));
});

test('dev.117 deployer and handoff are CRM-Test-only, rerunnable and migration-neutral',()=>{
  const deploy=text('deploy-crm-test-r3b-dev117-inventory-import-hotfix.sh'),guide=text('RELEASE_3B_DEV117_INVENTORY_IMPORT_HOTFIX_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.117','PREVIOUS_VERSION=2.1.0-dev.116','BASELINE_MIGRATION=077_release3b_requirement_confirmation.sql','LATEST_MIGRATION=077_release3b_requirement_confirmation.sql','nysa-core-r3b-inventory-import-hotfix-dev117.sha256.txt','nysa-core-r3b-inventory-import-hotfix-dev117.manifest.json','expected installed dev.116 or dev.117','dev.117 requires the verified 77-migration dev.116 baseline','pre-dev117.dump','pre-dev117-app.tar.gz','77|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing deploy control ${marker}`);
  assert.doesNotMatch(deploy,/Release 3B dev\.116|partial dev\.116 recovery|dev\.116 health\/version/);
  for(const marker of ['Database migrations: none','inventory-import-v1.1','Developer plan','Post-handover','Rollback','Concise business UAT checklist','Production and R2 remain prohibited targets'])assert.ok(guide.includes(marker),`missing guide contract ${marker}`);
});
