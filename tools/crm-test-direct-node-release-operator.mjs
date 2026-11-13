import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {inspectInstallWorkers,inspectWorkers,stopVerifiedWorkers,verifyReadinessWorker} from './hosted-worker-lifecycle.mjs';
import {parsePgRestoreListContracts,resolveScopedBackupPath,verifyScopedBackupTableNames} from './crm-test-backup-verification.mjs';
import {compareDatabaseTriggerContract,normalizeExpectedTriggerContract} from './database-trigger-contract.mjs';

process.umask(0o077);

const PHASES=new Set(['stage','backup','install','smoke']);
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

function argumentsOf(values){
  const result={};
  for(let index=0;index<values.length;index+=2){
    const key=values[index],value=values[index+1];
    if(!key?.startsWith('--')||value===undefined)throw Error('Named operator arguments are required');
    result[key.slice(2)]=value;
  }
  return result;
}

const args=argumentsOf(process.argv.slice(2));
if(process.platform!=='linux')throw Error('Hosted Linux operator required');
if(!args.config||!args['backup-path']||!args.approved||!args.phase)throw Error('Config, backup path, phase and exact phase approval are required');
if(!PHASES.has(args.phase))throw Error('Unknown operator phase');
const config=JSON.parse(fs.readFileSync(args.config,'utf8'));
const required=['root','domain','base','candidate','zip','manifest','version','baselineVersion','baselineCommit','commit','archiveHash','manifestHash','expectedDatabase','expectedRole','baselineMigrationCount','expectedMigrationCount','expectedTableCount','expectedTableNames','expectedPostTableCount','expectedPostTableNames','baselineTriggers','expectedTriggerCount','expectedTriggerContractSha256','schemaContractHelperPath','schemaContractHelperSha256','baselineSchemaContractManifestSha256','expectedSchemaContractManifestSha256','expectedTriggerDriftDataChecks','expectedTestPassed','totalTimeoutMinutes','backupFreshnessMinutes','smokeWindowSeconds'];
for(const key of required)if(config[key]===undefined||config[key]===null||config[key]==='')throw Error(`Missing operator configuration: ${key}`);
if(args.approved!==`${config.commit}:${args.phase}`||!/^[a-f0-9]{40}$/.test(config.commit))throw Error('Exact approved commit and phase mismatch');
if(!path.isAbsolute(args['backup-path']))throw Error('Backup path must be absolute');
if(config.root!=='/home/nysareal/nysa-core-dashboard-dd6262a-stage'||config.domain!=='crm-test.nysarealty.com')throw Error('CRM Test target identity mismatch');
if(config.schemaContractHelperPath!=='/home/nysareal/crm-deployment-tools/tools/database-schema-contract.mjs')throw Error('Schema-contract helper path identity mismatch');
if(!/^[a-f0-9]{64}$/.test(config.schemaContractHelperSha256))throw Error('Schema-contract helper SHA-256 is invalid');
if(Number(config.smokeWindowSeconds)<30||Number(config.smokeWindowSeconds)>60)throw Error('Smoke retry window must be between 30 and 60 seconds');
normalizeExpectedTriggerContract(config.baselineTriggers,{label:'baseline trigger'});
const migrationNeutral=config.baselineMigrationCount===config.expectedMigrationCount;
if(migrationNeutral&&config.baselineSchemaContractManifestSha256!==config.expectedSchemaContractManifestSha256)throw Error('Migration-neutral schema contracts must match');
if(migrationNeutral&&!/^[a-f0-9]{64}$/.test(config.baselineRuntimeManifestSha256))throw Error('Migration-neutral release requires the approved installed runtime manifest hash');
if(!Array.isArray(config.expectedTriggerDriftDataChecks))throw Error('Expected trigger-drift data-check baseline must be an array');

const startedAt=Date.now();
const deadline=startedAt+Number(config.totalTimeoutMinutes)*60_000;
const remaining=()=>{
  const value=deadline-Date.now();
  if(value<=0)throw Error('Operator phase time limit exceeded');
  return value;
};
const commandTimeout=preferred=>Math.max(1000,Math.min(preferred,remaining()));
const run=(command,values,timeout=15*60_000,options={})=>execFileSync(command,values,{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024,timeout:commandTimeout(timeout),killSignal:'SIGTERM',...options});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashStream=file=>new Promise((resolve,reject)=>{
  const digest=crypto.createHash('sha256'),stream=fs.createReadStream(file);
  stream.on('error',reject);digest.on('error',reject);stream.on('data',chunk=>digest.update(chunk));stream.on('end',()=>resolve(digest.digest('hex')));
});
const evidencePath=name=>path.join(config.base,name);
const write=(name,value,options={})=>fs.writeFileSync(evidencePath(name),`${JSON.stringify(value,null,2)}\n`,{mode:0o600,...options});
const read=name=>JSON.parse(fs.readFileSync(evidencePath(name),'utf8'));
const requireAbsent=name=>{if(fs.existsSync(evidencePath(name)))throw Error(`${name} must not pre-exist`);};
const safeError=error=>String(error?.message||'').startsWith('Command failed:')?'External command failed':String(error?.message||'Unknown failure').slice(0,240);

