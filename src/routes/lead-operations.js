import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { addBusinessMinutes, validateBudget } from '../crm-domain.js';
import { hasInternalCrmIdentity, isManager, isCrmReadOnly, canReadLead, canWriteLead, canAssignLead, leadScopeSql } from '../crm-policy.js';

const r = Router();
r.use(requireAuth, internalOnly);

function internalOnly(req,res,next){
  if(!hasInternalCrmIdentity(req.broker)) return res.status(403).json({error:'CRM customer data is restricted to NYSA staff'});
  next();
}
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const calendar=p=>({workDays:p.workDays,startMinute:p.workStartMinute,endMinute:p.workEndMinute,utcOffsetMinutes:p.utcOffsetMinutes});
async function activePolicy(client){return one("SELECT * FROM sla_policies WHERE status='active'",[],client);}
async function scopedLead(req,client){
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id],client);
  if(!lead) return {error:[404,'Lead not found']};
  if(!canReadLead(req.broker,lead)) return {error:[403,'Lead is outside your permitted scope']};
  return {lead};
}

r.get('/admin/sla-policies',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  res.json({policies:await many('SELECT * FROM sla_policies ORDER BY created_at DESC')});
});

r.post('/admin/sla-policies',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  const b=req.body||{},days=Array.isArray(b.workDays)?b.workDays.map(Number):[1,2,3,4,5];
  if(!text(b.name)||!days.length||days.some(x=>!Number.isInteger(x)||x<0||x>6)) return res.status(400).json({error:'name and valid workDays are required'});
  const start=Number(b.workStartMinute??540),end=Number(b.workEndMinute??1080),accept=Number(b.acceptanceMinutes??30),contact=Number(b.firstContactMinutes??240);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end||accept<1||contact<1) return res.status(400).json({error:'Invalid business hours or SLA minutes'});
  const id=uuid(),row=await one(`INSERT INTO sla_policies(id,name,timezone,utc_offset_minutes,work_days,work_start_minute,work_end_minute,
    acceptance_minutes,first_contact_minutes,warning_minutes,timer_policy,status,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *`,[id,text(b.name),text(b.timezone)||'Asia/Dubai',Number(b.utcOffsetMinutes??240),days,start,end,accept,contact,Number(b.warningMinutes??30),b.timerPolicy||'continue',req.broker.id]);
  await audit('SlaPolicy',id,'created',req.broker.id);res.status(201).json(row);
});

r.post('/admin/sla-policies/:id/activate',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  const row=await transaction(async client=>{
    const policy=await one('SELECT * FROM sla_policies WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!policy) return null;
    await execute("UPDATE sla_policies SET status='retired' WHERE status='active'",[],client);
    const active=await one("UPDATE sla_policies SET status='active',effective_from=NOW() WHERE id=$1 RETURNING *",[policy.id],client);
    await audit('SlaPolicy',policy.id,'activated',req.broker.id,null,client);return active;
  });
  if(!row)return res.status(404).json({error:'SLA policy not found'});res.json(row);
});

r.get('/admin/routing-rules',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  res.json({rules:await many(`SELECT r.*,t.name AS team_name,b.name AS agent_name FROM routing_rules r JOIN teams t ON t.id=r.team_id LEFT JOIN brokers b ON b.id=r.agent_id ORDER BY priority,name`)});
});

