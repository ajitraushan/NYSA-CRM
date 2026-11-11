import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import pg from 'pg';
import {assertProductionPaths,parseRuntimeManifest,verifyPhaseReceipt,prepareSourceSwap,prepareSelectorModulesSwap,dependencyTreeHash,checkAccountQuota} from '../tools/production-prospect-release-operator.mjs';
import {verifyRuntime} from '../tools/production-runtime-manifest.mjs';
import {inspectProductionNodeTools,assertApprovedProductionNodeTools} from '../tools/production-node-tools.mjs';
import {createHash} from 'node:crypto';
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

test('accepted runtime verifier reports exact mismatch and the source swap preserves and restores RC1',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-prod-swap-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const stage=path.join(root,'stage');
  fs.mkdirSync(path.join(stage,'src'),{recursive:true});
  fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src','app.js'),'RC1');
  fs.writeFileSync(path.join(root,'src','existing-local.js'),'preserve');
  fs.writeFileSync(path.join(stage,'src','app.js'),'DEV270');
  const hash=createHash('sha256').update('RC1').digest('hex');
  const manifest=new Map([['src/app.js',hash]]);
  await verifyRuntime(root,manifest);
  await assert.rejects(verifyRuntime(root,new Map([['src/app.js','0'.repeat(64)]])),/src\/app.js.*Expected.*observed/);
  if(process.platform!=='win32')fs.chmodSync(path.join(root,'src'),0o555);
  const mode=fs.statSync(path.join(root,'src')).mode&0o777;
  const swap=prepareSourceSwap(root,stage,['src/app.js'],'unit-fixture',{
    copy:(from,to)=>{fs.cpSync(from,to,{recursive:true});if(process.platform!=='win32')fs.chmodSync(to,0o555);}
  });
  swap.activate();
  assert.equal(fs.readFileSync(path.join(root,'src','app.js'),'utf8'),'DEV270');
  assert.equal(fs.readFileSync(path.join(root,'src','existing-local.js'),'utf8'),'preserve');
  assert.equal(fs.statSync(path.join(root,'src')).mode&0o777,mode);
  swap.restore();
  await verifyRuntime(root,manifest);
  if(process.platform!=='win32')for(const directory of ['src','.src-failed-unit-fixture'])fs.chmodSync(path.join(root,directory),0o755);
});

test('selector keeps the same module link across install and verified RC1 rollback',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-nodevenv-swap-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const env=path.join(root,'nodevenv','24'),live=path.join(env,'lib','node_modules');
  const app=path.join(root,'app'),staged=path.join(root,'staged'),backup=path.join(root,'rc1-nodevenv');
  for(const directory of [live,app,staged])fs.mkdirSync(directory,{recursive:true});
  const moduleLink=path.join(app,'node_modules');
  fs.symlinkSync(live,moduleLink,process.platform==='win32'?'junction':'dir');
  const linkBefore=fs.readlinkSync(moduleLink);
  fs.writeFileSync(path.join(live,'module.js'),'RC1');
  fs.writeFileSync(path.join(staged,'module.js'),'DEV270');
  const copy=(from,to)=>fs.cpSync(from,to,{recursive:true,verbatimSymlinks:true,errorOnExist:true,force:false});
  copy(env,backup);
  const baseline=await dependencyTreeHash(live);
  const candidate=await dependencyTreeHash(staged);
  assert.equal(await dependencyTreeHash(backup),await dependencyTreeHash(env));
  const swap=prepareSelectorModulesSwap(live,staged,'unit-fixture',{copy});
  assert.equal(await dependencyTreeHash(swap.next),candidate);
  swap.activate();
  assert.equal(fs.readlinkSync(moduleLink),linkBefore);
  assert.equal(await dependencyTreeHash(fs.realpathSync(moduleLink)),candidate);
  swap.restore();
  assert.equal(fs.readlinkSync(moduleLink),linkBefore);
  assert.equal(await dependencyTreeHash(fs.realpathSync(moduleLink)),baseline);
  assert.equal(await dependencyTreeHash(path.join(backup,'lib','node_modules')),baseline);
});

