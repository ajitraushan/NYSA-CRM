import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readDatabaseSchemaContract,compareSchemaContracts,loadSchemaContract} from './database-schema-contract.mjs';
import {applyFixtureMigration,createFixture,fixtureIdentity,migrationFiles} from './dev270-pg13-rehearsal-fixture.mjs';

const database='nysareal_nysacrm',role='nysareal_nysacrmapp';
const client=await createFixture(database,role);
try{
  for(const file of migrationFiles.slice(0,140)) await applyFixtureMigration(client,file,role);
  const before=await fixtureIdentity(client);
  const oldRole=(await client.query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='nysareal_nysar2app') AS present")).rows[0].present;
  assert.equal(oldRole,false);
  console.log(JSON.stringify({phase:'baseline',...before,legacyRoleExists:oldRole}));
  Object.assign(process.env,{PGDATABASE:database,PGUSER:role});
  const {db,migrate,closeDatabase}=await import('../src/db.js');
  const expected=new Map();
  for(const file of migrationFiles.slice(140,165)){
    const source=await fs.readFile('src/migrations/'+file,'utf8');
    const rendered=source.replace(/(\bTO\s+)nysareal_nysar2app(?=\s*;)/gi,'$1CURRENT_USER');
    if(rendered!==source)expected.set(rendered,file);
  }
  const observed=[];
  const connect=db.connect.bind(db);
  db.connect=async function(...args){
    if(args.length) return connect(...args);
    const connection=await connect();
    const query=connection.query.bind(connection);
    const release=connection.release.bind(connection);
    connection.query=(sql,...params)=>{
      if(expected.has(sql))observed.push(expected.get(sql));
      return query(sql,...params);
    };
    connection.release=(...params)=>{
      connection.query=query;
      return release(...params);
    };
    return connection;
  };
  try{await migrate();}finally{await closeDatabase();}
  assert.deepEqual(observed,[...expected.values()]);
  assert.equal(observed.length,17);
  const after=await fixtureIdentity(client);
  assert.equal(after.migrations,171);
  const contract=compareSchemaContracts(loadSchemaContract('src/database-schema-contract','src/database-trigger-contract.json'),await readDatabaseSchemaContract(client));
  assert.ok(contract.matches);
  const cleanup=(await client.query("SELECT count(*)::int AS count FROM audit_log WHERE action='uat264_simulator_orphan_cleanup'")).rows[0].count;
  assert.equal(cleanup,0);
  console.log(JSON.stringify({phase:'application-runner',...after,legacyRoleExists:oldRole,mappedGrantsObserved:observed,cleanup,contract}));
}finally{await client.end();}
