import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const root=new URL('../release-artifacts/release-3/r3b/',import.meta.url),name='nysa-core-r3b-property-finder-media-derivatives-dev144.zip',stem=name.slice(0,-4),read=file=>readFileSync(new URL(file,root)),text=file=>read(file).toString('utf8');

test('dev.144 derivative package is checksum-bound, portable and migration 082 aware',()=>{
  const zip=read(name),sha=crypto.createHash('sha256').update(zip).digest('hex'),manifest=JSON.parse(text(`${stem}.manifest.json`)),entries=unzipSync(zip),names=Object.keys(entries);
  assert.equal(text(`${stem}.sha256.txt`).trim(),`${sha}  ${name}`);assert.equal(manifest.packageSha256,sha);assert.equal(manifest.version,'2.1.0-dev.144');assert.equal(manifest.baselineVersion,'2.1.0-dev.143');assert.equal(manifest.latestMigration,'082_release3b_property_finder_media_derivatives.sql');assert.equal(manifest.migrationCount,82);assert.equal(manifest.migrationNeutral,false);
  for(const required of ['package.json','public/app.js','public/index.html','src/property-finder-media-derivative.js','src/routes/files-proposals.js','src/migrations/082_release3b_property_finder_media_derivatives.sql','RUNTIME_MANIFEST.sha256','MANIFEST.sha256'])assert.ok(names.includes(required),required);
  for(const entry of names)assert.ok(!entry.includes('\\')&&!entry.startsWith('/')&&!entry.split('/').includes('..'),entry);
  const records=value=>Buffer.from(value).toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>({sha:line.slice(0,64),path:line.slice(66)}));for(const item of records(entries['MANIFEST.sha256']))assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha,item.path);for(const item of records(entries['RUNTIME_MANIFEST.sha256']))assert.equal(crypto.createHash('sha256').update(entries[item.path]).digest('hex'),item.sha,item.path);
});

test('dev.144 deployer is CRM-Test-only, default-off and PF-write-free',()=>{
  const deploy=text('deploy-crm-test-r3b-dev144-property-finder-media-derivatives.sh');for(const marker of ['EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage','EXPECTED_VERSION=2.1.0-dev.144','PREVIOUS_VERSION=2.1.0-dev.143','BASELINE_MIGRATION=081_release3b_portal_permit_reconciliation.sql','LATEST_MIGRATION=082_release3b_property_finder_media_derivatives.sql','PROPERTY_FINDER_ALLOW_READS','PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS','Production snapshot changed','R2 clone snapshot changed','Create PF-ready copy'])assert.ok(deploy.includes(marker),marker);
  assert.doesNotMatch(deploy,/curl[^\n]*sandbox\.atlas\.propertyfinder\.com/);assert.match(deploy,/Property Finder write or publication operation is prohibited/);assert.match(deploy,/PF write operation is prohibited/);
});
