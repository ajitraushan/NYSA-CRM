import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const [actorId,authorizationRef='NYSA-CRM-20261028-NIA-001']=process.argv.slice(2);
const home='/home/nysareal',appName='nysa-core-dashboard-dd6262a-stage',root=path.join(home,appName);
const assert=(value,code)=>{if(!value)throw new Error(code);};
process.umask(0o077);

assert(/^[0-9a-f-]{36}$/i.test(actorId||''),'ACTOR_ID');
assert(/^[A-Za-z0-9._-]{1,120}$/.test(authorizationRef),'AUTHORIZATION_REF');
const selector=JSON.parse(fs.readFileSync(path.join(home,'.cl.selector','node-selector.json')));
const env=selector[appName]?.env_vars;
assert(env?.PGDATABASE==='nysareal_nysa_r2_rehearsal'&&env.PGUSER&&env.PGPASSWORD,'TEST_DB_BINDING');
assert(env.NIA_INTAKE_ACTOR_ID===actorId,'NIA_ACTOR_ENV');
assert(/^[0-9a-f-]{36}$/i.test(env.WEBSITE_INTAKE_ACTOR_ID||''),'WEBSITE_ACTOR');
for(const [key,value] of Object.entries(env))if(/^(LEAD_.*_ENABLED|LEAD_RESPONSE_ACTIVATION_APPROVED|META_INTAKE_ENABLED|PROPERTY_FINDER_.*(?:ENABLED|ALLOW_READS|ALLOW_DRAFT_CREATE|ALLOW_PUBLISH)|MICROSOFT365_EMAIL_ENABLED|CALENDLY_ENABLED)$/.test(key))assert(!['true','1'].includes(String(value).toLowerCase()),`LIVE_FLAG_${key}`);

const {Client}=createRequire(path.join(root,'package.json'))('pg');
const db=new Client({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD});
try{
  await db.connect();await db.query('BEGIN');
  const existing=(await db.query("SELECT id,name,email,role,status,can_post,job_role,user_classification FROM brokers WHERE id=$1 OR LOWER(email)='system.nia.intake@internal.invalid' OR name='System – NIA Intake' FOR UPDATE",[actorId])).rows;
  if(existing.length){
    assert(existing.length===1&&existing[0].id===actorId&&existing[0].name==='System – NIA Intake'&&existing[0].role==='viewer'&&existing[0].status==='active'&&Number(existing[0].can_post)===0&&existing[0].job_role===null,'ACTOR_CONFLICT');
  }else{
    const salt=crypto.randomBytes(16).toString('hex'),password=crypto.randomBytes(64).toString('hex'),passwordHash=`${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
    await db.query(`INSERT INTO brokers(id,name,email,role,can_post,status,password_hash,job_role,user_classification,access_change_reason)
      VALUES($1,'System – NIA Intake','system.nia.intake@internal.invalid','viewer',0,'active',$2,NULL,'viewer',$3)`,[actorId,passwordHash,authorizationRef]);
    await db.query("INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'Broker',$2,'nia_system_actor_created',$3,$4)",[
      crypto.randomUUID(),actorId,env.WEBSITE_INTAKE_ACTOR_ID,JSON.stringify({authorizationRef,environment:'crm-test',role:'viewer',canPost:false,passwordDiscarded:true,leadOwnershipAllowed:false})
    ]);
  }
  await db.query('COMMIT');
  console.log(JSON.stringify({status:'NIA_ACTOR_READY',actorId,name:'System – NIA Intake',role:'viewer',canPost:false,passwordDiscarded:true,productionUnchanged:true}));
}catch(error){try{await db.query('ROLLBACK');}catch{}console.log(JSON.stringify({status:'FAILED',safeCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'ACTOR_SETUP_REVIEW_REQUIRED'}));process.exitCode=1;}
finally{try{await db.end();}catch{}}