function registration(){
  const json=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',config.domain])),found=[];
  function walk(value){if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(key===config.root||key===path.basename(config.root))found.push(item);else if(key!=='env_vars')walk(item);}}
  walk(json);
  if(found.length!==1||found[0].domain!==config.domain)throw Error('Registration identity mismatch');
  return found[0];
}
function selector(action,extra=[]){run('cloudlinux-selector',[action,'--json','--interpreter','nodejs','--domain',config.domain,'--app-root',path.basename(config.root),...extra],5*60_000);}
const assertStopped=async()=>registration().app_status==='stopped';
async function stop(){
  try{selector('stop');}catch(error){if(!await assertStopped())throw error;}
  return stopVerifiedWorkers(config.root,{assertStopped});
}
function runtimeNames(directory){
  return fs.readFileSync(path.join(directory,'RUNTIME_MANIFEST.sha256'),'utf8').trim().split(/\r?\n/).map(line=>{
    const match=line.match(/^([a-f0-9]{64})  (.+)$/),name=match?.[2];
    if(!match||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..') )throw Error('Invalid runtime manifest entry');
    const file=path.join(directory,name);
    const observed=fs.existsSync(file)?hash(file):'missing';
    if(observed!==match[1])throw Error(`Runtime manifest mismatch: ${name}; expected ${match[1]}, observed ${observed}`);
    return name;
  });
}
function poolFor(environment){
  const {Pool}=createRequire(path.join(config.root,'package.json'))('pg');
  return new Pool({host:environment.PGHOST||'localhost',port:Number(environment.PGPORT||5432),database:environment.PGDATABASE,user:environment.PGUSER,password:environment.PGPASSWORD,max:1});
}
async function ledger(pool,expectedMigrationCount){
  const row=(await pool.query('SELECT current_database() AS db,current_user AS role,COUNT(*)::int AS count FROM schema_migrations')).rows[0];
  if(row.db!==config.expectedDatabase||row.role!==config.expectedRole||row.count!==Number(expectedMigrationCount))throw Error(`CRM Test database identity or ledger mismatch: expected ${expectedMigrationCount}, observed ${row.count}`);
  return row;
}
async function compareTableNames(pool,{expectedNames,expectedCount,label}){
  if(!Array.isArray(expectedNames)||expectedNames.length!==Number(expectedCount)||new Set(expectedNames).size!==expectedNames.length||expectedNames.some((name,index)=>!/^[a-z0-9_]+$/.test(name)||(index>0&&expectedNames[index-1]>=name)))throw Error(`Expected ${label} CRM Test table-name baseline is invalid`);
  const sql="SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",observedNames=(await pool.query(sql)).rows.map(row=>row.tablename);
  const expectedCanonical=`${expectedNames.join('\n')}\n`,observedCanonical=`${observedNames.join('\n')}\n`;
  const extra=observedNames.filter(name=>!expectedNames.includes(name)),missing=expectedNames.filter(name=>!observedNames.includes(name));
  return {sql,label,expectedCount:Number(expectedCount),observedCount:observedNames.length,expectedNamesSha256:crypto.createHash('sha256').update(expectedCanonical).digest('hex'),observedNamesSha256:crypto.createHash('sha256').update(observedCanonical).digest('hex'),extra,missing,matches:observedNames.length===Number(expectedCount)&&extra.length===0&&missing.length===0&&expectedCanonical===observedCanonical,observedNames};
}
function candidateTriggerContract(){
  const file=path.join(config.candidate,'src/database-trigger-contract.json'),contract=JSON.parse(fs.readFileSync(file,'utf8'));
  if(contract.schema!=='nysa.database-trigger-contract.v1'||contract.triggerCount!==Number(config.expectedTriggerCount)||contract.canonicalSha256!==config.expectedTriggerContractSha256)throw Error('Candidate trigger contract identity mismatch');
  if(crypto.createHash('sha256').update(JSON.stringify(contract.triggers)).digest('hex')!==contract.canonicalSha256)throw Error('Candidate trigger contract content hash mismatch');
  const triggers=normalizeExpectedTriggerContract(contract.triggers,{label:'candidate trigger'});
  if(triggers.length!==contract.triggerCount)throw Error('Candidate trigger contract count mismatch');
  return triggers;
}
async function schemaContractComparison(pool,kind,label){
  if(!['baseline','canonical'].includes(kind))throw Error('Unknown schema-contract kind');
  const usePriorSchema=kind==='baseline'&&!migrationNeutral;
  const directory=usePriorSchema?'database-schema-baseline':'database-schema-contract';
  const expectedManifestHash=kind==='baseline'?config.baselineSchemaContractManifestSha256:config.expectedSchemaContractManifestSha256;
  const contractDirectory=path.join(config.candidate,'src',directory),manifestFile=path.join(contractDirectory,'manifest.json'),helper=config.schemaContractHelperPath;
  if(!fs.existsSync(manifestFile))throw Error(`${label} schema-contract manifest file missing: ${manifestFile}`);
  const observedManifestHash=hash(manifestFile);
  if(observedManifestHash!==expectedManifestHash)throw Error(`${label} schema-contract manifest hash mismatch: expected ${expectedManifestHash}, observed ${observedManifestHash}`);
  const manifestIdentity=JSON.parse(fs.readFileSync(manifestFile,'utf8')),triggerName=manifestIdentity?.triggers?.file;
  if(typeof triggerName!=='string'||path.basename(triggerName)!==triggerName||!manifestIdentity?.triggers?.fileSha256?.match(/^[a-f0-9]{64}$/))throw Error(`${label} schema-contract trigger identity is invalid`);
  const triggerFile=usePriorSchema?path.join(contractDirectory,triggerName):path.join(config.candidate,'src',triggerName);
  if(!fs.existsSync(triggerFile))throw Error(`${label} schema-contract trigger file missing: ${triggerFile}`);
  const observedTriggerHash=hash(triggerFile);
  if(observedTriggerHash!==manifestIdentity.triggers.fileSha256)throw Error(`${label} schema-contract trigger hash mismatch: expected ${manifestIdentity.triggers.fileSha256}, observed ${observedTriggerHash}`);
  if(!fs.existsSync(helper))throw Error(`${label} schema-contract helper file missing: ${helper}`);
  const observedHelperHash=hash(helper);
  if(observedHelperHash!==config.schemaContractHelperSha256)throw Error(`${label} schema-contract helper hash mismatch: expected ${config.schemaContractHelperSha256}, observed ${observedHelperHash}`);
  const module=await import(`${pathToFileURL(helper).href}?sha256=${observedHelperHash}`);
  for(const name of ['loadSchemaContractIdentity','compareSchemaContracts','readDatabaseSchemaContract'])if(typeof module[name]!=='function')throw Error(`${label} schema-contract helper export missing: ${name}`);
  const loaded=module.loadSchemaContractIdentity({helperFile:helper,expectedHelperSha256:config.schemaContractHelperSha256,contractDirectory,manifestFile,expectedManifestSha256:expectedManifestHash,triggerContractFile:triggerFile,label:`${label} schema-contract`});
  const comparison=module.compareSchemaContracts(loaded.contract,await module.readDatabaseSchemaContract(pool));
  const receipt={label,kind,helperPath:helper,helperSha256:loaded.identity.helperSha256,manifestPath:manifestFile,manifestSha256:loaded.identity.manifestSha256,triggerContractPath:triggerFile,triggerContractSha256:loaded.identity.triggerContractSha256,matches:comparison.matches,objects:{}};
  for(const name of ['constraints','indexes','columns','functions','sequencesViews','triggers'])receipt.objects[name]={expected:comparison[name].expectedCount,observed:comparison[name].observedCount,missing:comparison[name].missing,extra:comparison[name].extra,changed:comparison[name].changed||[],matches:comparison[name].matches};
  if(!comparison.matches)throw Object.assign(Error(`${label} full schema-contract mismatch`),{schemaContractComparison:receipt});
  return receipt;
}
async function triggerComparison(pool,expected,label){
  const comparison=await compareDatabaseTriggerContract(pool,expected,{label});
  const{observedTriggers,...receipt}=comparison;
  if(!comparison.matches)throw Object.assign(Error(`${label} trigger-contract mismatch: expected ${comparison.expectedCount}, observed ${comparison.observedCount}, missing ${comparison.missing.length}, extra ${comparison.extra.length}, wrong function ${comparison.wrongFunction.length}, wrong enabled ${comparison.wrongEnabled.length}`),{triggerComparison:receipt});
  return receipt;
}
async function triggerDriftDataComparison(pool,label){
  const source=path.join(config.candidate,'src/trigger-drift-data-checks.js');
  if(!fs.existsSync(source))throw Error('Candidate trigger-drift data-check module is unavailable');
  const module=await import(`${pathToFileURL(source).href}?commit=${config.commit}`);
  const observed=await module.runTriggerDriftDataChecks(pool),comparison=module.compareTriggerDriftDataChecks(config.expectedTriggerDriftDataChecks,observed,{label});
  if(!comparison.matches)throw Object.assign(Error(`${label} governed-data mismatch: ${comparison.differences.length} check(s) differ`),{triggerDriftDataComparison:comparison});
  return comparison;
}
async function leadCounterComparison(pool,{requireSafe=true}={}){
  const sql=`WITH refs AS (
      SELECT substring(lead_reference FROM '^NYSA-LD-([0-9]{6})-[0-9]{6}$') AS period_code,
             MAX(right(lead_reference,6)::int)::int AS max_reference_number
        FROM leads
       WHERE lead_reference ~ '^NYSA-LD-[0-9]{6}-[0-9]{6}$'
       GROUP BY 1
    )
    SELECT refs.period_code,refs.max_reference_number,COALESCE(c.last_value,0)::int AS counter_value,
           (COALESCE(c.last_value,0)>=refs.max_reference_number) AS safe
      FROM refs LEFT JOIN lead_month_number_counters c USING(period_code)
     ORDER BY refs.period_code`;
  const rows=(await pool.query(sql)).rows,mismatches=rows.filter(row=>!row.safe),result={sql,rows,mismatches,safe:mismatches.length===0};
  if(requireSafe&&!result.safe)throw Object.assign(Error(`Lead reference counter is behind existing references for ${mismatches.length} period(s)`),{leadCounterComparison:result});
  return result;
}
async function fingerprint(pool,tables){
  const result={};
  for(const table of tables){
    if(!/^[a-z0-9_]+$/.test(table))throw Error('Unsafe table name');
    result[table]=(await pool.query(`SELECT COUNT(*)::int AS count,md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS digest FROM public."${table}" t`)).rows[0];
  }
  return result;
}
async function readiness(expectedVersion,previousWorkers=[]){
  let last;
  for(let attempt=0;attempt<25;attempt++){
    remaining();
    try{return await verifyReadinessWorker({root:config.root,expectedVersion,previousWorkers});}
    catch(error){last=error;await sleep(500);}
  }
  throw last;
}
function databaseEnvironment(environment){
  return {...process.env,PGHOST:environment.PGHOST||'localhost',PGPORT:String(environment.PGPORT||5432),PGDATABASE:config.expectedDatabase,PGUSER:config.expectedRole,PGPASSWORD:environment.PGPASSWORD||''};
}
function validateRegistration(environment){
  if(environment.PGDATABASE!==config.expectedDatabase||environment.PGUSER!==config.expectedRole)throw Error('CRM Test registration database drift');
  if(environment.WHATSAPP_SANDBOX_ENABLED!=='false'||environment.WHATSAPP_SANDBOX_CALLBACK_APPROVED!=='false')throw Error('WhatsApp sandbox flags are not closed');
}
function validateBaseline(){
  if(JSON.parse(fs.readFileSync(path.join(config.root,'package.json'))).version!==config.baselineVersion)throw Error('Installed baseline version drift');
  if(JSON.parse(fs.readFileSync(path.join(config.root,'RELEASE_PROVENANCE.json'))).commit!==config.baselineCommit)throw Error('Installed baseline provenance drift');
  if(migrationNeutral){
    const observed=hash(path.join(config.root,'RUNTIME_MANIFEST.sha256'));
    if(observed!==config.baselineRuntimeManifestSha256)throw Error(`Installed RUNTIME_MANIFEST.sha256 drift: expected ${config.baselineRuntimeManifestSha256}, observed ${observed}`);
    runtimeNames(config.root);
  }
}
function validateCandidatePackage(){
  if(hash(config.zip)!==config.archiveHash||hash(config.manifest)!==config.manifestHash)throw Error('Candidate archive or manifest hash mismatch');
  const manifestData=JSON.parse(fs.readFileSync(config.manifest));
  if(manifestData.commit!==config.commit||manifestData.packageSha256!==config.archiveHash||manifestData.version!==config.version||manifestData.testReceipt.failed!==0||manifestData.testReceipt.passed!==Number(config.expectedTestPassed))throw Error('Candidate test or provenance receipt mismatch');
  return manifestData;
}
function validateCandidateDirectory(){
  const provenance=JSON.parse(fs.readFileSync(path.join(config.candidate,'RELEASE_PROVENANCE.json'),'utf8'));
  if(provenance.commit!==config.commit||provenance.version!==config.version||provenance.migrationCount!==Number(config.expectedMigrationCount)||provenance.testReceipt.failed!==0)throw Error('Candidate provenance mismatch');
  return runtimeNames(config.candidate);
}
function assertReceipt(name,result){
  const receipt=read(name);
  if(receipt.result!==result||receipt.commit!==config.commit||receipt.version!==config.version||receipt.configSha256!==hash(args.config))throw Error(`${name} does not authorize this phase`);
  return receipt;
}
function scopedBackupDirectory(){
  const resolved=resolveScopedBackupPath(args['backup-path'],{appRoot:config.root});
  if(fs.existsSync(resolved))throw Error('Scoped backup directory must not pre-exist');
  fs.mkdirSync(resolved,{recursive:true,mode:0o700});
  return resolved;
}
async function createAndVerifyScopedBackup(environment,report){
  const directory=scopedBackupDirectory(),appArchive=path.join(directory,'crm-test-app.tar.gz'),databaseDump=path.join(directory,`${config.expectedDatabase}.dump`),databaseEnv=databaseEnvironment(environment);
  const livePool=poolFor(environment);let liveTableNames,serverVersionNumber;
  try{
    report.tableComparison=await compareTableNames(livePool,{expectedNames:config.expectedTableNames,expectedCount:config.expectedTableCount,label:'pre-deployment'});
    report.triggerComparison=await triggerComparison(livePool,config.baselineTriggers,'pre-deployment');
    report.triggerDriftDataComparison=await triggerDriftDataComparison(livePool,'pre-deployment');
    report.schemaContractComparison=await schemaContractComparison(livePool,'baseline','pre-deployment');
    report.leadCounterComparison=await leadCounterComparison(livePool);
    liveTableNames=report.tableComparison.observedNames;
    serverVersionNumber=Number((await livePool.query('SHOW server_version_num')).rows[0].server_version_num);
  }finally{await livePool.end();}
  const {observedNames:ignoredObservedNames,...tableComparisonReceipt}=report.tableComparison;report.tableComparison=tableComparisonReceipt;
  if(!report.tableComparison.matches)throw Error(`Live CRM Test table-name drift: expected ${report.tableComparison.expectedCount}, observed ${report.tableComparison.observedCount}, extra ${report.tableComparison.extra.length}, missing ${report.tableComparison.missing.length}`);
  const liveTableCount=liveTableNames.length;
  const pgDumpVersion=run('pg_dump',['--version'],60_000,{env:databaseEnv}).toString().trim(),pgRestoreVersion=run('pg_restore',['--version'],60_000,{env:databaseEnv}).toString().trim();
  const clientMajor=Number(pgDumpVersion.match(/PostgreSQL\)\s+(\d+)(?:\.\d+)?/)?.[1]),restoreMajor=Number(pgRestoreVersion.match(/PostgreSQL\)\s+(\d+)(?:\.\d+)?/)?.[1]),serverMajor=Math.floor(serverVersionNumber/10_000);
  if(!clientMajor||!restoreMajor||!serverMajor||clientMajor<serverMajor||restoreMajor<serverMajor)throw Error('PostgreSQL backup client is older than the CRM Test server');
  const manifestBefore=hash(path.join(config.root,'RUNTIME_MANIFEST.sha256'));
  run('tar',['-czf',appArchive,'-C',path.dirname(config.root),path.basename(config.root)],30*60_000);
  run('pg_dump',['--format=custom','--no-owner','--no-privileges','--file',databaseDump,config.expectedDatabase],30*60_000,{env:databaseEnv});
  if(hash(path.join(config.root,'RUNTIME_MANIFEST.sha256'))!==manifestBefore)throw Error('Installed runtime changed while the scoped backup was created');
  const appStat=fs.statSync(appArchive),databaseStat=fs.statSync(databaseDump);
  if(!appStat.isFile()||appStat.size<1024*1024||!databaseStat.isFile()||databaseStat.size<4096)throw Error('Scoped rollback backup is empty or incomplete');
  const entries=run('tar',['-tzf',appArchive],30*60_000).toString();
  const appPrefix=`${path.basename(config.root)}/`,appIncluded=entries.includes(`${appPrefix}package.json`)&&entries.includes(`${appPrefix}RUNTIME_MANIFEST.sha256`);
  const dumpList=run('pg_restore',['--list',databaseDump],10*60_000,{env:databaseEnv}).toString(),parsedDump=parsePgRestoreListContracts(dumpList),dumpTableNames=parsedDump.tableNames,dumpTriggerKeys=new Set(parsedDump.triggerKeys);
  const tableSetVerification=verifyScopedBackupTableNames(liveTableNames,dumpTableNames),databaseIncluded=dumpTableNames.includes('schema_migrations')&&tableSetVerification.matches;
  const expectedTriggerKeys=new Set(normalizeExpectedTriggerContract(config.baselineTriggers,{label:'backup trigger'}).map(item=>`${item.table}\0${item.name}`)),missingDumpTriggers=[...expectedTriggerKeys].filter(key=>!dumpTriggerKeys.has(key)),extraDumpTriggers=[...dumpTriggerKeys].filter(key=>!expectedTriggerKeys.has(key)),dumpTriggerContractVerified=missingDumpTriggers.length===0&&extraDumpTriggers.length===0;
  if(!appIncluded||!databaseIncluded||!dumpTriggerContractVerified)throw Error('Scoped rollback backup content verification failed');
  const receipt={scope:'CRM Test application root and database only',directory,createdAt:new Date().toISOString(),app:{path:appArchive,bytes:appStat.size,sha256:await hashStream(appArchive),contentsVerified:appIncluded,runtimeManifestSha256:manifestBefore},database:{path:databaseDump,name:config.expectedDatabase,format:'PostgreSQL custom',bytes:databaseStat.size,sha256:await hashStream(databaseDump),consistentSnapshot:'PostgreSQL pg_dump MVCC snapshot',pgDumpVersion,pgRestoreVersion,serverVersionNumber,clientCompatible:clientMajor>=serverMajor&&restoreMajor>=serverMajor,tableComparison:report.tableComparison,triggerComparison:report.triggerComparison,schemaContractComparison:report.schemaContractComparison,triggerDriftDataComparison:report.triggerDriftDataComparison,leadCounterComparison:report.leadCounterComparison,liveTableCount,dumpTableCount:dumpTableNames.length,dumpTableNamesSha256:tableSetVerification.dumpNamesSha256,backupTableSetVerification:tableSetVerification,liveTriggerCount:expectedTriggerKeys.size,dumpTriggerCount:dumpTriggerKeys.size,dumpTriggerContractVerified,missingDumpTriggers,extraDumpTriggers,contentsVerified:databaseIncluded&&dumpTriggerContractVerified},verifiedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(directory,'SCOPED_BACKUP_VERIFIED.json'),`${JSON.stringify(receipt,null,2)}\n`,{mode:0o600});
  return receipt;
}
function loadVerifiedBackup(){
  const directory=resolveScopedBackupPath(args['backup-path'],{appRoot:config.root}),receiptFile=path.join(directory,'SCOPED_BACKUP_VERIFIED.json');
  if(!fs.existsSync(receiptFile))throw Error('Verified scoped backup receipt is unavailable');
  const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(receipt.directory!==directory||receipt.database.name!==config.expectedDatabase||hash(receipt.app.path)!==receipt.app.sha256||hash(receipt.database.path)!==receipt.database.sha256||!receipt.app.contentsVerified||!receipt.database.contentsVerified)throw Error('Scoped backup receipt or content mismatch');
  const ageMinutes=(Date.now()-Date.parse(receipt.verifiedAt))/60_000;
  if(!Number.isFinite(ageMinutes)||ageMinutes<0||ageMinutes>Number(config.backupFreshnessMinutes))throw Error(`Scoped backup is outside the approved freshness window: ${ageMinutes.toFixed(1)} minutes`);
  return receipt;
}
function restoreApplicationBackup(receipt){
  if(!receipt?.app?.path)throw Error('Verified application rollback receipt is unavailable');
  const parent=path.dirname(config.root),failedRoot=`${config.root}.failed-${Date.now()}`;
  if(fs.existsSync(failedRoot))throw Error('Rollback quarantine path already exists');
  fs.renameSync(config.root,failedRoot);
  try{run('tar',['-xzf',receipt.app.path,'-C',parent],30*60_000);}
  catch(error){if(fs.existsSync(config.root))fs.rmSync(config.root,{recursive:true,force:true});fs.renameSync(failedRoot,config.root);throw error;}
  return {appRestoredFrom:receipt.app.path,databaseRestorePerformed:false,failedRuntimeRetained:failedRoot};
}
function privateRegistrationFile(){return evidencePath('ORIGINAL_REGISTRATION_PRIVATE.json');}
function writeOriginalRegistration(original){
  if(fs.existsSync(privateRegistrationFile()))throw Error('Original selector registration receipt must not pre-exist');
  fs.writeFileSync(privateRegistrationFile(),`${JSON.stringify({domain:config.domain,root:config.root,appStatus:original.app_status,env_vars:original.env_vars||{}},null,2)}\n`,{mode:0o600});
}
function restoreOriginalEnvironment(){
  const saved=JSON.parse(fs.readFileSync(privateRegistrationFile(),'utf8'));
  if(saved.domain!==config.domain||saved.root!==config.root)throw Error('Original selector environment identity mismatch');
  selector('set',['--env-vars',JSON.stringify(saved.env_vars)]);
  return {domain:saved.domain,root:saved.root,appStatus:saved.appStatus,environmentRestored:true};
}
function simulatorEnvironment(original){
  const liveKeys=['WHATSAPP_API_KEY','META_WHATSAPP_ACCESS_TOKEN','LEAD_WHATSAPP_API_KEY','D360_API_KEY'];
  if(liveKeys.some(name=>String(original[name]||'').trim()))throw Error('Live WhatsApp credential is present; simulator environment refused');
  const port=String(original.PORT||'3000');
  return {...original,LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true',WHATSAPP_SIMULATED_PROVIDER_URL:`http://127.0.0.1:${port}/api/providers/whatsapp-simulated`,WHATSAPP_SIMULATED_PROVIDER_TOKEN:crypto.randomBytes(32).toString('hex'),WHATSAPP_SIMULATED_PHONE_PREFIX:'+971509',WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS:'6'};
}
function sanitizeSnippet(value){return String(value).replace(/[\r\n\t]+/g,' ').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,256);}
async function requestEvidence(url,expected,{requireCore=false,expectedVersion=null,timeoutMs=5000}={}){
  const started=new Date().toISOString(),startedMs=Date.now();
  try{
    const response=await fetch(`https://${config.domain}${url}`,{redirect:'manual',signal:AbortSignal.timeout(Math.max(1,Math.min(timeoutMs,remaining())))}),text=await response.text();
    let semanticMatch=true;if(requireCore)semanticMatch=/NYSA\s+CORE/i.test(text);if(expectedVersion)semanticMatch=semanticMatch&&text.includes(expectedVersion);
    return {url,startedAt:started,completedAt:new Date().toISOString(),durationMs:Date.now()-startedMs,expectedStatus:expected,actualStatus:response.status,server:response.headers.get('server')||null,contentType:response.headers.get('content-type')||null,bodySnippet:sanitizeSnippet(text),bodySha256:crypto.createHash('sha256').update(text).digest('hex'),passed:response.status===expected&&semanticMatch};
  }catch(error){return {url,startedAt:started,completedAt:new Date().toISOString(),durationMs:Date.now()-startedMs,expectedStatus:expected,errorName:error.name,errorCode:error.code||null,safeError:safeError(error),passed:false};}
}
async function verifyDomainBaseline(version){
  const checks=[];for(const specification of [['/api/health',200,{}],['/api/readiness',200,{expectedVersion:version}],['/',200,{requireCore:true}]])checks.push(await requestEvidence(specification[0],specification[1],specification[2]));
  if(checks.some(check=>!check.passed))throw Object.assign(Error('Rollback domain verification failed'),{checks});
  const worker=await readiness(version),workers=inspectWorkers(config.root);if(workers.length!==1)throw Error('Rollback exact-root worker count is not one');
  return {checks,worker,workers};
}
async function rollbackAfterInstallFailure({receipt,report}){
  try{
    await stop();report.applicationRestore=restoreApplicationBackup(receipt);report.selectorEnvironmentRestore=restoreOriginalEnvironment();selector('start');report.rollbackVerification=await verifyDomainBaseline(config.baselineVersion);report.databaseRestorePerformed=false;report.databaseStatePreserved=true;report.result='ROLLED_BACK_APPLICATION_AND_DOMAIN_VERIFIED';
  }catch(error){report.rollbackError=safeError(error);if(error.checks)report.rollbackDomainChecks=error.checks;report.result='ROLLBACK_REQUIRES_ATTENTION';}
}

