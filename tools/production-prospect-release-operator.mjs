import {inspectProductionNodeTools,assertApprovedProductionNodeTools} from './production-node-tools.mjs';
import {fileHash,parseRuntimeManifest,safeName,verifyRuntime} from './production-runtime-manifest.mjs';
export {parseRuntimeManifest} from './production-runtime-manifest.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {verifyReadinessWorker} from './hosted-worker-lifecycle.mjs';
import {inspectProductionWorkers,quiesceProductionWorkers,acceptProductionReadiness} from './production-worker-evidence.mjs';
import {parsePgRestoreListContracts,verifyScopedBackupTableNames} from './crm-test-backup-verification.mjs';
import {compareSchemaContracts,loadSchemaContract,readDatabaseSchemaContract} from './database-schema-contract.mjs';
import {productionBaseline,validateProductionRegistration,verifyProductionCatalog} from './production-prospect-readonly-preflight.mjs';

const ROOT='/home/nysareal/nysa-crm', DOMAIN='crm.nysarealty.com';
const DATABASE='nysareal_nysacrm', ROLE='nysareal_nysacrmapp';
const NODEVENV='/home/nysareal/nodevenv/nysa-crm/24';
const SELECTOR_MODULES=path.join(NODEVENV,'lib','node_modules');
const WORK='/home/nysareal/crm-release-preparation';
const digest=data=>createHash('sha256').update(data).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const run=(cmd,args,options={})=>execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],timeout:120000,
  maxBuffer:32*1024*1024,...options});
const filePath=(root,name)=>path.join(root,name);
const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function verifyPhaseReceipt(receipt,{phase,commit,configSha256,maximumAgeMs,now=Date.now()}){
  assert.equal(receipt.result,'PASSED');
  assert.equal(receipt.phase,phase);
  assert.equal(receipt.commit,commit);
  assert.equal(receipt.configSha256,configSha256);
  const age=now-Date.parse(receipt.completedAt);
  assert.ok(age>=0&&age<=maximumAgeMs,'Phase receipt expired or invalid');
}

export function assertProductionPaths(config){
  for(const key of ['workspace','package','manifest','baselineRuntime','baselineSchema','preflightReceipt','preflightConfig']){
    const value=config[key];
    assert.ok(typeof value==='string'&&path.posix.normalize(value)===value&&value.startsWith(WORK+'/'),key+' must be under the preparation root');
  }
  assert.match(config.workspace,/^\/home\/nysareal\/crm-release-preparation\/[0-9]{8}-dev\d+-prod-[a-z0-9-]+$/);
  assert.equal(new Set(['workspace','package','manifest','baselineRuntime','baselineSchema','preflightReceipt','preflightConfig'].map(key=>config[key])).size,7);
  for(const key of ['package','manifest','baselineRuntime','baselineSchema','preflightReceipt','preflightConfig']){
    assert.ok(!config[key].startsWith(config.workspace+'/'),'Input must be outside the new output directory');
  }
}

