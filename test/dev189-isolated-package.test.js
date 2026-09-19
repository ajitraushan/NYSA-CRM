import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=new URL('../release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev189-r4.zip',import.meta.url);
const manifestUrl=new URL('../release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev189-r4.manifest.json',import.meta.url);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

test('dev189 package is checksum-bound to deployed dev188 and contains only migrations 119 and 120',()=>{
  const bytes=fs.readFileSync(artifact),manifest=JSON.parse(fs.readFileSync(manifestUrl,'utf8')),entries=unzipSync(bytes);
  assert.equal(manifest.version,'2.1.0-dev.189');
  assert.equal(manifest.packageSha256,sha(bytes));
  assert.equal(manifest.sourceBaselinePackageSha256,'c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4');
  assert.deepEqual(manifest.newMigrations,['119_invoice_payment_auto_confirmation.sql','120_commission_payment_batches.sql']);
  assert.ok(entries['src/migrations/119_invoice_payment_auto_confirmation.sql']);
  assert.ok(entries['src/migrations/120_commission_payment_batches.sql']);
  assert.equal(Object.keys(entries).filter(x=>x.startsWith('src/migrations/')).length,120);
});

test('dev189 package contains the shared Commission Payments workflow',()=>{
  const entries=unzipSync(fs.readFileSync(artifact)),text=name=>Buffer.from(entries[name]).toString('utf8');
  assert.match(text('public/commission-payout-ui.js'),/Approve selected payments/);
  assert.match(text('public/accountant-workspace-ui.js'),/Commission Payments/);
  assert.match(text('src/routes/commission-payout.js'),/commission-payment-batches/);
  assert.match(text('src/receivable-receipt-posting.js'),/created_from_invoice_payment/);
});

test('dev189 package contains the Closed Won commission-receivable selector and automatic invoice numbering',()=>{
  const entries=unzipSync(fs.readFileSync(artifact)),text=name=>Buffer.from(entries[name]).toString('utf8');
  assert.match(text('public/receivables-ui.js'),/Commission receivable \/ Closed Opportunity/);
  assert.match(text('public/receivables-ui.js'),/row\.displayParty/);
  assert.match(text('public/receivables-ui.js'),/row\.outstandingCommissionCents/);
  assert.match(text('src/commission-receivables.js'),/o\.stage='Closed Won'/);
  assert.match(text('src/commission-receivables.js'),/NYSA-INV-\$\{year\}/);
});
