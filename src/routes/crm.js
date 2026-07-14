import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { SOURCES, BUSINESS_TYPES, STAGES, TEMPERATURES, CONTACT_TYPES, CHANNELS, ACTIVITY_TYPES,
  COMPANY_TYPES, JOB_ROLES, QUALIFICATION_GUIDANCE, validateBudget, validateLeadStage,
  validateContactIdentity, calculateMortgage, calculateRoi, isReassignmentDue } from '../crm-domain.js';

const r = Router();
r.use(requireAuth, requireCrmAccess);

function requireCrmAccess(req, res, next) {
  if (!['admin', 'internal_broker'].includes(req.broker.role))
    return res.status(403).json({ error: 'CRM customer data is restricted to NYSA staff' });
  next();
}

function invalidEnum(value, allowed, field) {
  return value !== undefined && value !== null && !allowed.includes(value) ? `Invalid ${field}` : null;
}

function clean(value) {
  const result = typeof value === 'string' ? value.trim() : value;
  return result === '' ? null : result;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number(value);
}

async function staffMember(id) {
  if (!id) return null;
  return one("SELECT id, team_id FROM brokers WHERE id=$1 AND role IN ('admin','internal_broker') AND status='active'", [id]);
}

function canManageLead(broker, lead) {
  return isLeader(broker) || lead.assignedTo === broker.id || lead.createdBy === broker.id ||
    (broker.teamId && lead.assignedTeamId === broker.teamId);
}

function isLeader(broker) {
  return broker.role === 'admin' || ['manager','director'].includes(broker.jobRole);
}

function canWriteCrm(broker) {
  return broker.jobRole !== 'accountant';
}

async function refreshAssignmentStatuses() {
  await execute(`UPDATE leads SET assignment_status='reassignment_due',updated_at=NOW()
    WHERE assignment_status='assigned' AND assignment_due_at<=NOW() AND stage NOT IN ('Won','Lost')`);
}

