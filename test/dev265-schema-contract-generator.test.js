import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'tools', 'generate-schema-contract.mjs');
const triggerContract = path.join(root, 'src', 'database-trigger-contract.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function writeFixture(input) {
  fs.mkdirSync(input, { recursive: true });
  fs.writeFileSync(path.join(input, 'EXPECTED_constraints.txt'), [
    'alpha|alpha_check|c|CHECK ((note <> E\'first',
    'second\'))',
    'alpha|alpha_pkey|p|PRIMARY KEY (id)',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(input, 'EXPECTED_indexes.txt'), 'alpha|alpha_pkey|CREATE UNIQUE INDEX alpha_pkey ON public.alpha USING btree (id)\n');
  fs.writeFileSync(path.join(input, 'EXPECTED_columns.txt'), 'alpha|id|uuid|NO|gen_random_uuid()\n');
  const definition = 'CREATE OR REPLACE FUNCTION public.alpha_guard()\r\n RETURNS trigger\r\n LANGUAGE plpgsql\r\nAS $function$\r\nBEGIN\r\n RETURN NEW;\r\nEND;\r\n$function$\r\n';
  fs.writeFileSync(path.join(input, 'EXPECTED_function_defs.hex.txt'), `alpha_guard||${Buffer.from(definition, 'utf8').toString('hex')}\n`);
  fs.writeFileSync(path.join(input, 'EXPECTED_sequences_views.txt'), 'sequence|alpha_number_seq\nview|alpha_summary\n');
  return definition.replaceAll('\r', '');
}

function runGenerator(input, output) {
  const result = spawnSync(process.execPath, [
    generator,
    '--input', input,
    '--output-dir', output,
    '--trigger-contract', triggerContract,
    '--source-commit', '8d9be904149bec1b9b6d56dd8a39f17c2789fd12',
    '--postgresql-version', '13.23',
    '--migration-count', '168',
    '--latest-migration', '168_restore_governed_trigger_contract.sql',
    '--write',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runActualGenerator(input, output) {
  for (const file of fs.readdirSync(input)) {
    if (file.startsWith('EXPECTED_')) fs.copyFileSync(path.join(input, file), path.join(input, file.replace('EXPECTED_', 'ACTUAL_')));
  }
  const result = spawnSync(process.execPath, [
    generator,
    '--input', input,
    '--source-prefix', 'ACTUAL',
    '--output-dir', output,
    '--trigger-contract', triggerContract,
    '--source-commit', '8d9be904149bec1b9b6d56dd8a39f17c2789fd12',
    '--postgresql-version', '13.23',
    '--migration-count', '168',
    '--latest-migration', '168_restore_governed_trigger_contract.sql',
    '--write',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('DEV265 schema-contract generator preserves logical records and is deterministic', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nysa-dev265-contract-'));
  try {
    const input = path.join(temporary, 'input');
    const outputOne = path.join(temporary, 'output-one');
    const outputTwo = path.join(temporary, 'output-two');
    const normalizedDefinition = writeFixture(input);
    const first = runGenerator(input, outputOne);
    const second = runGenerator(input, outputTwo);
    const actual = runActualGenerator(input, path.join(temporary, 'output-actual'));

    assert.deepEqual(first.contracts, second.contracts);
    assert.deepEqual(first.triggers, second.triggers);
    assert.deepEqual(first.contracts, actual.contracts);
    assert.equal(actual.generatedFrom.sourcePrefix, 'ACTUAL');

    const constraints = JSON.parse(fs.readFileSync(path.join(outputOne, 'constraints.json'), 'utf8'));
    assert.equal(constraints.count, 2);
    assert.equal(constraints.countsByType.c, 1);
    assert.equal(constraints.countsByType.p, 1);
    assert.match(constraints.entries[0].definition, /first\nsecond/);

    const functions = JSON.parse(fs.readFileSync(path.join(outputOne, 'functions.json'), 'utf8'));
    assert.equal(functions.count, 1);
    assert.equal(functions.entries[0].definitionSha256, sha256(normalizedDefinition));

    for (const file of ['constraints.json', 'indexes.json', 'columns.json', 'functions.json', 'sequences-views.json', 'manifest.json']) {
      assert.deepEqual(fs.readFileSync(path.join(outputOne, file)), fs.readFileSync(path.join(outputTwo, file)));
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('the committed cumulative schema contracts match their manifest', () => {
  const contractDir = path.join(root, 'src', 'database-schema-contract');
  const manifest = JSON.parse(fs.readFileSync(path.join(contractDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema, 'nysa.database-schema-contract.v1');
  assert.equal(manifest.generatedFrom.sourceCommit, 'a4df366912689306244436623fa2d11a6b5bff4e');
  assert.equal(manifest.generatedFrom.postgresqlVersion, '13.23');
  assert.equal(manifest.generatedFrom.migrationCount, 170);
  assert.equal(manifest.generatedFrom.sourcePrefix, undefined);

  const expectedCounts = {
    constraints: 2748,
    indexes: 966,
    columns: 4113,
    functions: 53,
    sequencesViews: 7,
  };
  for (const [name, expectedCount] of Object.entries(expectedCounts)) {
    const record = manifest.contracts[name];
    const file = path.join(contractDir, record.file);
    const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(contract.count, expectedCount, name);
    assert.equal(contract.entries.length, expectedCount, name);
    assert.equal(contract.canonicalSha256, sha256(`${JSON.stringify(contract.entries)}\n`), name);
    assert.equal(record.canonicalSha256, contract.canonicalSha256, name);
    assert.equal(record.fileSha256, sha256File(file), name);
  }

  const triggerFile = path.join(root, 'src', 'database-trigger-contract.json');
  const triggers = JSON.parse(fs.readFileSync(triggerFile, 'utf8'));
  assert.equal(triggers.triggerCount, 111);
  assert.equal(triggers.tableCount, 95);
  assert.equal(manifest.triggers.canonicalSha256, triggers.canonicalSha256);
  assert.equal(manifest.triggers.fileSha256, sha256File(triggerFile));
});
