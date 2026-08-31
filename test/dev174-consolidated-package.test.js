import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);

test('dev.174 package is checksum-bound, cumulative and CRM-Test-only',()=>{
  const name='nysa-core-consolidated-crm-test-dev174.zip';
  const bytes=fs.readFileSync(artifact(name));
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  const checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();
  const manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  assert.equal(checksum,`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.174');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.173');
  assert.equal(manifest.baselineMigration,'107_dev169_versioned_opportunity_stage_drafts.sql');
  assert.equal(manifest.migrationCount,110);
  assert.equal(manifest.latestMigration,'110_dev174_financial_illustration.sql');
  for(const item of ['DEF-097','DEF-102','DEF-106','SPEC-GAP-001'])assert.ok(manifest.requirements.includes(item));
  assert.deepEqual(manifest.verification.ordinary,{total:1291,passed:1261,failed:0,skippedProtected:30});
  assert.deepEqual(manifest.verification.focusedLinkedFunctions,{total:47,passed:47,failed:0});
});

test('dev.174 installer accepts only dev.173 baseline, exact interrupted recovery or exact rerun',()=>{
  const script=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev174.sh'),'utf8');
  const safetyBody=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev162.sh'),'utf8');
  for(const marker of ['2.1.0-dev.174','2.1.0-dev.173','107_dev169_versioned_opportunity_stage_drafts.sql','110_dev174_financial_illustration.sql','CRM Test'])assert.ok(script.includes(marker));
  assert.match(safetyBody,/Production and R2 clone were not targeted/);
  assert.match(script,/for number in 101 102 103 104 105 106 107 108 109 110/);
  assert.match(script,/109\|109_dev174_inventory_parking_spaces\.sql/);
});
