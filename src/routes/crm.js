import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { SOURCES, BUSINESS_TYPES, STAGES, TEMPERATURES, CONTACT_TYPES, CHANNELS, ACTIVITY_TYPES,
  COMPANY_TYPES, JOB_ROLES, QUALIFICATION_GUIDANCE, validateBudget, validateLeadStage,
  validateContactIdentity, calculateMortgage, calculateRoi, isReassignmentDue, validateLeadTransition, normalizeDelimitedValues,
  activityStageTransition } from '../crm-domain.js';
import { hasInternalCrmIdentity, isCompanyReader, isManager, isCrmReadOnly, canReadLead,
  canWriteLead, canAssignLead, leadScopeSql, opportunityScopeSql, teamScopeSql, contactScopeSql, companyScopeSql } from '../crm-policy.js';
import { calculateDeadlines } from './lead-operations.js';
import { resolvePrimaryRoutingArea,selectRoutingRule } from '../routing-service.js';

const r = Router();
r.use(requireAuth, requireCrmAccess);

function requireCrmAccess(req, res, next) {
  if (!hasInternalCrmIdentity(req.broker))
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
  return one("SELECT id, team_id, job_role FROM brokers WHERE id=$1 AND role IN ('admin','internal_broker') AND status='active'", [id]);
}

async function eligibleTeamManager(id) {
  if (!id) return null;
  return one(`SELECT b.id,b.team_id,b.job_role FROM brokers b
    WHERE b.id=$1 AND b.status='active' AND b.role IN ('admin','internal_broker')
      AND (b.job_role='manager' OR EXISTS (
        SELECT 1 FROM user_role_assignments r
        WHERE r.broker_id=b.id AND r.job_role='manager' AND r.status='active' AND r.ends_at IS NULL
      ))`, [id]);
}

function canWriteCrm(broker) {
  return !isCrmReadOnly(broker);
}

async function refreshAssignmentStatuses() {
  await transaction(async client=>{
    const timed=await many(`UPDATE lead_assignments SET status='timed_out',responded_at=NOW()
      WHERE status='offered' AND superseded_at IS NULL AND acceptance_due_at<=NOW() RETURNING *`,[],client);
    for(const assignment of timed){
      await execute("UPDATE leads SET assignment_status='reassignment_due',updated_at=NOW() WHERE id=$1 AND stage NOT IN ('Won','Lost')",[assignment.leadId],client);
      await audit('LeadAssignment',assignment.id,'timed_out',assignment.assignedBy||assignment.agentId,{deadline:assignment.acceptanceDueAt},client);
    }
  });
}

