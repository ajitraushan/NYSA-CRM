import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/r3b/',import.meta.url);
const read=name=>readFileSync(new URL(name,base));
const text=name=>read(name).toString('utf8');

test('dev.135 Property Finder privacy package is checksum-bound, migration-neutral and portable',()=>{
  const name='nysa-core-r3b-property-finder-privacy-dev135.zip';
  const zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest=JSON.parse(text('nysa-core-r3b-property-finder-privacy-dev135.manifest.json'));
  const entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-r3b-property-finder-privacy-dev135.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);
  assert.equal(manifest.version,'2.1.0-dev.135');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.134');
  assert.equal(manifest.latestMigration,'081_release3b_portal_permit_reconciliation.sql');
  assert.equal(manifest.migrationCount,81);
  assert.equal(manifest.migrationNeutral,true);
  assert.deepEqual(manifest.requirements,['R3B-PF-PROPERTY-TYPE-80','R3B-PF-CONTENT-81','R3B-PF-PRIVACY-82','R3B-PF-SINGLE-DESCRIPTION-83']);
  for(const required of ['package.json','public/app.js','src/portal-publication-domain.js','src/routes/listings.js','src/migrations/081_release3b_portal_permit_reconciliation.sql','docs/RELEASE_3B_DEV135_PROPERTY_FINDER_FIELD_MATRIX.md','release-artifacts/release-3/r3b/R3B_DEV135_PROPERTY_FINDER_PRIVACY_DEPLOYMENT_AND_UAT.md','release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev135-property-finder-privacy.sh','RUNTIME_MANIFEST.sha256','MANIFEST.sha256'])assert.ok(names.includes(required),required);
  for(const entry of names)assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'),entry);
  const decode=value=>Buffer.from(value).toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>({sha256:line.slice(0,64),path:line.slice(66)}));
  const archiveRecords=decode(entries['MANIFEST.sha256']),runtimeRecords=decode(entries['RUNTIME_MANIFEST.sha256']);
  const archiveManifest=archiveRecords.map(item=>item.path),runtimeManifest=runtimeRecords.map(item=>item.path);
  assert.equal(archiveRecords.length,names.length-1);
  for(const item of archiveRecords)assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha256,item.path);
  for(const item of runtimeRecords)assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha256,item.path);
  const expectedRuntime=names.filter(item=>item==='app.cjs'||item==='package.json'||item==='package-lock.json'||item.startsWith('public/')||item.startsWith('src/')).sort();
  assert.deepEqual([...runtimeManifest].sort(),expectedRuntime);
  assert.ok(archiveManifest.includes('docs/RELEASE_3B_DEV135_PROPERTY_FINDER_FIELD_MATRIX.md'));
  assert.ok(archiveManifest.includes('release-artifacts/release-3/r3b/R3B_DEV135_PROPERTY_FINDER_PRIVACY_DEPLOYMENT_AND_UAT.md'));
  assert.ok(archiveManifest.includes('release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev135-property-finder-privacy.sh'));
  assert.ok(archiveManifest.includes('RUNTIME_MANIFEST.sha256'));
  assert.ok(!runtimeManifest.some(item=>item.startsWith('docs/')||item.startsWith('release-artifacts/')));
});

test('dev.135 deployer is CRM-Test-only and blocks credentials, transmission and private outbound fields',()=>{
  const deploy=text('deploy-crm-test-r3b-dev135-property-finder-privacy.sh');
  const guide=text('R3B_DEV135_PROPERTY_FINDER_PRIVACY_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.135','PREVIOUS_VERSION=2.1.0-dev.134','BASELINE_MIGRATION=081_release3b_portal_permit_reconciliation.sql','LATEST_MIGRATION=081_release3b_portal_permit_reconciliation.sql','EXPECTED_PACKAGE=nysa-core-r3b-property-finder-privacy-dev135.zip','RECOVERY_BACKUP=${5:-}','"81|$LATEST_MIGRATION"','pre-dev135.dump','pre-dev135-app.tar.gz','sha256sum -c "$tmp/RUNTIME_MANIFEST.sha256"','installed runtime manifest verified','connector transmission code is prohibited','portal credentials are prohibited','owner/private target guard is missing','t|t|t|t|t|t|t|t|t|t|t|t|t|t|t|r3b-eligibility-v1'])assert.ok(deploy.includes(marker),marker);
  assert.match(deploy,/installed dev\.134 or dev\.135/);
  assert.match(deploy,/Production snapshot changed/);
  assert.match(deploy,/R2 clone snapshot changed/);
  for(const marker of ['dev.134','081/81','sha256sum -c','20260804T093945Z','RUNTIME_MANIFEST.sha256','Save internal permit evidence and reconcile','no owner/represented-party','no external request is made','no listing appears in Property Finder'])assert.match(guide,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
