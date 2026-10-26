import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const root=new URL('../',import.meta.url);
const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);

test('dev.159 candidate is checksum-bound, deterministic-scope and migration-unique',()=>{
  const zip=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev159.zip'));
  const sha=crypto.createHash('sha256').update(zip).digest('hex');
  const checksum=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev159.sha256.txt'),'utf8').trim();
  const manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev159.manifest.json'),'utf8'));
  assert.equal(checksum,`${sha}  nysa-core-consolidated-crm-test-dev159.zip`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.159');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.migrationCount,103);
  assert.equal(manifest.latestMigration,'103_dev159_uat062_single_source_classification.sql');
  assert.deepEqual(manifest.verification.ordinary,{total:1185,passed:1163,failed:0,skippedProtected:22});
  assert.deepEqual(manifest.verification.protectedPostgreSQL,{total:22,passed:22,failed:0});
  assert.equal(manifest.verification.humanUat,'pending');
  const entries=Object.keys(unzipSync(zip));
  const migrations=entries.filter(name=>/^src\/migrations\/\d{3}_.+\.sql$/.test(name));
  const numbers=migrations.map(name=>name.slice('src/migrations/'.length,'src/migrations/'.length+3));
  assert.equal(migrations.length,103);
  assert.equal(new Set(numbers).size,103);
  for(const required of ['MANIFEST.sha256','RUNTIME_MANIFEST.sha256','docs/CRM_TEST_DEV159_CONSOLIDATED_DEFECT_RCA_AND_DEPLOYMENT_PLAN.md','outputs/NYSA_CORE_dev159_Consolidated_Defect_Log_RCA_Deployment_and_UAT_Plan.docx','outputs/NYSA_CORE_Lead_Classification_Business_Rules_Review_v3.docx','outputs/NYSA_CORE_UAT062_Single_Source_Business_Classification_Remediation_Spec.docx','output/pdf/NYSA_CORE_dev159_expected_offer_to_purchase.pdf','test/dev159-uat067-068-real-db.integration.test.js'])assert.ok(entries.includes(required),`missing ${required}`);
  assert.ok(!entries.some(name=>name==='.env'||name.startsWith('storage/')||name.startsWith('node_modules/')));
  assert.equal(manifest.providerState.propertyFinder,'disabled and excluded');
});
