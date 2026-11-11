const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sources = new Set(['cold_call','referral','event','personal_network','purchased_data','other','diary','notebook','whatsapp','rem']);
const oneDay = 86400000;
const isoDay = date => date.toISOString().slice(0, 10);
const validDay = value => typeof value === 'string' && datePattern.test(value) &&
  Number.isFinite(Date.parse(value)) && isoDay(new Date(value)) === value;

export function prospectDashboardFilters(query = {}, now = new Date()) {
  const today = new Date(isoDay(new Date(now.getTime() + 4 * 3600000)));
  const period = query.period ?? 'today';
  let start = today;
  let end = today;
  if (period === 'week') {
    start = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * oneDay);
    end = new Date(start.getTime() + 6 * oneDay);
  } else if (period === 'month') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  } else if (period === 'custom') {
    if (!validDay(query.from) || !validDay(query.to)) return { error: 'Enter valid Dubai dates' };
    start = new Date(query.from);
    end = new Date(query.to);
  } else if (period !== 'today') {
    return { error: 'Unknown dashboard period' };
  }
  const days = (end - start) / oneDay + 1;
  if (days < 1 || days > 92) return { error: 'Choose a date range of 1 to 92 days' };
  if ([query.team, query.agent, query.batch].some(value => value && (typeof value !== 'string' || !uuidPattern.test(value))) ||
      (query.source && !sources.has(query.source))) return { error: 'Invalid dashboard filter' };
  return { period, from: isoDay(start), to: isoDay(end), bucket: days > 31 ? 'week' : 'day',
    team: query.team || null, agent: query.agent || null, batch: query.batch || null, source: query.source || null };
}

export const connectedOutcomes = ['answered','callback_requested','interested','not_interested','declined'];

export function prospectDashboardCte(scoped) {
  return `WITH RECURSIVE
    bounds AS (
      SELECT ($1::date::timestamp AT TIME ZONE 'Asia/Dubai') AS start_at,
        (($2::date+1)::timestamp AT TIME ZONE 'Asia/Dubai') AS end_at,
        now() AS at
    ),
    selected AS MATERIALIZED (
      SELECT p.* FROM prospects p
      WHERE (${scoped.clause})
        AND ($4::uuid IS NULL OR p.team_id=$4)
        AND ($5::uuid IS NULL OR p.owner_id=$5)
        AND ($6::uuid IS NULL OR p.upload_batch_id=$6)
        AND ($7::text IS NULL OR p.source=$7)
    ),
    chain AS (
      SELECT a.id,a.id AS root,0 AS depth
      FROM prospect_activities a JOIN selected p ON p.id=a.prospect_id
      WHERE a.corrects_activity_id IS NULL
      UNION ALL
      SELECT child.id,parent.root,parent.depth+1
      FROM chain parent JOIN prospect_activities child ON child.corrects_activity_id=parent.id
    ),
    effective AS MATERIALIZED (
      SELECT DISTINCT ON (c.root) a.*, c.root
      FROM chain c JOIN prospect_activities a ON a.id=c.id JOIN selected p ON p.id=a.prospect_id
      ORDER BY c.root, a.created_at DESC, c.depth DESC, a.id DESC
    ),
    calls AS MATERIALIZED (
      SELECT a.*, a.outcome=ANY($8::text[]) AS connected
      FROM effective a WHERE a.activity_type='call' AND a.direction='outbound'
    ),
    period_calls AS MATERIALIZED (
      SELECT c.* FROM calls c,bounds b WHERE c.occurred_at>=b.start_at AND c.occurred_at<b.end_at
    ),
    call_history AS (
      SELECT prospect_id,count(*) AS calls,bool_or(connected) AS connected,max(occurred_at) AS last_call
      FROM calls GROUP BY prospect_id
    ),
    interest_history AS (
      SELECT prospect_id,min(occurred_at) AS first_interested
      FROM effective WHERE activity_type='call' AND outcome='interested' GROUP BY prospect_id
    ),
    followups AS MATERIALIZED (
      SELECT t.* FROM tasks t JOIN selected p ON p.id=t.prospect_id WHERE t.task_type='prospect_follow_up'
    ),
    task_history AS (
      SELECT prospect_id, bool_or(status IN('open','in_progress')) AS has_open,
        count(*) FILTER (WHERE status IN('open','in_progress') AND due_at<b.at) AS overdue
      FROM followups CROSS JOIN bounds b GROUP BY prospect_id
    ),
    facts AS MATERIALIZED (
      SELECT p.id,p.owner_id,p.team_id,p.display_name,p.status,p.source,p.upload_batch_id,p.created_at,p.converted_at,p.last_activity_at,
        coalesce(ch.calls,0)>0 AS contacted,coalesce(ch.connected,false) AS connected,
        (ih.first_interested IS NOT NULL OR p.status='interested') AS interested,ih.first_interested,
        (p.status='not_contacted' AND coalesce(ch.calls,0)=0 AND p.do_not_contact_at IS NULL) AS untouched,
        (p.first_call_due_at<b.at) AS past_due,coalesce(th.has_open,false) AS has_open,
        coalesce(th.overdue,0) AS overdue,ch.last_call
      FROM selected p CROSS JOIN bounds b
      LEFT JOIN call_history ch ON ch.prospect_id=p.id
      LEFT JOIN interest_history ih ON ih.prospect_id=p.id
      LEFT JOIN task_history th ON th.prospect_id=p.id
    ),
    cohort AS (
      SELECT f.* FROM facts f,bounds b WHERE $6::uuid IS NOT NULL OR (f.created_at>=b.start_at AND f.created_at<b.end_at)
    )`;
}