fs.mkdirSync(config.base,{recursive:true,mode:0o700});
const baseReport={phase:args.phase,root:config.root,domain:config.domain,commit:config.commit,version:config.version,configSha256:hash(args.config),backupPath:path.resolve(args['backup-path']),startedAt:new Date(startedAt).toISOString(),productionMutation:false,websiteMutation:false,remMutation:false};

async function stagePhase(){
  requireAbsent('STAGE_RESULT.json');const report={...baseReport,result:'FAILED'};
  try{
    const original=registration(),environment=original.env_vars||{};validateRegistration(environment);validateBaseline();const manifestData=validateCandidatePackage(),entries=run('unzip',['-Z1',config.zip]).toString().trim().split('\n');
    if(entries.length!==manifestData.entryCount||entries.some(entry=>entry.startsWith('/')||entry.includes('\\')||entry.split('/').includes('..')))throw Error('Unsafe candidate archive');
    if(fs.existsSync(config.candidate))throw Error('Candidate staging directory must not pre-exist');fs.mkdirSync(config.candidate,{mode:0o700});run('unzip',['-q',config.zip,'-d',config.candidate],5*60_000);
    const candidateNames=validateCandidateDirectory();report.candidateFiles=candidateNames.length;
    if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(config.candidate,'package.json'))).dependencies)!==JSON.stringify(JSON.parse(fs.readFileSync(path.join(config.root,'package.json'))).dependencies))throw Error('Unapproved dependency change');
    const dependencies=fs.realpathSync(path.join(config.root,'node_modules'));if(dependencies!==`/home/nysareal/nodevenv/${path.basename(config.root)}/24/lib/node_modules`)throw Error('Dependency identity mismatch');fs.symlinkSync(dependencies,path.join(config.candidate,'node_modules'),'dir');
    process.env.PDF_RENDER_RUNTIME_DIR=path.join(config.root,'tmp/pdf-renderer');process.chdir(config.candidate);const {verifyApprovedDocumentRuntime}=await import(pathToFileURL(path.join(config.candidate,'src/approved-document-runtime-smoke.js')));report.candidatePdfFormats=await verifyApprovedDocumentRuntime();
    const expectedCandidateTriggers=candidateTriggerContract();report.candidateTriggerCount=expectedCandidateTriggers.length;
    const pool=poolFor(environment);try{report.stageLedger=await ledger(pool,config.baselineMigrationCount);const comparison=await compareTableNames(pool,{expectedNames:config.expectedTableNames,expectedCount:config.expectedTableCount,label:'stage'});const{observedNames,...receipt}=comparison;report.tableComparison=receipt;if(!comparison.matches)throw Error('Stage table-name baseline mismatch');report.triggerComparison=await triggerComparison(pool,config.baselineTriggers,'stage');report.schemaContractComparison=await schemaContractComparison(pool,'baseline','stage');report.triggerDriftDataComparison=await triggerDriftDataComparison(pool,'stage');report.leadCounterComparison=await leadCounterComparison(pool);}finally{await pool.end();}
    report.workers=inspectInstallWorkers(config.root);report.result='STAGED_AND_VERIFIED';
  }catch(error){report.safeError=safeError(error);if(error.triggerComparison)report.triggerComparison=error.triggerComparison;if(error.schemaContractComparison)report.schemaContractComparison=error.schemaContractComparison;if(error.triggerDriftDataComparison)report.triggerDriftDataComparison=error.triggerDriftDataComparison;if(error.leadCounterComparison)report.leadCounterComparison=error.leadCounterComparison;process.exitCode=1;}
  report.completedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.now()-startedAt)/1000);write('STAGE_RESULT.json',report);console.log(JSON.stringify(report));
}

