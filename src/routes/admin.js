import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth, publicBroker,hashPassword } from '../auth.js';
import { JOB_ROLES } from '../crm-domain.js';

const r = Router();
r.use(requireAuth,(req,res,next)=>(req.broker.role==='admin'||req.broker.jobRole==='admin_assistant')?next():res.status(403).json({error:'Administrator or Admin Assistant access required'}));
const ROLES = ['admin','internal_broker','partner_broker','viewer'];
const privileged=role=>['admin','director'].includes(role);
const canMaintain=(req,jobRole)=>req.broker.role==='admin'||!privileged(jobRole);
const teamManager=async(teamId,client)=>teamId?one(`SELECT t.id,t.name,t.manager_id,b.name AS manager_name FROM teams t LEFT JOIN brokers b ON b.id=t.manager_id WHERE t.id=$1 AND t.active=1`,[teamId],client):null;
async function syncManagerAssignment(teamId,brokerId,actorId,client){
  await execute('UPDATE teams SET manager_id=$1 WHERE id=$2',[brokerId,teamId],client);
  await execute("UPDATE team_memberships SET membership_role='member' WHERE team_id=$1 AND broker_id<>$2 AND membership_role='manager' AND ends_at IS NULL",[teamId,brokerId],client);
  await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'manager',$4)
    ON CONFLICT (team_id,broker_id) WHERE ends_at IS NULL DO UPDATE SET membership_role='manager'`,[uuid(),teamId,brokerId,actorId],client);
}

r.get('/admin/invitations', async (req, res) => {
  const rows = await many(`SELECT i.*, b.name AS issued_by_name FROM invitations i
    JOIN brokers b ON b.id = i.issued_by ORDER BY i.created_at DESC`);
  res.json({ count:rows.length, invitations:rows });
});

r.post('/admin/invitations', async (req, res) => {
  const { issuedToEmail, role='internal_broker', jobRole, expiresAt,teamId } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error:'Invalid role' });
  const resolvedJobRole = role === 'admin' ? 'admin' : role === 'internal_broker' ? (jobRole || 'sales_agent') : null;
  if (resolvedJobRole && !JOB_ROLES.includes(resolvedJobRole)) return res.status(400).json({ error:'Invalid jobRole' });
  if (!issuedToEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issuedToEmail)) return res.status(400).json({ error:'A valid named user email is required' });
  if(!canMaintain(req,resolvedJobRole))return res.status(403).json({error:'Admin Assistant cannot appoint Administrator or Director access'});
  if(['sales_agent','listing_agent','manager'].includes(resolvedJobRole)&&!teamId)return res.status(400).json({error:'Team is required for this user role'});
  if(teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[teamId])))return res.status(400).json({error:'Active team not found'});
  if(resolvedJobRole==='manager'){const team=await teamManager(teamId);if(team?.managerId)return res.status(409).json({error:`${team.name} is already managed by ${team.managerName}. Change its manager deliberately in Team maintenance.`});}
  const id = uuid();
  const code = 'NYSA-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const invitation = await one(`INSERT INTO invitations
    (id,code,issued_by,issued_to_email,role,job_role,max_uses,expires_at,team_id) VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8) RETURNING *`,
    [id,code,req.broker.id,issuedToEmail.toLowerCase(),role,resolvedJobRole,expiresAt||null,teamId||null]);
  await audit('Invitation', id, 'created', req.broker.id, { role, jobRole:resolvedJobRole, issuedToEmail,teamId:teamId||null });
  res.status(201).json(invitation);
});

r.delete('/admin/invitations/:id', async (req, res) => {
  const invitation = await one('SELECT * FROM invitations WHERE id=$1', [req.params.id]);
  if (!invitation) return res.status(404).json({ error:'Invitation not found' });
  await execute("UPDATE invitations SET status='revoked' WHERE id=$1", [invitation.id]);
  await audit('Invitation', invitation.id, 'revoked', req.broker.id);
  res.json({ ok:true });
});

r.get('/admin/brokers', async (req, res) => {
  const rows = await many(`SELECT b.*,t.manager_id AS reporting_manager_id,m.name AS reporting_manager_name,d.name AS direct_supervisor_name,(SELECT COALESCE(json_agg(json_build_object('id',mt.id,'name',mt.name) ORDER BY mt.name),'[]') FROM teams mt WHERE mt.manager_id=b.id AND mt.active=1) AS managed_teams,(SELECT COALESCE(json_agg(json_build_object(
    'id',r.id,'jobRole',r.job_role,'teamId',r.team_id,'isPrimary',r.is_primary=1,
    'status',r.status,'startsAt',r.starts_at,'endsAt',r.ends_at,'changeReason',r.change_reason
  ) ORDER BY r.is_primary DESC,r.starts_at),'[]') FROM user_role_assignments r WHERE r.broker_id=b.id) AS role_assignments FROM brokers b LEFT JOIN teams t ON t.id=b.team_id LEFT JOIN brokers m ON m.id=t.manager_id LEFT JOIN brokers d ON d.id=b.reports_to_id ORDER BY b.joined_at DESC`);
  res.json({ count:rows.length, brokers:rows.map(publicBroker) });
});

r.get('/admin/password-reset-requests',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
  await execute("UPDATE password_reset_requests SET status='expired',code_hash=NULL WHERE status='issued' AND expires_at<=NOW()");
  const requests=await many(`SELECT pr.id,pr.status,pr.requested_at,pr.issued_at,pr.expires_at,b.id AS broker_id,b.name,b.email,issuer.name AS issued_by_name
    FROM password_reset_requests pr JOIN brokers b ON b.id=pr.broker_id LEFT JOIN brokers issuer ON issuer.id=pr.issued_by
    WHERE pr.status IN ('pending','issued') ORDER BY pr.requested_at DESC`);
  res.json({count:requests.length,requests});
});

r.post('/admin/password-reset-requests/:id/issue',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
  const code=`NYSA-RST-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,codeHash=crypto.createHash('sha256').update(code).digest('hex');
  const request=await transaction(async client=>{
    const row=await one(`SELECT pr.*,b.status AS broker_status FROM password_reset_requests pr JOIN brokers b ON b.id=pr.broker_id
      WHERE pr.id=$1 AND pr.status IN ('pending','issued') FOR UPDATE OF pr`,[req.params.id],client);
    if(!row||row.brokerStatus!=='active')return null;
    await execute("UPDATE password_reset_requests SET status='issued',issued_by=$1,code_hash=$2,issued_at=NOW(),expires_at=NOW()+INTERVAL '30 minutes' WHERE id=$3",[req.broker.id,codeHash,row.id],client);
    await audit('Broker',row.brokerId,'password_reset_code_issued',req.broker.id,{resetRequestId:row.id,expiresInMinutes:30},client);
    return row;
  });
  if(!request)return res.status(404).json({error:'Open password reset request not found'});
  res.json({ok:true,code,expiresInMinutes:30});
});

