import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { SOURCES, BUSINESS_TYPES, STAGES, TEMPERATURES, CONTACT_TYPES, CHANNELS, ACTIVITY_TYPES,
  COMPANY_TYPES, JOB_ROLES, QUALIFICATION_GUIDANCE, validateBudget, validateLeadStage,
  validateContactIdentity, calculateMortgage, calculateRoi, isReassignmentDue, validateLeadTransition } from '../crm-domain.js';
import { hasInternalCrmIdentity, isCompanyReader, isManager, isCrmReadOnly, canReadLead,
  canWriteLead, canAssignLead, leadScopeSql, contactScopeSql, companyScopeSql } from '../crm-policy.js';
import { calculateDeadlines } from './lead-operations.js';

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
  return one("SELECT id, team_id FROM brokers WHERE id=$1 AND role IN ('admin','internal_broker') AND status='active'", [id]);
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
  if(isCompanyReader(req.broker)){scope="role IN ('admin','internal_broker')";params.length=0;}
  else if(isManager(req.broker)){scope=`(id=$1 OR EXISTS (SELECT 1 FROM team_memberships tm
    WHERE tm.broker_id=$1 AND tm.membership_role='manager' AND tm.ends_at IS NULL AND tm.team_id=brokers.team_id))`;}
  const staff = await many(`SELECT id,name,email,team_id,job_title,job_role FROM brokers
    WHERE (${scope}) AND role IN ('admin','internal_broker') AND status='active' ORDER BY name`,params);
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
  if (req.broker.role !== 'admin') return res.status(403).json({ error: 'Only admins can edit teams' });
  const team = await one('SELECT * FROM teams WHERE id=$1', [req.params.id]);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { name, managerId, leadResponseHours, active } = req.body || {};
  if (managerId && !(await staffMember(managerId))) return res.status(400).json({ error: 'Invalid managerId' });
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
  const duplicates=await many(`SELECT DISTINCT c.id,c.full_name,cc.channel_kind,cc.normalized_value FROM contact_channels cc
    JOIN contacts c ON c.id=cc.contact_id WHERE c.archived_at IS NULL AND c.lifecycle_status<>'merged' AND
    ((cc.channel_kind='Email' AND cc.normalized_value=$1) OR (cc.channel_kind='Phone' AND cc.normalized_value=$2))`,[identity.email,identity.phone]);
  if(duplicates.length&&!b.duplicateReviewed)return res.status(409).json({error:'Possible duplicate contact requires review',duplicates});
  const roles=Array.isArray(b.contactRoles)&&b.contactRoles.length?[...new Set(b.contactRoles)]:[b.contactType||'buyer'];
  if(roles.some(role=>!CONTACT_TYPES.includes(role)))return res.status(400).json({error:'Invalid contact role'});
  const id = uuid();
  const contact = await transaction(async client=>{
    const row=await one(`INSERT INTO contacts
      (id,full_name,email,phone,contact_type,company_name,company_id,preferred_channel,nationality,language,notes,owner_id,created_by,email_status,phone_status,public_profile_url,
       preferred_contact_time,do_not_contact,contact_restriction_reason,source_first_seen)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [id,clean(b.fullName),identity.email,identity.phone,b.contactType||'buyer',clean(b.companyName),b.companyId||null,
       b.preferredChannel||null,clean(b.nationality),clean(b.language),clean(b.notes),ownerId,req.broker.id,identity.emailStatus,identity.phoneStatus,clean(b.publicProfileUrl),
       clean(b.preferredContactTime),b.doNotContact?1:0,clean(b.contactRestrictionReason),clean(b.sourceFirstSeen)],client);
    for(const role of roles)await execute(`INSERT INTO contact_roles (id,contact_id,role_code,created_by) VALUES ($1,$2,$3,$4)`,[uuid(),id,role,req.broker.id],client);
    if(identity.email)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Email','Primary',$3,$4,1,$5,$6)`,[uuid(),id,String(b.email).trim(),identity.email,identity.emailStatus,req.broker.id],client);
    if(identity.phone)await execute(`INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by)
      VALUES ($1,$2,'Phone','Primary',$3,$4,$5,1,$6,$7)`,[uuid(),id,String(b.phone).trim(),identity.phone,b.whatsappEnabled||b.preferredChannel==='WhatsApp'?1:0,identity.phoneStatus,req.broker.id],client);
    if(b.companyId)await execute(`INSERT INTO company_contacts (id,company_id,contact_id,relationship_role,is_primary,created_by) VALUES ($1,$2,$3,$4,1,$5)`,[uuid(),b.companyId,id,clean(b.companyRelationshipRole)||'customer_contact',req.broker.id],client);
    await audit('Contact',id,'created',req.broker.id,{fullName:row.fullName,duplicateReviewed:Boolean(b.duplicateReviewed)},client);return row;
  });
  res.status(201).json({...contact,duplicateWarnings:duplicates});
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
  if (!canReadLead(req.broker,lead)) return res.status(403).json({ error:'Lead is outside your permitted scope' });
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
  const contactParams=[b.contactId],contactScope=contactScopeSql('c',req.broker,contactParams);
  if(!(await one(`SELECT c.id FROM contacts c WHERE c.id=$1 AND c.archived_at IS NULL AND ${contactScope.clause}`,contactScope.params)))
    return res.status(400).json({error:'Invalid or inaccessible contactId'});
  if((b.assignedTo||b.assignedTeamId)&&!isManager(req.broker)) return res.status(403).json({error:'Only managers or admins can assign a new lead'});
  const assignee=b.assignedTo?await staffMember(b.assignedTo):null;
  if(b.assignedTo&&!assignee) return res.status(400).json({error:'Invalid assignedTo'});
  if(b.assignedTeamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[b.assignedTeamId]))) return res.status(400).json({error:'Invalid assignedTeamId'});
  const requestedTeam=b.assignedTeamId||assignee?.teamId||null;
  if(req.broker.role!=='admin'&&requestedTeam&&!(req.broker.managedTeamIds||[]).includes(requestedTeam))return res.status(403).json({error:'Managers can assign only within their managed teams'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId]))) return res.status(400).json({error:'Invalid listingId'});
  if(b.nextFollowUpAt===null&&!['Won','Lost'].includes(b.stage||lead.stage)&&!(await one("SELECT id FROM tasks WHERE lead_id=$1 AND status IN ('open','in_progress') LIMIT 1",[lead.id])))
    return res.status(409).json({error:'Active leads require a next action or open task'});
  const budget = validateBudget(b.budgetMin,b.budgetMax);
  if (budget.error) return res.status(400).json({error:budget.error});
  const budgetMin=budget.min,budgetMax=budget.max;
  const id=uuid();
  const lead=await transaction(async client=>{
    const rule=(!b.assignedTo&&!b.assignedTeamId)?await one(`SELECT * FROM routing_rules WHERE active=1 AND (source IS NULL OR source=$1)
      AND (business_type IS NULL OR business_type=$2) ORDER BY priority,id LIMIT 1`,[b.source,b.businessType],client):null;
    const agentId=b.assignedTo||rule?.agentId||null,teamId=b.assignedTeamId||assignee?.teamId||rule?.teamId||null;
    const receivedAt=new Date(),deadlines=await calculateDeadlines(receivedAt,client);
    const row=await one(`INSERT INTO leads (id,contact_id,title,source,business_type,stage,temperature,budget_min,budget_max,
      preferred_areas,property_requirements,assigned_team_id,assigned_to,assignment_due_at,original_acceptance_due_at,first_contact_due_at,
      sla_policy_id,next_follow_up_at,created_by,assignment_status,listing_id,received_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [id,b.contactId,clean(b.title),b.source,b.businessType,b.stage||'New',b.temperature||'Warm',budgetMin,budgetMax,
       clean(b.preferredAreas),clean(b.propertyRequirements),teamId,agentId,deadlines.acceptanceDueAt,deadlines.firstContactDueAt,deadlines.policy?.id||null,
       b.nextFollowUpAt||null,req.broker.id,agentId?'assigned':'unassigned',b.listingId||null,receivedAt],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by)
      VALUES($1,$2,1,$3,$4,$5,$6,$7)`,[uuid(),id,teamId,agentId,agentId?'offered':'queued',deadlines.acceptanceDueAt,req.broker.id],client);
    await execute(`INSERT INTO lead_stage_history(id,lead_id,from_stage,to_stage,changed_by) VALUES($1,$2,NULL,$3,$4)`,[uuid(),id,b.stage||'New',req.broker.id],client);
    await audit('Lead',id,'created',req.broker.id,{title:row.title,source:row.source,routingRuleId:rule?.id||null},client);return row;
  });
  res.status(201).json(lead);
});

