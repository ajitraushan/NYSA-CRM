import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=name=>new URL(`../release-artifacts/release-3/consolidated/${name}`,import.meta.url);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev191 is a checksum-bound CRM-Test-only delta from the exact deployed dev190 package',()=>{
  const name='nysa-core-consolidated-crm-test-dev191-r10.zip';
  const bytes=fs.readFileSync(artifact(name));
  const manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8'));
  const checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();
  assert.equal(checksum,`${sha(bytes)}  ${name}`);
  assert.equal(manifest.packageSha256,sha(bytes));
  assert.equal(manifest.version,'2.1.0-dev.191');
  assert.equal(manifest.target,'CRM Test only');
  assert.equal(manifest.sourceBaselinePackageSha256,'220c14b96cb8650d30c716acf75e4e857f06893def782421fe58eb62a94d171f');
  assert.equal(manifest.latestMigration,'122_commission_invoice_legal_and_bank_details.sql');
  assert.equal(manifest.migrationCount,122);
  assert.deepEqual(manifest.newMigrations,['122_commission_invoice_legal_and_bank_details.sql']);
  for(const excluded of ['Production','R2 clone'])assert.ok(manifest.excluded.includes(excluded));
});

test('dev191 contains only the approved invoice correction runtime delta and intact historical migrations',()=>{
  const current=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev191-r10.zip')));
  const baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev190-r6.zip')));
  const expected=['package-lock.json','package.json','public/app.js','public/receivables-ui.js','src/commission-invoice-pdf.js','src/commission-receivables.js','src/migrations/122_commission_invoice_legal_and_bank_details.sql','src/organization-domain.js','src/proposal-pdf.js','src/routes/crm.js','src/routes/governance.js'];
  const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
  const changed=Object.keys(current).filter(name=>runtime(name)&&!name.endsWith('/')&&(!baseline[name]||sha(current[name])!==sha(baseline[name]))).sort();
  assert.deepEqual(changed,expected);
  for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/'))assert.equal(sha(current[name]),sha(bytes),name);
  assert.equal(JSON.parse(Buffer.from(current['package.json'])).version,'2.1.0-dev.191');
});
