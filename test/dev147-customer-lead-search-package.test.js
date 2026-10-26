import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifactRoot=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const packageName='nysa-core-consolidated-crm-test-dev147.zip';
const stem=packageName.slice(0,-4);
const read=name=>readFileSync(new URL(name,artifactRoot));
const text=name=>read(name).toString('utf8');

test('dev.147 package checksum identity and runtime search correction reconcile',()=>{
  const zip=read(packageName),sha=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest=JSON.parse(text(`${stem}.manifest.json`)),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text(`${stem}.sha256.txt`).trim(),`${sha}  ${packageName}`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.147');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.146');
  assert.equal(manifest.migrationCount,95);
  assert.equal(names.filter(name=>/^src\/migrations\/\d{3}_.+\.sql$/.test(name)).length,95);
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','src/routes/crm.js','src/migrations/095_dev146_full_scope_uat_governance.sql','docs/CRM_TEST_DEV147_CUSTOMER_LEAD_SEARCH_HOTFIX.md','MANIFEST.sha256','RUNTIME_MANIFEST.sha256'])assert.ok(names.includes(required),required);
  const packagedApp=Buffer.from(entries['public/app.js']).toString('utf8');
  assert.match(packagedApp,/api\(`\/crm\/customers\/\$\{encodeURIComponent\(preselectedCustomerId\)\}`\)/);
  assert.match(packagedApp,/new URLSearchParams\(\{q:query,pageSize:'100',sort:'name'\}\)/);
  assert.match(packagedApp,/while\(matches\.length<count\)/);
  assert.doesNotMatch(packagedApp,/preselectedCustomerId\?contacts\.find/);
  for(const name of names)assert.ok(!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..'),name);
  assert.ok(!names.includes('.env'),'.env');
  for(const prohibited of ['storage/','node_modules/','test/','tools/','outputs/','.git/'])assert.ok(!names.some(name=>name.startsWith(prohibited)),prohibited);
});

test('dev.147 deployer is CRM Test locked and accepts only the dev.146 migration-095 baseline',()=>{
  const source=text('deploy-crm-test-consolidated-dev147.sh');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_VERSION=2.1.0-dev.147','PREVIOUS_VERSION=2.1.0-dev.146','BASELINE_MIGRATION=095_dev146_full_scope_uat_governance.sql','EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev147.zip','expected exactly one live CRM Test worker','/api/health','/api/readiness','pre-dev147.dump','pre-dev147-app.tar.gz','Production snapshot changed','Production clone snapshot changed'])assert.ok(source.includes(marker),marker);
  assert.doesNotMatch(source,/EXPECTED_ROOT=.*nysa-crm$/m);
  for(const flag of ['PROPERTY_FINDER_SANDBOX_ENABLED','PROPERTY_FINDER_ALLOW_READS','PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS','PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE','PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH','MICROSOFT365_EMAIL_ENABLED','CALENDLY_ENABLED'])assert.ok(source.includes(flag),flag);
});