r.patch('/crm/leads/:id', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};
  const enumError=invalidEnum(b.source,SOURCES,'source')||invalidEnum(b.businessType,BUSINESS_TYPES,'businessType')||
    invalidEnum(b.stage,STAGES,'stage')||invalidEnum(b.temperature,TEMPERATURES,'temperature');
  if(enumError) return res.status(400).json({error:enumError});
  if (b.stage !== undefined) {
    const stageError = validateLeadStage(b.stage, b.lostReason || lead.lostReason);
    if (stageError) return res.status(400).json({error:stageError});
    const transitionError = validateLeadTransition(lead.stage,b.stage);
    if (transitionError) return res.status(409).json({error:transitionError});
  }
  if(b.budgetMin!==undefined||b.budgetMax!==undefined){const budget=validateBudget(b.budgetMin===undefined?lead.budgetMin:b.budgetMin,b.budgetMax===undefined?lead.budgetMax:b.budgetMax);if(budget.error)return res.status(400).json({error:budget.error});}
  if((b.assignedTo!==undefined||b.assignedTeamId!==undefined)&&!canAssignLead(req.broker,lead)) return res.status(403).json({error:'Only the scoped manager or an admin can reassign this lead'});
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

r.post('/crm/leads/:id/claim', async (req,res)=>{
  if(!isManager(req.broker)) return res.status(403).json({error:'Only a scoped manager or admin can claim queued leads'});
  if(!req.body?.nextActionDue||Number.isNaN(new Date(req.body.nextActionDue).valueOf())) return res.status(400).json({error:'Valid nextActionDue is required when claiming a lead'});
  await refreshAssignmentStatuses();
  const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(req.broker.role!=='admin'&&lead.assignedTeamId&&!(req.broker.managedTeamIds||[]).includes(lead.assignedTeamId)) return res.status(403).json({error:'Lead belongs to another team'});
  if(!['unassigned','reassignment_due'].includes(lead.assignmentStatus)) return res.status(409).json({error:'Lead is not available for reassignment'});
  const updated=await transaction(async client=>{
    await execute("UPDATE lead_assignments SET status=CASE WHEN status='queued' THEN 'reassigned' ELSE status END,superseded_at=NOW() WHERE lead_id=$1 AND superseded_at IS NULL",[lead.id],client);
    const next=await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client);
    const row=await one(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=COALESCE($2,assigned_team_id),
      assignment_status='assigned',accepted_at=NOW(),reassigned_at=NOW(),reassigned_by=$1,updated_at=NOW()
      WHERE id=$3 AND assignment_status IN ('unassigned','reassignment_due') RETURNING *`,
      [req.broker.id,req.broker.teamId||null,lead.id],client);
    if(!row) throw new Error('Lead was claimed by someone else');
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,offered_at,responded_at,acceptance_due_at,assigned_by)
      VALUES($1,$2,$3,$4,$5,'accepted',NOW(),NOW(),$6,$5)`,[uuid(),lead.id,next.n,row.assignedTeamId,req.broker.id,row.assignmentDueAt],client);
    await execute(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,priority,due_at,created_by)
      VALUES($1,$2,$3,$4,$5,'high',$6,$5)`,[uuid(),lead.id,lead.contactId,clean(req.body.nextActionSubject)||'Contact newly claimed lead',req.broker.id,req.body.nextActionDue],client);
    await execute('UPDATE leads SET next_follow_up_at=$1 WHERE id=$2',[req.body.nextActionDue,lead.id],client);
    await audit('Lead',lead.id,'claimed',req.broker.id,{previousAssigneeId:lead.assignedTo},client);return row;
  });
  res.json(updated);
});

r.post('/crm/leads/:id/assign', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canAssignLead(req.broker,lead)) return res.status(403).json({error:'Only the scoped manager or an admin can assign this lead'});
  const {assignedTo,assignedTeamId}=req.body||{};
  const assignee=assignedTo?await staffMember(assignedTo):null;
  if(assignedTo&&!assignee) return res.status(400).json({error:'Invalid assignedTo'});
  const teamId=assignedTeamId||assignee?.teamId||null;
  if(teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId]))) return res.status(400).json({error:'Invalid assignedTeamId'});
  if(req.broker.role!=='admin'&&teamId&&!(req.broker.managedTeamIds||[]).includes(teamId))return res.status(403).json({error:'Managers can assign only within their managed teams'});
  const updated=await transaction(async client=>{
    const deadlines=await calculateDeadlines(new Date(),client);
    await execute("UPDATE lead_assignments SET status='reassigned',superseded_at=NOW() WHERE lead_id=$1 AND superseded_at IS NULL",[lead.id],client);
    const next=await one('SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM lead_assignments WHERE lead_id=$1',[lead.id],client);
    const row=await one(`UPDATE leads SET previous_assignee_id=assigned_to,assigned_to=$1,assigned_team_id=$2,
      assignment_status=CASE WHEN $1::uuid IS NULL THEN 'unassigned' ELSE 'assigned' END,assignment_due_at=$3,
      reassigned_at=NOW(),reassigned_by=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[assignedTo||null,teamId,deadlines.acceptanceDueAt,req.broker.id,lead.id],client);
    await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid(),lead.id,next.n,teamId,assignedTo||null,assignedTo?'offered':'queued',deadlines.acceptanceDueAt,req.broker.id],client);
    await audit('Lead',lead.id,'reassigned',req.broker.id,{from:lead.assignedTo,to:assignedTo||null,teamId},client);return row;
  });res.json(updated);
});

