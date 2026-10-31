// Exact DEV251 CRM Test operator. Production and website are never targets.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{execFileSync}from'node:child_process';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
import{inspectWorkers,stopVerifiedWorkers,verifyReadinessWorker}from'./hosted-worker-lifecycle.mjs';
process.umask(0o077);
const root='/home/nysareal/nysa-core-dashboard-dd6262a-stage',domain='crm-test.nysarealty.com',base='/home/nysareal/crm-release-preparation/20261031-ui001',candidate=base+'/candidate-dev251',commit='8f722679c92eabcd2efb6cef824d5225b28dbcf4',version='2.1.0-dev.251';
if(process.platform!=='linux'||process.argv[2]!==`--approved-${commit}`)throw Error('Exact CRM Test candidate approval is required');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function registration(){const j=JSON.parse(run('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',domain])),found=[];function walk(v){if(!v||typeof v!=='object')return;for(const[k,a]of Object.entries(v)){if(k===root||k===path.basename(root))found.push(a);else if(k!=='env_vars')walk(a);}}walk(j);if(found.length!==1||found[0].domain!==domain)throw Error('Test registration mismatch');return found[0];}
function selector(action){run('cloudlinux-selector',[action,'--json','--interpreter','nodejs','--domain',domain,'--app-root',path.basename(root)]);}
const assertStopped=async()=>registration().app_status==='stopped';
async function stop(){try{selector('stop')}catch(e){if(!await assertStopped())throw e;}return stopVerifiedWorkers(root,{assertStopped});}
function verifyRuntime(directory){let count=0;for(const line of fs.readFileSync(directory+'/RUNTIME_MANIFEST.sha256','utf8').trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})  (.+)$/);if(!m||m[2].split('/').includes('..')||sha(directory+'/'+m[2])!==m[1])throw Error('Runtime hash mismatch');count++;}return count;}
const stamp=new Date().toISOString().replace(/[-:.]/g,''),report={result:'PREFLIGHT',commit,version,root,productionMutation:false,databaseMigration:false},swaps=[];
let changed=false,depsMoved=false,newDeps=false,oldDeps,deps,original;
try{
 original=registration();const env=original.env_vars;
 if(env.PGDATABASE!=='nysareal_nysa_dev247_smoke'||env.PGUSER!=='nysareal_nysar2app'||JSON.parse(fs.readFileSync(root+'/package.json')).version!=='2.1.0-dev.248')throw Error('Test baseline drift');
 const backup=JSON.parse(fs.readFileSync(base+'/test-LATEST.json')),off=JSON.parse(fs.readFileSync(base+'/TEST_OFFSERVER_VERIFIED.json'));
 if(backup.version!=='2.1.0-dev.248'||off.result!=='PASSED'||!off.authenticatedDecryption||off.ciphertextSha256!==backup.ciphertextSha256)throw Error('Verified recovery gate failed');
 const saved=JSON.parse(fs.readFileSync(backup.directory+'/registered-config.json'));if(JSON.stringify(saved)!==JSON.stringify(original))throw Error('Configuration changed since backup');
 for(const item of JSON.parse(fs.readFileSync(backup.directory+'/BACKUP_RECEIPT.json')).components)if(sha(backup.directory+'/'+item.name)!==item.sha256)throw Error('Backup component drift');
 const {Pool}=createRequire(root+'/package.json')('pg'),pool=new Pool({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD,max:1});try{const ledger=(await pool.query('SELECT current_database() AS db,COUNT(*)::int AS count FROM schema_migrations')).rows[0];if(ledger.db!==env.PGDATABASE||ledger.count!==159)throw Error('No schema migration is authorized by this Test operator');}finally{await pool.end();}
 const p=JSON.parse(fs.readFileSync(candidate+'/RELEASE_PROVENANCE.json'));if(p.commit!==commit||p.version!==version||p.testReceipt.failed!==0)throw Error('Candidate provenance mismatch');report.runtimeFiles=verifyRuntime(candidate);
 deps=fs.realpathSync(root+'/node_modules');if(deps!==`/home/nysareal/nodevenv/${path.basename(root)}/24/lib/node_modules`)throw Error('Dependency path mismatch');oldDeps=path.dirname(deps)+'/node_modules.pre-ui001-'+stamp;
 report.workersBefore=inspectWorkers(root);report.workerStop=await stop();
 const names=fs.readdirSync(candidate).filter(n=>n!=='node_modules'&&n!=='PRIVATE_NPM_INSTALL.log');
 for(const name of names){if(!/^[A-Za-z0-9_.-]+$/.test(name))throw Error('Unsafe staged name');const target=root+'/'+name,prior=root+'/.pre-ui001-'+stamp+'-'+name,existed=fs.existsSync(target);if(existed)fs.renameSync(target,prior);swaps.push({target,prior,existed});changed=true;fs.renameSync(candidate+'/'+name,target);}
 fs.renameSync(deps,oldDeps);depsMoved=true;fs.renameSync(candidate+'/node_modules',deps);newDeps=true;verifyRuntime(root);
 process.chdir(root);const {verifyApprovedDocumentRuntime}=await import(pathToFileURL(root+'/src/approved-document-runtime-smoke.js'));report.pdfFormats=await verifyApprovedDocumentRuntime();
 selector('start');let ready;for(let i=0;i<20;i++){try{ready=await verifyReadinessWorker({root,expectedVersion:version});break;}catch(e){if(i===19)throw e;await new Promise(r=>setTimeout(r,500));}}report.readiness=ready;
 if(JSON.stringify(registration().env_vars)!==JSON.stringify(original.env_vars))throw Error('Test environment changed');
 report.http=[];for(const[url,status]of[['/',200],['/api/me',401],['/api/crm/dashboard',401],['/api/crm/tasks',401],['/ui-design-system.js',200],['/ui-design-system.css',200]]){const r=await fetch('https://'+domain+url,{signal:AbortSignal.timeout(10000)});await r.arrayBuffer();if(r.status!==status)throw Error('HTTP access/static regression');report.http.push({url,status});}
 report.result='DEPLOYED_TEST_TECHNICAL_CHECKS_PASSED';report.humanRoleUat='pending';report.configurationPreserved=true;
}catch(error){report.result='STOPPED_BEFORE_TEST_MUTATION';fs.writeFileSync(base+'/PRIVATE_TEST_DEPLOYMENT_DIAGNOSTIC.txt',error.stack||String(error));
 if(changed||depsMoved){report.result='ROLLBACK_RUNNING';try{await stop();if(newDeps)fs.renameSync(deps,base+'/failed-dependencies-'+stamp);if(depsMoved)fs.renameSync(oldDeps,deps);for(const item of swaps.reverse()){if(fs.existsSync(item.target))fs.renameSync(item.target,base+'/failed-'+stamp+'-'+path.basename(item.target));if(item.existed)fs.renameSync(item.prior,item.target);}selector('start');report.rollback=await verifyReadinessWorker({root,expectedVersion:'2.1.0-dev.248'});report.result='ROLLED_BACK';}catch(rollbackError){fs.writeFileSync(base+'/PRIVATE_TEST_ROLLBACK_DIAGNOSTIC.txt',rollbackError.stack||String(rollbackError));report.result='ROLLBACK_REQUIRES_ATTENTION';}}
 else if(original?.app_status==='started'&&registration().app_status==='stopped'){selector('start');report.baselineReadiness=await verifyReadinessWorker({root,expectedVersion:'2.1.0-dev.248'});}
 process.exitCode=1;
}finally{report.completedAt=new Date().toISOString();fs.writeFileSync(base+'/TEST_DEPLOYMENT_RESULT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
