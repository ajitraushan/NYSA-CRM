import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareSchemaContracts, loadSchemaContract } from '../tools/database-schema-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalDir = path.join(root, 'src', 'database-schema-contract');
const baselineDir = path.join(root, 'src', 'database-schema-baseline');
const triggerFile = path.join(root, 'src', 'database-trigger-contract.json');
const migration = path.join(root, 'src', 'migrations', '169_restore_full_schema_contract.sql');
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('DEV265 baseline is the exact Step 3 ACTUAL export contract', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(baselineDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.generatedFrom.sourcePrefix, 'ACTUAL');
  assert.deepEqual(Object.fromEntries(Object.entries(manifest.generatedFrom.sourceFiles).map(([key, value]) => [key, value.sha256])), {
    constraints: 'caafa66bc5eb558facaf02bcb4cebdf10cc2fa89261ba2c3fadc907dc0c34a52',
    indexes: '754e56f705db9271a504216ed41b9daaba9e58c12a9a5f857a553fff1c6c510d',
    columns: '150b934f2ae10d5919bf96015ad87e7f0bc8d931876a23754b2fea47660a043f',
    functions: 'b32e48a948acfc071e7f0298b07974440722c2f5f32077c38a94c58739d8cbf3',
    sequencesViews: '3584692018940889010888c5003784255d706f3ac7593edab52c7ba57b36dfad',
  });
  assert.deepEqual(Object.fromEntries(Object.entries(manifest.contracts).map(([key, value]) => [key, value.count])), {
    constraints: 1696,
    indexes: 552,
    columns: 4043,
    functions: 50,
    sequencesViews: 7,
  });
});
test('DEV265 migration generator proves the 33/371 index split', () => {
  const result = spawnSync(process.execPath, ['tools/generate-dev265-migration.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual({
    primaryKeys: summary.primaryKeys,
    uniqueConstraints: summary.uniqueConstraints,
    foreignKeys: summary.foreignKeys,
    missingIndexes: summary.missingIndexes,
    constraintOwnedIndexes: summary.constraintOwnedIndexes,
    standaloneIndexes: summary.standaloneIndexes,
  }, {
    primaryKeys: 18,
    uniqueConstraints: 15,
    foreignKeys: 975,
    missingIndexes: 404,
    constraintOwnedIndexes: 33,
    standaloneIndexes: 371,
  });
  assert.equal(summary.sha256, sha256File(migration));
});
test('DEV265 migration is fail-closed, narrow, audited and idempotent by construction', () => {
  const sql = fs.readFileSync(migration, 'utf8');
  assert.match(sql, /approved pre-migration baseline constraints contract mismatch/);
  assert.match(sql, /expected 12 messages\/5 notifications/);
  assert.match(sql, /actor guard expected one retained notification broker/);
  assert.match(sql, /COUNT\(DISTINCT n\.broker_id\)/);
  assert.match(sql, /performed_by,details/);
  assert.match(sql, /'WhatsAppConversation'.*'uat264_simulator_orphan_cleanup'/s);
  assert.match(sql, /33 backing indexes are created here/);
  assert.match(sql, /975 foreign keys, each preceded by an explicit orphan check/);
  assert.match(sql, /371 standalone indexes/);
  assert.match(sql, /idempotent canonical preflight/);
  assert.doesNotMatch(sql, /conname name|tgname name|sequencename name/,
    'catalog aliases must remain explicit and PostgreSQL 13 compatible');
  assert.match(sql, /conname::text AS object_name/);
  assert.match(sql, /tgname::text AS trigger_name/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP SCHEMA|TRUNCATE/i);
});

test('DEV265 full-schema verifier reports missing, extra and changed objects', () => {
  const canonical = loadSchemaContract(canonicalDir, triggerFile);
  const observed = structuredClone(canonical);
  observed.constraints.shift();
  observed.indexes.push({ table: 'synthetic', name: 'extra', definition: 'CREATE INDEX extra ON public.synthetic (id)' });
  observed.columns[0].nullable = observed.columns[0].nullable === 'YES' ? 'NO' : 'YES';
  const comparison = compareSchemaContracts(canonical, observed);
  assert.equal(comparison.matches, false);
  assert.equal(comparison.constraints.missing.length, 1);
  assert.equal(comparison.indexes.extra.length, 1);
  assert.equal(comparison.columns.changed.length, 1);
});
