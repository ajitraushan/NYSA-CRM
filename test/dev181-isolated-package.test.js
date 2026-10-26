import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const dir=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev181 correction package is an exact migration-neutral delta from deployed dev179',()=>{
  const bytes=fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev181.zip',dir));
  const entries=unzipSync(bytes),manifest=JSON.parse(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev181.manifest.json',dir)));
  assert.equal(hash(bytes),'0ec7d9d170067a7e300f3cb37ffaf5471ef86de34eb853084bbd0dfc23ca1bf8');
  assert.equal(manifest.packageSha256,hash(bytes));assert.equal(manifest.version,'2.1.0-dev.181');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.179');assert.equal(manifest.newMigrations.length,0);
  assert.equal(manifest.changedRuntimeFiles.length,9);assert.equal(Object.keys(entries).length,306);
  assert.equal(Object.keys(entries).filter(name=>name.startsWith('src/migrations/')).length,116);
  const prior=unzipSync(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev179.zip',dir)));
  for(const [name,content] of Object.entries(prior))if(name.startsWith('src/migrations/')||(!manifest.changedRuntimeFiles.includes(name)&&!name.endsWith('MANIFEST.sha256')))assert.equal(hash(entries[name]),hash(content),name);
  for(const record of manifest.files)assert.equal(hash(entries[record.path]),record.sha256,record.path);
  const accountant=Buffer.from(entries['src/accountant-access.js']).toString(),receivables=Buffer.from(entries['src/commission-receivables.js']).toString();
  assert.match(accountant,/finance\\\/receivables\\\/awaiting/);assert.match(receivables,/o\.stage='Closed Won'/);
  assert.match(Buffer.from(entries['src/dashboard-pipeline.js']).toString(),/WHEN 'Closed Won' THEN 10/);
  assert.match(Buffer.from(entries['public/document-compliance-ui.js']).toString(),/Document checklist refreshed for the current transaction details/);
  for(const name of Object.keys(entries))assert.ok(!/^storage\/|^node_modules\/|^\.env$|(^|\/)\.\.(\/|$)/.test(name),name);
});