async function backupPhase(){
  assertReceipt('STAGE_RESULT.json','STAGED_AND_VERIFIED');requireAbsent('BACKUP_RESULT.json');const report={...baseReport,result:'FAILED'};
  try{const original=registration(),environment=original.env_vars||{};validateRegistration(environment);validateBaseline();validateCandidatePackage();validateCandidateDirectory();candidateTriggerContract();const pool=poolFor(environment);try{report.ledger=await ledger(pool,config.baselineMigrationCount);report.triggerComparison=await triggerComparison(pool,config.baselineTriggers,'backup');report.schemaContractComparison=await schemaContractComparison(pool,'baseline','backup');report.triggerDriftDataComparison=await triggerDriftDataComparison(pool,'backup');report.leadCounterComparison=await leadCounterComparison(pool);}finally{await pool.end();}report.backup=await createAndVerifyScopedBackup(environment,report);report.result='SCOPED_BACKUP_VERIFIED';}
  catch(error){report.safeError=safeError(error);if(error.triggerComparison)report.triggerComparison=error.triggerComparison;if(error.schemaContractComparison)report.schemaContractComparison=error.schemaContractComparison;if(error.triggerDriftDataComparison)report.triggerDriftDataComparison=error.triggerDriftDataComparison;if(error.leadCounterComparison)report.leadCounterComparison=error.leadCounterComparison;process.exitCode=1;}
  report.completedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.now()-startedAt)/1000);write('BACKUP_RESULT.json',report);console.log(JSON.stringify(report));
}

