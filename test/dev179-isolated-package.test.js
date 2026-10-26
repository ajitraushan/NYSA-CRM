import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';
const dir=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('dev179 exact Opportunity finance package preserves every deployed migration and non-finance runtime file',()=>{
  const bytes=fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev179.zip',dir)),entries=unzipSync(bytes);
  const manifest=JSON.parse(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev179.manifest.json',dir)));
  assert.equal(hash(bytes),'e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434');
  assert.equal(manifest.packageSha256,hash(bytes));assert.equal(manifest.version,'2.1.0-dev.179');
  assert.equal(manifest.changedRuntimeFiles.length,19);assert.equal(Object.keys(entries).length,306);
  assert.equal(Object.keys(entries).filter(n=>n.startsWith('src/migrations/')).length,116);
  const prior=unzipSync(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev178.zip',dir)));
  for(const [name,content] of Object.entries(prior))if(name.startsWith('src/migrations/')||(!manifest.changedRuntimeFiles.includes(name)&&!name.endsWith('MANIFEST.sha256')))assert.equal(hash(entries[name]),hash(content),name);
  for(const record of manifest.files)assert.equal(hash(entries[record.path]),record.sha256,record.path);
  for(const name of Object.keys(entries))assert.ok(!/^storage\/|^node_modules\/|^\.env$|(^|\/)\.\.(\/|$)/.test(name),name);
  assert.doesNotMatch(Buffer.from(entries['src/routes/opportunities.js']).toString(),/Confirmed actual commission receipt is required before Close Won/);
  assert.match(Buffer.from(entries['public/bootstrap.js']).toString(),/opportunity-finance-ui/);
  assert.match(Buffer.from(entries['src/commission-payout-domain.js']).toString(),/mayViewPayoutWorkspace=broker=>broker\?\.jobRole==='director'/);
});
test('dev179 installer is Test/hash locked and requires verified backup, migrations and single worker',()=>{
  const s=fs.readFileSync(new URL('deploy-crm-test-consolidated-dev179.sh',dir),'utf8');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.179','PREVIOUS_VERSION=2.1.0-dev.178','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','113|$BASELINE_MIGRATION','116|$LATEST_MIGRATION','APPROVED_SHA256=e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434','APPLIED_MIGRATIONS.sha256','pg_restore --list','verify_worker_socket','verify_switches','verify_independent_closure','deals_commission_receipt_close_gate'])assert.ok(s.includes(marker),marker);
  assert.ok(s.indexOf('pg_dump -h')<s.indexOf('install -m 0644'));assert.ok(s.indexOf('tar -tzf')<s.indexOf('kill -KILL'));
  assert.match(s,/"\$worker_count" -eq 1/);
});
