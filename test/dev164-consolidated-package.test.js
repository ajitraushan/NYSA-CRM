import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);

test('dev.164 candidate is checksum-bound, deterministic-scope, runtime-complete and migration-unique',()=>{
  const zip=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev164.zip')),
    sha=crypto.createHash('sha256').update(zip).digest('hex'),
    checksum=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev164.sha256.txt'),'utf8').trim(),
    manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev164.manifest.json'),'utf8'),),entries=unzipSync(zip);
  assert.equal(checksum,`${sha}  nysa-core-consolidated-crm-test-dev164.zip`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.164');assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.migrationCount,105);assert.equal(manifest.latestMigration,'105_dev163_uat081_qualification_follow_up_sla.sql');
  assert.deepEqual(manifest.verification.ordinary,{total:1214,passed:1184,failed:0,skippedProtected:30});
  assert.deepEqual(manifest.verification.protectedRelevant,{total:3,passed:3,failed:0,isolation:'sequential disposable PostgreSQL fixture'});
  assert.equal(manifest.verification.humanUat,'pending');assert.deepEqual(manifest.requirements,['UAT-081','UAT-082','UAT-083','UAT-084','UAT-085']);
  const names=Object.keys(entries),migrations=names.filter(name=>/^src\/migrations\/\d{3}_.+\.sql$/.test(name)),numbers=migrations.map(name=>name.slice(15,18));
  assert.equal(migrations.length,105);assert.equal(new Set(numbers).size,105);
  for(const required of ['MANIFEST.sha256','RUNTIME_MANIFEST.sha256','docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md',
    'docs/CRM_TEST_DEV164_UAT081_085_LOCAL_COMPLETION_AND_DEPLOYMENT_PLAN.md','test/dev163-uat081-real-db.integration.test.js',
    'test/dev164-uat082-085-real-db.integration.test.js','public/matching-completion-ui.js','src/routes/governed-matching.js'])assert.ok(names.includes(required),`missing ${required}`);
  assert.ok(!names.some(name=>name==='.env'||name.startsWith('storage/')||name.startsWith('node_modules/')));
  const runtimeLines=new TextDecoder().decode(entries['RUNTIME_MANIFEST.sha256']).trim().split('\n');
  for(const line of runtimeLines){const [expected,...pathParts]=line.split('  '),path=pathParts.join('  ');assert.ok(entries[path],`runtime entry missing: ${path}`);assert.equal(crypto.createHash('sha256').update(entries[path]).digest('hex'),expected,`runtime hash mismatch: ${path}`);}
  assert.equal(manifest.providerState.propertyFinder,'disabled and excluded');
});