r.delete('/admin/password-reset-requests/:id',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator access required'});
  const request=await one("UPDATE password_reset_requests SET status='cancelled',code_hash=NULL WHERE id=$1 AND status IN ('pending','issued') RETURNING *",[req.params.id]);
  if(!request)return res.status(404).json({error:'Open password reset request not found'});
  await audit('Broker',request.brokerId,'password_reset_cancelled',req.broker.id,{resetRequestId:request.id});
  res.json({ok:true});
});

r.post('/admin/users',async(req,res)=>{
  const b=req.body||{},email=String(b.email||'').trim().toLowerCase(),classification=b.userClassification||'internal_user',assignments=Array.isArray(b.roleAssignments)?b.roleAssignments:[];
  if(!String(b.name||'').trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['internal_user','viewer','external_broker'].includes(classification))return res.status(400).json({error:'Name, valid email and user classification are required'});
  if(await one('SELECT id FROM brokers WHERE LOWER(email)=LOWER($1)',[email]))return res.status(409).json({error:'A user with this email already exists'});
  if(classification==='internal_user'&&(!assignments.length||assignments.filter(x=>x.isPrimary).length!==1))return res.status(400).json({error:'Internal users require exactly one primary role'});
  if(classification!=='internal_user'&&assignments.length)return res.status(400).json({error:'Role assignments apply only to internal users'});
  if(assignments.some(x=>!JOB_ROLES.includes(x.jobRole)||!canMaintain(req,x.jobRole)))return res.status(403).json({error:'One or more role assignments are invalid or outside your authority'});
  for(const a of assignments){if(['sales_agent','listing_agent','manager'].includes(a.jobRole)&&!a.teamId)return res.status(400).json({error:`Team is required for ${a.jobRole}`});if(a.teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[a.teamId])))return res.status(400).json({error:'One or more assigned teams are unavailable'});}
  for(const a of assignments.filter(x=>x.jobRole==='manager')){const team=await teamManager(a.teamId);if(team?.managerId)return res.status(409).json({error:`${team.name} is already managed by ${team.managerName}. Change its manager deliberately in Team maintenance.`});}
  const primary=assignments.find(x=>x.isPrimary),role=classification==='viewer'?'viewer':classification==='external_broker'?'partner_broker':primary?.jobRole==='admin'?'admin':'internal_broker',status=classification==='external_broker'?'revoked':'pending_activation',id=uuid(),code='NYSA-'+crypto.randomBytes(8).toString('hex').toUpperCase();
  const result=await transaction(async client=>{
    const user=await one(`INSERT INTO brokers(id,name,email,role,job_role,team_id,status,password_hash,invited_by,user_classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,String(b.name).trim(),email,role,primary?.jobRole||null,primary?.teamId||null,status,hashPassword(crypto.randomBytes(32).toString('hex')),req.broker.id,classification],client);
    for(const a of assignments){await execute(`INSERT INTO user_role_assignments(id,broker_id,job_role,team_id,is_primary,status,starts_at,ends_at,approved_by,change_reason) VALUES($1,$2,$3,$4,$5,'active',COALESCE($6,NOW()),$7,$8,$9)`,[uuid(),id,a.jobRole,a.teamId||null,a.isPrimary?1:0,a.startsAt||null,a.endsAt||null,req.broker.id,String(a.changeReason||'Initial approved role').trim()],client);if(a.teamId){if(a.jobRole==='manager')await syncManagerAssignment(a.teamId,id,req.broker.id,client);else await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4)`,[uuid(),a.teamId,id,req.broker.id],client);}}
    if(classification!=='external_broker')await execute(`INSERT INTO invitations(id,code,issued_by,issued_to_email,role,job_role,max_uses,expires_at,team_id,pending_broker_id) VALUES($1,$2,$3,$4,$5,$6,1,NOW()+INTERVAL '7 days',$7,$8)`,[uuid(),code,req.broker.id,email,role,primary?.jobRole||null,primary?.teamId||null,id],client);
    await audit('Broker',id,'user_added',req.broker.id,{classification,status,roles:assignments},client);return user;
  });
  res.status(201).json({user:publicBroker(result),activationCode:classification==='external_broker'?null:code});
});

