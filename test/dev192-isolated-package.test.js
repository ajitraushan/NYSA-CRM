import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev192 is a checksum-bound CRM-Test-only delta from the exact deployed dev191 package',()=>{
  const name='nysa-core-consolidated-crm-test-dev192-r5.zip';
  const bytes=fs.readFileSync(artifact(name));
  const manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  const checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();
  assert.equal(checksum,`${sha(bytes)}  ${name}`);
  assert.equal(manifest.packageSha256,sha(bytes));
  assert.equal(manifest.version,'2.1.0-dev.192');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.sourceBaselinePackageSha256,'76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233');
  assert.equal(manifest.latestMigration,'123_agent_payout_calculation_sheet_audit.sql');
  assert.equal(manifest.migrationCount,123);
  assert.deepEqual(manifest.newMigrations,['123_agent_payout_calculation_sheet_audit.sql']);
  for(const excluded of ['Production','R2 clone'])assert.ok(manifest.excluded.includes(excluded));
});

test('dev192 contains only the approved consolidated payout runtime delta and intact historical migrations',()=>{
  const current=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev192-r5.zip')));
  const baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev191-r10.zip')));
  const expected=['package-lock.json','package.json','public/commission-payout-ui.js','public/index.html','src/accountant-access.js','src/migrations/123_agent_payout_calculation_sheet_audit.sql','src/routes/commission-payout.js'];
  const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
  const changed=Object.keys(current).filter(name=>runtime(name)&&!name.endsWith('/')&&(!baseline[name]||sha(current[name])!==sha(baseline[name]))).sort();
  assert.deepEqual(changed,expected);
  for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/'))assert.equal(sha(current[name]),sha(bytes),name);
  assert.equal(JSON.parse(Buffer.from(current['package.json'])).version,'2.1.0-dev.192');
});

test('dev192 deployer is target-bound, checksum-bound and verifies migration 123',()=>{
  const deployer=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev192-r5.sh'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev192-r5.manifest.json'),'utf8'));
  assert.match(deployer,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(deployer,/EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal/);
  assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.192/);
  assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.191/);
  assert.ok(deployer.includes(`APPROVED_SHA256=${manifest.packageSha256}`));
  assert.match(deployer,/LATEST_MIGRATION=123_agent_payout_calculation_sheet_audit\.sql/);
  assert.match(deployer,/AgentPayoutCalculationSheet/);
  assert.doesNotMatch(deployer,/\r/);
});
