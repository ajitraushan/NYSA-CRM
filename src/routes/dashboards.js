import { Router } from '../lib/http-kit.js';
import { one,many,execute,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isManager,isCompanyReader,leadScopeSql } from '../crm-policy.js';
import { dashboardTypeFor,buildDashboardMetric } from '../dashboard-domain.js';

const r=Router();r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM dashboards are restricted to NYSA staff'}));
const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
function filters(req,alias='l',dateColumn=`${alias}.created_at`){
  const params=[],scope=leadScopeSql(alias,req.broker,params),where=[`(${scope.clause})`],add=(sql,v)=>{params.push(v);where.push(sql.replace('?',`$${params.length}`));};
  const now=new Date(),end=req.query.dateTo?new Date(req.query.dateTo):now,start=req.query.dateFrom?new Date(req.query.dateFrom):new Date(end.getTime()-30*86400000);
  if(Number.isNaN(start.valueOf())||Number.isNaN(end.valueOf())||start>end)return {error:'Invalid date range'};
  add(`${dateColumn}>=?`,start);add(`${dateColumn}<?`,new Date(end.getTime()+86400000));
  if(req.query.source)add(`${alias}.source=?`,req.query.source);if(req.query.teamId)add(`${alias}.assigned_team_id=?`,req.query.teamId);
  if(req.query.agentId)add(`${alias}.assigned_to=?`,req.query.agentId);if(req.query.businessType)add(`${alias}.business_type=?`,req.query.businessType);if(req.query.stage)add(`${alias}.stage=?`,req.query.stage);
  return {params,where:where.join(' AND '),start,end,selected:{dateFrom:start.toISOString().slice(0,10),dateTo:end.toISOString().slice(0,10),source:req.query.source||null,teamId:req.query.teamId||null,agentId:req.query.agentId||null,businessType:req.query.businessType||null,stage:req.query.stage||null}};
}
function priorWhere(base,alias='l'){const days=Math.max(1,Math.ceil((base.end-base.start)/86400000)+1),end=new Date(base.start.getTime()-1),start=new Date(end.getTime()-(days-1)*86400000);const params=[],scope=leadScopeSql(alias,base.broker,params),where=[`(${scope.clause})`],add=(sql,v)=>{params.push(v);where.push(sql.replace('?',`$${params.length}`));};add(`${alias}.created_at>=?`,start);add(`${alias}.created_at<?`,new Date(base.start));if(base.selected.source)add(`${alias}.source=?`,base.selected.source);if(base.selected.teamId)add(`${alias}.assigned_team_id=?`,base.selected.teamId);if(base.selected.agentId)add(`${alias}.assigned_to=?`,base.selected.agentId);if(base.selected.businessType)add(`${alias}.business_type=?`,base.selected.businessType);if(base.selected.stage)add(`${alias}.stage=?`,base.selected.stage);return {where:where.join(' AND '),params,start,end};}