r.post('/admin/users/:id/roles',async(req,res)=>{
  const target=await one('SELECT * FROM brokers WHERE id=$1',[req.params.id]),b=req.body||{},reason=String(b.changeReason||'').trim();
  if(!target)return res.status(404).json({error:'User not found'});
  if(!JOB_ROLES.includes(b.jobRole)||!canMaintain(req,b.jobRole)||!reason)return res.status(400).json({error:'Valid role and change reason are required'});
  if(['sales_agent','listing_agent','manager'].includes(b.jobRole)&&!b.teamId)return res.status(400).json({error:'Team is required for this role'});
  if(b.teamId&&!(await one('SELECT id FROM teams WHERE id=$1 AND active=1',[b.teamId])))return res.status(400).json({error:'Active team not found'});
  if(b.jobRole==='manager'){const team=await teamManager(b.teamId);if(team?.managerId&&team.managerId!==target.id)return res.status(409).json({error:`${team.name} is already managed by ${team.managerName}. Change its manager deliberately in Team maintenance.`});}
  const row=await transaction(async client=>{
    if(b.isPrimary)await execute("UPDATE user_role_assignments SET is_primary=0 WHERE broker_id=$1 AND status='active'",[target.id],client);
    const created=await one(`INSERT INTO user_role_assignments(id,broker_id,job_role,team_id,is_primary,status,starts_at,ends_at,approved_by,change_reason) VALUES($1,$2,$3,$4,$5,'active',COALESCE($6,NOW()),$7,$8,$9) RETURNING *`,[uuid(),target.id,b.jobRole,b.teamId||null,b.isPrimary?1:0,b.startsAt||null,b.endsAt||null,req.broker.id,reason],client);
    if(b.teamId){if(b.jobRole==='manager')await syncManagerAssignment(b.teamId,target.id,req.broker.id,client);else await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4) ON CONFLICT (team_id,broker_id) WHERE ends_at IS NULL DO UPDATE SET membership_role='member'`,[uuid(),b.teamId,target.id,req.broker.id],client);}
    if(b.isPrimary)await execute('UPDATE brokers SET job_role=$1,team_id=$2,updated_at=NOW() WHERE id=$3',[b.jobRole,b.teamId||null,target.id],client);
    await audit('Broker',target.id,'role_assigned',req.broker.id,{roleAssignmentId:created.id,jobRole:b.jobRole,teamId:b.teamId||null},client);return created;
  });
  res.status(201).json(row);
});
r.post('/admin/users/:id/access',async(req,res)=>{const target=await one('SELECT * FROM brokers WHERE id=$1',[req.params.id]),action=req.body?.action,reason=String(req.body?.reason||'').trim();if(!target)return res.status(404).json({error:'User not found'});if(target.id===req.broker.id)return res.status(400).json({error:'You cannot change your own access state'});if(!canMaintain(req,target.jobRole))return res.status(403).json({error:'This user is outside your maintenance authority'});if(!['suspend','reactivate','revoke'].includes(action)||!reason)return res.status(400).json({error:'Valid action and reason are required'});const status=action==='reactivate'?'active':action==='suspend'?'suspended':'revoked';await transaction(async client=>{await execute(`UPDATE brokers SET status=$1,suspended_at=CASE WHEN $1='suspended' THEN NOW() ELSE suspended_at END,revoked_at=CASE WHEN $1='revoked' THEN NOW() ELSE revoked_at END,access_change_reason=$2,updated_at=NOW() WHERE id=$3`,[status,reason,target.id],client);if(status!=='active')await execute('DELETE FROM sessions WHERE broker_id=$1',[target.id],client);await audit('Broker',target.id,action,req.broker.id,{reason},client);});res.json({ok:true,status});});

r.patch('/admin/brokers/:id', async (req, res) => {
  const broker = await one('SELECT * FROM brokers WHERE id=$1', [req.params.id]);
  if (!broker) return res.status(404).json({ error:'Broker not found' });
  const { role, status, canPost, teamId, jobTitle, jobRole,reportsToId } = req.body || {};
  if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error:'Invalid role' });
  if (jobRole !== undefined && jobRole !== null && !JOB_ROLES.includes(jobRole)) return res.status(400).json({ error:'Invalid jobRole' });
  if (status !== undefined && !['pending_activation','active','suspended','revoked'].includes(status)) return res.status(400).json({ error:'Invalid status' });
  if (req.broker.role !== 'admin' && (!canMaintain(req,broker.jobRole) || (jobRole && !canMaintain(req,jobRole)) || role === 'admin' || status !== undefined)) return res.status(403).json({ error:'Admin Assistant cannot alter privileged roles or access status' });
  if (teamId && !(await one('SELECT id FROM teams WHERE id=$1 AND active=1', [teamId]))) return res.status(400).json({ error:'Invalid teamId' });
  const nextJobRole=jobRole===undefined?broker.jobRole:jobRole||null,nextTeamId=teamId===undefined?broker.teamId:teamId||null;
  if(reportsToId!==undefined&&nextJobRole!=='manager')return res.status(400).json({error:'Only a Manager can have a maintained Director reporting line'});
  if(reportsToId&&!(await one("SELECT id FROM brokers WHERE id=$1 AND role='internal_broker' AND job_role='director' AND status='active'",[reportsToId])))return res.status(400).json({error:'Select an active Managing Director'});
  if(nextJobRole==='manager'&&!nextTeamId)return res.status(400).json({error:'Team is required for a Manager'});
  if(nextJobRole==='manager'){const team=await teamManager(nextTeamId);if(team?.managerId&&team.managerId!==broker.id)return res.status(409).json({error:`${team.name} is already managed by ${team.managerName}. Change its manager deliberately in Team maintenance.`});}
  if (broker.id === req.broker.id && role !== undefined && role !== 'admin') return res.status(400).json({ error:'You cannot demote yourself' });
  if (broker.id === req.broker.id && status === 'revoked') return res.status(400).json({ error:'You cannot revoke yourself' });
  const changes = {};
  await transaction(async (client) => {
    if (role !== undefined && role !== broker.role) {
      changes.role = { from:broker.role, to:role };
      const defaultJobRole = role === 'admin' ? 'admin' : role === 'internal_broker' ? (jobRole || broker.jobRole || 'sales_agent') : null;
      await execute('UPDATE brokers SET role=$1,job_role=$2,team_id=CASE WHEN $1 IN (\'admin\',\'internal_broker\') THEN team_id ELSE NULL END WHERE id=$3', [role,defaultJobRole,broker.id], client);
    }
    if (canPost !== undefined && (canPost ? 1 : 0) !== broker.canPost) {
      changes.canPost = { from:broker.canPost, to:canPost?1:0 };
      await execute('UPDATE brokers SET can_post=$1 WHERE id=$2', [canPost?1:0,broker.id], client);
    }
    if (status !== undefined && status !== broker.status) {
      changes.status = { from:broker.status, to:status };
      await execute('UPDATE brokers SET status=$1 WHERE id=$2', [status,broker.id], client);
      if (status === 'revoked') await execute('DELETE FROM sessions WHERE broker_id=$1', [broker.id], client);
    }
    if (teamId !== undefined && (teamId || null) !== broker.teamId) {
      changes.teamId = { from:broker.teamId, to:teamId||null };
      await execute('UPDATE brokers SET team_id=$1 WHERE id=$2', [teamId||null,broker.id], client);
      await execute('UPDATE team_memberships SET ends_at=NOW() WHERE broker_id=$1 AND ends_at IS NULL',[broker.id],client);
      if(teamId) await execute(`INSERT INTO team_memberships (id,team_id,broker_id,membership_role,created_by)
        VALUES ($1,$2,$3,$4,$5)`,[uuid(),teamId,broker.id,(jobRole||broker.jobRole)==='manager'?'manager':'member',req.broker.id],client);
    }
    if (jobTitle !== undefined && (jobTitle || null) !== broker.jobTitle) {
      changes.jobTitle = { from:broker.jobTitle, to:jobTitle||null };
      await execute('UPDATE brokers SET job_title=$1 WHERE id=$2', [jobTitle||null,broker.id], client);
    }
    if (jobRole !== undefined && (jobRole || null) !== broker.jobRole) {
      changes.jobRole = { from:broker.jobRole, to:jobRole||null };
      await execute('UPDATE brokers SET job_role=$1 WHERE id=$2', [jobRole||null,broker.id], client);
    }
    if(reportsToId!==undefined&&(reportsToId||null)!==broker.reportsToId){changes.reportsToId={from:broker.reportsToId,to:reportsToId||null};await execute('UPDATE brokers SET reports_to_id=$1 WHERE id=$2',[reportsToId||null,broker.id],client);}
    if(nextJobRole!=='manager'&&broker.reportsToId)await execute('UPDATE brokers SET reports_to_id=NULL WHERE id=$1',[broker.id],client);
    if(teamId!==undefined||jobRole!==undefined)await execute(`UPDATE user_role_assignments SET job_role=$1,team_id=$2 WHERE broker_id=$3 AND is_primary=1 AND status='active'`,[nextJobRole,nextTeamId,broker.id],client);
    await execute(`UPDATE teams t SET manager_id=NULL WHERE t.manager_id=$1 AND (t.id<>$2 OR $3 IS DISTINCT FROM 'manager') AND NOT EXISTS(
      SELECT 1 FROM user_role_assignments r WHERE r.broker_id=$1 AND r.team_id=t.id AND r.job_role='manager' AND r.is_primary=0 AND r.status='active' AND r.ends_at IS NULL)`,[broker.id,nextTeamId,nextJobRole],client);
    if(nextTeamId&&nextJobRole==='manager')await syncManagerAssignment(nextTeamId,broker.id,req.broker.id,client);
    else if(nextTeamId)await execute("UPDATE team_memberships SET membership_role='member' WHERE team_id=$1 AND broker_id=$2 AND ends_at IS NULL",[nextTeamId,broker.id],client);
    if (Object.keys(changes).length) await audit('Broker', broker.id, 'edited', req.broker.id, changes, client);
  });
  res.json(publicBroker(await one('SELECT * FROM brokers WHERE id=$1', [broker.id])));
});

r.get('/admin/audit-log', async (req, res) => {
  const { entityType, entityId, performedBy, from, to } = req.query;
  const where = ['1=1'], params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
  if (entityType) add('a.entity_type = ?', entityType);
  if (entityId) add('a.entity_id = ?', entityId);
  if (performedBy) add('a.performed_by = ?', performedBy);
  if (from) add('a.timestamp >= ?', from);
  if (to) add('a.timestamp <= ?', to);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 1000));
  params.push(limit);
  const rows = await many(`SELECT a.*, b.name AS performed_by_name FROM audit_log a
    JOIN brokers b ON b.id = a.performed_by WHERE ${where.join(' AND ')}
    ORDER BY a.timestamp DESC LIMIT $${params.length}`, params);
  res.json({ count:rows.length, entries:rows });
});

export default r;
