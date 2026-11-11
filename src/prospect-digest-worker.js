import { audit, execute, many, one, transaction, uuid } from './db.js';
import { connectedOutcomes, prospectDashboardFilters, prospectDashboardSummary } from './prospect-dashboard.js';
import { digestDeliveryTransition, digestEmailSettings, previousProspectWorkingDay, sendProspectDigest } from './prospect-digest-smtp.js';

const dubaiOffset = 4 * 3600000;
const audienceByRole = { sales_agent: 'agent', manager: 'manager', director: 'director' };

function scopedDigest(recipient, date) {
  const filters=prospectDashboardFilters({period:'custom',from:date,to:date});
  if(filters.error)throw new Error('Invalid digest report date');
  const params=[date,date,'day',null,null,null,null,connectedOutcomes,0];
  if(recipient.jobRole==='director')return {clause:'true',params};
  params.push(recipient.id);
  const clause=recipient.jobRole==='manager'
    ? "(p.owner_id=$10 OR EXISTS (SELECT 1 FROM team_memberships m WHERE m.broker_id=$10 AND m.membership_role='manager' AND m.ends_at IS NULL AND m.team_id=p.team_id))"
    : 'p.owner_id=$10';
  return {clause,params};
}

async function digestSummary(recipient,date) {
  const scoped=scopedDigest(recipient,date);
  return one(prospectDashboardSummary(scoped),scoped.params);
}

export async function prospectDigestPreview(recipient, date) {
  if(!Object.hasOwn(audienceByRole,recipient.jobRole))throw new Error('Invalid digest audience');
  const policy=await one("SELECT working_days FROM prospect_cadence_policy_versions WHERE status='active'");
  const previousDate=previousProspectWorkingDay(date,policy.workingDays);
  const today=new Date(Date.now()+dubaiOffset).toISOString().slice(0,10);
  const [report,previous,todayReport]=await Promise.all([date,previousDate,today].map(day=>digestSummary(recipient,day)));
  const score=(agent)=>agent.target>0?agent.calls_made/agent.target:1;
  const agents=[...report.agents].sort((left,right)=>Number(score(left)>=0.5)-Number(score(right)>=0.5)||left.name.localeCompare(right.name));
  const target=agents.reduce((sum,agent)=>sum+Number(agent.target),0);
  const previousTarget=previous.agents.reduce((sum,agent)=>sum+Number(agent.target),0);
  const dueToday=todayReport.agents.reduce((sum,agent)=>sum+Number(agent.follow_ups_due),0);
  const audience=audienceByRole[recipient.jobRole];
  let overrides=[];
  let overrideCount=0;
  if(audience!=='agent'){
    const rows=await many(`WITH visible AS (
      SELECT p.id,p.display_name FROM prospects p WHERE $2='director' OR p.owner_id=$1 OR EXISTS (
        SELECT 1 FROM team_memberships m WHERE m.broker_id=$1 AND m.membership_role='manager'
          AND m.ends_at IS NULL AND m.team_id=p.team_id
      )
    ), warnings AS (
      SELECT a.id,p.display_name,a.created_by,a.created_at,a.warning_codes AS codes,a.warning_reason AS reason
      FROM prospect_activities a JOIN visible p ON p.id=a.prospect_id
      WHERE cardinality(a.warning_codes)>0 AND NOT EXISTS(SELECT 1 FROM prospect_override_reviews r WHERE r.activity_id=a.id)
      UNION ALL
      SELECT t.id,p.display_name,t.created_by,t.created_at,t.policy_warning_codes,t.policy_warning_reason
      FROM tasks t JOIN visible p ON p.id=t.prospect_id
      WHERE t.task_type='prospect_follow_up' AND cardinality(t.policy_warning_codes)>0
        AND NOT EXISTS(SELECT 1 FROM prospect_override_reviews r WHERE r.task_id=t.id)
    ) SELECT w.*,b.name AS agent_name,count(*) OVER()::int AS total
      FROM warnings w JOIN brokers b ON b.id=w.created_by ORDER BY w.created_at DESC,w.id LIMIT 3`,
      [recipient.id,recipient.jobRole]);
    overrideCount=rows[0]?.total??0;
    overrides=rows.map(row=>({prospect:row.displayName,agent:row.agentName,codes:row.codes,reason:row.reason}));
  }
  return {date,audience,tiles:report.tiles,target,previousDate,previous:previous.tiles,previousTarget,dueToday,overrideCount,overrides,
    agents:audience==='agent'?[]:agents.map(agent=>({...agent,dueToday:todayReport.agents.find(row=>row.id===agent.id)?.follow_ups_due??0}))};
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const redactContactDetails = value => String(value??'')
  .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/gi,'[email removed]')
  .replace(/(?:\\+?\\d[\\d ().-]{6,}\\d)/g,'[phone removed]')
  .replace(/[\\r\\n]+/g,' ');

