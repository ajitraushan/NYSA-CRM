import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertDedicatedFixture,
  createFixturePool,
  FIXTURE_SCHEMA,
  quoteIdentifier
} from './fixture-guard.mjs';

const PRODUCTION_RUNTIME_ROLE = 'nysareal_nysar2app';

export async function migrateFixture() {
  const pool = createFixturePool();
  try {
    const identity = await assertDedicatedFixture(pool);
    const schema = quoteIdentifier(FIXTURE_SCHEMA);
    const localRole = quoteIdentifier(identity.username);

    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${localRole}`);
    await pool.query(`SET search_path TO ${schema}, public`);
    await pool.query(`CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    const directory = path.resolve('src/migrations');
    const files = (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    let appliedNow = 0;

    for (const file of files) {
      const applied = await pool.query(
        `SELECT 1 FROM ${schema}.schema_migrations WHERE version = $1`,
        [file]
      );
      if (applied.rowCount) continue;

      const original = await fs.readFile(path.join(directory, file), 'utf8');
      // Local execution only: retain the production GRANT in the migration source,
      // but grant the same privileges to the restricted fixture role locally.
      const sql = original.replaceAll(PRODUCTION_RUNTIME_ROLE, identity.username);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${schema}, public`);
        await client.query(sql);
        // Legacy migrations 057-059 self-register. The runner also registers every
        // migration, so idempotent insertion is required for fresh rebuilds.
        await client.query(
          `INSERT INTO ${schema}.schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING`,
          [file]
        );
        await client.query('COMMIT');
        appliedNow += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        error.message = `Migration ${file} failed: ${error.message}`;
        throw error;
      } finally {
        client.release();
      }
    }

    const result = (await pool.query(
      `SELECT COUNT(*)::int AS count, MAX(version) AS latest FROM ${schema}.schema_migrations`
    )).rows[0];
    return { ...identity, ...result, appliedNow, productionGrantMappedLocally: true };
  } finally {
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  console.log(JSON.stringify(await migrateFixture()));
}
