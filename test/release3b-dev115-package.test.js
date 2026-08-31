import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url));
const text=file=>read(file).toString('utf8');
const base='release-artifacts/release-3/r3b/';

test('Release 3B dev.115 package is checksum-bound with portable application-root paths',()=>{
  const zip=read(`${base}nysa-core-r3b-governed-matching-dev115.zip`),sha=crypto.createHash('sha256').update(zip).digest('hex'),
    checksum=text(`${base}nysa-core-r3b-governed-matching-dev115.sha256.txt`).trim(),manifest=JSON.parse(text(`${base}nysa-core-r3b-governed-matching-dev115.manifest.json`)),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(checksum,`${sha}  nysa-core-r3b-governed-matching-dev115.zip`);assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.115');assert.equal(manifest.latestMigration,'077_release3b_requirement_confirmation.sql');
  assert.ok(names.every(name=>!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')));
  for(const required of ['app.cjs','package.json','package-lock.json','public/app.js','src/server.js','src/migrations/075_release3b_governed_inventory_matching.sql','src/migrations/076_release3b_match_decisions_and_feedback.sql','src/migrations/077_release3b_requirement_confirmation.sql','release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev115-governed-matching.sh','MANIFEST.sha256'])assert.ok(names.includes(required),`missing ${required}`);
  assert.deepEqual(Buffer.from(entries['release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev115-governed-matching.sh']),read(`${base}deploy-crm-test-r3b-dev115-governed-matching.sh`));
  assert.ok(names.every(name=>!name.startsWith('node_modules/')));
  const internal=new TextDecoder().decode(entries['MANIFEST.sha256']).trim().split(/\r?\n/);
  for(const line of internal){const match=line.match(/^([a-f0-9]{64})  (.+)$/);assert.ok(match,`invalid internal manifest line: ${line}`);assert.ok(entries[match[2]],`manifest entry missing: ${match[2]}`);assert.equal(crypto.createHash('sha256').update(entries[match[2]]).digest('hex'),match[1]);}
});

test('Release 3B dev.115 deployer is rerunnable CRM-Test-only and verifies backup migration health and isolation',()=>{
  const deploy=text(`${base}deploy-crm-test-r3b-dev115-governed-matching.sh`),guide=text(`${base}RELEASE_3B_DEV115_CONSOLIDATED_DEPLOYMENT_AND_UAT.md`);
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.115','PREVIOUS_VERSION=2.1.0-dev.114','EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal','BASELINE_MIGRATION=074_release3ai_governed_website_routing.sql','LATEST_MIGRATION=077_release3b_requirement_confirmation.sql','Package checksum and JSON manifest verified','internal package manifest verification failed','pg_dump','pre-dev115-app.tar.gz','Deployment already confirmed','77|$LATEST_MIGRATION','database contract verification failed','Production and R2 clone snapshots: unchanged'])assert.ok(deploy.includes(marker),`missing deploy control: ${marker}`);
  assert.doesNotMatch(deploy,/EXPECTED_ROOT=\/home\/nysareal\/nysa-crm(?:\s|$)/);
  for(const marker of ['Rollback procedure','pg_restore --clean --if-exists','Concise Release 3B UAT checklist','Known gaps retained explicitly','Do not run the deployer until the user separately authorises CRM Test deployment','no automatic Property Match, reservation, availability commitment'])assert.ok(guide.includes(marker),`missing guide contract: ${marker}`);
});