async function installPhase(){
  assertReceipt('STAGE_RESULT.json','STAGED_AND_VERIFIED');assertReceipt('BACKUP_RESULT.json','SCOPED_BACKUP_VERIFIED');requireAbsent('INSTALL_RESULT.json');const report={...baseReport,result:'FAILED'};let mutated=false,readinessAccepted=false,environment,backup;
  try{
    backup=loadVerifiedBackup();const original=registration();environment=original.env_vars||{};validateRegistration(environment);validateBaseline();validateCandidatePackage();const candidateNames=validateCandidateDirectory();writeOriginalRegistration(original);report.workersBefore=inspectInstallWorkers(config.root);report.workerStop=await stop();if(!await assertStopped()||inspectWorkers(config.root).length!==0)throw Error('Exact-root quiescence failed');
    const expectedCandidateTriggers=candidateTriggerContract();
    const pool=poolFor(environment);try{await ledger(pool,config.baselineMigrationCount);report.preInstallTriggerComparison=await triggerComparison(pool,config.baselineTriggers,'pre-install');report.preInstallSchemaContractComparison=await schemaContractComparison(pool,'baseline','pre-install');report.preInstallTriggerDriftDataComparison=await triggerDriftDataComparison(pool,'pre-install');report.preInstallLeadCounterComparison=await leadCounterComparison(pool);const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename")).rows.map(row=>row.tablename),before=await fingerprint(pool,tables);write('ORIGINAL_TABLE_FINGERPRINTS.json',before);const changed=[];for(const name of [...candidateNames,'RUNTIME_MANIFEST.sha256']){remaining();const source=path.join(config.candidate,name),target=path.join(config.root,name);if(fs.existsSync(target)&&hash(source)===hash(target))continue;changed.push({name,existed:fs.existsSync(target)});fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.copyFileSync(source,target);mutated=true;}write('CHANGED_RUNTIME.json',changed);runtimeNames(config.root);report.changedFiles=changed.length;await ledger(pool,config.baselineMigrationCount);const after=await fingerprint(pool,tables);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Original CRM Test table data changed before application start');report.originalTablesPreserved=tables.length;}finally{await pool.end();}
    const nextEnvironment=simulatorEnvironment(environment);mutated=true;selector('set',['--env-vars',JSON.stringify(nextEnvironment)]);report.simulatorEnvironment={LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true',WHATSAPP_SIMULATED_PROVIDER_URL:'loopback',WHATSAPP_SIMULATED_PROVIDER_TOKEN:'server-generated and withheld',WHATSAPP_SIMULATED_PHONE_PREFIX:'+971509',WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS:'6'};
    process.chdir(config.root);process.env.PDF_RENDER_RUNTIME_DIR=path.join(config.root,'tmp/pdf-renderer');const {verifyApprovedDocumentRuntime}=await import(pathToFileURL(path.join(config.root,'src/approved-document-runtime-smoke.js')));report.installedPdfFormats=await verifyApprovedDocumentRuntime();selector('start');report.readiness=await readiness(config.version,report.workersBefore);readinessAccepted=true;report.readinessAcceptedAt=new Date().toISOString();report.runtimeFiles=runtimeNames(config.root).length;
    const verificationPool=poolFor(nextEnvironment);try{report.ledger=await ledger(verificationPool,config.expectedMigrationCount);const comparison=await compareTableNames(verificationPool,{expectedNames:config.expectedPostTableNames,expectedCount:config.expectedPostTableCount,label:'post-deployment'});const{observedNames,...receipt}=comparison;report.postDeploymentTableComparison=receipt;if(!comparison.matches)throw Error('Post-deployment table-name mismatch');report.postDeploymentTriggerComparison=await triggerComparison(verificationPool,expectedCandidateTriggers,'post-deployment');report.postDeploymentSchemaContractComparison=await schemaContractComparison(verificationPool,'canonical','post-deployment');report.postDeploymentTriggerDriftDataComparison=await triggerDriftDataComparison(verificationPool,'post-deployment');report.postDeploymentLeadCounterComparison=await leadCounterComparison(verificationPool);}finally{await verificationPool.end();}
    report.workersAfter=inspectWorkers(config.root);if(report.workersAfter.length!==1)throw Error('Post-readiness exact-root worker count is not one');report.result='INSTALLED_STARTED_AND_READY';
  }catch(error){
    report.safeError=safeError(error);
    if(error.triggerComparison)report.failedTriggerComparison=error.triggerComparison;
    if(error.schemaContractComparison)report.failedSchemaContractComparison=error.schemaContractComparison;
    if(error.triggerDriftDataComparison)report.failedTriggerDriftDataComparison=error.triggerDriftDataComparison;
    if(error.leadCounterComparison)report.failedLeadCounterComparison=error.leadCounterComparison;
    report.readinessAccepted=readinessAccepted;
    if(readinessAccepted)report.result='POST_READINESS_CHECK_FAILED_APP_PRESERVED';
    else{
      let shouldRollback=mutated;
      if(!shouldRollback&&backup&&environment){try{shouldRollback=registration().app_status==='stopped'||inspectWorkers(config.root).length===0;}catch{shouldRollback=true;}}
      if(shouldRollback&&backup&&environment)await rollbackAfterInstallFailure({receipt:backup,report});
    }
    process.exitCode=1;
  }
  report.completedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.now()-startedAt)/1000);write('INSTALL_RESULT.json',report);console.log(JSON.stringify(report));
}

