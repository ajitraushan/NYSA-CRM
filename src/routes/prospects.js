import {Router} from '../lib/http-kit.js';
import {audit,execute,many,one,transaction,uuid} from '../db.js';
import {requireAuth} from '../auth.js';
import {interestFields,loadProspectInterestLabels} from '../prospect-interest-labels.js';
import {hasInternalCrmIdentity} from '../crm-policy.js';
import {normalizePhone,isValidEmail} from '../crm-domain.js';
import {blocksOutbound,getContactSuppression,recordContactSuppression,releaseContactSuppression} from '../contact-suppression.js';
import {prospectCallingPolicyConfig} from '../prospect-calling-policy.js';
import { advanceProspectRetry, applyProspectRetryLimits, answeredCallStatus, validateProspectAgentTarget, validateProspectCadence, validateProspectNextStep } from '../prospect-tracking.js';
import {registerProspectUpload} from './prospect-upload.js';
import {UPLOAD_SOURCES} from '../prospect-upload.js';

import { connectedOutcomes, prospectCsvCell, prospectDashboardDrilldown, prospectDashboardFilters, prospectDashboardSummary } from '../prospect-dashboard.js';

import { digestEmailSettings } from '../prospect-digest-smtp.js';
import { prospectDigestPreview } from '../prospect-digest-worker.js';

const r=Router();
const STATUS=['not_contacted','no_answer','call_back','interested','not_interested','do_not_contact','converted'];
const SOURCES=['cold_call','referral','event','personal_network','purchased_data','other'];
const EDIT_SOURCES=[...SOURCES,...UPLOAD_SOURCES];
const OUTCOMES=['answered','no_answer','callback_requested','interested','not_interested','declined','voicemail','consumer_ended','invalid_number','other'];
const clean=value=>typeof value==='string'?(value.trim()||null):value??null;
const email=value=>clean(value)?.toLowerCase()||null;
const canManage=broker=>['manager','director'].includes(broker.jobRole);

r.use(requireAuth,(req,res,next)=>{
  const adminSettings=req.broker?.role==='admin'&&(req.path.startsWith('/api/crm/prospect-diary/calling-numbers')||req.path.startsWith('/api/crm/prospect-diary/admin/cadence-policy')||['/api/crm/prospect-diary/admin/email','/api/crm/prospect-diary/admin/email/test'].includes(req.path));
  if(!adminSettings&&(!hasInternalCrmIdentity(req.broker)||!['sales_agent','manager','director'].includes(req.broker.jobRole)))return res.status(403).json({error:'Prospect Diary access is restricted to Sales Agents and CRM leadership'});
  next();
});

function scope(alias,broker,params=[]){
  if(broker.jobRole==='director')return{clause:'1=1',params};
  params.push(broker.id);const id=`$${params.length}`;
  if(broker.jobRole==='manager')return{clause:`(${alias}.owner_id=${id} OR EXISTS(SELECT 1 FROM team_memberships m WHERE m.broker_id=${id} AND m.membership_role='manager' AND m.ends_at IS NULL AND m.team_id=${alias}.team_id))`,params};
  return{clause:`${alias}.owner_id=${id}`,params};
}

async function visibleProspect(id,broker,client,{forUpdate=false}={}){const scoped=scope('p',broker,[id]);return one(`SELECT p.*,o.name AS owner_name,t.name AS team_name FROM prospects p JOIN brokers o ON o.id=p.owner_id LEFT JOIN teams t ON t.id=p.team_id WHERE p.id=$1 AND ${scoped.clause}${forUpdate?' FOR UPDATE OF p':''}`,scoped.params,client);}
async function ownerContext(id,actor,client){
  const broker=await one("SELECT id,name,team_id,job_role FROM brokers WHERE id=$1 AND role='internal_broker' AND status='active' AND job_role IN('sales_agent','manager')",[id],client);if(!broker)return null;
  if(actor.jobRole==='director')return broker;if(actor.jobRole==='sales_agent')return actor.id===broker.id?broker:null;
  const allowed=actor.id===broker.id||await one(`SELECT 1 AS ok FROM team_memberships manager JOIN team_memberships member ON member.team_id=manager.team_id AND member.ends_at IS NULL WHERE manager.broker_id=$1 AND manager.membership_role='manager' AND manager.ends_at IS NULL AND member.broker_id=$2 LIMIT 1`,[actor.id,broker.id],client);
  return allowed?broker:null;
}

function inferredTimezone(phone){
  if(/^\+971/.test(phone))return'Asia/Dubai';if(/^\+91/.test(phone))return'Asia/Kolkata';if(/^\+44/.test(phone))return'Europe/London';if(/^\+1/.test(phone))return'America/New_York';return'Asia/Dubai';
}
function validTimezone(value){try{new Intl.DateTimeFormat('en',{timeZone:value}).format(new Date());return true;}catch{return false;}}
function localMinute(value,timezone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));return parts.hour*60+parts.minute;}
function localClock(value,timezone){return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}
async function policy(client){return (await one(`SELECT prospect_call_start_minute,prospect_call_end_minute,prospect_decline_warning_threshold,prospect_unanswered_daily_warning_threshold,prospect_unanswered_weekly_warning_threshold FROM organization_settings WHERE status='active' ORDER BY version DESC LIMIT 1`,[],client))||{prospectCallStartMinute:540,prospectCallEndMinute:1080,prospectDeclineWarningThreshold:0,prospectUnansweredDailyWarningThreshold:1,prospectUnansweredWeeklyWarningThreshold:2};}

async function callWarnings(prospect,at,client){
  const rules=await policy(client),stats=await one(`SELECT
    COUNT(*) FILTER(WHERE outcome IN('not_interested','declined'))::int AS declines,
    COUNT(*) FILTER(WHERE outcome IN('no_answer','voicemail','consumer_ended') AND (occurred_at AT TIME ZONE $2)::date=($1::timestamptz AT TIME ZONE $2)::date)::int AS unanswered_today,
    COUNT(*) FILTER(WHERE outcome IN('no_answer','voicemail','consumer_ended') AND occurred_at>=$1::timestamptz-INTERVAL '7 days')::int AS unanswered_week
    FROM prospect_activities WHERE prospect_id=$3 AND activity_type='call' AND direction='outbound'`,[at,prospect.timezone,prospect.id],client);
  const warnings=[];
  if(stats.declines>Number(rules.prospectDeclineWarningThreshold))warnings.push('repeat_after_decline');
  if(stats.unansweredToday>=Number(rules.prospectUnansweredDailyWarningThreshold))warnings.push('unanswered_daily_threshold');
  if(stats.unansweredWeek>=Number(rules.prospectUnansweredWeeklyWarningThreshold))warnings.push('unanswered_weekly_threshold');
  return{warnings,stats,policy:rules};
}
function requireWarningAcknowledgement(body,result){
  if(!result.warnings.length)return null;
  if(body.warningAcknowledged&&clean(body.warningReason)?.length>=5)return null;
  const outsideWindow=result.warnings.includes('outside_calling_window');
  return{code:409,error:outsideWindow?result.outsideCallingHoursMessage:'Repeat-call policy warning requires acknowledgement and a reason; it does not block the call',warning:true,...result};
}
function applyOutsideCallingHours(result,{at,timezone}){const minute=localMinute(at,timezone),outside=minute<Number(result.policy.prospectCallStartMinute)||minute>=Number(result.policy.prospectCallEndMinute);if(!outside)return null;const mode=prospectCallingPolicyConfig().outsideCallingHoursMode,clock=localClock(at,timezone),message=`This is outside the permitted calling hours (09:00–18:00 in the prospect’s local time — now ${clock} there). UAE rules limit marketing calls to these hours. Confirm the customer requested this time and give the reason.`;result.outsideCallingHoursMode=mode;result.outsideCallingHoursMessage=message;result.prospectLocalTime=clock;if(mode==='refuse')return{code:409,error:message,warning:false,mode,prospectTimezone:timezone,prospectLocalTime:clock};result.warnings.push('outside_calling_window');return null;}

async function duplicateSummary(phone,mail,broker,client,{excludeProspectId=null}={}){
  const global=await one(`SELECT
    EXISTS(SELECT 1 FROM contacts c WHERE c.archived_at IS NULL AND (c.phone=$1 OR EXISTS(SELECT 1 FROM contact_channels cc WHERE cc.contact_id=c.id AND cc.channel_kind='Phone' AND cc.normalized_value=$1))) AS customer_phone,
    EXISTS(SELECT 1 FROM contacts c WHERE c.archived_at IS NULL AND $2::text IS NOT NULL AND (LOWER(c.email)=$2 OR EXISTS(SELECT 1 FROM contact_channels cc WHERE cc.contact_id=c.id AND cc.channel_kind='Email' AND cc.normalized_value=$2))) AS customer_email,
    EXISTS(SELECT 1 FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE c.phone=$1 OR ($2::text IS NOT NULL AND c.email=$2)) AS lead_match,
    EXISTS(SELECT 1 FROM prospects p WHERE ($3::uuid IS NULL OR p.id<>$3) AND (p.normalized_phone=$1 OR ($2::text IS NOT NULL AND p.normalized_email=$2))) AS prospect_match`,[phone,mail,excludeProspectId],client);
  const params=[phone,mail],actor='$3',prospectParams=[phone,mail,excludeProspectId],prospectActor='$4';
  if(broker.jobRole!=='director'){params.push(broker.id);prospectParams.push(broker.id);}
  const contactClause=broker.jobRole==='director'?'1=1':broker.jobRole==='manager'?`(c.owner_id=${actor} OR EXISTS(SELECT 1 FROM brokers co JOIN team_memberships member ON member.broker_id=co.id AND member.ends_at IS NULL JOIN team_memberships manager ON manager.team_id=member.team_id AND manager.ends_at IS NULL AND manager.membership_role='manager' WHERE co.id=c.owner_id AND manager.broker_id=${actor}))`:`c.owner_id=${actor}`;
  const leadClause=broker.jobRole==='director'?'1=1':broker.jobRole==='manager'?`(l.assigned_to=${actor} OR EXISTS(SELECT 1 FROM team_memberships manager WHERE manager.broker_id=${actor} AND manager.membership_role='manager' AND manager.ends_at IS NULL AND manager.team_id=l.assigned_team_id))`:`l.assigned_to=${actor}`;
  const prospectScope=broker.jobRole==='director'?'1=1':broker.jobRole==='manager'?`(p.owner_id=${prospectActor} OR EXISTS(SELECT 1 FROM team_memberships m WHERE m.broker_id=${prospectActor} AND m.membership_role='manager' AND m.ends_at IS NULL AND m.team_id=p.team_id))`:`p.owner_id=${prospectActor}`;
  const [customers,leads,prospects]=await Promise.all([
    many(`SELECT DISTINCT c.id,c.full_name FROM contacts c LEFT JOIN contact_channels cc ON cc.contact_id=c.id WHERE c.archived_at IS NULL AND ${contactClause} AND (c.phone=$1 OR (cc.channel_kind='Phone' AND cc.normalized_value=$1) OR ($2::text IS NOT NULL AND (LOWER(c.email)=$2 OR (cc.channel_kind='Email' AND cc.normalized_value=$2)))) ORDER BY c.full_name`,params,client),
    many(`SELECT l.id,l.lead_reference,l.title FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE ${leadClause} AND (c.phone=$1 OR ($2::text IS NOT NULL AND c.email=$2)) ORDER BY l.created_at DESC`,params,client),
    many(`SELECT p.id,p.display_name,p.status FROM prospects p WHERE ${prospectScope} AND ($3::uuid IS NULL OR p.id<>$3) AND (p.normalized_phone=$1 OR ($2::text IS NOT NULL AND p.normalized_email=$2)) ORDER BY p.updated_at DESC`,prospectParams,client)
  ]);
  const globalMatch=Boolean(global.customerPhone||global.customerEmail||global.leadMatch||global.prospectMatch);
  return{globalMatch,customers,leads,prospects,outsideScope:globalMatch&&!customers.length&&!leads.length&&!prospects.length};
}

