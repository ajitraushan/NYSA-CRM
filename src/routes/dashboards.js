import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isManager,isCompanyReader,isProposalApprover,leadScopeSql,proposalApprovalScopeSql } from '../crm-policy.js';
import { dashboardTypeFor,buildRoleDashboardPresentation } from '../dashboard-domain.js';
import { DASHBOARD_METRICS } from '../admin-governance.js';

const r=Router();r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM dashboards are restricted to NYSA staff'}));
const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
function filters(req,alias='l',dateColumn=`${alias}.created_at`){
  const params=[],scope=leadScopeSql(alias,req.broker,params),where=[`(${scope.clause})`],add=(sql,v)=>{params.push(v);where.push(sql.replace('?',`$${params.length}`));};
  const now=new Date(),end=req.query.dateTo?new Date(req.query.dateTo):now,start=req.query.dateFrom?new Date(req.query.dateFrom):new Date(end.getTime()-30*86400000);
  if(Number.isNaN(start.valueOf())||Number.isNaN(end.valueOf())||start>end)return {error:'Invalid date range'};
  add(`${dateColumn}>=?`,start);add(`${dateColumn}<?`,new Date(end.getTime()+86400000));
  if(req.query.source)add(`${alias}.source=?`,req.query.source);if(req.query.teamId)add(`${alias}.assigned_team_id=?`,req.query.teamId);
  if(req.query.campaignCode)add(`${alias}.campaign_code=?`,req.query.campaignCode);
  if(req.query.managerId)add(`${alias}.assigned_team_id IN (SELECT id FROM teams WHERE manager_id=?)`,req.query.managerId);
  if(req.query.agentId)add(`${alias}.assigned_to=?`,req.query.agentId);if(req.query.businessType)add(`${alias}.business_type=?`,req.query.businessType);if(req.query.stage)add(`${alias}.stage=?`,req.query.stage);
  return {params,where:where.join(' AND '),start,end,selected:{dateFrom:start.toISOString().slice(0,10),dateTo:end.toISOString().slice(0,10),source:req.query.source||null,campaignCode:req.query.campaignCode||null,teamId:req.query.teamId||null,managerId:req.query.managerId||null,agentId:req.query.agentId||null,businessType:req.query.businessType||null,stage:req.query.stage||null}};
}
function priorWhere(base,alias='l',dateColumn=`${alias}.created_at`){const days=Math.max(1,Math.ceil((base.end-base.start)/86400000)+1),end=new Date(base.start.getTime()-1),start=new Date(end.getTime()-(days-1)*86400000);const params=[],scope=leadScopeSql(alias,base.broker,params),where=[`(${scope.clause})`],add=(sql,v)=>{params.push(v);where.push(sql.replace('?',`$${params.length}`));};add(`${dateColumn}>=?`,start);add(`${dateColumn}<?`,new Date(base.start));if(base.selected.source)add(`${alias}.source=?`,base.selected.source);if(base.selected.campaignCode)add(`${alias}.campaign_code=?`,base.selected.campaignCode);if(base.selected.teamId)add(`${alias}.assigned_team_id=?`,base.selected.teamId);if(base.selected.managerId)add(`${alias}.assigned_team_id IN (SELECT id FROM teams WHERE manager_id=?)`,base.selected.managerId);if(base.selected.agentId)add(`${alias}.assigned_to=?`,base.selected.agentId);if(base.selected.businessType)add(`${alias}.business_type=?`,base.selected.businessType);if(base.selected.stage)add(`${alias}.stage=?`,base.selected.stage);return {where:where.join(' AND '),params,start,end};}

