import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const argumentsOf = (values) => {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error('Named arguments are required');
    result[key.slice(2)] = value;
  }
  return result;
};
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const args = argumentsOf(process.argv.slice(2));
for (const name of ['zip', 'helper', 'baseline-manifest-sha256', 'canonical-manifest-sha256', 'output']) {
  if (!args[name]) throw new Error(`Missing argument: ${name}`);
}
const expectedHashes = [args['baseline-manifest-sha256'], args['canonical-manifest-sha256']];
if (expectedHashes.some((value) => !/^[a-f0-9]{64}$/.test(value))) throw new Error('Manifest hashes must be 64 lowercase hexadecimal characters');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nysa-hosted-schema-layout-'));
try {
  const candidate = path.join(temporary, 'candidate');
  const hostedTools = path.join(temporary, 'hosted-tools');
  fs.mkdirSync(candidate);
  fs.mkdirSync(hostedTools);
  execFileSync('tar', ['-xf', path.resolve(args.zip), '-C', candidate], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (fs.existsSync(path.join(candidate, 'tools'))) throw new Error('Extracted origin package unexpectedly contains a tools directory');
  const helper = path.join(hostedTools, 'database-schema-contract.mjs');
  fs.writeFileSync(helper, fs.readFileSync(path.resolve(args.helper), 'utf8').replaceAll('\r\n', '\n'));
  const helperSha256 = sha256(helper);
  const module = await import(`${pathToFileURL(helper).href}?sha256=${helperSha256}`);
  const results = [];
  for (const [directory, expectedManifestSha256] of [
    ['database-schema-baseline', args['baseline-manifest-sha256']],
    ['database-schema-contract', args['canonical-manifest-sha256']],
  ]) {
    const contractDirectory = path.join(candidate, 'src', directory);
    const manifestFile = path.join(contractDirectory, 'manifest.json');
    const loaded = module.loadSchemaContractIdentity({
      helperFile: helper,
      expectedHelperSha256: helperSha256,
      contractDirectory,
      manifestFile,
      expectedManifestSha256,
      triggerContractFile: path.join(candidate, 'src', 'database-trigger-contract.json'),
      label: directory,
    });
    results.push({
      directory,
      identity: {
        helperFile: 'hosted-tools/database-schema-contract.mjs',
        helperSha256: loaded.identity.helperSha256,
        manifestFile: `candidate/src/${directory}/manifest.json`,
        manifestSha256: loaded.identity.manifestSha256,
        triggerContractFile: 'candidate/src/database-trigger-contract.json',
        triggerContractSha256: loaded.identity.triggerContractSha256,
      },
      counts: module.schemaContractSummary(loaded.contract),
    });
  }
  const evidence = {
    schema: 'nysa.hosted-schema-contract-layout-test.v1',
    package: path.basename(args.zip),
    packageSha256: sha256(path.resolve(args.zip)),
    extractedCandidateToolsPresent: false,
    helperSource: path.basename(args.helper),
    hostedToolsOnlyHelperSha256: helperSha256,
    repositoryAccessRequiredAtRuntime: false,
    results,
    passed: true,
  };
  fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
