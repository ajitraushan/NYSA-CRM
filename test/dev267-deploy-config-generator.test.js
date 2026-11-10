import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV267 deploy config generator binds files, contracts and the accepted baseline without handwritten hashes',()=>{
  const source=read('tools/generate-crm-test-deploy-config.mjs');
  assert.match(source,/Origin manifest does not bind the package bytes/);
  assert.match(source,/Source config is not the approved installed baseline/);
  assert.match(source,/expectedPostTableNames:expectedTableNames/);
  assert.match(source,/expectedTriggerContractSha256:triggers\.canonicalSha256/);
  assert.match(source,/schemaContractHelperSha256:sha256Lf/);
  assert.match(source,/allHashFields64Hex:true,allNamedFilesMatch:true/);
  assert.match(source,/atomicWrite\(files\.output/);
  assert.doesNotMatch(source,/DEV267_DEPLOY_CONFIG/);
});