test('CloudLinux selector wraps Node but Production pins the real ALT interpreter and its npm CLI',async()=>{
  const base='/opt/alt/alt-nodejs24/root/usr';
  const executable=base+'/bin/node';
  const wrapper='/usr/share/l.v.e-manager/utils/node_wrapper';
  const npmCli=base+'/lib/node_modules/npm/bin/npm-cli.js';
  const selectorNode='/home/nysareal/nodevenv/nysa-crm/24/bin/node';
  const resolved=new Map([[executable,executable],[selectorNode,wrapper],[base+'/bin/npm',npmCli]]);
  const digests=new Map([[wrapper,'a'.repeat(64)],[executable,'b'.repeat(64)],[npmCli,'c'.repeat(64)]]);
  const layout={executable,nodeVersion:'24.22.2',realpath:file=>resolved.get(file),hash:async file=>digests.get(file)};
  const receipt=await inspectProductionNodeTools(layout);
  assert.deepEqual(receipt,{
    nodeWrapper:wrapper,nodeWrapperSha256:digests.get(wrapper),nodeExecutable:executable,
    nodeExecutableSha256:digests.get(executable),nodeVersion:'24.22.2',npmCli,npmCliSha256:digests.get(npmCli)
  });
  assert.doesNotThrow(()=>assertApprovedProductionNodeTools(receipt,receipt));
  for(const key of ['nodeWrapperSha256','nodeExecutableSha256','npmCliSha256']){
    assert.throws(()=>assertApprovedProductionNodeTools(receipt,{...receipt,[key]:'d'.repeat(64)}),new RegExp(key));
  }
  await assert.rejects(inspectProductionNodeTools({...layout,executable:wrapper}),/exact ALT Node/);
  await assert.rejects(inspectProductionNodeTools({...layout,nodeVersion:'22.1.0'}),/requires Node.js 24/);
  resolved.set(base+'/bin/npm',wrapper);
  await assert.rejects(inspectProductionNodeTools(layout),/installation CLI/);
});

test('Production quota guard records each cPanel checkpoint and stops at or above 90 percent',()=>{
  const quota=(used,other={})=>JSON.stringify({
    module:'Quota',func:'get_quota_info',result:{status:1,data:{
      megabyte_limit:102400,megabytes_used:used,backup_warning_threshold_pct:90,under_backup_threshold:1,...other
    }}
  });
  const report={};
  assert.equal(checkAccountQuota(report,'before-backup',()=>quota('89205.28')).headroomMb.toFixed(2),'2954.72');
  assert.equal(checkAccountQuota(report,'after-archive',()=>quota('92159.99')).usedMb,92159.99);
  assert.throws(()=>checkAccountQuota(report,'after-npm-ci',()=>quota(92160)),/reached 90 percent at after-npm-ci/);
  assert.throws(()=>checkAccountQuota(report,'before-install',()=>quota(93000)),/reached 90 percent at before-install/);
  assert.throws(()=>checkAccountQuota(report,'after-dump',()=>quota('92159.99',{under_backup_threshold:0})),/reached 90 percent/);
  assert.deepEqual(report.accountQuota.map(sample=>sample.checkpoint),
    ['before-backup','after-archive','after-npm-ci','before-install','after-dump']);
  assert.throws(()=>checkAccountQuota({},'missing',()=>quota(null)),/Invalid cPanel quota field/);
  assert.throws(()=>checkAccountQuota({},'unlimited',()=>quota(0,{megabyte_limit:0})),/finite positive/);
  assert.throws(()=>checkAccountQuota({},'api-failure',()=>JSON.stringify({
    module:'Quota',func:'get_quota_info',result:{status:0}
  })),/account quota lookup failed/);
});