r.post('/admin/routing-rules',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  const b=req.body||{};
  if(!text(b.name)||!b.teamId)return res.status(400).json({error:'name and teamId are required'});
  if(!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[b.teamId])))return res.status(400).json({error:'Active team not found'});
  if(!['named_agent','team_queue'].includes(b.assignmentMethod||'team_queue'))return res.status(400).json({error:'Invalid assignmentMethod'});
  if(b.assignmentMethod==='named_agent'&&!b.agentId)return res.status(400).json({error:'agentId is required for named-agent routing'});
  const id=uuid(),row=await one(`INSERT INTO routing_rules(id,name,priority,source,business_type,team_id,agent_id,assignment_method,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,text(b.name),Number(b.priority??100),text(b.source),text(b.businessType),b.teamId,b.agentId||null,b.assignmentMethod||'team_queue',req.broker.id]);
  await audit('RoutingRule',id,'created',req.broker.id);res.status(201).json(row);
});

r.patch('/admin/routing-rules/:id',async(req,res)=>{
  if(req.broker.role!=='admin') return res.status(403).json({error:'Administrator access required'});
  const active=req.body?.active;
  if(typeof active!=='boolean')return res.status(400).json({error:'active boolean is required'});
  const row=await one('UPDATE routing_rules SET active=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[active?1:0,req.params.id]);
  if(!row)return res.status(404).json({error:'Routing rule not found'});await audit('RoutingRule',row.id,active?'activated':'retired',req.broker.id);res.json(row);
});

r.get('/crm/leads/:id/assignments',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  res.json({leadId:lead.id,assignments:await many(`SELECT a.*,t.name AS team_name,b.name AS agent_name,x.name AS assigned_by_name FROM lead_assignments a
    LEFT JOIN teams t ON t.id=a.team_id LEFT JOIN brokers b ON b.id=a.agent_id LEFT JOIN brokers x ON x.id=a.assigned_by WHERE a.lead_id=$1 ORDER BY sequence_no DESC`,[lead.id])});
});

r.post('/crm/imports/leads',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required for imports'});
  const b=req.body||{},externalId=text(b.externalId),externalSystem=text(b.externalSystem);
  if(!externalId||!externalSystem||!b.contactId||!text(b.title)||!text(b.businessType))return res.status(400).json({error:'externalSystem, externalId, contactId, title and businessType are required'});
  const stableId=`${externalSystem}:${externalId}`;
  const receivedAt=b.receivedAt?new Date(b.receivedAt):new Date();
  if(Number.isNaN(receivedAt.valueOf()))return res.status(400).json({error:'Invalid receivedAt'});
  const existing=await one("SELECT * FROM leads WHERE source='Current CRM' AND external_source_id=$1",[stableId]);
  if(existing)return res.json({...existing,idempotent:true});
  if(!(await one('SELECT id FROM contacts WHERE id=$1 AND lifecycle_status=\'active\'',[b.contactId])))return res.status(400).json({error:'Active contact not found'});
  const row=await transaction(async client=>{
    const rule=await one(`SELECT * FROM routing_rules WHERE active=1 AND (source IS NULL OR source='Current CRM') AND (business_type IS NULL OR business_type=$1) ORDER BY priority,id LIMIT 1`,[b.businessType],client);
    const due=await calculateDeadlines(receivedAt,client),id=uuid();
    const lead=await one(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,assigned_team_id,assigned_to,assignment_status,received_at,
      external_source_id,assignment_due_at,original_acceptance_due_at,first_contact_due_at,sla_policy_id,created_by)
      VALUES($1,$2,$3,'Current CRM',$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14) RETURNING *`,
      [id,b.contactId,text(b.title),b.businessType,b.temperature||'Warm',rule?.teamId||null,rule?.agentId||null,rule?.agentId?'assigned':'unassigned',receivedAt,stableId,due.acceptanceDueAt,due.firstContactDueAt,due.policy?.id||null,req.broker.id],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,$4,$5,$6,$7)`,
      [uuid(),id,rule?.teamId||null,rule?.agentId||null,rule?.agentId?'offered':'queued',due.acceptanceDueAt,req.broker.id],client);
    await execute(`INSERT INTO lead_stage_history(id,lead_id,to_stage,changed_by) VALUES($1,$2,'New',$3)`,[uuid(),id,req.broker.id],client);
    await audit('Lead',id,'imported',req.broker.id,{externalSystem,externalId,routingRuleId:rule?.id||null},client);return lead;
  });res.status(201).json(row);
});

async function respondToAssignment(req,res,status){
  if(status==='accepted'&&Number.isNaN(new Date(req.body?.nextActionDue).valueOf()))return res.status(400).json({error:'Valid nextActionDue is required when accepting a lead'});
  const result=await transaction(async client=>{
    const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!lead)return {code:404,error:'Lead not found'};
    if(lead.assignedTo!==req.broker.id)return {code:403,error:'Only the offered agent can respond'};
    const assignment=await one("SELECT * FROM lead_assignments WHERE lead_id=$1 AND superseded_at IS NULL AND status='offered' FOR UPDATE",[lead.id],client);
    if(!assignment)return {code:409,error:'No pending assignment offer'};
    if(new Date(assignment.acceptanceDueAt)<=new Date())return {code:409,error:'Assignment offer has expired'};
    const reason=text(req.body?.reason);
    if(status==='rejected'&&!reason)return {code:400,error:'Rejection reason is required'};
    if(status==='accepted'&&!req.body?.nextActionDue)return {code:400,error:'nextActionDue is required when accepting a lead'};
    await execute('UPDATE lead_assignments SET status=$1,responded_at=NOW(),response_reason=$2 WHERE id=$3',[status,reason,assignment.id],client);
    if(status==='accepted') {
      await execute("UPDATE leads SET assignment_status='assigned',accepted_at=NOW(),next_follow_up_at=$2,updated_at=NOW() WHERE id=$1",[lead.id,req.body.nextActionDue],client);
      await execute(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,priority,due_at,created_by)
        VALUES($1,$2,$3,$4,$5,'high',$6,$5)`,[uuid(),lead.id,lead.contactId,text(req.body.nextActionSubject)||'Contact newly accepted lead',req.broker.id,req.body.nextActionDue],client);
    }
    else await execute("UPDATE leads SET assignment_status='reassignment_due',assigned_to=NULL,updated_at=NOW() WHERE id=$1",[lead.id],client);
    await audit('LeadAssignment',assignment.id,status,req.broker.id,{reason},client);return {assignmentId:assignment.id,status};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
}
r.post('/crm/leads/:id/assignment/accept',(req,res)=>respondToAssignment(req,res,'accepted'));
r.post('/crm/leads/:id/assignment/reject',(req,res)=>respondToAssignment(req,res,'rejected'));

