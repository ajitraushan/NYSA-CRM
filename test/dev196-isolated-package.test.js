import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev196 is a checksum-bound CRM-Test-only delta from the exact deployed dev192 package',()=>{
  const name='nysa-core-consolidated-crm-test-dev196-r1.zip';
  const bytes=fs.readFileSync(artifact(name));
  const manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  const checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();
  assert.equal(checksum,`${sha(bytes)}  ${name}`);
  assert.equal(manifest.packageSha256,sha(bytes));
  assert.equal(manifest.version,'2.1.0-dev.196');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.sourceBaselinePackageSha256,'4f36f775d49324ab0056994386b6362b5c02d01a18ee8f28221147a7c983bfe7');
  assert.equal(manifest.latestMigration,'126_executing_agent_tier_and_social_uplift.sql');
  assert.equal(manifest.migrationCount,126);
  assert.deepEqual(manifest.newMigrations,['124_commission_payment_batch_release.sql','125_agent_payout_gross_tier_then_split.sql','126_executing_agent_tier_and_social_uplift.sql']);
  for(const excluded of ['Production','R2 clone'])assert.ok(manifest.excluded.includes(excluded));
});

test('dev196 contains only the approved payout runtime delta and intact historical migrations',()=>{
  const current=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev196-r1.zip')));
  const baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev192-r5.zip')));
  const expected=['package-lock.json','package.json','public/commission-payout-ui.js','src/accountant-access.js','src/commission-payout-domain.js','src/commission-payout-sheet-pdf.js','src/migrations/124_commission_payment_batch_release.sql','src/migrations/125_agent_payout_gross_tier_then_split.sql','src/migrations/126_executing_agent_tier_and_social_uplift.sql','src/routes/commission-payout.js'];
  const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
  const changed=Object.keys(current).filter(name=>runtime(name)&&!name.endsWith('/')&&(!baseline[name]||sha(current[name])!==sha(baseline[name]))).sort();
  assert.deepEqual(changed,expected);
  for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/'))assert.equal(sha(current[name]),sha(bytes),name);
  assert.equal(JSON.parse(Buffer.from(current['package.json'])).version,'2.1.0-dev.196');
});

test('dev196 deployer is target-bound, backup-first and verifies the payout data contract',()=>{
  const deployer=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev196-r1.sh'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev196-r1.manifest.json'),'utf8'));
  assert.match(deployer,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(deployer,/EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal/);
  assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.196/);
  assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.192/);
  assert.ok(deployer.includes(`APPROVED_SHA256=${manifest.packageSha256}`));
  assert.match(deployer,/LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift\.sql/);
  assert.match(deployer,/executing_agent_received_gross_v1/);
  assert.match(deployer,/agent_payout_social_uplift_basis_ck/);
  assert.match(deployer,/pg_dump[\s\S]*pre-dev196\.dump[\s\S]*tar -czf/);
  assert.doesNotMatch(deployer,/\r/);
});