function icsEscape(value) {
  return String(value || '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

r.get('/crm/overview', async (req, res) => {
  await refreshAssignmentStatuses();
  const scoped=leadScopeSql('leads',req.broker,[]);
  const stats = await one(`SELECT
    COUNT(*) FILTER (WHERE stage NOT IN ('Won','Lost'))::int AS open_leads,
    COUNT(*) FILTER (WHERE stage = 'New')::int AS new_leads,
    COUNT(*) FILTER (WHERE temperature = 'Hot' AND stage NOT IN ('Won','Lost'))::int AS hot_leads,
    COUNT(*) FILTER (WHERE next_follow_up_at < NOW() AND stage NOT IN ('Won','Lost'))::int AS overdue_follow_ups,
    COUNT(*) FILTER (WHERE stage = 'Won' AND won_at >= DATE_TRUNC('month', NOW()))::int AS won_this_month,
    COUNT(*) FILTER (WHERE assignment_status IN ('unassigned','reassignment_due') AND stage NOT IN ('Won','Lost'))::int AS assignment_queue
    FROM leads WHERE ${scoped.clause}`,scoped.params);
  const due = await many(`SELECT a.*, l.title AS lead_title, c.full_name AS contact_name
    FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=a.contact_id
    WHERE a.completed_at IS NULL AND a.owner_id=$1 AND COALESCE(a.reminder_at,a.due_at) IS NOT NULL
    ORDER BY COALESCE(a.reminder_at,a.due_at) ASC LIMIT 8`, [req.broker.id]);
  res.json({ stats, dueActivities: due });
});

r.get('/crm/staff', async (req, res) => {
  const params=[];let scope='id=$1';params.push(req.broker.id);
  if(isCompanyReader(req.broker)||req.broker.jobRole==='admin_assistant'){scope="role IN ('admin','internal_broker')";params.length=0;}
  else if(isManager(req.broker)){scope=`(id=$1 OR EXISTS (SELECT 1 FROM team_memberships managed
    JOIN team_memberships member ON member.team_id=managed.team_id AND member.ends_at IS NULL
    WHERE managed.broker_id=$1 AND managed.membership_role='manager' AND managed.ends_at IS NULL AND member.broker_id=brokers.id))`;}
  const staff = await many(`SELECT id,name,email,team_id,job_title,job_role,
    COALESCE(ARRAY(SELECT tm.team_id::text FROM team_memberships tm WHERE tm.broker_id=brokers.id AND tm.ends_at IS NULL ORDER BY tm.team_id),ARRAY[]::text[]) AS team_ids
    FROM brokers
    WHERE (${scope}) AND role IN ('admin','internal_broker') AND status='active' ORDER BY name`,params);
  res.json({ staff });
});

r.get('/crm/teams', async (req, res) => {
  const scope=req.broker.jobRole==='admin_assistant'?{clause:'1=1',params:[]}:teamScopeSql('t',req.broker,[]);
  const teams = await many(`SELECT t.*, b.name AS manager_name,
    (SELECT COUNT(*)::int FROM brokers x WHERE x.team_id=t.id AND x.status='active') AS member_count
    FROM teams t LEFT JOIN brokers b ON b.id=t.manager_id WHERE t.active=1 AND ${scope.clause} ORDER BY t.name`,scope.params);
  res.json({ teams });
});

r.post('/crm/teams', async (req, res) => {
  if (req.broker.role !== 'admin' && req.broker.jobRole !== 'admin_assistant') return res.status(403).json({ error: 'Only administrators and Admin Assistants can create teams' });
  const { name, managerId, leadResponseHours=4 } = req.body || {};
  if (!clean(name)) return res.status(400).json({ error: 'name is required' });
  if (!Number.isInteger(+leadResponseHours) || +leadResponseHours < 1 || +leadResponseHours > 168)
    return res.status(400).json({ error: 'leadResponseHours must be between 1 and 168' });
  if (managerId && !(await eligibleTeamManager(managerId))) return res.status(400).json({ error: 'Select an active user with a Manager role' });
  const id = uuid();
  const team = await transaction(async client=>{
    const row=await one(`INSERT INTO teams (id,name,manager_id,lead_response_hours)
      VALUES ($1,$2,$3,$4) RETURNING *`, [id, clean(name), managerId || null, +leadResponseHours],client);
    if(managerId){await execute(`INSERT INTO team_memberships (id,team_id,broker_id,membership_role,created_by)
      VALUES ($1,$2,$3,'manager',$4)`,[uuid(),id,managerId,req.broker.id],client);await execute('UPDATE brokers SET team_id=COALESCE(team_id,$1) WHERE id=$2',[id,managerId],client);}
    await audit('Team', id, 'created', req.broker.id, { name: row.name },client);return row;
  });
  res.status(201).json(team);
});

r.patch('/crm/teams/:id', async (req, res) => {
  if (req.broker.role !== 'admin' && req.broker.jobRole !== 'admin_assistant') return res.status(403).json({ error: 'Only administrators and Admin Assistants can edit teams' });
  const team = await one('SELECT * FROM teams WHERE id=$1', [req.params.id]);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { name, managerId, leadResponseHours, active } = req.body || {};
  if (managerId && !(await eligibleTeamManager(managerId))) return res.status(400).json({ error: 'Select an active user with a Manager role' });
  if (leadResponseHours !== undefined && (!Number.isInteger(+leadResponseHours) || +leadResponseHours < 1 || +leadResponseHours > 168))
    return res.status(400).json({ error: 'leadResponseHours must be between 1 and 168' });
  if(active!==undefined&&![0,1,true,false].includes(active))return res.status(400).json({error:'active must be boolean'});
  const updated = await transaction(async client=>{
    const nextManager=managerId===undefined?team.managerId:managerId||null;
    const row=await one(`UPDATE teams SET name=COALESCE($1,name),manager_id=$2,
      lead_response_hours=COALESCE($3,lead_response_hours),active=COALESCE($4,active) WHERE id=$5 RETURNING *`,
      [clean(name),nextManager,leadResponseHours===undefined?null:+leadResponseHours,active===undefined?null:active?1:0,team.id],client);
    if(managerId!==undefined&&nextManager!==team.managerId){
      await execute("UPDATE team_memberships SET ends_at=NOW() WHERE team_id=$1 AND membership_role='manager' AND ends_at IS NULL",[team.id],client);
      if(nextManager) await execute(`INSERT INTO team_memberships (id,team_id,broker_id,membership_role,created_by)
        VALUES ($1,$2,$3,'manager',$4) ON CONFLICT (team_id,broker_id) WHERE ends_at IS NULL DO UPDATE SET membership_role='manager'`,[uuid(),team.id,nextManager,req.broker.id],client);
    }
    await audit('Team',team.id,'edited',req.broker.id,{name:row.name,managerId:row.managerId,leadResponseHours:row.leadResponseHours,active:row.active},client);return row;
  });
  res.json(updated);
});

r.get('/crm/companies', async (req, res) => {
  const params=[], where=['c.archived_at IS NULL'];
  where.push(companyScopeSql('c',req.broker,params).clause);
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
  where.push(contactScopeSql('c',req.broker,params).clause);
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(c.full_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
  }
  // Resolve permission scope before loading optional presentation metadata. This keeps
  // the Sales Agent owner/lead predicate in a small, independently parameterized query
  // and ensures a newly created customer remains visible even before it has a lead.
  const visible = await many(`SELECT c.id FROM contacts c WHERE ${where.join(' AND ')}
    ORDER BY LOWER(c.full_name),LOWER(COALESCE(c.email,c.phone,'')),c.id LIMIT 500`,params);
  if(!visible.length)return res.json({count:0,contacts:[]});
  const contacts = await many(`SELECT c.*,b.name AS owner_name,co.name AS company_name_resolved,lc.lead_count
    FROM contacts c
    LEFT JOIN brokers b ON b.id=c.owner_id
    LEFT JOIN companies co ON co.id=c.company_id
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS lead_count FROM leads l WHERE l.contact_id=c.id) lc ON TRUE
    WHERE c.id=ANY($1::uuid[])
    ORDER BY LOWER(c.full_name),LOWER(COALESCE(c.email,c.phone,'')),c.id`,[visible.map(x=>x.id)]);
  res.json({ count: contacts.length, contacts });
});

r.get('/crm/customers/:id',async(req,res)=>{
  const params=[req.params.id],scope=contactScopeSql('c',req.broker,params);
  const customer=await one(`SELECT c.*,co.name AS company_name_resolved FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=$1 AND c.archived_at IS NULL AND ${scope.clause}`,scope.params);
  if(!customer)return res.status(404).json({error:'Customer not found or outside your permitted scope'});
  const allLeads=await many(`SELECT id,title,business_type,stage,temperature,assigned_to,assigned_team_id,created_by,created_at FROM leads WHERE contact_id=$1 ORDER BY created_at DESC`,[customer.id]);
  const leads=allLeads.filter(lead=>canReadLead(req.broker,lead)),leadIds=leads.map(x=>x.id),canMaintain=canWriteCrm(req.broker)&&(req.broker.role==='admin'||customer.ownerId===req.broker.id),canReviewKyc=isManager(req.broker);
  const [roles,channels,consent,documents]=await Promise.all([
    many("SELECT role_code,status,created_at FROM contact_roles WHERE contact_id=$1 AND status='active' ORDER BY role_code",[customer.id]),
    many('SELECT id,channel_kind,usage_label,raw_value,verification_status,is_primary,whatsapp_enabled FROM contact_channels WHERE contact_id=$1 ORDER BY is_primary DESC,created_at',[customer.id]),
    one(`SELECT EXISTS(SELECT 1 FROM marketing_agreements WHERE contact_id=$1 AND status='executed' AND effective_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW()) AND withdrawn_at IS NULL) AS effective_consent`,[customer.id]),
    canMaintain||canReviewKyc?many(`SELECT id,document_type,title,status,access_classification,created_at FROM documents WHERE contact_id=$1 OR lead_id=ANY($2::uuid[]) ORDER BY created_at DESC LIMIT 100`,[customer.id,leadIds]):Promise.resolve([])
  ]);
  res.json({customer,roles,channels,leads,documents,canMaintain,canReviewKyc,effectiveConsent:Boolean(consent?.effectiveConsent),restricted:Boolean(customer.doNotContact)});
});

r.get('/crm/kyc-review-queue',async(req,res)=>{
  if(!isManager(req.broker))return res.status(403).json({error:'Manager or administrator access is required for KYC reviews'});
  const page=Math.max(1,Number.parseInt(req.query.page,10)||1),pageSize=Math.min(100,Math.max(1,Number.parseInt(req.query.pageSize,10)||20));
  const params=[],where=["c.archived_at IS NULL","c.lifecycle_status='active'","c.duplicate_review_status IN ('not_required','approved')","c.kyc_status='pending_review'"];
  if(req.broker.role!=='admin'){
    params.push(req.broker.id);
    where.push(`(owner_team.manager_id=$${params.length} OR EXISTS (SELECT 1 FROM team_memberships member
      JOIN team_memberships reviewer ON reviewer.team_id=member.team_id
      WHERE member.broker_id=c.owner_id AND member.ends_at IS NULL
        AND reviewer.broker_id=$${params.length} AND reviewer.membership_role='manager' AND reviewer.ends_at IS NULL))`);
  }
  if(clean(req.query.q)){
    params.push(`%${clean(req.query.q)}%`);
    where.push(`(c.full_name ILIKE $${params.length} OR COALESCE(c.email,'') ILIKE $${params.length} OR COALESCE(c.phone,'') ILIKE $${params.length} OR COALESCE(owner.name,'') ILIKE $${params.length} OR COALESCE(owner_team.name,membership_team.name,'') ILIKE $${params.length})`);
  }
  const from=`FROM contacts c LEFT JOIN brokers owner ON owner.id=c.owner_id
    LEFT JOIN teams owner_team ON owner_team.id=owner.team_id
    LEFT JOIN team_memberships member_team ON member_team.broker_id=c.owner_id AND member_team.ends_at IS NULL
    LEFT JOIN teams membership_team ON membership_team.id=member_team.team_id WHERE ${where.join(' AND ')}`;
  const countRow=await one(`SELECT COUNT(DISTINCT c.id)::int AS count ${from}`,params);
  params.push(pageSize,(page-1)*pageSize);
  const kycReviews=await many(`SELECT DISTINCT c.id,c.full_name,c.email,c.phone,c.id_document_type,c.id_document_last4,
    c.id_document_expiry,c.kyc_status,c.kyc_notes,c.updated_at,owner.name AS owner_name,COALESCE(owner_team.name,membership_team.name) AS team_name
    ${from} ORDER BY c.updated_at ASC,c.id LIMIT $${params.length-1} OFFSET $${params.length}`,params);
  res.json({count:Number(countRow?.count||0),page,pageSize,kycReviews});
});

r.post('/crm/contacts', async (req, res) => {
  const b = req.body || {};
  if (!canWriteCrm(req.broker)) return res.status(403).json({ error:'This role has read-only CRM access' });
  if (!clean(b.fullName)) return res.status(400).json({ error: 'fullName is required' });
  if (!clean(b.email) || !clean(b.phone) || !clean(b.preferredChannel)) return res.status(400).json({ error:'New customers require email, phone and preferred channel' });
  const identity=validateContactIdentity(b.email,b.phone);
  if(identity.error) return res.status(400).json({error:identity.error});
  const enumError = invalidEnum(b.contactType || 'buyer', CONTACT_TYPES, 'contactType') ||
    invalidEnum(b.preferredChannel, CHANNELS, 'preferredChannel');
  if (enumError) return res.status(400).json({ error: enumError });
  const ownerId = b.ownerId || req.broker.id;
  if (!(await staffMember(ownerId))) return res.status(400).json({ error: 'Invalid ownerId' });
  if (b.companyId && !(await one('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[b.companyId]))) return res.status(400).json({error:'Invalid companyId'});
  const duplicates=await many(`SELECT DISTINCT c.id,c.full_name,cc.channel_kind,cc.normalized_value FROM contact_channels cc
    JOIN contacts c ON c.id=cc.contact_id WHERE c.archived_at IS NULL AND c.lifecycle_status<>'merged' AND
    ((cc.channel_kind='Email' AND cc.normalized_value=$1) OR (cc.channel_kind='Phone' AND cc.normalized_value=$2))`,[identity.email,identity.phone]);
  if(duplicates.length&&!b.duplicateReviewRequested)return res.status(409).json({
    error:'Matching customer records already use this email or phone. Review the matches, then create a draft only if this is genuinely a different person.',
    duplicates,reviewLocation:'Customers > Duplicate review'
  });
  const roles=Array.isArray(b.contactRoles)&&b.contactRoles.length?[...new Set(b.contactRoles)]:[b.contactType||'buyer'];
  if(roles.some(role=>!CONTACT_TYPES.includes(role)))return res.status(400).json({error:'Invalid contact role'});
  const id = uuid();
  const contact = await transaction(async client=>{
    const duplicatePending=duplicates.length>0;
    const row=await one(`INSERT INTO contacts
      (id,full_name,email,phone,contact_type,company_name,company_id,preferred_channel,nationality,language,notes,owner_id,created_by,email_status,phone_status,public_profile_url,
      preferred_contact_time,do_not_contact,contact_restriction_reason,source_first_seen,postal_address,lifecycle_status,duplicate_review_status,duplicate_match_ids)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [id,clean(b.fullName),identity.email,identity.phone,b.contactType||'buyer',clean(b.companyName),b.companyId||null,
       b.preferredChannel||null,clean(b.nationality),clean(b.language),clean(b.notes),ownerId,req.broker.id,identity.emailStatus,identity.phoneStatus,clean(b.publicProfileUrl),
       clean(b.preferredContactTime),b.doNotContact?1:0,clean(b.contactRestrictionReason),clean(b.sourceFirstSeen),clean(b.postalAddress),
       duplicatePending?'inactive':'active',duplicatePending?'pending':'not_required',duplicates.map(x=>x.id)],client);
    for(const role of roles)await execute(`INSERT INTO contact_roles (id,contact_id,role_code,created_by) VALUES ($1,$2,$3,$4)`,[uuid(),id,role,req.broker.id],client);
    if(identity.email)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Email','Primary',$3,$4,1,$5,$6)`,[uuid(),id,String(b.email).trim(),identity.email,identity.emailStatus,req.broker.id],client);
    if(identity.phone)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Phone','Primary',$3,$4,$5,1,$6,$7)`,[uuid(),id,String(b.phone).trim(),identity.phone,b.whatsappEnabled||b.preferredChannel==='WhatsApp'?1:0,identity.phoneStatus,req.broker.id],client);
    if(b.companyId)await execute(`INSERT INTO company_contacts (id,company_id,contact_id,relationship_role,is_primary,created_by) VALUES ($1,$2,$3,$4,1,$5)`,[uuid(),b.companyId,id,clean(b.companyRelationshipRole)||'customer_contact',req.broker.id],client);
    await audit('Contact',id,duplicatePending?'duplicate_draft_created':'created',req.broker.id,
      {fullName:row.fullName,duplicateReviewStatus:row.duplicateReviewStatus,duplicateMatchIds:duplicates.map(x=>x.id)},client);return row;
  });
  res.status(201).json({...contact,duplicateWarnings:duplicates});
});

r.patch('/crm/contacts/:id/duplicate-review',async(req,res)=>{
  if(!isManager(req.broker))return res.status(403).json({error:'Manager or administrator access is required for duplicate resolution'});
  const contact=await one('SELECT * FROM contacts WHERE id=$1 AND archived_at IS NULL',[req.params.id]);
  if(!contact)return res.status(404).json({error:'Customer not found'});
  if(contact.duplicateReviewStatus!=='pending')return res.status(409).json({error:'Only a pending duplicate draft can receive a resolution'});
  if(req.broker.role!=='admin'){
    const responsible=await one(`SELECT 1 AS permitted FROM brokers owner
      LEFT JOIN teams t ON t.id=owner.team_id AND t.active=1
      WHERE owner.id=$1 AND (t.manager_id=$2 OR EXISTS(
        SELECT 1 FROM team_memberships member JOIN team_memberships reviewer ON reviewer.team_id=member.team_id
        WHERE member.broker_id=owner.id AND member.ends_at IS NULL AND reviewer.broker_id=$2
          AND reviewer.membership_role='manager' AND reviewer.ends_at IS NULL))`,[contact.ownerId,req.broker.id]);
    if(!responsible)return res.status(403).json({error:'This duplicate draft is outside your responsible team'});
  }
  const decision=clean(req.body?.decision),reviewNotes=clean(req.body?.reviewNotes);
  if(!['approved','rejected'].includes(decision))return res.status(400).json({error:'Decision must be approved or rejected'});
  if(!reviewNotes)return res.status(400).json({error:'Resolution notes are required'});
  const row=await one(`UPDATE contacts SET duplicate_review_status=$1,duplicate_reviewed_at=NOW(),duplicate_reviewed_by=$2,
    duplicate_review_notes=$3,lifecycle_status=CASE WHEN $1='approved' THEN 'active' ELSE 'inactive' END,updated_at=NOW()
    WHERE id=$4 RETURNING *`,[decision,req.broker.id,reviewNotes,contact.id]);
  await audit('Contact',contact.id,'duplicate_review_decided',req.broker.id,{decision,reviewNotes,duplicateMatchIds:contact.duplicateMatchIds});
  res.json(row);
});

r.patch('/crm/contacts/:id', async (req, res) => {
  const contact = await one('SELECT * FROM contacts WHERE id=$1 AND archived_at IS NULL', [req.params.id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  if (!canWriteCrm(req.broker) || (req.broker.role !== 'admin' && contact.ownerId !== req.broker.id))
    return res.status(403).json({ error: 'Only the contact owner or an admin can edit it' });
  const map = { fullName:'full_name',email:'email',phone:'phone',contactType:'contact_type',companyName:'company_name',companyId:'company_id',
    preferredChannel:'preferred_channel',nationality:'nationality',language:'language',notes:'notes',ownerId:'owner_id',publicProfileUrl:'public_profile_url',postalAddress:'postal_address' };
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
    const duplicates=await many(`SELECT DISTINCT c.id,c.full_name,cc.channel_kind,cc.normalized_value FROM contact_channels cc
      JOIN contacts c ON c.id=cc.contact_id WHERE c.id<>$1 AND c.archived_at IS NULL AND c.lifecycle_status<>'merged' AND
      ((cc.channel_kind='Email' AND cc.normalized_value=$2) OR (cc.channel_kind='Phone' AND cc.normalized_value=$3))`,
      [contact.id,identity.email,identity.phone]);
    if(duplicates.length&&!req.body.duplicateReviewed)return res.status(409).json({error:'Possible duplicate contact requires review',duplicates});
  }
  const sets=[], params=[], changes={};
  for (const [field,column] of Object.entries(map)) if (req.body[field] !== undefined) {
    const value = field === 'email' ? clean(req.body[field])?.toLowerCase()||null : clean(req.body[field]);
    params.push(value); sets.push(`${column}=$${params.length}`); changes[field]={ from:contact[field], to:value };
  }
  if(patchedIdentity){params.push(patchedIdentity.emailStatus);sets.push(`email_status=$${params.length}`);params.push(patchedIdentity.phoneStatus);sets.push(`phone_status=$${params.length}`);}
  if (!sets.length) return res.json(contact);
  params.push(contact.id);
  const updated = await transaction(async client=>{
    const row=await one(`UPDATE contacts SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params,client);
    if(patchedIdentity){
      for(const [kind,value,raw,status,whatsapp] of [
        ['Email',patchedIdentity.email,req.body.email,patchedIdentity.emailStatus,0],
        ['Phone',patchedIdentity.phone,req.body.phone,patchedIdentity.phoneStatus,req.body.whatsappEnabled||req.body.preferredChannel==='WhatsApp'?1:0]]){
        if(value){const existing=await one(`SELECT id FROM contact_channels WHERE contact_id=$1 AND channel_kind=$2 ORDER BY is_primary DESC,created_at LIMIT 1`,[contact.id,kind],client);
          if(existing)await execute(`UPDATE contact_channels SET raw_value=$1,normalized_value=$2,verification_status=$3,whatsapp_enabled=$4,updated_at=NOW() WHERE id=$5`,[String(raw??value).trim(),value,status,whatsapp,existing.id],client);
          else await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by)
            VALUES ($1,$2,$3,'Primary',$4,$5,$6,1,$7,$8)`,[uuid(),contact.id,kind,String(raw??value).trim(),value,whatsapp,status,req.broker.id],client);
        }else await execute(`DELETE FROM contact_channels WHERE contact_id=$1 AND channel_kind=$2 AND is_primary=1`,[contact.id,kind],client);
      }
    }
    await audit('Contact',contact.id,'edited',req.broker.id,changes,client);return row;
  });
  res.json(updated);
});

r.patch('/crm/contacts/:id/kyc',async(req,res)=>{
  const scopeParams=[req.params.id],scope=contactScopeSql('c',req.broker,scopeParams);
  const contact=await one(`SELECT c.* FROM contacts c WHERE c.id=$1 AND c.archived_at IS NULL AND ${scope.clause}`,scope.params);
  if(!contact)return res.status(404).json({error:'Contact not found'});
  const canMaintain=canWriteCrm(req.broker)&&(req.broker.role==='admin'||contact.ownerId===req.broker.id),canReview=isManager(req.broker);
  if(!canMaintain&&!canReview)return res.status(403).json({error:'Only the contact owner or an authorized manager can maintain KYC details'});
  const b=req.body||{},requestedStatus=clean(b.kycStatus)||'unverified',
    managerSelfVerification=canMaintain&&canReview&&['pending_review','verified'].includes(requestedStatus),
    status=managerSelfVerification?'verified':requestedStatus,
    reviewDecision=canReview&&!canMaintain&&['verified','expired','rejected'].includes(status),
    type=reviewDecision?contact.idDocumentType:clean(b.idDocumentType)||null,
    last4=reviewDecision?contact.idDocumentLast4:clean(b.idDocumentLast4)?.toUpperCase()||null,
    expiry=reviewDecision?contact.idDocumentExpiry:b.idDocumentExpiry||null,reviewNotes=clean(b.reviewNotes),
    notes=reviewDecision?[contact.kycNotes,reviewNotes?`Manager review: ${reviewNotes}`:null].filter(Boolean).join('\n')||null:clean(b.kycNotes);
  if(canMaintain&&(contact.lifecycleStatus!=='active'||!['not_required','approved'].includes(contact.duplicateReviewStatus)))
    return res.status(409).json({error:'KYC cannot be submitted for an inactive or unresolved duplicate Customer. A responsible Manager must approve the Customer first.'});
  if(type&&!['passport','emirates_id'].includes(type))return res.status(400).json({error:'ID type must be Passport or Emirates ID'});
  if(last4&&!/^[A-Z0-9]{4}$/.test(last4))return res.status(400).json({error:'Record only the final four letters or digits of the ID; never enter the full ID number'});
  if(!['unverified','pending_review','verified','expired','rejected'].includes(status))return res.status(400).json({error:'Invalid KYC status'});
  if(['verified','expired','rejected'].includes(status)&&!canReview)return res.status(403).json({error:'Manager or administrator approval is required for this KYC decision'});
  if(!canMaintain&&!reviewDecision)return res.status(403).json({error:'Managers may decide a pending KYC review but cannot alter the submitted identity details'});
  if(reviewDecision&&contact.kycStatus!=='pending_review')return res.status(409).json({error:'This KYC record is not pending review. Refresh the KYC review queue before deciding it.'});
  if(reviewDecision&&['expired','rejected'].includes(status)&&!reviewNotes)return res.status(400).json({error:'Review notes are required when rejecting or marking KYC expired'});
  if(['pending_review','verified'].includes(status)&&(!type||!last4||!expiry))return res.status(400).json({error:'ID type, masked final four and expiry date are required for KYC review'});
  const row=await one(`UPDATE contacts SET id_document_type=$1,id_document_last4=$2,id_document_expiry=$3,kyc_status=$4,
    kyc_verified_at=CASE WHEN $4='verified' THEN NOW() ELSE NULL END,kyc_verified_by=CASE WHEN $4='verified' THEN $5::uuid ELSE NULL::uuid END,
    kyc_notes=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,[type,last4,expiry,status,req.broker.id,notes,contact.id]);
  await audit('Contact',contact.id,reviewDecision?'kyc_review_decided':managerSelfVerification?'kyc_manager_verified':'kyc_summary_updated',req.broker.id,{idDocumentType:type,idDocumentLast4:last4?`***${last4}`:null,kycStatus:status,expiry,reviewNotes});
  res.json(row);
});

r.patch('/crm/contacts/:id/verification', async (req,res)=>{
  const contact=await one('SELECT * FROM contacts WHERE id=$1 AND archived_at IS NULL',[req.params.id]);
  if(!contact) return res.status(404).json({error:'Contact not found'});
  const scopeParams=[contact.id],scope=contactScopeSql('c',req.broker,scopeParams);
  const permitted=await one(`SELECT c.id FROM contacts c WHERE c.id=$1 AND ${scope.clause}`,scope.params);
  if(!permitted||isCrmReadOnly(req.broker)) return res.status(403).json({error:'Insufficient permissions'});
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
  where.push(leadScopeSql('l',req.broker,params).clause);
  const add=(clause,value)=>{ params.push(value); where.push(clause.replace('?',`$${params.length}`)); };
  if (req.query.stage && STAGES.includes(req.query.stage)) add('l.stage=?',req.query.stage);
  if (req.query.temperature && TEMPERATURES.includes(req.query.temperature)) add('l.temperature=?',req.query.temperature);
  if (req.query.assignedTo === 'me') add('l.assigned_to=?',req.broker.id);
  else if (req.query.assignedTo) add('l.assigned_to=?',req.query.assignedTo);
  if (req.query.assignmentStatus && ['unassigned','assigned','reassignment_due','closed'].includes(req.query.assignmentStatus)) add('l.assignment_status=?',req.query.assignmentStatus);
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(l.title ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`); }
  const opportunityScope=opportunityScopeSql('o',req.broker,params);
  const leads = await many(`SELECT l.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,c.postal_address AS contact_address,c.id_document_type,c.id_document_last4,c.id_document_expiry,c.kyc_status,
    b.name AS assigned_to_name,t.name AS assigned_team_name,x.project AS listing_project,
    active_opportunity.id AS active_opportunity_id,active_opportunity.opportunity_reference AS active_opportunity_reference,
    active_opportunity.title AS active_opportunity_title,active_opportunity.stage AS active_opportunity_stage,
    active_opportunity.next_action AS active_opportunity_next_action,active_opportunity.next_action_due_at AS active_opportunity_next_action_due_at,
    (SELECT COUNT(*)::int FROM activities a WHERE a.lead_id=l.id) AS activity_count
    FROM leads l JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN brokers b ON b.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN listings x ON x.id=l.listing_id
    LEFT JOIN LATERAL (
      SELECT o.id,o.opportunity_reference,o.title,o.stage,o.next_action,o.next_action_due_at
      FROM opportunities o
      WHERE o.lead_id=l.id AND o.stage NOT IN ('Closed Won','Closed Lost') AND ${opportunityScope.clause}
      ORDER BY o.updated_at DESC,o.created_at DESC LIMIT 1
    ) active_opportunity ON TRUE
    WHERE ${where.join(' AND ')} ORDER BY
      CASE l.temperature WHEN 'Hot' THEN 1 WHEN 'Warm' THEN 2 ELSE 3 END,l.updated_at DESC LIMIT 500`,params);
  res.json({ count: leads.length, leads });
});

r.get('/crm/leads/:id', async (req, res) => {
  await refreshAssignmentStatuses();
  const lead = await one(`SELECT l.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,c.postal_address AS contact_address,c.id_document_type,c.id_document_last4,c.id_document_expiry,c.kyc_status,c.kyc_verified_at,c.kyc_notes,
    c.preferred_channel,c.email_status,c.phone_status,c.public_profile_url,c.screening_notes,
    b.name AS assigned_to_name,t.name AS assigned_team_name,x.project AS listing_project,x.area AS listing_area,x.price AS listing_price
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
    LEFT JOIN teams t ON t.id=l.assigned_team_id LEFT JOIN listings x ON x.id=l.listing_id WHERE l.id=$1`,[req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canReadLead(req.broker,lead)) return res.status(403).json({ error:'Lead is outside your permitted scope' });
  const [activities,stageHistory] = await Promise.all([
    many(`SELECT a.*,b.name AS owner_name,x.name AS created_by_name,cal.event_url AS google_event_url,cal.meeting_url AS google_meeting_url,cal.sync_status AS google_sync_status FROM activities a
      JOIN brokers b ON b.id=a.owner_id JOIN brokers x ON x.id=a.created_by
      LEFT JOIN activity_calendar_events cal ON cal.activity_id=a.id AND cal.provider='google_calendar'
      WHERE a.lead_id=$1 ORDER BY COALESCE(a.due_at,a.created_at) DESC`,[lead.id]),
    many(`SELECT h.from_stage,h.to_stage,h.reason_code,h.changed_at,b.name AS changed_by_name
      FROM lead_stage_history h JOIN brokers b ON b.id=h.changed_by
      WHERE h.lead_id=$1 ORDER BY h.changed_at`,[lead.id])
  ]);
  res.json({ lead, activities, stageHistory, canWrite:canWriteLead(req.broker,lead), qualificationGuidance: QUALIFICATION_GUIDANCE[lead.temperature] });
});

async function insertCapturedLead(b, actorId, budget, client) {
  const id=uuid();
  const primary=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.preferredAreas,client);if(primary.error)throw Object.assign(new Error(primary.error),{statusCode:400});
  const rule=await selectRoutingRule({source:b.source,businessType:b.businessType,primaryAreaId:primary.areaId},client);
  const teamId=rule?.teamId||null,receivedAt=new Date(),deadlines=await calculateDeadlines(receivedAt,client);
  const row=await one(`INSERT INTO leads (id,contact_id,title,source,business_type,stage,temperature,budget_min,budget_max,
    preferred_areas,primary_routing_area_id,property_requirements,assigned_team_id,assigned_to,assignment_due_at,original_acceptance_due_at,acceptance_due_at,first_contact_due_at,
    sla_policy_id,next_follow_up_at,created_by,assignment_status,listing_id,received_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,$14,$14,$15,$16,$17,$18,'unassigned',$19,$20) RETURNING *`,
    [id,b.contactId,clean(b.title),b.source,b.businessType,b.stage||'New',b.temperature||'Unassessed',budget.min,budget.max,
     normalizeDelimitedValues(b.preferredAreas).join(', ')||null,primary.areaId,clean(b.propertyRequirements),teamId,deadlines.acceptanceDueAt,
     deadlines.firstContactDueAt,deadlines.policy?.id||null,b.nextFollowUpAt||null,actorId,b.listingId||null,receivedAt],client);
  await execute('UPDATE leads SET routing_reason=$1,last_queue_entered_at=received_at WHERE id=$2',[rule?`Matched routing rule: ${rule.name}`:'Company unassigned fallback',row.id],client);
  await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by)
    VALUES($1,$2,1,$3,NULL,'queued',$4,$5)`,[uuid(),id,teamId,deadlines.acceptanceDueAt,actorId],client);
  await execute(`INSERT INTO lead_stage_history(id,lead_id,from_stage,to_stage,changed_by) VALUES($1,$2,NULL,$3,$4)`,[uuid(),id,b.stage||'New',actorId],client);
  await audit('Lead',id,'created',actorId,{title:row.title,source:row.source,routingRuleId:rule?.id||null,primaryRoutingAreaId:primary.areaId},client);
  return row;
}

r.post('/crm/leads/capture', async (req,res)=>{
  const b=req.body||{},contactBody=b.contact||{};
  if(!canWriteCrm(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  for(const field of ['title','source','businessType'])if(!clean(b[field]))return res.status(400).json({error:`${field} is required`});
  if(!clean(contactBody.fullName))return res.status(400).json({error:'Customer full name is required'});
  if(!clean(contactBody.email)||!clean(contactBody.phone)||!clean(contactBody.preferredChannel))return res.status(400).json({error:'New customers require email, phone and preferred channel'});
  const identity=validateContactIdentity(contactBody.email,contactBody.phone);
  if(identity.error)return res.status(400).json({error:identity.error});
  const contactEnumError=invalidEnum(contactBody.contactType||'buyer',CONTACT_TYPES,'contactType')||invalidEnum(contactBody.preferredChannel,CHANNELS,'preferredChannel');
  if(contactEnumError)return res.status(400).json({error:contactEnumError});
  const leadEnumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||invalidEnum(b.stage||'New',STAGES,'stage');
  if(leadEnumError)return res.status(400).json({error:leadEnumError});
  if(b.temperature&&b.temperature!=='Unassessed')return res.status(400).json({error:'New leads begin Unassessed; use the approved qualification questions to calculate a result'});
  if(b.stage&&b.stage!=='New')return res.status(400).json({error:'New leads must start in the New stage'});
  if(b.assignedTo!==undefined||b.assignedTeamId!==undefined)return res.status(400).json({error:'New leads must enter an unassigned team queue; a team lead or Director assigns them after capture'});
  if(contactBody.companyId&&!(await one('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[contactBody.companyId])))return res.status(400).json({error:'Invalid companyId'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId])))return res.status(400).json({error:'Invalid listingId'});
  const budget=validateBudget(b.budgetMin,b.budgetMax);if(budget.error)return res.status(400).json({error:budget.error});
  if(budget.min===null||budget.max===null)return res.status(400).json({error:'Budget from and Budget to are required'});
  if(!normalizeDelimitedValues(b.preferredAreas).length)return res.status(400).json({error:'At least one preferred area is required'});
  const primaryArea=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.preferredAreas);if(primaryArea.error)return res.status(400).json({error:primaryArea.error});
  const duplicates=await many(`SELECT DISTINCT c.id,c.full_name,cc.channel_kind,cc.normalized_value FROM contact_channels cc
    JOIN contacts c ON c.id=cc.contact_id WHERE c.archived_at IS NULL AND c.lifecycle_status<>'merged' AND
    ((cc.channel_kind='Email' AND cc.normalized_value=$1) OR (cc.channel_kind='Phone' AND cc.normalized_value=$2))`,[identity.email,identity.phone]);
  if(duplicates.length)return res.status(409).json({error:'Matching customers already exist. Select the correct existing Customer, or create a duplicate-review draft from the Customer Master before capturing a Lead.',duplicates});
  const result=await transaction(async client=>{
    const contactId=uuid(),ownerId=req.broker.id;
    const contact=await one(`INSERT INTO contacts
      (id,full_name,email,phone,contact_type,company_id,preferred_channel,owner_id,created_by,email_status,phone_status,public_profile_url,postal_address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12) RETURNING *`,
      [contactId,clean(contactBody.fullName),identity.email,identity.phone,contactBody.contactType||'buyer',contactBody.companyId||null,
       contactBody.preferredChannel||null,ownerId,identity.emailStatus,identity.phoneStatus,clean(contactBody.publicProfileUrl),clean(contactBody.postalAddress)],client);
    await execute(`INSERT INTO contact_roles (id,contact_id,role_code,created_by) VALUES ($1,$2,$3,$4)`,[uuid(),contactId,contactBody.contactType||'buyer',ownerId],client);
    if(identity.email)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Email','Primary',$3,$4,1,$5,$6)`,[uuid(),contactId,String(contactBody.email).trim(),identity.email,identity.emailStatus,ownerId],client);
    if(identity.phone)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Phone','Primary',$3,$4,$5,1,$6,$7)`,[uuid(),contactId,String(contactBody.phone).trim(),identity.phone,contactBody.whatsappEnabled||contactBody.preferredChannel==='WhatsApp'?1:0,identity.phoneStatus,ownerId],client);
    if(contactBody.companyId)await execute(`INSERT INTO company_contacts (id,company_id,contact_id,relationship_role,is_primary,created_by)
      VALUES ($1,$2,$3,'customer_contact',1,$4)`,[uuid(),contactBody.companyId,contactId,ownerId],client);
    await audit('Contact',contactId,'created_with_lead',ownerId,{fullName:contact.fullName,duplicateReviewed:Boolean(b.duplicateReviewed)},client);
    const lead=await insertCapturedLead({...b,contactId},ownerId,budget,client);
    return {contact,lead};
  });
  res.status(201).json({...result,duplicateWarnings:duplicates});
});

