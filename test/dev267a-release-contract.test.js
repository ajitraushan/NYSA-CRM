import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

test('DEV267a technical version and migration-neutral schema baseline equal DEV267 canonical',()=>{
  const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.equal(packageJson.version,'2.1.0-dev.268');
  const result=JSON.parse(execFileSync(process.execPath,['tools/verify-dev267a-release-contract.mjs'],{encoding:'utf8'}));
  assert.equal(result.migrationNeutral,true);
  assert.equal(result.expected.manifestSha256,'59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944');
  assert.equal(result.expected.triggerFileSha256,'70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf');
  assert.deepEqual([result.expected.migrationsBefore,result.expected.migrationsAfter,result.expected.tablesBefore,result.expected.tablesAfter,result.expected.triggersBefore,result.expected.triggersAfter],[170,170,306,306,111,111]);
  assert.ok(result.files.every(file=>file.byteIdentical&&file.baselineSha256===file.canonicalSha256));
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