r.get('/crm/leads/:id/requirements',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  res.json({requirements:await many('SELECT * FROM lead_requirements WHERE lead_id=$1 ORDER BY version_no DESC',[lead.id])});
});

r.post('/crm/leads/:id/requirements',async(req,res)=>{
  const b=req.body||{};const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteLead(req.broker,lead)||isCrmReadOnly(req.broker))return res.status(403).json({error:'Lead is outside your writable scope'});
  if(!text(b.businessLine)||!['own_use','investment','business','other'].includes(b.purpose)||!['cash','mortgage','mixed','unknown'].includes(b.fundingMethod)||!text(b.timelineCode))
    return res.status(400).json({error:'businessLine, purpose, fundingMethod and timelineCode are required'});
  const budget=validateBudget(b.budgetMin,b.budgetMax);if(budget.error)return res.status(400).json({error:budget.error});
  for(const n of ['bedroomsMin','bedroomsMax'])if(b[n]!==undefined&&b[n]!==null&&(!Number.isInteger(Number(b[n]))||Number(b[n])<0))return res.status(400).json({error:`${n} must be a non-negative integer`});
  if(b.bedroomsMin!==undefined&&b.bedroomsMax!==undefined&&Number(b.bedroomsMax)<Number(b.bedroomsMin))return res.status(400).json({error:'bedroomsMax cannot be below bedroomsMin'});
  const row=await transaction(async client=>{
    const current=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);
    if(current)await execute('UPDATE lead_requirements SET superseded_at=NOW() WHERE id=$1',[current.id],client);
    const id=uuid(),version=(current?.versionNo||0)+1;
    const created=await one(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,
      bedrooms_min,bedrooms_max,timeline_code,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [id,lead.id,version,text(b.businessLine),b.purpose,Array.isArray(b.propertyTypes)?b.propertyTypes:[],Array.isArray(b.areas)?b.areas:[],budget.min,budget.max,b.fundingMethod,b.bedroomsMin??null,b.bedroomsMax??null,text(b.timelineCode),text(b.notes),req.broker.id],client);
    await audit('LeadRequirement',id,'version_created',req.broker.id,{leadId:lead.id,version},client);return created;
  });res.status(201).json(row);
});

