import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);
test('dev.169 package is checksum-bound cumulative and CRM-Test-only',()=>{
  const name='nysa-core-consolidated-crm-test-dev169.zip',bytes=fs.readFileSync(artifact(name)),sha=crypto.createHash('sha256').update(bytes).digest('hex'),checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim(),manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  assert.equal(checksum,`${sha}  ${name}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.169');assert.equal(manifest.target,'CRM Test only');assert.equal(manifest.baselineVersion,'2.1.0-dev.168');assert.equal(manifest.migrationCount,107);assert.equal(manifest.latestMigration,'107_dev169_versioned_opportunity_stage_drafts.sql');assert.ok(manifest.requirements.includes('DEF-092/UAT-092'));assert.deepEqual(manifest.verification.ordinary,{total:1240,passed:1210,failed:0,skippedProtected:30});assert.deepEqual(manifest.verification.focusedLinkedFunctions,{total:25,passed:25,failed:0});
});
test('dev.169 installer accepts only dev.168 migration-106 or exact rerun baseline',()=>{const script=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev169.sh'),'utf8'),safetyBody=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev162.sh'),'utf8');for(const marker of ['2.1.0-dev.169','2.1.0-dev.168','106_dev165_opportunity_requirement_realignment.sql','107_dev169_versioned_opportunity_stage_drafts.sql','CRM Test'])assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(safetyBody,/Production and R2 clone were not targeted/);assert.match(script,/for number in 101 102 103 104 105 106 107/);});