const summary = `,
agent_calls AS (
  SELECT c.created_by AS agent_id,count(*) AS made,count(*) FILTER(WHERE c.connected) AS connected,
    count(*) FILTER(WHERE cardinality(c.warning_codes)>0) AS overrides
  FROM period_calls c GROUP BY c.created_by
), agent_last_call AS (
  SELECT created_by AS agent_id,max(occurred_at) AS at FROM calls GROUP BY created_by
), agent_prospects AS (
  SELECT f.owner_id AS agent_id,
    count(*) FILTER(WHERE f.first_interested>=w.start_at AND f.first_interested<w.end_at) AS new_interested,
    count(*) FILTER(WHERE f.status='converted' AND f.converted_at>=w.start_at AND f.converted_at<w.end_at) AS conversions,
    sum(f.overdue) AS overdue,
    count(*) FILTER(WHERE f.untouched AND f.created_at<w.at-interval '2 days') AS untouched_two_days,
    count(*) FILTER(WHERE f.untouched AND f.created_at<w.at-interval '7 days') AS untouched_seven_days,
    count(*) FILTER(WHERE f.untouched AND f.created_at<w.at-interval '14 days') AS untouched_fourteen_days
  FROM facts f CROSS JOIN bounds w GROUP BY f.owner_id
), agent_follow_up_overrides AS (
  SELECT f.created_by AS agent_id,count(*) AS overrides FROM followups f CROSS JOIN bounds w
  WHERE cardinality(f.policy_warning_codes)>0 AND f.created_at>=w.start_at AND f.created_at<w.end_at
  GROUP BY f.created_by
), agent_follow_ups AS (
  SELECT f.assignee_id AS agent_id,count(*) AS due,
    count(*) FILTER(WHERE f.status='completed' AND f.completed_at<=f.due_at+interval '1 hour') AS on_time
  FROM followups f CROSS JOIN bounds w WHERE f.due_at>=w.start_at AND f.due_at<w.end_at
  GROUP BY f.assignee_id
)
SELECT jsonb_build_object(
  'callsMade',(SELECT count(*) FROM period_calls),
  'callsConnected',(SELECT count(*) FROM period_calls WHERE connected),
  'newInterested',(SELECT count(*) FROM facts f,bounds b WHERE f.first_interested>=b.start_at AND f.first_interested<b.end_at),
  'conversions',(SELECT count(*) FROM facts f,bounds b WHERE f.status='converted' AND f.converted_at>=b.start_at AND f.converted_at<b.end_at),
  'followUpsOverdue',(SELECT coalesce(sum(overdue),0) FROM facts),
  'untouchedPastDue',(SELECT count(*) FROM facts WHERE untouched AND past_due)
) AS tiles,
(SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY row.name,row.id),'[]') FROM (
  SELECT b.id,b.name,t.name AS team,
    coalesce(c.made,0) AS calls_made,coalesce(c.connected,0) AS calls_connected,
    coalesce(p.new_interested,0) AS new_interested,coalesce(p.conversions,0) AS conversions,coalesce(p.overdue,0) AS overdue,
    coalesce(p.untouched_two_days,0) AS untouched_two_days,coalesce(p.untouched_seven_days,0) AS untouched_seven_days,
    coalesce(p.untouched_fourteen_days,0) AS untouched_fourteen_days,l.at AS last_call,
    coalesce(c.overrides,0)+coalesce(o.overrides,0) AS overrides,
    coalesce(f.due,0) AS follow_ups_due,coalesce(f.on_time,0) AS follow_ups_on_time,
    (SELECT coalesce(sum(coalesce(override.daily_target,policy.daily_target)),0)
     FROM generate_series($1::date::timestamp,$2::date::timestamp,'1 day') day(at)
     CROSS JOIN LATERAL (
       SELECT daily_target,working_days FROM prospect_cadence_policy_versions
       WHERE status IN('active','retired') AND (approved_at IS NULL OR (approved_at AT TIME ZONE 'Asia/Dubai')::date<=day.at::date)
       ORDER BY approved_at DESC NULLS LAST,id LIMIT 1
     ) policy
     LEFT JOIN LATERAL (
       SELECT daily_target FROM prospect_agent_targets WHERE agent_id=b.id AND effective_from<=day.at::date
       ORDER BY effective_from DESC,created_at DESC,id DESC LIMIT 1
     ) override ON true
     WHERE extract(isodow FROM day.at)::smallint=ANY(policy.working_days)) AS target
  FROM brokers b LEFT JOIN teams t ON t.id=b.team_id
  LEFT JOIN agent_calls c ON c.agent_id=b.id
  LEFT JOIN agent_last_call l ON l.agent_id=b.id
  LEFT JOIN agent_prospects p ON p.agent_id=b.id
  LEFT JOIN agent_follow_up_overrides o ON o.agent_id=b.id
  LEFT JOIN agent_follow_ups f ON f.agent_id=b.id
  WHERE b.job_role='sales_agent' AND b.status='active' AND (p.agent_id IS NOT NULL OR l.agent_id IS NOT NULL)
) row) AS agents,
(SELECT jsonb_build_object('created',count(*),'contacted',count(*) FILTER(WHERE contacted),
 'connected',count(*) FILTER(WHERE contacted AND connected),
 'interested',count(*) FILTER(WHERE contacted AND connected AND interested),
 'converted',count(*) FILTER(WHERE contacted AND connected AND interested AND status='converted')) FROM cohort) AS funnel,
(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.day),'[]') FROM (
  SELECT date_trunc($3::text,occurred_at AT TIME ZONE 'Asia/Dubai')::date AS day,count(*) AS made,
    count(*) FILTER(WHERE connected) AS connected FROM period_calls GROUP BY 1
) x) AS trend,
(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.outcome,x.reason),'[]') FROM (
  SELECT outcome,not_interested_reason AS reason,count(*) AS count FROM period_calls GROUP BY 1,2
) x) AS outcomes,
(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.source,x.batch),'[]') FROM (
  SELECT source,upload_batch_id AS batch,count(*) AS prospects,count(*) FILTER(WHERE contacted) AS contacted,
    count(*) FILTER(WHERE connected) AS connected,count(*) FILTER(WHERE interested) AS interested,
    count(*) FILTER(WHERE status='converted') AS converted,
    count(*) FILTER(WHERE status IN('do_not_contact','not_interested')) AS closed
  FROM cohort GROUP BY GROUPING SETS ((source),(source,upload_batch_id))
  HAVING grouping(upload_batch_id)=1 OR upload_batch_id IS NOT NULL
) x) AS sources,
(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.since,x.id),'[]') FROM (
  SELECT f.id,f.display_name,f.owner_id,coalesce(f.last_activity_at,f.created_at) AS since,
    f.untouched,f.past_due,count(*) OVER() AS total
  FROM facts f,bounds b
  WHERE f.untouched OR (f.last_activity_at<b.at-interval '14 days' AND NOT f.has_open)
  ORDER BY since,f.id LIMIT 50 OFFSET $9::int
) x) AS aging`;

