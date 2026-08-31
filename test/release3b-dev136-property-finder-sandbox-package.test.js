import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const base=new URL('../release-artifacts/release-3/r3b/',import.meta.url);
const read=name=>readFileSync(new URL(name,base));
const text=name=>read(name).toString('utf8');

test('dev.136 Property Finder sandbox package is checksum-bound migration-neutral and credential-free',()=>{
  const name='nysa-core-r3b-property-finder-sandbox-connector-dev136.zip',zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest=JSON.parse(text('nysa-core-r3b-property-finder-sandbox-connector-dev136.manifest.json')),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text('nysa-core-r3b-property-finder-sandbox-connector-dev136.sha256.txt').trim(),`${sha}  ${name}`);
  assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.136');assert.equal(manifest.baselineVersion,'2.1.0-dev.135');
  assert.equal(manifest.latestMigration,'081_release3b_portal_permit_reconciliation.sql');assert.equal(manifest.migrationCount,81);assert.equal(manifest.migrationNeutral,true);
  assert.deepEqual(manifest.requirements,['R3B-PF-SANDBOX-BOUNDARY-84','R3B-PF-SAFE-READS-85','R3B-PF-CREDENTIAL-PRIVACY-86','R3B-PF-NO-PUBLICATION-87']);
  for(const required of ['package.json','src/property-finder-sandbox.js','src/routes/property-finder-sandbox.js','src/server.js','docs/RELEASE_3B_PROPERTY_FINDER_SANDBOX_CONNECTOR.md','release-artifacts/release-3/r3b/R3B_DEV136_PROPERTY_FINDER_SANDBOX_CONNECTOR_DEPLOYMENT_AND_UAT.md','release-artifacts/release-3/r3b/deploy-crm-test-r3b-dev136-property-finder-sandbox-connector.sh','RUNTIME_MANIFEST.sha256','MANIFEST.sha256'])assert.ok(names.includes(required),required);
  assert.ok(!names.some(entry=>entry==='.env'||entry.endsWith('/.env')));for(const entry of names)assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'),entry);
  const records=value=>Buffer.from(value).toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>({sha256:line.slice(0,64),path:line.slice(66)}));
  const archive=records(entries['MANIFEST.sha256']),runtime=records(entries['RUNTIME_MANIFEST.sha256']);assert.equal(archive.length,names.length-1);
  for(const item of archive)assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha256,item.path);
  for(const item of runtime)assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha256,item.path);
  assert.equal(JSON.parse(Buffer.from(entries['package.json'])).version,'2.1.0-dev.136');
});

test('dev.136 deployer is CRM-Test-only rollback-ready and never calls Property Finder',()=>{
  const deploy=text('deploy-crm-test-r3b-dev136-property-finder-sandbox-connector.sh'),guide=text('R3B_DEV136_PROPERTY_FINDER_SANDBOX_CONNECTOR_DEPLOYMENT_AND_UAT.md');
  for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','PRODUCTION_ROOT=/home/nysareal/nysa-crm','R2_CLONE_ROOT=/home/nysareal/nysa-r2-prod-clone','EXPECTED_VERSION=2.1.0-dev.136','PREVIOUS_VERSION=2.1.0-dev.135','LATEST_MIGRATION=081_release3b_portal_permit_reconciliation.sql','EXPECTED_PACKAGE=nysa-core-r3b-property-finder-sandbox-connector-dev136.zip','pre-dev136.dump','pre-dev136-app.tar.gz','sha256sum -c "$tmp/RUNTIME_MANIFEST.sha256"','approved Property Finder sandbox host guard is missing','listing write or publication operation is prohibited in dev.136','Production snapshot changed','R2 clone snapshot changed'])assert.ok(deploy.includes(marker),marker);
  assert.doesNotMatch(deploy,/curl[^\n]*sandbox\.atlas\.propertyfinder\.com/);
  for(const marker of ['dev.135','081/81','dev.136','deployment installs the connector disabled','VERIFY_PROPERTY_FINDER_SANDBOX','no listing is created or published','Production/R2 remain unchanged'])assert.match(guide,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