registerProspectUpload(r,{duplicateSummary,inferredTimezone});

const taskExists=`EXISTS(SELECT 1 FROM tasks f WHERE f.prospect_id=p.id AND f.task_type='prospect_follow_up' AND f.status IN('open','in_progress')`;
r.get('/crm/prospects',async(req,res)=>{
  const params=[],scoped=scope('p',req.broker,params),where=[scoped.clause];
  if(clean(req.query.status)){if(!STATUS.includes(req.query.status))return res.status(400).json({error:'Invalid status'});params.push(req.query.status);where.push(`p.status=$${params.length}`);}
  if(clean(req.query.q)){params.push(`%${String(req.query.q).trim()}%`);where.push(`(p.display_name ILIKE $${params.length} OR p.phone ILIKE $${params.length} OR p.email ILIKE $${params.length})`);}
  const localDueDate=`(f.due_at AT TIME ZONE p.timezone)::date`,localToday=`(NOW() AT TIME ZONE p.timezone)::date`;
  if(['overdue','today','upcoming'].includes(req.query.due)){const duePredicate=req.query.due==='overdue'?`f.due_at<NOW()`:req.query.due==='today'?`${localDueDate}=${localToday}`:`${localDueDate}>${localToday}`;where.push(`${taskExists} AND ${duePredicate})`);}
  const summaryScope=scope('p',req.broker,[]),summary=await one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='interested')::int AS interested,COUNT(*) FILTER(WHERE status='do_not_contact')::int AS do_not_contact,COUNT(*) FILTER(WHERE ${taskExists} AND f.due_at<NOW()))::int AS overdue,COUNT(*) FILTER(WHERE ${taskExists} AND ${localDueDate}=${localToday}))::int AS today,COUNT(*) FILTER(WHERE ${taskExists} AND ${localDueDate}>${localToday}))::int AS upcoming FROM prospects p WHERE ${summaryScope.clause}`,summaryScope.params);
  const [prospects,agents]=await Promise.all([many(`SELECT p.*,o.name AS owner_name,t.name AS team_name,a.occurred_at AS last_contact_at,a.outcome AS last_outcome,n.id AS next_action_id,n.subject AS next_action_subject,n.due_at AS next_action_due_at FROM prospects p JOIN brokers o ON o.id=p.owner_id LEFT JOIN teams t ON t.id=p.team_id LEFT JOIN LATERAL(SELECT occurred_at,outcome FROM prospect_activities WHERE prospect_id=p.id AND activity_type='call' ORDER BY occurred_at DESC,id DESC LIMIT 1)a ON TRUE LEFT JOIN LATERAL(SELECT id,subject,due_at FROM tasks WHERE prospect_id=p.id AND task_type='prospect_follow_up' AND status IN('open','in_progress') ORDER BY due_at,id LIMIT 1)n ON TRUE WHERE ${where.join(' AND ')} ORDER BY COALESCE(n.due_at,'infinity'::timestamptz),p.updated_at DESC LIMIT 500`,params),req.broker.jobRole==='sales_agent'?Promise.resolve([]):many(`SELECT DISTINCT b.id,b.name,b.job_role FROM brokers b WHERE b.status='active' AND b.role='internal_broker' AND b.job_role='sales_agent' AND ($1='director' OR EXISTS(SELECT 1 FROM team_memberships manager JOIN team_memberships member ON member.team_id=manager.team_id AND member.ends_at IS NULL WHERE manager.broker_id=$2 AND manager.membership_role='manager' AND manager.ends_at IS NULL AND member.broker_id=b.id)) ORDER BY b.name`,[req.broker.jobRole,req.broker.id])]);
  res.json({summary,prospects,agents,canManage:canManage(req.broker)});
});

r.post('/crm/prospects',async(req,res)=>{
  const b=req.body||{},phone=normalizePhone(b.phone),mail=email(b.email),source=b.source||'cold_call';if(!phone)return res.status(400).json({error:'Phone must use international format, for example +971501234567'});if(mail&&!isValidEmail(mail))return res.status(400).json({error:'Email format is invalid'});if(!SOURCES.includes(source))return res.status(400).json({error:'Invalid source'});
  if(source==='purchased_data'&&![b.sourceSupplier,b.sourceBatchReference,b.sourceAcquiredAt,b.sourceEvidenceReference].every(clean))return res.status(400).json({error:'Purchased data requires supplier, batch, acquisition time and evidence reference'});
  const timezone=clean(b.timezone)||inferredTimezone(phone);if(!validTimezone(timezone))return res.status(400).json({error:'Prospect timezone is invalid'});
  const result=await transaction(async client=>{
    const existing=await one('SELECT id FROM prospects WHERE normalized_phone=$1',[phone],client);if(existing)return{code:409,error:'This phone already has a Prospect Diary record'};
    const suppression=await getContactSuppression(phone,client);if(suppression.strongest==='wrong_number')return{code:409,error:'A confirmed wrong-number restriction blocks Prospect creation'};
    const duplicates=await duplicateSummary(phone,mail,req.broker,client),owner=await ownerContext(req.broker.id,req.broker,client),id=uuid(),restricted=blocksOutbound(suppression);
    const row=await one(`INSERT INTO prospects(id,display_name,phone,normalized_phone,email,normalized_email,source,source_supplier,source_batch_reference,source_acquired_at,source_evidence_reference,brief_notes,status,owner_id,team_id,timezone,timezone_source,consent_status,consent_evidence_reference,suppression_snapshot,do_not_contact_reason,do_not_contact_at,created_by) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$13) RETURNING *`,[id,clean(b.displayName),String(b.phone).trim(),phone,mail,source,clean(b.sourceSupplier),clean(b.sourceBatchReference),clean(b.sourceAcquiredAt),clean(b.sourceEvidenceReference),clean(b.briefNotes),restricted?'do_not_contact':'not_contacted',req.broker.id,owner?.teamId||req.broker.teamId||null,timezone,clean(b.timezone)?'agent_confirmed':'phone_inferred',b.consentStatus||'unknown',clean(b.consentEvidenceReference),suppression.restrictions,restricted?`Shared restriction: ${suppression.strongest}`:null,restricted?new Date():null],client);
    await audit('Prospect',id,'created',req.broker.id,{source,status:row.status,duplicateSummary:{globalMatch:duplicates.globalMatch,outsideScope:duplicates.outsideScope},restriction:suppression.strongest},client);return{prospect:row,duplicates};
  });if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});



async function dashboardRequest(req){
  const filters=prospectDashboardFilters(req.query);
  if(filters.error)return {code:400,error:filters.error};
  const actor=req.broker;
  if(filters.agent&&filters.agent!==actor.id&&(!canManage(actor)||!await ownerContext(filters.agent,actor))) {
    return {code:404,error:'Agent not found'};
  }
  if(filters.team){
    const team=await one(
      "SELECT id FROM teams WHERE id=$1 AND ($2='director' OR EXISTS (SELECT 1 FROM team_memberships m WHERE m.team_id=teams.id AND m.broker_id=$3 AND m.ends_at IS NULL AND ($2='sales_agent' OR m.membership_role='manager')))",
      [filters.team,actor.jobRole,actor.id]);
    if(!team)return {code:404,error:'Team not found'};
  }
  if(filters.batch){
    const scoped=scope('p',actor,[filters.batch]);
    const batch=await one('SELECT 1 FROM prospects p WHERE p.upload_batch_id=$1 AND '+scoped.clause+' LIMIT 1',scoped.params);
    if(!batch)return {code:404,error:'Upload batch not found'};
  }
  const page=Number(req.query?.page??1);
  if(!Number.isInteger(page)||page<1||page>2000)return {code:400,error:'Invalid page'};
  const params=[filters.from,filters.to,filters.bucket,filters.team,filters.agent,filters.batch,filters.source,connectedOutcomes,(page-1)*50];
  // Keep the first nine positions stable for the SQL and append actor scope last.
  return {filters,scoped:scope('p',actor,params)};
}

r.get('/crm/prospect-diary/dashboard',async(req,res)=>{
  const input=await dashboardRequest(req);
  if(input.error)return res.status(input.code).json({error:input.error});
  const data=await one(prospectDashboardSummary(input.scoped),input.scoped.params);
  const rate=data.tiles.callsMade ? data.tiles.callsConnected/data.tiles.callsMade : null;
  const visible=scope('p',req.broker);
  const [teams,agents,batches]=await Promise.all([
    many('SELECT DISTINCT t.id,t.name FROM prospects p JOIN teams t ON t.id=p.team_id WHERE '+visible.clause+' ORDER BY t.name,t.id',visible.params),
    canManage(req.broker)?many(`SELECT b.id,b.name FROM brokers b WHERE b.role='internal_broker' AND b.job_role='sales_agent' AND b.status='active' AND
      ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM team_memberships m JOIN team_memberships member
        ON member.team_id=m.team_id AND member.ends_at IS NULL
        WHERE m.broker_id=$1 AND m.membership_role='manager' AND m.ends_at IS NULL AND member.broker_id=b.id))
      ORDER BY b.name,b.id`,[req.broker.jobRole==='director'?null:req.broker.id]):[],
    many('SELECT DISTINCT b.id,b.file_name AS name FROM prospects p JOIN prospect_upload_batches b ON b.id=p.upload_batch_id WHERE '+visible.clause+' ORDER BY id LIMIT 500',visible.params),
  ]);
  return res.json({...data,canReviewOverrides:canManage(req.broker),agents:canManage(req.broker)?data.agents:[],tiles:{...data.tiles,connectRate:rate},filters:input.filters,options:{teams,agents,batches}});
});

r.get('/crm/prospect-diary/dashboard/drilldown',async(req,res)=>{
  const input=await dashboardRequest(req);
  if(input.error)return res.status(input.code).json({error:input.error});
  const sql=prospectDashboardDrilldown(input.scoped,req.query?.metric);
  if(!sql)return res.status(400).json({error:'Unknown drill-down metric'});
  const rows=await many(sql,input.scoped.params);
  return res.json({rows,total:rows[0]?.total??0});
});

r.get('/crm/prospect-diary/dashboard/export.csv',async(req,res)=>{
  const input=await dashboardRequest(req);
  if(input.error)return res.status(input.code).json({error:input.error});
  const metric=req.query?.metric;
  const agentExport=metric==='agents';
  if(agentExport&&!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});
  input.scoped.params[8]=0;
  const sql=agentExport?prospectDashboardSummary(input.scoped):prospectDashboardDrilldown(input.scoped,metric,{exportAll:true});
  if(!sql)return res.status(400).json({error:'Unknown export metric'});
  const rows=agentExport?(await one(sql,input.scoped.params)).agents:await many(sql,input.scoped.params);
  if(rows.length>50000)return res.status(413).json({error:'Narrow the export filters to 50,000 rows or fewer'});
  const fields=agentExport?['name','team','target','calls_made','calls_connected','new_interested','conversions','follow_ups_due','follow_ups_on_time',
    'overdue','untouched_two_days','untouched_seven_days','untouched_fourteen_days','overrides','last_call']
    : ['id','displayName','ownerId','status','source','createdAt','activityId','occurredAt','outcome'];
  const csv=[fields.join(','),...rows.map(row=>fields.map(key=>prospectCsvCell(row[key])).join(','))].join('\r\n');
  await audit('Broker',req.broker.id,'prospect_dashboard_export',req.broker.id,{metric:req.query.metric,filters:input.filters,rows:rows.length});
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="prospect-dashboard.csv"');
  return res.end(csv);
});


r.get('/crm/prospect-diary/admin/email',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  const flagged=await many(
    "SELECT recipient_email,count(DISTINCT (last_attempt_at AT TIME ZONE 'Asia/Dubai')::date)::int AS failed_days " +
    "FROM prospect_digest_runs WHERE status='failed' GROUP BY recipient_email HAVING count(DISTINCT (last_attempt_at AT TIME ZONE 'Asia/Dubai')::date)>=3 ORDER BY recipient_email");
  return res.json({settings:digestEmailSettings(),flagged});
});


r.post('/crm/prospect-diary/admin/email/test',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  if(Object.keys(req.body||{}).length)return res.status(400).json({error:'The test recipient is the signed-in Admin'});
  const settings=digestEmailSettings();
  const limit=Number(process.env.PROSPECT_DIGEST_HOURLY_LIMIT);
  if(settings.environment!=='crm-test'||!settings.enabled||!Number.isSafeInteger(limit)||limit<1) {
    return res.status(409).json({error:'Admin test delivery is not enabled on CRM Test'});
  }
  const email=req.broker.email?.trim().toLowerCase();
  const allowList=String(process.env.PROSPECT_DIGEST_TEST_RECIPIENTS??'').toLowerCase().split(',').map(value=>value.trim());
  if(!email||!allowList.includes(email))return res.status(403).json({error:'Your CRM address is outside the CRM Test allow-list'});
  const run=await transaction(async client=>{
    const row=await one(
      "INSERT INTO prospect_digest_runs(id,recipient_id,recipient_email,audience,report_date,status,next_attempt_at) "+
      "VALUES($1,$2,$3,'admin_test',(now() AT TIME ZONE 'Asia/Dubai')::date,'pending',now()) "+
      "ON CONFLICT(recipient_id,audience,report_date) DO NOTHING RETURNING id,status",
      [uuid(),req.broker.id,email],client);
    if(row)await audit('Broker',req.broker.id,'prospect_digest_admin_test_queued',req.broker.id,{runId:row.id},client);
    return row;
  });
  if(!run)return res.status(409).json({error:'A test email was already queued today'});
  return res.status(202).json({run});
});

r.patch('/crm/prospect-diary/digest/preference',async(req,res)=>{
  const optOut=req.body?.optOut;
  if(typeof optOut!=='boolean')return res.status(400).json({error:'Specify the digest preference'});
  await transaction(async client=>{
    await execute('UPDATE brokers SET prospect_digest_opt_out=$2 WHERE id=$1',[req.broker.id,optOut],client);
    await audit('Broker',req.broker.id,'prospect_digest_preference_changed',req.broker.id,{optOut},client);
  });
  return res.json({optOut});
});

r.get('/crm/prospect-diary/digest/preview',async(req,res)=>{
  const today=new Date(Date.now()+4*3600000).toISOString().slice(0,10);
  const date=req.query?.date??today;
  const filter=prospectDashboardFilters({period:'custom',from:date,to:date});
  if(filter.error)return res.status(400).json({error:filter.error});
  const [preview,preference]=await Promise.all([
    prospectDigestPreview(req.broker,date),
    one('SELECT prospect_digest_opt_out FROM brokers WHERE id=$1',[req.broker.id]),
  ]);
  return res.json({...preview,optOut:Boolean(preference?.prospectDigestOptOut)});
});

const cadencePath = '/crm/prospect-diary/admin/cadence-policy';

r.get(cadencePath,async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  const versions=await many("SELECT * FROM prospect_cadence_policy_versions WHERE status IN('active','draft') ORDER BY status,created_at DESC,id");
  return res.json({versions});
});

r.post(cadencePath,async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  const settings=validateProspectCadence(req.body||{});
  if(settings.error)return res.status(400).json(settings);
  const version=await transaction(async client=>{
    const row=await one(
      "INSERT INTO prospect_cadence_policy_versions(id,status,daily_target,working_days,first_call_days,retry_gaps,park_on_exhaustion,created_by) VALUES($1,'draft',$2,$3,$4,$5,$6,$7) RETURNING *",
      [uuid(),settings.dailyTarget,settings.workingDays,settings.firstCallDays,settings.retryGaps,settings.parkOnExhaustion,req.broker.id],client);
    await audit('OrganizationSettings',row.id,'prospect_cadence_draft_created',req.broker.id,settings,client);
    return row;
  });
  return res.status(201).json({version});
});

r.post(cadencePath+'/:id/discard',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  if(!validProspectTrackingId(req.params.id))return res.status(404).json({error:'Cadence draft not found'});
  const discarded=await transaction(async client=>{
    const row=await one("UPDATE prospect_cadence_policy_versions SET status='retired' WHERE id=$1 AND status='draft' RETURNING id",[req.params.id],client);
    if(row)await audit('OrganizationSettings',row.id,'prospect_cadence_draft_discarded',req.broker.id,{},client);
    return row;
  });
  if(!discarded)return res.status(404).json({error:'Cadence draft not found'});
  return res.json({discarded:true});
});

r.post(cadencePath+'/:id/approve',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Admin access is required'});
  if(!validProspectTrackingId(req.params.id))return res.status(404).json({error:'Cadence draft not found'});
  const version=await transaction(async client=>{
    await execute("SELECT pg_advisory_xact_lock(hashtextextended('prospect-cadence-policy-approval',0))",[],client);
    const draft=await one("SELECT id FROM prospect_cadence_policy_versions WHERE id=$1 AND status='draft' FOR UPDATE",[req.params.id],client);
    if(!draft)return null;
    const previous=await one("UPDATE prospect_cadence_policy_versions SET status='retired' WHERE status='active' RETURNING id",[],client);
    const row=await one("UPDATE prospect_cadence_policy_versions SET status='active',approved_by=$2,approved_at=now() WHERE id=$1 RETURNING *",
      [draft.id,req.broker.id],client);
    await audit('OrganizationSettings',row.id,'prospect_cadence_approved',req.broker.id,{previousId:previous?.id??null},client);
    return row;
  });
  if(!version)return res.status(404).json({error:'Cadence draft not found'});
  return res.json({version});
});

function validProspectTrackingId(id){
  return typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
}

r.post('/crm/prospect-diary/targets/:agentId',async(req,res)=>{
  if(!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});
  const id=req.params.agentId;
  if(!validProspectTrackingId(id))return res.status(404).json({error:'Agent not found'});
  const input=validateProspectAgentTarget(req.body||{});
  if(input.error)return res.status(400).json(input);
  const target=await transaction(async client=>{
    const agent=await ownerContext(id,req.broker,client);
    if(agent?.jobRole!=='sales_agent')return null;
    const row=await one("INSERT INTO prospect_agent_targets(id,agent_id,effective_from,daily_target,reason,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [uuid(),id,input.effectiveFrom,input.dailyTarget,input.reason,req.broker.id],client);
    await audit('Broker',id,'prospect_daily_target_set',req.broker.id,{targetId:row.id,...input},client);
    return row;
  });
  if(!target)return res.status(404).json({error:'Agent not found'});
  return res.status(201).json({target});
});

r.get('/crm/prospect-diary/today',async(req,res)=>{
  const agent=req.query?.agent||req.broker.id;
  const viewingAnother=agent!==req.broker.id;
  const viewedAgent=viewingAnother&&validProspectTrackingId(agent)&&canManage(req.broker)
    ? await ownerContext(agent,req.broker) : null;
  if(!validProspectTrackingId(agent)||(viewingAnother&&!viewedAgent)) {
    return res.status(404).json({error:'Agent not found'});
  }
  const scoped=scope('p',req.broker,[agent]);
  const rows=await many(`
    WITH clock AS (
      SELECT now() AS at, date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AS day
    ), candidates AS (
      SELECT p.id,p.display_name,p.phone,p.source,p.purpose,p.budget_band,p.property_type,p.market,p.timeline,
        p.first_call_due_at,p.next_retry_at,p.retry_attempts,p.created_at,
        p.first_call_due_at < clock.at AS first_call_overdue,
        moved.retry_moved,
        f.id AS follow_up_id,coalesce(f.due_at,recontact.due_at) AS due_at,f.prospect_channel,
        recontact.due_at IS NOT NULL AS timing_recontact,
        latest.outcome AS last_outcome,latest.occurred_at AS last_occurred_at,
        left(latest_note.notes,120) AS last_note,
        CASE
          WHEN f.due_at < clock.at THEN 1
          WHEN f.due_at < (clock.day+interval '1 day') AT TIME ZONE 'Asia/Dubai' AND latest.outcome='callback_requested' THEN 3
          WHEN f.due_at < (clock.day+interval '1 day') AT TIME ZONE 'Asia/Dubai' OR recontact.due_at IS NOT NULL THEN 2
          WHEN p.next_retry_at < (clock.day+interval '1 day') AT TIME ZONE 'Asia/Dubai' THEN 4
          WHEN p.status='not_contacted' AND NOT EXISTS (
            SELECT 1 FROM tasks snoozed WHERE snoozed.prospect_id=p.id AND snoozed.task_type='prospect_follow_up'
              AND snoozed.status IN('open','in_progress') AND snoozed.snoozed_until>clock.at
          ) AND NOT EXISTS (
            SELECT 1 FROM prospect_activities a WHERE a.prospect_id=p.id AND a.activity_type='call' AND a.direction='outbound'
          ) THEN 5
          WHEN moved.retry_moved IS NOT NULL THEN 6
        END AS priority
      FROM prospects p CROSS JOIN clock
      LEFT JOIN LATERAL (
        SELECT t.id,t.due_at,t.prospect_channel FROM tasks t
        WHERE t.prospect_id=p.id AND t.task_type='prospect_follow_up' AND t.status IN('open','in_progress')
          AND (t.snoozed_until IS NULL OR t.snoozed_until<=clock.at)
          AND (p.normalized_phone IS NOT NULL OR t.prospect_channel='email')
        ORDER BY t.due_at,t.id LIMIT 1
      ) f ON true
      LEFT JOIN LATERAL (
        SELECT a.outcome,a.occurred_at,a.not_interested_reason,a.recontact_month,a.next_step FROM prospect_activities a
        WHERE a.prospect_id=p.id AND a.activity_type='call'
        ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT (g.day AT TIME ZONE 'Asia/Dubai') AS due_at
        FROM prospect_cadence_policy_versions policy
        CROSS JOIN LATERAL generate_series(latest.recontact_month::timestamp,latest.recontact_month::timestamp+interval '6 days','1 day') g(day)
        WHERE policy.status='active' AND p.status='not_interested' AND latest.next_step='close_not_interested'
          AND latest.not_interested_reason='timing' AND extract(isodow FROM g.day)::smallint=ANY(policy.working_days)
          AND g.day<=clock.day
        ORDER BY g.day LIMIT 1
      ) recontact ON true
      LEFT JOIN LATERAL (
        SELECT log.details::jsonb AS retry_moved FROM audit_log log
        WHERE log.entity_type='Prospect' AND log.entity_id=p.id AND log.action='weekly_retry_moved'
          AND (log.details::jsonb->>'movedAt')::timestamptz=p.next_retry_at
        ORDER BY log.timestamp DESC,log.id DESC LIMIT 1
      ) moved ON p.next_retry_at IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT a.notes FROM prospect_activities a WHERE a.prospect_id=p.id
        ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1
      ) latest_note ON true
      WHERE p.owner_id=$1 AND ${scoped.clause}
        AND p.status NOT IN('do_not_contact','converted') AND (p.status<>'not_interested' OR recontact.due_at IS NOT NULL) AND p.parked_at IS NULL
        AND (p.normalized_phone IS NOT NULL OR f.prospect_channel='email')
        AND NOT EXISTS (
          SELECT 1 FROM wa_contact_suppressions s WHERE s.normalized_phone=p.normalized_phone AND
          (s.restrictions @> '{"opt_out":{"active":true}}' OR s.restrictions @> '{"do_not_contact":{"active":true}}'
           OR s.restrictions @> '{"dncr":{"active":true}}' OR s.restrictions @> '{"wrong_number":{"active":true}}')
        )
    )
    SELECT *,count(*) FILTER (WHERE priority<6) OVER()::int AS queue_total
    FROM candidates WHERE priority IS NOT NULL
    ORDER BY priority,(priority=5 AND first_call_overdue IS TRUE) DESC,
      CASE WHEN priority<=3 THEN due_at WHEN priority=4 THEN last_occurred_at
        WHEN priority=6 THEN next_retry_at ELSE created_at END,id
    LIMIT 500`,scoped.params);
  const filters=prospectDashboardFilters({});
  const metrics=scope('p',req.broker,[filters.from,filters.to,'day',null,agent,null,null,connectedOutcomes,0]);
  const performance=await one(prospectDashboardSummary(metrics),metrics.params);
  const personal=performance.agents.find(row=>row.id===agent);
  const calling=await policy();
  const local=localMinute(new Date(),'Asia/Dubai');
  return res.json({items:rows,queueTotal:rows[0]?.queueTotal??0,readOnly:viewingAnother,agentName:viewedAgent?.name??null,
    callsMade:personal?.calls_made??0,connected:personal?.calls_connected??0,target:personal?.target??0,
    outsideCallingHours:local<calling.prospectCallStartMinute||local>=calling.prospectCallEndMinute});
});



r.post('/crm/prospects/:id/retry-again',async(req,res)=>{
  if(!validProspectTrackingId(req.params.id))return res.status(404).json({error:'Prospect not found'});
  const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
  if(reason.length<5||reason.length>1000)return res.status(400).json({error:'Enter a meaningful reason'});
  const result=await transaction(async client=>{
    const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});
    if(!prospect)return {code:404,error:'Prospect not found'};
    if(prospect.ownerId!==req.broker.id)return {code:403,error:'Only the owning Agent can reopen retries'};
    if(!prospect.parkedAt||!prospect.normalizedPhone||['do_not_contact','converted','not_interested'].includes(prospect.status)) {
      return {code:409,error:'This prospect is not eligible for another retry'};
    }
    if(blocksOutbound(await getContactSuppression(prospect.normalizedPhone,client)))return {code:409,error:'Outreach is blocked by suppression'};
    const at=new Date();
    const warnings=await callWarnings(prospect,at,client);
    if(warnings.warnings.length)return {code:409,error:'The existing repeat-call policy does not yet permit another retry'};
    await execute('UPDATE prospects SET parked_at=NULL,retry_attempts=0,next_retry_at=now(),updated_at=now() WHERE id=$1',[prospect.id],client);
    await audit('Prospect',prospect.id,'retry_reopened',req.broker.id,{reason},client);
    return {reopened:true};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  return res.json(result);
});

r.patch('/crm/prospects/:id/follow-ups/:taskId/snooze',async(req,res)=>{
  if(!validProspectTrackingId(req.params.id)||!validProspectTrackingId(req.params.taskId))return res.status(404).json({error:'Follow-up not found'});
  const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
  const until=new Date(req.body?.until??'');
  const now=Date.now(),dubaiDay=time=>new Date(time+4*3600000).toISOString().slice(0,10);
  if(reason.length<5||reason.length>1000||!Number.isFinite(until.getTime())||until.getTime()<=now||dubaiDay(until.getTime())!==dubaiDay(now)) {
    return res.status(400).json({error:'Choose a later time today in Dubai and enter a meaningful reason'});
  }
  const result=await transaction(async client=>{
    const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});
    if(!prospect)return {code:404,error:'Follow-up not found'};
    if(prospect.ownerId!==req.broker.id)return {code:403,error:'Only the owning Agent can snooze follow-ups'};
    const task=await one(
      "UPDATE tasks SET snoozed_until=$3,snooze_reason=$4,updated_at=now() WHERE id=$1 AND prospect_id=$2 "+
      "AND task_type='prospect_follow_up' AND assignee_id=$5 AND status IN('open','in_progress') RETURNING id,due_at,snoozed_until",
      [req.params.taskId,prospect.id,until,reason,req.broker.id],client);
    if(!task)return {code:404,error:'Follow-up not found'};
    await audit('Task',task.id,'prospect_follow_up_snoozed',req.broker.id,{snoozedUntil:until,reason},client);
    return {task};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  return res.json(result);
});

r.get('/crm/prospect-diary/overrides',async(req,res)=>{
  if(!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});
  const status=req.query?.status??'all';
  const actor=req.query?.agent??null;
  const warning=req.query?.warning??'all';
  if(!['all','outside_calling_window','repeat_after_decline','unanswered_daily_threshold','unanswered_weekly_threshold'].includes(warning)){
    return res.status(400).json({error:'Choose all warnings, outside calling hours, repeat after decline, or a daily or weekly unanswered-call warning'});
  }
  if(!['all','unreviewed','reviewed'].includes(status)|| (actor&&!validProspectTrackingId(actor))) {
    return res.status(400).json({error:'Invalid override filter'});
  }
  if(actor&&!await ownerContext(actor,req.broker))return res.status(404).json({error:'Agent not found'});
  const params=[status,actor,warning],activityScope=scope('p',req.broker,params),taskScope=scope('p',req.broker,params);
  const rows=await many(`WITH evidence AS (
    SELECT p.id AS prospect_id,p.id::text AS prospect_reference,p.display_name,o.name AS owner_name,'activity'::text AS evidence_type,a.id AS evidence_id,a.warning_codes,a.warning_reason,a.occurred_at AS recorded_at,b.name AS actor_name,to_char(a.occurred_at AT TIME ZONE p.timezone,'YYYY-MM-DD HH24:MI') AS prospect_local_time, right(p.normalized_phone,4) AS phone_last_four,a.created_by AS actor_id,p.team_id
      FROM prospects p JOIN brokers o ON o.id=p.owner_id JOIN prospect_activities a ON a.prospect_id=p.id JOIN brokers b ON b.id=a.created_by
     WHERE ${activityScope.clause} AND cardinality(a.warning_codes)>0
    UNION ALL
    SELECT p.id,p.id::text,p.display_name,o.name,'follow_up',f.id,f.policy_warning_codes,f.policy_warning_reason,f.created_at,b.name,to_char(f.due_at AT TIME ZONE p.timezone,'YYYY-MM-DD HH24:MI'),right(p.normalized_phone,4),f.created_by,p.team_id
      FROM prospects p JOIN brokers o ON o.id=p.owner_id JOIN tasks f ON f.prospect_id=p.id JOIN brokers b ON b.id=f.created_by
     WHERE ${taskScope.clause} AND f.task_type='prospect_follow_up' AND cardinality(f.policy_warning_codes)>0
  ), reviewed AS (
    SELECT e.*,t.name AS team_name,v.reviewed_by,v.reviewed_at,v.comment,b.name AS reviewed_by_name
    FROM evidence e LEFT JOIN prospect_override_reviews v ON
      (e.evidence_type='activity' AND v.activity_id=e.evidence_id)
      OR (e.evidence_type='follow_up' AND v.task_id=e.evidence_id)
    LEFT JOIN brokers b ON b.id=v.reviewed_by
    LEFT JOIN teams t ON t.id=e.team_id
    WHERE ($2::uuid IS NULL OR e.actor_id=$2) AND ($3='all' OR $3=ANY(e.warning_codes))
  ), summary AS (
    SELECT count(*) FILTER (WHERE reviewed_at IS NULL)::int AS unreviewed_count FROM reviewed
  )
  SELECT r.*,s.unreviewed_count FROM summary s LEFT JOIN reviewed r ON
    ($1='all' OR ($1='unreviewed' AND r.reviewed_at IS NULL) OR ($1='reviewed' AND r.reviewed_at IS NOT NULL))
  ORDER BY (r.reviewed_at IS NULL AND 'repeat_after_decline'=ANY(r.warning_codes)) DESC,
    r.recorded_at DESC,r.evidence_id LIMIT 500`,params);
  res.json({overrides:rows.filter(row=>row.evidenceId),unreviewedCount:rows[0]?.unreviewedCount ?? 0});
});


r.post('/crm/prospect-diary/overrides/:id/review',async(req,res)=>{
  if(!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});
  const id=req.params.id;
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return res.status(404).json({error:'Override not found'});
  const type=req.body?.evidenceType;
  const comment=typeof req.body?.comment==='string'?req.body.comment.trim():null;
  if(!['activity','follow_up'].includes(type)||(comment&&(comment.length<5||comment.length>1000))) {
    return res.status(400).json({error:'Select an evidence type and provide an optional comment of 5–1000 characters'});
  }
  const result=await transaction(async client=>{
    const scoped=scope('p',req.broker,[id]);
    const activity=type==='activity';
    const source=activity
      ? "prospect_activities e JOIN prospects p ON p.id=e.prospect_id WHERE e.id=$1 AND cardinality(e.warning_codes)>0"
      : "tasks e JOIN prospects p ON p.id=e.prospect_id WHERE e.id=$1 AND e.task_type='prospect_follow_up' AND cardinality(e.policy_warning_codes)>0";
    const row=await one('SELECT p.id FROM '+source+' AND '+scoped.clause+' FOR SHARE OF p',scoped.params,client);
    if(!row)return null;
    const key=activity?'activity_id':'task_id';
    const review=await one(
      'INSERT INTO prospect_override_reviews(id,'+key+',reviewed_by,comment) VALUES($1,$2,$3,$4) '+
      'ON CONFLICT ('+key+') DO NOTHING RETURNING id,reviewed_by,reviewed_at,comment',
      [uuid(),id,req.broker.id,comment||null],client);
    if(!review)return {duplicate:true};
    await audit('Prospect',row.id,'override_reviewed',req.broker.id,
      {reviewId:review.id,evidenceType:type,evidenceId:id,comment:review.comment},client);
    return {review};
  });
  if(!result)return res.status(404).json({error:'Override not found'});
  if(result.duplicate)return res.status(409).json({error:'Override was already reviewed'});
  return res.status(201).json(result);
});

r.get('/crm/prospects/:id',async(req,res)=>{const prospect=await visibleProspect(req.params.id,req.broker);if(!prospect)return res.status(404).json({error:'Prospect not found or outside your scope'});const [activities,followUps,suppression,callingNumbers,editHistory,overrideReviews]=await Promise.all([many(`SELECT a.*,b.name AS created_by_name,n.label AS company_calling_number_label,moved.retry_moved FROM prospect_activities a JOIN brokers b ON b.id=a.created_by LEFT JOIN company_calling_numbers n ON n.id=a.company_calling_number_id
LEFT JOIN LATERAL (
  SELECT log.details::jsonb - 'activityId' AS retry_moved FROM audit_log log
  WHERE log.entity_type='Prospect' AND log.entity_id=a.prospect_id AND log.action='weekly_retry_moved'
    AND log.details::jsonb->>'activityId'=a.id::text
  ORDER BY log.timestamp DESC,log.id DESC LIMIT 1
) moved ON true WHERE a.prospect_id=$1 ORDER BY a.occurred_at DESC,a.id DESC`,[prospect.id]),many(`SELECT f.*,b.name AS assignee_name,c.name AS created_by_name FROM tasks f JOIN brokers b ON b.id=f.assignee_id JOIN brokers c ON c.id=f.created_by WHERE f.prospect_id=$1 AND f.task_type='prospect_follow_up' ORDER BY CASE WHEN f.status IN('open','in_progress') THEN 0 ELSE 1 END,f.due_at,f.id`,[prospect.id]),getContactSuppression(prospect.normalizedPhone),many("SELECT id,label,phone,normalized_phone FROM company_calling_numbers WHERE status='active' ORDER BY label"),many("SELECT a.timestamp,a.details,b.name AS actor_name FROM audit_log a LEFT JOIN brokers b ON b.id=a.performed_by WHERE a.entity_type='Prospect' AND a.entity_id=$1 AND a.action='profile_updated' ORDER BY a.timestamp DESC",[prospect.id]),many(
  "SELECT r.id,r.activity_id,r.task_id,r.reviewed_at,r.comment,b.name AS reviewed_by_name FROM prospect_override_reviews r "+
  "JOIN brokers b ON b.id=r.reviewed_by LEFT JOIN prospect_activities a ON a.id=r.activity_id LEFT JOIN tasks t ON t.id=r.task_id "+
  "WHERE a.prospect_id=$1 OR t.prospect_id=$1 ORDER BY r.reviewed_at DESC,r.id",[prospect.id])]);
const interestHistory=await many(`SELECT h.changed_at,b.name AS changed_by_name,
  (h.before_values - 'areaIds') || jsonb_build_object('areas',ARRAY(
    SELECT a.business_label FROM areas a WHERE a.id::text IN (
      SELECT jsonb_array_elements_text(h.before_values->'areaIds')
    ) ORDER BY a.business_label,a.id)) AS before_values,
  (h.after_values - 'areaIds') || jsonb_build_object('areas',ARRAY(
    SELECT a.business_label FROM areas a WHERE a.id::text IN (
      SELECT jsonb_array_elements_text(h.after_values->'areaIds')
    ) ORDER BY a.business_label,a.id)) AS after_values
  FROM prospect_interest_history h JOIN brokers b ON b.id=h.changed_by
  WHERE h.prospect_id=$1 ORDER BY h.changed_at DESC,h.id`,[prospect.id]);
const interestLabels=interestHistory.length?await loadProspectInterestLabels():{};
res.json({prospect,activities,followUps,editHistory,overrideReviews,interestHistory,interestLabels,suppression:{strongest:suppression.strongest,activeTypes:Object.keys(suppression.restrictions)},callingNumbers,canManage:canManage(req.broker),canOperate:prospect.ownerId===req.broker.id||canManage(req.broker)});});



r.get('/crm/prospects/:id/interest',async(req,res)=>{
  if(!validProspectTrackingId(req.params.id))return res.status(404).json({error:'Prospect not found'});
  const prospect=await visibleProspect(req.params.id,req.broker);
  if(!prospect)return res.status(404).json({error:'Prospect not found'});
  const selections=await many(
    'SELECT a.id,a.business_label,a.active FROM areas a JOIN prospect_preferred_areas p ON p.area_id=a.id WHERE p.prospect_id=$1 ORDER BY a.business_label,a.id',
    [prospect.id]);
  const values=Object.fromEntries(Object.keys(interestFields).map(key=>[key,prospect[key]??null]));
  if(prospect.ownerId!==req.broker.id)return res.json({values,selections,editable:false});
  const definitions=await many(
    "SELECT s.stable_code AS set_code,d.stable_code,d.display_label_en FROM value_sets s JOIN value_definitions d ON d.value_set_id=s.id "+
    "WHERE s.stable_code=ANY($1::text[]) AND s.status='active' AND d.definition_status='active' "+
    "AND (d.effective_from IS NULL OR d.effective_from<=now()) AND (d.effective_to IS NULL OR d.effective_to>now()) "+
    'ORDER BY d.display_order,d.display_label_en,d.id',
    [[...Object.values(interestFields),'prospect_not_interested_reason']]);
  const areas=await many('SELECT id,business_label FROM areas WHERE active=1 ORDER BY business_label,id');
  const choices=Object.fromEntries(Object.entries(interestFields).map(([key,set])=>[key,definitions.filter(value=>value.setCode===set)]));
  return res.json({values,selections,choices,areas,editable:prospect.status!=='converted',
    reasons:definitions.filter(value=>value.setCode==='prospect_not_interested_reason')});
});

r.patch('/crm/prospects/:id/interest',async(req,res)=>{
  if(!validProspectTrackingId(req.params.id))return res.status(404).json({error:'Prospect not found'});
  const fields=Object.keys(interestFields);
  const body=req.body||{};
  if(Object.keys(body).some(key=>!fields.includes(key)&&key!=='areaIds')||
     fields.some(key=>Object.hasOwn(body,key)&&body[key]!==null&&
       (typeof body[key]!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(body[key])))||
     (Object.hasOwn(body,'areaIds')&&(!Array.isArray(body.areaIds)||body.areaIds.length>100||!body.areaIds.every(validProspectTrackingId)))) {
    return res.status(400).json({error:'Use controlled interest values and valid preferred areas'});
  }
  const result=await transaction(async client=>{
    const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});
    if(!prospect)return {code:404,error:'Prospect not found'};
    if(prospect.ownerId!==req.broker.id)return {code:403,error:'Only the owning Agent may edit prospect interest'};
    if(prospect.status==='converted')return {code:409,error:'Converted Prospect history is read-only'};
    const existing=await many('SELECT area_id FROM prospect_preferred_areas WHERE prospect_id=$1 ORDER BY area_id',[prospect.id],client);
    const before={...Object.fromEntries(fields.map(key=>[key,prospect[key]??null])),areaIds:existing.map(row=>row.areaId)};
    const after={...before,...body};
    for(const key of fields){
      if(after[key]===null||after[key]===before[key])continue;
      const value=await one(
        "SELECT d.id FROM value_sets s JOIN value_definitions d ON d.value_set_id=s.id WHERE s.stable_code=$1 AND s.status='active' "+
        "AND d.stable_code=$2 AND d.definition_status='active' AND (d.effective_from IS NULL OR d.effective_from<=now()) "+
        'AND (d.effective_to IS NULL OR d.effective_to>now())',
        [interestFields[key],after[key]],client);
      if(!value)return {code:400,error:'An interest value is unavailable or retired'};
    }
    after.areaIds=[...new Set(after.areaIds.map(id=>id.toLowerCase()))].sort();
    const added=after.areaIds.filter(id=>!before.areaIds.includes(id));
    if(added.length){
      const available=await many('SELECT id FROM areas WHERE active=1 AND id=ANY($1::uuid[])',[added],client);
      if(available.length!==added.length)return {code:400,error:'A preferred area is unavailable or retired'};
    }
    if(JSON.stringify(before)===JSON.stringify(after))return {interest:before};
    await execute('UPDATE prospects SET purpose=$2,budget_band=$3,property_type=$4,market=$5,timeline=$6,updated_at=now() WHERE id=$1',
      [prospect.id,...fields.map(key=>after[key])],client);
    await execute('DELETE FROM prospect_preferred_areas WHERE prospect_id=$1 AND NOT(area_id=ANY($2::uuid[]))',
      [prospect.id,after.areaIds],client);
    if(added.length)await execute('INSERT INTO prospect_preferred_areas(prospect_id,area_id) SELECT $1,unnest($2::uuid[])',
      [prospect.id,added],client);
    const historyId=uuid();
    await execute('INSERT INTO prospect_interest_history(id,prospect_id,changed_by,before_values,after_values) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
      [historyId,prospect.id,req.broker.id,JSON.stringify(before),JSON.stringify(after)],client);
    await audit('Prospect',prospect.id,'interest_updated',req.broker.id,{historyId},client);
    return {interest:after};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  return res.json(result);
});

r.patch('/crm/prospects/:id',async(req,res)=>{
  const b=req.body||{},has=key=>Object.prototype.hasOwnProperty.call(b,key),sourceFields=['source','sourceSupplier','sourceBatchReference','sourceAcquiredAt','sourceEvidenceReference'],changesRequested=['displayName','email','phone','briefNotes',...sourceFields].some(has);
  if(!changesRequested)return res.status(400).json({error:'No editable Prospect fields were supplied'});
  const result=await transaction(async client=>{
    const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};
    if(prospect.ownerId!==req.broker.id&&!canManage(req.broker))return{code:403,error:'Only the owner or CRM leadership may edit this Prospect'};
    if(prospect.status==='converted')return{code:409,error:'Converted Prospect details are read-only'};
    const next={displayName:has('displayName')?clean(b.displayName):prospect.displayName,email:has('email')?email(b.email):prospect.normalizedEmail,phone:has('phone')?normalizePhone(b.phone):prospect.normalizedPhone,briefNotes:has('briefNotes')?clean(b.briefNotes):prospect.briefNotes,source:has('source')?clean(b.source):prospect.source,sourceSupplier:has('sourceSupplier')?clean(b.sourceSupplier):prospect.sourceSupplier,sourceBatchReference:has('sourceBatchReference')?clean(b.sourceBatchReference):prospect.sourceBatchReference,sourceAcquiredAt:has('sourceAcquiredAt')?clean(b.sourceAcquiredAt):prospect.sourceAcquiredAt,sourceEvidenceReference:has('sourceEvidenceReference')?clean(b.sourceEvidenceReference):prospect.sourceEvidenceReference};
    const comparable=value=>value instanceof Date?value.toISOString():String(value??''),sameField=(field,left,right)=>field==='sourceAcquiredAt'?(left===null&&right===null)||Date.parse(left)===Date.parse(right):comparable(left)===comparable(right),sourceChanged=sourceFields.some(field=>!sameField(field,prospect[field],next[field])),phoneChanged=comparable(prospect.normalizedPhone)!==comparable(next.phone);
    if(sourceChanged&&!canManage(req.broker))return{code:403,error:'Only a Manager or Director may edit source details'};
    if(sourceChanged&&(!clean(b.sourceReason)||clean(b.sourceReason).length<5))return{code:400,error:'A meaningful source-change reason is required'};
    if(phoneChanged&&(!clean(b.phoneReason)||clean(b.phoneReason).length<5))return{code:400,error:'A meaningful phone-change reason is required'};
    if(has('displayName')&&!next.displayName)return{code:400,error:'Prospect name cannot be blank'};
    if(has('email')&&next.email&&!isValidEmail(next.email))return{code:400,error:'Email format is invalid'};
    if(has('phone')&&!next.phone&&(prospect.normalizedPhone||clean(b.phone)))return{code:400,error:'Phone must use international format, for example +971501234567'};
    if(!next.phone&&!next.email)return{code:400,error:'Enter a phone number or email'};
    if(!EDIT_SOURCES.includes(next.source))return{code:400,error:'Invalid source'};
    if(next.source==='purchased_data'&&![next.sourceSupplier,next.sourceBatchReference,next.sourceAcquiredAt,next.sourceEvidenceReference].every(clean))return{code:400,error:'Purchased data requires supplier, batch, acquisition time and evidence reference'};
    const suppression=await getContactSuppression(next.phone,client);if(phoneChanged&&suppression.strongest==='wrong_number')return{code:409,error:'A confirmed wrong-number restriction blocks this phone change'};
    const duplicates=await duplicateSummary(next.phone,next.email,req.broker,client,{excludeProspectId:prospect.id});
    if(duplicates.prospects.length)return{code:409,error:'This phone or email already belongs to an in-scope Prospect',prospects:duplicates.prospects};
    if(duplicates.outsideScope)return{code:409,error:'A matching Customer, Lead or Prospect exists outside your scope; ask your Manager to review it without exposing its details'};
    const before={},after={};for(const [field,value] of Object.entries(next)){const old=field==='email'?prospect.normalizedEmail:field==='phone'?prospect.normalizedPhone:prospect[field];if(!sameField(field,old,value)){before[field]=old??null;after[field]=value??null;}}
    if(!Object.keys(after).length)return{code:400,error:'The submitted values do not change this Prospect'};
    const suggestedTimezone=inferredTimezone(next.phone),timezone=phoneChanged&&prospect.timezoneSource==='phone_inferred'?suggestedTimezone:prospect.timezone;
    const restrictions=suppression.restrictions,status=prospect.status==='do_not_contact'||blocksOutbound(suppression)?'do_not_contact':prospect.status;
    const row=await one(`UPDATE prospects SET display_name=$1,email=$2,normalized_email=$2,phone=$3,normalized_phone=$4,brief_notes=$5,source=$6,source_supplier=$7,source_batch_reference=$8,source_acquired_at=$9,source_evidence_reference=$10,timezone=$11,suppression_snapshot=$12,status=$13,updated_at=NOW() WHERE id=$14 RETURNING *`,[next.displayName,next.email,phoneChanged?String(b.phone).trim():prospect.phone,next.phone,next.briefNotes,next.source,next.sourceSupplier,next.sourceBatchReference,next.sourceAcquiredAt,next.sourceEvidenceReference,timezone,restrictions,status,prospect.id],client);
    await audit('Prospect',prospect.id,'profile_updated',req.broker.id,{before,after,phoneReason:phoneChanged?clean(b.phoneReason):null,sourceReason:sourceChanged?clean(b.sourceReason):null,timezoneSuggestion:phoneChanged?suggestedTimezone:null,duplicateSummary:{globalMatch:duplicates.globalMatch,outsideScope:duplicates.outsideScope},restriction:suppression.strongest},client);
    return{prospect:row,duplicates,timezoneSuggestion:suggestedTimezone,suppression:{strongest:suppression.strongest,activeTypes:Object.keys(restrictions)}};
  });
  if(result.error)return res.status(result.code).json(result);res.json(result);
});

r.patch('/crm/prospects/:id/timezone',async(req,res)=>{const timezone=clean(req.body?.timezone),reason=clean(req.body?.reason);if(!validTimezone(timezone))return res.status(400).json({error:'Prospect timezone is invalid'});const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(prospect.ownerId!==req.broker.id&&!canManage(req.broker))return{code:403,error:'Only the owner or CRM leadership may correct the timezone'};if(canManage(req.broker)&&(!reason||reason.length<5))return{code:400,error:'Manager or Director timezone override requires a meaningful reason'};const source=canManage(req.broker)?'manager_override':'agent_confirmed',row=await one('UPDATE prospects SET timezone=$1,timezone_source=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[timezone,source,prospect.id],client);await audit('Prospect',prospect.id,'timezone_corrected',req.broker.id,{from:prospect.timezone,to:timezone,source,reason},client);return row;});if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});

r.post('/crm/prospects/:id/activities',async(req,res)=>{
  const b=req.body||{},type=clean(b.activityType),at=clean(b.occurredAt)||new Date().toISOString();if(!['call','note'].includes(type)||!clean(b.notes)||clean(b.notes).length<2)return res.status(400).json({error:'Valid activityType and notes are required'});if(type==='call'&&(!['inbound','outbound'].includes(b.direction)||!OUTCOMES.includes(b.outcome)))return res.status(400).json({error:'Call direction and outcome are required'});
  const next = type === 'call' ? validateProspectNextStep(b) : null;
  if (!Number.isFinite(Date.parse(at))) return res.status(400).json({error:'Activity time is invalid'});
  if (next?.error) return res.status(400).json({error:next.error});
  const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(prospect.ownerId!==req.broker.id)return{code:403,error:'Only the owning Agent can append call or note evidence'};if(prospect.status==='converted')return{code:409,error:'Converted Prospect history is read-only'};
    if(type==='call'&&!prospect.normalizedPhone)return{code:409,error:'A call requires a phone number'};
    const suppression=await getContactSuppression(prospect.normalizedPhone,client);if(type==='call'&&b.direction==='outbound'&&blocksOutbound(suppression))return{code:409,error:`Outbound calling is blocked by ${suppression.strongest}`};
    if(type==='call'&&b.direction==='outbound'&&!clean(b.companyCallingNumberId))return{code:400,error:'Select an active company-registered calling number'};
    if(type==='call'&&b.direction==='outbound'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(b.companyCallingNumberId)))return{code:400,error:'The selected company calling number identifier is invalid'};
    if(type==='call'&&b.direction==='outbound'&&!(await one("SELECT id FROM company_calling_numbers WHERE id=$1 AND status='active' AND effective_to IS NULL",[b.companyCallingNumberId],client)))return{code:409,error:'The selected company calling number is not active'};
    if(clean(b.correctsActivityId)){const original=await one('SELECT id FROM prospect_activities WHERE id=$1 AND prospect_id=$2',[b.correctsActivityId,prospect.id],client);if(!original)return{code:409,error:'A correction may reference only an activity on this Prospect'};if(!clean(b.correctionReason)||clean(b.correctionReason).length<5)return{code:400,error:'A meaningful correction reason is required'};}
    const warningResult=type==='call'&&b.direction==='outbound'?await callWarnings(prospect,at,client):{warnings:[],stats:{},policy:{}};
    if(type==='call'&&b.direction==='outbound'){const outsideError=applyOutsideCallingHours(warningResult,{at,timezone:prospect.timezone});if(outsideError)return outsideError;}
    const warningError=requireWarningAcknowledgement(b,warningResult);if(warningError)return warningError;
    if(next?.reason){
      const governed=await one(
        "SELECT d.id FROM value_sets s JOIN value_definitions d ON d.value_set_id=s.id WHERE s.stable_code='prospect_not_interested_reason' "+
        "AND s.status='active' AND d.definition_status='active' AND d.stable_code=$1 "+
        "AND (d.effective_from IS NULL OR d.effective_from<=now()) AND (d.effective_to IS NULL OR d.effective_to>now())",[next.reason],client);
      if(!governed)return {code:400,error:'The not-interested reason is unavailable or retired'};
    }
    const followUp = next?.followUp;
    if (followUp && (prospect.status === 'do_not_contact' || blocksOutbound(suppression))) {
      return {code:409,error:'Follow-up outreach is blocked by the prospect restriction'};
    }
    if (followUp && b.outcome === 'declined' && !(b.warningAcknowledged && clean(b.warningReason)?.length >= 5)) {
      return {code:409,error:'Follow-up after decline requires acknowledgement and a reason',warning:true,warnings:['repeat_after_decline']};
    }
    let followWarnings = null;
    if (followUp) {
      followWarnings = await callWarnings(prospect,followUp.dueAt,client);
      if (b.outcome === 'declined' && !followWarnings.warnings.includes('repeat_after_decline')) {
        followWarnings.warnings.push('repeat_after_decline');
      }
      if (followUp.channel === 'call') {
        const outsideError = applyOutsideCallingHours(followWarnings,{at:followUp.dueAt,timezone:prospect.timezone});
        if (outsideError) return outsideError;
      }
      const followWarningError = requireWarningAcknowledgement(b,followWarnings);
      if (followWarningError) return followWarningError;
    }
    const outsideNote = warningResult.warnings.includes('outside_calling_window')
      ? 'Outside calling hours — customer request: ' + clean(b.warningReason) : null;
    const row = await one(
      'INSERT INTO prospect_activities(id,prospect_id,activity_type,direction,outcome,notes,corrects_activity_id,correction_reason,company_calling_number_id,warning_codes,warning_acknowledged,warning_reason,occurred_at,created_by,next_step,not_interested_reason,not_interested_note,recontact_month) ' +
      'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *',
      [uuid(),prospect.id,type,next ? b.direction : null,next ? b.outcome : null,[clean(b.notes),outsideNote].filter(Boolean).join('\n'),
        clean(b.correctsActivityId),clean(b.correctionReason),next && b.direction==='outbound' ? b.companyCallingNumberId : null,
        warningResult.warnings,Boolean(warningResult.warnings.length),warningResult.warnings.length ? clean(b.warningReason) : null,
        at,req.broker.id,next?.step ?? null,next?.reason ?? null,next?.note ?? null,next?.recontactDate ?? null],client);
    if (next) {
      const completed = await many(
        "UPDATE tasks SET status='completed',outcome='Prospect call logged',completed_at=NOW(),updated_at=NOW() " +
        "WHERE prospect_id=$1 AND task_type='prospect_follow_up' AND status IN('open','in_progress') RETURNING id",
        [prospect.id],client);
      for (const task of completed) {
        await audit('Task',task.id,'status_changed',req.broker.id,{prospectId:prospect.id,to:'completed',sourceActivityId:row.id},client);
      }
      const closing = ['close_dnc','close_wrong_number','close_not_interested'].includes(next.step);
      if (next.step === 'close_dnc' || next.step === 'close_wrong_number') {
        const restriction = next.step === 'close_dnc' ? 'do_not_contact' : 'wrong_number';
        const reason = restriction === 'wrong_number' ? 'Agent recorded invalid number' : clean(b.doNotContactReason);
        await recordContactSuppression({phone:prospect.normalizedPhone,type:restriction,
          evidenceReference:clean(b.evidenceReference) || 'prospect-activity:' + row.id,actorId:req.broker.id,reason},client);
        await execute(
          "UPDATE prospects SET status='do_not_contact',suppression_snapshot=(SELECT restrictions FROM wa_contact_suppressions WHERE normalized_phone=$1)," +
          'do_not_contact_reason=$3,do_not_contact_at=NOW() WHERE id=$2',[prospect.normalizedPhone,prospect.id,reason],client);
      } else if (b.outcome === 'answered') {
        const status = answeredCallStatus(prospect.status, next.step);
        if (status !== prospect.status) await execute('UPDATE prospects SET status=$1 WHERE id=$2',[status,prospect.id],client);
      } else if (prospect.status !== 'do_not_contact') {
        const statuses = {no_answer:'no_answer',voicemail:'no_answer',consumer_ended:'no_answer',
          callback_requested:'call_back',interested:'interested',not_interested:'not_interested',declined:'not_interested'};
        const status = next.step === 'close_not_interested' ? 'not_interested'
          : followUp && b.outcome === 'declined' ? 'call_back' : statuses[b.outcome];
        if (status) await execute('UPDATE prospects SET status=$1 WHERE id=$2',[status,prospect.id],client);
      }
      if (followUp) {
        const task = await one(
          'INSERT INTO tasks(id,prospect_id,source_activity_id,prospect_channel,task_type,subject,assignee_id,priority,due_at,created_by,policy_warning_codes,policy_warning_acknowledged,policy_warning_reason,customer_timezone) ' +
          "VALUES($1,$2,$3,$4,'prospect_follow_up',$5,$6,'normal',$7,$6,$8,$9,$10,$11) RETURNING id",
          [uuid(),prospect.id,row.id,followUp.channel,followUp.subject,req.broker.id,followUp.dueAt,followWarnings.warnings,
            Boolean(followWarnings.warnings.length),followWarnings.warnings.length ? clean(b.warningReason) : null,prospect.timezone],client);
        await audit('Task',task.id,'created',req.broker.id,{prospectId:prospect.id,sourceActivityId:row.id},client);
      }
      const cadence = await one("SELECT working_days,retry_gaps,park_on_exhaustion FROM prospect_cadence_policy_versions WHERE status='active'",[],client);
      const retry = advanceProspectRetry({previousAttempts:prospect.retryAttempts,outcome:b.outcome,
        step:closing || prospect.status === 'do_not_contact' ? null : next.step,at,policy:cadence});
      if (retry.nextAt) {
        // Existing repeat-call limits use the prospect's local calendar and a rolling seven-day window.
        const checked = await applyProspectRetryLimits(retry.nextAt,cadence.workingDays,
          async nextAt => (await callWarnings(prospect,nextAt,client)).warnings);
        retry.nextAt = checked.nextAt;
        if (checked.moved) {
          await audit('Prospect',prospect.id,'weekly_retry_moved',req.broker.id,{
            activityId:row.id,...checked.moved,
          },client);
        }
      }
      await execute('UPDATE prospects SET retry_attempts=$2,next_retry_at=$3,parked_at=$4 WHERE id=$1',
        [prospect.id,retry.attempts,retry.nextAt,retry.parkedAt],client);
    }
    await execute('UPDATE prospects SET last_activity_at=GREATEST(last_activity_at,$2::timestamptz),updated_at=NOW() WHERE id=$1',
      [prospect.id,at],client);
    await audit('ProspectActivity',row.id,'created',req.broker.id,{prospectId:prospect.id,activityType:type,outcome:row.outcome,correctsActivityId:row.correctsActivityId,correctionReason:row.correctionReason,warningCodes:warningResult.warnings,warningReason:row.warningReason,prospectTimezone:prospect.timezone,prospectLocalTime:warningResult.prospectLocalTime||localClock(at,prospect.timezone),outsideCallingHoursMode:warningResult.outsideCallingHoursMode||null},client);return{activity:row,warnings:warningResult.warnings};
  });if(result.error)return res.status(result.code).json(result);res.status(201).json(result);
});

r.post('/crm/prospects/:id/follow-ups',async(req,res)=>{const b=req.body||{},channel=clean(b.channel)||'call';if(!clean(b.subject)||!clean(b.dueAt)||!['call','whatsapp','email'].includes(channel))return res.status(400).json({error:'Subject, dueAt and a valid channel are required'});const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client,{forUpdate:true});if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(prospect.ownerId!==req.broker.id)return{code:403,error:'Only the owning Agent can create a follow-up'};if(['do_not_contact','converted'].includes(prospect.status))return{code:409,error:'Follow-up outreach is blocked by the Prospect status'};if(!prospect.normalizedPhone&&channel!=='email')return{code:409,error:'This channel requires a phone number'};const suppression=await getContactSuppression(prospect.normalizedPhone,client);if(blocksOutbound(suppression))return{code:409,error:`Follow-up outreach is blocked by ${suppression.strongest}`};const warningResult=await callWarnings(prospect,b.dueAt,client);if(channel==='call'){const outsideError=applyOutsideCallingHours(warningResult,{at:b.dueAt,timezone:prospect.timezone});if(outsideError)return outsideError;}const warningError=requireWarningAcknowledgement(b,warningResult);if(warningError)return warningError;const outsideNote=warningResult.warnings.includes('outside_calling_window')?`Outside calling hours — customer request: ${clean(b.warningReason)}`:null,details=[clean(b.details),outsideNote].filter(Boolean).join('\n')||null,row=await one(`INSERT INTO tasks(id,prospect_id,prospect_channel,task_type,subject,details,assignee_id,priority,due_at,created_by,policy_warning_codes,policy_warning_acknowledged,policy_warning_reason,customer_timezone) VALUES($1,$2,$3,'prospect_follow_up',$4,$5,$6,$7,$8,$6,$9,$10,$11,$12) RETURNING *`,[uuid(),prospect.id,channel,clean(b.subject),details,req.broker.id,b.priority||'normal',b.dueAt,warningResult.warnings,warningResult.warnings.length?true:false,warningResult.warnings.length?clean(b.warningReason):null,prospect.timezone],client);await audit('Task',row.id,'created',req.broker.id,{prospectId:prospect.id,channel,warningCodes:warningResult.warnings,warningReason:row.policyWarningReason,prospectTimezone:prospect.timezone,prospectLocalTime:warningResult.prospectLocalTime||localClock(b.dueAt,prospect.timezone),outsideCallingHoursMode:warningResult.outsideCallingHoursMode||null},client);return{followUp:row,warnings:warningResult.warnings};});if(result.error)return res.status(result.code).json(result);res.status(201).json(result);});

r.patch('/crm/prospects/:id/follow-ups/:taskId',async(req,res)=>{const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};const task=await one("SELECT * FROM tasks WHERE id=$1 AND prospect_id=$2 AND task_type='prospect_follow_up' FOR UPDATE",[req.params.taskId,prospect.id],client);if(!task)return{code:404,error:'Follow-up not found'};if(task.assigneeId!==req.broker.id&&!canManage(req.broker))return{code:403,error:'Follow-up is outside your scope'};const status=req.body?.status||task.status;if(!['open','in_progress','completed','cancelled'].includes(status))return{code:400,error:'Invalid follow-up status'};if(['completed','cancelled'].includes(status)&&!clean(req.body?.outcome))return{code:400,error:'Outcome or cancellation reason is required'};const row=await one(`UPDATE tasks SET status=$1,outcome=COALESCE($2,outcome),completed_at=CASE WHEN $1='completed' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$3 RETURNING *`,[status,clean(req.body?.outcome),task.id],client);await audit('Task',task.id,'status_changed',req.broker.id,{prospectId:prospect.id,from:task.status,to:status,outcome:row.outcome},client);return row;});if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});

r.post('/crm/prospects/:id/dncr',async(req,res)=>{
  if(!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});
  const action=clean(req.body?.action),evidenceReference=clean(req.body?.evidenceReference),reason=clean(req.body?.reason);
  if(!['record','release'].includes(action))return res.status(400).json({error:'Action must be record or release'});
  if(action==='record'&&!evidenceReference)return res.status(400).json({error:'Manual DNCR evidence reference is required'});
  if(action==='release'&&(!reason||reason.length<5))return res.status(400).json({error:'A meaningful DNCR release reason is required'});
  const result=await transaction(async client=>{
    const prospect=await visibleProspect(req.params.id,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};
    if(!prospect.normalizedPhone)return{code:409,error:'DNCR requires a phone number'};
    if(action==='record')await recordContactSuppression({phone:prospect.normalizedPhone,type:'dncr',evidenceReference,actorId:req.broker.id,reason:'Manual DNCR evidence (not a registry check)'},client);
    else try{await releaseContactSuppression({phone:prospect.normalizedPhone,type:'dncr',reason,actorId:req.broker.id,actorRole:req.broker.jobRole},client);}catch(error){return{code:409,error:error.message};}
    const suppression=await getContactSuppression(prospect.normalizedPhone,client),effectiveStatus=blocksOutbound(suppression)?'do_not_contact':prospect.status==='do_not_contact'?'not_contacted':prospect.status;
    const updated=await one(`UPDATE prospects SET status=$1,suppression_snapshot=$2,do_not_contact_reason=CASE WHEN $3::boolean THEN $4 ELSE NULL END,do_not_contact_at=CASE WHEN $3::boolean THEN COALESCE(do_not_contact_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$5 RETURNING *`,[effectiveStatus,suppression.restrictions,blocksOutbound(suppression),blocksOutbound(suppression)?`Shared restriction: ${suppression.strongest}`:null,prospect.id],client);
    await audit('Prospect',prospect.id,action==='record'?'manual_dncr_recorded':'manual_dncr_released',req.broker.id,{label:'Manual DNCR evidence (not a registry check)',evidenceReference:action==='record'?evidenceReference:null,reason:action==='release'?reason:null,strongest:suppression.strongest},client);
    return{prospect:updated,suppression:{strongest:suppression.strongest,activeTypes:Object.keys(suppression.restrictions)}};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.patch('/crm/prospects/:id/status',async(req,res)=>{const status=clean(req.body?.status),reason=clean(req.body?.reason);if(!STATUS.includes(status)||status==='converted')return res.status(400).json({error:'Invalid status'});const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(prospect.ownerId!==req.broker.id&&!canManage(req.broker))return{code:403,error:'Only the owner or CRM leadership can change this status'};if(status==='do_not_contact'){if(!reason||reason.length<5)return{code:400,error:'A meaningful do-not-contact reason is required'};await recordContactSuppression({phone:prospect.normalizedPhone,type:'do_not_contact',evidenceReference:clean(req.body?.evidenceReference)||`prospect:${prospect.id}`,actorId:req.broker.id,reason},client);}else if(prospect.status==='do_not_contact'){try{await releaseContactSuppression({phone:prospect.normalizedPhone,type:'do_not_contact',reason,actorId:req.broker.id,actorRole:req.broker.jobRole},client);}catch(error){return{code:409,error:error.message};}}
    const suppression=await getContactSuppression(prospect.normalizedPhone,client),effective=blocksOutbound(suppression)?'do_not_contact':status,row=await one(`UPDATE prospects SET status=$1,suppression_snapshot=$2,do_not_contact_reason=CASE WHEN $1='do_not_contact' THEN $3 ELSE NULL END,do_not_contact_at=CASE WHEN $1='do_not_contact' THEN COALESCE(do_not_contact_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$4 RETURNING *`,[effective,suppression.restrictions,effective==='do_not_contact'?(reason||`Shared restriction: ${suppression.strongest}`):null,prospect.id],client);await audit('Prospect',prospect.id,'status_changed',req.broker.id,{from:prospect.status,requested:status,effective,reason,restriction:suppression.strongest},client);return row;});if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});

async function customerMatches(prospect,broker,client){const found=await duplicateSummary(prospect.normalizedPhone,prospect.normalizedEmail,broker,client);return found.customers;}
r.get('/crm/prospects/:id/conversion-matches',async(req,res)=>{const prospect=await visibleProspect(req.params.id,req.broker);if(!prospect)return res.status(404).json({error:'Prospect not found or outside your scope'});const duplicates=await duplicateSummary(prospect.normalizedPhone,prospect.normalizedEmail,req.broker);res.json({matches:duplicates.customers,leadMatches:duplicates.leads,outsideScopeMatch:duplicates.outsideScope,customerReady:Boolean(prospect.displayName&&prospect.normalizedEmail),requirements:{newCustomer:['display name','phone','email']}});});
r.post('/crm/prospects/:id/convert',async(req,res)=>{const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(prospect.ownerId!==req.broker.id)return{code:403,error:'Only the owning Agent may convert this Prospect'};const locked=await one('SELECT * FROM prospects WHERE id=$1 FOR UPDATE',[prospect.id],client);if(locked.status==='converted')return{prospect:locked,contactId:locked.convertedContactId,idempotent:true};const suppression=await getContactSuppression(locked.normalizedPhone,client);if(suppression.strongest==='wrong_number')return{code:409,error:'Wrong-number evidence blocks Customer creation'};const duplicates=await duplicateSummary(locked.normalizedPhone,locked.normalizedEmail,req.broker,client),matches=await customerMatches(locked,req.broker,client);if(duplicates.outsideScope)return{code:409,error:'A matching Customer or Lead exists outside your scope; ask your Manager to review it without exposing its details'};let contact;if(req.body?.existingContactId){if(!matches.some(x=>x.id===req.body.existingContactId))return{code:409,error:'Select an in-scope matching Customer'};contact=await one('SELECT * FROM contacts WHERE id=$1',[req.body.existingContactId],client);}else{if(matches.length)return{code:409,error:'Matching Customers exist; select one instead of creating another',matches};if(!locked.displayName||!locked.normalizedEmail)return{code:409,error:'Add the prospect name and email before creating a new Customer'};const areas=await many('SELECT a.business_label FROM prospect_preferred_areas p JOIN areas a ON a.id=p.area_id WHERE p.prospect_id=$1 ORDER BY a.business_label,a.id',[locked.id],client);
const interest=Object.entries({Purpose:locked.purpose,'Budget band':locked.budgetBand,'Property type':locked.propertyType,Market:locked.market,Timeline:locked.timeline})
  .filter(([,value])=>value).map(([label,value])=>label+': '+value.replaceAll('_',' '));
if(areas.length)interest.push('Preferred areas: '+areas.map(area=>area.businessLabel).join(', '));
const provenance=[locked.briefNotes,...interest,`Prospect Diary source: ${locked.source}`,locked.sourceSupplier?`Supplier: ${locked.sourceSupplier}`:null,locked.sourceBatchReference?`Batch: ${locked.sourceBatchReference}`:null,locked.sourceAcquiredAt?`Acquired: ${new Date(locked.sourceAcquiredAt).toISOString()}`:null,locked.sourceEvidenceReference?`Evidence: ${locked.sourceEvidenceReference}`:null].filter(Boolean).join('\n');contact=await one(`INSERT INTO contacts(id,full_name,email,phone,contact_type,preferred_channel,notes,owner_id,created_by,email_status,phone_status,source_first_seen,do_not_contact) VALUES($1,$2,$3,$4,$5,'Phone',$6,$7,$7,'format_valid','format_valid','Prospect Diary',$8) RETURNING *`,[uuid(),locked.displayName,locked.normalizedEmail,locked.normalizedPhone,req.body?.contactType||'buyer',provenance,req.broker.id,blocksOutbound(suppression)?1:0],client);await execute('INSERT INTO contact_roles(id,contact_id,role_code,created_by) VALUES($1,$2,$3,$4)',[uuid(),contact.id,req.body?.contactType||'buyer',req.broker.id],client);for(const [kind,value] of [['Email',locked.normalizedEmail],['Phone',locked.normalizedPhone]])await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,restriction_status,created_by) VALUES($1,$2,$3,'Primary',$4,$4,1,'format_valid',$5,$6)`,[uuid(),contact.id,kind,value,blocksOutbound(suppression)?'do_not_contact':'allowed',req.broker.id],client);await audit('Contact',contact.id,'created_from_prospect',req.broker.id,{prospectId:locked.id,source:locked.source,sourceEvidenceReference:locked.sourceEvidenceReference,restriction:suppression.strongest},client);}
    const updated=await one("UPDATE prospects SET status='converted',converted_contact_id=$1,converted_at=NOW(),converted_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *",[contact.id,req.broker.id,locked.id],client);await audit('Prospect',locked.id,'converted',req.broker.id,{contactId:contact.id,restriction:suppression.strongest},client);return{prospect:updated,contactId:contact.id,idempotent:false};});if(result.error)return res.status(result.code).json({error:result.error,matches:result.matches});res.status(result.idempotent?200:201).json(result);});

