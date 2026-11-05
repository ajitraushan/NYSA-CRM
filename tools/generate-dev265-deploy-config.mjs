import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'release-artifacts', 'dev264-preparation', 'DEV264_DEPLOY_CONFIG.json');
const outputDirectory = path.join(root, 'release-artifacts', 'dev265-preparation');
const output = path.join(outputDirectory, 'DEV265_DEPLOY_CONFIG.json');
const proofOutput = path.join(outputDirectory, 'DEV265_CONFIG_HASH_VERIFICATION.json');
const proofTextOutput = path.join(outputDirectory, 'DEV265_CONFIG_HASH_VERIFICATION_OUTPUT.txt');
const config = JSON.parse(fs.readFileSync(source, 'utf8'));
const triggerContract = JSON.parse(fs.readFileSync(path.join(root, 'src', 'database-trigger-contract.json'), 'utf8'));
const packageFile = path.join(root, 'release-artifacts', 'origin', 'nysa-core-2.1.0-dev.265-origin.zip');
const manifestFile = path.join(root, 'release-artifacts', 'origin', 'nysa-core-2.1.0-dev.265-origin.manifest.json');
const baselineContractManifest = path.join(root, 'src', 'database-schema-baseline', 'manifest.json');
const canonicalContractManifest = path.join(root, 'src', 'database-schema-contract', 'manifest.json');
const triggerContractFile = path.join(root, 'src', 'database-trigger-contract.json');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const releaseManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

Object.assign(config, {
  base: '/home/nysareal/crm-release-preparation/20261106-dev265/evidence',
  candidate: '/home/nysareal/crm-release-preparation/20261106-dev265/candidate',
  zip: '/home/nysareal/crm-release-preparation/20261106-dev265/nysa-core-2.1.0-dev.265-origin.zip',
  manifest: '/home/nysareal/crm-release-preparation/20261106-dev265/nysa-core-2.1.0-dev.265-origin.manifest.json',
  version: '2.1.0-dev.265',
  baselineVersion: '2.1.0-dev.264',
  baselineCommit: '8d9be904149bec1b9b6d56dd8a39f17c2789fd12',
  commit: releaseManifest.commit,
  archiveHash: sha256(packageFile),
  manifestHash: sha256(manifestFile),
  operatorCommit: '7c276374857112dad6d0d3729461a152704418d0',
  baselineMigrationCount: 168,
  expectedMigrationCount: 169,
  baselineTriggers: triggerContract.triggers,
  baselineSchemaContractManifestSha256: sha256(baselineContractManifest),
  expectedSchemaContractManifestSha256: sha256(canonicalContractManifest),
  expectedTestPassed: releaseManifest.testReceipt.passed,
});

if (config.expectedTableCount !== 303 || config.expectedPostTableCount !== 303) throw new Error('DEV264 table baseline is not 303/303');
if (config.baselineTriggers.length !== 108 || config.expectedTriggerCount !== 108) throw new Error('DEV264 trigger baseline is not 108/108');
if (releaseManifest.packageSha256 !== config.archiveHash || releaseManifest.commit !== config.commit) throw new Error('Origin manifest does not bind the package or commit');
if (!Number.isInteger(config.expectedTestPassed) || config.expectedTestPassed < 1 || releaseManifest.testReceipt.failed !== 0) {
  throw new Error('Origin manifest does not contain a successful governed test receipt');
}
const fileChecks = {
  archiveHash: { file: packageFile, actual: sha256(packageFile) },
  manifestHash: { file: manifestFile, actual: sha256(manifestFile) },
  baselineSchemaContractManifestSha256: { file: baselineContractManifest, actual: sha256(baselineContractManifest) },
  expectedSchemaContractManifestSha256: { file: canonicalContractManifest, actual: sha256(canonicalContractManifest) },
};
for (const [field, check] of Object.entries(fileChecks)) {
  check.configured = config[field];
  check.is64Hex = /^[a-f0-9]{64}$/.test(check.configured);
  check.matches = check.is64Hex && check.configured === check.actual;
  check.file = path.relative(root, check.file).replaceAll('\\', '/');
  if (!check.matches) throw new Error(`${field} does not match ${check.file}`);
}
const triggerCanonical = crypto.createHash('sha256').update(JSON.stringify(triggerContract.triggers)).digest('hex');
const embeddedChecks = {
  expectedTriggerContractSha256: {
    file: path.relative(root, triggerContractFile).replaceAll('\\', '/'),
    configured: config.expectedTriggerContractSha256,
    actual: triggerCanonical,
    is64Hex: /^[a-f0-9]{64}$/.test(config.expectedTriggerContractSha256),
    matches: config.expectedTriggerContractSha256 === triggerContract.canonicalSha256 && config.expectedTriggerContractSha256 === triggerCanonical,
    comparison: 'canonicalSha256 and SHA-256(JSON.stringify(triggers))',
  },
};
if (!embeddedChecks.expectedTriggerContractSha256.is64Hex || !embeddedChecks.expectedTriggerContractSha256.matches) throw new Error('Trigger contract canonical hash mismatch');
for (const [field, value] of Object.entries(config).filter(([name]) => /hash|sha256/i.test(name))) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${field} must be exactly 64 lowercase hexadecimal characters`);
}
fs.mkdirSync(outputDirectory, { recursive: true });
const configBytes = `${JSON.stringify(config, null, 2)}\n`;
const proof = {
  schema: 'nysa.dev265.config-hash-verification.v1',
  generatedAt: new Date().toISOString(),
  config: path.relative(root, output).replaceAll('\\', '/'),
  configSha256: crypto.createHash('sha256').update(configBytes).digest('hex'),
  allHashFields64Hex: true,
  allNamedFilesMatch: true,
  fileChecks,
  embeddedChecks,
};
const configTemporary = `${output}.tmp`;
const proofTemporary = `${proofOutput}.tmp`;
const proofTextTemporary = `${proofTextOutput}.tmp`;
for (const file of [configTemporary, proofTemporary, proofTextTemporary]) if (fs.existsSync(file)) fs.rmSync(file);
fs.writeFileSync(configTemporary, configBytes, { flag: 'wx' });
const proofBytes = `${JSON.stringify(proof, null, 2)}\n`;
fs.writeFileSync(proofTemporary, proofBytes, { flag: 'wx' });
fs.writeFileSync(proofTextTemporary, proofBytes, { flag: 'wx' });
fs.renameSync(configTemporary, output);
fs.renameSync(proofTemporary, proofOutput);
fs.renameSync(proofTextTemporary, proofTextOutput);
console.log(JSON.stringify(proof, null, 2));
