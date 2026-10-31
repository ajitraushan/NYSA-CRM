import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [candidate,backupDir]=process.argv.slice(2).map(value=>path.resolve(value));
const home='/home/nysareal',root=path.join(home,'staging.nysarealty.com');
const source=path.join(candidate,'integrations','wordpress','nysa-core-lead-bridge','nysa-core-lead-bridge.php');
const target=path.join(root,'wp-content','plugins','nysa-core-lead-bridge','nysa-core-lead-bridge.php');
const expectedBaseline='d7e81ea8f5b00414a4834143c166c9c57ec6260f47ec0b3c5e3396a7898f8ca9';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const run=(file,args,options={})=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024,...options});
const assert=(value,code)=>{if(!value)throw new Error(code);};
process.umask(0o077);

assert(candidate.startsWith(backupDir+'/candidate-dev243'),'CANDIDATE_PATH');
assert(backupDir.startsWith(home+'/crm-backups/crm-test-dev243-pre-'),'BACKUP_PATH');
for(const file of [source,target,path.join(backupDir,'staging-wordpress.database.sql.gz'),path.join(backupDir,'staging-wordpress.changed-files.tar.gz')])assert(fs.existsSync(file),'REQUIRED_FILE');
assert(hash(fs.readFileSync(target))===expectedBaseline,'STAGING_PLUGIN_BASELINE');
assert(fs.readFileSync(source,'utf8').includes('Version: 1.0.1'),'PLUGIN_VERSION');
assert(run('/usr/local/bin/wp',[`--path=${root}`,'option','get','siteurl']).trim()==='https://staging.nysarealty.com','STAGING_BINDING');
assert(run('/usr/local/bin/wp',[`--path=${root}`,'plugin','is-active','nysa-core-lead-bridge']).trim()==='','PLUGIN_ACTIVE');
run('/usr/local/bin/php',['-l',source]);
const prefix=run('/usr/local/bin/wp',[`--path=${root}`,'db','prefix']).trim();assert(/^[A-Za-z0-9_]+$/.test(prefix),'TABLE_PREFIX');
const before=Number(run('/usr/local/bin/wp',[`--path=${root}`,'db','query',`SELECT COUNT(*) FROM ${prefix}nysa_core_lead_outbox`,'--skip-column-names']).trim());
const failed=path.join(backupDir,'failed-dev243-bridge.php');let mutated=false;
try{
  fs.copyFileSync(source,`${target}.dev243-new`);fs.chmodSync(`${target}.dev243-new`,fs.statSync(target).mode);
  fs.renameSync(target,failed);fs.renameSync(`${target}.dev243-new`,target);mutated=true;
  run('/usr/local/bin/php',['-l',target]);
  assert(run('/usr/local/bin/wp',[`--path=${root}`,'plugin','is-active','nysa-core-lead-bridge']).trim()==='','PLUGIN_ACTIVE_AFTER');
  const after=Number(run('/usr/local/bin/wp',[`--path=${root}`,'db','query',`SELECT COUNT(*) FROM ${prefix}nysa_core_lead_outbox`,'--skip-column-names']).trim());
  assert(Number.isInteger(before)&&after===before,'OUTBOX_CHANGED');
  console.log(JSON.stringify({status:'STAGING_BRIDGE_UPDATED',version:'1.0.1',routes:['Contact Us','NIA'],outboxRowsPreserved:after,remWritesBlocked:true,liveOutreachDisabled:true,backupDir}));
}catch(error){
  let rollback='not_required';
  try{if(mutated){if(fs.existsSync(target))fs.unlinkSync(target);fs.renameSync(failed,target);rollback='plugin_restored';}}catch{rollback='REQUIRES_MANUAL_RECOVERY';}
  fs.writeFileSync(path.join(backupDir,'dev243-staging-private.log'),String(error.stack||error),{mode:0o600});
  console.log(JSON.stringify({status:'FAILED',safeCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'STAGING_REVIEW_REQUIRED',rollback}));process.exitCode=1;
}