r.post('/crm/prospects/:id/reassign',async(req,res)=>{if(!canManage(req.broker))return res.status(403).json({error:'Manager or Director access is required'});const reason=clean(req.body?.reason);if(!reason||reason.length<5)return res.status(400).json({error:'A meaningful reassignment reason is required'});const result=await transaction(async client=>{const prospect=await visibleProspect(req.params.id,req.broker,client),target=await ownerContext(req.body?.ownerId,req.broker,client);if(!prospect)return{code:404,error:'Prospect not found or outside your scope'};if(!target)return{code:400,error:'Select an active Agent in your scope'};const row=await one('UPDATE prospects SET owner_id=$1,team_id=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[target.id,target.teamId,prospect.id],client);await execute("UPDATE tasks SET assignee_id=$1,updated_at=NOW() WHERE prospect_id=$2 AND task_type='prospect_follow_up' AND status IN('open','in_progress')",[target.id,prospect.id],client);await audit('Prospect',prospect.id,'reassigned',req.broker.id,{fromOwnerId:prospect.ownerId,toOwnerId:target.id,reason},client);return row;});if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});

r.get('/crm/prospect-diary/calling-numbers',async(req,res)=>res.json({numbers:await many('SELECT * FROM company_calling_numbers ORDER BY status,label')}));
const canMaintainCallingNumbers=broker=>broker?.role==='admin'||broker?.jobRole==='director';
r.post('/crm/prospect-diary/calling-numbers',async(req,res)=>{if(!canMaintainCallingNumbers(req.broker))return res.status(403).json({error:'Admin or Director access is required'});const b=req.body||{},phone=normalizePhone(b.phone);if(!phone||![b.label,b.tdraRegistrationReference,b.tdraRegisteredLegalName,b.tdraRegisteredAt,b.tdraVerifiedAt,b.tdraEvidenceReference].every(clean))return res.status(400).json({error:'Number and complete TDRA registration evidence are required'});const row=await one(`INSERT INTO company_calling_numbers(id,label,phone,normalized_phone,tdra_registration_reference,tdra_registered_legal_name,tdra_registered_at,tdra_verified_at,tdra_evidence_reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[uuid(),clean(b.label),clean(b.phone),phone,clean(b.tdraRegistrationReference),clean(b.tdraRegisteredLegalName),b.tdraRegisteredAt,b.tdraVerifiedAt,clean(b.tdraEvidenceReference),req.broker.id]);await audit('CompanyCallingNumber',row.id,'created',req.broker.id,{normalizedPhone:phone,tdraEvidenceReference:row.tdraEvidenceReference});res.status(201).json(row);});
r.post('/crm/prospect-diary/calling-numbers/:id/retire',async(req,res)=>{if(!canMaintainCallingNumbers(req.broker))return res.status(403).json({error:'Admin or Director access is required'});const reason=clean(req.body?.reason);if(!reason||reason.length<5)return res.status(400).json({error:'A meaningful retirement reason is required'});const row=await one("UPDATE company_calling_numbers SET status='retired',effective_to=NOW(),updated_at=NOW() WHERE id=$1 AND status='active' RETURNING *",[req.params.id]);if(!row)return res.status(404).json({error:'Active company calling number not found'});await audit('CompanyCallingNumber',row.id,'retired',req.broker.id,{reason,tdraEvidenceReference:row.tdraEvidenceReference});res.json(row);});

export default r;