r.get('/crm/dashboard',async(req,res)=>{
  const f=filters(req);if(f.error)return res.status(400).json({error:f.error});f.broker=req.broker;const prior=priorWhere(f),type=dashboardTypeFor(req.broker);
  const [current,previous,stages,sources,teams,agents,trend,tasks,exceptions,proposals,calls,inventory,targets,hierarchyRows,integrationFailures]=await Promise.all([
    one(`SELECT COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE temperature='Hot')::int AS hot,COUNT(*) FILTER(WHERE temperature='Warm')::int AS warm,
      COUNT(*) FILTER(WHERE stage='Won')::int AS won,COUNT(*) FILTER(WHERE accepted_at IS NULL AND acceptance_due_at<NOW())::int AS acceptance_breaches,
      COUNT(*) FILTER(WHERE accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at<NOW())::int AS contact_breaches,
      COUNT(*) FILTER(WHERE next_follow_up_at IS NULL AND stage NOT IN('Won','Lost'))::int AS no_next_action FROM leads l WHERE ${f.where}`,f.params),
    one(`SELECT COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE stage='Won')::int AS won FROM leads l WHERE ${prior.where}`,prior.params),
    many(`SELECT stage AS label,COUNT(*)::int AS value FROM leads l WHERE ${f.where} GROUP BY stage ORDER BY value DESC`,f.params),
    many(`SELECT source AS label,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE stage='Won')::int AS won FROM leads l WHERE ${f.where} GROUP BY source ORDER BY value DESC`,f.params),
    many(`SELECT COALESCE(t.name,'Unassigned') AS label,l.assigned_team_id AS id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE l.stage='Won')::int AS won FROM leads l LEFT JOIN teams t ON t.id=l.assigned_team_id WHERE ${f.where} GROUP BY t.name,l.assigned_team_id ORDER BY value DESC`,f.params),
    many(`SELECT COALESCE(b.name,'Unassigned') AS label,l.assigned_to AS id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE l.stage='Won')::int AS won,
      COUNT(*) FILTER(WHERE l.next_follow_up_at<NOW() AND l.stage NOT IN('Won','Lost'))::int AS overdue FROM leads l LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where} GROUP BY b.name,l.assigned_to ORDER BY value DESC`,f.params),
    many(`SELECT DATE_TRUNC('week',l.created_at)::date AS period,COUNT(*)::int AS value FROM leads l WHERE ${f.where} GROUP BY period ORDER BY period`,f.params),
    many(`SELECT CASE WHEN t.status='completed' THEN 'completed' WHEN t.due_at<NOW() THEN 'overdue' WHEN t.due_at<CURRENT_DATE+INTERVAL '1 day' THEN 'today' ELSE 'upcoming' END AS label,COUNT(*)::int AS value
      FROM tasks t JOIN leads l ON l.id=t.lead_id WHERE ${f.where} GROUP BY label`,f.params),
    one(`SELECT COUNT(*) FILTER(WHERE (c.email IS NULL AND c.phone IS NULL))::int AS missing_contact,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM lead_requirements q WHERE q.lead_id=l.id AND q.superseded_at IS NULL))::int AS missing_requirement,
      COUNT(*) FILTER(WHERE c.do_not_contact=1)::int AS restricted_contact,
      COUNT(*) FILTER(WHERE c.do_not_contact=0 AND NOT EXISTS(SELECT 1 FROM marketing_agreements ma WHERE ma.contact_id=c.id AND ma.status='executed' AND ma.effective_at<=NOW() AND (ma.expires_at IS NULL OR ma.expires_at>NOW())))::int AS missing_consent,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.lead_id=l.id AND d.status<>'retired'))::int AS missing_document,
      0::int AS integration_failures
      FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE ${f.where}`,f.params),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE p.status='draft')::int AS prepare,COUNT(*) FILTER(WHERE p.status='generated')::int AS review,
      COUNT(*) FILTER(WHERE p.status='reviewed')::int AS send,COUNT(*) FILTER(WHERE p.status='sent')::int AS sent FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE ${f.where}`,f.params),
    one(`SELECT COUNT(*)::int AS total,COALESCE(SUM(a.duration_seconds),0)::int AS duration_seconds,COUNT(*) FILTER(WHERE a.follow_up_required=1)::int AS follow_up_required
      FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.activity_type='Call' AND ${f.where}`,f.params),
    one(`SELECT COUNT(*) FILTER(WHERE status='Available')::int AS available,COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '30 days' AND status<>'Closed')::int AS stale,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved'))::int AS media_not_ready FROM listings WHERE deleted_at IS NULL`),
    many(`SELECT metric_code,target_value,unit,definition FROM dashboard_targets WHERE status='active' AND scope_type='company' AND period_start<=$1 AND period_end>=$2`,[f.end,f.start]),
    many(`SELECT l.business_type,COALESCE(t.name,'Unassigned') AS team_name,l.assigned_team_id AS team_id,COALESCE(m.name,'No manager') AS manager_name,
      COALESCE(b.name,'Unassigned') AS agent_name,l.assigned_to AS agent_id,COUNT(*)::int AS value FROM leads l LEFT JOIN teams t ON t.id=l.assigned_team_id
      LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where}
      GROUP BY l.business_type,t.name,l.assigned_team_id,m.name,b.name,l.assigned_to ORDER BY l.business_type,t.name,m.name,b.name`,f.params),
    isManager(req.broker)?one("SELECT COUNT(*)::int AS count FROM website_intake_events WHERE status='failed'"):Promise.resolve({count:0})
  ]);
  exceptions.integrationFailures=integrationFailures.count;
  const hierarchy={company:'NYSA CRM',businessLines:[]};for(const row of hierarchyRows){let business=hierarchy.businessLines.find(x=>x.code===row.businessType);if(!business){business={code:row.businessType,teams:[]};hierarchy.businessLines.push(business);}let team=business.teams.find(x=>x.id===row.teamId&&x.manager===row.managerName);if(!team){team={id:row.teamId,name:row.teamName,manager:row.managerName,agents:[]};business.teams.push(team);}team.agents.push({id:row.agentId,name:row.agentName,value:row.value});}
  const target=code=>targets.find(x=>x.metricCode===code),kpis=[buildDashboardMetric('new_leads','New leads',current.leads,previous.leads,target('new_leads')?.targetValue??null,'leads','Distinct lead records received in selected period.'),
    buildDashboardMetric('won_leads','Won leads',current.won,previous.won,target('won_leads')?.targetValue??null,'leads','Leads reaching Won in the selected creation cohort.'),
    buildDashboardMetric('sla_breaches','SLA breaches',current.acceptanceBreaches+current.contactBreaches,0,target('sla_breaches')?.targetValue??null,'leads','Accessible open leads past acceptance or first-contact deadline.'),
    buildDashboardMetric('no_next_action','No next action',current.noNextAction,0,target('no_next_action')?.targetValue??null,'leads','Accessible non-terminal leads without a scheduled next action.')];
  const recentActivities=await many(`SELECT a.id,a.activity_type,a.subject,a.outcome,a.created_at,l.id AS lead_id,l.title,c.full_name AS contact_name,b.name AS owner_name FROM activities a
    JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id JOIN brokers b ON b.id=a.owner_id WHERE ${f.where} ORDER BY a.created_at DESC LIMIT 12`,f.params);
  res.json({dashboardType:type,view:type==='executive'?(req.query.view||'Executive'):type,dataAsOf:new Date(),lastRefresh:new Date(),filters:f.selected,period:{current:{from:f.start,to:f.end},prior:{from:prior.start,to:prior.end}},calculationContext:'Record-scoped operational data; reassignment history is not rewritten. Counts use distinct lead records.',kpis,qualification:{hot:current.hot,warm:current.warm},stages,sources,teams,agents,trend,tasks,exceptions,proposals,calls,inventory,recentActivities,
    hierarchy,futureMetrics:[{label:'Weighted opportunity pipeline',status:'unavailable',availableFrom:'Future opportunity/deal release'},{label:'Revenue and commission forecast',status:'unavailable',availableFrom:'Future transaction/commission release'}]});
});