function icsEscape(value) {
  return String(value || '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

r.get('/crm/overview', async (req, res) => {
  await refreshAssignmentStatuses();
  const stats = await one(`SELECT
    COUNT(*) FILTER (WHERE stage NOT IN ('Won','Lost'))::int AS open_leads,
    COUNT(*) FILTER (WHERE stage = 'New')::int AS new_leads,
    COUNT(*) FILTER (WHERE temperature = 'Hot' AND stage NOT IN ('Won','Lost'))::int AS hot_leads,
    COUNT(*) FILTER (WHERE next_follow_up_at < NOW() AND stage NOT IN ('Won','Lost'))::int AS overdue_follow_ups,
    COUNT(*) FILTER (WHERE stage = 'Won' AND won_at >= DATE_TRUNC('month', NOW()))::int AS won_this_month,
    COUNT(*) FILTER (WHERE assignment_status IN ('unassigned','reassignment_due') AND stage NOT IN ('Won','Lost'))::int AS assignment_queue
    FROM leads`);
  const due = await many(`SELECT a.*, l.title AS lead_title, c.full_name AS contact_name
    FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id
    WHERE a.completed_at IS NULL AND a.owner_id=$1 AND COALESCE(a.reminder_at,a.due_at) IS NOT NULL
    ORDER BY COALESCE(a.reminder_at,a.due_at) ASC LIMIT 8`, [req.broker.id]);
  res.json({ stats, dueActivities: due });
});

r.get('/crm/staff', async (req, res) => {
  const staff = await many(`SELECT id,name,email,team_id,job_title,job_role FROM brokers
    WHERE role IN ('admin','internal_broker') AND status='active' ORDER BY name`);
  res.json({ staff });
});

r.get('/crm/teams', async (req, res) => {
  const teams = await many(`SELECT t.*, b.name AS manager_name,
    (SELECT COUNT(*)::int FROM brokers x WHERE x.team_id=t.id AND x.status='active') AS member_count
    FROM teams t LEFT JOIN brokers b ON b.id=t.manager_id WHERE t.active=1 ORDER BY t.name`);
  res.json({ teams });
});

r.post('/crm/teams', async (req, res) => {
  if (req.broker.role !== 'admin') return res.status(403).json({ error: 'Only admins can create teams' });
  const { name, managerId, leadResponseHours=4 } = req.body || {};
  if (!clean(name)) return res.status(400).json({ error: 'name is required' });
  if (!Number.isInteger(+leadResponseHours) || +leadResponseHours < 1 || +leadResponseHours > 168)
    return res.status(400).json({ error: 'leadResponseHours must be between 1 and 168' });
  if (managerId && !(await staffMember(managerId))) return res.status(400).json({ error: 'Invalid managerId' });
  const id = uuid();
  const team = await one(`INSERT INTO teams (id,name,manager_id,lead_response_hours)
    VALUES ($1,$2,$3,$4) RETURNING *`, [id, clean(name), managerId || null, +leadResponseHours]);
  await audit('Team', id, 'created', req.broker.id, { name: team.name });
  res.status(201).json(team);
});

r.patch('/crm/teams/:id', async (req, res) => {
  if (req.broker.role !== 'admin') return res.status(403).json({ error: 'Only admins can edit teams' });
  const team = await one('SELECT * FROM teams WHERE id=$1 AND active=1', [req.params.id]);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { name, managerId, leadResponseHours } = req.body || {};
  if (managerId && !(await staffMember(managerId))) return res.status(400).json({ error: 'Invalid managerId' });
  if (leadResponseHours !== undefined && (!Number.isInteger(+leadResponseHours) || +leadResponseHours < 1 || +leadResponseHours > 168))
    return res.status(400).json({ error: 'leadResponseHours must be between 1 and 168' });
  const updated = await one(`UPDATE teams SET name=COALESCE($1,name),manager_id=$2,
    lead_response_hours=COALESCE($3,lead_response_hours) WHERE id=$4 RETURNING *`,
    [clean(name), managerId === undefined ? team.managerId : managerId || null, leadResponseHours === undefined ? null : +leadResponseHours, team.id]);
  await audit('Team', team.id, 'edited', req.broker.id, { name:updated.name, managerId:updated.managerId, leadResponseHours:updated.leadResponseHours });
  res.json(updated);
});

r.get('/crm/companies', async (req, res) => {
  const params=[], where=['c.archived_at IS NULL'];
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`); }
  const companies = await many(`SELECT c.*,b.name AS owner_name,
    (SELECT COUNT(*)::int FROM contacts x WHERE x.company_id=c.id AND x.archived_at IS NULL) AS contact_count
    FROM companies c LEFT JOIN brokers b ON b.id=c.owner_id WHERE ${where.join(' AND ')} ORDER BY c.updated_at DESC`, params);
  res.json({ count:companies.length, companies });
});

r.post('/crm/companies', async (req, res) => {
  if (!canWriteCrm(req.broker)) return res.status(403).json({ error:'This role has read-only CRM access' });
  const b=req.body||{};
  if (!clean(b.name)) return res.status(400).json({ error:'name is required' });
  if (!COMPANY_TYPES.includes(b.companyType||'other')) return res.status(400).json({ error:'Invalid companyType' });
  const ownerId=b.ownerId||req.broker.id;
  if (!(await staffMember(ownerId))) return res.status(400).json({ error:'Invalid ownerId' });
  const id=uuid();
  const company=await one(`INSERT INTO companies (id,name,company_type,website,email,phone,address,notes,owner_id,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id,clean(b.name),b.companyType||'other',clean(b.website),clean(b.email)?.toLowerCase()||null,clean(b.phone),clean(b.address),clean(b.notes),ownerId,req.broker.id]);
  await audit('Company',id,'created',req.broker.id,{name:company.name,type:company.companyType});
  res.status(201).json(company);
});

r.patch('/crm/companies/:id', async (req,res)=>{
  const company=await one('SELECT * FROM companies WHERE id=$1 AND archived_at IS NULL',[req.params.id]);
  if(!company) return res.status(404).json({error:'Company not found'});
  if(!canWriteCrm(req.broker)||(req.broker.role!=='admin'&&company.ownerId!==req.broker.id)) return res.status(403).json({error:'Only the company owner or an admin can edit it'});
  const b=req.body||{};
  if(b.companyType!==undefined&&!COMPANY_TYPES.includes(b.companyType)) return res.status(400).json({error:'Invalid companyType'});
  if(b.ownerId&&!(await staffMember(b.ownerId))) return res.status(400).json({error:'Invalid ownerId'});
  const map={name:'name',companyType:'company_type',website:'website',email:'email',phone:'phone',address:'address',notes:'notes',ownerId:'owner_id'};
  const sets=[],params=[],changes={};
  for(const [field,column] of Object.entries(map)) if(b[field]!==undefined){const value=field==='email'?clean(b[field])?.toLowerCase()||null:clean(b[field]);params.push(value);sets.push(`${column}=$${params.length}`);changes[field]={from:company[field],to:value};}
  if(!sets.length) return res.json(company);
  params.push(company.id);const updated=await one(`UPDATE companies SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params);
  await audit('Company',company.id,'edited',req.broker.id,changes);res.json(updated);
});

r.get('/crm/contacts', async (req, res) => {
  const where = ['c.archived_at IS NULL'], params = [];
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(c.full_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
  }
  const contacts = await many(`SELECT c.*, b.name AS owner_name,co.name AS company_name_resolved,
    (SELECT COUNT(*)::int FROM leads l WHERE l.contact_id=c.id) AS lead_count
    FROM contacts c LEFT JOIN brokers b ON b.id=c.owner_id LEFT JOIN companies co ON co.id=c.company_id
    WHERE ${where.join(' AND ')} ORDER BY c.updated_at DESC LIMIT 500`, params);
  res.json({ count: contacts.length, contacts });
});

r.post('/crm/contacts', async (req, res) => {
  const b = req.body || {};
  if (!canWriteCrm(req.broker)) return res.status(403).json({ error:'This role has read-only CRM access' });
  if (!clean(b.fullName)) return res.status(400).json({ error: 'fullName is required' });
  const identity=validateContactIdentity(b.email,b.phone);
  if(identity.error) return res.status(400).json({error:identity.error});
  const enumError = invalidEnum(b.contactType || 'buyer', CONTACT_TYPES, 'contactType') ||
    invalidEnum(b.preferredChannel, CHANNELS, 'preferredChannel');
  if (enumError) return res.status(400).json({ error: enumError });
  const ownerId = b.ownerId || req.broker.id;
  if (!(await staffMember(ownerId))) return res.status(400).json({ error: 'Invalid ownerId' });
  if (b.companyId && !(await one('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[b.companyId]))) return res.status(400).json({error:'Invalid companyId'});
  const id = uuid();
  const contact = await one(`INSERT INTO contacts
    (id,full_name,email,phone,contact_type,company_name,company_id,preferred_channel,nationality,language,notes,owner_id,created_by,email_status,phone_status,public_profile_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [id,clean(b.fullName),identity.email,identity.phone,b.contactType||'buyer',clean(b.companyName),b.companyId||null,
     b.preferredChannel||null,clean(b.nationality),clean(b.language),clean(b.notes),ownerId,req.broker.id,identity.emailStatus,identity.phoneStatus,clean(b.publicProfileUrl)]);
  await audit('Contact', id, 'created', req.broker.id, { fullName: contact.fullName });
  res.status(201).json(contact);
});

r.patch('/crm/contacts/:id', async (req, res) => {
  const contact = await one('SELECT * FROM contacts WHERE id=$1 AND archived_at IS NULL', [req.params.id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  if (!canWriteCrm(req.broker) || (req.broker.role !== 'admin' && contact.ownerId !== req.broker.id))
    return res.status(403).json({ error: 'Only the contact owner or an admin can edit it' });
  const map = { fullName:'full_name',email:'email',phone:'phone',contactType:'contact_type',companyName:'company_name',companyId:'company_id',
    preferredChannel:'preferred_channel',nationality:'nationality',language:'language',notes:'notes',ownerId:'owner_id',publicProfileUrl:'public_profile_url' };
  const enumError = invalidEnum(req.body.contactType, CONTACT_TYPES, 'contactType') ||
    invalidEnum(req.body.preferredChannel, CHANNELS, 'preferredChannel');
  if (enumError) return res.status(400).json({ error: enumError });
  if (req.body.ownerId && !(await staffMember(req.body.ownerId))) return res.status(400).json({ error: 'Invalid ownerId' });
  if (req.body.companyId && !(await one('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[req.body.companyId]))) return res.status(400).json({error:'Invalid companyId'});
  let patchedIdentity=null;
  if (req.body.email !== undefined || req.body.phone !== undefined) {
    const identity=validateContactIdentity(req.body.email===undefined?contact.email:req.body.email,req.body.phone===undefined?contact.phone:req.body.phone);
    if(identity.error) return res.status(400).json({error:identity.error});
    req.body.email=identity.email;req.body.phone=identity.phone;
    patchedIdentity=identity;
  }
  const sets=[], params=[], changes={};
  for (const [field,column] of Object.entries(map)) if (req.body[field] !== undefined) {
    const value = field === 'email' ? clean(req.body[field])?.toLowerCase()||null : clean(req.body[field]);
    params.push(value); sets.push(`${column}=$${params.length}`); changes[field]={ from:contact[field], to:value };
  }
  if(patchedIdentity){params.push(patchedIdentity.emailStatus);sets.push(`email_status=$${params.length}`);params.push(patchedIdentity.phoneStatus);sets.push(`phone_status=$${params.length}`);}
  if (!sets.length) return res.json(contact);
  params.push(contact.id);
  const updated = await one(`UPDATE contacts SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
  await audit('Contact', contact.id, 'edited', req.broker.id, changes);
  res.json(updated);
});

r.patch('/crm/contacts/:id/verification', async (req,res)=>{
  const contact=await one('SELECT * FROM contacts WHERE id=$1 AND archived_at IS NULL',[req.params.id]);
  if(!contact) return res.status(404).json({error:'Contact not found'});
  if(!canManageLead(req.broker,{assignedTo:contact.ownerId,createdBy:contact.createdBy,assignedTeamId:null})) return res.status(403).json({error:'Insufficient permissions'});
  const {emailStatus,phoneStatus,publicProfileUrl,screeningNotes}=req.body||{};
  const statuses=['unverified','format_valid','verified','invalid'];
  if(emailStatus&&!statuses.includes(emailStatus)||phoneStatus&&!statuses.includes(phoneStatus)) return res.status(400).json({error:'Invalid verification status'});
  const updated=await one(`UPDATE contacts SET email_status=COALESCE($1,email_status),phone_status=COALESCE($2,phone_status),
    public_profile_url=COALESCE($3,public_profile_url),screening_notes=COALESCE($4,screening_notes),screened_at=CASE WHEN $4::text IS NULL THEN screened_at ELSE NOW() END,
    screened_by=CASE WHEN $4::text IS NULL THEN screened_by ELSE $5 END,last_verified_at=NOW(),updated_at=NOW() WHERE id=$6 RETURNING *`,
    [emailStatus||null,phoneStatus||null,clean(publicProfileUrl),clean(screeningNotes),req.broker.id,contact.id]);
  await audit('Contact',contact.id,'verification_updated',req.broker.id,{emailStatus:updated.emailStatus,phoneStatus:updated.phoneStatus});res.json(updated);
});

r.get('/crm/leads', async (req, res) => {
  await refreshAssignmentStatuses();
  const where = ['1=1'], params=[];
  const add=(clause,value)=>{ params.push(value); where.push(clause.replace('?',`$${params.length}`)); };
  if (req.query.stage && STAGES.includes(req.query.stage)) add('l.stage=?',req.query.stage);
  if (req.query.temperature && TEMPERATURES.includes(req.query.temperature)) add('l.temperature=?',req.query.temperature);
  if (req.query.assignedTo === 'me') add('l.assigned_to=?',req.broker.id);
  else if (req.query.assignedTo) add('l.assigned_to=?',req.query.assignedTo);
  if (req.query.assignmentStatus && ['unassigned','assigned','reassignment_due','closed'].includes(req.query.assignmentStatus)) add('l.assignment_status=?',req.query.assignmentStatus);
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(l.title ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`); }
  const leads = await many(`SELECT l.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,
    b.name AS assigned_to_name,t.name AS assigned_team_name,x.project AS listing_project,
    (SELECT COUNT(*)::int FROM activities a WHERE a.lead_id=l.id) AS activity_count
    FROM leads l JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN brokers b ON b.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN listings x ON x.id=l.listing_id
    WHERE ${where.join(' AND ')} ORDER BY
      CASE l.temperature WHEN 'Hot' THEN 1 WHEN 'Warm' THEN 2 ELSE 3 END,l.updated_at DESC LIMIT 500`,params);
  res.json({ count: leads.length, leads });
});

r.get('/crm/leads/:id', async (req, res) => {
  await refreshAssignmentStatuses();
  const lead = await one(`SELECT l.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,
    c.preferred_channel,c.email_status,c.phone_status,c.public_profile_url,c.screening_notes,
    b.name AS assigned_to_name,t.name AS assigned_team_name,x.project AS listing_project,x.area AS listing_area,x.price AS listing_price
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
    LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN listings x ON x.id=l.listing_id WHERE l.id=$1`,[req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const activities = await many(`SELECT a.*,b.name AS owner_name,x.name AS created_by_name FROM activities a
    JOIN brokers b ON b.id=a.owner_id JOIN brokers x ON x.id=a.created_by
    WHERE a.lead_id=$1 ORDER BY COALESCE(a.due_at,a.created_at) DESC`,[lead.id]);
  res.json({ lead, activities, qualificationGuidance: QUALIFICATION_GUIDANCE[lead.temperature] });
});

r.post('/crm/leads', async (req, res) => {
  const b=req.body||{};
  if (!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  for (const field of ['contactId','title','source','businessType']) if (!clean(b[field])) return res.status(400).json({ error:`${field} is required` });
  const enumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||
    invalidEnum(b.stage||'New',STAGES,'stage')||invalidEnum(b.temperature||'Warm',TEMPERATURES,'temperature');
  if(enumError) return res.status(400).json({error:enumError});
  if(!(await one('SELECT id FROM contacts WHERE id=$1 AND archived_at IS NULL',[b.contactId]))) return res.status(400).json({error:'Invalid contactId'});
  const assignee=b.assignedTo?await staffMember(b.assignedTo):null;
  if(b.assignedTo&&!assignee) return res.status(400).json({error:'Invalid assignedTo'});
  if(b.assignedTeamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[b.assignedTeamId]))) return res.status(400).json({error:'Invalid assignedTeamId'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId]))) return res.status(400).json({error:'Invalid listingId'});
  const budget = validateBudget(b.budgetMin,b.budgetMax);
  if (budget.error) return res.status(400).json({error:budget.error});
  const budgetMin=budget.min,budgetMax=budget.max;
  const id=uuid();
  const lead=await one(`INSERT INTO leads (id,contact_id,title,source,business_type,stage,temperature,budget_min,budget_max,
    preferred_areas,property_requirements,assigned_team_id,assigned_to,assignment_due_at,next_follow_up_at,created_by,assignment_status,listing_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
      CASE WHEN $13::uuid IS NULL THEN NULL ELSE NOW()+COALESCE((SELECT lead_response_hours FROM teams WHERE id=$12),4)*INTERVAL '1 hour' END,
      $14,$15,CASE WHEN $13::uuid IS NULL THEN 'unassigned' ELSE 'assigned' END,$16) RETURNING *`,
    [id,b.contactId,clean(b.title),b.source,b.businessType,b.stage||'New',b.temperature||'Warm',budgetMin,budgetMax,
     clean(b.preferredAreas),clean(b.propertyRequirements),b.assignedTeamId||assignee?.teamId||null,b.assignedTo||null,b.nextFollowUpAt||null,req.broker.id,b.listingId||null]);
  await audit('Lead',id,'created',req.broker.id,{title:lead.title,source:lead.source});
  res.status(201).json(lead);
});

r.patch('/crm/leads/:id', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  if(!canManageLead(req.broker,lead)) return res.status(403).json({error:'Lead is assigned to another team'});
  const b=req.body||{};
  const enumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||
    invalidEnum(b.stage,STAGES,'stage')||invalidEnum(b.temperature,TEMPERATURES,'temperature');
  if(enumError) return res.status(400).json({error:enumError});
  if (b.stage !== undefined) {
    const stageError = validateLeadStage(b.stage, b.lostReason || lead.lostReason);
    if (stageError) return res.status(400).json({error:stageError});
  }
  if(b.budgetMin!==undefined||b.budgetMax!==undefined){const budget=validateBudget(b.budgetMin===undefined?lead.budgetMin:b.budgetMin,b.budgetMax===undefined?lead.budgetMax:b.budgetMax);if(budget.error)return res.status(400).json({error:budget.error});}
  if((b.assignedTo!==undefined||b.assignedTeamId!==undefined)&&!isLeader(req.broker)) return res.status(403).json({error:'Only managers, directors, or admins can reassign leads'});
  if(b.assignedTo&&!(await staffMember(b.assignedTo))) return res.status(400).json({error:'Invalid assignedTo'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId]))) return res.status(400).json({error:'Invalid listingId'});
  const map={title:'title',source:'source',businessType:'business_type',stage:'stage',temperature:'temperature',budgetMin:'budget_min',
    budgetMax:'budget_max',preferredAreas:'preferred_areas',propertyRequirements:'property_requirements',assignedTeamId:'assigned_team_id',
    assignedTo:'assigned_to',nextFollowUpAt:'next_follow_up_at',lostReason:'lost_reason',listingId:'listing_id'};
  const sets=[],params=[],changes={};
  let stageParam = null;
  let assignedToParam = null;
  let assignedTeamParam = null;
  for(const [field,column] of Object.entries(map)) if(b[field]!==undefined){
    const value=['budgetMin','budgetMax'].includes(field)?numberOrNull(b[field]):clean(b[field]);
    params.push(value);sets.push(`${column}=$${params.length}`);changes[field]={from:lead[field],to:value};
    if (field === 'stage') stageParam = params.length;
    if (field === 'assignedTo') assignedToParam = params.length;
    if (field === 'assignedTeamId') assignedTeamParam = params.length;
  }
  if(b.stage!==undefined){
    sets.push(`won_at=CASE WHEN $${stageParam}='Won' THEN COALESCE(won_at,NOW()) ELSE NULL END`);
    sets.push(`closed_at=CASE WHEN $${stageParam} IN ('Won','Lost') THEN COALESCE(closed_at,NOW()) ELSE NULL END`);
    if(b.stage!=='Lost') sets.push('lost_reason=NULL');
    if(b.assignedTo===undefined) sets.push(`assignment_status=CASE WHEN $${stageParam} IN ('Won','Lost') THEN 'closed' WHEN assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END`);
  }
  if(b.assignedTo!==undefined){
    sets.push('previous_assignee_id=assigned_to');
    sets.push('reassigned_at=NOW()');
    params.push(req.broker.id);sets.push(`reassigned_by=$${params.length}`);
    const stageClosedExpression=stageParam?`$${stageParam} IN ('Won','Lost')`:`stage IN ('Won','Lost')`;
    sets.push(`assignment_status=CASE WHEN ${stageClosedExpression} THEN 'closed' WHEN $${assignedToParam}::uuid IS NULL THEN 'unassigned' ELSE 'assigned' END`);
    const teamExpression=assignedTeamParam?`$${assignedTeamParam}::uuid`:'assigned_team_id';
    sets.push(`assignment_due_at=CASE WHEN $${assignedToParam}::uuid IS NULL THEN NULL ELSE NOW()+COALESCE((SELECT lead_response_hours FROM teams WHERE id=${teamExpression}),4)*INTERVAL '1 hour' END`);
  }
  if(!sets.length) return res.json(lead);
  params.push(lead.id);
  const updated=await one(`UPDATE leads SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params);
  await audit('Lead',lead.id,'edited',req.broker.id,changes);
  res.json(updated);
});

r.get('/crm/reassignment-queue', async (req,res)=>{
  await refreshAssignmentStatuses();
  const leads=await many(`SELECT l.*,c.full_name AS contact_name,b.name AS assigned_to_name,t.name AS assigned_team_name
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id
    WHERE l.assignment_status IN ('unassigned','reassignment_due') AND l.stage NOT IN ('Won','Lost')
    ORDER BY CASE l.assignment_status WHEN 'reassignment_due' THEN 1 ELSE 2 END,l.created_at ASC`);
  res.json({count:leads.length,leads});
});

r.post('/crm/leads/:id/claim', async (req,res)=>{
  if(!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  await refreshAssignmentStatuses();
  const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!['unassigned','reassignment_due'].includes(lead.assignmentStatus)) return res.status(409).json({error:'Lead is not available for reassignment'});
  const updated=await transaction(async client=>{
    const row=await one(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=COALESCE($2,assigned_team_id),
      assignment_status='assigned',assignment_due_at=NOW()+COALESCE((SELECT lead_response_hours FROM teams WHERE id=COALESCE($2,assigned_team_id)),4)*INTERVAL '1 hour',
      reassigned_at=NOW(),reassigned_by=$1,updated_at=NOW() WHERE id=$3 AND assignment_status IN ('unassigned','reassignment_due') RETURNING *`,
      [req.broker.id,req.broker.teamId||null,lead.id],client);
    if(!row) throw new Error('Lead was claimed by someone else');
    await audit('Lead',lead.id,'claimed',req.broker.id,{previousAssigneeId:lead.assignedTo},client);return row;
  });
  res.json(updated);
});

