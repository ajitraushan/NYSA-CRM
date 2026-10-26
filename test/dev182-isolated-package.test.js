import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const dir=new URL('../release-artifacts/release-3/consolidated/',import.meta.url);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev182 correction package is an exact additive delta from deployed dev179',()=>{
  const bytes=fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev182.zip',dir));
  const entries=unzipSync(bytes),manifest=JSON.parse(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev182.manifest.json',dir)));
  assert.equal(hash(bytes),'b71c91c549c1cbc94e93aeb7172936898f46a60b5c1c7d4c155faf05532fca64');
  assert.equal(manifest.packageSha256,hash(bytes));assert.equal(manifest.version,'2.1.0-dev.182');
  assert.equal(manifest.baselineVersion,'2.1.0-dev.179');assert.deepEqual(manifest.newMigrations,['117_transaction_completion_documents.sql']);
  assert.equal(manifest.changedRuntimeFiles.length,12);assert.equal(Object.keys(entries).length,307);
  assert.equal(Object.keys(entries).filter(name=>name.startsWith('src/migrations/')).length,117);
  const prior=unzipSync(fs.readFileSync(new URL('nysa-core-consolidated-crm-test-dev179.zip',dir)));
  for(const [name,content] of Object.entries(prior))if(name.startsWith('src/migrations/')||(!manifest.changedRuntimeFiles.includes(name)&&!name.endsWith('MANIFEST.sha256')))assert.equal(hash(entries[name]),hash(content),name);
  for(const record of manifest.files)assert.equal(hash(entries[record.path]),record.sha256,record.path);
  assert.match(Buffer.from(entries['src/migrations/117_transaction_completion_documents.sql']).toString(),/ALTER COLUMN deal_party_id DROP NOT NULL/);
  assert.match(Buffer.from(entries['src/document-compliance-domain.js']).toString(),/dealPartyId:null/);
  assert.match(Buffer.from(entries['src/document-compliance-gate.js']).toString(),/'transaction'::text AS party_role/);
  assert.match(Buffer.from(entries['src/accountant-access.js']).toString(),/finance\\\/receivables\\\/awaiting/);
  assert.match(Buffer.from(entries['src/commission-receivables.js']).toString(),/o\.stage='Closed Won'/);
  assert.match(Buffer.from(entries['src/dashboard-pipeline.js']).toString(),/WHEN 'Closed Won' THEN 10/);
  for(const name of Object.keys(entries))assert.ok(!/^storage\/|^node_modules\/|^\.env$|(^|\/)\.\.(\/|$)/.test(name),name);
});
