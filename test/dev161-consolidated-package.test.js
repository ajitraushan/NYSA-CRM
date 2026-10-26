import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const root=new URL('../',import.meta.url);
const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);

test('dev.161 candidate is checksum-bound, deterministic-scope and migration-unique',()=>{
  const zip=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev161.zip'));
  const sha=crypto.createHash('sha256').update(zip).digest('hex');
  const checksum=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev161.sha256.txt'),'utf8').trim();
  const manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev161.manifest.json'),'utf8'));
  assert.equal(checksum,`${sha}  nysa-core-consolidated-crm-test-dev161.zip`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.161');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.migrationCount,104);
  assert.equal(manifest.latestMigration,'104_dev160_uat070_079_journey_unblock.sql');
  assert.deepEqual(manifest.verification.ordinary,{total:1196,passed:1169,failed:0,skippedProtected:27});
  assert.deepEqual(manifest.verification.protectedPostgreSQL,{total:27,passed:27,failed:0,isolation:'unchanged dev.160 database contract; fresh disposable schema per protected file'});
  assert.deepEqual(manifest.verification.uat079BrowserWiring,{total:1,passed:1,failed:0});
  assert.equal(manifest.verification.humanUat,'pending');
  const entries=Object.keys(unzipSync(zip));
  const migrations=entries.filter(name=>/^src\/migrations\/\d{3}_.+\.sql$/.test(name));
  const numbers=migrations.map(name=>name.slice('src/migrations/'.length,'src/migrations/'.length+3));
  assert.equal(migrations.length,104);
  assert.equal(new Set(numbers).size,104);
  for(const required of ['MANIFEST.sha256','RUNTIME_MANIFEST.sha256','docs/CRM_TEST_DEV161_UAT079_BROWSER_WIRING_HOTFIX.md','outputs/NYSA_CORE_Lead_Classification_Business_Rules_Review_v3.docx','outputs/NYSA_CORE_UAT062_Single_Source_Business_Classification_Remediation_Spec.docx','test/dev160-uat070-079-corrections.test.js','test/dev160-uat075-079-real-db.integration.test.js','test/dev161-uat079-browser-wiring.test.js'])assert.ok(entries.includes(required),`missing ${required}`);
  assert.ok(!entries.some(name=>name==='.env'||name.startsWith('storage/')||name.startsWith('node_modules/')));
  assert.equal(manifest.providerState.propertyFinder,'disabled and excluded');
});