r.post('/crm/leads/:id/assign', async (req,res)=>{
  if(!isLeader(req.broker)) return res.status(403).json({error:'Only managers, directors, or admins can assign leads'});
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  const {assignedTo,assignedTeamId}=req.body||{};
  const assignee=assignedTo?await staffMember(assignedTo):null;
  if(assignedTo&&!assignee) return res.status(400).json({error:'Invalid assignedTo'});
  const teamId=assignedTeamId||assignee?.teamId||null;
  if(teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId]))) return res.status(400).json({error:'Invalid assignedTeamId'});
  const updated=await one(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=$2,
    assignment_status=CASE WHEN $1::uuid IS NULL THEN 'unassigned' ELSE 'assigned' END,
    assignment_due_at=CASE WHEN $1::uuid IS NULL THEN NULL ELSE NOW()+COALESCE((SELECT lead_response_hours FROM teams WHERE id=$2),4)*INTERVAL '1 hour' END,
    reassigned_at=NOW(),reassigned_by=$3,updated_at=NOW() WHERE id=$4 RETURNING *`,[assignedTo||null,teamId,req.broker.id,lead.id]);
  await audit('Lead',lead.id,'reassigned',req.broker.id,{from:lead.assignedTo,to:assignedTo||null,teamId});res.json(updated);
});

r.post('/crm/leads/:id/activities', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  if(!canManageLead(req.broker,lead)) return res.status(403).json({error:'Lead is assigned to another team'});
  const b=req.body||{};
  if(!ACTIVITY_TYPES.includes(b.activityType)) return res.status(400).json({error:'Invalid activityType'});
  if(!clean(b.subject)) return res.status(400).json({error:'subject is required'});
  const ownerId=b.ownerId||lead.assignedTo||req.broker.id;
  if(!(await staffMember(ownerId))) return res.status(400).json({error:'Invalid ownerId'});
  const id=uuid();
  const activity=await one(`INSERT INTO activities (id,lead_id,contact_id,activity_type,subject,details,direction,outcome,due_at,completed_at,owner_id,created_by,reminder_at,calendar_uid)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [id,lead.id,lead.contactId,b.activityType,clean(b.subject),clean(b.details),b.direction||null,clean(b.outcome),b.dueAt||null,b.completed?new Date():null,ownerId,req.broker.id,b.reminderAt||b.dueAt||null,`${id}@crm.nysarealty.com`]);
  if(b.nextFollowUpAt!==undefined) await execute('UPDATE leads SET next_follow_up_at=$1,updated_at=NOW() WHERE id=$2',[b.nextFollowUpAt||null,lead.id]);
  await audit('Activity',id,'created',req.broker.id,{leadId:lead.id,type:activity.activityType});
  res.status(201).json(activity);
});

