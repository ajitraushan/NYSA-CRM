import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { one, execute, transaction, uuid, audit } from '../db.js';
import { hashPassword, verifyPassword, createSession, destroySession, requireAuth, publicBroker } from '../auth.js';

const r = Router();

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

r.get('/health', async (req, res) => {
  await one('SELECT 1 AS database_ready');
  res.json({ ok: true, database: 'ready' });
});

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (process.env.TRUST_PROXY === '1' && forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(key) {
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || now - item.startedAt > WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  item.count++;
  return item.count <= MAX_ATTEMPTS;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `nysa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'nysa_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

function validBootstrapKey(provided) {
  const expected = process.env.BOOTSTRAP_KEY || '';
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  return b.length >= 24 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

r.get('/auth/setup-status', async (req, res) => {
  const needsSetup = Number((await one('SELECT COUNT(*) AS n FROM brokers')).n) === 0;
  res.json({ needsSetup, setupEnabled: Boolean(process.env.BOOTSTRAP_KEY) });
});

r.post('/auth/setup', async (req, res) => {
  if (Number((await one('SELECT COUNT(*) AS n FROM brokers')).n) !== 0)
    return res.status(409).json({ error: 'Initial setup has already been completed' });
  const { bootstrapKey, name, email, phone, password } = req.body || {};
  if (!process.env.BOOTSTRAP_KEY) return res.status(503).json({ error: 'Initial setup is not enabled' });
  if (!validBootstrapKey(bootstrapKey)) return res.status(403).json({ error: 'Invalid setup key' });
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (String(password).length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });

  const id = uuid();
  await transaction(async (client) => {
    await execute(`INSERT INTO brokers (id, name, email, phone, brokerage, role, job_role, can_post, password_hash)
                   VALUES ($1,$2,$3,$4,$5,'admin','admin',1,$6)`,
      [id, name.trim(), email.trim().toLowerCase(), phone || null, 'Nysa Realty', hashPassword(password)], client);
    await audit('Broker', id, 'initial_admin_created', id, null, client);
  });

  const token = await createSession(id);
  setSessionCookie(res, token);
  res.status(201).json({ broker: publicBroker(await one('SELECT * FROM brokers WHERE id = $1', [id])) });
});

async function validInvite(code) {
  const inv = await one('SELECT * FROM invitations WHERE code = $1', [code]);
  if (!inv) return { error: 'Invalid invitation code' };
  if (inv.status !== 'active') return { error: `Invitation is ${inv.status}` };
  if (inv.expiresAt && new Date(inv.expiresAt) <= new Date())
    return { error: 'Invitation has expired' };
  if (inv.usedCount >= inv.maxUses) return { error: 'Invitation has already been used' };
  return { inv };
}

// Validate an invite code and start registration
r.post('/auth/redeem-invite', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code is required' });
  const { inv, error } = await validInvite(code.trim());
  if (error) return res.status(400).json({ error });
  res.json({ valid: true, issuedToEmail: inv.issuedToEmail, role: inv.role, jobRole: inv.jobRole });
});

// Complete registration
r.post('/auth/register', async (req, res) => {
  const { code, name, email, phone, brokerage, password } = req.body || {};
  if (!code || !name || !email || !password)
    return res.status(400).json({ error: 'code, name, email and password are required' });
  if (String(password).length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  const { inv, error } = await validInvite(code.trim());
  if (error) return res.status(400).json({ error });
  if (inv.issuedToEmail && inv.issuedToEmail.toLowerCase() !== email.toLowerCase())
    return res.status(400).json({ error: 'This invitation is scoped to a different email address' });
  if (await one('SELECT id FROM brokers WHERE LOWER(email) = LOWER($1)', [email]))
    return res.status(409).json({ error: 'An account with this email already exists' });

  const id = uuid();
  await transaction(async (client) => {
    const consumed = await one(`UPDATE invitations
      SET used_count = used_count + 1,
          status = CASE WHEN used_count + 1 >= max_uses THEN 'expired' ELSE status END
      WHERE id = $1 AND status = 'active' AND used_count < max_uses
      RETURNING id`, [inv.id], client);
    if (!consumed) throw new Error('Invitation is no longer available');
    await execute(`INSERT INTO brokers (id, name, email, phone, brokerage, role, job_role, can_post, password_hash, invited_by)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, name.trim(), email.trim(), phone || null, brokerage || null, inv.role,
       inv.jobRole || (inv.role === 'admin' ? 'admin' : inv.role === 'internal_broker' ? 'sales_agent' : null),
       inv.role === 'partner_broker' ? 0 : 1, hashPassword(password), inv.issuedBy], client);
    await audit('Broker', id, 'registered', id, { via_invitation: inv.id }, client);
  });

  const token = await createSession(id);
  setSessionCookie(res, token);
  res.status(201).json({ broker: publicBroker(await one('SELECT * FROM brokers WHERE id = $1', [id])) });
});

r.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const key = `${clientIp(req)}:${String(email).toLowerCase()}`;
  if (!checkRateLimit(key)) return res.status(429).json({ error: 'Too many attempts; try again later' });
  const broker = await one('SELECT * FROM brokers WHERE LOWER(email) = LOWER($1)', [email]);
  if (!broker || !verifyPassword(password, broker.passwordHash))
    return res.status(401).json({ error: 'Invalid email or password' });
  if (broker.status !== 'active') return res.status(403).json({ error: 'Access has been revoked' });
  const token = await createSession(broker.id);
  setSessionCookie(res, token);
  res.json({ broker: publicBroker(broker) });
});

r.post('/auth/logout', requireAuth, async (req, res) => {
  await destroySession(req.token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => res.json(publicBroker(req.broker)));

export default r;
