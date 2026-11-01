import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {inspectWorkers,stopVerifiedWorkers,verifyReadinessWorker} from './hosted-worker-lifecycle.mjs';

process.umask(0o077);

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
if(!args.config||!args['backup-path']||!args.approved)throw Error('Config, backup path and exact approval are required');
const config=JSON.parse(fs.readFileSync(args.config,'utf8'));
const required=['root','domain','base','candidate','zip','manifest','version','baselineVersion','baselineCommit','commit','archiveHash','manifestHash','expectedDatabase','expectedRole','expectedMigrationCount','expectedTestPassed','backupMaxAgeMinutes','totalTimeoutMinutes'];
for(const key of required)if(config[key]===undefined||config[key]===null||config[key]==='')throw Error(`Missing operator configuration: ${key}`);
if(args.approved!==config.commit||!/^[a-f0-9]{40}$/.test(config.commit))throw Error('Exact approved commit mismatch');
if(!path.isAbsolute(args['backup-path']))throw Error('Backup path must be absolute');
if(config.root!=='/home/nysareal/nysa-core-dashboard-dd6262a-stage'||config.domain!=='crm-test.nysarealty.com')throw Error('CRM Test target identity mismatch');

const startedAt=Date.now();
const deadline=startedAt+Number(config.totalTimeoutMinutes)*60_000;
const remaining=()=>{
  const value=deadline-Date.now();
  if(value<=0)throw Error('Operator total time limit exceeded');
  return value;
};
const commandTimeout=preferred=>Math.max(1000,Math.min(preferred,remaining()));
const run=(command,values,timeout=15*60_000)=>execFileSync(command,values,{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024,timeout:commandTimeout(timeout),killSignal:'SIGTERM'});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashStream=file=>new Promise((resolve,reject)=>{
  const digest=crypto.createHash('sha256'),stream=fs.createReadStream(file);
  stream.on('error',reject);digest.on('error',reject);stream.on('data',chunk=>digest.update(chunk));stream.on('end',()=>resolve(digest.digest('hex')));
});
const write=(name,value)=>fs.writeFileSync(path.join(config.base,name),`${JSON.stringify(value,null,2)}\n`);

function registration(){
  const json=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',config.domain])),found=[];
  function walk(value){if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(key===config.root||key===path.basename(config.root))found.push(item);else if(key!=='env_vars')walk(item);}}
  walk(json);
  if(found.length!==1||found[0].domain!==config.domain)throw Error('Registration identity mismatch');
  return found[0];
}
function selector(action){run('cloudlinux-selector',[action,'--json','--interpreter','nodejs','--domain',config.domain,'--app-root',path.basename(config.root)],5*60_000);}
const assertStopped=async()=>registration().app_status==='stopped';
async function stop(){
  try{selector('stop');}catch(error){if(!await assertStopped())throw error;}
  return stopVerifiedWorkers(config.root,{assertStopped});
}
function runtimeNames(directory){
  return fs.readFileSync(path.join(directory,'RUNTIME_MANIFEST.sha256'),'utf8').trim().split(/\r?\n/).map(line=>{
    const match=line.match(/^([a-f0-9]{64})  (.+)$/),name=match?.[2];
    if(!match||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||hash(path.join(directory,name))!==match[1])throw Error('Runtime manifest mismatch');
    return name;
  });
}
function poolFor(environment){
  const {Pool}=createRequire(path.join(config.root,'package.json'))('pg');
  return new Pool({host:environment.PGHOST||'localhost',port:Number(environment.PGPORT||5432),database:environment.PGDATABASE,user:environment.PGUSER,password:environment.PGPASSWORD,max:1});
}
async function ledger(pool){
  const row=(await pool.query('SELECT current_database() AS db,current_user AS role,COUNT(*)::int AS count FROM schema_migrations')).rows[0];
  if(row.db!==config.expectedDatabase||row.role!==config.expectedRole||row.count!==Number(config.expectedMigrationCount))throw Error('CRM Test database identity or ledger mismatch');
  return row;
}
async function fingerprint(pool,tables){
  const result={};
  for(const table of tables){
    if(!/^[a-z0-9_]+$/.test(table))throw Error('Unsafe table name');
    result[table]=(await pool.query(`SELECT COUNT(*)::int AS count,md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS digest FROM public."${table}" t`)).rows[0];
  }
  return result;
}
async function readiness(expectedVersion){
  let last;
  for(let attempt=0;attempt<25;attempt++){
    remaining();
    try{return await verifyReadinessWorker({root:config.root,expectedVersion});}
    catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,500));}
  }
  throw last;
}
async function verifyBackup(backupPath){
  const stat=fs.statSync(backupPath),maximumAge=Number(config.backupMaxAgeMinutes)*60_000;
  if(!stat.isFile()||stat.size<1024*1024||Date.now()-stat.mtimeMs>maximumAge)throw Error('Approved full backup is missing or outside the configured freshness window');
  const entries=run('tar',['-tzf',backupPath],30*60_000).toString();
  const appIncluded=entries.includes('homedir/nysa-core-dashboard-dd6262a-stage/package.json')&&entries.includes('homedir/nysa-core-dashboard-dd6262a-stage/RUNTIME_MANIFEST.sha256');
  const databaseIncluded=entries.includes(config.expectedDatabase);
  if(!appIncluded||!databaseIncluded)throw Error('Full backup does not contain the CRM Test application and database');
  const receipt={path:backupPath,createdAt:stat.mtime.toISOString(),bytes:stat.size,sha256:await hashStream(backupPath),appIncluded,databaseIncluded,verifiedAt:new Date().toISOString()};
  write('BACKUP_VERIFIED.json',receipt);
  return receipt;
}
function validateCleanupPath(value,currentBackup){
  const resolved=path.resolve(value);
  if(resolved===path.resolve(currentBackup))throw Error('Current rollback backup cannot be cleaned');
  const oldBackup=/^\/home\/nysareal\/[^/]*DEV260-OLD[^/]*\.tar\.gz$/i.test(resolved);
  const oldPackage=resolved.startsWith('/home/nysareal/crm-release-preparation/20261101-dev260/')&&/package\.json/i.test(path.basename(resolved));
  if(!oldBackup&&!oldPackage)throw Error(`Cleanup path is outside the DEV260 allowlist: ${resolved}`);
  return resolved;
}
function cleanAfterHealth(currentBackup){
  const cleaned=[];
  for(const value of config.cleanupPaths||[]){
    const target=validateCleanupPath(value,currentBackup);
    if(!fs.existsSync(target)){cleaned.push({path:target,status:'already absent'});continue;}
    if(!fs.statSync(target).isFile())throw Error(`Cleanup target is not a file: ${target}`);
    fs.rmSync(target);cleaned.push({path:target,status:'removed'});
  }
  return cleaned;
}

