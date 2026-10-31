import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const home='/home/nysareal';
const appName='nysa-core-dashboard-dd6262a-stage';
const appRoot=path.join(home,appName);
const stagingRoot=path.join(home,'staging.nysarealty.com');
const selectorFile=path.join(home,'.cl.selector','node-selector.json');
const backupParent=path.join(home,'crm-backups');
const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const backupDir=path.join(backupParent,`crm-test-dev243-pre-${stamp}`);
const bundle=`${backupDir}.tar.gz`;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

function run(file,args,options={}){
  const result=spawnSync(file,args,{stdio:['ignore','pipe','pipe'],maxBuffer:256*1024*1024,...options});
  if(result.error||result.status!==0){
    const safe=String(result.stderr||'').split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').replace(/password\s*=\s*\S+/ig,'password=[redacted]');
    throw new Error(`${path.basename(file)} failed${safe?`: ${safe}`:''}`);
  }
  return result;
}

if(!fs.existsSync(appRoot)||!fs.existsSync(stagingRoot)||!fs.existsSync(selectorFile))throw new Error('Expected CRM Test/staging boundary is missing');
if(fs.existsSync(backupDir)||fs.existsSync(bundle))throw new Error('Refusing to overwrite a backup path');
fs.mkdirSync(backupDir,{recursive:false,mode:0o700});

try{
  const selector=JSON.parse(fs.readFileSync(selectorFile,'utf8'));
  const appConfig=selector[appName];
  const env=appConfig?.env_vars;
  for(const key of ['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD'])if(!env?.[key])throw new Error(`CRM Test selector is missing ${key}`);
  fs.writeFileSync(path.join(backupDir,'crm-test.selector.json'),JSON.stringify({[appName]:appConfig},null,2)+'\n',{mode:0o600,flag:'wx'});

  run('/bin/pg_dump',['-h',env.PGHOST,'-p',String(env.PGPORT),'-U',env.PGUSER,'-d',env.PGDATABASE,'-Fc','-f',path.join(backupDir,'crm-test.database.dump')],{env:{...process.env,PGPASSWORD:env.PGPASSWORD}});
  run('/bin/tar',[`--exclude=${appName}/node_modules`,`--exclude=${appName}/tmp`,'-czf',path.join(backupDir,'crm-test.application.tar.gz'),'-C',home,appName]);

  const wordpressSql=path.join(backupDir,'staging-wordpress.database.sql');
  run('/usr/local/bin/wp',[`--path=${stagingRoot}`,'db','export',wordpressSql,'--quiet']);
  run('/bin/gzip',['-9',wordpressSql]);
  run('/bin/tar',['-czf',path.join(backupDir,'staging-wordpress.changed-files.tar.gz'),'-C',stagingRoot,
    'wp-config.php','wp-content/themes/nysa-advisory-theme/functions.php','wp-content/themes/nysa-advisory-theme/page-contact-us.php',
    'wp-content/plugins/nysa-core-lead-bridge/nysa-core-lead-bridge.php','wp-content/mu-plugins/nysa-staging-safety.php']);

  const files=['crm-test.database.dump','crm-test.application.tar.gz','crm-test.selector.json','staging-wordpress.database.sql.gz','staging-wordpress.changed-files.tar.gz'];
  const receipt=files.map(name=>`${sha(fs.readFileSync(path.join(backupDir,name)))}  ${name}`).join('\n')+'\n';
  fs.writeFileSync(path.join(backupDir,'SHA256SUMS'),receipt,{mode:0o600,flag:'wx'});
  for(const name of [...files,'SHA256SUMS'])fs.chmodSync(path.join(backupDir,name),0o600);
  run('/bin/tar',['-czf',bundle,'-C',backupParent,path.basename(backupDir)]);
  fs.chmodSync(bundle,0o600);
  const bundleSha=sha(fs.readFileSync(bundle));
  fs.writeFileSync(`${bundle}.sha256`,`${bundleSha}  ${path.basename(bundle)}\n`,{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({status:'BACKUP_OK',backupDir,bundle,bytes:fs.statSync(bundle).size,sha256:bundleSha,files:files.length}));
}catch(error){
  const incomplete=`${backupDir}.incomplete`;
  try{fs.renameSync(backupDir,incomplete);}catch{}
  throw error;
}
