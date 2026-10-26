import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const dir=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev183 workflow package is an exact migration-neutral delta from dev182',()=>{
  const bytes=fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev183.zip',dir));
  const entries=unzipSync(bytes),manifest=JSON.parse(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev183.manifest.json',dir)));
  assert.equal(hash(bytes),'ea097eea49bf5b23bdbd8c28f946585caa0b948fb5498e162a84f7116bd5f528');
  assert.equal(manifest.packageSha256,hash(bytes));assert.equal(manifest.version,'2.1.0-dev.183');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.182');assert.equal(manifest.migrationNeutral,true);assert.deepEqual(manifest.newMigrations,[]);
  assert.equal(manifest.changedRuntimeFiles.length,7);assert.equal(Object.keys(entries).length,307);
  assert.equal(Object.keys(entries).filter(name=>name.startsWith('src/migrations/')).length,117);
  const prior=unzipSync(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev182.zip',dir)));
  for(const [name,content] of Object.entries(prior))if(name.startsWith('src/migrations/')||(!manifest.changedRuntimeFiles.includes(name)&&!name.endsWith('MANIFEST.sha256')))assert.equal(hash(entries[name]),hash(content),name);
  for(const record of manifest.files)assert.equal(hash(entries[record.path]),record.sha256,record.path);
  assert.match(Buffer.from(entries['src/routes/lead-operations.js']).toString(),/taskType:'opportunity_action'/);
  assert.match(Buffer.from(entries['public/receivables-ui.js']).toString(),/Create commission invoice/);
  assert.match(Buffer.from(entries['public/offer-ui.js']).toString(),/NYSA \/ represented party accepted this priced counteroffer/);
  for(const name of Object.keys(entries))assert.ok(!/^storage\/|^node_modules\/|^\.env$|(^|\/)\.\.(\/|$)/.test(name),name);
});
