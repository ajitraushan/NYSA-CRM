import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const guard = fs.readFileSync('tools/local-postgres-fixture/fixture-guard.mjs', 'utf8');
const migrate = fs.readFileSync('tools/local-postgres-fixture/migrate.mjs', 'utf8');
const rebuild = fs.readFileSync('tools/local-postgres-fixture/rebuild.mjs', 'utf8');

test('fixture rebuild is pinned to a restricted dedicated database, role and schema', () => {
  assert.match(guard, /nysa_test_fixture/);
  assert.match(guard, /nysa_test_user/);
  assert.match(guard, /identity\.superuser \|\| identity\.create_database \|\| identity\.create_role/);
  assert.match(rebuild, /assertDedicatedFixture\(pool\)/);
  assert.match(rebuild, /DROP SCHEMA/);
  assert.doesNotMatch(rebuild, /DROP DATABASE/);
});

test('fixture migration maps only the production grant recipient at execution time', () => {
  assert.match(migrate, /PRODUCTION_RUNTIME_ROLE = 'nysareal_nysar2app'/);
  assert.match(migrate, /original\.replaceAll\(PRODUCTION_RUNTIME_ROLE, identity\.username\)/);
  assert.match(migrate, /ON CONFLICT\(version\) DO NOTHING/);
  assert.doesNotMatch(migrate, /writeFile|appendFile/);
});