r.post('/crm/leads', async (req, res) => {
  const b=req.body||{};
  if (!canWriteCrm(req.broker)) return res.status(403).json({error:'This role has read-only CRM access'});
  for (const field of ['contactId','title','source','businessType']) if (!clean(b[field])) return res.status(400).json({ error:`${field} is required` });
  const enumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||
    invalidEnum(b.stage||'New',STAGES,'stage')||invalidEnum(b.temperature||'Unassessed',TEMPERATURES,'temperature');
  if(enumError) return res.status(400).json({error:enumError});
  if(b.temperature&&b.temperature!=='Unassessed')return res.status(400).json({error:'New leads begin Unassessed; use the approved qualification questions to calculate a result'});
  if(b.stage&&b.stage!=='New')return res.status(400).json({error:'New leads must start in the New stage'});
  const contactParams=[b.contactId],contactScope=contactScopeSql('c',req.broker,contactParams);
  const contact=await one(`SELECT c.id,c.email,c.phone,c.preferred_channel,c.lifecycle_status,c.duplicate_review_status FROM contacts c WHERE c.id=$1 AND c.archived_at IS NULL AND ${contactScope.clause}`,contactScope.params);
  if(!contact)
    return res.status(400).json({error:'Invalid or inaccessible contactId'});
  if(contact.lifecycleStatus!=='active'||!['not_required','approved'].includes(contact.duplicateReviewStatus))
    return res.status(409).json({error:contact.duplicateReviewStatus==='rejected'?'This Customer was rejected during duplicate review and cannot be used to create a Lead. Use the approved existing Customer record instead.':'This Customer is inactive or awaiting duplicate resolution. A responsible Manager must approve it before a Lead can be created.'});
  if(!contact.email||!contact.phone||!contact.preferredChannel)return res.status(409).json({error:'Complete the existing customer email, phone and preferred channel before creating a lead'});
  if(b.assignedTo!==undefined||b.assignedTeamId!==undefined)return res.status(400).json({error:'New leads must enter an unassigned team queue; a team lead or Director assigns them after capture'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId]))) return res.status(400).json({error:'Invalid listingId'});
  const budget = validateBudget(b.budgetMin,b.budgetMax);
  if (budget.error) return res.status(400).json({error:budget.error});
  if(budget.min===null||budget.max===null)return res.status(400).json({error:'Budget from and Budget to are required'});
  if(!normalizeDelimitedValues(b.preferredAreas).length)return res.status(400).json({error:'At least one preferred area is required'});
  const primaryArea=await resolvePrimaryRoutingArea(b.primaryRoutingAreaId,b.preferredAreas);if(primaryArea.error)return res.status(400).json({error:primaryArea.error});
  const budgetMin=budget.min,budgetMax=budget.max;
  const lead=await transaction(client=>insertCapturedLead({...b,budgetMin,budgetMax},req.broker.id,{min:budgetMin,max:budgetMax},client));
  res.status(201).json(lead);
});

