import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex = process.argv.indexOf('--output');
const outputFile = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (outputIndex >= 0 && (!outputFile || outputFile.startsWith('--'))) {
  throw new Error('--output requires a file path');
}
if (process.env.PGDATABASE !== 'nysa_test_fixture' || process.env.PGUSER !== 'nysa_test_user') {
  throw new Error('Refusing to rehearse outside nysa_test_fixture/nysa_test_user');
}
const pool = new pg.Pool({ max: 3 });
const migrationClient = await pool.connect();
const monitorClient = await pool.connect();
const migrationFile = '169_restore_full_schema_contract.sql';
const sql = await fs.readFile(path.join(root, 'src', 'migrations', migrationFile), 'utf8');
const samples = [];
const relationLocks = new Map();
let complete = false;
let failure;
const startedAt = new Date();
const started = process.hrtime.bigint();

const migrationRun = (async () => {
  try {
    await migrationClient.query('BEGIN');
    await migrationClient.query(sql);
    await migrationClient.query('INSERT INTO schema_migrations(version) VALUES($1)', [migrationFile]);
    await migrationClient.query('COMMIT');
  } catch (error) {
    failure = error;
    await migrationClient.query('ROLLBACK').catch(() => {});
  } finally {
    complete = true;
  }
})();

while (!complete) {
  const rows = (await monitorClient.query(`
    SELECT l.locktype,l.mode,l.granted,COALESCE(c.relname,'') relation
      FROM pg_locks l LEFT JOIN pg_class c ON c.oid=l.relation
     WHERE l.pid=$1 ORDER BY l.locktype,l.mode,relation`, [migrationClient.processID])).rows;
  samples.push({ atMs: Number((process.hrtime.bigint() - started) / 1000000n), lockCount: rows.length });
  for (const row of rows) {
    if (!row.relation) continue;
    const key = `${row.relation}|${row.mode}|${row.granted}`;
    relationLocks.set(key, { relation: row.relation, mode: row.mode, granted: row.granted });
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
}
await migrationRun;
const durationMs = Number((process.hrtime.bigint() - started) / 1000000n);
if (failure) throw failure;
const final = (await monitorClient.query(`SELECT COUNT(*)::int migration_count,MAX(version) latest FROM schema_migrations`)).rows[0];
const sortedLocks = [...relationLocks.values()].sort((a, b) => `${a.relation}|${a.mode}`.localeCompare(`${b.relation}|${b.mode}`));
const lockModes = Object.fromEntries([...new Set(sortedLocks.map((lock) => lock.mode))].sort().map((mode) => [
  mode,
  sortedLocks.filter((lock) => lock.mode === mode).length,
]));
const receipt = {
  schema: 'nysa.dev265.phase-c-rehearsal.v1',
  database: process.env.PGDATABASE,
  postgresqlVersion: (await monitorClient.query(`SHOW server_version`)).rows[0].server_version,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs,
  sampleIntervalMs: 20,
  samples: samples.length,
  maximumObservedLocks: Math.max(...samples.map((sample) => sample.lockCount), 0),
  affectedRelationCount: new Set(sortedLocks.map((lock) => lock.relation)).size,
  affectedRelations: [...new Set(sortedLocks.map((lock) => lock.relation))].sort(),
  lockModes,
  relationLocks: sortedLocks,
  final,
};
const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
if (outputFile) {
  const resolved = path.resolve(outputFile);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, serialized, { flag: 'wx' });
}
process.stdout.write(`${JSON.stringify({
  ...receipt,
  affectedRelations: `[${receipt.affectedRelationCount} relations; full list retained in receipt]`,
  relationLocks: `[${receipt.relationLocks.length} relation/mode observations; full list retained in receipt]`,
  outputFile: outputFile ? path.resolve(outputFile) : null,
}, null, 2)}\n`);
migrationClient.release();
monitorClient.release();
await pool.end();