r.post('/crm/leads/:id/activities', async (req,res)=>{
  const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);
  if(!lead) return res.status(404).json({error:'Lead not found'});
  if(!canWriteLead(req.broker,lead)) return res.status(403).json({error:'Lead is outside your writable scope'});
  const b=req.body||{};
  if(!ACTIVITY_TYPES.includes(b.activityType)) return res.status(400).json({error:'Invalid activityType'});
  if(!clean(b.subject)) return res.status(400).json({error:'subject is required'});
  if(/^offer letter sent$/i.test(clean(b.subject))){
    if(!b.documentVersionId)return res.status(400).json({error:'Offer letter sent requires documentVersionId'});
    const sentVersion=await one("SELECT id FROM document_versions WHERE id=$1 AND status='sent' AND immutable=1",[b.documentVersionId]);
    if(!sentVersion)return res.status(400).json({error:'Offer letter sent requires the exact immutable sent document version'});
  }
  const ownerId=b.ownerId||lead.assignedTo||req.broker.id;
  if(!(await staffMember(ownerId))) return res.status(400).json({error:'Invalid ownerId'});
  const id=uuid();
  const activity=await transaction(async client=>{
    const row=await one(`INSERT INTO activities (id,lead_id,contact_id,activity_type,subject,details,direction,outcome,due_at,completed_at,owner_id,created_by,reminder_at,calendar_uid,document_version_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [id,lead.id,lead.contactId,b.activityType,clean(b.subject),clean(b.details),b.direction||null,clean(b.outcome),b.dueAt||null,b.completed?new Date():null,ownerId,req.broker.id,b.reminderAt||b.dueAt||null,`${id}@crm.nysarealty.com`,b.documentVersionId||null],client);
    const isContact=b.direction==='Outbound'&&['Call','Email','WhatsApp','Meeting'].includes(b.activityType);
    await execute(`UPDATE leads SET next_follow_up_at=CASE WHEN $1::boolean THEN $2 ELSE next_follow_up_at END,
      first_contact_at=CASE WHEN $3::boolean THEN COALESCE(first_contact_at,NOW()) ELSE first_contact_at END,updated_at=NOW() WHERE id=$4`,
      [b.nextFollowUpAt!==undefined,b.nextFollowUpAt||null,isContact,lead.id],client);
    await audit('Activity',id,'created',req.broker.id,{leadId:lead.id,type:row.activityType,firstContact:isContact},client);return row;
  });
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
