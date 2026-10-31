// Disposable, synthetic PostgreSQL API verification. Never targets hosting.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
assert.equal(process.env.PGHOST,'localhost');
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');
const schema='ui001_release_'+crypto.randomBytes(6).toString('hex');
const pool=new pg.Pool({max:1});
let created=false;
try {
 const identity=(await pool.query('SELECT current_database() AS db,current_user AS usr,rolsuper,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.equal(identity.db,'nysa_test_fixture');assert.equal(identity.usr,'nysa_test_user');assert.equal(identity.rolsuper,false);assert.equal(identity.rolcreaterole,false);
 await pool.query(`CREATE SCHEMA "${schema}"`);created=true;
 await pool.query(`SET search_path TO "${schema}",public`);
 await pool.query('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const files=(await fs.readdir('src/migrations')).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,159);
 for(const file of files){
  const original=await fs.readFile('src/migrations/'+file,'utf8');
  const sql=original.replace(/\bnysareal_nysar2app\b|\bnysareal_nysacrmapp\b/g,'nysa_test_user').replace(/IN SCHEMA public/g,`IN SCHEMA "${schema}"`);
  await pool.query('BEGIN');
  try {await pool.query(sql);await pool.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',[file]);await pool.query('COMMIT');}
  catch(error){await pool.query('ROLLBACK');throw new Error(`Migration ${file}: ${error.message}`);}
 }
 const result=spawnSync(process.execPath,['--test','test/ui001-task-source-postgres.integration.test.js'],{stdio:'inherit',env:{...process.env,PGOPTIONS:`-c search_path=${schema},public`,NYSA_UI001_DB_TEST:'local-synthetic',NYSA_UI001_TEST_SCHEMA:schema}});
 assert.equal(result.status,0,'Synthetic task-source API verification failed');
 console.log(JSON.stringify({migrations:files.length,taskSourceApi:'passed',scopeAndPrivacy:'passed'}));
} finally {
 if(created){assert.match(schema,/^ui001_release_[a-f0-9]{12}$/);await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}
 await pool.end();
}