function registration(){
  const result=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',DOMAIN]));
  const matches=[];
  function walk(node){
    if(!node||typeof node!=='object')return;
    for(const [key,value] of Object.entries(node)){
      if(key===ROOT||key===path.basename(ROOT))matches.push(value);
      else if(key!=='env_vars')walk(value);
    }
  }
  walk(result);
  if(matches.length!==1||matches[0].domain!==DOMAIN)throw Error('Production selector registration mismatch');
  return matches[0];
}
function selector(action){
  run('cloudlinux-selector',[action,'--json','--interpreter','nodejs','--domain',DOMAIN,'--app-root',path.basename(ROOT)]);
}
async function stop(report){
  const isStopped=()=>registration().app_status==='stopped';
  await quiesceProductionWorkers(report,{selectorStop:()=>selector('stop'),isStopped});
}
function environment(){
  const env=registration().env_vars||{};
  validateProductionRegistration(env);
  return env;
}
async function catalog(config,canonicalRoot){
  const env=environment();
  const {Client}=createRequire(path.join(ROOT,'package.json'))('pg');
  const client=new Client({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:DATABASE,user:ROLE,
    password:env.PGPASSWORD,statement_timeout:20000,connectionTimeoutMillis:10000});
  await client.connect();
  try{
    await client.query('BEGIN READ ONLY');
    if(!canonicalRoot)return await verifyProductionCatalog(client,read(config.baselineSchema),config.baselineCommit);
    const identity=(await client.query("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only")).rows[0];
    assert.deepEqual(identity,{database:DATABASE,role:ROLE,read_only:'on'});
    const dir=path.join(canonicalRoot,'src');
    const contract=loadSchemaContract(path.join(dir,'database-schema-contract'),path.join(dir,'database-trigger-contract.json'));
    const observed=await readDatabaseSchemaContract(client);
    assert.ok(compareSchemaContracts(contract,observed).matches,'Post-install catalog differs from candidate');
    const ledger=(await client.query('SELECT version FROM schema_migrations ORDER BY 1')).rows.map(row=>row.version);
    const migrationFiles=fs.readdirSync(path.join(dir,'migrations')).filter(name=>name.endsWith('.sql')).sort();
    assert.deepEqual(ledger,migrationFiles);
    const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows.map(row=>row.tablename);
    assert.deepEqual(tables,[...new Set(contract.columns.map(row=>row.table))].sort());
    return {migrations:ledger.length,tables:tables.length,triggers:observed.triggers.length};
  }finally{await client.end();}
}
async function requireHash(file,expected){
  assert.ok(isHash(expected),'Invalid expected SHA-256');
  assert.equal(await fileHash(file),expected,'Hash mismatch: '+path.basename(file));
}
export async function dependencyTreeHash(root,{preserveExternalLinks=false}={}){
  const rows=[];
  async function walk(directory){
    const names=fs.readdirSync(directory).sort();
    for(const name of names){
      const file=path.join(directory,name),relative=path.relative(root,file);
      const stat=fs.lstatSync(file);
      if(stat.isDirectory()){rows.push([relative,'directory',stat.mode&0o7777]);await walk(file);}
      else if(stat.isFile())rows.push([relative,'file',stat.mode&0o7777,await fileHash(file)]);
      else if(stat.isSymbolicLink()){
        if(!preserveExternalLinks)assert.ok(fs.realpathSync(file).startsWith(root+path.sep),'Dependency symlink escapes its staged directory');
        rows.push([relative,'symlink',fs.readlinkSync(file)]);
      }else throw Error('Unexpected dependency file type');
    }
  }
  await walk(root);
  assert.ok(rows.length>0,'Empty dependency tree');
  return digest(JSON.stringify([fs.statSync(root).mode&0o7777,rows]));
}
function dependencyLink(){
  const file=path.join(ROOT,'node_modules');
  assert.ok(fs.lstatSync(file).isSymbolicLink(),'Production dependency path must be a symlink');
  const resolved=fs.realpathSync(file);
  assert.equal(resolved,SELECTOR_MODULES,'Production dependency link must resolve to the registered nodevenv');
  return {target:fs.readlinkSync(file),resolved};
}
const copyTree=(from,to)=>run('cp',['-a','--',from,to],{timeout:600000});
export function prepareSelectorModulesSwap(live,staged,suffix,{copy=copyTree}={}){
  assert.match(suffix,/^[a-z0-9-]+$/);
  assert.equal(fs.realpathSync(live),live);
  const parent=path.dirname(live);
  const next=path.join(parent,'.nysa-modules-next-'+suffix);
  const prior=path.join(parent,'.nysa-modules-rc1-'+suffix);
  const failed=path.join(parent,'.nysa-modules-failed-'+suffix);
  for(const file of [next,prior,failed])assert.throws(()=>fs.lstatSync(file),{code:'ENOENT'});
  copy(staged,next);
  let parked=false,activated=false;
  return {
    next,prior,
    activate(){
      fs.renameSync(live,prior);
      parked=true;
      fs.renameSync(next,live);
      activated=true;
    },
    restore(){
      if(activated){fs.renameSync(live,failed);activated=false;}
      if(parked){fs.renameSync(prior,live);parked=false;}
    }
  };
}
async function stageDependencies(config,stageDir,{nodeExecutable,npmCli}){
  const cleanEnv={PATH:path.dirname(nodeExecutable)+':/usr/bin:/bin',HOME:config.workspace,
    npm_config_registry:'https://registry.npmjs.org/',npm_config_cache:path.join(config.workspace,'npm-cache')};
  run(nodeExecutable,[npmCli,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],
    {cwd:stageDir,env:cleanEnv,timeout:600000});
  const deps=path.join(stageDir,'node_modules');
  assert.equal(fs.realpathSync(deps),deps);
  const verify=createRequire(path.join(stageDir,'package.json'));
  for(const dependency of Object.keys(read(path.join(stageDir,'package.json')).dependencies)){
    // Packages with conditional exports or no default entry still need to be present.
    assert.ok(fs.statSync(path.join(deps,dependency,'package.json')).isFile(),'Dependency missing: '+dependency);
  }
  verify.resolve('pg');
  return deps;
}
const BACKUP_QUOTA_THRESHOLD=90;
export function checkAccountQuota(report,checkpoint,readQuota=()=>run('uapi',['--output=json','Quota','get_quota_info'],{encoding:'utf8',timeout:15000})){
  const envelope=JSON.parse(readQuota());
  assert.equal(envelope.module,'Quota','Unexpected cPanel quota API module');
  assert.equal(envelope.func,'get_quota_info','Unexpected cPanel quota API function');
  assert.ok([1,'1'].includes(envelope.result?.status),'cPanel account quota lookup failed');
  const data=envelope.result.data;
  function megabytes(field){
    const value=data?.[field];
    assert.ok((typeof value==='number'||typeof value==='string') && /^\d+(?:\.\d+)?$/.test(String(value)),
      'Invalid cPanel quota field: '+field);
    const result=Number(value);
    assert.ok(Number.isFinite(result),'Non-finite cPanel quota field: '+field);
    return result;
  }
  const limitMb=megabytes('megabyte_limit'),usedMb=megabytes('megabytes_used');
  assert.ok(limitMb>0,'A finite positive cPanel account quota is required');
  const usedPercent=100*usedMb/limitMb;
  const headroomMb=limitMb*BACKUP_QUOTA_THRESHOLD/100-usedMb;
  const atBackupThreshold=Number(data.backup_warning_threshold_pct)===BACKUP_QUOTA_THRESHOLD
    && [0,'0',false].includes(data.under_backup_threshold);
  const sample={checkpoint,checkedAt:new Date().toISOString(),usedMb,limitMb,usedPercent,
    thresholdPercent:BACKUP_QUOTA_THRESHOLD,headroomMb};
  (report.accountQuota??=[]).push(sample);
  assert.ok(headroomMb>0&&!atBackupThreshold,
    `cPanel account quota reached 90 percent at ${checkpoint} (${usedMb} of ${limitMb} MB)`);
  return sample;
}
function storedNames(file){
  return run('unzip',['-Z1',file],{encoding:'utf8'}).trimEnd().split('\n');
}
async function stage(config,stageDir){
  await requireHash(config.package,config.packageSha256);
  await requireHash(config.manifest,config.manifestSha256);
  const manifest=read(config.manifest);
  assert.equal(manifest.schema,'nysa.release-provenance.v1');
  assert.equal(manifest.commit,config.commit);
  assert.equal(manifest.version,config.version);
  assert.equal(manifest.packageSha256,config.packageSha256);
  assert.ok(manifest.testReceipt.passed>0&&manifest.testReceipt.failed===0);
  const names=storedNames(config.package);
  assert.ok(names.every(safeName)&&new Set(names).size===names.length&&names.length===manifest.entryCount,'Unsafe package entries');
  // Ignore stored permissions and symlinks. Write each governed entry as a new regular file.
  fs.mkdirSync(stageDir,{mode:0o700});
  for(const name of names){
    const file=filePath(stageDir,name);
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    fs.writeFileSync(file,run('unzip',['-p',config.package,name]),{flag:'wx',mode:0o600});
  }
  const runtime=path.join(stageDir,'RUNTIME_MANIFEST.sha256');
  await requireHash(runtime,manifest.runtimeManifestSha256);
  const entries=parseRuntimeManifest(fs.readFileSync(runtime,'utf8'));
  assert.deepEqual([...entries.keys(),'RUNTIME_MANIFEST.sha256'].sort(),names.sort());
  await verifyRuntime(stageDir,entries);
  return entries;
}