export const prospectDashboardSummary = scoped => prospectDashboardCte(scoped) + summary;

const metrics = {
  contacted: 'contacted', connected: 'connected', interested: 'interested', converted: "status='converted'",
  untouched: 'untouched', untouchedPastDue: 'untouched AND past_due', followUpsOverdue: 'overdue>0',
  newInterested: 'first_interested>=b.start_at AND first_interested<b.end_at',
  conversions: "status='converted' AND converted_at>=b.start_at AND converted_at<b.end_at",
  callsMade: 'EXISTS (SELECT 1 FROM period_calls c WHERE c.prospect_id=f.id)',
  callsConnected: 'EXISTS (SELECT 1 FROM period_calls c WHERE c.prospect_id=f.id AND c.connected)',
};

export function prospectDashboardDrilldown(scoped, metric, { exportAll = false } = {}) {
  if (!Object.hasOwn(metrics, metric)) return null;
  const limit=exportAll?50001:50;
  if(metric==='callsMade'||metric==='callsConnected'){
    const connected=metric==='callsConnected'?'AND c.connected':'';
    return prospectDashboardCte(scoped) + `
      SELECT f.id,f.display_name,f.owner_id,f.status,f.source,f.created_at,c.id AS activity_id,
        c.occurred_at,c.outcome,count(*) OVER()::int AS total
      FROM period_calls c JOIN facts f ON f.id=c.prospect_id
      WHERE $3::text IN ('day','week') ${connected} ORDER BY c.occurred_at DESC,c.id LIMIT ${limit} OFFSET $9`;
  }

  return prospectDashboardCte(scoped) + `
    SELECT f.id,f.display_name,f.owner_id,f.status,f.source,f.created_at,count(*) OVER()::int AS total
    FROM facts f CROSS JOIN bounds b WHERE (${metrics[metric]})
    AND $3::text IN ('day','week') ORDER BY f.created_at DESC,f.id LIMIT ${limit} OFFSET $9`;
}

export function prospectCsvCell(value) {
  const text = String(value ?? '');
  return '"' + (/^[\s]*[=+\-@\t\r\n]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
}