async function loadProposalApprovalQueue(req,selected={},search='',page=1,pageSize=20){
  if(!isProposalApprover(req.broker))return {rows:[],count:0,page:1,pageSize};
  const params=[],scope=proposalApprovalScopeSql('l',req.broker,params),where=[`(${scope.clause})`,`v.status='generated'`,`v.version_number=(SELECT MAX(latest.version_number) FROM proposal_versions latest WHERE latest.proposal_id=v.proposal_id)`],add=(sql,value)=>{params.push(value);where.push(sql.replace('?',`$${params.length}`));};
  if(selected.teamId)add('l.assigned_team_id=?',selected.teamId);
  if(selected.managerId)add('l.assigned_team_id IN (SELECT id FROM teams WHERE manager_id=?)',selected.managerId);
  if(selected.agentId)add('l.assigned_to=?',selected.agentId);
  if(selected.businessType)add('l.business_type=?',selected.businessType);
  if(search){params.push(`%${search}%`);const key=`$${params.length}`;where.push(`(c.full_name ILIKE ${key} OR l.title ILIKE ${key} OR p.proposal_number ILIKE ${key} OR p.title ILIKE ${key} OR p.template_type ILIKE ${key} OR COALESCE(t.name,'') ILIKE ${key} OR COALESCE(creator.name,'') ILIKE ${key} OR ('Version '||v.version_number::text) ILIKE ${key} OR 'pending approval' ILIKE ${key} OR 'awaiting review' ILIKE ${key} OR TO_CHAR(v.created_at AT TIME ZONE 'Asia/Dubai','DD Mon YYYY HH24:MI') ILIKE ${key})`);}
  const from=`FROM proposal_versions v JOIN proposals p ON p.id=v.proposal_id JOIN leads l ON l.id=p.lead_id JOIN contacts c ON c.id=p.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers creator ON creator.id=v.created_by WHERE ${where.join(' AND ')}`;
  const safePage=Math.max(1,Number(page)||1),safeSize=Math.max(10,Math.min(50,Number(pageSize)||20)),offset=(safePage-1)*safeSize,count=(await one(`SELECT COUNT(*)::int AS count ${from}`,params)).count,rowParams=[...params,safeSize,offset],rows=await many(`SELECT v.id AS version_id,v.version_number,v.document_version_id,v.created_at,p.id AS proposal_id,p.proposal_number,p.title AS proposal_title,p.template_type,l.id AS lead_id,l.title AS lead_title,l.business_type,c.full_name AS customer_name,t.name AS team_name,creator.name AS requested_by ${from} ORDER BY v.created_at DESC,v.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,rowParams);
  return {rows,count,page:safePage,pageSize:safeSize};
}

r.get('/crm/dashboard/filter-options',async(req,res)=>{
  const params=[],scope=leadScopeSql('l',req.broker,params),where=[`(${scope.clause})`,`l.campaign_code IS NOT NULL`,`BTRIM(l.campaign_code)<>''`];
  if(req.query.source){params.push(req.query.source);where.push(`l.source=$${params.length}`);}
  const campaigns=await many(`SELECT l.campaign_code AS value,l.campaign_code AS label,COUNT(*)::int AS lead_count FROM leads l WHERE ${where.join(' AND ')} GROUP BY l.campaign_code ORDER BY l.campaign_code`,params);
  res.json({campaigns});
});

r.get('/crm/dashboard',async(req,res)=>{
  const f=filters(req);if(f.error)return res.status(400).json({error:f.error});
  const proposalF=filters(req,'l','p.updated_at'),callF=filters(req,'l','a.created_at');
  f.broker=req.broker;proposalF.broker=req.broker;callF.broker=req.broker;
  const prior=priorWhere(f),priorProposal=priorWhere(proposalF,'l','p.updated_at'),priorCall=priorWhere(callF,'l','a.created_at'),type=dashboardTypeFor(req.broker),canSeeIntegration=isManager(req.broker)||isCompanyReader(req.broker);
  const [current,previous,stages,sources,priorSources,campaigns,teams,agents,trend,tasks,exceptions,previousExceptions,proposals,calls,priorProposals,priorCalls,priorAgents,inventory,targets,hierarchyRows,accountabilityRows,integrationFailures,previousIntegrationFailures]=await Promise.all([
    one(`SELECT COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE temperature='Hot')::int AS hot,COUNT(*) FILTER(WHERE temperature='Warm')::int AS warm,
      COUNT(*) FILTER(WHERE stage='Won')::int AS won,COUNT(*) FILTER(WHERE accepted_at IS NULL AND acceptance_due_at<NOW())::int AS acceptance_breaches,
      COUNT(*) FILTER(WHERE accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at<NOW())::int AS contact_breaches,
      COUNT(*) FILTER(WHERE stage NOT IN('Won','Lost') AND accepted_at IS NULL)::int AS awaiting_acceptance,
      COUNT(*) FILTER(WHERE stage NOT IN('Won','Lost') AND ((accepted_at IS NULL AND acceptance_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes') OR
        (accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes')))::int AS sla_risk,
      COUNT(*) FILTER(WHERE next_follow_up_at IS NULL AND stage NOT IN('Won','Lost'))::int AS no_next_action,
      COUNT(*) FILTER(WHERE assigned_to IS NULL AND stage NOT IN('Won','Lost'))::int AS unassigned,
      COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '7 days' AND stage NOT IN('Won','Lost'))::int AS stale_risk,
      COUNT(*) FILTER(WHERE temperature IN('Hot','Warm') AND updated_at<NOW()-INTERVAL '7 days' AND stage NOT IN('Won','Lost'))::int AS hot_warm_aging,
      COUNT(*) FILTER(WHERE stage NOT IN('Won','Lost'))::int AS open FROM leads l WHERE ${f.where}`,f.params),
    one(`SELECT COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE temperature='Hot')::int AS hot,COUNT(*) FILTER(WHERE temperature='Warm')::int AS warm,
      COUNT(*) FILTER(WHERE stage='Won')::int AS won,COUNT(*) FILTER(WHERE accepted_at IS NULL AND acceptance_due_at<NOW())::int AS acceptance_breaches,
      COUNT(*) FILTER(WHERE accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at<NOW())::int AS contact_breaches,
      COUNT(*) FILTER(WHERE next_follow_up_at IS NULL AND stage NOT IN('Won','Lost'))::int AS no_next_action,
      COUNT(*) FILTER(WHERE assigned_to IS NULL AND stage NOT IN('Won','Lost'))::int AS unassigned,
      COUNT(*) FILTER(WHERE stage NOT IN('Won','Lost') AND ((accepted_at IS NULL AND acceptance_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes') OR (accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes')))::int AS sla_risk,
      COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '7 days' AND stage NOT IN('Won','Lost'))::int AS stale_risk FROM leads l WHERE ${prior.where}`,prior.params),
    many(`SELECT stage AS label,COUNT(*)::int AS value FROM leads l WHERE ${f.where} GROUP BY stage ORDER BY value DESC`,f.params),
    many(`SELECT source AS label,source AS id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE stage='Won')::int AS won FROM leads l WHERE ${f.where} GROUP BY source ORDER BY value DESC`,f.params),
    many(`SELECT source AS label,source AS id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE stage='Won')::int AS won FROM leads l WHERE ${prior.where} GROUP BY source ORDER BY value DESC`,prior.params),
    many(`SELECT COALESCE(campaign_code,'Unattributed') AS label,campaign_code AS id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE stage='Won')::int AS won FROM leads l WHERE ${f.where} GROUP BY campaign_code ORDER BY value DESC`,f.params),
    many(`SELECT COALESCE(t.name,'Unassigned') AS label,l.assigned_team_id AS id,t.manager_id,COUNT(*)::int AS value,
      COUNT(*) FILTER(WHERE l.stage='Won')::int AS won,COUNT(*) FILTER(WHERE l.stage NOT IN('Won','Lost'))::int AS open,
      COUNT(DISTINCT l.assigned_to) FILTER(WHERE l.assigned_to IS NOT NULL)::int AS agents FROM leads l LEFT JOIN teams t ON t.id=l.assigned_team_id WHERE ${f.where} GROUP BY t.name,l.assigned_team_id,t.manager_id ORDER BY value DESC`,f.params),
    many(`SELECT COALESCE(b.name,'Unassigned') AS label,l.assigned_to AS id,l.assigned_team_id AS team_id,COUNT(*)::int AS value,COUNT(*) FILTER(WHERE l.stage='Won')::int AS won,
      COUNT(*) FILTER(WHERE l.stage NOT IN('Won','Lost'))::int AS open,COUNT(*) FILTER(WHERE l.next_follow_up_at<NOW() AND l.stage NOT IN('Won','Lost'))::int AS overdue,
      COUNT(*) FILTER(WHERE l.accepted_at IS NULL AND l.acceptance_due_at<NOW())::int AS sla_breaches FROM leads l LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where} GROUP BY b.name,l.assigned_to,l.assigned_team_id ORDER BY value DESC`,f.params),
    many(`SELECT DATE_TRUNC('week',l.created_at)::date AS period,COUNT(*)::int AS value FROM leads l WHERE ${f.where} GROUP BY period ORDER BY period`,f.params),
    many(`SELECT CASE WHEN t.status='completed' THEN 'completed' WHEN t.due_at<NOW() THEN 'overdue' WHEN t.due_at<CURRENT_DATE+INTERVAL '1 day' THEN 'today' ELSE 'upcoming' END AS label,COUNT(*)::int AS value
      FROM tasks t JOIN leads l ON l.id=t.lead_id WHERE ${f.where} GROUP BY label`,f.params),
    one(`SELECT COUNT(*) FILTER(WHERE (c.email IS NULL AND c.phone IS NULL))::int AS missing_contact,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM lead_requirements q WHERE q.lead_id=l.id AND q.superseded_at IS NULL))::int AS missing_requirement,
      COUNT(*) FILTER(WHERE c.do_not_contact=1)::int AS restricted_contact,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM contact_channels cc JOIN contact_channels dc ON dc.channel_kind=cc.channel_kind AND dc.normalized_value=cc.normalized_value AND dc.contact_id<>cc.contact_id WHERE cc.contact_id=c.id AND cc.normalized_value IS NOT NULL))::int AS duplicate_contact,
      COUNT(*) FILTER(WHERE c.do_not_contact=0 AND NOT EXISTS(SELECT 1 FROM marketing_agreements ma WHERE ma.contact_id=c.id AND ma.status='executed' AND ma.effective_at<=NOW() AND (ma.expires_at IS NULL OR ma.expires_at>NOW())))::int AS missing_consent,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.lead_id=l.id AND d.status<>'retired'))::int AS missing_document,
      0::int AS integration_failures
      FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE ${f.where}`,f.params),
    one(`SELECT COUNT(*) FILTER(WHERE (c.email IS NULL AND c.phone IS NULL))::int AS missing_contact,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM lead_requirements q WHERE q.lead_id=l.id AND q.superseded_at IS NULL))::int AS missing_requirement,
      COUNT(*) FILTER(WHERE c.do_not_contact=1)::int AS restricted_contact,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM contact_channels cc JOIN contact_channels dc ON dc.channel_kind=cc.channel_kind AND dc.normalized_value=cc.normalized_value AND dc.contact_id<>cc.contact_id WHERE cc.contact_id=c.id AND cc.normalized_value IS NOT NULL))::int AS duplicate_contact,
      COUNT(*) FILTER(WHERE c.do_not_contact=0 AND NOT EXISTS(SELECT 1 FROM marketing_agreements ma WHERE ma.contact_id=c.id AND ma.status='executed' AND ma.effective_at<=NOW() AND (ma.expires_at IS NULL OR ma.expires_at>NOW())))::int AS missing_consent,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.lead_id=l.id AND d.status<>'retired'))::int AS missing_document,
      0::int AS integration_failures FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE ${prior.where}`,prior.params),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE p.status='draft')::int AS prepare,COUNT(*) FILTER(WHERE p.status='generated')::int AS review,
      COUNT(*) FILTER(WHERE p.status='reviewed')::int AS send,COUNT(*) FILTER(WHERE p.status='sent')::int AS sent FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE ${proposalF.where}`,proposalF.params),
    one(`SELECT COUNT(*)::int AS total,COALESCE(SUM(a.duration_seconds),0)::int AS duration_seconds,COUNT(*) FILTER(WHERE a.follow_up_required=1)::int AS follow_up_required
      FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.activity_type='Call' AND ${callF.where}`,callF.params),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE p.status='draft')::int AS prepare,COUNT(*) FILTER(WHERE p.status='generated')::int AS review,
      COUNT(*) FILTER(WHERE p.status='reviewed')::int AS send,COUNT(*) FILTER(WHERE p.status='sent')::int AS sent FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE ${priorProposal.where}`,priorProposal.params),
    one(`SELECT COUNT(*)::int AS total FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.activity_type='Call' AND ${priorCall.where}`,priorCall.params),
    many(`SELECT l.assigned_to AS id,COUNT(*) FILTER(WHERE l.stage NOT IN('Won','Lost'))::int AS open FROM leads l WHERE ${prior.where} GROUP BY l.assigned_to`,prior.params),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='Available')::int AS available,COUNT(*) FILTER(WHERE status='Reserved')::int AS reserved,
      COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '30 days' AND status<>'Closed')::int AS stale,
      COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '60 days' AND status<>'Closed')::int AS stale60,
      COUNT(*) FILTER(WHERE updated_at<NOW()-INTERVAL '90 days' AND status<>'Closed')::int AS stale90,
      COUNT(*) FILTER(WHERE status<>'Closed' AND (availability_confirmed_at IS NULL OR availability_confirmed_at<NOW()-INTERVAL '7 days'))::int AS availability_unconfirmed,
      COUNT(*) FILTER(WHERE status<>'Closed' AND permit_expires_at IS NOT NULL AND permit_expires_at<NOW()+INTERVAL '30 days')::int AS permit_exposure,
      COUNT(*) FILTER(WHERE status<>'Closed' AND (verification_status NOT IN('verified','not_required') OR verification_expires_at<NOW()+INTERVAL '30 days'))::int AS verification_exposure,
      COUNT(*) FILTER(WHERE status<>'Closed' AND portal_status NOT IN('ready','published'))::int AS portal_not_ready,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved'))::int AS media_not_ready,
      COUNT(*) FILTER(WHERE status<>'Closed' AND (updated_at<NOW()-INTERVAL '30 days' OR availability_confirmed_at IS NULL OR availability_confirmed_at<NOW()-INTERVAL '7 days'))::int AS aging_exposure,
      COUNT(*) FILTER(WHERE status<>'Closed' AND ((permit_expires_at IS NOT NULL AND permit_expires_at<NOW()+INTERVAL '30 days') OR verification_status NOT IN('verified','not_required') OR verification_expires_at<NOW()+INTERVAL '30 days' OR NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved')))::int AS compliance_exposure,
      COUNT(*) FILTER(WHERE status<>'Closed' AND (availability_confirmed_at IS NULL OR availability_confirmed_at<NOW()-INTERVAL '7 days' OR (permit_expires_at IS NOT NULL AND permit_expires_at<NOW()+INTERVAL '30 days') OR verification_status NOT IN('verified','not_required') OR verification_expires_at<NOW()+INTERVAL '30 days' OR portal_status NOT IN('ready','published') OR NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved')))::int AS readiness_exposure FROM listings WHERE deleted_at IS NULL`),
    many(`SELECT metric_code,target_value,unit,definition,exception_threshold,threshold_direction,benchmark_source,scope_type,scope_id FROM dashboard_targets
      WHERE status='active' AND period_start<=$1 AND period_end>=$2 AND (scope_type='company' OR (scope_type='business_line' AND scope_id=$3) OR (scope_type='team' AND scope_id=$4) OR (scope_type='agent' AND scope_id=$5))
      ORDER BY CASE scope_type WHEN 'agent' THEN 1 WHEN 'team' THEN 2 WHEN 'business_line' THEN 3 ELSE 4 END`,[f.end,f.start,f.selected.businessType,f.selected.teamId,f.selected.agentId]),
    many(`SELECT l.business_type,COALESCE(t.name,'Unassigned') AS team_name,l.assigned_team_id AS team_id,t.manager_id,COALESCE(m.name,'No manager') AS manager_name,
      COALESCE(b.name,'Unassigned') AS agent_name,l.assigned_to AS agent_id,COUNT(*)::int AS value FROM leads l LEFT JOIN teams t ON t.id=l.assigned_team_id
      LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where}
      GROUP BY l.business_type,t.name,l.assigned_team_id,t.manager_id,m.name,b.name,l.assigned_to ORDER BY l.business_type,t.name,m.name,b.name`,f.params),
    many(`SELECT l.business_type,t.name AS team_name,m.name AS manager_name,b.name AS agent_name,
      COUNT(*) FILTER(WHERE (l.accepted_at IS NULL AND l.acceptance_due_at<NOW()) OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at<NOW()))::int AS sla_breaches,
      COUNT(*) FILTER(WHERE l.assigned_to IS NULL AND l.stage NOT IN('Won','Lost'))::int AS unassigned_leads,
      COUNT(*) FILTER(WHERE l.next_follow_up_at IS NULL AND l.stage NOT IN('Won','Lost'))::int AS no_next_action,
      COUNT(*) FILTER(WHERE l.updated_at<NOW()-INTERVAL '7 days' AND l.stage NOT IN('Won','Lost'))::int AS stale_risk,
      COUNT(*) FILTER(WHERE (c.email IS NULL AND c.phone IS NULL) OR c.do_not_contact=1 OR EXISTS(SELECT 1 FROM contact_channels cc JOIN contact_channels dc ON dc.channel_kind=cc.channel_kind AND dc.normalized_value=cc.normalized_value AND dc.contact_id<>cc.contact_id WHERE cc.contact_id=c.id AND cc.normalized_value IS NOT NULL) OR (c.do_not_contact=0 AND NOT EXISTS(SELECT 1 FROM marketing_agreements ma WHERE ma.contact_id=c.id AND ma.status='executed' AND ma.effective_at<=NOW() AND (ma.expires_at IS NULL OR ma.expires_at>NOW()))) OR NOT EXISTS(SELECT 1 FROM lead_requirements q WHERE q.lead_id=l.id AND q.superseded_at IS NULL) OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.lead_id=l.id AND d.status<>'retired'))::int AS operational_exceptions
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to
      WHERE ${f.where} GROUP BY l.business_type,t.name,m.name,b.name`,f.params),
    canSeeIntegration?one("SELECT COUNT(*)::int AS count FROM website_intake_events WHERE status='failed' AND received_at>=$1 AND received_at<$2",[f.start,new Date(f.end.getTime()+86400000)]):Promise.resolve({count:0}),
    canSeeIntegration?one('SELECT COUNT(*)::int AS count FROM website_intake_events WHERE status=\'failed\' AND received_at>=$1 AND received_at<$2',[prior.start,new Date(f.start)]):Promise.resolve({count:0})
  ]);
  exceptions.integrationFailures=integrationFailures.count;
  previousExceptions.integrationFailures=previousIntegrationFailures.count;
  const inventorySnapshotValues={inventory_available:Number(inventory.available||0),inventory_stale:Number(inventory.stale||0),inventory_readiness_exposure:Number(inventory.readinessExposure||0)};
  const previousInventoryRows=await many(`SELECT DISTINCT ON(metric_code) metric_code,value FROM dashboard_metric_snapshots WHERE scope_type='company' AND scope_id='' AND metric_code=ANY($1::text[]) AND snapshot_date<$2 ORDER BY metric_code,snapshot_date DESC`,[Object.keys(inventorySnapshotValues),f.start]);
  const previousInventory={...Object.fromEntries(previousInventoryRows.map(row=>[row.metricCode,Number(row.value)])),team_capacity_pressure:priorAgents.filter(agent=>agent.id&&Number(agent.open||0)>=10).length,proposal_workload:Number(priorProposals.prepare||0)+Number(priorProposals.review||0)+Number(priorProposals.send||0),customer_engagement:Number(priorCalls.total||0)+Number(priorProposals.sent||0)};
  for(const [metricCode,value] of Object.entries(inventorySnapshotValues))await execute(`INSERT INTO dashboard_metric_snapshots(id,metric_code,scope_type,scope_id,snapshot_date,value) VALUES($1,$2,'company','',CURRENT_DATE,$3) ON CONFLICT(metric_code,scope_type,scope_id,snapshot_date) DO UPDATE SET value=EXCLUDED.value,captured_at=NOW()`,[uuid(),metricCode,value]);
  const organizationRows=type==='manager'?await many(`SELECT t.id AS team_id,t.name AS team_name,t.manager_id,m.name AS manager_name,b.id AS agent_id,b.name AS agent_name
    FROM teams t LEFT JOIN brokers m ON m.id=t.manager_id
    LEFT JOIN brokers b ON b.team_id=t.id AND b.status='active' AND b.role='internal_broker' AND b.job_role IN ('sales_agent','listing_agent')
    WHERE t.active=1 AND (t.manager_id=$1 OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$1 AND tm.membership_role='manager' AND tm.ends_at IS NULL)
      OR EXISTS(SELECT 1 FROM user_role_assignments ur WHERE ur.team_id=t.id AND ur.broker_id=$1 AND ur.job_role='manager' AND ur.status='active' AND ur.ends_at IS NULL))
      AND ($2::uuid IS NULL OR t.id=$2) AND ($3::uuid IS NULL OR b.id=$3)
    ORDER BY t.name,b.name`,[req.broker.id,f.selected.teamId,f.selected.agentId]):[];
  const hierarchy={company:'NYSA CORE',businessLines:[],teams:[]};for(const row of hierarchyRows){let business=hierarchy.businessLines.find(x=>x.code===row.businessType);if(!business){business={code:row.businessType,teams:[]};hierarchy.businessLines.push(business);}let team=business.teams.find(x=>x.id===row.teamId&&x.managerId===row.managerId);if(!team){team={id:row.teamId,name:row.teamName,managerId:row.managerId,manager:row.managerName,agents:[]};business.teams.push(team);}team.agents.push({id:row.agentId,name:row.agentName,value:row.value});}
  const activityByAgent=new Map();for(const row of hierarchyRows){if(row.agentId)activityByAgent.set(row.agentId,(activityByAgent.get(row.agentId)||0)+Number(row.value||0));}
  for(const row of organizationRows){let team=hierarchy.teams.find(x=>x.id===row.teamId);if(!team){team={id:row.teamId,name:row.teamName,managerId:row.managerId,manager:row.managerName||req.broker.name,agents:[]};hierarchy.teams.push(team);}if(row.agentId&&!team.agents.some(x=>x.id===row.agentId))team.agents.push({id:row.agentId,name:row.agentName,value:activityByAgent.get(row.agentId)||0});}
  const taskSummary=Object.fromEntries(tasks.map(item=>[item.label,item.value]));
  const recentActivities=await many(`SELECT a.id,a.activity_type,a.subject,a.outcome,a.created_at,l.id AS lead_id,l.title,c.full_name AS contact_name,b.name AS owner_name FROM activities a
    JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id JOIN brokers b ON b.id=a.owner_id WHERE ${f.where} ORDER BY a.created_at DESC LIMIT 12`,f.params);
  const approvalResult=await loadProposalApprovalQueue(req,f.selected);
  const organizationContext=await one(`SELECT t.id AS team_id,t.name AS team_name,m.id AS manager_id,m.name AS manager_name
    FROM brokers b LEFT JOIN teams t ON t.id=b.team_id LEFT JOIN brokers m ON m.id=t.manager_id WHERE b.id=$1`,[req.broker.id]);
  const canApproveProposals=isProposalApprover(req.broker),requestedView=!canApproveProposals&&req.query.view==='Proposal approvals'?null:req.query.view;
  const dataAsOf=new Date(),presentation=buildRoleDashboardPresentation({type,view:requestedView,current,previous,previousInventory,targets,trend,tasks:taskSummary,exceptions,previousExceptions,proposals,calls,inventory,agents,sources,priorSources,accountabilityRows,dataAsOf});
  res.json({dashboardType:type,view:presentation.view,canApproveProposals,dataAsOf,lastRefresh:dataAsOf,filters:f.selected,period:{current:{from:f.start,to:f.end},prior:{from:prior.start,to:prior.end}},
    calculationContext:'Role-scoped operational data; reassignment history is not rewritten. Counts use distinct accessible records.',...presentation,
    organizationContext,qualification:{hot:current.hot,warm:current.warm},stages,sources,campaigns,teams,agents,trend,tasks:taskSummary,exceptions,proposals,proposalApprovalQueue:approvalResult.rows,proposalApprovalQueueCount:approvalResult.count,proposalApprovalQueuePage:approvalResult.page,proposalApprovalQueuePageSize:approvalResult.pageSize,calls,inventory,recentActivities,hierarchy});
});

