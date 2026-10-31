import {Router} from '../lib/http-kit.js';
import {randomUUID} from 'node:crypto';
import {saveLeadConnection} from '../lead-integration-connections.js';
import {PILOT_LIMITS,FOLLOW_UP_POLICY_VERSION} from '../lead-follow-up-domain.js';
export function validateIntegrationSetup(body) {
 const keys=['revision','pageIds','formIds','whatsappSenderRef','calendarConnectionRef','emailSender','fallbackOwnerId','statementVersion','consentField','consentAcceptedValue','countryField','timeZoneField','timelineField','budgetField','purposeField','areaField'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))return {error:'Only supported setup fields are allowed; do not enter credentials'};
 if(!Number.isInteger(body.revision)||body.revision<0)return {error:'Refresh setup before saving'};
 const out={};
 for(const key of ['pageIds','formIds']){
  const values=body[key]??[];
  if(!Array.isArray(values)||values.length>20||values.some(v=>typeof v!=='string'||!/^\d{1,100}$/.test(v)))return {error:'Use up to 20 numeric Page or form IDs'};
  out[key]=[...new Set(values)].sort();
 }
 for(const key of ['whatsappSenderRef','calendarConnectionRef']){
  const value=body[key]??'';
  if(typeof value!=='string'||(value!==''&&!/^[A-Za-z0-9_.:-]{1,160}$/.test(value)))return {error:'Use a valid provider reference, not a password or key'};
  out[key]=value;
 }
 if(body.emailSender && body.emailSender!=='lead@nysarealty.com')return {error:'The approved pilot sender is lead@nysarealty.com'};
 for(const key of ['statementVersion','consentField','consentAcceptedValue','countryField','timeZoneField','timelineField','budgetField','purposeField','areaField']){
  const value=body[key]??'';if(typeof value!=='string'||value.length>160||/[<>\r\n]/.test(value))return {error:'Use concise form field mappings'};out[key]=value.trim();
 }
 const owner=body.fallbackOwnerId??'';if(owner&&!/^[a-f0-9-]{36}$/i.test(owner))return {error:'Select an operating fallback owner'};
 out.fallbackOwnerId=owner;out.emailSender='lead@nysarealty.com';return {value:out};
}
export function createLeadIntegrationSetupRoutes({requireAuth,transaction,env=process.env}) {
 const r=Router();r.use(requireAuth,(req,res,next)=>req.broker?.role==='admin'?next():res.status(403).json({error:'Admin configuration access required'}));
 r.get('/admin/lead-integrations/setup',async(req,res)=>{
  try{
   const data=await transaction(async c=>{
    const setup=(await c.query('SELECT revision,draft,paused,updated_at FROM lead_integration_setup WHERE singleton=TRUE')).rows[0];
    const counts=(await c.query(`SELECT (SELECT COUNT(*)::int FROM lead_source_inbox WHERE state='pending_retrieval') AS pending_receipts,
      (SELECT COUNT(*)::int FROM lead_follow_up_cases WHERE state IN ('needs_review','outcome_unknown')) AS exceptions`)).rows[0];
        const owners=(await c.query("SELECT id,name FROM brokers WHERE status='active' AND role='internal_broker' AND job_role IN ('sales_agent','manager') ORDER BY name")).rows;
    const connections=(await c.query('SELECT provider,revision,updated_at FROM lead_integration_connections ORDER BY provider')).rows;
    const runtimeHealth=(await c.query('SELECT provider,status,safe_error_code,last_checked_at FROM lead_integration_runtime_health')).rows;
    return {revision:setup?.revision||0,draft:setup?.draft||{},owners,connections,runtimeHealth,paused:setup?.paused!==false,...counts};
   });
   res.json({...data,policyVersion:FOLLOW_UP_POLICY_VERSION,countries:['UAE','India'],limits:PILOT_LIMITS,
    connectionSetupEnabled:env.LEAD_CONNECTION_SETUP_ENABLED==='true'&&/^[a-f0-9]{64}$/i.test(env.LEAD_CONNECTION_KEY||''),liveSendingEnabled:env.LEAD_RESPONSE_LIVE_ENABLED==='true'&&!data.paused&&['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT),readiness:{meta:'setup_only',whatsapp:'setup_only',email:'setup_only',calendar:'setup_only'}});
  }catch{return res.status(503).json({error:'Integration setup is unavailable; no settings changed'});}
 });
 r.post('/admin/lead-integrations/connections/:provider',async(req,res)=>{
  if(env.LEAD_CONNECTION_SETUP_ENABLED!=='true'||!/^[a-f0-9]{64}$/i.test(env.LEAD_CONNECTION_KEY||''))return res.status(503).json({error:'Protected connection setup requires an approved setup session'});
  try{res.json(await transaction(c=>saveLeadConnection({provider:req.params.provider,body:req.body,actorId:req.broker.id,key:env.LEAD_CONNECTION_KEY},c)));}
  catch(error){res.status(error.statusCode===400?400:503).json({error:error.statusCode===400?error.message:'Protected connection could not be saved'});}
 });
 r.post('/admin/lead-integrations/pause',async(req,res)=>{
  if(typeof req.body.paused!=='boolean'||req.body.confirmed!==true)return res.status(400).json({error:'Confirm the outreach control change'});
  if(!req.body.paused && (env.LEAD_RESPONSE_ACTIVATION_APPROVED!=='true'||env.LEAD_RESPONSE_LIVE_ENABLED!=='true'||!['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)))return res.status(409).json({error:'Resume requires the separate approved CRM Test activation'});
  try{const result=await transaction(async c=>{
   const row=(await c.query('SELECT id FROM lead_integration_setup WHERE singleton=TRUE FOR UPDATE')).rows[0];if(!row)throw new Error('SETUP_REQUIRED');
   await c.query('UPDATE lead_integration_setup SET paused=$2,revision=revision+1,updated_by=$3,updated_at=NOW() WHERE id=$1',[row.id,req.body.paused,req.broker.id]);
   await c.query("INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'LeadIntegrationSetup',$2,'pause_changed',$3,$4)",[randomUUID(),row.id,req.broker.id,JSON.stringify({paused:req.body.paused})]);return {paused:req.body.paused};
  });res.json(result);}catch{res.status(503).json({error:'Outreach control could not be updated'});}
 });
 r.post('/admin/lead-integrations/setup',async(req,res)=>{
  const checked=validateIntegrationSetup(req.body);if(checked.error)return res.status(400).json({error:checked.error});
  try{
   const result=await transaction(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('nysa-lead-integration-setup'))");
    const current=(await c.query('SELECT * FROM lead_integration_setup WHERE singleton=TRUE FOR UPDATE')).rows[0];
    if((current?.revision||0)!==req.body.revision)throw Object.assign(new Error('STALE_SETUP'),{statusCode:409});
        if(checked.value.fallbackOwnerId){const owner=(await c.query("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role='internal_broker' AND job_role IN ('sales_agent','manager')",[checked.value.fallbackOwnerId])).rows[0];if(!owner)throw Object.assign(new Error('OWNER_INVALID'),{statusCode:409});}
    const setupId=current?.id||randomUUID(),revision=(current?.revision||0)+1;
    if(current)await c.query('UPDATE lead_integration_setup SET draft=$2::jsonb,revision=$3,updated_by=$4,updated_at=NOW() WHERE id=$1',
      [setupId,JSON.stringify(checked.value),revision,req.broker.id]);
    else await c.query('INSERT INTO lead_integration_setup(id,revision,draft,updated_by) VALUES($1,$2,$3::jsonb,$4)',
      [setupId,revision,JSON.stringify(checked.value),req.broker.id]);
    await c.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
      VALUES($1,'LeadIntegrationSetup',$2,'draft_saved',$3,$4)`,[randomUUID(),setupId,req.broker.id,JSON.stringify({revision,policyVersion:FOLLOW_UP_POLICY_VERSION})]);
    return {revision,status:'draft_saved',liveSendingEnabled:false};
   });res.json(result);
  }catch(error){return res.status(error.statusCode===409?409:503).json({error:error.statusCode===409?'Setup changed; refresh before saving':'Setup could not be saved'});}
 });
 return r;
}
