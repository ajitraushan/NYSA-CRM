import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const read=file=>readFileSync(new URL(`../release-artifacts/release-3/r3b/${file}`,import.meta.url)),text=file=>read(file).toString('utf8');

test('Release 3B dev.116 Inventory import package is checksum-bound portable and self-extracting',()=>{
  const packageName='nysa-core-r3b-inventory-import-dev116.zip',zip=read(packageName),sha=crypto.createHash('sha256').update(zip).digest('hex'),
    checksum=text('nysa-core-r3b-inventory-import-dev116.sha256.txt').trim(),manifest=JSON.parse(text('nysa-core-r3b-inventory-import-dev116.manifest.json')),
    entries=unzipSync(zip),names=Object.keys(entries),deployerPath='release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev116-inventory-import.sh';
  assert.equal(checksum,`${sha}  ${packageName}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.116');
  assert.equal(manifest.latestMigration,'077_release3b_requirement_confirmation.sql');assert.equal(manifest.migrationCount,77);
  assert.ok(names.every(name=>!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')&&!name.startsWith('node_modules/')));
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','public/templates/inventory-import-template.xlsx','src/inventory-import.js','src/routes/inventory-import.js','src/routes/listing-intake.js','src/server.js','src/migrations/077_release3b_requirement_confirmation.sql',deployerPath,'MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  assert.deepEqual(Buffer.from(entries[deployerPath]),read('deploy-crm-test-r3b-dev116-inventory-import.sh'));
  const internal=new TextDecoder().decode(entries['MANIFEST.sha256']).trim().split(/\r?\n/);
  for(const line of internal){const match=line.match(/^([a-f0-9]{64})  (.+)$/);assert.ok(match,`invalid internal manifest line: ${line}`);assert.ok(entries[match[2]],`missing internal file ${match[2]}`);assert.equal(crypto.createHash('sha256').update(entries[match[2]]).digest('hex'),match[1]);}
});

test('Release 3B dev.116 deployer accepts only verified dev.115 CRM Test and keeps migration 077 unchanged',()=>{
  const deploy=text('deploy-crm-test-r3b-dev116-inventory-import.sh'),guide=text('RELEASE_3B_DEV116_INVENTORY_IMPORT_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.116','PREVIOUS_VERSION=2.1.0-dev.115','BASELINE_MIGRATION=077_release3b_requirement_confirmation.sql','LATEST_MIGRATION=077_release3b_requirement_confirmation.sql','expected installed dev.115 or dev.116','pre-dev116.dump','pre-dev116-app.tar.gz','77|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing deploy control ${marker}`);
  assert.doesNotMatch(deploy,/EXPECTED_ROOT=\/home\/nysareal\/nysa-crm(?:\s|$)/);
  for(const marker of ['Database migrations: none','Draft Inventory only','Inventory Upload','Rollback','Concise business UAT checklist','Production and R2 remain prohibited targets'])assert.ok(guide.includes(marker),`missing guide contract ${marker}`);
});
