import {execFileSync} from 'node:child_process';
const accepted = '5c1c350151d6ace33377b33526e2bfedf4ae8f6b';
const acceptedFile = file => execFileSync('git',['show',`${accepted}:${file}`],{encoding:'utf8'});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('DEV271 technical version and deployment baseline equal accepted DEV270',()=>{
  const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.equal(packageJson.version,'2.1.0-dev.273');
  const files=['columns.json','constraints.json','functions.json','indexes.json','sequences-views.json','manifest.json'];
  for(const file of files){
    const actual=fs.readFileSync('src/database-schema-baseline/'+file,'utf8').replaceAll('\r','');
    assert.equal(actual,acceptedFile('src/database-schema-contract/'+file),file);
  }
  assert.equal(fs.readFileSync('src/database-schema-baseline/database-trigger-contract.json','utf8').replaceAll('\r',''),
    acceptedFile('src/database-trigger-contract.json'));
});

test('canonical config generator accepts numeric DEV versions and migration-neutral baselines',()=>{
  const generator=fs.readFileSync('tools/generate-crm-test-deploy-config.mjs','utf8');
  assert.match(generator,/\^2\\\.1\\\.0-dev\\\.\\d\+\$/);
  assert.match(generator,/spec\.migrationNeutral===true\?spec\.expectedMigrationCount:spec\.expectedMigrationCount-1/);
  assert.match(generator,/baselineTriggers:spec\.migrationNeutral===true\?baselineTriggerContract\.triggers:source\.baselineTriggers/);
  assert.match(generator,/baselineManifest\.triggers\?\.triggerCount/);
  assert.match(generator,/Baseline trigger contract is inconsistent/);
  assert.match(generator,/Migration-neutral release does not match the accepted baseline migration count/);
});