function renderDigest(report) {
  const t=report.tiles;
  const rate=t.callsMade?Math.round(100*t.callsConnected/t.callsMade)+'%':'—';
  const lines=[
    'Calls made / target: '+t.callsMade+' / '+report.target, 'Connected: '+t.callsConnected+' ('+rate+')',
    'New interested: '+t.newInterested, 'Conversions: '+t.conversions,
    'Follow-ups due today: '+report.dueToday, 'Overdue follow-ups: '+t.followUpsOverdue, 'Untouched past due: '+t.untouchedPastDue,
    'Previous working day ('+report.previousDate+'): '+report.previous.callsMade+' / '+report.previousTarget+' calls, '+
      report.previous.callsConnected+' connected, '+report.previous.newInterested+' interested, '+report.previous.conversions+' converted',
  ];
  for(const agent of report.agents)lines.push(redactContactDetails(agent.name)+': '+agent.calls_made+' / '+agent.target+
    ' calls, '+agent.calls_connected+' connected, '+agent.new_interested+' interested, '+agent.overdue+' overdue, '+agent.dueToday+' due today');
  if(report.audience!=='agent')lines.push('Overrides needing review: '+report.overrideCount);
  for(const warning of report.overrides)lines.push([warning.agent,warning.prospect,warning.codes?.join(', '),warning.reason]
    .map(redactContactDetails).filter(Boolean).join(' · '));
  const host=digestEmailSettings().environment==='crm-test'?'crm-test.nysarealty.com':'crm.nysarealty.com';
  const url='https://'+host+'/#prospectDiary';
  const link=report.audience==='agent'?'Open Today queue':'Open Prospecting dashboard';
  return {
    subject:'Prospect Diary digest · '+report.date,
    text:lines.join('\\n')+'\\n\\n'+link+': '+url,
    html:'<h1>Prospect Diary digest</h1><p>'+escapeHtml(report.date)+'</p><ul>'+
      lines.map(line=>'<li>'+escapeHtml(line)+'</li>').join('')+'</ul><p><a href="'+url+'">'+link+'</a></p>',
  };
}

async function schedule(now) {
  const local=new Date(now.getTime()+dubaiOffset);
  const date=local.toISOString().slice(0,10);
  if(local.getUTCHours()<8)return;
  const policy=await one("SELECT working_days FROM prospect_cadence_policy_versions WHERE status='active'");
  if(!policy?.workingDays.includes(local.getUTCDay()||7))return;
  const period=previousProspectWorkingDay(date,policy.workingDays);
  const eligible=await many("SELECT id,email,job_role FROM brokers WHERE role='internal_broker' AND status='active' AND job_role IN ('sales_agent','manager','director') AND prospect_digest_opt_out IS NOT TRUE");
  await transaction(async client=>{
    for(const recipient of eligible){
      const email=recipient.email?.trim().toLowerCase();
      if(!email)continue;
      await execute("INSERT INTO prospect_digest_runs(id,recipient_id,recipient_email,audience,report_date,status,next_attempt_at) VALUES($1,$2,$3,$4,$5,'pending',now()) ON CONFLICT(recipient_id,audience,report_date) DO NOTHING",
        [uuid(),recipient.id,email,audienceByRole[recipient.jobRole],period],client);
    }
  });
}

