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

test('DEV267 baseline contract is the accepted DEV266 108-trigger contract',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(baselineDirectory,'manifest.json'),'utf8'));
  const contract=JSON.parse(fs.readFileSync(baselineTriggerFile,'utf8'));
  assert.equal(contract.triggerCount,108);
  assert.equal(contract.tableCount,93);
  assert.equal(contract.canonicalSha256,'a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073');
  assert.equal(sha256(baselineTriggerFile),manifest.triggers.fileSha256);
  assert.equal(manifest.triggers.fileSha256,'2c5ccb6df5a24e6b3040e56b02965de0c06874451b988cf7a014daf17aef38f4');
});

test('release adding triggers passes the Phase A baseline comparison at migration 169',()=>{
  const baseline=loadSchemaContract(baselineDirectory,baselineTriggerFile);
  const canonical=loadSchemaContract(canonicalDirectory,canonicalTriggerFile);
  assert.equal(baseline.triggers.length,108);
  assert.equal(canonical.triggers.length,111);
  assert.equal(compareSchemaContracts(baseline,clone(baseline)).matches,true);
  const added=canonical.triggers.filter(item=>!baseline.triggers.some(existing=>existing.table===item.table&&existing.name===item.name));
  assert.deepEqual(added.map(item=>`${item.table}|${item.name}`),[
    'prospect_activities|prospect_activities_append_only',
    'prospect_activities|prospect_activities_outreach_guard',
    'prospects|prospects_status_effects',
  ]);
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
  const incomplete=compareSchemaContracts(canonical,baseline);
  assert.equal(incomplete.matches,false);
  assert.deepEqual(incomplete.triggers.missing,[
    'prospect_activities|prospect_activities_append_only',
    'prospect_activities|prospect_activities_outreach_guard',
    'prospects|prospects_status_effects',
  ]);
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