fs.mkdirSync(config.base,{recursive:true,mode:0o700});
let changed=false,restore=[];
const report={mode:'stage-and-deploy-once',root:config.root,domain:config.domain,commit:config.commit,version:config.version,startedAt:new Date(startedAt).toISOString(),productionMutation:false,websiteMutation:false,remMutation:false};
try{
  const original=registration(),environment=original.env_vars||{};
  if(environment.PGDATABASE!==config.expectedDatabase||environment.PGUSER!==config.expectedRole)throw Error('CRM Test registration database drift');
  if(environment.WHATSAPP_SANDBOX_ENABLED!=='false'||environment.WHATSAPP_SANDBOX_CALLBACK_APPROVED!=='false')throw Error('WhatsApp sending flags are not closed');
  if(JSON.parse(fs.readFileSync(path.join(config.root,'package.json'))).version!==config.baselineVersion)throw Error('Installed baseline version drift');
  if(JSON.parse(fs.readFileSync(path.join(config.root,'RELEASE_PROVENANCE.json'))).commit!==config.baselineCommit)throw Error('Installed baseline provenance drift');
  report.backup=await verifyBackup(args['backup-path']);

  if(hash(config.zip)!==config.archiveHash||hash(config.manifest)!==config.manifestHash)throw Error('Candidate archive or manifest hash mismatch');
  const manifestData=JSON.parse(fs.readFileSync(config.manifest));
  if(manifestData.commit!==config.commit||manifestData.packageSha256!==config.archiveHash||manifestData.version!==config.version||manifestData.testReceipt.failed!==0||manifestData.testReceipt.passed!==Number(config.expectedTestPassed))throw Error('Candidate test or provenance receipt mismatch');
  const entries=run('unzip',['-Z1',config.zip]).toString().trim().split('\n');
  if(entries.length!==manifestData.entryCount||entries.some(entry=>entry.startsWith('/')||entry.includes('\\')||entry.split('/').includes('..')))throw Error('Unsafe candidate archive');
  if(fs.existsSync(config.candidate))throw Error('Candidate staging directory must not pre-exist');
  fs.mkdirSync(config.candidate,{mode:0o700});
  run('unzip',['-q',config.zip,'-d',config.candidate],5*60_000);
  const provenance=JSON.parse(fs.readFileSync(path.join(config.candidate,'RELEASE_PROVENANCE.json'),'utf8'));
  if(provenance.commit!==config.commit||provenance.version!==config.version||provenance.migrationCount!==Number(config.expectedMigrationCount)||provenance.testReceipt.failed!==0)throw Error('Candidate provenance mismatch');
  report.candidateFiles=runtimeNames(config.candidate).length;
  if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(config.candidate,'package.json'))).dependencies)!==JSON.stringify(JSON.parse(fs.readFileSync(path.join(config.root,'package.json'))).dependencies))throw Error('Unapproved dependency change');
  const dependencies=fs.realpathSync(path.join(config.root,'node_modules'));
  if(dependencies!==`/home/nysareal/nodevenv/${path.basename(config.root)}/24/lib/node_modules`)throw Error('Dependency identity mismatch');
  fs.symlinkSync(dependencies,path.join(config.candidate,'node_modules'),'dir');
  process.env.PDF_RENDER_RUNTIME_DIR=path.join(config.root,'tmp/pdf-renderer');
  process.chdir(config.candidate);
  const {verifyApprovedDocumentRuntime:verifyCandidatePdfs}=await import(pathToFileURL(path.join(config.candidate,'src/approved-document-runtime-smoke.js')));
  report.candidatePdfFormats=await verifyCandidatePdfs();
  const stagePool=poolFor(environment);try{report.stageLedger=await ledger(stagePool);}finally{await stagePool.end();}
  report.workersBefore=inspectWorkers(config.root);
  write('STAGE_RESULT.json',{...report,result:'STAGED_AND_VERIFIED',completedAt:new Date().toISOString()});

  report.workerStop=await stop();
  if(!await assertStopped()||inspectWorkers(config.root).length!==0)throw Error('Exact-root quiescence failed');
  const pool=poolFor(environment);
  try{
    await ledger(pool);
    const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename")).rows.map(row=>row.tablename);
    const before=await fingerprint(pool,tables);write('ORIGINAL_TABLE_FINGERPRINTS.json',before);
    const prior=path.join(config.base,'changed-runtime-baseline');fs.mkdirSync(prior,{mode:0o700});
    for(const name of [...runtimeNames(config.candidate),'RUNTIME_MANIFEST.sha256']){
      remaining();
      const source=path.join(config.candidate,name),target=path.join(config.root,name);
      if(fs.existsSync(target)&&hash(source)===hash(target))continue;
      if(fs.existsSync(target)){
        const destination=path.join(prior,name);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.copyFileSync(target,destination);restore.push({name,existed:true});
      }else restore.push({name,existed:false});
      fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.copyFileSync(source,target);changed=true;
    }
    write('CHANGED_RUNTIME.json',restore);runtimeNames(config.root);report.changedFiles=restore.length;
    await ledger(pool);
    const after=await fingerprint(pool,tables);
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Original CRM Test table data changed');
    report.originalTablesPreserved=tables.length;
  }finally{await pool.end();}
  process.chdir(config.root);
  const {verifyApprovedDocumentRuntime:verifyInstalledPdfs}=await import(pathToFileURL(path.join(config.root,'src/approved-document-runtime-smoke.js')));
  report.installedPdfFormats=await verifyInstalledPdfs();
  selector('start');report.readiness=await readiness(config.version);
  report.runtimeFiles=runtimeNames(config.root).length;
  const verificationPool=poolFor(environment);try{report.ledger=await ledger(verificationPool);}finally{await verificationPool.end();}
  report.http=[];
  for(const[url,status]of[['/',200],['/api/me',401],['/api/crm/whatsapp-workspace',401],['/api/crm/dashboard',401],['/api/crm/tasks',401]]){
    remaining();
    const response=await fetch(`https://${config.domain}${url}`,{signal:AbortSignal.timeout(Math.min(10_000,remaining()))});await response.arrayBuffer();
    if(response.status!==status)throw Error('Access or static smoke regression');
    report.http.push({url,status});
  }
  report.workersAfter=inspectWorkers(config.root);
  if(report.workersAfter.length!==1)throw Error('Post-readiness exact-root worker count is not one');
  report.sandboxSendingEnabled=false;report.callbackApproval=false;
  report.result='DEPLOYED_TECHNICAL_CHECKS_PASSED';
  report.cleanup=cleanAfterHealth(args['backup-path']);
}catch(error){
  report.result='FAILED';report.errorName=error.name;report.errorCode=error.code||null;report.safeError=String(error.message||'').startsWith('Command failed:')?'External command failed':String(error.message||'').slice(0,240);
  if(changed){
    try{
      await stop();
      for(const item of restore.reverse()){
        const target=path.join(config.root,item.name);
        if(item.existed)fs.copyFileSync(path.join(config.base,'changed-runtime-baseline',item.name),target);
        else if(fs.existsSync(target))fs.rmSync(target);
      }
      selector('start');report.rollback=await readiness(config.baselineVersion);report.result='ROLLED_BACK_CODE';
    }catch{report.result='ROLLBACK_REQUIRES_ATTENTION';}
  }
  process.exitCode=1;
}finally{
  report.completedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.now()-startedAt)/1000);write('DEPLOY_RESULT.json',report);console.log(JSON.stringify(report));
}
