import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const {Client}=pg;
const safeHosts=new Set(['127.0.0.1','localhost','::1']);
assert.ok(safeHosts.has(process.env.PGHOST),'DEV267 fixture must use loopback PostgreSQL');
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');
const client=new Client();
await client.connect();
try{
  const identity=(await client.query("SELECT current_setting('server_version') AS version,current_database() AS database,current_user AS username,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser")).rows[0];
  assert.match(identity.version,/^13\.23(?:\b|$)/);
  assert.deepEqual({database:identity.database,username:identity.username,superuser:identity.superuser},{database:'nysa_test_fixture',username:'nysa_test_user',superuser:false});
  process.stdout.write(`PostgreSQL ${identity.version}\n`);
  await client.query('DROP SCHEMA IF EXISTS nysa_test_user CASCADE');
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public AUTHORIZATION nysa_test_user');
  await client.query('CREATE TABLE public.schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const directory=path.resolve('src/migrations');
  const files=(await fs.readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
  for(const file of files){
    const original=await fs.readFile(path.join(directory,file),'utf8');
    const sql=original.replaceAll('nysareal_nysar2app','nysa_test_user');
    try{
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path TO public');
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[file]);
      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${error.message}`,{cause:error});
    }
  }
  const migration170=await fs.readFile(path.join(directory,'170_prospect_diary.sql'),'utf8');
  await client.query('BEGIN');
  try{
    await client.query('SET LOCAL search_path TO public');
    await client.query(migration170);
    await client.query('ROLLBACK');
  }catch(error){
    await client.query('ROLLBACK');
    throw new Error(`Migration 170 idempotency check failed: ${error.message}`,{cause:error});
  }
  const state=(await client.query("SELECT COUNT(*)::int AS migrations,MAX(version) AS latest,(SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,(SELECT COUNT(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace) AS triggers FROM public.schema_migrations")).rows[0];
  assert.equal(state.latest,'170_prospect_diary.sql');
  process.stdout.write(`${JSON.stringify({...state,migration170Idempotent:true})}\n`);
}finally{
  await client.end();
}

const integrationRuns=[
  {file:'test/dev267-prospect-diary.integration.test.js',flag:'NYSA_PROSPECT_DIARY_TEST'},
  {file:'test/dev267-shared-suppression.integration.test.js',flag:'NYSA_DEV267_SHARED_SUPPRESSION_TEST'},
  {file:'test/dev267-whatsapp-da-regression.integration.test.js',flag:'NYSA_DEV267_DA_TEST'},
  {file:'test/whatsapp-workspace.integration.test.js',flag:'NYSA_WA_STAGE_B_DB_TEST'},
  {file:'test/whatsapp-simulated-provider.integration.test.js',flag:'NYSA_WA_SIM_DB_TEST'}
];
for(const item of integrationRuns){
  process.stdout.write(`DEV267 PostgreSQL 13.23 integration: ${item.file}\n`);
  const run=spawnSync(process.execPath,['--test','--test-force-exit','--test-isolation=none',item.file],{
    cwd:process.cwd(),env:{...process.env,[item.flag]:'local-synthetic'},encoding:'utf8'
  });
  process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
  if(run.status!==0)process.exit(run.status??1);
}