r.patch('/crm/leads/:id', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};
  if(b.temperature!==undefined)return res.status(400).json({error:'Qualification can be changed only through an approved model assessment'});
  const enumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||
    invalidEnum(b.stage,STAGES,'stage')||invalidEnum(b.temperature,TEMPERATURES,'temperature');
  if(enumError) return res.status(400).json({error:enumError});
  if (b.stage !== undefined) {
    const activeOpportunity=await one(`SELECT opportunity_reference,stage FROM opportunities
      WHERE lead_id=$1 AND stage NOT IN ('Closed Won','Closed Lost') ORDER BY updated_at DESC LIMIT 1`,[lead.id]);
    if(activeOpportunity)return res.status(409).json({error:`Track this pursuit in Opportunity ${activeOpportunity.opportunityReference} (${activeOpportunity.stage}); the connected Lead stage is retained as history`});
    const stageError = validateLeadStage(b.stage, b.lostReason || lead.lostReason);
    if (stageError) return res.status(400).json({error:stageError});
    if(b.stage==='Lost'&&!['lost','unqualified','duplicate'].includes(b.resolutionCode||lead.resolutionCode))return res.status(400).json({error:'Lost leads require resolutionCode: lost, unqualified, or duplicate'});
    if(b.stage==='Lost'){
      const reasonCode=clean(b.resolutionReasonCode||lead.resolutionReasonCode);if(!reasonCode)return res.status(400).json({error:'Lost leads require an approved resolutionReasonCode'});
      const approved=await one(`SELECT vd.id FROM value_definitions vd JOIN value_sets vs ON vs.id=vd.value_set_id
        WHERE vs.stable_code='lead_outcome_reason' AND vd.stable_code=$1 AND vd.definition_status='active'
        AND (vd.effective_from IS NULL OR vd.effective_from<=NOW()) AND (vd.effective_to IS NULL OR vd.effective_to>NOW())`,[reasonCode]);
      if(!approved)return res.status(400).json({error:'resolutionReasonCode is not an active approved lead outcome reason'});
    }
    const transitionError = validateLeadTransition(lead.stage,b.stage);
    if (transitionError) return res.status(409).json({error:transitionError});
  }
  let normalizedBudget=null;if(b.budgetMin!==undefined||b.budgetMax!==undefined){normalizedBudget=validateBudget(b.budgetMin===undefined?lead.budgetMin:b.budgetMin,b.budgetMax===undefined?lead.budgetMax:b.budgetMax);if(normalizedBudget.error)return res.status(400).json({error:normalizedBudget.error});}
  if(b.assignedTo!==undefined||b.assignedTeamId!==undefined)return res.status(400).json({error:'Use the governed assignment action; lead edits cannot change assignment'});
  if(b.assignedTo&&!(await staffMember(b.assignedTo))) return res.status(400).json({error:'Invalid assignedTo'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId]))) return res.status(400).json({error:'Invalid listingId'});
  const map={title:'title',source:'source',businessType:'business_type',stage:'stage',temperature:'temperature',budgetMin:'budget_min',
    budgetMax:'budget_max',preferredAreas:'preferred_areas',propertyRequirements:'property_requirements',resolutionCode:'resolution_code',resolutionReasonCode:'resolution_reason_code',assignedTeamId:'assigned_team_id',
    assignedTo:'assigned_to',nextFollowUpAt:'next_follow_up_at',lostReason:'lost_reason',listingId:'listing_id'};
  const sets=[],params=[],changes={};
  let stageParam = null;
  let assignedToParam = null;
  let assignedTeamParam = null;
  for(const [field,column] of Object.entries(map)) if(b[field]!==undefined){
    const value=field==='budgetMin'?normalizedBudget.min:field==='budgetMax'?normalizedBudget.max:field==='preferredAreas'?(normalizeDelimitedValues(b[field]).join(', ')||null):clean(b[field]);
    params.push(value);sets.push(`${column}=$${params.length}`);changes[field]={from:lead[field],to:value};
    if (field === 'stage') stageParam = params.length;
    if (field === 'assignedTo') assignedToParam = params.length;
    if (field === 'assignedTeamId') assignedTeamParam = params.length;
  }
  if(b.stage!==undefined){
    sets.push(`won_at=CASE WHEN $${stageParam}='Won' THEN COALESCE(won_at,NOW()) ELSE NULL END`);
    sets.push(`closed_at=CASE WHEN $${stageParam} IN ('Won','Lost') THEN COALESCE(closed_at,NOW()) ELSE NULL END`);
    if(b.stage!=='Lost') sets.push('lost_reason=NULL','resolution_code=NULL','resolution_reason_code=NULL');
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
  const updated=await transaction(async client=>{
    const row=await one(`UPDATE leads SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params,client);
    if(b.stage!==undefined&&b.stage!==lead.stage){
      await execute(`INSERT INTO lead_stage_history(id,lead_id,from_stage,to_stage,reason_code,changed_by) VALUES($1,$2,$3,$4,$5,$6)`,
        [uuid(),lead.id,lead.stage,b.stage,clean(b.lostReason),req.broker.id],client);
      await audit('LeadStage',lead.id,'transitioned',req.broker.id,{from:lead.stage,to:b.stage,reason:clean(b.lostReason)},client);
    }
    await audit('Lead',lead.id,'edited',req.broker.id,changes,client);return row;
  });
  res.json(updated);
});

r.get('/crm/reassignment-queue', async (req,res)=>{
  await refreshAssignmentStatuses();
  const params=[],scope=leadScopeSql('l',req.broker,params);
  const leads=await many(`SELECT l.*,c.full_name AS contact_name,b.name AS assigned_to_name,t.name AS assigned_team_name
    FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id
    WHERE (${scope.clause}) AND l.assignment_status IN ('unassigned','reassignment_due') AND l.stage NOT IN ('Won','Lost')
    ORDER BY CASE l.assignment_status WHEN 'reassignment_due' THEN 1 ELSE 2 END,l.created_at ASC`,scope.params);
  res.json({count:leads.length,leads});
});

r.post('/crm/leads/:id/assign', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canAssignLead(req.broker,lead)) return res.status(403).json({error:'Only the responsible team lead or Director can assign this lead'});
  const {assignedTo,assignedTeamId}=req.body||{};
  const assignee=assignedTo?await staffMember(assignedTo):null;
  if(assignedTo&&!assignee) return res.status(400).json({error:'Invalid assignedTo'});
  const teamId=assignedTeamId||assignee?.teamId||null;
  if(teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId]))) return res.status(400).json({error:'Invalid assignedTeamId'});
  if(assignedTo&&!(await one("SELECT b.id FROM brokers b WHERE b.id=$1 AND b.status='active' AND b.role='internal_broker' AND EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.broker_id=b.id AND tm.team_id=$2 AND tm.ends_at IS NULL)",[assignedTo,teamId])))return res.status(400).json({error:'Broker must be an eligible active member of the selected team'});
  if(req.broker.jobRole==='manager'&&teamId&&!(req.broker.managedTeamIds||[]).includes(teamId))return res.status(403).json({error:'Team leads can assign only within their managed teams'});
  const updated=await transaction(async client=>{
    const deadlines=await calculateDeadlines(new Date(),client);
    await execute("UPDATE lead_assignments SET status='reassigned',superseded_at=NOW() WHERE lead_id=$1 AND superseded_at IS NULL",[lead.id],client);
    const next=await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client);
    const row=await one(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=$2,
      assignment_status=CASE WHEN $1::uuid IS NULL THEN 'unassigned' ELSE 'assigned' END,assignment_due_at=$3,
      acceptance_due_at=$3,first_contact_due_at=$4,accepted_at=NULL,first_contact_at=NULL,
      reassigned_at=NOW(),reassigned_by=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,[assignedTo||null,teamId,deadlines.acceptanceDueAt,deadlines.firstContactDueAt,req.broker.id,lead.id],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid(),lead.id,next.n,teamId,assignedTo||null,assignedTo?'offered':'queued',deadlines.acceptanceDueAt,req.broker.id],client);
    await audit('Lead',lead.id,'reassigned',req.broker.id,{from:lead.assignedTo,to:assignedTo||null,teamId},client);return row;
  });res.json(updated);
});

r.get('/crm/leads/:id/operating-context',async(req,res)=>{
  const lead=await one(`SELECT l.*,c.full_name AS contact_name,c.email AS contact_email,c.phone AS contact_phone,
    b.name AS assigned_to_name,t.name AS assigned_team_name
    FROM leads l JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN brokers b ON b.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id
    WHERE l.id=$1`,[req.params.id]);
  if(!lead)return res.status(404).json({error:'Lead not found'});
  if(!canReadLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your permitted scope'});
  const opportunityParams=[lead.id],opportunityScope=opportunityScopeSql('o',req.broker,opportunityParams);
  const [requirement,qualification,opportunities]=await Promise.all([
    one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]),
    one('SELECT * FROM qualification_assessments WHERE lead_id=$1 ORDER BY assessed_at DESC LIMIT 1',[lead.id]),
    many(`SELECT o.id,o.opportunity_reference,o.title,o.stage,o.owner_id,o.assigned_team_id,o.next_action,o.next_action_due_at,o.version,
      (SELECT COUNT(*)::int FROM offers f WHERE f.opportunity_id=o.id AND f.status='accepted') AS accepted_offer_count,
      (SELECT COUNT(*)::int FROM bookings bk WHERE bk.opportunity_id=o.id AND bk.status='reserved') AS active_booking_count,
      b.name AS owner_name,t.name AS team_name,li.project AS listing_project
      FROM opportunities o JOIN brokers b ON b.id=o.owner_id LEFT JOIN teams t ON t.id=o.assigned_team_id
      LEFT JOIN listings li ON li.id=o.listing_id WHERE o.lead_id=$1 AND ${opportunityScope.clause} ORDER BY o.created_at`,opportunityScope.params)
  ]);
  const active=opportunities.filter(x=>!['Closed Won','Closed Lost'].includes(x.stage));
  const opportunityReady=Boolean(lead.assignedTo&&requirement&&qualification&&['Qualified','Viewing','Negotiation','Won'].includes(lead.stage));
  const currentOpportunity=active[0]||null;
  const stageIndex=currentOpportunity?['Requirements','Matching','Viewing','Offer','Negotiation','Booking'].indexOf(currentOpportunity.stage):-1;
  const sequenceStatus=(targetIndex,readyIndex)=>stageIndex===targetIndex?'current':stageIndex>targetIndex?'completed':stageIndex===readyIndex?'ready':'blocked';
  const steps=[
    {code:'customer',label:'Customer',status:'completed',action:'Customer identity is reused from the Customer Master'},
    {code:'lead',label:'Lead',status:'completed',action:'Enquiry, source and responsible ownership are retained'},
    {code:'qualification',label:'Qualification',status:qualification?'completed':'current',action:qualification?`${qualification.finalTemperature} qualification recorded`:'Complete the approved qualification'},
    {code:'requirements',label:'Requirements',status:requirement?'completed':qualification?'current':'blocked',action:requirement?`Structured requirement version ${requirement.versionNo} recorded`:qualification?'Collect the customer property requirements':'Complete qualification first'},
    {code:'opportunity',label:'Opportunity',status:currentOpportunity?'completed':opportunityReady?'ready':'blocked',action:currentOpportunity?currentOpportunity.opportunityReference:opportunityReady?'Agent decides whether NYSA has a genuine chance to serve':'Assignment, qualification and requirements are required'},
    {code:'matching',label:'Match',status:currentOpportunity?sequenceStatus(1,0):'blocked',action:currentOpportunity?.stage==='Requirements'?'Review matching inventory':currentOpportunity?.stage==='Matching'?currentOpportunity.nextAction:'Create an Opportunity first'},
    {code:'viewing',label:'Viewing',status:currentOpportunity?sequenceStatus(2,1):'blocked',action:stageIndex<2?'Shortlist inventory before scheduling':'Record attendance and customer feedback'},
    {code:'offer',label:'Offer',status:currentOpportunity?.acceptedOfferCount?'completed':currentOpportunity&&[3,4].includes(stageIndex)?'current':stageIndex===2?'ready':'blocked',action:currentOpportunity?.acceptedOfferCount?'Accepted exact revision is ready for reservation':'Create and negotiate immutable offer revisions'},
    {code:'booking',label:'Booking',status:currentOpportunity?.activeBookingCount?'current':currentOpportunity?.acceptedOfferCount?'ready':'blocked',action:currentOpportunity?.activeBookingCount?'Monitor reservation expiry and evidence':currentOpportunity?.acceptedOfferCount?'Create an explicit reservation':'An accepted exact offer revision is required'},
    {code:'deal',label:'Deal',status:'not_available',action:'Available in a later Release 2 slice'}
  ];
  res.json({lead,requirement,qualification,opportunities,steps,currentOpportunity,
    canCoordinateAssignment:canAssignLead(req.broker,lead),authoritativeSources:{customer:'Customer identity and contact details',lead:'Enquiry, source, campaign, requirement and qualification',opportunity:'Pursuit stage, owner and next action',listing:'Property facts and availability'}});
});

r.post('/crm/leads/:id/coordinated-reassignment',async(req,res)=>{
  const b=req.body||{},assignedTo=b.assignedTo||null,assignedTeamId=b.assignedTeamId||null,
    includeLead=b.includeLead!==false,opportunityIds=[...new Set(Array.isArray(b.opportunityIds)?b.opportunityIds:[])],reason=clean(b.reason);
  if(!assignedTo||!assignedTeamId)return res.status(400).json({error:'An active team and responsible agent are required'});
  if(!includeLead&&!opportunityIds.length)return res.status(400).json({error:'Select the Lead or at least one open Opportunity'});
  if(!reason)return res.status(400).json({error:'A reassignment reason is required'});
  if(opportunityIds.length>100)return res.status(400).json({error:'No more than 100 Opportunities may be reassigned together'});
  const result=await transaction(async client=>{
    const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!lead)return {code:404,error:'Lead not found'};
    if(!canAssignLead(req.broker,lead))return {code:403,error:'Administrator, responsible Team Manager or Director reassignment access required'};
    if(b.expectedLeadUpdatedAt&&new Date(lead.updatedAt).toISOString()!==new Date(b.expectedLeadUpdatedAt).toISOString())return {code:409,error:'This Lead changed after the reassignment preview; reopen it before saving'};
    const assignee=await one(`SELECT b.id,b.name FROM brokers b WHERE b.id=$1 AND b.status='active' AND b.role='internal_broker' AND b.job_role='sales_agent'
      AND EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.broker_id=b.id AND tm.team_id=$2 AND tm.ends_at IS NULL)`,[assignedTo,assignedTeamId],client);
    if(!assignee)return {code:400,error:'Responsible agent must be an eligible active Sales Agent in the selected team'};
    const team=await one('SELECT id,name FROM teams WHERE id=$1 AND active=1',[assignedTeamId],client);
    if(!team)return {code:400,error:'Selected team is not active'};
    if(req.broker.jobRole==='manager'&&!(req.broker.managedTeamIds||[]).includes(assignedTeamId))return {code:403,error:'Team Managers can reassign only within their managed teams'};
    const selectedParams=[lead.id,opportunityIds],selectedScope=opportunityScopeSql('opportunities',req.broker,selectedParams);
    const selected=opportunityIds.length?await many(`SELECT * FROM opportunities WHERE lead_id=$1 AND id=ANY($2::uuid[]) AND ${selectedScope.clause} FOR UPDATE`,selectedScope.params,client):[];
    if(selected.length!==opportunityIds.length)return {code:409,error:'One or more selected Opportunities no longer belong to this Lead or permitted scope'};
    if(selected.some(x=>['Closed Won','Closed Lost'].includes(x.stage)))return {code:409,error:'Closed Opportunities cannot be reassigned'};
    const expectedVersions=b.opportunityVersions&&typeof b.opportunityVersions==='object'?b.opportunityVersions:{};
    if(selected.some(x=>Number(expectedVersions[x.id])!==Number(x.version)))return {code:409,error:'An Opportunity changed after the reassignment preview; reopen it before saving'};
    let leadChanged=false;
    const currentOffer=includeLead?await one("SELECT * FROM lead_assignments WHERE lead_id=$1 AND superseded_at IS NULL AND status='offered' FOR UPDATE",[lead.id],client):null;
    const renewOffer=includeLead&&lead.assignedTo===assignedTo&&lead.assignedTeamId===assignedTeamId&&!lead.acceptedAt&&
      (!currentOffer||!currentOffer.acceptanceDueAt||new Date(currentOffer.acceptanceDueAt)<=new Date());
    if(includeLead&&(lead.assignedTo!==assignedTo||lead.assignedTeamId!==assignedTeamId||renewOffer)){
      const deadlines=await calculateDeadlines(new Date(),client);
      await execute("UPDATE lead_assignments SET status='reassigned',superseded_at=NOW() WHERE lead_id=$1 AND superseded_at IS NULL",[lead.id],client);
      const next=await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client);
      const assignmentId=uuid();
      await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by,response_reason)
        VALUES($1,$2,$3,$4,$5,'offered',$6,$7,$8)`,[assignmentId,lead.id,next.n,assignedTeamId,assignedTo,deadlines.acceptanceDueAt,req.broker.id,reason],client);
      await execute(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=$2,assignment_status='assigned',
        assignment_due_at=$3,acceptance_due_at=$3,first_contact_due_at=$4,accepted_at=NULL,first_contact_at=NULL,
        reassigned_at=NOW(),reassigned_by=$5,updated_at=NOW() WHERE id=$6`,[assignedTo,assignedTeamId,deadlines.acceptanceDueAt,deadlines.firstContactDueAt,req.broker.id,lead.id],client);
      await audit('LeadAssignment',assignmentId,renewOffer?'assignment_offer_renewed':'coordinated_reassignment',req.broker.id,{leadId:lead.id,fromOwnerId:lead.assignedTo,toOwnerId:assignedTo,fromTeamId:lead.assignedTeamId,toTeamId:assignedTeamId,reason},client);
      leadChanged=true;
    }
    const opportunityChanges=[];
    for(const opportunity of selected){
      if(opportunity.ownerId===assignedTo&&opportunity.assignedTeamId===assignedTeamId)continue;
      const historyId=uuid();
      await execute(`UPDATE opportunities SET owner_id=$1,assigned_team_id=$2,version=version+1,updated_at=NOW() WHERE id=$3`,[assignedTo,assignedTeamId,opportunity.id],client);
      await execute(`UPDATE opportunity_participants SET active=FALSE,ended_at=NOW() WHERE opportunity_id=$1 AND participation_role='owner' AND active=TRUE AND broker_id<>$2`,[opportunity.id,assignedTo],client);
      await execute(`INSERT INTO opportunity_participants(id,opportunity_id,broker_id,participation_role,active,added_by)
        VALUES($1,$2,$3,'owner',TRUE,$4) ON CONFLICT(opportunity_id,broker_id,participation_role)
        DO UPDATE SET active=TRUE,ended_at=NULL,added_by=EXCLUDED.added_by,added_at=NOW()`,[uuid(),opportunity.id,assignedTo,req.broker.id],client);
      await execute(`INSERT INTO opportunity_assignment_history(id,opportunity_id,from_team_id,to_team_id,from_owner_id,to_owner_id,change_scope,reason,changed_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[historyId,opportunity.id,opportunity.assignedTeamId,assignedTeamId,opportunity.ownerId,assignedTo,includeLead?'lead_and_opportunity':'opportunity_only',reason,req.broker.id],client);
      await audit('OpportunityAssignment',historyId,'reassigned',req.broker.id,{opportunityId:opportunity.id,fromOwnerId:opportunity.ownerId,toOwnerId:assignedTo,fromTeamId:opportunity.assignedTeamId,toTeamId:assignedTeamId,reason},client);
      opportunityChanges.push(opportunity.id);
    }
    return {leadId:lead.id,leadChanged,opportunityIds:opportunityChanges,assignedTo,assignedToName:assignee.name,assignedTeamId,assignedTeamName:team.name,reason};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.post('/crm/leads/:id/activities', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};
  if(!ACTIVITY_TYPES.includes(b.activityType)) return res.status(400).json({error:'Invalid activityType'});
  if(!clean(b.subject)) return res.status(400).json({error:'subject is required'});
  if(b.durationSeconds!==undefined&&b.durationSeconds!==null&&(!Number.isInteger(Number(b.durationSeconds))||Number(b.durationSeconds)<0))return res.status(400).json({error:'durationSeconds must be a non-negative integer'});
  if(b.activityType==='Meeting'&&(!b.dueAt||!Number.isInteger(Number(b.meetingDurationMinutes||30))||Number(b.meetingDurationMinutes||30)<15||Number(b.meetingDurationMinutes||30)>480))return res.status(400).json({error:'Meeting date/time and a duration from 15 to 480 minutes are required'});
  if(b.followUpRequired&&!b.dueAt)return res.status(400).json({error:'A due date is required when follow-up is required'});
  if(b.direction==='Outbound'&&['Call','Email','WhatsApp'].includes(b.activityType)){
    const contact=await one('SELECT do_not_contact FROM contacts WHERE id=$1',[lead.contactId]);
    if(contact?.doNotContact)return res.status(409).json({error:'Outbound communication is blocked by the contact restriction'});
    const permittedChannel=b.activityType==='Call'?'Phone':b.activityType;
    const consent=await one(`SELECT id FROM marketing_agreements WHERE contact_id=$1 AND status='executed' AND effective_at<=NOW()
      AND (expires_at IS NULL OR expires_at>NOW()) AND permitted_channels @> ARRAY[$2]::text[] LIMIT 1`,[lead.contactId,permittedChannel]);
    if(!consent)return res.status(409).json({error:`No effective agreement permits outbound ${b.activityType}`});
  }
  if(/^offer letter sent$/i.test(clean(b.subject))){
    if(!b.documentVersionId)return res.status(400).json({error:'Offer letter sent requires documentVersionId'});
    const sentVersion=await one("SELECT id FROM document_versions WHERE id=$1 AND status='sent' AND immutable=1",[b.documentVersionId]);
    if(!sentVersion)return res.status(400).json({error:'Offer letter sent requires the exact immutable sent document version'});
  }
  const ownerId=b.ownerId||lead.assignedTo||req.broker.id;
  if(!(await staffMember(ownerId))) return res.status(400).json({error:'Invalid ownerId'});
  const id=uuid();
  const activity=await transaction(async client=>{
    const row=await one(`INSERT INTO activities (id,lead_id,contact_id,activity_type,subject,details,direction,outcome,due_at,completed_at,owner_id,created_by,reminder_at,calendar_uid,document_version_id,
      duration_seconds,follow_up_required,lead_stage_snapshot,qualification_snapshot,meeting_duration_minutes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [id,lead.id,lead.contactId,b.activityType,clean(b.subject),clean(b.details),b.direction||null,clean(b.outcome),b.dueAt||null,b.completed?new Date():null,ownerId,req.broker.id,b.reminderAt||b.dueAt||null,`${id}@crm.nysarealty.com`,b.documentVersionId||null,b.durationSeconds??null,b.followUpRequired?1:0,lead.stage,lead.temperature,b.activityType==='Meeting'?Number(b.meetingDurationMinutes||30):null],client);
    const isContact=b.activityType==='Call'||b.direction==='Outbound'&&['Email','WhatsApp','Meeting'].includes(b.activityType),nextStage=activityStageTransition(lead.stage,b.activityType);
    await execute(`UPDATE leads SET next_follow_up_at=CASE WHEN $1::boolean THEN $2 ELSE next_follow_up_at END,
      first_contact_at=CASE WHEN $3::boolean THEN COALESCE(first_contact_at,NOW()) ELSE first_contact_at END,
      stage=COALESCE($4,stage),updated_at=NOW() WHERE id=$5`,
      [b.nextFollowUpAt!==undefined,b.nextFollowUpAt||null,isContact,nextStage,lead.id],client);
    if(nextStage){
      await execute(`INSERT INTO lead_stage_history(id,lead_id,from_stage,to_stage,reason_code,changed_by) VALUES($1,$2,$3,$4,$5,$6)`,
        [uuid(),lead.id,lead.stage,nextStage,'call_activity_recorded',req.broker.id],client);
      await audit('LeadStage',lead.id,'transitioned',req.broker.id,{from:lead.stage,to:nextStage,reason:'call_activity_recorded',activityId:id},client);
    }
    await audit('Activity',id,'created',req.broker.id,{leadId:lead.id,type:row.activityType,firstContact:isContact},client);return row;
  });
  res.status(201).json(activity);
});

r.patch('/crm/activities/:id', async (req,res)=>{
  const activity=await one(`SELECT a.*,l.assigned_to,l.assigned_team_id,l.created_by AS lead_created_by FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.id=$1`,[req.params.id]);
  if(!activity) return res.status(404).json({error:'Activity not found'});
  if(activity.ownerId!==req.broker.id&&!canWriteLead(req.broker,{assignedTo:activity.assignedTo,assignedTeamId:activity.assignedTeamId,createdBy:activity.leadCreatedBy})) return res.status(403).json({error:'Activity is outside your writable scope'});
  const completed=req.body.completed;
  if(completed===undefined) return res.status(400).json({error:'completed is required'});
  const updated=await one('UPDATE activities SET completed_at=CASE WHEN $1 THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$2 RETURNING *',[Boolean(completed),activity.id]);
  await audit('Activity',activity.id,completed?'completed':'reopened',req.broker.id);
  res.json(updated);
});

r.patch('/crm/activities/:id/correct',async(req,res)=>{
  const activity=await one(`SELECT a.*,l.assigned_to,l.assigned_team_id,l.created_by AS lead_created_by FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.id=$1`,[req.params.id]);if(!activity)return res.status(404).json({error:'Activity not found'});
  if(activity.ownerId!==req.broker.id&&!canWriteLead(req.broker,{assignedTo:activity.assignedTo,assignedTeamId:activity.assignedTeamId,createdBy:activity.leadCreatedBy}))return res.status(403).json({error:'Activity is outside your writable scope'});
  const reason=clean(req.body?.correctionReason);if(!reason)return res.status(400).json({error:'correctionReason is required'});const allowed={details:'details',outcome:'outcome',dueAt:'due_at',durationSeconds:'duration_seconds'},sets=[],params=[],changed={};
  if(req.body?.durationSeconds!==undefined&&req.body.durationSeconds!==null&&(!Number.isInteger(Number(req.body.durationSeconds))||Number(req.body.durationSeconds)<0))return res.status(400).json({error:'durationSeconds must be a non-negative integer'});
  for(const [field,column] of Object.entries(allowed))if(req.body[field]!==undefined){const value=field==='durationSeconds'?numberOrNull(req.body[field]):clean(req.body[field]);params.push(value);sets.push(`${column}=$${params.length}`);changed[field]=value;}
  if(!sets.length)return res.status(400).json({error:'At least one correctable field is required'});const row=await transaction(async client=>{params.push(activity.id);const updated=await one(`UPDATE activities SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params,client);const correctionId=uuid();await execute(`INSERT INTO activity_corrections(id,activity_id,prior_snapshot,corrected_fields,correction_reason,corrected_by) VALUES($1,$2,$3,$4,$5,$6)`,[correctionId,activity.id,JSON.stringify(activity),JSON.stringify(changed),reason,req.broker.id],client);await audit('ActivityCorrection',correctionId,'corrected',req.broker.id,{activityId:activity.id,reason,fields:Object.keys(changed)},client);return updated;});res.json(row);
});

