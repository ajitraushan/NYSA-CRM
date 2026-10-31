import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const [ownerId,authorizationRef='NYSA-CRM-20261026-LEAD-001-v1.2'] = process.argv.slice(2);
const home='/home/nysareal',appName='nysa-core-dashboard-dd6262a-stage',root=path.join(home,appName);
const assert=(value,code)=>{if(!value)throw new Error(code);};
process.umask(0o077);

assert(/^[0-9a-f-]{36}$/i.test(ownerId||''),'OWNER_ID');
assert(/^[A-Za-z0-9._-]{1,120}$/.test(authorizationRef),'AUTHORIZATION_REF');
const selector=JSON.parse(fs.readFileSync(path.join(home,'.cl.selector','node-selector.json')));
const env=selector[appName]?.env_vars;
assert(env?.PGDATABASE==='nysareal_nysa_r2_rehearsal'&&env.PGUSER&&env.PGPASSWORD,'TEST_DB_BINDING');
assert(/^[0-9a-f-]{36}$/i.test(env.WEBSITE_INTAKE_ACTOR_ID||''),'WEBSITE_ACTOR');
for(const [key,value] of Object.entries(env))if(/^(LEAD_.*_ENABLED|LEAD_RESPONSE_ACTIVATION_APPROVED|META_INTAKE_ENABLED|PROPERTY_FINDER_.*(?:ENABLED|ALLOW_READS|ALLOW_DRAFT_CREATE|ALLOW_PUBLISH)|MICROSOFT365_EMAIL_ENABLED|CALENDLY_ENABLED)$/.test(key))assert(!['true','1'].includes(String(value).toLowerCase()),`LIVE_FLAG_${key}`);

for(const [key,value] of Object.entries(env))process.env[key]=String(value);
const {Client}=createRequire(path.join(root,'package.json'))('pg');
const db=new Client({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD});
let revision;
try{
  await db.connect();
  await db.query('BEGIN');
  const owner=(await db.query("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role='internal_broker' AND job_role IN ('sales_agent','manager')",[ownerId])).rows[0];
  assert(owner,'OWNER_INVALID');
  const setup=(await db.query('SELECT id,revision,draft,paused FROM lead_integration_setup WHERE singleton=TRUE FOR UPDATE')).rows[0];
  assert(setup,'SETUP_REQUIRED');assert(setup.paused!==false,'OUTREACH_NOT_PAUSED');
  revision=Number(setup.revision)+1;
  const draft={...(setup.draft||{}),fallbackOwnerId:ownerId};
  await db.query('UPDATE lead_integration_setup SET draft=$2::jsonb,revision=$3,updated_by=$4,updated_at=NOW() WHERE id=$1',[setup.id,JSON.stringify(draft),revision,env.WEBSITE_INTAKE_ACTOR_ID]);
  await db.query("INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'LeadIntegrationSetup',$2,'fallback_owner_configured',$3,$4)",[
    crypto.randomUUID(),setup.id,env.WEBSITE_INTAKE_ACTOR_ID,JSON.stringify({revision,authorizationRef,environment:'crm-test',liveSendingEnabled:false})
  ]);
  await db.query('COMMIT');
  const {recoverWebsiteFollowUpCases}=await import(path.join(root,'src','website-follow-up-intake.js')+'?dev243='+Date.now());
  await db.query('BEGIN');
  const recovery=await recoverWebsiteFollowUpCases({actorId:env.WEBSITE_INTAKE_ACTOR_ID,limit:100},db);
  await db.query('COMMIT');
  const counts=(await db.query("SELECT COUNT(*)::int AS accepted_website_leads,(SELECT COUNT(*)::int FROM lead_follow_up_cases f JOIN lead_source_inbox s ON s.id=f.source_inbox_id WHERE s.source_system='website') AS website_cases FROM lead_source_inbox WHERE source_system='website' AND state='accepted'")).rows[0];
  console.log(JSON.stringify({status:'CRM_TEST_FALLBACK_CONFIGURED',revision,recovery,acceptedWebsiteLeads:counts.accepted_website_leads,websiteCases:counts.website_cases,liveSendingEnabled:false}));
}catch(error){
  try{await db.query('ROLLBACK');}catch{}
  console.log(JSON.stringify({status:'FAILED',safeCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'CONFIGURATION_REVIEW_REQUIRED'}));process.exitCode=1;
}finally{try{await db.end();}catch{}}
