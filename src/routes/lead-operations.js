import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { addBusinessMinutes, validateBudget, normalizeDelimitedValues } from '../crm-domain.js';
import { hasInternalCrmIdentity, isManager, isCrmReadOnly, canReadLead, canWriteLead, canAssignLead, leadScopeSql } from '../crm-policy.js';
import { resolvePrimaryRoutingArea,selectRoutingRule } from '../routing-service.js';
import { decodeAndValidateFile } from '../private-files.js';
import { parseAreaWorkbook,validateAreaImportRows } from '../area-import.js';

const r = Router();
r.use(requireAuth, internalOnly);

function internalOnly(req,res,next){
  if(!hasInternalCrmIdentity(req.broker)) return res.status(403).json({error:'CRM customer data is restricted to NYSA staff'});
  next();
}
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const REQUIREMENT_PROPERTY_TYPES=['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal'];
const operationalAdmin=req=>req.broker.role==='admin'||req.broker.jobRole==='admin_assistant';
const calendar=p=>({workDays:p.workDays,startMinute:p.workStartMinute,endMinute:p.workEndMinute,utcOffsetMinutes:p.utcOffsetMinutes});
async function activePolicy(client){return one("SELECT * FROM sla_policies WHERE status='active'",[],client);}
async function scopedLead(req,client){
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id],client);
  if(!lead) return {error:[404,'Lead not found']};
  if(!canReadLead(req.broker,lead)) return {error:[403,'Lead is outside your permitted scope']};
  return {lead};
}

r.get('/admin/sla-policies',async(req,res)=>{
  if(!operationalAdmin(req)) return res.status(403).json({error:'Administrator or Admin Assistant access required'});
  res.json({policies:await many('SELECT * FROM sla_policies ORDER BY created_at DESC')});
});

r.post('/admin/sla-policies',async(req,res)=>{
  if(!operationalAdmin(req)) return res.status(403).json({error:'Administrator or Admin Assistant access required'});
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
  if(!operationalAdmin(req)) return res.status(403).json({error:'Administrator or Admin Assistant access required'});
  res.json({rules:await many(`SELECT r.*,t.name AS team_name,a.business_label AS area_label FROM routing_rules r LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN areas a ON a.id=r.area_id ORDER BY priority,name`)});
});