r.get('/crm/reports/calls',async(req,res)=>{const f=filters(req,'l','a.created_at');if(f.error)return res.status(400).json({error:f.error});const rows=await many(`SELECT a.id,a.created_at,a.direction,a.outcome,a.duration_seconds,a.details,a.follow_up_required,a.due_at,a.completed_at,
  a.lead_stage_snapshot,a.qualification_snapshot,l.id AS lead_id,l.title,c.id AS contact_id,c.full_name AS contact_name,x.project AS listing_project,b.name AS agent_name
  FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id LEFT JOIN listings x ON x.id=l.listing_id JOIN brokers b ON b.id=a.owner_id
  WHERE a.activity_type='Call' AND ${f.where} ORDER BY a.created_at DESC`,f.params);res.json({dataAsOf:new Date(),filters:f.selected,count:rows.length,calls:rows});});

r.get('/crm/dashboard/records',async(req,res)=>{const f=filters(req);if(f.error)return res.status(400).json({error:f.error});const extra=[];if(req.query.segment==='sla_breaches')extra.push("((l.accepted_at IS NULL AND l.acceptance_due_at<NOW()) OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at<NOW()))");if(req.query.segment==='no_next_action')extra.push("l.next_follow_up_at IS NULL AND l.stage NOT IN('Won','Lost')");if(req.query.segment==='won_leads')extra.push("l.stage='Won'");if(req.query.segment==='hot')extra.push("l.temperature='Hot'");const rows=await many(`SELECT l.id,l.title,l.source,l.business_type,l.stage,l.temperature,l.created_at,l.next_follow_up_at,c.full_name AS contact_name,t.name AS team_name,b.name AS agent_name
  FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where}${extra.length?' AND '+extra.join(' AND '):''} ORDER BY l.created_at DESC LIMIT 500`,f.params);res.json({dataAsOf:new Date(),filters:f.selected,count:rows.length,records:rows});});

