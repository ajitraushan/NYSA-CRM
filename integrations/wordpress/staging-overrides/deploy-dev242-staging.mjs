import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const [candidate,backupDir]=process.argv.slice(2).map(value=>path.resolve(value));
const home='/home/nysareal',appName='nysa-core-dashboard-dd6262a-stage',root=path.join(home,'staging.nysarealty.com');
const bridge=path.join(candidate,'integrations','wordpress','nysa-core-lead-bridge'),overrides=path.join(candidate,'integrations','wordpress','staging-overrides');
const pluginTarget=path.join(root,'wp-content','plugins','nysa-core-lead-bridge'),configFile=path.join(root,'wp-config.php');
const run=(file,args,options={})=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:128*1024*1024,...options});
const assert=(value,code)=>{if(!value)throw new Error(code);};
process.umask(0o077);
assert(candidate.startsWith(backupDir+'/candidate-dev242'),'CANDIDATE_PATH');assert(backupDir.startsWith(home+'/crm-backups/crm-test-dev242-pre-'),'BACKUP_PATH');
for(const file of [path.join(bridge,'nysa-core-lead-bridge.php'),path.join(overrides,'page-contact-us.php'),path.join(overrides,'apply-functions-contact-core-hook.mjs'),path.join(backupDir,'staging-wordpress.database.sql.gz'),path.join(backupDir,'staging-wordpress.changed-files.tar.gz')])assert(fs.existsSync(file),'REQUIRED_FILE');
const selector=JSON.parse(fs.readFileSync(path.join(home,'.cl.selector','node-selector.json')));const env=selector[appName]?.env_vars;
assert(env?.WEBSITE_INTAKE_SECRET?.length>=32,'CORE_SECRET');assert(run('/usr/local/bin/wp',[`--path=${root}`,'option','get','siteurl']).trim()==='https://staging.nysarealty.com','STAGING_BINDING');
assert(fs.readFileSync(path.join(root,'wp-content','mu-plugins','nysa-staging-safety.php'),'utf8').includes("$host === 'my.remapp.ae'"),'REM_GUARD');
assert(!fs.existsSync(pluginTarget),'PLUGIN_ALREADY_EXISTS');
for(const file of [path.join(bridge,'nysa-core-lead-bridge.php'),path.join(overrides,'page-contact-us.php')])run('/usr/local/bin/php',['-l',file]);
let mutated=false;
try{
  run(path.join(home,'nodevenv',appName,'24','bin','node'),[path.join(overrides,'apply-functions-contact-core-hook.mjs'),path.join(root,'wp-content','themes','nysa-advisory-theme','functions.php')]);mutated=true;
  fs.copyFileSync(path.join(overrides,'page-contact-us.php'),path.join(root,'wp-content','themes','nysa-advisory-theme','page-contact-us.php'));
  fs.cpSync(bridge,pluginTarget,{recursive:true,errorOnExist:true});
  let config=fs.readFileSync(configFile,'utf8');assert(!config.includes('NYSA_CORE_INTAKE_URL')&&!config.includes('NYSA_CORE_INTAKE_SECRET'),'CORE_CONFIG_ALREADY_PRESENT');
  const marker="/* That's all, stop editing! Happy publishing. */";assert(config.includes(marker),'WP_CONFIG_MARKER');
  const escaped=String(env.WEBSITE_INTAKE_SECRET).replaceAll('\\','\\\\').replaceAll("'","\\'");
  config=config.replace(marker,`define('NYSA_CORE_INTAKE_URL', 'https://crm-test.nysarealty.com/api/intake/website');\ndefine('NYSA_CORE_INTAKE_SECRET', '${escaped}');\n\n${marker}`);
  fs.writeFileSync(configFile,config,{mode:0o600});
  for(const file of [path.join(root,'wp-content','themes','nysa-advisory-theme','functions.php'),path.join(root,'wp-content','themes','nysa-advisory-theme','page-contact-us.php'),path.join(pluginTarget,'nysa-core-lead-bridge.php'),configFile])run('/usr/local/bin/php',['-l',file]);
  run('/usr/local/bin/wp',[`--path=${root}`,'plugin','activate','nysa-core-lead-bridge','--quiet']);
  run('/usr/local/bin/wp',[`--path=${root}`,'plugin','is-active','nysa-core-lead-bridge']);
  const prefix=run('/usr/local/bin/wp',[`--path=${root}`,'db','prefix']).trim();assert(/^[A-Za-z0-9_]+$/.test(prefix),'TABLE_PREFIX');
  const outbox=run('/usr/local/bin/wp',[`--path=${root}`,'db','query',`SELECT COUNT(*) FROM ${prefix}nysa_core_lead_outbox`,'--skip-column-names']).trim();assert(outbox==='0','OUTBOX_NOT_EMPTY');
  const page=fs.readFileSync(path.join(root,'wp-content','themes','nysa-advisory-theme','page-contact-us.php'),'utf8');assert(['name="country"','name="purpose"','name="timeline"','name="ai_assisted_contact"','CRM Test only'].every(marker=>page.includes(marker)),'FORM_CONTRACT');
  console.log(JSON.stringify({status:'STAGING_BRIDGE_DEPLOYED',endpoint:'CRM Test',routes:['Contact Us','NIA'],outboxRows:0,remWritesBlocked:true,liveOutreachDisabled:true,backupDir}));
}catch(error){
  let rollback='not_required';fs.writeFileSync(path.join(backupDir,'staging-deployment-private.log'),String(error.stack||error)+'\n'+String(error.stderr||''),{mode:0o600});
  if(mutated){try{try{run('/usr/local/bin/wp',[`--path=${root}`,'plugin','deactivate','nysa-core-lead-bridge','--quiet']);}catch{}if(fs.existsSync(pluginTarget))fs.renameSync(pluginTarget,path.join(backupDir,'failed-nysa-core-lead-bridge'));run('/bin/tar',['-xzf',path.join(backupDir,'staging-wordpress.changed-files.tar.gz'),'-C',root]);const sql=spawnSync('/bin/gzip',['-dc',path.join(backupDir,'staging-wordpress.database.sql.gz')],{encoding:null,maxBuffer:256*1024*1024});assert(sql.status===0,'ROLLBACK_GZIP');const restore=spawnSync('/usr/local/bin/wp',[`--path=${root}`,'db','import','-','--quiet'],{input:sql.stdout,encoding:null,maxBuffer:256*1024*1024});assert(restore.status===0,'ROLLBACK_DB');rollback='staging_backup_restored';}catch(recoveryError){fs.appendFileSync(path.join(backupDir,'staging-deployment-private.log'),'\nROLLBACK\n'+String(recoveryError.stack||recoveryError),{mode:0o600});rollback='REQUIRES_MANUAL_RECOVERY';}}
  console.log(JSON.stringify({status:'FAILED',safeCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'STAGING_REVIEW_REQUIRED',rollback}));process.exitCode=1;
}