r.patch('/crm/activities/:id', async (req,res)=>{
  const activity=await one('SELECT * FROM activities WHERE id=$1',[req.params.id]);
  if(!activity) return res.status(404).json({error:'Activity not found'});
  if(req.broker.role!=='admin'&&activity.ownerId!==req.broker.id) return res.status(403).json({error:'Only the activity owner or an admin can update it'});
  const completed=req.body.completed;
  if(completed===undefined) return res.status(400).json({error:'completed is required'});
  const updated=await one('UPDATE activities SET completed_at=CASE WHEN $1 THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$2 RETURNING *',[Boolean(completed),activity.id]);
  await audit('Activity',activity.id,completed?'completed':'reopened',req.broker.id);
  res.json(updated);
});

r.get('/crm/activities/:id/calendar', async (req,res)=>{
  const activity=await one(`SELECT a.*,c.full_name AS contact_name,l.title AS lead_title FROM activities a
    JOIN contacts c ON c.id=a.contact_id JOIN leads l ON l.id=a.lead_id WHERE a.id=$1`,[req.params.id]);
  if(!activity) return res.status(404).json({error:'Activity not found'});
  if(!activity.dueAt) return res.status(400).json({error:'Activity needs a due date before calendar export'});
  const start=icsDate(activity.dueAt),end=icsDate(new Date(new Date(activity.dueAt).getTime()+30*60000));
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NYSA CRM//EN','BEGIN:VEVENT',`UID:${icsEscape(activity.calendarUid||activity.id+'@crm.nysarealty.com')}`,
    `DTSTAMP:${icsDate(new Date())}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${icsEscape(activity.subject)}`,
    `DESCRIPTION:${icsEscape(`${activity.contactName} - ${activity.leadTitle}\n${activity.details||''}`)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="nysa-${activity.id}.ics"`);res.end(ics);
});

