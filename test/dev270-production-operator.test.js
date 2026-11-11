import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import pg from 'pg';
import {assertProductionPaths,parseRuntimeManifest,verifyPhaseReceipt} from '../tools/production-prospect-release-operator.mjs';
import {readProductionPrivilegeEvidence,validateProductionRegistration} from '../tools/production-prospect-readonly-preflight.mjs';

test('Production operator rejects invalid runtime entries, escaped paths and stale or unrelated receipts',()=>{
  const h='a'.repeat(64),commit='b'.repeat(40),base='/home/nysareal/crm-release-preparation';
  const manifest=['app.cjs','package.json','package-lock.json'].map(name=>h+'  '+name).join('\n')+'\n';
  assert.equal(parseRuntimeManifest(manifest).size,3);
  for(const invalid of ['../x','x/../y','/home/file','x/node_modules/file','x\\y','package.json']){
    assert.throws(()=>parseRuntimeManifest(manifest+h+'  '+invalid+'\n'),/Unsafe/);
  }
  const files=['package','manifest','baselineRuntime','baselineSchema','preflightReceipt','preflightConfig'];
  const config={workspace:base+'/20261112-dev270-prod-review',...Object.fromEntries(files.map(key=>[key,base+'/inputs/'+key]))};
  assert.doesNotThrow(()=>assertProductionPaths(config));
  assert.throws(()=>assertProductionPaths({...config,package:base+'/inputs/../app.zip'}));
  assert.throws(()=>assertProductionPaths({...config,package:config.workspace+'/app.zip'}));
  const now=Date.now();
  const receipt={phase:'backup',result:'PASSED',commit,configSha256:h,completedAt:new Date(now-1000).toISOString()};
  const options={phase:'backup',commit,configSha256:h,maximumAgeMs:5000,now};
  assert.doesNotThrow(()=>verifyPhaseReceipt(receipt,options));
  assert.throws(()=>verifyPhaseReceipt(receipt,{...options,phase:'install'}));
  assert.throws(()=>verifyPhaseReceipt(receipt,{...options,now:now+10000}),/expired/);
  assert.throws(()=>verifyPhaseReceipt(receipt,{...options,configSha256:'c'.repeat(64)}));
});

test('Production preflight refuses Test identity and an enabled simulator',()=>{
  const environment={PGDATABASE:'nysareal_nysacrm',PGUSER:'nysareal_nysacrmapp',PGPASSWORD:'synthetic'};
  assert.doesNotThrow(()=>validateProductionRegistration(environment));
  assert.throws(()=>validateProductionRegistration({...environment,PGUSER:'nysareal_nysar2app'}),/identity mismatch/);
  assert.throws(()=>validateProductionRegistration({...environment,WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true'}),/must be off/);
});

test('Production preflight reports public owners and effective legacy privileges in PostgreSQL 13.23',{
  skip:process.env.NYSA_PRODUCTION_OPERATOR_FIXTURE!=='local-synthetic'
},async()=>{
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.equal(process.env.PGDATABASE,'nysareal_nysacrm');
  const client=new pg.Client({user:'postgres'});
  await client.connect();
  try{
    const actual=(await client.query("SELECT current_setting('server_version') AS version,current_setting('data_directory') AS directory")).rows[0];
    assert.match(actual.version,/^13\.23\b/);
    assert.match(actual.directory,/nysa-dev270-rehearsal-/);
    assert.equal(path.resolve(actual.directory),path.resolve(process.env.NYSA_PG13_FIXTURE_DATA));
    const absent=await readProductionPrivilegeEvidence(client);
    assert.deepEqual(absent.legacyRole,{name:'nysareal_nysar2app',exists:false,connect:false});
    await client.query('BEGIN');
    await client.query('CREATE ROLE nysareal_nysar2app NOLOGIN');
    await client.query('GRANT SELECT ON public.prospects TO nysareal_nysar2app');
    const present=await readProductionPrivilegeEvidence(client);
    assert.deepEqual(present.legacyRole,{name:'nysareal_nysar2app',exists:true,connect:true});
    assert.deepEqual(present.publicTables.find(row=>row.table_name==='prospects'),
      {table_name:'prospects',owner:'nysareal_nysacrmapp',legacy_role_privileges:['SELECT']});
    await client.query('ROLLBACK');
  }finally{await client.end();}
});
