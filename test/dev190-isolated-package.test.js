import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const artifact=new URL('../release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev190-r6.zip',import.meta.url);
const manifestUrl=new URL('../release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev190-r6.manifest.json',import.meta.url);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

test('dev190 package is checksum-bound to deployed dev189 and contains only migration 121',()=>{
  const bytes=fs.readFileSync(artifact),manifest=JSON.parse(fs.readFileSync(manifestUrl,'utf8')),entries=unzipSync(bytes);
  assert.equal(manifest.version,'2.1.0-dev.190');
  assert.equal(manifest.packageSha256,sha(bytes));
  assert.equal(manifest.sourceBaselinePackageSha256,'9f7569b86eaf8b4d35fec6bd2a2cbd8b81dcade62872b48f28bed937c4d06451');
  assert.deepEqual(manifest.newMigrations,['121_agent_social_media_payout_eligibility.sql']);
  assert.ok(entries['src/migrations/121_agent_social_media_payout_eligibility.sql']);
  assert.equal(Object.keys(entries).filter(x=>x.startsWith('src/migrations/')).length,121);
});

test('dev190 package contains invoice access, Agent eligibility and payout preflight fixes',()=>{
  const entries=unzipSync(fs.readFileSync(artifact)),text=name=>Buffer.from(entries[name]).toString('utf8');
  assert.ok(text('src/accountant-access.js').includes("/^\\/finance\\/receivables\\/[a-f0-9-]{36}\\/document$/"));
  assert.match(text('public/app.js'),/Social-media payout eligibility/);
  assert.match(text('src/routes/commission-payout.js'),/applySocialMediaPayoutBonus/);
  assert.match(text('src/routes/commission-payout.js'),/policy_ready/);
  assert.match(text('src/routes/commission-payout.js'),/receiptQuarterKey\(line\.receiptDate\)/);
  assert.ok(entries['src/commission-payout-sheet-pdf.js']);
  assert.match(text('public/commission-payout-ui.js'),/Download email attachment/);
  assert.match(text('public/commission-payout-ui.js'),/Blocked — no active policy for receipt date/);
});