r.post('/crm/tools/mortgage', async (req,res)=>{
  const result=calculateMortgage(req.body||{});if(result.error) return res.status(400).json({error:result.error});res.json(result);
});

r.get('/crm/reports/summary', async (req,res)=>{
  const [stages,sources,activities,agents,movements,calls,closedLeads]=await Promise.all([
    many(`SELECT stage AS label,COUNT(*)::int AS count FROM leads GROUP BY stage ORDER BY count DESC`),
    many(`SELECT source AS label,COUNT(*)::int AS count FROM leads GROUP BY source ORDER BY count DESC`),
    many(`SELECT activity_type AS label,COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed FROM activities GROUP BY activity_type ORDER BY count DESC`),
    many(`SELECT b.id,b.name,
      (SELECT COUNT(*)::int FROM leads l WHERE l.assigned_to=b.id) AS total_leads,
      (SELECT COUNT(*)::int FROM leads l WHERE l.assigned_to=b.id AND l.stage='Won') AS won_leads,
      (SELECT COUNT(*)::int FROM activities a WHERE a.owner_id=b.id AND a.activity_type='Call') AS calls
      FROM brokers b WHERE b.role IN ('admin','internal_broker') ORDER BY total_leads DESC`),
    many(`SELECT a.timestamp,c.full_name AS contact_name,l.title,a.details::jsonb->'stage'->>'from' AS from_stage,
      a.details::jsonb->'stage'->>'to' AS to_stage,b.name AS performed_by_name
      FROM audit_log a JOIN leads l ON l.id=a.entity_id JOIN contacts c ON c.id=l.contact_id JOIN brokers b ON b.id=a.performed_by
      WHERE a.entity_type='Lead' AND a.action='edited' AND a.details IS NOT NULL AND a.details::jsonb ? 'stage'
      ORDER BY a.timestamp DESC LIMIT 100`),
    many(`SELECT a.created_at,c.full_name AS contact_name,l.title,a.subject,a.outcome,b.name AS owner_name
      FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=l.contact_id JOIN brokers b ON b.id=a.owner_id
      WHERE a.activity_type='Call' ORDER BY a.created_at DESC LIMIT 100`),
    many(`SELECT l.closed_at,c.full_name AS contact_name,l.title,l.stage,l.lost_reason,b.name AS assigned_to_name
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
      WHERE l.stage IN ('Won','Lost') ORDER BY l.closed_at DESC LIMIT 100`)
  ]);
  res.json({generatedAt:new Date().toISOString(),stages,sources,activities,agents,movements,calls,closedLeads});
});

