import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev197 is a checksum-bound migration-neutral CRM-Test delta from deployed dev196',()=>{
  const name='nysa-core-consolidated-crm-test-dev197-r1.zip',bytes=fs.readFileSync(artifact(name)),manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8')),checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();
  assert.equal(checksum,`${sha(bytes)}  ${name}`);assert.equal(manifest.packageSha256,sha(bytes));assert.equal(manifest.version,'2.1.0-dev.197');assert.equal(manifest.target,'CRM Test only');assert.equal(manifest.sourceBaselinePackageSha256,'c83dbf89599c3a330bf745174b2d7c2c1c3bf5f85202bae218dbdcefceb97b7d');assert.equal(manifest.migrationNeutral,true);assert.deepEqual(manifest.newMigrations,[]);assert.equal(manifest.latestMigration,'126_executing_agent_tier_and_social_uplift.sql');for(const excluded of ['Production','R2 clone'])assert.ok(manifest.excluded.includes(excluded));
});

test('dev197 package changes only the approved calculation presentation runtime files',()=>{
  const current=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev197-r1.zip'))),baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev196-r1.zip'))),expected=['package-lock.json','package.json','public/commission-payout-ui.js','public/index.html','src/commission-payout-domain.js','src/commission-payout-sheet-pdf.js','src/routes/commission-payout.js'],runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/'),changed=Object.keys(current).filter(name=>runtime(name)&&!name.endsWith('/')&&(!baseline[name]||sha(current[name])!==sha(baseline[name]))).sort();assert.deepEqual(changed,expected);for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/'))assert.equal(sha(current[name]),sha(bytes),name);assert.equal(JSON.parse(Buffer.from(current['package.json'])).version,'2.1.0-dev.197');
});

test('dev197 deployer is baseline-bound, backup-first and preserves migration 126',()=>{
  const deployer=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev197-r1.sh'),'utf8'),manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev197-r1.manifest.json'),'utf8'));assert.match(deployer,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);assert.match(deployer,/EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal/);assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.197/);assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.196/);assert.ok(deployer.includes(`APPROVED_SHA256=${manifest.packageSha256}`));assert.match(deployer,/LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift\.sql/);assert.match(deployer,/pg_dump[\s\S]*pre-dev197\.dump[\s\S]*tar -czf/);assert.match(deployer,/Production and R2 clone snapshots: unchanged/);assert.doesNotMatch(deployer,/\r/);
});