r.get('/crm/dashboard/proposal-approvals',async(req,res)=>{if(!isProposalApprover(req.broker))return res.status(403).json({error:'Proposal approval access requires Team Manager or Managing Director'});const selected={teamId:clean(req.query.teamId),managerId:clean(req.query.managerId),agentId:clean(req.query.agentId),businessType:clean(req.query.businessType)},result=await loadProposalApprovalQueue(req,selected,clean(req.query.q)||'',req.query.page,req.query.pageSize);res.json({proposalApprovalQueue:result.rows,count:result.count,page:result.page,pageSize:result.pageSize});});

r.get('/crm/reports/calls',async(req,res)=>{const f=filters(req,'l','a.created_at');if(f.error)return res.status(400).json({error:f.error});const rows=await many(`SELECT a.id,a.created_at,a.direction,a.outcome,a.duration_seconds,a.details,a.follow_up_required,a.due_at,a.completed_at,
  a.lead_stage_snapshot,a.qualification_snapshot,l.id AS lead_id,l.title,c.id AS contact_id,c.full_name AS contact_name,x.project AS listing_project,b.name AS agent_name
  FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id LEFT JOIN listings x ON x.id=l.listing_id JOIN brokers b ON b.id=a.owner_id
  WHERE a.activity_type='Call' AND ${f.where} ORDER BY a.created_at DESC`,f.params);res.json({dataAsOf:new Date(),filters:f.selected,count:rows.length,calls:rows});});

