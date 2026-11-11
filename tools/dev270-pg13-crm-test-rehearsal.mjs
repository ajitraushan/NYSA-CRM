import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readDatabaseSchemaContract,compareSchemaContracts,loadSchemaContract} from './database-schema-contract.mjs';
import {applyFixtureMigration,createFixture,fixtureIdentity,migrationFiles} from './dev270-pg13-rehearsal-fixture.mjs';

const role='nysa_test_user',client=await createFixture('nysa_test_fixture',role);
const git=(ref,file)=>JSON.parse(execFileSync('git',['show',ref+':src/'+file],{encoding:'utf8'}));
function historical(ref,dir){
  const manifest=git(ref,dir+'/manifest.json');
  return {...Object.fromEntries(Object.entries(manifest.contracts).map(([name,{file}])=>[name,git(ref,dir+'/'+file).entries])),
    triggers:git('422e7f55','database-trigger-contract.json').triggers.map(({table,name,function:fn,enabled})=>({table,name,function:fn,enabled}))};
}
const canonical=historical('422e7f55','database-schema-contract');
const drift=historical('d4541b7a','database-schema-baseline');
const id=n=>'d2650000-0000-4000-8000-'+String(n).padStart(12,'0');
const key=x=>x.table+'|'+x.name;
const q=v=>'"'+v.replaceAll('"','""')+'"';
try{
  for(const file of migrationFiles.slice(0,168))await applyFixtureMigration(client,file,role);
  assert.ok(compareSchemaContracts(canonical,await readDatabaseSchemaContract(client)).matches);
  const driftConstraints=new Set(drift.constraints.map(key)),driftIndexes=new Set(drift.indexes.map(key));
  const absent=canonical.constraints.filter(x=>!driftConstraints.has(key(x)));
  const indexes=canonical.indexes.filter(x=>!driftIndexes.has(key(x))&&!absent.some(y=>['p','u'].includes(y.type)&&key(x)===key(y)));
  await client.query('BEGIN');
  for(const type of ['f','p','u']) for(const row of absent.filter(x=>x.type===type)){
    await client.query('ALTER TABLE '+q(row.table)+' DROP CONSTRAINT '+q(row.name));
  }
  for(const row of indexes)await client.query('DROP INDEX '+q(row.name));
  await client.query("INSERT INTO brokers(id,name,email,role,status,password_hash) VALUES($1,'Synthetic DEV265 Actor','dev265-drift@example.invalid','internal_broker','active','fixture-only')",[id(1)]);
  for(let i=1;i<=12;i++)await client.query(`INSERT INTO wa_conversation_messages(id,conversation_id,direction,message_type,body,occurred_at,retention_expires_at,simulated,provider_message_id)
    VALUES($1,$2,'inbound','text','Synthetic orphan',NOW(),NOW()+INTERVAL '12 months',TRUE,$3)`,[id(100+i),id(2),'synthetic-orphan-'+i]);
  for(let i=1;i<=5;i++)await client.query("INSERT INTO wa_inbox_notifications(id,conversation_id,broker_id,notification_type) VALUES($1,$2,$3,'new_message')",[id(200+i),id(2),id(1)]);
  await client.query('COMMIT');
  assert.ok(compareSchemaContracts(drift,await readDatabaseSchemaContract(client)).matches);
  console.log(JSON.stringify({phase:'historical-drift',...await fixtureIdentity(client),contractMatches:true}));
  await applyFixtureMigration(client,migrationFiles[168],role);
  assert.ok(compareSchemaContracts(canonical,await readDatabaseSchemaContract(client)).matches);
  const audit=(await client.query("SELECT performed_by,details::jsonb FROM audit_log WHERE action='uat264_simulator_orphan_cleanup'")).rows;
  assert.equal(audit.length,1);
  assert.equal(audit[0].performed_by,id(1));
  assert.equal(audit[0].details.messages,12);
  assert.equal(audit[0].details.notifications,5);
  assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM wa_conversation_messages WHERE provider_message_id LIKE 'synthetic-orphan-%'")).rows[0].n,0);
  assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM wa_inbox_notifications WHERE conversation_id=$1',[id(2)])).rows[0].n,0);
  for(const file of migrationFiles.slice(169))await applyFixtureMigration(client,file,role);
  assert.ok(compareSchemaContracts(loadSchemaContract('src/database-schema-contract','src/database-trigger-contract.json'),await readDatabaseSchemaContract(client)).matches);
  console.log(JSON.stringify({phase:'restored',...await fixtureIdentity(client),contractMatches:true,auditCount:1,deletedMessages:12,deletedNotifications:5}));
}finally{await client.end();}
