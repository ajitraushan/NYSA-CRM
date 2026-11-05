import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'release-artifacts', 'dev264-preparation', 'DEV264_DEPLOY_CONFIG.json');
const outputDirectory = path.join(root, 'release-artifacts', 'dev265-preparation');
const output = path.join(outputDirectory, 'DEV265_DEPLOY_CONFIG.json');
const config = JSON.parse(fs.readFileSync(source, 'utf8'));
const triggerContract = JSON.parse(fs.readFileSync(path.join(root, 'src', 'database-trigger-contract.json'), 'utf8'));

Object.assign(config, {
  base: '/home/nysareal/crm-release-preparation/20261106-dev265/evidence',
  candidate: '/home/nysareal/crm-release-preparation/20261106-dev265/candidate',
  zip: '/home/nysareal/crm-release-preparation/20261106-dev265/nysa-core-2.1.0-dev.265-origin.zip',
  manifest: '/home/nysareal/crm-release-preparation/20261106-dev265/nysa-core-2.1.0-dev.265-origin.manifest.json',
  version: '2.1.0-dev.265',
  baselineVersion: '2.1.0-dev.264',
  baselineCommit: '8d9be904149bec1b9b6d56dd8a39f17c2789fd12',
  commit: 'd4541b7a0bd4b70e3a2642c27a387c4e7c192225',
  archiveHash: 'e809353434e3a1687f5a7e678325b95fcf36820085155f8b21338c2c3a7973d0',
  manifestHash: 'bfa912882f60a692d6f6fbc69298932178a14f34204eae20c04527b8ec67ed',
  operatorCommit: '7c276374857112dad6d0d3729461a152704418d0',
  baselineMigrationCount: 168,
  expectedMigrationCount: 169,
  baselineTriggers: triggerContract.triggers,
  baselineSchemaContractManifestSha256: '4b3a04e9136193de9ec7413e51962381ffb9576eb71b062b7c263c50452390a9',
  expectedSchemaContractManifestSha256: '496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa',
  expectedTestPassed: 1559,
});

if (config.expectedTableCount !== 303 || config.expectedPostTableCount !== 303) throw new Error('DEV264 table baseline is not 303/303');
if (config.baselineTriggers.length !== 108 || config.expectedTriggerCount !== 108) throw new Error('DEV264 trigger baseline is not 108/108');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
console.log(output);