r.get('/crm/dashboard/records',async(req,res)=>{
  const f=filters(req);if(f.error)return res.status(400).json({error:f.error});const segment=req.query.segment||'new_leads';
  if(['inventory_available','inventory_stale','inventory_media_not_ready','inventory_readiness_exposure','inventory_aging_exposure','inventory_compliance_exposure'].includes(segment)){
    if(!isCompanyReader(req.broker))return res.status(403).json({error:'Company inventory drill-down requires Director or Administrator access'});
    const conditions={inventory_available:"status='Available'",inventory_stale:"updated_at<NOW()-INTERVAL '30 days' AND status<>'Closed'",inventory_media_not_ready:"NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved')",
      inventory_aging_exposure:"status<>'Closed' AND (updated_at<NOW()-INTERVAL '30 days' OR availability_confirmed_at IS NULL OR availability_confirmed_at<NOW()-INTERVAL '7 days')",
      inventory_compliance_exposure:"status<>'Closed' AND ((permit_expires_at IS NOT NULL AND permit_expires_at<NOW()+INTERVAL '30 days') OR verification_status NOT IN('verified','not_required') OR verification_expires_at<NOW()+INTERVAL '30 days' OR NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved'))",
      inventory_readiness_exposure:"status<>'Closed' AND (availability_confirmed_at IS NULL OR availability_confirmed_at<NOW()-INTERVAL '7 days' OR (permit_expires_at IS NOT NULL AND permit_expires_at<NOW()+INTERVAL '30 days') OR verification_status NOT IN('verified','not_required') OR verification_expires_at<NOW()+INTERVAL '30 days' OR portal_status NOT IN('ready','published') OR NOT EXISTS(SELECT 1 FROM property_media m WHERE m.listing_id=listings.id AND m.approval_status='approved'))"};
    const records=await many(`SELECT id,project AS title,area,status,property_type,updated_at,availability_confirmed_at,verification_status,verification_expires_at,permit_number,permit_expires_at,portal_status FROM listings WHERE deleted_at IS NULL AND ${conditions[segment]} ORDER BY updated_at LIMIT 500`);
    return res.json({entityType:'listing',segment,dataAsOf:new Date(),filters:f.selected,count:records.length,breadcrumbs:['NYSA CORE','Inventory'],records:records.map(row=>({...row,breadcrumbs:['NYSA CORE','Inventory',row.area,row.title].filter(Boolean)}))});
  }
  if(['proposal_workload','customer_engagement'].includes(segment)){
    const proposalF=filters(req,'l','p.updated_at'),callF=filters(req,'l','a.created_at');
    const common=`l.id AS lead_id,l.title,l.business_type,l.stage,l.temperature,c.full_name AS contact_name,t.name AS team_name,m.name AS manager_name,b.name AS agent_name`;
    const proposalStatus=segment==='proposal_workload'?"p.status IN('draft','generated','reviewed')":"p.status='sent'";
    const proposals=await many(`SELECT p.id,${common},p.updated_at AS created_at,'Proposal '||p.status AS engagement_type FROM proposals p JOIN leads l ON l.id=p.lead_id JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${proposalF.where} AND ${proposalStatus} ORDER BY p.updated_at DESC`,proposalF.params);
    const calls=segment==='customer_engagement'?await many(`SELECT a.id,${common},a.created_at,'Call' AS engagement_type FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE a.activity_type='Call' AND ${callF.where} ORDER BY a.created_at DESC`,callF.params):[];
    const records=[...proposals,...calls].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(row=>({...row,id:row.leadId,sourceType:row.engagementType,breadcrumbs:['NYSA CORE',row.businessType,row.teamName,row.managerName,row.agentName,row.title,row.engagementType].filter(Boolean)}));
    return res.json({entityType:'engagement',segment,dataAsOf:new Date(),filters:f.selected,count:records.length,breadcrumbs:['NYSA CORE',segment==='proposal_workload'?'Proposal workload':'Customer engagement'],records});
  }
  if(segment==='team_capacity_pressure'){
    const rows=await many(`WITH scoped AS (SELECT l.id,COUNT(*) FILTER(WHERE l.stage NOT IN('Won','Lost')) OVER(PARTITION BY l.assigned_to) AS agent_open FROM leads l WHERE ${f.where})
      SELECT l.id,l.title,l.source,l.business_type,l.stage,l.temperature,l.created_at,l.next_follow_up_at,c.full_name AS contact_name,t.id AS team_id,t.name AS team_name,m.id AS manager_id,m.name AS manager_name,b.id AS agent_id,b.name AS agent_name
      FROM scoped s JOIN leads l ON l.id=s.id JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to
      WHERE l.assigned_to IS NOT NULL AND s.agent_open>=10 ORDER BY l.created_at DESC LIMIT 500`,f.params);
    return res.json({entityType:'lead',segment,dataAsOf:new Date(),filters:f.selected,count:rows.length,breadcrumbs:['NYSA CORE','Capacity pressure'],records:rows.map(row=>({...row,breadcrumbs:['NYSA CORE',row.businessType,row.teamName,row.managerName,row.agentName,row.title].filter(Boolean)}))});
  }
  if(['operational_exceptions','exception_trend'].includes(segment)){
    const records=await many(`SELECT l.id,l.title,l.source,l.business_type,l.stage,l.temperature,l.created_at,l.next_follow_up_at,c.full_name AS contact_name,
      t.id AS team_id,t.name AS team_name,m.id AS manager_id,m.name AS manager_name,b.id AS agent_id,b.name AS agent_name,ex.exception_type
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to
      CROSS JOIN LATERAL UNNEST(ARRAY[
        CASE WHEN c.email IS NULL AND c.phone IS NULL THEN 'Missing contact channel' END,
        CASE WHEN NOT EXISTS(SELECT 1 FROM lead_requirements q WHERE q.lead_id=l.id AND q.superseded_at IS NULL) THEN 'Missing current requirement' END,
        CASE WHEN c.do_not_contact=1 THEN 'Restricted contact' END,
        CASE WHEN EXISTS(SELECT 1 FROM contact_channels cc JOIN contact_channels dc ON dc.channel_kind=cc.channel_kind AND dc.normalized_value=cc.normalized_value AND dc.contact_id<>cc.contact_id WHERE cc.contact_id=c.id AND cc.normalized_value IS NOT NULL) THEN 'Possible duplicate contact' END,
        CASE WHEN c.do_not_contact=0 AND NOT EXISTS(SELECT 1 FROM marketing_agreements ma WHERE ma.contact_id=c.id AND ma.status='executed' AND ma.effective_at<=NOW() AND (ma.expires_at IS NULL OR ma.expires_at>NOW())) THEN 'Missing effective consent' END,
        CASE WHEN NOT EXISTS(SELECT 1 FROM documents d WHERE d.lead_id=l.id AND d.status<>'retired') THEN 'Missing active document' END
      ]) ex(exception_type) WHERE ${f.where} AND ex.exception_type IS NOT NULL ORDER BY l.created_at DESC`,f.params);
    if(isManager(req.broker)||isCompanyReader(req.broker)){const events=await many("SELECT event_id,error_code,received_at FROM website_intake_events WHERE status='failed' AND received_at>=$1 AND received_at<$2 ORDER BY received_at",[f.start,new Date(f.end.getTime()+86400000)]);for(const event of events)records.push({id:null,title:event.eventId,contactName:'Website intake',businessType:'Operations',stage:'Failed',temperature:'—',teamName:'Digital intake',managerName:'Company support',agentName:null,createdAt:event.receivedAt,exceptionType:event.errorCode||'Integration failure'});}
    return res.json({entityType:'exception',segment,dataAsOf:new Date(),filters:f.selected,count:records.length,breadcrumbs:['NYSA CORE','Operations and Risk'],records:records.map(row=>({...row,breadcrumbs:['NYSA CORE',row.businessType,row.teamName,row.managerName,row.agentName,row.title].filter(Boolean)}))});
  }
  const clauses={sla_breaches:"((l.accepted_at IS NULL AND l.acceptance_due_at<NOW()) OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at<NOW()))",
    sla_risk:"l.stage NOT IN('Won','Lost') AND ((l.accepted_at IS NULL AND l.acceptance_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes') OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at BETWEEN NOW() AND NOW()+INTERVAL '60 minutes'))",
    no_next_action:"l.next_follow_up_at IS NULL AND l.stage NOT IN('Won','Lost')",won_leads:"l.stage='Won'",hot_leads:"l.temperature='Hot'",warm_leads:"l.temperature='Warm'",
    hot_warm_pipeline:"l.temperature IN('Hot','Warm') AND l.stage NOT IN('Won','Lost')",hot_warm_aging:"l.temperature IN('Hot','Warm') AND l.updated_at<NOW()-INTERVAL '7 days' AND l.stage NOT IN('Won','Lost')",
    stale_risk:"l.updated_at<NOW()-INTERVAL '7 days' AND l.stage NOT IN('Won','Lost')",unassigned_leads:"l.assigned_to IS NULL AND l.stage NOT IN('Won','Lost')",
    awaiting_acceptance:"l.accepted_at IS NULL AND l.stage NOT IN('Won','Lost')",overdue_tasks:"EXISTS(SELECT 1 FROM tasks dt WHERE dt.lead_id=l.id AND dt.status NOT IN('completed','cancelled') AND dt.due_at<NOW())",
    due_today:"EXISTS(SELECT 1 FROM tasks dt WHERE dt.lead_id=l.id AND dt.status NOT IN('completed','cancelled') AND dt.due_at>=CURRENT_DATE AND dt.due_at<CURRENT_DATE+INTERVAL '1 day')",
    proposal_workload:"EXISTS(SELECT 1 FROM proposals dp WHERE dp.lead_id=l.id AND dp.status IN('draft','generated','reviewed'))",
    };
  const extra=clauses[segment];
  const rows=await many(`SELECT l.id,l.title,l.source,l.business_type,l.stage,l.temperature,l.created_at,l.next_follow_up_at,c.full_name AS contact_name,
    t.id AS team_id,t.name AS team_name,m.id AS manager_id,m.name AS manager_name,b.id AS agent_id,b.name AS agent_name
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers b ON b.id=l.assigned_to
    WHERE ${f.where}${extra?' AND '+extra:''} ORDER BY l.created_at DESC LIMIT 500`,f.params);
  const sample=rows[0],breadcrumbs=['NYSA CORE',f.selected.businessType,f.selected.teamId?sample?.teamName:null,f.selected.managerId?sample?.managerName:null,f.selected.agentId?sample?.agentName:null].filter(Boolean);
  res.json({entityType:'lead',segment,dataAsOf:new Date(),filters:f.selected,count:rows.length,breadcrumbs,records:rows.map(row=>({...row,breadcrumbs:["NYSA CORE",row.businessType,row.teamName,row.managerName,row.agentName,row.title].filter(Boolean)}))});
});

