import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const [zip,manifestFile,manifestShaFile,backupDir,expectedCommit]=process.argv.slice(2).map(value=>path.resolve(value));
const home='/home/nysareal',appName='nysa-core-dashboard-dd6262a-stage',root=path.join(home,appName);
const node=path.join(home,'nodevenv',appName,'24','bin','node'),npm=path.join(home,'nodevenv',appName,'24','bin','npm');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const assert=(value,code)=>{if(!value)throw new Error(code);};
const run=(file,args,options={})=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:128*1024*1024,...options});
process.umask(0o077);

assert(zip.startsWith(home+'/crm-test-dev241-transfer/'),'PACKAGE_PATH');
assert(manifestFile.startsWith(home+'/crm-test-dev241-transfer/'),'MANIFEST_PATH');
assert(backupDir.startsWith(home+'/crm-backups/crm-test-dev242-pre-'),'BACKUP_PATH');
assert(/^[a-f0-9]{40}$/.test(path.basename(expectedCommit)),'COMMIT');
for(const file of [zip,manifestFile,manifestShaFile,path.join(backupDir,'crm-test.database.dump'),path.join(backupDir,'crm-test.application.tar.gz')])assert(fs.existsSync(file),'REQUIRED_FILE');
const manifest=JSON.parse(fs.readFileSync(manifestFile));
const expectedManifestSha=fs.readFileSync(manifestShaFile,'utf8').trim().split(/\s+/)[0];
assert(hash(fs.readFileSync(manifestFile))===expectedManifestSha,'MANIFEST_HASH');
assert(hash(fs.readFileSync(zip))===manifest.packageSha256,'PACKAGE_HASH');
assert(manifest.schema==='nysa.release-provenance.v1'&&manifest.repositoryUrl==='https://github.com/ajitraushan/NYSA-CRM.git','PROVENANCE');
assert(manifest.commit===path.basename(expectedCommit)&&manifest.version==='2.1.0-dev.242'&&manifest.migrationCount===155&&manifest.latestMigration==='155_website_shared_lead_response.sql'&&manifest.testReceipt?.failed===0,'RELEASE_IDENTITY');

const selector=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain','crm-test.nysarealty.com']));
const matches=[];function find(object){if(!object||typeof object!=='object')return;for(const [key,value] of Object.entries(object)){if(key===root||key===appName)matches.push(value);else if(key!=='env_vars')find(value);}}find(selector);
assert(matches.length===1&&matches[0].domain==='crm-test.nysarealty.com','TEST_CONFIG_BINDING');
const config=matches[0],env={...process.env,...config.env_vars};
assert(env.PGDATABASE==='nysareal_nysa_r2_rehearsal'&&env.PGUSER&&env.PGPASSWORD,'TEST_DB_BINDING');
for(const [key,value] of Object.entries(env))if(/^(LEAD_.*_ENABLED|LEAD_RESPONSE_ACTIVATION_APPROVED|META_INTAKE_ENABLED|PROPERTY_FINDER_.*(?:ENABLED|ALLOW_READS|ALLOW_DRAFT_CREATE|ALLOW_PUBLISH)|MICROSOFT365_EMAIL_ENABLED|CALENDLY_ENABLED)$/.test(key))assert(!['true','1'].includes(String(value).toLowerCase()),`LIVE_FLAG_${key}`);
assert(env.WEBSITE_INTAKE_SECRET?.length>=32&&/^[0-9a-f-]{36}$/i.test(env.WEBSITE_INTAKE_ACTOR_ID||''),'WEBSITE_INTAKE_SETUP');