r.get('/crm/leads/:id/value-briefs', async (req,res)=>{
  const briefs=await many(`SELECT v.*,l.project,l.developer,l.area,l.property_type,l.bedrooms,l.size_sqft,l.price,l.currency,
    c.full_name AS contact_name FROM value_briefs v JOIN listings l ON l.id=v.listing_id JOIN leads x ON x.id=v.lead_id
    JOIN contacts c ON c.id=x.contact_id WHERE v.lead_id=$1 ORDER BY v.created_at DESC`,[req.params.id]);
  res.json({briefs:briefs.map(b=>({...b,roiPercent:calculateRoi(b.price,b.expectedAnnualRent,b.estimatedAnnualCosts)}))});
});

r.post('/crm/leads/:id/value-briefs', async (req,res)=>{
  if(!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);if(!lead) return res.status(404).json({error:'Lead not found'});
  const b=req.body||{},listingId=b.listingId||lead.listingId;
  if(!listingId||!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[listingId]))) return res.status(400).json({error:'A valid listingId is required'});
  if(!clean(b.strengths)||!clean(b.recommendation)) return res.status(400).json({error:'strengths and recommendation are required'});
  const rent=numberOrNull(b.expectedAnnualRent),costs=numberOrNull(b.estimatedAnnualCosts)||0;
  if(rent!==null&&(!Number.isFinite(rent)||rent<0)||!Number.isFinite(costs)||costs<0) return res.status(400).json({error:'ROI inputs are invalid'});
  const id=uuid();const brief=await one(`INSERT INTO value_briefs (id,lead_id,listing_id,expected_annual_rent,estimated_annual_costs,strengths,recommendation,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,lead.id,listingId,rent,costs,clean(b.strengths),clean(b.recommendation),req.broker.id]);
  if(!lead.listingId) await execute('UPDATE leads SET listing_id=$1,updated_at=NOW() WHERE id=$2',[listingId,lead.id]);
  await audit('ValueBrief',id,'created',req.broker.id,{leadId:lead.id,listingId});res.status(201).json(brief);
});

export default r;
