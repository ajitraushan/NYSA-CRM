import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {compareSchemaContracts,loadSchemaContract} from '../tools/database-schema-contract.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baselineDirectory=path.join(root,'src','database-schema-baseline');
const baselineTriggerFile=path.join(baselineDirectory,'database-trigger-contract.json');
const canonicalDirectory=path.join(root,'src','database-schema-contract');
const canonicalTriggerFile=path.join(root,'src','database-trigger-contract.json');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));

test('DEV267a baseline trigger contract is the accepted DEV267 111-trigger contract',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(baselineDirectory,'manifest.json'),'utf8'));
  const contract=JSON.parse(fs.readFileSync(baselineTriggerFile,'utf8'));
  assert.equal(contract.triggerCount,111);
  assert.equal(contract.tableCount,95);
  assert.equal(contract.canonicalSha256,'7f1c3536d6a3c5cdc67acb8abecd75fe83d0e272abda7ec80cf35defdd20eea8');
  assert.equal(sha256(baselineTriggerFile),manifest.triggers.fileSha256);
  assert.equal(manifest.triggers.fileSha256,'70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf');
});

test('migration-neutral release uses the same 111-trigger contract before and after install',()=>{
  const baseline=loadSchemaContract(baselineDirectory,baselineTriggerFile);
  const canonical=loadSchemaContract(canonicalDirectory,canonicalTriggerFile);
  assert.equal(baseline.triggers.length,111);
  assert.equal(canonical.triggers.length,111);
  assert.equal(compareSchemaContracts(baseline,clone(baseline)).matches,true);
  assert.equal(compareSchemaContracts(canonical,clone(baseline)).matches,true);
});

test('Phase A still fails when one accepted baseline trigger is missing',()=>{
  const baseline=loadSchemaContract(baselineDirectory,baselineTriggerFile);
  const observed=clone(baseline);
  const removed=observed.triggers.shift();
  const comparison=compareSchemaContracts(baseline,observed);
  assert.equal(comparison.matches,false);
  assert.deepEqual(comparison.triggers.missing,[`${removed.table}|${removed.name}`]);
});

test('post-install comparison still requires all 111 canonical triggers',()=>{
  const baseline=loadSchemaContract(baselineDirectory,baselineTriggerFile);
  const canonical=loadSchemaContract(canonicalDirectory,canonicalTriggerFile);
  const observed=clone(baseline);
  const removed=observed.triggers.shift();
  const incomplete=compareSchemaContracts(canonical,observed);
  assert.equal(incomplete.matches,false);
  assert.deepEqual(incomplete.triggers.missing,[`${removed.table}|${removed.name}`]);
  assert.equal(compareSchemaContracts(canonical,clone(canonical)).matches,true);
});

test('operator selects the baseline trigger copy only for baseline phases',()=>{
  const source=fs.readFileSync(path.join(root,'tools','crm-test-direct-node-release-operator.mjs'),'utf8');
  assert.match(source,/const triggerFile=kind==='baseline'\?path\.join\(contractDirectory,triggerName\):path\.join\(config\.candidate,'src',triggerName\)/);
  assert.match(source,/schema-contract trigger hash mismatch: expected/);
  assert.match(source,/schemaContractComparison\(pool,'baseline','stage'\)/);
  assert.match(source,/schemaContractComparison\(pool,'baseline','backup'\)/);
  assert.match(source,/schemaContractComparison\(pool,'baseline','pre-install'\)/);
  assert.match(source,/schemaContractComparison\(verificationPool,'canonical','post-deployment'\)/);
});
