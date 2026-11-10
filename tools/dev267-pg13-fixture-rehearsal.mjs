import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {compareSchemaContracts,loadSchemaContract,readDatabaseSchemaContract} from './database-schema-contract.mjs';

const {Pool}=pg;
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,values)=>{
  if(index%2===0){
    if(!value.startsWith('--')||values[index+1]===undefined)throw new Error('Named arguments are required');
    pairs.push([value.slice(2),values[index+1]]);
  }
  return pairs;
},[]));
const mode=args.mode;
const sourceRoot=path.resolve(args['source-root']||'');
const output=path.resolve(args.output||'');
if(!['prepare','verify-postinstall'].includes(mode)||!args['source-root']||!args.output)throw new Error('Mode, source-root and output are required');
if(process.env.PGDATABASE!=='nysa_test_fixture'||process.env.PGUSER!=='nysa_test_user')throw new Error('Refusing to operate outside nysa_test_fixture/nysa_test_user');

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pool=new Pool({max:1});
const client=await pool.connect();
try{
  const identity=(await client.query(`SELECT current_database() AS database,current_user AS username,
    current_setting('server_version') AS version,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
    (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS create_database,
    (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS create_role`)).rows[0];
  if(identity.database!=='nysa_test_fixture'||identity.username!=='nysa_test_user'||identity.superuser||identity.create_database||identity.create_role)throw new Error(`Unsafe fixture identity: ${JSON.stringify(identity)}`);
  if(!identity.version.startsWith('13.23'))throw new Error(`PostgreSQL 13.23 required, observed ${identity.version}`);

  if(mode==='prepare'){
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public AUTHORIZATION nysa_test_user');
    await client.query('CREATE TABLE public.schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const migrationDirectory=path.join(sourceRoot,'src','migrations');
    const files=(await fs.readdir(migrationDirectory)).filter(name=>name.endsWith('.sql')).sort();
    const final='169_restore_full_schema_contract.sql',end=files.indexOf(final);
    if(end<0)throw new Error(`Exact package is missing ${final}`);
    for(const file of files.slice(0,end+1)){
      const sql=(await fs.readFile(path.join(migrationDirectory,file),'utf8')).replaceAll('nysareal_nysar2app','nysa_test_user');
      await client.query('BEGIN');
      try{
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations(version) VALUES($1)',[file]);
        await client.query('COMMIT');
      }catch(error){
        await client.query('ROLLBACK');
        error.message=`Migration ${file} failed: ${error.message}`;
        throw error;
      }
    }
  }

  const canonical=mode==='prepare'?false:true;
  const contractDirectory=path.join(sourceRoot,'src',canonical?'database-schema-contract':'database-schema-baseline');
  const triggerFile=canonical?path.join(sourceRoot,'src','database-trigger-contract.json'):path.join(contractDirectory,'database-trigger-contract.json');
  const expected=loadSchemaContract(contractDirectory,triggerFile);
  const observed=await readDatabaseSchemaContract(client);
  const comparison=compareSchemaContracts(expected,observed);
  const ledger=(await client.query(`SELECT COUNT(*)::int AS count,MAX(version) AS latest FROM schema_migrations`)).rows[0];
  const tableCount=(await client.query("SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count;
  const triggerCount=(await client.query("SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace")).rows[0].count;
  const expectedState=canonical?{migrations:170,tables:306,triggers:111}:{migrations:169,tables:303,triggers:108};
  const receipt={
    schema:'nysa.dev267.pg13-operator-rehearsal.v1',mode,sourceRoot,
    sourceProvenance:JSON.parse(await fs.readFile(path.join(sourceRoot,'RELEASE_PROVENANCE.json'),'utf8')),
    postgresqlVersion:identity.version,database:identity.database,role:identity.username,
    ledger,tableCount,triggerCount,expectedState,
    schemaContract:{manifestSha256:sha256(await fs.readFile(path.join(contractDirectory,'manifest.json'))),triggerContractSha256:sha256(await fs.readFile(triggerFile)),matches:comparison.matches,objects:Object.fromEntries(['constraints','indexes','columns','functions','sequencesViews','triggers'].map(name=>[name,{expected:comparison[name].expected,observed:comparison[name].observed,missing:comparison[name].missing,extra:comparison[name].extra,changed:comparison[name].changed,matches:comparison[name].matches}]))},
    passed:comparison.matches&&ledger.count===expectedState.migrations&&tableCount===expectedState.tables&&triggerCount===expectedState.triggers,
    completedAt:new Date().toISOString(),
  };
  if(!receipt.passed)throw Object.assign(new Error(`${mode} fixture verification failed`),{receipt});
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,`${JSON.stringify(receipt,null,2)}\n`,{flag:'wx'});
  process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`);
}finally{
  client.release();
  await pool.end();
}