r.delete('/crm/activities/:id',async(req,res)=>{const activity=await one(`SELECT a.*,l.assigned_to,l.assigned_team_id,l.created_by AS lead_created_by FROM activities a JOIN leads l ON l.id=a.lead_id WHERE a.id=$1`,[req.params.id]);if(!activity)return res.status(404).json({error:'Activity not found'});if(activity.ownerId!==req.broker.id&&!canWriteLead(req.broker,{assignedTo:activity.assignedTo,assignedTeamId:activity.assignedTeamId,createdBy:activity.leadCreatedBy}))return res.status(403).json({error:'Activity is outside your writable scope'});const reason=clean(req.body?.reason);if(!reason)return res.status(400).json({error:'Void reason is required'});const row=await one('UPDATE activities SET voided_at=NOW(),voided_by=$1,void_reason=$2,updated_at=NOW() WHERE id=$3 AND voided_at IS NULL RETURNING *',[req.broker.id,reason,activity.id]);if(!row)return res.status(409).json({error:'Activity is already voided'});await audit('Activity',activity.id,'voided',req.broker.id,{reason});res.json(row);});

r.get('/crm/activities/:id/calendar', async (req,res)=>{
  const activity=await one(`SELECT a.*,c.full_name AS contact_name,l.title AS lead_title,l.assigned_to,l.assigned_team_id,l.created_by FROM activities a
    JOIN contacts c ON c.id=a.contact_id JOIN leads l ON l.id=a.lead_id WHERE a.id=$1`,[req.params.id]);
  if(!activity) return res.status(404).json({error:'Activity not found'});
  if(!canReadLead(req.broker,{assignedTo:activity.assignedTo,assignedTeamId:activity.assignedTeamId,createdBy:activity.createdBy}))
    return res.status(403).json({error:'Activity is outside your permitted scope'});
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
  const scoped=(alias)=>{const params=[];const result=leadScopeSql(alias,req.broker,params);return{...result,params};};
  const stageScope=scoped('l'),sourceScope=scoped('l'),activityScope=scoped('l'),agentScope=scoped('l'),
    movementScope=scoped('l'),callScope=scoped('l'),closedScope=scoped('l');
  const [stages,sources,activities,agents,movements,calls,closedLeads]=await Promise.all([
    many(`SELECT l.stage AS label,COUNT(*)::int AS count FROM leads l WHERE ${stageScope.clause} GROUP BY l.stage ORDER BY count DESC`,stageScope.params),
    many(`SELECT l.source AS label,COUNT(*)::int AS count FROM leads l WHERE ${sourceScope.clause} GROUP BY l.source ORDER BY count DESC`,sourceScope.params),
    many(`SELECT a.activity_type AS label,COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE a.completed_at IS NOT NULL)::int AS completed FROM activities a JOIN leads l ON l.id=a.lead_id
      WHERE ${activityScope.clause} GROUP BY a.activity_type ORDER BY count DESC`,activityScope.params),
    many(`SELECT b.id,b.name,COUNT(DISTINCT l.id)::int AS total_leads,
      COUNT(DISTINCT l.id) FILTER (WHERE l.stage='Won')::int AS won_leads,
      COUNT(DISTINCT a.id) FILTER (WHERE a.activity_type='Call')::int AS calls
      FROM brokers b LEFT JOIN leads l ON l.assigned_to=b.id AND (${agentScope.clause})
      LEFT JOIN activities a ON a.lead_id=l.id WHERE b.role IN ('admin','internal_broker')
      GROUP BY b.id,b.name ORDER BY total_leads DESC`,agentScope.params),
    many(`SELECT a.timestamp,c.full_name AS contact_name,l.title,a.details::jsonb->'stage'->>'from' AS from_stage,
      a.details::jsonb->'stage'->>'to' AS to_stage,b.name AS performed_by_name
      FROM audit_log a JOIN leads l ON l.id=a.entity_id JOIN contacts c ON c.id=l.contact_id JOIN brokers b ON b.id=a.performed_by
      WHERE (${movementScope.clause}) AND a.entity_type='Lead' AND a.action='edited' AND a.details IS NOT NULL AND a.details::jsonb ? 'stage'
      ORDER BY a.timestamp DESC LIMIT 100`,movementScope.params),
    many(`SELECT a.created_at,c.full_name AS contact_name,l.title,a.subject,a.outcome,b.name AS owner_name
      FROM activities a JOIN leads l ON l.id=a.lead_id JOIN contacts c ON c.id=l.contact_id JOIN brokers b ON b.id=a.owner_id
      WHERE (${callScope.clause}) AND a.activity_type='Call' ORDER BY a.created_at DESC LIMIT 100`,callScope.params),
    many(`SELECT l.closed_at,c.full_name AS contact_name,l.title,l.stage,l.lost_reason,b.name AS assigned_to_name
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
      WHERE (${closedScope.clause}) AND l.stage IN ('Won','Lost') ORDER BY l.closed_at DESC LIMIT 100`,closedScope.params)
  ]);
  res.json({generatedAt:new Date().toISOString(),stages,sources,activities,agents,movements,calls,closedLeads});
});

r.get('/crm/leads/:id/value-briefs', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canReadLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your permitted scope'});
  const briefs=await many(`SELECT v.*,l.project,l.developer,l.area,l.property_type,l.bedrooms,l.size_sqft,l.price,l.currency,
    c.full_name AS contact_name FROM value_briefs v JOIN listings l ON l.id=v.listing_id JOIN leads x ON x.id=v.lead_id
    JOIN contacts c ON c.id=x.contact_id WHERE v.lead_id=$1 ORDER BY v.created_at DESC`,[req.params.id]);
  res.json({briefs:briefs.map(b=>({...b,roiPercent:calculateRoi(b.price,b.expectedAnnualRent,b.estimatedAnnualCosts)}))});
});

r.post('/crm/leads/:id/value-briefs', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your writable scope'});
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
