import { migrateFixture } from './migrate.mjs';
import {
  assertDedicatedFixture,
  createFixturePool,
  FIXTURE_SCHEMA,
  quoteIdentifier
} from './fixture-guard.mjs';

const pool = createFixturePool();
try {
  const identity = await assertDedicatedFixture(pool);
  const schema = quoteIdentifier(FIXTURE_SCHEMA);
  const role = quoteIdentifier(identity.username);

  // The exact database, role and privilege guard above must succeed before this
  // deliberately destructive operation can touch the dedicated fixture schema.
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.query(`CREATE SCHEMA ${schema} AUTHORIZATION ${role}`);
} finally {
  await pool.end();
}

console.log(JSON.stringify({ rebuilt: true, ...(await migrateFixture()) }));
