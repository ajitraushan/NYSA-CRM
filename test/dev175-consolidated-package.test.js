import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev.175 package binds exact runtime, migration 111 and preserved applied migrations',()=>{
  const name='nysa-core-consolidated-crm-test-dev175.zip',bytes=fs.readFileSync(artifact(name)),entries=unzipSync(bytes);
  const manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  assert.equal(manifest.version,'2.1.0-dev.175');assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.174');assert.equal(manifest.packageSha256,hash(bytes));
  assert.equal(fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim(),`${hash(bytes)}  ${name}`);
  assert.equal(manifest.migrationCount,111);assert.equal(manifest.latestMigration,'111_dev175_stage_draft_audit.sql');
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,manifest.version);
  const old=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev174.zip')));
  for(const [path,content] of Object.entries(old))if(path.startsWith('src/migrations/'))assert.equal(hash(entries[path]),hash(content),`Applied migration changed: ${path}`);
  const currentVersion=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
  for(const file of manifest.files){assert.equal(hash(entries[file.path]),file.sha256);if(file.runtimeInstall&&currentVersion===manifest.version)assert.equal(hash(fs.readFileSync(new URL(`../${file.path}`,import.meta.url))),file.sha256);}
  for(const path of Object.keys(entries))assert.ok(!path.startsWith('/')&&!path.split('/').includes('..')&&path!=='.env'&&!path.startsWith('storage/')&&!path.startsWith('node_modules/'),path);
  assert.deepEqual(manifest.verification.ordinary,{total:1307,passed:1266,failed:0,skippedProtected:41});
});

test('dev.175 deployment is target-locked and backs up before installing or restarting',()=>{
  const s=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev175.sh'),'utf8');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.175','PREVIOUS_VERSION=2.1.0-dev.174','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','110|$BASELINE_MIGRATION','111|$LATEST_MIGRATION','APPLIED_MIGRATIONS.sha256','pg_restore --list','verify_worker_socket','verify_switches','Production and R2 clone snapshots: unchanged','OpportunityStageDraft'])assert.ok(s.includes(marker),marker);
  assert.ok(s.indexOf('pg_dump -h')<s.indexOf('install -m 0644'));
  assert.ok(s.indexOf('tar -tzf')<s.indexOf('kill -KILL'));
  assert.match(s,/"\$worker_count" -eq 1/);
  assert.doesNotMatch(s,/2\.1\.0-dev\.162|pre-dev162/);
});