async function smokePhase(){
  assertReceipt('INSTALL_RESULT.json','INSTALLED_STARTED_AND_READY');requireAbsent('SMOKE_RESULT.json');const report={...baseReport,result:'FAILED',attempts:[]};
  try{
    const original=registration(),environment=original.env_vars||{};validateRegistration(environment);if(environment.LEAD_RESPONSE_ENVIRONMENT!=='crm-test'||environment.WHATSAPP_SIMULATED_PROVIDER_ENABLED!=='true'||!String(environment.WHATSAPP_SIMULATED_PROVIDER_TOKEN||'').match(/^.{32,}$/)||!String(environment.WHATSAPP_SIMULATED_PROVIDER_URL||'').startsWith('http://127.0.0.1:'))throw Error('CRM Test simulator environment is incomplete');
    const specifications=[['/',200,{requireCore:true}],['/api/health',200,{}],['/api/readiness',200,{expectedVersion:config.version}],['/api/me',401,{}],['/api/crm/whatsapp-workspace',401,{}],['/api/crm/dashboard',401,{}],['/api/crm/tasks',401,{}],['/api/providers/whatsapp-simulated/health',401,{}]],pending=new Map(specifications.map(item=>[item[0],item])),smokeDeadline=Date.now()+Number(config.smokeWindowSeconds)*1000;await sleep(Math.min(5000,Math.max(0,smokeDeadline-Date.now())));let round=0;
    while(pending.size&&Date.now()<smokeDeadline){round+=1;for(const[url,specification]of [...pending]){const attempt=await requestEvidence(specification[0],specification[1],{...specification[2],timeoutMs:Math.min(5000,smokeDeadline-Date.now())});attempt.round=round;report.attempts.push(attempt);if(attempt.passed)pending.delete(url);if(Date.now()>=smokeDeadline)break;}if(pending.size&&Date.now()<smokeDeadline)await sleep(Math.min(5000,smokeDeadline-Date.now()));}
    report.smokeWindowSeconds=Number(config.smokeWindowSeconds);report.pending=[...pending.keys()];report.workers=inspectWorkers(config.root);if(report.workers.length!==1)throw Error('Settled-smoke exact-root worker count is not one');if(pending.size){report.result='SMOKE_FAILED_HEALTHY_APP_PRESERVED';process.exitCode=1;}else report.result='SETTLED_SMOKE_PASSED';
  }catch(error){report.safeError=safeError(error);process.exitCode=1;}
  report.completedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.now()-startedAt)/1000);write('SMOKE_RESULT.json',report);console.log(JSON.stringify(report));
}

if(args.phase==='stage')await stagePhase();
else if(args.phase==='backup')await backupPhase();
else if(args.phase==='install')await installPhase();
else await smokePhase();
