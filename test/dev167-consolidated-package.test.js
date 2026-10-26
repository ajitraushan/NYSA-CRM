import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);

test('dev.167 candidate is checksum-bound, CRM-Test-only and includes DEF-086 through DEF-090',()=>{
  const name='nysa-core-consolidated-crm-test-dev167.zip',zip=fs.readFileSync(artifact(name)),
    sha=crypto.createHash('sha256').update(zip).digest('hex'),entries=unzipSync(zip),
    checksum=fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev167.sha256.txt'),'utf8').trim(),
    manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev167.manifest.json'),'utf8'));
  assert.equal(checksum,`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.167');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.166');
  assert.equal(manifest.migrationCount,106);
  assert.equal(manifest.latestMigration,'106_dev165_opportunity_requirement_realignment.sql');
  assert.deepEqual(manifest.requirements,['DEF-086/UAT-086','DEF-087/UAT-087','DEF-088/UAT-088','DEF-089/UAT-089','DEF-090/UAT-090']);
  assert.deepEqual(manifest.verification.ordinary,{total:1232,passed:1202,failed:0,skippedProtected:30});
  assert.deepEqual(manifest.verification.focusedLinkedFunctions,{total:79,passed:79,failed:0});
  const names=Object.keys(entries),migrations=names.filter(path=>/^src\/migrations\/\d{3}_.+\.sql$/.test(path));
  assert.equal(migrations.length,106);
  for(const required of ['MANIFEST.sha256','RUNTIME_MANIFEST.sha256','src/migrations/106_dev165_opportunity_requirement_realignment.sql','docs/CRM_TEST_DEV167_DEF086_090_LOCAL_COMPLETION_AND_DEPLOYMENT_PLAN.md','test/uat086-inventory-ranking-workspace.test.js','test/uat087-agent-dashboard-simplification.test.js','test/uat089-agent-attention-colours.test.js','test/uat090-agent-proposal-workload.test.js'])assert.ok(names.includes(required),required);
  assert.ok(!names.some(path=>path==='.env'||path.startsWith('storage/')||path.startsWith('node_modules/')));
  const records=value=>Buffer.from(value).toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>({sha:line.slice(0,64),path:line.slice(66)}));
  for(const item of records(entries['MANIFEST.sha256']))assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha,item.path);
  for(const item of records(entries['RUNTIME_MANIFEST.sha256']))assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha,item.path);
});

test('dev.167 installer accepts only dev.166 migration-106 CRM Test baseline',()=>{
  const script=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev167.sh'),'utf8'),safetyBody=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev162.sh'),'utf8');
  for(const marker of ['2.1.0-dev.167','2.1.0-dev.166','106_dev165_opportunity_requirement_realignment.sql','CRM Test'])assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(safetyBody,/Production and R2 clone were not targeted/);
  assert.match(script,/for number in 101 102 103 104 105 106/);
});