const csvCell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
r.get('/crm/dashboard/export',async(req,res)=>{const f=filters(req);if(f.error)return res.status(400).json({error:f.error});const rows=await many(`SELECT l.id,l.title,c.full_name AS contact_name,l.source,l.business_type,l.stage,l.temperature,t.name AS team_name,b.name AS agent_name,l.created_at,l.next_follow_up_at FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where} ORDER BY l.created_at DESC`,f.params);const headers=['id','title','contactName','source','businessType','stage','temperature','teamName','agentName','createdAt','nextFollowUpAt'],csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(h=>csvCell(row[h])).join(','))].join('\r\n');await audit('DashboardExport',uuid(),'exported',req.broker.id,{filters:f.selected,rowCount:rows.length,dashboardType:dashboardTypeFor(req.broker)});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="nysa-dashboard-export.csv"');res.end(csv);});

r.post('/admin/dashboard-targets',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const b=req.body||{};if(!clean(b.metricCode)||!['company','business_line','team','agent'].includes(b.scopeType)||!b.periodStart||!b.periodEnd||!Number.isFinite(Number(b.targetValue))||!clean(b.unit)||!clean(b.definition))return res.status(400).json({error:'Complete valid target fields are required'});const id=uuid(),row=await one(`INSERT INTO dashboard_targets(id,metric_code,scope_type,scope_id,period_start,period_end,target_value,unit,definition,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,clean(b.metricCode),b.scopeType,clean(b.scopeId),b.periodStart,b.periodEnd,Number(b.targetValue),clean(b.unit),clean(b.definition),req.broker.id]);await audit('DashboardTarget',id,'created',req.broker.id);res.status(201).json(row);});
r.get('/crm/dashboard/views',async(req,res)=>res.json({views:await many('SELECT * FROM saved_dashboard_views WHERE owner_id=$1 ORDER BY name',[req.broker.id])}));
r.post('/crm/dashboard/views',async(req,res)=>{if(!clean(req.body?.name))return res.status(400).json({error:'name is required'});const id=uuid(),row=await one(`INSERT INTO saved_dashboard_views(id,owner_id,name,dashboard_type,filters) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,name,dashboard_type) DO UPDATE SET filters=EXCLUDED.filters,updated_at=NOW() RETURNING *`,[id,req.broker.id,clean(req.body.name),dashboardTypeFor(req.broker),JSON.stringify(req.body.filters||{})]);await audit('SavedDashboardView',row.id,'saved',req.broker.id);res.status(201).json(row);});

export default r;