r.post('/crm/leads/:id/requirements/:requirementId/matches',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your writable scope'});
  const requirement=await one('SELECT id FROM lead_requirements WHERE id=$1 AND lead_id=$2',[req.params.requirementId,lead.id]);
  if(!requirement)return res.status(404).json({error:'Requirement not found'});
  if(!(await one('SELECT id FROM listings WHERE id=$1',[req.body?.listingId])))return res.status(400).json({error:'Listing not found'});
  const id=uuid(),row=await one(`INSERT INTO lead_inventory_matches(id,lead_id,requirement_id,listing_id,match_note,created_by) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(lead_id,requirement_id,listing_id) DO UPDATE SET match_note=EXCLUDED.match_note RETURNING *`,[id,lead.id,requirement.id,req.body.listingId,text(req.body.matchNote),req.broker.id]);
  await audit('LeadRequirement',requirement.id,'inventory_linked',req.broker.id,{listingId:req.body.listingId});res.status(201).json(row);
});

r.post('/crm/leads/:id/convert',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your writable scope'});
  if(lead.stage!=='Qualified')return res.status(409).json({error:'Only a Qualified lead can be converted'});
  const requirement=await one('SELECT id FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);
  if(!requirement)return res.status(409).json({error:'A current structured requirement is required'});
  const id=uuid(),row=await one(`INSERT INTO lead_conversions(id,lead_id,contact_id,requirement_id,created_by) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(lead_id) DO UPDATE SET lead_id=EXCLUDED.lead_id RETURNING *`,[id,lead.id,lead.contactId,requirement.id,req.broker.id]);
  await audit('LeadConversion',row.id,'converted',req.broker.id,{leadId:lead.id});res.status(201).json(row);
});

r.get('/crm/tasks',async(req,res)=>{
  const params=[],scope=leadScopeSql('l',req.broker,params);let bucket='TRUE';
  if(req.query.bucket==='overdue')bucket="t.status IN ('open','in_progress') AND t.due_at<NOW()";
  if(req.query.bucket==='today')bucket="t.status IN ('open','in_progress') AND t.due_at>=CURRENT_DATE AND t.due_at<CURRENT_DATE+INTERVAL '1 day'";
  if(req.query.bucket==='upcoming')bucket="t.status IN ('open','in_progress') AND t.due_at>=CURRENT_DATE+INTERVAL '1 day'";
  if(req.query.bucket==='completed')bucket="t.status='completed'";
  res.json({tasks:await many(`SELECT t.*,l.title AS lead_title,c.full_name AS contact_name,b.name AS assignee_name FROM tasks t JOIN leads l ON l.id=t.lead_id
    JOIN contacts c ON c.id=t.contact_id JOIN brokers b ON b.id=t.assignee_id WHERE (${scope.clause}) AND (${bucket}) ORDER BY t.due_at`,params)});
});

r.post('/crm/leads/:id/tasks',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};if(!text(b.subject)||!b.dueAt)return res.status(400).json({error:'subject and dueAt are required'});
  if(Number.isNaN(new Date(b.dueAt).valueOf())||!['low','normal','high','urgent'].includes(b.priority||'normal'))return res.status(400).json({error:'Valid dueAt and priority are required'});
  const assignee=b.assigneeId||lead.assignedTo||req.broker.id;if(!(await one("SELECT id FROM brokers WHERE id=$1 AND status='active'",[assignee])))return res.status(400).json({error:'Active assignee not found'});
  const id=uuid(),row=await one(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id,lead.id,lead.contactId,text(b.subject),text(b.details),assignee,b.priority||'normal',b.dueAt,req.broker.id]);
  await execute('UPDATE leads SET next_follow_up_at=$1,updated_at=NOW() WHERE id=$2 AND (next_follow_up_at IS NULL OR next_follow_up_at>$1)',[b.dueAt,lead.id]);
  await audit('Task',id,'created',req.broker.id,{leadId:lead.id,assignee});res.status(201).json(row);
});

