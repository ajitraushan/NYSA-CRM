import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareSchemaContracts, loadSchemaContract } from '../tools/database-schema-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalDir = path.join(root, 'src', 'database-schema-contract');
const triggerFile = path.join(root, 'src', 'database-trigger-contract.json');
const migration = path.join(root, 'src', 'migrations', '169_restore_full_schema_contract.sql');
test('migration 169 preserves every accepted recovery byte outside its Production gate', () => {
  const sql = fs.readFileSync(migration,'utf8').replaceAll('\r','');
  const gate = /  -- Production must match the canonical contract above\.[\s\S]*?  END IF;\n\n/;
  assert.match(sql,gate);
  assert.match(sql,/current_database\(\) = 'nysareal_nysacrm'/);
  assert.match(sql,/current_user = 'nysareal_nysacrmapp'/);
  assert.ok(sql.indexOf('requires the canonical pre-170 schema') < sql.indexOf('DELETE FROM wa_inbox_notifications'));
  assert.equal(crypto.createHash('sha256').update(sql.replace(gate,'')).digest('hex'),
    'ca0ab210ba6d65875e3494a81d93bc138fc1e89a3a36ac2cccf6a25eb3ec2e97');
});
test('DEV265 migration generator proves the 33/371 index split', () => {
  const sql = fs.readFileSync(migration, 'utf8');
  const count = (pattern) => (sql.match(pattern) || []).length;
  assert.deepEqual({
    primaryKeys: count(/ADD CONSTRAINT [^\n]+ PRIMARY KEY/gi),
    uniqueConstraints: count(/ADD CONSTRAINT [^\n]+ UNIQUE/gi),
    foreignKeys: count(/ADD CONSTRAINT [^\n]+ FOREIGN KEY/gi),
    missingIndexes: 33 + count(/EXECUTE 'CREATE (?:UNIQUE )?INDEX /g),
    constraintOwnedIndexes: 18 + 15,
    standaloneIndexes: count(/EXECUTE 'CREATE (?:UNIQUE )?INDEX /g),
  }, {
    primaryKeys: 18,
    uniqueConstraints: 15,
    foreignKeys: 975,
    missingIndexes: 404,
    constraintOwnedIndexes: 33,
    standaloneIndexes: 371,
  });
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
