import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const {Pool}=pg;
const fixtureDatabase='nysa_test_fixture';
const fixtureRole='nysa_test_user';
const finalPreDev265Migration='168_restore_governed_trigger_contract.sql';
const productionRuntimeRole='nysareal_nysar2app';

if(!process.argv.includes('--apply'))throw new Error('Explicit --apply required for the disposable DEV266 fixture');
if(process.env.PGDATABASE!==fixtureDatabase||process.env.PGUSER!==fixtureRole){
  throw new Error(`Refusing to operate outside ${fixtureDatabase}/${fixtureRole}`);
}

const pool=new Pool({max:1});
const client=await pool.connect();
try{
  const identity=(await client.query(`SELECT current_database() AS database,current_user AS username,
    current_setting('server_version') AS version,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
    (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS create_database,
    (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS create_role`)).rows[0];
  if(identity.database!==fixtureDatabase||identity.username!==fixtureRole||identity.superuser||identity.create_database||identity.create_role){
    throw new Error(`Unsafe fixture identity: ${JSON.stringify(identity)}`);
  }
  if(!identity.version.startsWith('13.23'))throw new Error(`PostgreSQL 13.23 required, observed ${identity.version}`);

  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query(`CREATE SCHEMA public AUTHORIZATION ${fixtureRole}`);
  await client.query(`CREATE TABLE public.schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

  const directory=path.resolve('src/migrations');
  const files=(await fs.readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
  const end=files.indexOf(finalPreDev265Migration);
  if(end<0)throw new Error(`Missing ${finalPreDev265Migration}`);
  for(const file of files.slice(0,end+1)){
    const original=await fs.readFile(path.join(directory,file),'utf8');
    const sql=original.replaceAll(productionRuntimeRole,fixtureRole);
    await client.query('BEGIN');
    try{
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(version) VALUES($1) ON CONFLICT(version) DO NOTHING',[file]);
      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK');
      error.message=`Migration ${file} failed: ${error.message}`;
      throw error;
    }
  }
  const result=(await client.query(`SELECT COUNT(*)::int AS migration_count,MAX(version) AS latest,
    (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS table_count
    FROM public.schema_migrations`)).rows[0];
  process.stdout.write(`${JSON.stringify({schema:'nysa.dev266.pg13-fixture.v1',...identity,...result},null,2)}\n`);
}finally{
  client.release();
  await pool.end();
}