r.patch('/crm/tasks/:id',async(req,res)=>{
  const task=await one(`SELECT t.*,l.assigned_to,l.assigned_team_id,l.created_by AS lead_created_by FROM tasks t JOIN leads l ON l.id=t.lead_id WHERE t.id=$1`,[req.params.id]);
  if(!task)return res.status(404).json({error:'Task not found'});
  const lead={assignedTo:task.assignedTo,assignedTeamId:task.assignedTeamId,createdBy:task.leadCreatedBy};
  if(task.assigneeId!==req.broker.id&&!canAssignLead(req.broker,lead))return res.status(403).json({error:'Task is outside your permitted scope'});
  const b=req.body||{},status=b.status||task.status;if(!['open','in_progress','completed','cancelled'].includes(status))return res.status(400).json({error:'Invalid task status'});
  if(b.dueAt&&Number.isNaN(new Date(b.dueAt).valueOf()))return res.status(400).json({error:'Invalid dueAt'});
  if(status==='completed'&&!text(b.outcome)&&!task.outcome)return res.status(400).json({error:'Completion outcome is required'});
  const row=await one(`UPDATE tasks SET status=$1,outcome=COALESCE($2,outcome),due_at=COALESCE($3,due_at),priority=COALESCE($4,priority),
    completed_at=CASE WHEN $1='completed' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$5 RETURNING *`,[status,text(b.outcome),b.dueAt||null,b.priority||null,task.id]);
  await audit('Task',task.id,'status_changed',req.broker.id,{from:task.status,to:status,dueAt:b.dueAt||task.dueAt});res.json(row);
});

r.get('/crm/sla-queue',async(req,res)=>{
  const params=[],scope=leadScopeSql('l',req.broker,params);
  const rows=await many(`SELECT l.*,c.full_name AS contact_name,COALESCE(p.warning_minutes,30) AS warning_minutes,
    CASE WHEN l.accepted_at IS NULL THEN l.original_acceptance_due_at ELSE l.first_contact_due_at END AS active_deadline,
    CASE WHEN l.accepted_at IS NULL THEN 'acceptance' ELSE 'first_contact' END AS sla_kind
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN sla_policies p ON p.id=l.sla_policy_id WHERE (${scope.clause}) AND l.stage NOT IN ('Won','Lost')
    AND ((l.accepted_at IS NULL AND l.original_acceptance_due_at IS NOT NULL) OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at IS NOT NULL))
    ORDER BY active_deadline`,params);
  for(const lead of rows){
    const deadline=new Date(lead.activeDeadline),minutes=(deadline-Date.now())/60000;
    if(minutes<=Number(lead.warningMinutes)){
      const kind=`${lead.slaKind}_${minutes<=0?'breach':'warning'}`;
      await execute(`INSERT INTO sla_alerts(id,lead_id,alert_kind,deadline_at) VALUES($1,$2,$3,$4) ON CONFLICT(lead_id,alert_kind,deadline_at) DO NOTHING`,
        [uuid(),lead.id,kind,deadline]);
    }
  }
  res.json({leads:rows});
});

export async function calculateDeadlines(receivedAt,client){
  const policy=await activePolicy(client);if(!policy)return {policy:null,acceptanceDueAt:null,firstContactDueAt:null};
  return {policy,acceptanceDueAt:addBusinessMinutes(receivedAt,policy.acceptanceMinutes,calendar(policy)),firstContactDueAt:addBusinessMinutes(receivedAt,policy.firstContactMinutes,calendar(policy))};
}

export default r;