export function prepareSourceSwap(root,stageDir,names,suffix,{
  copy=(source,target)=>run('cp',['-a','--',source,target])
}={}){
  assert.match(suffix,/^[a-z0-9-]+$/);
  const live=path.join(root,'src'), next=path.join(root,'.src-next-'+suffix),
    previous=path.join(root,'.src-previous-'+suffix), failed=path.join(root,'.src-failed-'+suffix);
  assert.equal(fs.realpathSync(live),live);
  for(const target of [next,previous,failed]){
    assert.throws(()=>fs.lstatSync(target),{code:'ENOENT'});
  }
  copy(live,next);
  const originalModes=new Map();
  function openForWrite(target){
    const stat=fs.lstatSync(target);
    assert.ok(!stat.isSymbolicLink()&&fs.realpathSync(target)===target,'Unsafe source staging path');
    const mode=stat.mode&0o7777;
    if(!(mode&0o200)){
      originalModes.set(target,mode);
      fs.chmodSync(target,mode|0o200);
    }
  }
  try{
    openForWrite(next);
    for(const name of names){
      assert.ok(safeName(name)&&name.startsWith('src/'));
      const relative=name.slice(4).split('/'),file=relative.pop();
      let parent=next;
      for(const part of relative){
        parent=path.join(parent,part);
        if(!fs.existsSync(parent))fs.mkdirSync(parent,{mode:0o755});
        openForWrite(parent);
      }
      const target=path.join(parent,file);
      if(fs.existsSync(target))openForWrite(target);
      else assert.throws(()=>fs.lstatSync(target),{code:'ENOENT'});
      fs.copyFileSync(path.join(stageDir,name),target);
    }
  }finally{
    for(const [target,mode] of [...originalModes].reverse())fs.chmodSync(target,mode);
  }
  let parked=false,activated=false;
  return {
    previous,
    activate(){
      fs.renameSync(live,previous);
      parked=true;
      fs.renameSync(next,live);
      activated=true;
    },
    restore(){
      if(activated){fs.renameSync(live,failed);activated=false;}
      if(parked){fs.renameSync(previous,live);parked=false;}
    }
  };
}

