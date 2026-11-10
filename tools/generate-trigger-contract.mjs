import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const {Pool}=pg;
const FIXTURE_DATABASE='nysa_test_fixture';
const FIXTURE_ROLE='nysa_test_user';
const FIXTURE_SCHEMA=process.env.NYSA_FIXTURE_SCHEMA_NAME||'nysa_test_user';
const TRIGGER_REPAIR_MIGRATIONS=new Set(['168_restore_governed_trigger_contract.sql']);

const quoteIdentifier=value=>`"${String(value).replaceAll('"','""')}"`;
const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function normalizeDefinition(definition){
  return String(definition)
    .replaceAll(`${quoteIdentifier(FIXTURE_SCHEMA)}.`, 'public.')
    .replaceAll(`${FIXTURE_SCHEMA}.`, 'public.')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/;?$/,';');
}

function sourceForTrigger(name,migrations){
  const pattern=new RegExp(`\\bCREATE\\s+(?:CONSTRAINT\\s+)?TRIGGER\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:"${escapeRegExp(name)}"|${escapeRegExp(name)})\\b`,'i');
  const matches=migrations.filter(item=>!TRIGGER_REPAIR_MIGRATIONS.has(item.name)&&pattern.test(item.sql));
  if(!matches.length)throw new Error(`No source migration found for trigger ${name}`);
  return matches.at(-1).name;
}

function parseDefinition(row){
  const definition=normalizeDefinition(row.definition);
  const timing=definition.match(/\s(BEFORE|AFTER|INSTEAD OF)\s/i)?.[1]?.toUpperCase();
  const events=definition.match(/\s(?:BEFORE|AFTER|INSTEAD OF)\s(.+?)\sON\s/i)?.[1]
    ?.split(/\s+OR\s+/i).map(value=>value.replace(/\s+OF\s+.+$/i,'').trim().toUpperCase());
  if(!timing||!events?.length)throw new Error(`Cannot parse trigger definition for ${row.trigger_name}`);
  return {definition,timing,events};
}

async function main(){
  if(process.env.PGDATABASE!==FIXTURE_DATABASE||process.env.PGUSER!==FIXTURE_ROLE){
    throw new Error(`Refusing to read trigger contract outside ${FIXTURE_DATABASE}/${FIXTURE_ROLE}`);
  }
  const migrationDirectory=path.resolve('src/migrations');
  const allMigrationNames=(await fs.readdir(migrationDirectory)).filter(name=>name.endsWith('.sql')).sort();
  const migrationNames=allMigrationNames;
  const migrations=[];
  for(const name of migrationNames)migrations.push({name,sql:await fs.readFile(path.join(migrationDirectory,name),'utf8')});

  const pool=new Pool();
  try{
    const identity=(await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    if(identity.database!==FIXTURE_DATABASE||identity.role!==FIXTURE_ROLE)throw new Error('Fixture identity mismatch');
    const rows=(await pool.query(`
      SELECT c.relname AS table_name,t.tgname AS trigger_name,t.tgenabled AS enabled,
             pn.nspname AS function_schema,p.proname AS function_name,
             pg_get_triggerdef(t.oid,true) AS definition
        FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_proc p ON p.oid=t.tgfoid
        JOIN pg_namespace pn ON pn.oid=p.pronamespace
       WHERE NOT t.tgisinternal AND n.nspname=$1
       ORDER BY c.relname,t.tgname
    `,[FIXTURE_SCHEMA])).rows;

    const triggers=rows.map(row=>{
      const parsed=parseDefinition(row);
      return{
        table:row.table_name,
        name:row.trigger_name,
        function:`public.${row.function_name}`,
        timing:parsed.timing,
        events:parsed.events,
        enabled:row.enabled,
        sourceMigration:sourceForTrigger(row.trigger_name,migrations),
        definition:parsed.definition
      };
    });
    const canonical=JSON.stringify(triggers);
    const contract={
      schema:'nysa.database-trigger-contract.v1',
      generatedFrom:{database:FIXTURE_DATABASE,migrationCount:migrationNames.length,latestMigration:migrationNames.at(-1)},
      triggerCount:triggers.length,
      tableCount:new Set(triggers.map(item=>item.table)).size,
      canonicalSha256:sha256(canonical),
      triggers
    };
    const output=path.resolve('src/database-trigger-contract.json');
    await fs.writeFile(output,`${JSON.stringify(contract,null,2)}\n`);
    console.log(JSON.stringify({output,triggerCount:contract.triggerCount,tableCount:contract.tableCount,canonicalSha256:contract.canonicalSha256}));
  }finally{await pool.end();}
}

await main();
