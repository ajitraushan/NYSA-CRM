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

export async function prospectDigestPreview(recipient, date) {
  if(!Object.hasOwn(audienceByRole,recipient.jobRole))throw new Error('Invalid digest audience');
  const scoped=scopedDigest(recipient,date);
  const data=await one(prospectDashboardSummary(scoped),scoped.params);
  return {date,audience:audienceByRole[recipient.jobRole],tiles:data.tiles,
    agents:recipient.jobRole==='sales_agent'?[]:data.agents};
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderDigest(report) {
  const t=report.tiles;
  const lines=[
    'Calls made: '+t.callsMade, 'Connected: '+t.callsConnected,
    'New interested: '+t.newInterested, 'Conversions: '+t.conversions,
    'Overdue follow-ups: '+t.followUpsOverdue, 'Untouched past due: '+t.untouchedPastDue,
  ];
  const host=digestEmailSettings().environment==='crm-test'?'crm-test.nysarealty.com':'crm.nysarealty.com';
  const url='https://'+host+'/#prospectDiary';
  return {
    subject:'Prospect Diary digest · '+report.date,
    text:lines.join('\n')+'\n\nOpen Prospect Diary: '+url,
    html:'<h1>Prospect Diary digest</h1><p>'+escapeHtml(report.date)+'</p><ul>'+
      lines.map(line=>'<li>'+escapeHtml(line)+'</li>').join('')+'</ul><p><a href="'+url+'">Open Prospect Diary</a></p>',
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

async function deliver(run) {
  if(run.audience==='admin_test'){
    const admin=await one("SELECT email FROM brokers WHERE id=$1 AND role='admin' AND status='active'",[run.recipientId]);
    if(digestEmailSettings().environment!=='crm-test'||admin?.email?.trim().toLowerCase()!==run.recipientEmail){
      return {state:'skipped',code:'ADMIN_TEST_RECIPIENT_NO_LONGER_ELIGIBLE'};
    }
    return sendProspectDigest({
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
  return sendProspectDigest({...renderDigest(report),to:run.recipientEmail,messageId:'<prospect-digest-'+run.id+'@nysarealty.com>'});
}

export async function runProspectDigestTick(now=new Date()) {
  const settings=digestEmailSettings();
  const limit=Number(process.env.PROSPECT_DIGEST_HOURLY_LIMIT);
  if(!settings.enabled||!['crm-test','production'].includes(settings.environment)||!Number.isSafeInteger(limit)||limit<1)return;
  if(process.env.PROSPECT_DIGEST_SCHEDULE_ENABLED==='true')await schedule(now);
  const run=await claim(limit);
  if(!run)return;
  let result;
  try { result=await deliver(run); }
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
