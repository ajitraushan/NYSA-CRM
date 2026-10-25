import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root='/home/nysareal/nysa-core-dashboard-dd6262a-stage';
const domain='crm-test.nysarealty.com';
const [mode,...args]=process.argv.slice(2);
if(!['preflight','deploy'].includes(mode))throw new Error('Use preflight or deploy');
// Read the hosting provider's registered application configuration, never a
// live process environment. Do not print configuration values or credentials.
let config;
try{config=JSON.parse(execFileSync('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',domain],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024}));}
catch{throw new Error('Hosting application configuration could not be read');}
const matches=[];
function find(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key===path.basename(root)||key===root)matches.push(item);else if(key!=='env_vars')find(item);}}
find(config);
if(matches.length!==1||matches[0].domain!==domain)throw new Error('Expected exactly the CRM Test application configuration');
const env=matches[0].env_vars||{};
if(env.PGDATABASE!=='nysareal_nysa_r2_rehearsal')throw new Error('CRM Test database identity mismatch');
if(!env.PGUSER||!env.PGPASSWORD)throw new Error('CRM Test database configuration is incomplete');
for(const [key,value] of Object.entries(env))process.env[key]=String(value);
if(mode==='deploy'){
 const script='/home/nysareal/deploy-crm-test-dev228.sh';
 if(!fs.existsSync(script))throw new Error('Verified DEV228 deployer missing');
 const result=spawnSync('bash',[script,...args],{env:process.env,stdio:'inherit'});
 process.exitCode=result.status??1;
}else{
 const {db,closeDatabase}=await import(root+'/src/db.js');
 try{
  const row=(await db.query('SELECT current_database() AS database,COUNT(*)::int AS migrations,MAX(version) AS latest FROM schema_migrations')).rows[0];
  console.log(JSON.stringify({version:JSON.parse(fs.readFileSync(root+'/package.json','utf8')).version,...row}));

 }finally{await closeDatabase();}
}
