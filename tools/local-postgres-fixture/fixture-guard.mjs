import pg from 'pg';

const { Pool } = pg;

export const FIXTURE_DATABASE = 'nysa_test_fixture';
export const FIXTURE_ROLE = 'nysa_test_user';
export const FIXTURE_SCHEMA = 'nysa_test_user';

export function createFixturePool() {
  return new Pool();
}

export async function assertDedicatedFixture(pool) {
  if (process.env.PGDATABASE !== FIXTURE_DATABASE || process.env.PGUSER !== FIXTURE_ROLE) {
    throw new Error(`Refusing to operate: PGDATABASE and PGUSER must be ${FIXTURE_DATABASE}/${FIXTURE_ROLE}`);
  }

  const identity = (await pool.query(`
    SELECT current_database() AS database,
           current_user AS username,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
           (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS create_database,
           (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS create_role
  `)).rows[0];

  if (identity.database !== FIXTURE_DATABASE || identity.username !== FIXTURE_ROLE) {
    throw new Error(`Refusing to operate on ${identity.database} as ${identity.username}`);
  }
  if (identity.superuser || identity.create_database || identity.create_role) {
    throw new Error('Fixture tooling requires the restricted, non-administrative fixture role');
  }

  return identity;
}

export function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
