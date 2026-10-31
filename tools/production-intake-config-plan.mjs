// Preparation only: this tool cannot apply configuration, create users or restart an application.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export function prepareIntakeConfiguration(existing,{randomBytes=crypto.randomBytes,randomUUID=crypto.randomUUID}={}){
 const patch={},actors=[];
 if(existing.WEB_INTAKE_IDENTITY_KEY&&!/^[a-f0-9]{64}$/i.test(existing.WEB_INTAKE_IDENTITY_KEY))throw Error('Existing identity key is invalid; do not rotate it automatically');
 if(existing.WEB_INTAKE_MATCH_KEY&&existing.WEB_INTAKE_MATCH_KEY.length<32)throw Error('Existing matching key is invalid; do not replace it automatically');
 if(!existing.WEB_INTAKE_IDENTITY_KEY)patch.WEB_INTAKE_IDENTITY_KEY=randomBytes(32).toString('hex');
 if(!existing.WEB_INTAKE_MATCH_KEY)patch.WEB_INTAKE_MATCH_KEY=randomBytes(32).toString('hex');
 if(!existing.WEB_INTAKE_MATCH_KEY_VERSION)patch.WEB_INTAKE_MATCH_KEY_VERSION='v1';
 const web=existing.WEB_INTAKE_ACTOR_ID||existing.WEBSITE_INTAKE_ACTOR_ID||randomUUID();
 if(!existing.WEB_INTAKE_ACTOR_ID&&!existing.WEBSITE_INTAKE_ACTOR_ID)actors.push({id:web,name:'System – WEB Intake',role:'internal_broker',jobRole:null,userClassification:'internal_user',canPost:0,passwordHash:'!disabled-service-login',email:`web-intake-${web}@service.invalid`});
 if(!existing.WEB_INTAKE_ACTOR_ID)patch.WEB_INTAKE_ACTOR_ID=web;
 if(!existing.WEBSITE_INTAKE_ACTOR_ID)patch.WEBSITE_INTAKE_ACTOR_ID=web;
 const nia=existing.NIA_INTAKE_ACTOR_ID||randomUUID();
 if(!existing.NIA_INTAKE_ACTOR_ID){patch.NIA_INTAKE_ACTOR_ID=nia;actors.push({id:nia,name:'System – NIA Intake',role:'viewer',jobRole:null,userClassification:'viewer',canPost:0,passwordHash:'!disabled-service-login',email:`nia-intake-${nia}@service.invalid`});}
 if(!existing.WEBSITE_INTAKE_SECRET)patch.WEBSITE_INTAKE_SECRET=randomBytes(32).toString('hex');
 // This reconciles internal journeys/tasks only. Provider and customer-outreach flags are untouched.
 if(existing.WEB_INTAKE_WORKER_ENABLED!=='true')patch.WEB_INTAKE_WORKER_ENABLED='true';
 return {patch,actors};
}

async function main(){
 process.umask(0o077);
 if(process.platform!=='linux')throw Error('Run preparation on the hosting account only');
 const args=process.argv.slice(2),candidateArg=args[args.indexOf('--candidate-root')+1];
 if(!args.includes('--candidate-root')||!candidateArg)throw Error('A provenance-verified candidate root is required');
 const candidate=await fs.realpath(candidateArg),base='/home/nysareal/crm-release-preparation',root='/home/nysareal/nysa-crm',domain='crm.nysarealty.com';
 if(!candidate.startsWith(base+'/'))throw Error('Candidate must be in private release preparation storage');
 const provenance=JSON.parse(await fs.readFile(path.join(candidate,'RELEASE_PROVENANCE.json'),'utf8'));
 if(provenance.schema!=='nysa.release-provenance.v1'||provenance.repositoryUrl!=='https://github.com/ajitraushan/NYSA-CRM.git'||!/^[a-f0-9]{40}$/.test(provenance.commit)||provenance.migrationCount!==159||provenance.testReceipt?.failed!==0)throw Error('Candidate provenance is not acceptable');
 const registration=JSON.parse(execFileSync('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',domain],{encoding:'utf8',stdio:['ignore','pipe','pipe']})),found=[];
 function locate(value){if(!value||typeof value!=='object')return;for(const[key,entry]of Object.entries(value)){if(key===root||key===path.basename(root))found.push(entry);else if(key!=='env_vars')locate(entry);}}
 locate(registration);if(found.length!==1||found[0].domain!==domain)throw Error('Production registration is ambiguous');
 const env=found[0].env_vars;if(env.PGDATABASE!=='nysareal_nysacrm'||env.PGUSER!=='nysareal_nysacrmapp')throw Error('Production database identity mismatch');
 const {Pool}=createRequire(root+'/package.json')('pg'),pool=new Pool({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD,max:1});
 try{
  const client=await pool.connect();try{
   await client.query('BEGIN READ ONLY');const ledger=(await client.query('SELECT COUNT(*)::int AS count,MAX(version) AS latest FROM schema_migrations')).rows[0];
   if(ledger.count!==140)throw Error('Production migration baseline changed');
   for(const[id,kind]of[[env.WEB_INTAKE_ACTOR_ID,'web'],[env.WEBSITE_INTAKE_ACTOR_ID,'web'],[env.NIA_INTAKE_ACTOR_ID,'nia']]){if(!id)continue;const actor=(await client.query('SELECT name,role,can_post,status FROM brokers WHERE id=$1',[id])).rows[0];if(!actor||actor.status!=='active'||(kind==='web'&&!['admin','internal_broker'].includes(actor.role))||(kind==='nia'&&(actor.name!=='System – NIA Intake'||actor.role!=='viewer'||actor.can_post!==0)))throw Error('An existing configured service actor does not satisfy the current contract');}
   await client.query('COMMIT');
  }finally{client.release();}
 }finally{await pool.end();}
 const directory=base+'/ui001-production-config-'+provenance.commit.slice(0,12);await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.chmod(directory,0o700);
 const file=directory+'/PENDING_PRODUCTION_CONFIG.json',baselineEnvironmentSha256=crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(env).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');let plan;
 try{plan=JSON.parse(await fs.readFile(file,'utf8'));if(plan.candidateCommit!==provenance.commit||plan.status!=='pending_exact_approval'||plan.baselineEnvironmentSha256!==baselineEnvironmentSha256)throw Error('Existing private plan or registered environment differs');}
 catch(error){if(error.code!=='ENOENT')throw error;const proposed=prepareIntakeConfiguration(env);plan={schema:'nysa.pending-production-intake-config.v1',status:'pending_exact_approval',createdAt:new Date().toISOString(),candidateCommit:provenance.commit,candidateVersion:provenance.version,baselineVersion:'2.1.0-rc.1',baselineEnvironmentSha256,database:'nysareal_nysacrm',baselineMigrations:140,productionRoot:root,...proposed,optionalProviderFlagsPreserved:true,existingUsersAndAssignmentsPreserved:true};await fs.writeFile(file,JSON.stringify(plan,null,2),{mode:0o600,flag:'wx'});}
 const receipt={status:'prepared_not_applied',candidateCommit:plan.candidateCommit,candidateVersion:plan.candidateVersion,plannedNewDisabledLoginActors:plan.actors.length,configurationFields:Object.keys(plan.patch),productionMutated:false,secretValuesPrinted:false,privatePlan:file};
 await fs.writeFile(directory+'/SAFE_RECEIPT.json',JSON.stringify(receipt,null,2),{mode:0o600});console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Production configuration planning failed; no production change was applied. Inspect the guarded inputs privately.');process.exitCode=1;});
