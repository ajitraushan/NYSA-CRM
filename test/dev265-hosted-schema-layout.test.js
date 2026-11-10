import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copyGitLf = (source, target) => fs.writeFileSync(target, fs.readFileSync(source, 'utf8').replaceAll('\r\n', '\n'));

test('schema contract loads from hosted tools while the extracted candidate has no tools directory', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nysa-dev265-hosted-layout-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const candidate = path.join(temporary, 'candidate');
  const hostedTools = path.join(temporary, 'hosted-tools');
  fs.mkdirSync(path.join(candidate, 'src'), { recursive: true });
  fs.mkdirSync(hostedTools, { recursive: true });
  for (const name of ['database-schema-baseline', 'database-schema-contract']) {
    fs.cpSync(path.join(root, 'src', name), path.join(candidate, 'src', name), { recursive: true });
  }
  fs.copyFileSync(path.join(root, 'src', 'database-trigger-contract.json'), path.join(candidate, 'src', 'database-trigger-contract.json'));
  const helper = path.join(hostedTools, 'database-schema-contract.mjs');
  copyGitLf(path.join(root, 'tools', 'database-schema-contract.mjs'), helper);
  assert.equal(fs.existsSync(path.join(candidate, 'tools')), false);

  const module = await import(`${pathToFileURL(helper).href}?sha256=${sha256(helper)}`);
  for (const directory of ['database-schema-baseline', 'database-schema-contract']) {
    const contractDirectory = path.join(candidate, 'src', directory);
    const manifestFile = path.join(contractDirectory, 'manifest.json');
    const triggerContractFile = directory === 'database-schema-baseline'
      ? path.join(contractDirectory, 'database-trigger-contract.json')
      : path.join(candidate, 'src', 'database-trigger-contract.json');
    const loaded = module.loadSchemaContractIdentity({
      helperFile: helper,
      expectedHelperSha256: sha256(helper),
      contractDirectory,
      manifestFile,
      expectedManifestSha256: sha256(manifestFile),
      triggerContractFile,
      label: directory,
    });
    assert.equal(loaded.identity.helperFile, helper);
    assert.equal(loaded.identity.manifestFile, manifestFile);
    assert.ok(loaded.contract.constraints.length > 0);
  }
});

test('schema identity failures identify the exact missing or mismatched file', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nysa-dev265-schema-errors-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const helper = path.join(temporary, 'database-schema-contract.mjs');
  copyGitLf(path.join(root, 'tools', 'database-schema-contract.mjs'), helper);
  const module = await import(`${pathToFileURL(helper).href}?sha256=${sha256(helper)}`);
  const contractDirectory = path.join(root, 'src', 'database-schema-baseline');
  const manifestFile = path.join(contractDirectory, 'manifest.json');
  const common = {
    helperFile: helper,
    expectedHelperSha256: sha256(helper),
    contractDirectory,
    manifestFile,
    expectedManifestSha256: sha256(manifestFile),
    triggerContractFile: path.join(root, 'src', 'database-schema-baseline', 'database-trigger-contract.json'),
    label: 'stage schema-contract',
  };
  assert.throws(() => module.loadSchemaContractIdentity({ ...common, expectedHelperSha256: '0'.repeat(64) }), /helper hash mismatch: expected 0{64}, observed [a-f0-9]{64}/);
  assert.throws(() => module.loadSchemaContractIdentity({ ...common, manifestFile: path.join(temporary, 'missing-manifest.json') }), /manifest file missing/);
  assert.throws(() => module.loadSchemaContractIdentity({ ...common, expectedManifestSha256: 'f'.repeat(64) }), /manifest hash mismatch: expected f{64}, observed [a-f0-9]{64}/);
  assert.throws(() => module.loadSchemaContractIdentity({ ...common, triggerContractFile: path.join(temporary, 'missing-trigger.json') }), /trigger contract file missing/);
});
