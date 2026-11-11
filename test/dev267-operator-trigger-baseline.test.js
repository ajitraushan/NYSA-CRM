import {execFileSync} from 'node:child_process';
const accepted = 'e5db302e12a21d2597ecab0dc340fa2eae534381';
const acceptedFile = file => execFileSync('git',['show',`${accepted}:${file}`],{encoding:'utf8'});
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
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r','')).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));

test('DEV271 baseline trigger contract matches the accepted DEV270 contract',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(baselineDirectory,'manifest.json'),'utf8'));
  const contract=JSON.parse(fs.readFileSync(baselineTriggerFile,'utf8'));
  assert.equal(contract.triggerCount,111);
  assert.equal(contract.tableCount,95);
  assert.equal(manifest.generatedFrom.migrationCount,171);
  assert.equal(sha256(baselineTriggerFile),manifest.triggers.fileSha256);
});

test('migration 171 uses the same 111-trigger contract before and after install',()=>{
  const dev270='5c1c350151d6ace33377b33526e2bfedf4ae8f6b';
  const installed=file=>JSON.parse(execFileSync('git',['show',dev270+':'+file],{encoding:'utf8'}));
  const manifest=installed('src/database-schema-contract/manifest.json');
  const canonical={...Object.fromEntries(Object.entries(manifest.contracts).map(([name,{file}])=>
    [name,installed('src/database-schema-contract/'+file).entries])),
    triggers:installed('src/database-trigger-contract.json').triggers.map(({table,name,function:fn,enabled})=>({table,name,function:fn,enabled}))};
  assert.equal(canonical.triggers.length,111);
  const historicalManifest=JSON.parse(acceptedFile('src/database-schema-contract/manifest.json'));
  const expected={...Object.fromEntries(Object.entries(historicalManifest.contracts).map(([name,{file}])=>
    [name,JSON.parse(acceptedFile('src/database-schema-contract/'+file)).entries])),
    triggers:JSON.parse(acceptedFile('src/database-trigger-contract.json')).triggers.map(({table,name,function:fn,enabled})=>({table,name,function:fn,enabled}))};
  assert.equal(expected.triggers.length,111);
  assert.equal(compareSchemaContracts(canonical,loadSchemaContract(baselineDirectory,baselineTriggerFile)).matches,true);
  const delta=compareSchemaContracts(expected,canonical);
  assert.deepEqual(delta.constraints.extra,[
    'prospect_upload_batches|prospect_upload_batches_created_by_fkey|f',
    'prospect_upload_batches|prospect_upload_batches_file_sha256_check|c',
    'prospect_upload_batches|prospect_upload_batches_owner_id_fkey|f',
    'prospect_upload_batches|prospect_upload_batches_pkey|p',
    'prospects|prospects_contact_identity_check|c',
    'prospects|prospects_upload_batch_id_fkey|f']);
  assert.deepEqual(delta.constraints.changed,['prospect_activities|prospect_activities_notes_check|c','prospects|prospects_source_check|c']);
  assert.deepEqual(delta.indexes.extra,['prospect_upload_batches|prospect_upload_batches_pkey','prospects|prospects_upload_batch_idx']);
  assert.deepEqual(delta.columns.extra,['prospect_upload_batches|created_at','prospect_upload_batches|created_by',
    'prospect_upload_batches|file_name','prospect_upload_batches|file_sha256','prospect_upload_batches|id',
    'prospect_upload_batches|owner_id','prospect_upload_batches|skipped_rows','prospect_upload_batches|status_counts','prospects|upload_batch_id']);
  assert.deepEqual(delta.columns.changed,['prospects|normalized_phone','prospects|phone']);
  for(const name of ['constraints','indexes','columns']) assert.deepEqual(delta[name].missing,[]);
  assert.deepEqual(delta.indexes.changed,[]);
  for(const name of ['functions','sequencesViews','triggers']) assert.equal(delta[name].matches,true);

});

test('Phase A still fails when one accepted baseline trigger is missing',()=>{
  const baseline=loadSchemaContract(baselineDirectory,baselineTriggerFile);
  const observed=clone(baseline);
  const removed=observed.triggers.shift();
  const comparison=compareSchemaContracts(baseline,observed);
  assert.equal(comparison.matches,false);
  assert.deepEqual(comparison.triggers.missing,[`${removed.table}|${removed.name}`]);
});

test('post-install comparison still requires all 113 canonical triggers',()=>{
  const canonical=loadSchemaContract(canonicalDirectory,canonicalTriggerFile);
  assert.equal(canonical.triggers.length,113);
  const observed=clone(canonical);
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
