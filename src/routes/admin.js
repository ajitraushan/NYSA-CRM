import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth, requireRole, publicBroker } from '../auth.js';
import { JOB_ROLES } from '../crm-domain.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));
const ROLES = ['admin','internal_broker','partner_broker','viewer'];

r.get('/admin/invitations', async (req, res) => {
  const rows = await many(`SELECT i.*, b.name AS issued_by_name FROM invitations i
    JOIN brokers b ON b.id = i.issued_by ORDER BY i.created_at DESC`);
  res.json({ count:rows.length, invitations:rows });
});

r.post('/admin/invitations', async (req, res) => {
  const { issuedToEmail, role='internal_broker', jobRole, maxUses=1, expiresAt } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error:'Invalid role' });
  const resolvedJobRole = role === 'admin' ? 'admin' : role === 'internal_broker' ? (jobRole || 'sales_agent') : null;
  if (resolvedJobRole && !JOB_ROLES.includes(resolvedJobRole)) return res.status(400).json({ error:'Invalid jobRole' });
  if (!Number.isInteger(+maxUses) || +maxUses < 1) return res.status(400).json({ error:'maxUses must be a positive integer' });
  const id = uuid();
  const code = 'NYSA-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const invitation = await one(`INSERT INTO invitations
    (id,code,issued_by,issued_to_email,role,job_role,max_uses,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id,code,req.broker.id,issuedToEmail||null,role,resolvedJobRole,+maxUses,expiresAt||null]);
  await audit('Invitation', id, 'created', req.broker.id, { role, jobRole:resolvedJobRole, issuedToEmail:issuedToEmail||null });
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
  const rows = await many('SELECT * FROM brokers ORDER BY joined_at DESC');
  res.json({ count:rows.length, brokers:rows.map(publicBroker) });
});

r.patch('/admin/brokers/:id', async (req, res) => {
  const broker = await one('SELECT * FROM brokers WHERE id=$1', [req.params.id]);
  if (!broker) return res.status(404).json({ error:'Broker not found' });
  const { role, status, canPost, teamId, jobTitle, jobRole } = req.body || {};
  if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error:'Invalid role' });
  if (jobRole !== undefined && jobRole !== null && !JOB_ROLES.includes(jobRole)) return res.status(400).json({ error:'Invalid jobRole' });
  if (status !== undefined && !['active','revoked'].includes(status)) return res.status(400).json({ error:'Invalid status' });
  if (teamId && !(await one('SELECT id FROM teams WHERE id=$1 AND active=1', [teamId]))) return res.status(400).json({ error:'Invalid teamId' });
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
    }
    if (jobTitle !== undefined && (jobTitle || null) !== broker.jobTitle) {
      changes.jobTitle = { from:broker.jobTitle, to:jobTitle||null };
      await execute('UPDATE brokers SET job_title=$1 WHERE id=$2', [jobTitle||null,broker.id], client);
    }
    if (jobRole !== undefined && (jobRole || null) !== broker.jobRole) {
      changes.jobRole = { from:broker.jobRole, to:jobRole||null };
      await execute('UPDATE brokers SET job_role=$1 WHERE id=$2', [jobRole||null,broker.id], client);
    }
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