const {Client}=createRequire(path.join(root,'package.json'))('pg');
const db=new Client({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD});
const lifecycle=action=>run('cloudlinux-selector',[action,'--json','--interpreter','nodejs','--app-root',appName]);
const stopTestWorkers=()=>{let lines=[];try{lines=run('pgrep',['-afu','nysareal','[n]ode']).split('\n').filter(line=>line.includes('lsnode:'+root+'/'));}catch{}for(const line of lines){const pid=Number(line.trim().split(/\s+/)[0]);assert(Number.isInteger(pid)&&pid>1,'WORKER_PID');assert(fs.readlinkSync(`/proc/${pid}/cwd`)===root,'WORKER_CWD');const unix=fs.readFileSync('/proc/net/unix','utf8');let bound=false;for(const fd of fs.readdirSync(`/proc/${pid}/fd`)){let link;try{link=fs.readlinkSync(`/proc/${pid}/fd/${fd}`);}catch{continue;}const inode=link.match(/^socket:\[(\d+)\]$/)?.[1];if(inode&&unix.split('\n').some(row=>row.trim().split(/\s+/)[6]===inode&&row.includes('/usr/local/lsws/extapp-sock/APVH_crm-test.nysarealty.com')))bound=true;}assert(bound,'WORKER_SOCKET');process.kill(pid,'SIGKILL');}fs.mkdirSync(path.join(root,'tmp'),{recursive:true});fs.writeFileSync(path.join(root,'tmp','restart.txt'),new Date().toISOString());};
const ledger=async()=> (await db.query('SELECT COUNT(*)::int AS count,MAX(version) AS latest FROM schema_migrations')).rows[0];
const rowsSnapshot=async tables=>{const out={};for(const table of tables){assert(/^[a-z_][a-z0-9_]*$/.test(table),'TABLE');out[table]=(await db.query(`SELECT COUNT(*)::int AS count,md5(COALESCE(string_agg(row_to_json(x)::text,'' ORDER BY row_to_json(x)::text),'')) AS digest FROM "${table}" x`)).rows[0];}return out;};
const sourceSnapshot=async()=> (await db.query(`SELECT COUNT(*)::int AS count,md5(COALESCE(string_agg(row_to_json(x)::text,'' ORDER BY row_to_json(x)::text),'')) AS digest FROM (SELECT id,source_system,source_account_id,source_event_id,source_form_id,reference_digest,source_created_at,received_at,state,lead_id,error_code,processed_at,review_owner_id,review_due_at,attempt_count,next_attempt_at FROM lead_source_inbox) x`)).rows[0];
const verifyFiles=directory=>{for(const line of fs.readFileSync(path.join(directory,'RUNTIME_MANIFEST.sha256'),'utf8').trim().split('\n')){const match=line.match(/^([a-f0-9]{64})  (.+)$/);assert(match&&!match[2].includes('..')&&!path.isAbsolute(match[2]),'RUNTIME_PATH');assert(hash(fs.readFileSync(path.join(directory,match[2])))===match[1],`RUNTIME_HASH_${match[2]}`);}};
const candidate=path.join(backupDir,'candidate-dev242');let stopped=false,mutated=false,tables=[],before={},sourceBefore={},productionHash='';
try{
  await db.connect();
  assert(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version==='2.1.0-dev.241','BASELINE_VERSION');
  const baseline=await ledger();assert(baseline.count===154&&baseline.latest==='154_nonvoice_manager_escalation.sql','BASELINE_LEDGER');
  tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('schema_migrations','lead_source_inbox') ORDER BY tablename")).rows.map(row=>row.tablename);
  before=await rowsSnapshot(tables);sourceBefore=await sourceSnapshot();productionHash=hash(fs.readFileSync(path.join(home,'nysa-crm','package.json')));
  assert(!fs.existsSync(candidate),'CANDIDATE_EXISTS');fs.mkdirSync(candidate,{mode:0o700});run('unzip',['-q',zip,'-d',candidate]);verifyFiles(candidate);
  const embedded=JSON.parse(fs.readFileSync(path.join(candidate,'RELEASE_PROVENANCE.json')));assert(embedded.commit===manifest.commit&&embedded.tree===manifest.tree&&embedded.version===manifest.version,'EMBEDDED_PROVENANCE');
  lifecycle('stop');stopTestWorkers();stopped=true;
  run('cp',['-a',candidate+'/.',root+'/']);mutated=true;
  run(npm,['install','--omit=dev','--no-audit','--no-fund'],{cwd:root,env:{...env,PATH:path.dirname(node)+':'+env.PATH}});
  for(const [key,value] of Object.entries(env))process.env[key]=String(value);
  const database=await import(path.join(root,'src','db.js')+'?dev242='+Date.now());try{await database.migrate();}finally{await database.closeDatabase();}
  const applied=await ledger();assert(applied.count===155&&applied.latest==='155_website_shared_lead_response.sql','MIGRATION_LEDGER');
  assert(JSON.stringify(await rowsSnapshot(tables))===JSON.stringify(before),'ORIGINAL_ROWS_CHANGED');assert(JSON.stringify(await sourceSnapshot())===JSON.stringify(sourceBefore),'SOURCE_ROWS_CHANGED');
  verifyFiles(root);stopTestWorkers();lifecycle('start');stopped=false;
  let readiness=null;for(let attempt=0;attempt<15;attempt++){try{readiness=JSON.parse(run('curl',['-fsS','--max-time','10','https://crm-test.nysarealty.com/api/readiness']));if(readiness.version==='2.1.0-dev.242'&&readiness.database==='ready')break;}catch{}await new Promise(resolve=>setTimeout(resolve,2000));}
  assert(readiness?.version==='2.1.0-dev.242'&&readiness?.database==='ready','READINESS');
  assert(hash(fs.readFileSync(path.join(home,'nysa-crm','package.json')))===productionHash,'PRODUCTION_CHANGED');
  console.log(JSON.stringify({status:'CRM_TEST_DEPLOYED',version:readiness.version,migrations:applied.count,originalTablesPreserved:tables.length+1,liveIntegrationsDisabled:true,productionUnchanged:true,backupDir,commit:manifest.commit}));mutated=false;
}catch(error){
  let rollback='not_required';fs.writeFileSync(path.join(backupDir,'dev242-deployment-private.log'),String(error.stack||error)+'\n'+String(error.stderr||''),{mode:0o600});
  if(mutated){try{try{lifecycle('stop');stopTestWorkers();}catch{}const archived=new Set(run('tar',['-tzf',path.join(backupDir,'crm-test.application.tar.gz')]).split('\n').map(name=>name.replace(new RegExp('^'+appName+'/?'),'')));if(fs.existsSync(path.join(candidate,'RUNTIME_MANIFEST.sha256')))for(const line of fs.readFileSync(path.join(candidate,'RUNTIME_MANIFEST.sha256'),'utf8').trim().split('\n')){const name=line.slice(66),full=path.resolve(root,name);assert(full.startsWith(root+'/'),'ROLLBACK_PATH');if(!archived.has(name)&&fs.existsSync(full)&&fs.statSync(full).isFile())fs.unlinkSync(full);}run('tar',['-xzf',path.join(backupDir,'crm-test.application.tar.gz'),'-C',home]);run('pg_restore',['--clean','--if-exists','--no-owner','--no-acl','--dbname='+env.PGDATABASE,path.join(backupDir,'crm-test.database.dump')],{env});run(npm,['install','--omit=dev','--no-audit','--no-fund'],{cwd:root,env:{...env,PATH:path.dirname(node)+':'+env.PATH}});lifecycle('start');stopped=false;rollback='paired_backup_restored';}catch(recoveryError){fs.appendFileSync(path.join(backupDir,'dev242-deployment-private.log'),'\nROLLBACK\n'+String(recoveryError.stack||recoveryError),{mode:0o600});rollback='REQUIRES_MANUAL_RECOVERY';}}
  else if(stopped){try{lifecycle('start');stopped=false;}catch{}}
  console.log(JSON.stringify({status:'FAILED',safeCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'DEPLOYMENT_REVIEW_REQUIRED',rollback}));process.exitCode=1;
}finally{try{await db.end();}catch{}}