async function claim(limit) {
  return transaction(async client=>{
    await execute("SELECT pg_advisory_xact_lock(hashtextextended('prospect-digest-smtp-claim',0))",[],client);
    const stale=await many("UPDATE prospect_digest_runs SET status='review',error_code='STALE_SUBMISSION' WHERE status='sending' AND last_attempt_at<now()-interval '10 minutes' RETURNING id,recipient_id",[],client);
    for(const row of stale)await audit('Broker',row.recipientId,'prospect_digest_review',row.recipientId,{runId:row.id,code:'STALE_SUBMISSION'},client);
    const use=await one("SELECT coalesce(sum(attempts),0)::int AS count FROM prospect_digest_runs WHERE last_attempt_at>=now()-interval '1 hour'",[],client);
    if(use.count>=limit)return null;
    return one("WITH candidate AS (SELECT id FROM prospect_digest_runs WHERE status IN('pending','retry') AND next_attempt_at<=now() ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1) "+
      "UPDATE prospect_digest_runs d SET status='sending',attempts=d.attempts+1,last_attempt_at=now() FROM candidate c WHERE c.id=d.id RETURNING d.*,d.report_date::text AS report_day",[],client);
  });
}

async function deliver(run, send) {
  if(run.audience==='admin_test'){
    const admin=await one("SELECT email FROM brokers WHERE id=$1 AND role='admin' AND status='active'",[run.recipientId]);
    if(digestEmailSettings().environment!=='crm-test'||admin?.email?.trim().toLowerCase()!==run.recipientEmail){
      return {state:'skipped',code:'ADMIN_TEST_RECIPIENT_NO_LONGER_ELIGIBLE'};
    }
    return send({
      to:run.recipientEmail,subject:'DEV271 CRM Test digest delivery',
      text:'Synthetic Prospect Diary email delivery check.',html:'<p>Synthetic Prospect Diary email delivery check.</p>',
      messageId:'<prospect-digest-'+run.id+'@nysarealty.com>',
    });
  }

  const recipient=await one("SELECT id,email,job_role,prospect_digest_opt_out FROM brokers WHERE id=$1 AND role='internal_broker' AND status='active'",[run.recipientId]);
  if(!recipient||recipient.prospectDigestOptOut||recipient.email?.trim().toLowerCase()!==run.recipientEmail||
      audienceByRole[recipient.jobRole]!==run.audience){
    return {state:'skipped',code:'RECIPIENT_NO_LONGER_ELIGIBLE'};
  }
  const report=await prospectDigestPreview(recipient,run.reportDay);
  return send({...renderDigest(report),to:run.recipientEmail,messageId:'<prospect-digest-'+run.id+'@nysarealty.com>'});
}

export async function runProspectDigestTick(now=new Date(),{send=sendProspectDigest}={}) {
  const settings=digestEmailSettings();
  const limit=Number(process.env.PROSPECT_DIGEST_HOURLY_LIMIT);
  if(!settings.enabled||!['crm-test','production'].includes(settings.environment)||!Number.isSafeInteger(limit)||limit<1)return;
  if(process.env.PROSPECT_DIGEST_SCHEDULE_ENABLED==='true')await schedule(now);
  const run=await claim(limit);
  if(!run)return;
  let result;
  try { result=await deliver(run,send); }
  catch { result={state:'review',code:'DIGEST_DISPATCH_UNCERTAIN'}; }
  const status=digestDeliveryTransition(result,run.attempts);
  await transaction(async client=>{
    await execute("UPDATE prospect_digest_runs SET status=$2,error_code=$3,next_attempt_at=CASE WHEN $2='retry' THEN now()+interval '30 minutes' END,sent_at=CASE WHEN $2='accepted' THEN now() END WHERE id=$1 AND status='sending'",
      [run.id,status,result.code],client);
    await audit('Broker',run.recipientId,'prospect_digest_'+status,run.recipientId,{runId:run.id,reportDate:run.reportDay,code:result.code},client);
  });
}

export function startProspectDigestWorker() {
  let running=false;
  const timer=setInterval(async()=>{
    if(running)return;
    running=true;
    try{await runProspectDigestTick();}
    catch{console.warn('Prospect digest worker tick failed');}
    finally{running=false;}
  },60000);
  timer.unref();
}
