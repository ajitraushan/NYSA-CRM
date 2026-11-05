import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preparation = path.join(root, 'release-artifacts', 'dev265-preparation');
const configFile = path.join(preparation, 'DEV265_DEPLOY_CONFIG.json');
const proofFile = path.join(preparation, 'DEV265_CONFIG_HASH_VERIFICATION.json');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('DEV265 deploy config hashes are complete and match every named file', () => {
  const configBytes = fs.readFileSync(configFile);
  const config = JSON.parse(configBytes);
  const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-artifacts', 'origin', 'nysa-core-2.1.0-dev.265-origin.manifest.json'), 'utf8'));

  assert.equal(proof.configSha256, crypto.createHash('sha256').update(configBytes).digest('hex'));
  assert.equal(proof.allHashFields64Hex, true);
  assert.equal(proof.allNamedFilesMatch, true);
  assert.equal(config.commit, manifest.commit);
  assert.equal(config.archiveHash, manifest.packageSha256);
  assert.equal(config.expectedTestPassed, manifest.testReceipt.passed);
  assert.equal(manifest.testReceipt.failed, 0);

  for (const [field, value] of Object.entries(config).filter(([name]) => /hash|sha256/i.test(name))) {
    assert.match(value, /^[a-f0-9]{64}$/, `${field} must be 64 lowercase hexadecimal characters`);
  }

  for (const [field, check] of Object.entries(proof.fileChecks)) {
    const namedFile = path.join(root, ...check.file.split('/'));
    assert.equal(config[field], check.configured, `${field} proof must bind the config value`);
    assert.equal(check.actual, sha256(namedFile), `${field} proof must hash the named file`);
    assert.equal(check.configured, check.actual, `${field} must match the named file`);
    assert.equal(check.is64Hex, true);
    assert.equal(check.matches, true);
  }
});
