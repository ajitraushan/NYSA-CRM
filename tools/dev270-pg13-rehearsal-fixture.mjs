import pg from 'pg';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export const migrationFiles=(await fs.readdir('src/migrations')).filter(file=>file.endsWith('.sql')).sort();
export async function createFixture(database,user){
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.ok(process.env.NYSA_PG13_FIXTURE_DATA,'Pass the disposable cluster data directory');
  assert.match(process.env.PGPASSWORD,/^[a-f0-9]{32}$/,'Use a disposable fixture password');
  const admin=new pg.Client({database:'postgres',user:'postgres'});
  await admin.connect();
  try{
    const {version,directory}= (await admin.query(`SELECT current_setting('server_version') AS version,
      current_setting('data_directory') AS directory`)).rows[0];
    assert.match(version,/^13\.23\b/);
    assert.equal(path.resolve(directory),path.resolve(process.env.NYSA_PG13_FIXTURE_DATA));
    assert.match(path.basename(path.dirname(directory)),/^nysa-dev270-rehearsal-/);
    assert.match(database,/^(nysareal_nysacrm|nysa_test_fixture)$/);
    assert.match(user,/^(nysareal_nysacrmapp|nysa_test_user)$/);
    await admin.query(`CREATE ROLE ${user} LOGIN PASSWORD '${process.env.PGPASSWORD}'`);
    await admin.query(`CREATE DATABASE ${database} OWNER ${user}`);
  }finally{await admin.end();}
  const client=new pg.Client({database,user});
  await client.connect();
  await client.query('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  return client;
}

export async function applyFixtureMigration(client,file,role){
  const source=await fs.readFile('src/migrations/'+file,'utf8');
  await client.query('BEGIN');
  try{
    await client.query(source.replace(/\bnysareal_nysar2app\b/g,role));
    await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[file]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
}

export async function fixtureIdentity(client){
  return (await client.query(`SELECT current_database() AS database,current_user AS role,
    current_setting('server_version') AS postgres,
    (SELECT COUNT(*)::int FROM schema_migrations) AS migrations`)).rows[0];
}