const csvCell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
r.get('/crm/dashboard/export',async(req,res)=>{const f=filters(req);if(f.error)return res.status(400).json({error:f.error});const rows=await many(`SELECT l.id,l.title,c.full_name AS contact_name,l.source,l.business_type,l.stage,l.temperature,t.name AS team_name,b.name AS agent_name,l.created_at,l.next_follow_up_at FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN brokers b ON b.id=l.assigned_to WHERE ${f.where} ORDER BY l.created_at DESC`,f.params);const headers=['id','title','contactName','source','businessType','stage','temperature','teamName','agentName','createdAt','nextFollowUpAt'],csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(h=>csvCell(row[h])).join(','))].join('\r\n');await audit('DashboardExport',uuid(),'exported',req.broker.id,{filters:f.selected,rowCount:rows.length,dashboardType:dashboardTypeFor(req.broker)});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="nysa-dashboard-export.csv"');res.end(csv);});

r.get('/admin/dashboard-metrics',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});res.json({metrics:Object.entries(DASHBOARD_METRICS).map(([code,x])=>({code,...x}))});});
r.get('/admin/dashboard-targets',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});res.json({targets:await many('SELECT d.*,b.name AS approved_by_name FROM dashboard_targets d LEFT JOIN brokers b ON b.id=d.approved_by ORDER BY d.created_at DESC')});});
r.post('/admin/dashboard-targets',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const b=req.body||{},metric=DASHBOARD_METRICS[b.metricCode],threshold=b.exceptionThreshold===''||b.exceptionThreshold===null||b.exceptionThreshold===undefined?null:Number(b.exceptionThreshold);if(!metric||!['company','business_line','team','agent'].includes(b.scopeType)||!b.periodStart||!b.periodEnd||new Date(b.periodEnd)<new Date(b.periodStart)||!Number.isFinite(Number(b.targetValue))||(threshold!==null&&!Number.isFinite(threshold))||!['high_bad','low_bad'].includes(b.thresholdDirection||metric.direction))return res.status(400).json({error:'Complete valid target fields are required'});if(b.scopeType!=='company'&&!clean(b.scopeId))return res.status(400).json({error:'Select the applicable business line, team or agent'});const id=uuid(),row=await one(`INSERT INTO dashboard_targets(id,metric_code,scope_type,scope_id,period_start,period_end,target_value,unit,definition,exception_threshold,threshold_direction,benchmark_source,approval_basis,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14) RETURNING *`,[id,b.metricCode,b.scopeType,b.scopeType==='company'?null:clean(b.scopeId),b.periodStart,b.periodEnd,Number(b.targetValue),metric.unit,metric.definition,threshold,b.thresholdDirection||metric.direction,clean(b.benchmarkSource),clean(b.approvalBasis),req.broker.id]);await audit('DashboardTarget',id,'draft_created',req.broker.id);res.status(201).json(row);});
r.post('/admin/dashboard-targets/:id/approve',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const reason=clean(req.body?.reason);if(!reason)return res.status(400).json({error:'Approval reason is required'});const target=await one('SELECT * FROM dashboard_targets WHERE id=$1',[req.params.id]);if(!target||target.status!=='draft')return res.status(409).json({error:'Only a draft target can be approved'});const overlap=await one(`SELECT id FROM dashboard_targets WHERE id<>$1 AND metric_code=$2 AND scope_type=$3 AND COALESCE(scope_id,'')=COALESCE($4,'') AND status IN ('approved','active') AND daterange(period_start,period_end,'[]') && daterange($5::date,$6::date,'[]') LIMIT 1`,[target.id,target.metricCode,target.scopeType,target.scopeId,target.periodStart,target.periodEnd]);if(overlap)return res.status(409).json({error:'An approved or active target already overlaps this KPI, scope and period'});const row=await one("UPDATE dashboard_targets SET status='approved',approved_by=$1,approved_at=NOW(),approval_reason=$2,updated_at=NOW() WHERE id=$3 RETURNING *",[req.broker.id,reason,target.id]);await audit('DashboardTarget',row.id,'approved',req.broker.id,{reason});res.json(row);});
r.post('/admin/dashboard-targets/:id/activate',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const row=await transaction(async client=>{const target=await one('SELECT * FROM dashboard_targets WHERE id=$1 FOR UPDATE',[req.params.id],client);if(!target||target.status!=='approved')return null;await execute("UPDATE dashboard_targets SET status='retired',effective_to=NOW(),updated_at=NOW() WHERE status='active' AND metric_code=$1 AND scope_type=$2 AND COALESCE(scope_id,'')=COALESCE($3,'') AND daterange(period_start,period_end,'[]') && daterange($4::date,$5::date,'[]')",[target.metricCode,target.scopeType,target.scopeId,target.periodStart,target.periodEnd],client);const active=await one("UPDATE dashboard_targets SET status='active',effective_from=NOW(),effective_to=NULL,updated_at=NOW() WHERE id=$1 RETURNING *",[target.id],client);await audit('DashboardTarget',active.id,'activated',req.broker.id,null,client);return active;});if(!row)return res.status(409).json({error:'Only an approved target can be activated'});res.json(row);});
r.post('/admin/dashboard-targets/:id/retire',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const reason=clean(req.body?.reason);if(!reason)return res.status(400).json({error:'Retirement reason is required'});const row=await one("UPDATE dashboard_targets SET status='retired',effective_to=NOW(),updated_at=NOW() WHERE id=$1 AND status IN ('draft','approved','active') RETURNING *",[req.params.id]);if(!row)return res.status(409).json({error:'Target cannot be retired'});await audit('DashboardTarget',row.id,'retired',req.broker.id,{reason});res.json(row);});
r.get('/crm/dashboard/views',async(req,res)=>res.json({views:await many('SELECT * FROM saved_dashboard_views WHERE owner_id=$1 ORDER BY name',[req.broker.id])}));
r.post('/crm/dashboard/views',async(req,res)=>{if(!clean(req.body?.name))return res.status(400).json({error:'name is required'});const id=uuid(),row=await one(`INSERT INTO saved_dashboard_views(id,owner_id,name,dashboard_type,filters) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,name,dashboard_type) DO UPDATE SET filters=EXCLUDED.filters,updated_at=NOW() RETURNING *`,[id,req.broker.id,clean(req.body.name),dashboardTypeFor(req.broker),JSON.stringify(req.body.filters||{})]);await audit('SavedDashboardView',row.id,'saved',req.broker.id);res.status(201).json(row);});

export default r;
