import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';
const file=name=>new URL('../release-artifacts/release-3/consolidated/'+name,import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Isolated dev176 package excludes all provisional dev177 finance work and preserves applied migrations',()=>{
  const name='nysa-core-consolidated-crm-test-dev176.zip',bytes=fs.readFileSync(file(name)),entries=unzipSync(bytes);
  const manifest=JSON.parse(fs.readFileSync(file(name.replace('.zip','.manifest.json'))));
  assert.equal(hash(bytes),'5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560');
  assert.equal(manifest.packageSha256,hash(bytes));assert.equal(manifest.version,'2.1.0-dev.176');
  assert.equal(manifest.sourceSnapshotSha256,'03f34219c56f78fa1d7951cdec8e95c33d9ebdc257c355b9748f1cc74d2a45e9');
  const prior=unzipSync(fs.readFileSync(file('nysa-core-consolidated-crm-test-dev175.zip')));
  assert.equal(Object.keys(entries).filter(n=>n.startsWith('src/migrations/')).length,112);
  for(const [name,content] of Object.entries(prior))if(name.startsWith('src/migrations/'))assert.equal(hash(entries[name]),hash(content));
  for(const record of manifest.files)assert.equal(hash(entries[record.path]),record.sha256,record.path);
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.176');
  for(const name of Object.keys(entries))assert.ok(!/dev177|receivables|113_dev|^storage\/|^node_modules\/|^\.env$|(^|\/)\.\.(\/|$)/.test(name),name);
  assert.doesNotMatch(Buffer.from(entries['public/app.js']).toString(),/data-tab="receivables"/);
  assert.match(Buffer.from(entries['src/commission-payout-domain.js']).toString(),/mayViewPayoutWorkspace=broker=>broker\?\.jobRole==='director'/);
});
test('dev176 installer is exact-hash and Test-locked with backup before install/restart',()=>{
  const script=fs.readFileSync(file('deploy-crm-test-consolidated-dev176.sh'),'utf8');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.176','PREVIOUS_VERSION=2.1.0-dev.175','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','111|$BASELINE_MIGRATION','112|$LATEST_MIGRATION','APPROVED_SHA256=5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560','APPLIED_MIGRATIONS.sha256','pg_restore --list','verify_worker_socket','verify_switches','receipt_proof_same_deal','DealCommissionProof','commission_receivable_schedules'])assert.ok(script.includes(marker),marker);
  assert.ok(script.indexOf('pg_dump -h')<script.indexOf('install -m 0644'));
  assert.ok(script.indexOf('tar -tzf')<script.indexOf('kill -KILL'));
  assert.match(script,/"\$worker_count" -eq 1/);
});
