import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const root=new URL('../',import.meta.url);
const artifact=name=>new URL(`release-artifacts/release-3/consolidated/${name}`,root);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stem='nysa-core-consolidated-crm-test-dev208-r1';

test('DEV208 package identity and both internal manifests are exact',()=>{
  const zipBytes=fs.readFileSync(artifact(`${stem}.zip`));
  const expected=fs.readFileSync(artifact(`${stem}.sha256.txt`),'utf8').trim().split(/\s+/)[0];
  const manifest=JSON.parse(fs.readFileSync(artifact(`${stem}.manifest.json`),'utf8'));
  assert.equal(sha(zipBytes),expected);
  assert.equal(manifest.packageSha256,expected);
  assert.equal(manifest.version,'2.1.0-dev.208');
  assert.equal(manifest.sourceBaselineVersion,'2.1.0-dev.207');
  assert.equal(manifest.latestMigration,'127_governed_purchased_data_intake.sql');
  assert.equal(manifest.migrationCount,127);
  assert.equal(manifest.migrationNeutral,false);

  const files=unzipSync(zipBytes);
  for(const manifestName of ['RUNTIME_MANIFEST.sha256','MANIFEST.sha256']){
    const lines=Buffer.from(files[manifestName]).toString().trim().split('\n');
    for(const line of lines){
      const [,expectedHash,name]=line.match(/^([0-9a-f]{64})  (.+)$/)||[];
      assert.ok(name,`malformed ${manifestName} line: ${line}`);
      assert.ok(files[name],`${name} missing from package`);
      assert.equal(sha(files[name]),expectedHash,`${name} hash mismatch`);
    }
  }
  assert.equal(JSON.parse(Buffer.from(files['package.json']).toString()).version,'2.1.0-dev.208');
  assert.ok(files['src/migrations/127_governed_purchased_data_intake.sql']);
  assert.ok(files['public/templates/purchased-customer-import-template.xlsx']);
  assert.ok(files['public/templates/purchased-lead-import-template.xlsx']);
});

test('DEV208 preserves all historical migrations byte-for-byte',()=>{
  const baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev207-r2.zip')));
  const candidate=unzipSync(fs.readFileSync(artifact(`${stem}.zip`)));
  const historical=Object.keys(baseline).filter(name=>name.startsWith('src/migrations/')&&name.endsWith('.sql'));
  assert.equal(historical.length,126);
  for(const name of historical)assert.equal(sha(candidate[name]),sha(baseline[name]),name);
  const current=Object.keys(candidate).filter(name=>name.startsWith('src/migrations/')&&name.endsWith('.sql'));
  assert.equal(current.length,127);
});

test('DEV208 deployer is CRM-Test-only, baseline-bound and migration-aware',()=>{
  const deployer=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev208-r1.sh'),'utf8');
  assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.208/);
  assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.207/);
  assert.match(deployer,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(deployer,/EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal/);
  assert.match(deployer,/LATEST_MIGRATION=127_governed_purchased_data_intake\.sql/);
  assert.match(deployer,/before_migration" == "126\|\$PREVIOUS_MIGRATION/);
  assert.match(deployer,/after_migration" == "127\|\$LATEST_MIGRATION/);
  assert.match(deployer,/purchased_data_import_authorizations/);
  assert.match(deployer,/Production and R2 clone snapshots: unchanged/);
  assert.doesNotMatch(deployer,/\r/);
});