async function main(args){
  process.umask(0o077);
  assert.equal(process.platform,'linux');
  assert.deepEqual(args.filter((_,index)=>index%2===0),['--phase','--config','--approved']);
  const [,phase,,configFile,,approval]=args;
  assert.ok(['backup','install','smoke'].includes(phase));
  const configBytes=fs.readFileSync(configFile),config=JSON.parse(configBytes),configSha256=digest(configBytes);
  assert.match(config.commit,/^[a-f0-9]{40}$/);
  assert.match(config.version,/^2\.1\.0-dev\.\d+$/);
  const approvedBaseline=productionBaseline(config.baselineCommit);
  assert.equal(approval,`${config.commit}:production-${phase}:${configSha256}`);
  assertProductionPaths(config);
  for(const key of ['package','manifest','baselineRuntime','baselineSchema','preflightReceipt','preflightConfig']){
    assert.equal(fs.realpathSync(config[key]),config[key],'Symlinked input: '+key);
  }
  assert.equal(fs.realpathSync(path.dirname(config.workspace)),path.dirname(config.workspace));
  assert.equal(fs.realpathSync(ROOT),ROOT);
  await requireHash(config.baselineRuntime,config.baselineRuntimeSha256);
  await requireHash(config.baselineSchema,config.baselineSchemaSha256);
  await requireHash(config.preflightReceipt,config.preflightReceiptSha256);
  await requireHash(config.preflightConfig,config.preflightConfigSha256);
  const preflight=read(config.preflightReceipt),preflightConfig=read(config.preflightConfig);
  assert.equal(preflight.result,'READ_ONLY_PREFLIGHT_PASSED');
  assert.equal(preflight.root,ROOT);
  assert.equal(preflight.candidateCommit,config.commit);
  assert.equal(preflight.configSha256,config.preflightConfigSha256);
  assert.equal(preflightConfig.baselineSchemaSha256,config.baselineSchemaSha256);
  assert.equal(preflightConfig.baselineRuntimeManifestSha256,config.baselineRuntimeSha256);
  assert.equal(preflight.runtimeFiles?.manifestSha256,config.baselineRuntimeSha256);
  assert.equal(preflightConfig.baselineCommit,config.baselineCommit);
  assert.equal(preflight.baselineCommit,config.baselineCommit);
  assert.equal(preflight.installedVersion,approvedBaseline.version);
  assert.equal(preflight.runtimeFiles?.verified,approvedBaseline.runtimeFiles);
  const freshnessMs=config.freshnessMinutes*60000;
  assert.ok(Number.isFinite(freshnessMs)&&freshnessMs>=600000&&freshnessMs<=14400000);
  if(phase==='backup'){
    const age=Date.now()-Date.parse(preflight.completedAt);
    assert.ok(age>=0&&age<=freshnessMs,'Production preflight receipt expired');
    fs.mkdirSync(config.workspace,{mode:0o700});
  }
  const evidence=key=>path.join(config.workspace,key);
  const receiptPath=key=>evidence(key.toUpperCase()+'_RESULT.json');
  const report={phase,commit:config.commit,configSha256,startedAt:new Date().toISOString(),result:'FAILED'};
  const output=fs.openSync(receiptPath(phase),'wx',0o600);
  const stageDir=evidence('candidate'),archive=evidence('app.tar.gz'),dump=evidence('database.dump');
  try{
    report.nodeTools=await inspectProductionNodeTools();
    assertApprovedProductionNodeTools(report.nodeTools,config);
    const baseline=parseRuntimeManifest(fs.readFileSync(config.baselineRuntime,'utf8'));
    if(phase==='backup'){
      checkAccountQuota(report,'before-backup');
      assert.equal(read(path.join(ROOT,'package.json')).version,approvedBaseline.version);
      await verifyRuntime(ROOT,baseline);
      report.catalog=await catalog(config);
      report.workers=inspectProductionWorkers();
      report.staleWorkersFound=report.workers.filter(worker=>worker.stale);
      const entries=await stage(config,stageDir);
      checkAccountQuota(report,'after-candidate-extraction');
      report.previousDependencies=dependencyLink();
      assert.equal(fs.realpathSync(NODEVENV),NODEVENV);
      const rc1Nodevenv=evidence('rc1-nodevenv');
      assert.throws(()=>fs.lstatSync(rc1Nodevenv),{code:'ENOENT'});
      const before=await dependencyTreeHash(NODEVENV,{preserveExternalLinks:true});
      copyTree(NODEVENV,rc1Nodevenv);
      checkAccountQuota(report,'after-rc1-nodevenv-copy');
      assert.equal(await dependencyTreeHash(rc1Nodevenv,{preserveExternalLinks:true}),before,'RC1 nodevenv backup differs');
      assert.equal(await dependencyTreeHash(NODEVENV,{preserveExternalLinks:true}),before,'RC1 nodevenv changed while copied');
      report.rc1Nodevenv={copy:rc1Nodevenv,sha256:before,
        modulesSha256:await dependencyTreeHash(SELECTOR_MODULES,{preserveExternalLinks:true})};
      report.stagedDependencies=await stageDependencies(config,stageDir,report.nodeTools);
      checkAccountQuota(report,'after-npm-ci');
      report.stagedDependencySha256=await dependencyTreeHash(report.stagedDependencies);
      await verifyRuntime(stageDir,entries);
      run('tar',['-czf',archive,'--one-file-system','-C',ROOT,'.'],{timeout:600000});
      checkAccountQuota(report,'after-application-archive');
      const archived=new Set(run('tar',['-tzf',archive],{encoding:'utf8'}).trimEnd().split('\n'));
      for(const file of baseline.keys())assert.ok(archived.has('./'+file),'Missing backup runtime entry: '+file);
      const env=environment();
      for(const executable of ['pg_dump','pg_restore'])assert.match(run(executable,['--version'],{encoding:'utf8'}),/\b13\.23\b/);
      run('pg_dump',['-Fc','--no-password','-f',dump,DATABASE],{timeout:600000,env:{...process.env,
        PGHOST:env.PGHOST||'localhost',PGPORT:String(env.PGPORT||5432),PGUSER:ROLE,PGPASSWORD:env.PGPASSWORD}});
      checkAccountQuota(report,'after-database-dump');
      const toc=run('pg_restore',['--list',dump],{encoding:'utf8'});
      const dumpTables=parsePgRestoreListContracts(toc).tableNames;
      assert.ok(verifyScopedBackupTableNames(read(config.baselineSchema).tables,dumpTables).matches);
      report.backups={app:{bytes:fs.statSync(archive).size,sha256:await fileHash(archive)},
        database:{bytes:fs.statSync(dump).size,sha256:await fileHash(dump)},runtimeFiles:entries.size,dumpTables:dumpTables.length};
      assert.ok(report.backups.app.bytes&&report.backups.database.bytes);
    }else if(phase==='install'){
      checkAccountQuota(report,'before-install');
      const backup=read(receiptPath('backup'));
      verifyPhaseReceipt(backup,{phase:'backup',commit:config.commit,configSha256,maximumAgeMs:freshnessMs});
      await requireHash(archive,backup.backups.app.sha256);
      await requireHash(dump,backup.backups.database.sha256);
      await verifyRuntime(ROOT,baseline);
      assert.deepEqual(dependencyLink(),backup.previousDependencies,'Installed dependency link changed after backup');
      assert.equal(backup.stagedDependencies,path.join(stageDir,'node_modules'));
      assert.equal(fs.realpathSync(backup.stagedDependencies),backup.stagedDependencies);
      assert.equal(await dependencyTreeHash(backup.stagedDependencies),backup.stagedDependencySha256);
      assert.equal(backup.rc1Nodevenv.copy,evidence('rc1-nodevenv'));
      assert.equal(await dependencyTreeHash(backup.rc1Nodevenv.copy,{preserveExternalLinks:true}),backup.rc1Nodevenv.sha256);
      assert.equal(await dependencyTreeHash(NODEVENV,{preserveExternalLinks:true}),backup.rc1Nodevenv.sha256,
        'RC1 nodevenv changed after backup');
      await catalog(config);
      const runtime=path.join(stageDir,'RUNTIME_MANIFEST.sha256');
      await requireHash(config.manifest,config.manifestSha256);
      await requireHash(runtime,read(config.manifest).runtimeManifestSha256);
      const entries=parseRuntimeManifest(fs.readFileSync(runtime,'utf8'));
      await verifyRuntime(stageDir,entries);
      const targets=[...entries.keys(),'RUNTIME_MANIFEST.sha256'];
      const prior=new Map();
      for(const name of targets){
        const file=filePath(ROOT,name);
        for(let parent=path.dirname(file);parent!==ROOT;parent=path.dirname(parent)){
          if(fs.existsSync(parent))assert.equal(fs.realpathSync(parent),parent,'Symlinked runtime parent');
        }
        if(fs.existsSync(file)){
          assert.ok(fs.lstatSync(file).isFile()&&fs.realpathSync(file)===file,'Unsafe runtime target');
          prior.set(name,await fileHash(file));
        }
      }
      const recovery=evidence('verified-runtime-rollback');
      fs.mkdirSync(recovery,{mode:0o700});
      assert.ok(prior.size>0);
      run('tar',['-xzf',archive,'-C',recovery,'--',...[...prior.keys()].map(name=>'./'+name)],{timeout:120000});
      checkAccountQuota(report,'after-runtime-recovery-extraction');
      await verifyRuntime(recovery,prior);
      fs.writeFileSync(evidence('ORIGINAL_RUNTIME.json'),JSON.stringify([...prior])+'\n',{flag:'wx',mode:0o600});
      const sourceSwap=prepareSourceSwap(ROOT,stageDir,targets.filter(name=>name.startsWith('src/')),path.basename(config.workspace));
      checkAccountQuota(report,'after-source-swap-preparation');
      for(const name of targets.filter(name=>!name.startsWith('src/'))){
        const file=filePath(ROOT,name);
        let parent=path.dirname(file);
        while(!fs.existsSync(parent))parent=path.dirname(parent);
        fs.accessSync(parent,fs.constants.W_OK);
        if(fs.existsSync(file))fs.accessSync(file,fs.constants.W_OK);
      }
      const modulesSwap=prepareSelectorModulesSwap(SELECTOR_MODULES,backup.stagedDependencies,path.basename(config.workspace));
      checkAccountQuota(report,'after-selector-modules-copy');
      assert.equal(await dependencyTreeHash(modulesSwap.next),backup.stagedDependencySha256);
      report.priorNodevenvModules=modulesSwap.prior;
      report.priorSourceDirectory=sourceSwap.previous;
      checkAccountQuota(report,'before-quiesce-and-install');
      let quiesced=false,startAttempted=false;
      const changed=[];
      try{
        await stop(report);
        quiesced=true;
        await catalog(config);
        sourceSwap.activate();
        for(const name of targets.filter(name=>!name.startsWith('src/'))){
          const file=filePath(ROOT,name);
          fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o755});
          changed.push(name);
          fs.copyFileSync(filePath(stageDir,name),file);
        }
        await verifyRuntime(ROOT,entries);
        environment();
        modulesSwap.activate();
        assert.deepEqual(dependencyLink(),backup.previousDependencies);
        assert.equal(await dependencyTreeHash(SELECTOR_MODULES),backup.stagedDependencySha256);
        startAttempted=true;
        selector('start');
        await acceptProductionReadiness(report,config.version);
        report.selectorDependencies=dependencyLink();
        assert.deepEqual(report.selectorDependencies,backup.previousDependencies);
        assert.equal(await dependencyTreeHash(SELECTOR_MODULES),backup.stagedDependencySha256);
        report.catalog=await catalog(config,stageDir);
        report.workersAfterInstall=inspectProductionWorkers();
        assert.equal(report.workersAfterInstall.length,1,'Production must have one worker after install');
      }catch(error){
        if(quiesced&&!report.readinessAccepted){
          if(startAttempted){
            report.rollbackWorkerReconciliation={};
            await stop(report.rollbackWorkerReconciliation);
          }else{
            assert.equal(registration().app_status,'stopped');
            assert.equal(inspectProductionWorkers().length,0);
          }
          sourceSwap.restore();
          const restore=changed.filter(name=>prior.has(name));
          for(const name of restore)fs.copyFileSync(filePath(recovery,name),filePath(ROOT,name));
          for(const name of changed.filter(name=>!prior.has(name)))fs.rmSync(filePath(ROOT,name),{force:true});
          modulesSwap.restore();
          assert.equal(await dependencyTreeHash(SELECTOR_MODULES,{preserveExternalLinks:true}),backup.rc1Nodevenv.modulesSha256);
          assert.equal(await dependencyTreeHash(backup.rc1Nodevenv.copy,{preserveExternalLinks:true}),backup.rc1Nodevenv.sha256);
          assert.deepEqual(dependencyLink(),backup.previousDependencies);
          await verifyRuntime(ROOT,baseline);
          await verifyRuntime(ROOT,new Map(restore.map(name=>[name,prior.get(name)])));
          report.rollbackFilesVerified=true;
          report.candidateStartAttempted=startAttempted;
          // Automatic restart still requires the approved baseline database contract.
          await catalog(config);
          selector('start');
          const rootResponse=await fetch('https://'+DOMAIN+'/',{redirect:'error',signal:AbortSignal.timeout(15000)});
          assert.equal(rootResponse.status,200);
          assert.match(await rootResponse.text(),/NYSA CORE/);
          const health=await fetch('https://'+DOMAIN+'/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
          assert.equal(health.status,200);
          report.rollback=await verifyReadinessWorker({root:ROOT,expectedVersion:approvedBaseline.version});
        }
        throw error;
      }
    }else{
      verifyPhaseReceipt(read(receiptPath('install')),{phase:'install',commit:config.commit,configSha256,maximumAgeMs:freshnessMs});
      environment();
      report.attempts=[];
      const pending=new Map([['/',200],['/api/health',200],['/api/readiness',200],['/api/me',401],
        ['/api/crm/campaigns',401],['/api/crm/whatsapp-workspace',404],['/api/providers/whatsapp-simulated/health',404]]);
      const deadline=Date.now()+45000;
      while(pending.size&&Date.now()<deadline){
        for(const [route,expected] of pending){
          if(Date.now()>=deadline)break;
          const attempt={route,expected,at:new Date().toISOString()};
          try{
            const response=await fetch('https://'+DOMAIN+route,{redirect:'error',signal:AbortSignal.timeout(Math.min(4000,deadline-Date.now()))});
            const body=await response.text();
            attempt.status=response.status;
            attempt.server=response.headers.get('server');
            attempt.bodySha256=digest(body);
            attempt.bodyIndicator=route==='/'?(body.includes('NYSA CORE')?'NYSA CORE':'unexpected root'):route==='/api/readiness'?
              JSON.stringify({ok:JSON.parse(body).ok,version:JSON.parse(body).version,database:JSON.parse(body).database}):'response received';
            attempt.passed=response.status===expected&&(route!=='/'||body.includes('NYSA CORE'))&&
              (route!=='/api/readiness'||(JSON.parse(body).version===config.version&&JSON.parse(body).database==='ready'));
            if(attempt.passed)pending.delete(route);
          }catch(error){attempt.error=error.name;}
          report.attempts.push(attempt);
        }
        if(pending.size)await sleep(Math.min(2500,Math.max(0,deadline-Date.now())));
      }
      assert.equal(pending.size,0,'Settled HTTP probes failed');
      report.readiness=await verifyReadinessWorker({root:ROOT,expectedVersion:config.version,inspect:inspectProductionWorkers});
      const backup=read(receiptPath('backup'));
      report.selectorDependencies=dependencyLink();
      assert.deepEqual(report.selectorDependencies,backup.previousDependencies);
      assert.equal(await dependencyTreeHash(SELECTOR_MODULES),backup.stagedDependencySha256);
    }
    report.result='PASSED';
  }catch(error){
    report.error=error.code||error.name;
    if(error instanceof assert.AssertionError)report.assertionMessage=error.message;
    else if(!error.stderr)report.message=String(error.message).slice(0,240);
    process.exitCode=1;
  }finally{
    report.completedAt=new Date().toISOString();
    fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    fs.closeSync(output);
    console.log(JSON.stringify({phase,result:report.result}));
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