r.get('/admin/areas',async(req,res)=>{if(!operationalAdmin(req))return res.status(403).json({error:'Administrator or Admin Assistant access required'});res.json({areas:await many('SELECT * FROM areas ORDER BY active DESC,display_order,business_label')});});
r.get('/crm/areas',async(req,res)=>res.json({areas:await many('SELECT id,stable_code,business_label,emirate,display_order FROM areas WHERE active=1 ORDER BY display_order,business_label')}));
r.post('/admin/areas',async(req,res)=>{if(!operationalAdmin(req))return res.status(403).json({error:'Administrator or Admin Assistant access required'});const b=req.body||{},code=text(b.stableCode),label=text(b.businessLabel),emirate=text(b.emirate),order=Number(b.displayOrder??100);if(!code||!/^[a-z][a-z0-9_]*$/.test(code)||!label||!emirate||!Number.isInteger(order)||order<0)return res.status(400).json({error:'Stable code (lowercase snake_case), business label, emirate and a valid display order are required'});try{const id=uuid(),row=await one('INSERT INTO areas(id,stable_code,business_label,emirate,display_order,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,code,label,emirate,order,req.broker.id]);await audit('Area',id,'created',req.broker.id,{stableCode:code,businessLabel:label,emirate});res.status(201).json(row);}catch(error){if(error.code==='23505')return res.status(409).json({error:'This active area code or business label already exists'});throw error;}});
r.post('/admin/areas/import/preview',async(req,res)=>{if(!operationalAdmin(req))return res.status(403).json({error:'Administrator or Admin Assistant access required'});const file=decodeAndValidateFile({base64:req.body?.base64,mediaType:req.body?.mediaType,fileName:req.body?.fileName,maxBytes:2097152,allowedTypes:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']});if(file.error)return res.status(400).json({error:file.error});try{const sourceRows=await parseAreaWorkbook(file.buffer),existingAreas=await many('SELECT stable_code,business_label,emirate,active FROM areas'),rows=validateAreaImportRows(sourceRows,{existingAreas}),readyCount=rows.filter(row=>!row.errors.length&&!row.skipped).length,skippedCount=rows.filter(row=>row.skipped).length;res.json({fileName:file.fileName,fileHash:file.fileHash,rowCount:rows.length,readyCount,skippedCount,valid:rows.every(row=>!row.errors.length),rows});}catch(error){res.status(400).json({error:`Workbook could not be reviewed: ${error.message}`});}});
r.post('/admin/areas/import/commit',async(req,res)=>{if(!operationalAdmin(req))return res.status(403).json({error:'Administrator or Admin Assistant access required'});const reason=text(req.body?.reason),sourceRows=Array.isArray(req.body?.rows)?req.body.rows:[];if(!reason)return res.status(400).json({error:'An import reason is required'});if(!sourceRows.length||sourceRows.length>500)return res.status(400).json({error:'Provide between 1 and 500 reviewed area rows'});try{const result=await transaction(async client=>{const existingAreas=await many('SELECT stable_code,business_label,emirate,active FROM areas FOR SHARE',[],client),rows=validateAreaImportRows(sourceRows,{existingAreas}),invalid=rows.filter(row=>row.errors.length);if(invalid.length){const error=new Error('The reviewed import is no longer valid; preview it again');error.statusCode=409;error.rows=rows;throw error;}const ready=rows.filter(row=>!row.skipped),created=[];for(const row of ready){const id=uuid(),area=await one('INSERT INTO areas(id,stable_code,business_label,emirate,display_order,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,row.stableCode,row.businessLabel,row.emirate,row.displayOrder,req.broker.id],client);await audit('Area',id,'bulk_imported',req.broker.id,{reason,rowNumber:row.rowNumber},client);created.push(area);}return {created,skippedCount:rows.length-ready.length};});res.status(201).json({importedCount:result.created.length,skippedCount:result.skippedCount,areas:result.created});}catch(error){if(error.statusCode)return res.status(error.statusCode).json({error:error.message,rows:error.rows});if(error.code==='23505')return res.status(409).json({error:'An area changed after preview. Review the workbook again before importing.'});throw error;}});
r.patch('/admin/areas/:id',async(req,res)=>{if(!operationalAdmin(req))return res.status(403).json({error:'Administrator or Admin Assistant access required'});const existing=await one('SELECT * FROM areas WHERE id=$1',[req.params.id]);if(!existing)return res.status(404).json({error:'Area not found'});const b=req.body||{},reason=text(b.reason);if(typeof b.active==='boolean'){if(!reason)return res.status(400).json({error:'Reason is required to retire or reactivate an area'});if(!b.active&&await one('SELECT id FROM routing_rules WHERE area_id=$1 AND active=1 LIMIT 1',[existing.id]))return res.status(409).json({error:'Retire or change active routing rules that use this area first'});const row=await one(`UPDATE areas SET active=$1,retired_by=$2,retirement_reason=$3,retired_at=CASE WHEN $1=0 THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$4 RETURNING *`,[b.active?1:0,b.active?null:req.broker.id,b.active?null:reason,existing.id]);await audit('Area',row.id,b.active?'reactivated':'retired',req.broker.id,{reason});return res.json(row);}if(!reason)return res.status(400).json({error:'Reason is required to edit an area'});const label=text(b.businessLabel),emirate=text(b.emirate),order=Number(b.displayOrder);if(!label||!emirate||!Number.isInteger(order)||order<0)return res.status(400).json({error:'Business label, emirate and display order are required'});const row=await one('UPDATE areas SET business_label=$1,emirate=$2,display_order=$3,updated_at=NOW() WHERE id=$4 RETURNING *',[label,emirate,order,existing.id]);await audit('Area',row.id,'edited',req.broker.id,{reason,before:{businessLabel:existing.businessLabel,emirate:existing.emirate,displayOrder:existing.displayOrder}});res.json(row);});

async function validateRoutingRuleInput(body,excludeId=null){
  const b=body||{},name=text(b.name),source=text(b.source),businessType=text(b.businessType),teamId=b.teamId||null,areaId=b.areaId||null,priority=Number(b.priority);
  if(!name)return {error:'Rule name is required'};
  if(!Number.isInteger(priority)||priority<0)return {error:'Priority must be a whole number of zero or more'};
  if(source&&!['Website','WhatsApp','Current CRM','Referral','Social media','Walk-in','Phone','Property portal','Other'].includes(source))return {error:'Select a valid source'};
  if(businessType&&!['Sale','Rental','Off-plan','Commercial'].includes(businessType))return {error:'Select a valid business type'};
  if(teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId])))return {error:'Active destination team not found'};
  if(areaId&&!(await one('SELECT id FROM areas WHERE id=$1 AND active=1',[areaId])))return {error:'Select an active maintained area or All areas'};
  if(!source&&!businessType&&!areaId&&teamId)return {error:'Any source / Any business / All areas is reserved for the Company Unassigned Queue'};
  const params=[source,businessType,areaId];let exclusion='';if(excludeId){params.push(excludeId);exclusion=`AND id<>$${params.length}`;}
  const duplicate=await one(`SELECT id,name FROM routing_rules WHERE active=1 AND COALESCE(source,'')=COALESCE($1::text,'') AND COALESCE(business_type,'')=COALESCE($2::text,'') AND COALESCE(area_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE($3::uuid,'00000000-0000-0000-0000-000000000000'::uuid) ${exclusion} LIMIT 1`,params);
  if(duplicate)return {error:`An active rule already covers this source, business and area combination: ${duplicate.name}`};
  return {value:{name,priority,source,businessType,teamId,areaId}};
}

r.post('/admin/routing-rules',async(req,res)=>{
  if(!operationalAdmin(req)) return res.status(403).json({error:'Administrator or Admin Assistant access required'});
  const b=req.body||{},checked=await validateRoutingRuleInput(b);if(checked.error)return res.status(400).json({error:checked.error});
  if(b.agentId||b.assignmentMethod&&b.assignmentMethod!=='team_queue')return res.status(400).json({error:'Routing rules may select only a team queue; broker assignment occurs afterward'});
  const v=checked.value;
  const id=uuid(),row=await one(`INSERT INTO routing_rules(id,name,priority,source,business_type,team_id,area_id,agent_id,assignment_method,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,NULL,'team_queue',$8) RETURNING *`,[id,v.name,v.priority,v.source,v.businessType,v.teamId,v.areaId,req.broker.id]);
  await audit('RoutingRule',id,'created',req.broker.id);res.status(201).json(row);
});

r.patch('/admin/routing-rules/:id',async(req,res)=>{
  if(!operationalAdmin(req)) return res.status(403).json({error:'Administrator or Admin Assistant access required'});
  const b=req.body||{},existing=await one('SELECT * FROM routing_rules WHERE id=$1',[req.params.id]);if(!existing)return res.status(404).json({error:'Routing rule not found'});
  if(typeof b.active==='boolean'){
    const reason=text(b.reason);if(!reason)return res.status(400).json({error:`Reason is required to ${b.active?'reactivate':'retire'} a routing rule`});
    if(b.active){const checked=await validateRoutingRuleInput({name:existing.name,priority:existing.priority,source:existing.source,businessType:existing.businessType,teamId:existing.teamId,areaId:existing.areaId},existing.id);if(checked.error)return res.status(409).json({error:checked.error});}
    const row=await one('UPDATE routing_rules SET active=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[b.active?1:0,existing.id]);await audit('RoutingRule',row.id,b.active?'reactivated':'retired',req.broker.id,{reason});return res.json(row);
  }
  const reason=text(b.reason);if(!reason)return res.status(400).json({error:'Reason is required to edit a routing rule'});
  const checked=await validateRoutingRuleInput(b,existing.id);if(checked.error)return res.status(400).json({error:checked.error});const v=checked.value;
  const row=await one(`UPDATE routing_rules SET name=$1,priority=$2,source=$3,business_type=$4,team_id=$5,area_id=$6,agent_id=NULL,assignment_method='team_queue',updated_at=NOW() WHERE id=$7 RETURNING *`,[v.name,v.priority,v.source,v.businessType,v.teamId,v.areaId,existing.id]);
  await audit('RoutingRule',row.id,'edited',req.broker.id,{reason,before:{name:existing.name,priority:existing.priority,source:existing.source,businessType:existing.businessType,areaId:existing.areaId,teamId:existing.teamId},after:v});res.json(row);
});

r.post('/admin/routing-rules/dubai-defaults',async(req,res)=>{if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});const expected=[['Dubai Rental Team','Rental',10],['Dubai Off-plan Team','Off-plan',20],['Dubai Secondary Sales Team','Sale',30]],teams=await many('SELECT id,name FROM teams WHERE active=1 AND name=ANY($1::text[])',[expected.map(x=>x[0])]);const missing=expected.filter(x=>!teams.some(t=>t.name===x[0])).map(x=>x[0]);if(missing.length)return res.status(409).json({error:`Create these active teams first: ${missing.join(', ')}`});await transaction(async client=>{for(const [name,type,priority] of expected){const team=teams.find(t=>t.name===name);await execute(`INSERT INTO routing_rules(id,name,priority,business_type,team_id,assignment_method,created_by) SELECT $1,$2,$3,$4,$5,'team_queue',$6 WHERE NOT EXISTS(SELECT 1 FROM routing_rules WHERE active=1 AND business_type=$4 AND team_id=$5 AND area_id IS NULL)`,[uuid(),`${name} default`,priority,type,team.id,req.broker.id],client);}await execute(`INSERT INTO routing_rules(id,name,priority,team_id,assignment_method,created_by) SELECT $1,'Company Unassigned fallback',9999,NULL,'team_queue',$2 WHERE NOT EXISTS(SELECT 1 FROM routing_rules WHERE active=1 AND source IS NULL AND business_type IS NULL AND area_id IS NULL AND team_id IS NULL)`,[uuid(),req.broker.id],client);await audit('RoutingRule',uuid(),'dubai_defaults_configured',req.broker.id,{teams:expected.map(x=>x[0])},client);});res.json({ok:true});});

async function recycleBreachedAssignments(actorId){return transaction(async client=>{const breached=await many(`SELECT * FROM leads WHERE stage NOT IN ('Won','Lost') AND assigned_to IS NOT NULL AND ((accepted_at IS NULL AND acceptance_due_at<=NOW()) OR (accepted_at IS NOT NULL AND first_contact_at IS NULL AND first_contact_due_at<=NOW())) FOR UPDATE`,[],client);for(const lead of breached){const assignment=await one('SELECT * FROM lead_assignments WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);if(assignment)await execute("UPDATE lead_assignments SET status='timed_out',superseded_at=NOW(),responded_at=NOW(),response_reason='SLA breach returned lead to routed team queue' WHERE id=$1",[assignment.id],client);const sequence=Number((await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client)).n);await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,$3,$4,'queued',$5,$6)`,[uuid(),lead.id,sequence,lead.assignedTeamId,lead.acceptanceDueAt,actorId],client);await execute("UPDATE leads SET assigned_to=NULL,assignment_status='reassignment_due',accepted_at=NULL,queue_cycle_no=queue_cycle_no+1,last_queue_entered_at=NOW(),updated_at=NOW() WHERE id=$1",[lead.id],client);await audit('LeadAssignment',assignment?.id||lead.id,'sla_recycled',actorId,{leadId:lead.id,teamId:lead.assignedTeamId,cycle:Number(lead.queueCycleNo||1)+1},client);}return breached.length;});}

r.get('/crm/assignment-queue',async(req,res)=>{await recycleBreachedAssignments(req.broker.id);const params=[],conditions=["l.stage NOT IN ('Won','Lost')","l.assigned_to IS NULL","l.assignment_status IN ('unassigned','reassignment_due')"];if(req.broker.role!=='admin'&&req.broker.jobRole!=='director'){const teams=req.broker.jobRole==='manager'?(req.broker.managedTeamIds||[]):[req.broker.teamId].filter(Boolean);if(!teams.length)return res.json({leads:[]});params.push(teams);conditions.push(`l.assigned_team_id=ANY($${params.length}::uuid[])`);}const leads=await many(`SELECT l.*,c.full_name AS contact_name,t.name AS team_name,EXTRACT(EPOCH FROM (NOW()-COALESCE(l.last_queue_entered_at,l.received_at)))::int AS queue_wait_seconds,CASE WHEN l.accepted_at IS NULL THEN l.acceptance_due_at ELSE l.first_contact_due_at END AS sla_deadline FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN teams t ON t.id=l.assigned_team_id WHERE ${conditions.join(' AND ')} ORDER BY COALESCE(l.last_queue_entered_at,l.received_at)`,params);res.json({leads});});

async function assignQueuedLead(req,res,selfClaim=false){
  const result=await transaction(async client=>{
    const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!lead)return {code:404,error:'Lead not found'};
    if(lead.assignedTo||!['unassigned','reassignment_due'].includes(lead.assignmentStatus))return {code:409,error:'Lead is no longer available in the assignment queue'};
    if(selfClaim&&lead.assignmentStatus!=='reassignment_due')return {code:403,error:'New leads must be assigned by a team lead or Director; self-claim is available only after SLA recycling'};
    const agentId=selfClaim?req.broker.id:req.body?.agentId,teamId=req.body?.teamId||lead.assignedTeamId;
    if(!agentId||!teamId)return {code:400,error:'An eligible team and agent are required'};
    const eligible=await one("SELECT b.id FROM brokers b WHERE b.id=$1 AND b.status='active' AND b.role='internal_broker' AND EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.broker_id=b.id AND tm.team_id=$2 AND tm.ends_at IS NULL)",[agentId,teamId],client);
    if(!eligible)return {code:400,error:'Agent is not an eligible active member of the selected team'};
    const managed=req.broker.managedTeamIds||[];
    if(selfClaim&&req.broker.teamId!==teamId)return {code:403,error:'Agents can claim only from their own team queue'};
    if(!selfClaim&&req.broker.jobRole!=='director'&&!(req.broker.jobRole==='manager'&&managed.includes(teamId)))return {code:403,error:'Only the responsible team lead or Director can assign this lead'};
    const policy=await activePolicy(client),now=new Date(),due=policy?addBusinessMinutes(now,policy.acceptanceMinutes,calendar(policy)):new Date(now.getTime()+30*60000),firstDue=policy?addBusinessMinutes(now,policy.firstContactMinutes,calendar(policy)):new Date(now.getTime()+120*60000);
    const current=await one('SELECT * FROM lead_assignments WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);
    if(current)await execute("UPDATE lead_assignments SET status='reassigned',superseded_at=NOW() WHERE id=$1",[current.id],client);
    const sequence=Number((await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client)).n),assignmentId=uuid();
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,$3,$4,$5,'offered',$6,$7)`,[assignmentId,lead.id,sequence,teamId,agentId,due,req.broker.id],client);
    await execute("UPDATE leads SET assigned_team_id=$1,assigned_to=$2,assignment_status='assigned',acceptance_due_at=$3,assignment_due_at=$3,first_contact_due_at=$4,accepted_at=NULL,first_contact_at=NULL,updated_at=NOW() WHERE id=$5",[teamId,agentId,due,firstDue,lead.id],client);
    await audit('LeadAssignment',assignmentId,selfClaim?'self_claimed':'assigned_from_queue',req.broker.id,{leadId:lead.id,teamId,agentId,cycle:lead.queueCycleNo,acceptanceDueAt:due,firstContactDueAt:firstDue},client);
    return {assignmentId,leadId:lead.id,agentId,teamId,acceptanceDueAt:due,firstContactDueAt:firstDue};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
}
r.post('/crm/assignment-queue/:id/claim',(req,res)=>assignQueuedLead(req,res,true));
r.post('/crm/assignment-queue/:id/assign',(req,res)=>assignQueuedLead(req,res,false));

r.get('/crm/leads/:id/assignments',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  res.json({leadId:lead.id,assignments:await many(`SELECT a.*,t.name AS team_name,b.name AS agent_name,x.name AS assigned_by_name FROM lead_assignments a
    LEFT JOIN teams t ON t.id=a.team_id LEFT JOIN brokers b ON b.id=a.agent_id LEFT JOIN brokers x ON x.id=a.assigned_by WHERE a.lead_id=$1 ORDER BY sequence_no DESC`,[lead.id])});
});

r.post('/crm/imports/leads',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required for imports'});
  const b=req.body||{},externalId=text(b.externalId),externalSystem=text(b.externalSystem);
  if(!externalId||!externalSystem||!b.contactId||!text(b.title)||!text(b.businessType))return res.status(400).json({error:'externalSystem, externalId, contactId, title and businessType are required'});
  if(b.temperature&&b.temperature!=='Unassessed')return res.status(400).json({error:'Imported leads begin Unassessed; use the approved qualification questions to calculate a result'});
  const stableId=`${externalSystem}:${externalId}`;
  const receivedAt=b.receivedAt?new Date(b.receivedAt):new Date();
  if(Number.isNaN(receivedAt.valueOf()))return res.status(400).json({error:'Invalid receivedAt'});
  const existing=await one("SELECT * FROM leads WHERE source='Current CRM' AND external_source_id=$1",[stableId]);
  if(existing)return res.json({...existing,idempotent:true});
  if(!(await one('SELECT id FROM contacts WHERE id=$1 AND lifecycle_status=\'active\'',[b.contactId])))return res.status(400).json({error:'Active contact not found'});
  const row=await transaction(async client=>{
    const primary=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.preferredAreas,client);if(primary.error)return{code:400,error:primary.error};const rule=await selectRoutingRule({source:'Current CRM',businessType:b.businessType,primaryAreaId:primary.areaId},client);
    const due=await calculateDeadlines(receivedAt,client),id=uuid();
    const lead=await one(`INSERT INTO leads(id,contact_id,title,source,business_type,temperature,preferred_areas,primary_routing_area_id,assigned_team_id,assigned_to,assignment_status,received_at,
      external_source_id,assignment_due_at,original_acceptance_due_at,acceptance_due_at,first_contact_due_at,sla_policy_id,created_by)
      VALUES($1,$2,$3,'Current CRM',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$13,$14,$15,$16) RETURNING *`,
      [id,b.contactId,text(b.title),b.businessType,'Unassessed',normalizeDelimitedValues(b.preferredAreas).join(', ')||null,primary.areaId,rule?.teamId||null,null,'unassigned',receivedAt,stableId,due.acceptanceDueAt,due.firstContactDueAt,due.policy?.id||null,req.broker.id],client);
    await execute('UPDATE leads SET routing_reason=$1,last_queue_entered_at=CASE WHEN assigned_to IS NULL THEN received_at ELSE NULL END WHERE id=$2',[rule?`Matched routing rule: ${rule.name}`:'Company unassigned fallback',lead.id],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,$4,$5,$6,$7)`,
      [uuid(),id,rule?.teamId||null,null,'queued',due.acceptanceDueAt,req.broker.id],client);
    await execute(`INSERT INTO lead_stage_history(id,lead_id,to_stage,changed_by) VALUES($1,$2,'New',$3)`,[uuid(),id,req.broker.id],client);
    await audit('Lead',id,'imported',req.broker.id,{externalSystem,externalId,routingRuleId:rule?.id||null,primaryRoutingAreaId:primary.areaId},client);return lead;
  });if(row?.error)return res.status(row.code||400).json({error:row.error});res.status(201).json(row);
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
  const propertyTypes=normalizeDelimitedValues(b.propertyTypes);if(propertyTypes.some(x=>!REQUIREMENT_PROPERTY_TYPES.includes(x)))return res.status(400).json({error:'Select property types from the approved list'});
  const bedroomValue=n=>b[n]===undefined||b[n]===null||String(b[n]).trim()===''?null:Number(b[n]),bedroomsMin=bedroomValue('bedroomsMin'),bedroomsMax=bedroomValue('bedroomsMax');
  for(const [name,value] of [['bedroomsMin',bedroomsMin],['bedroomsMax',bedroomsMax]])if(value!==null&&(!Number.isInteger(value)||value<0))return res.status(400).json({error:`${name} must be a non-negative integer`});
  if(bedroomsMin!==null&&bedroomsMax!==null&&bedroomsMax<bedroomsMin)return res.status(400).json({error:'bedroomsMax cannot be below bedroomsMin'});
  const row=await transaction(async client=>{
    const current=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR UPDATE',[lead.id],client);
    if(current)await execute('UPDATE lead_requirements SET superseded_at=NOW() WHERE id=$1',[current.id],client);
    const id=uuid(),version=(current?.versionNo||0)+1;
    const created=await one(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,
      bedrooms_min,bedrooms_max,timeline_code,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [id,lead.id,version,text(b.businessLine),b.purpose,propertyTypes,normalizeDelimitedValues(b.areas),budget.min,budget.max,b.fundingMethod,bedroomsMin,bedroomsMax,text(b.timelineCode),text(b.notes),req.broker.id],client);
    await audit('LeadRequirement',id,'version_created',req.broker.id,{leadId:lead.id,version},client);return created;
  });res.status(201).json(row);
});

r.post('/crm/leads/:id/holding-status',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});if(!canWriteLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your writable scope'});
  const status=req.body?.holdingStatus;if(!['active','nurture','paused','closed'].includes(status))return res.status(400).json({error:'Invalid holdingStatus'});
  const row=await transaction(async client=>{const current=await one('SELECT l.*,p.timer_policy FROM leads l LEFT JOIN sla_policies p ON p.id=l.sla_policy_id WHERE l.id=$1 FOR UPDATE',[lead.id],client),pausePolicy=current.timerPolicy==='pause_in_nurture';
    let updated;if(pausePolicy&&['nurture','paused'].includes(status)&&!current.slaPausedAt){updated=await one('UPDATE leads SET holding_status=$1,sla_paused_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING *',[status,lead.id],client);}
    else if(pausePolicy&&status==='active'&&current.slaPausedAt){updated=await one(`UPDATE leads SET holding_status='active',sla_paused_seconds=sla_paused_seconds+EXTRACT(EPOCH FROM (NOW()-sla_paused_at))::int,
      acceptance_due_at=acceptance_due_at+(NOW()-sla_paused_at),assignment_due_at=assignment_due_at+(NOW()-sla_paused_at),first_contact_due_at=first_contact_due_at+(NOW()-sla_paused_at),sla_paused_at=NULL,updated_at=NOW() WHERE id=$1 RETURNING *`,[lead.id],client);}
    else updated=await one('UPDATE leads SET holding_status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[status,lead.id],client);
    await audit('Lead',lead.id,'holding_status_changed',req.broker.id,{from:current.holdingStatus,to:status,timerPolicy:current.timerPolicy||'continue'},client);return updated;});res.json(row);
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
  if(req.query.bucket==='open')bucket="t.status IN ('open','in_progress')";
  if(req.query.bucket==='overdue')bucket="t.status IN ('open','in_progress') AND t.due_at<NOW()";
  if(req.query.bucket==='today')bucket="t.status IN ('open','in_progress') AND t.due_at>=CURRENT_DATE AND t.due_at<CURRENT_DATE+INTERVAL '1 day'";
  if(req.query.bucket==='upcoming')bucket="t.status IN ('open','in_progress') AND t.due_at>=CURRENT_DATE+INTERVAL '1 day'";
  if(req.query.bucket==='completed')bucket="t.status='completed'";
  if(req.query.mine==='1'){params.push(req.broker.id);bucket=`(${bucket}) AND t.assignee_id=$${params.length}`;}
  res.json({tasks:await many(`SELECT t.*,l.title AS lead_title,c.full_name AS contact_name,b.name AS assignee_name,
    p.proposal_number,p.title AS proposal_title,pv.version_number AS returned_version_number,
    pv.review_comment AS return_reason,pv.reviewed_at AS returned_at,pv.document_version_id,
    reviewer.name AS returned_by_name
    FROM tasks t JOIN leads l ON l.id=t.lead_id
    JOIN contacts c ON c.id=t.contact_id JOIN brokers b ON b.id=t.assignee_id
    LEFT JOIN proposals p ON p.id=t.proposal_id
    LEFT JOIN proposal_versions pv ON pv.id=t.proposal_version_id
    LEFT JOIN brokers reviewer ON reviewer.id=pv.reviewed_by
    WHERE (${scope.clause}) AND (${bucket}) ORDER BY t.due_at`,params)});
});

r.post('/crm/leads/:id/tasks',async(req,res)=>{
  const {lead,error}=await scopedLead(req);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};if(!text(b.subject)||!b.dueAt)return res.status(400).json({error:'subject and dueAt are required'});
  if(Number.isNaN(new Date(b.dueAt).valueOf())||!['low','normal','high','urgent'].includes(b.priority||'normal'))return res.status(400).json({error:'Valid dueAt and priority are required'});
  if(b.assigneeId&&!canAssignLead(req.broker,lead))return res.status(403).json({error:'Only a team lead or administrator can select another task owner'});const assignee=b.assigneeId||lead.assignedTo||req.broker.id;if(!(await one("SELECT id FROM brokers WHERE id=$1 AND status='active'",[assignee])))return res.status(400).json({error:'Active assignee not found'});
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
  if(task.taskType==='proposal_correction'&&!['open','in_progress'].includes(status))return res.status(409).json({error:'A proposal correction completes automatically when the corrected immutable version is generated'});
  if(b.dueAt&&Number.isNaN(new Date(b.dueAt).valueOf()))return res.status(400).json({error:'Invalid dueAt'});
  if(status==='completed'&&!text(b.outcome)&&!task.outcome)return res.status(400).json({error:'Completion outcome is required'});
  if(status==='cancelled'&&!text(b.outcome)&&!task.outcome)return res.status(400).json({error:'Cancellation reason is required'});
  const row=await one(`UPDATE tasks SET status=$1,outcome=COALESCE($2,outcome),due_at=COALESCE($3,due_at),priority=COALESCE($4,priority),
    completed_at=CASE WHEN $1='completed' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$5 RETURNING *`,[status,text(b.outcome),b.dueAt||null,b.priority||null,task.id]);
  await audit('Task',task.id,'status_changed',req.broker.id,{from:task.status,to:status,dueAt:b.dueAt||task.dueAt});res.json(row);
});

r.get('/crm/sla-queue',async(req,res)=>{
  const params=[],scope=leadScopeSql('l',req.broker,params);
  const rows=await many(`SELECT l.*,c.full_name AS contact_name,COALESCE(p.warning_minutes,30) AS warning_minutes,
    CASE WHEN l.accepted_at IS NULL THEN l.acceptance_due_at ELSE l.first_contact_due_at END AS active_deadline,
    CASE WHEN l.accepted_at IS NULL THEN 'acceptance' ELSE 'first_contact' END AS sla_kind
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN sla_policies p ON p.id=l.sla_policy_id WHERE (${scope.clause}) AND l.stage NOT IN ('Won','Lost')
    AND ((l.accepted_at IS NULL AND l.acceptance_due_at IS NOT NULL) OR (l.accepted_at IS NOT NULL AND l.first_contact_at IS NULL AND l.first_contact_due_at IS NOT NULL))
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
