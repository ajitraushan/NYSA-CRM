import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const pairs=[
  ['src/database-schema-baseline/columns.json','src/database-schema-contract/columns.json'],
  ['src/database-schema-baseline/constraints.json','src/database-schema-contract/constraints.json'],
  ['src/database-schema-baseline/functions.json','src/database-schema-contract/functions.json'],
  ['src/database-schema-baseline/indexes.json','src/database-schema-contract/indexes.json'],
  ['src/database-schema-baseline/sequences-views.json','src/database-schema-contract/sequences-views.json'],
  ['src/database-schema-baseline/manifest.json','src/database-schema-contract/manifest.json'],
  ['src/database-schema-baseline/database-trigger-contract.json','src/database-trigger-contract.json']
];
const files=pairs.map(([baseline,canonical])=>{
  const baselineSha256=sha256(baseline),canonicalSha256=sha256(canonical),byteIdentical=fs.readFileSync(path.join(root,baseline)).equals(fs.readFileSync(path.join(root,canonical)));
  assert.equal(byteIdentical,true,`${baseline} is not byte-identical to ${canonical}`);
  assert.equal(baselineSha256,canonicalSha256);
  return{baseline,canonical,baselineSha256,canonicalSha256,byteIdentical};
});
const manifestSha256=sha256('src/database-schema-contract/manifest.json'),triggerFileSha256=sha256('src/database-trigger-contract.json');
assert.equal(manifestSha256,'59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944');
assert.equal(triggerFileSha256,'70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf');
const configPath=process.argv[2];
let config=null;
if(configPath){
  config=JSON.parse(fs.readFileSync(path.resolve(configPath),'utf8'));
  assert.equal(config.version,'2.1.0-dev.268');
  assert.equal(config.baselineMigrationCount,170);
  assert.equal(config.expectedMigrationCount,170);
  assert.equal(config.expectedTableCount,306);
  assert.equal(config.expectedPostTableCount,306);
  assert.equal(config.baselineTriggers.length,111);
  assert.equal(config.expectedTriggerCount,111);
  assert.equal(config.baselineSchemaContractManifestSha256,manifestSha256);
  assert.equal(config.expectedSchemaContractManifestSha256,manifestSha256);
}
const result={schema:'nysa.dev267a.release-contract-verification.v1',version:'2.1.0-dev.268',migrationNeutral:true,expected:{migrationsBefore:170,migrationsAfter:170,tablesBefore:306,tablesAfter:306,triggersBefore:111,triggersAfter:111,manifestSha256,triggerFileSha256},files,config:configPath?{path:configPath,verified:true}:null,verifiedAt:new Date().toISOString()};
process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
