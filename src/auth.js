import crypto from 'node:crypto';
import { execute, one } from './db.js';

const SESSION_HOURS = 24 * 7;

function sessionHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(hash, 'hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  return expectedBuffer.length === candidateBuffer.length && crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

export async function createSession(brokerId) {
  const token = crypto.randomBytes(32).toString('hex');
  await execute('DELETE FROM sessions WHERE expires_at <= NOW()');
  await execute("INSERT INTO sessions (token, broker_id, expires_at) VALUES ($1,$2,NOW() + ($3 * INTERVAL '1 hour'))",
    [sessionHash(token), brokerId, SESSION_HOURS]);
  return token;
}

export async function destroySession(token) {
  await execute('DELETE FROM sessions WHERE token = $1', [sessionHash(token)]);
}

// --- middleware ---

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookie = req.headers.cookie?.match(/(?:^|;\s*)nysa_session=([^;]+)/)?.[1];
  const presented = cookie || token;
  if (!presented) return res.status(401).json({ error: 'Authentication required' });
  const row = await one(`
    SELECT b.* FROM sessions s JOIN brokers b ON b.id = s.broker_id
    WHERE s.token = $1 AND s.expires_at > NOW()`, [sessionHash(decodeURIComponent(presented))]);
  if (!row) return res.status(401).json({ error: 'Invalid or expired session' });
  if (row.status !== 'active') return res.status(403).json({ error: 'Access revoked' });
  req.broker = row;
  req.token = decodeURIComponent(presented);
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.broker.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// Posting: admin & internal always; partner only if canPost; viewer never.
export function requirePostRights(req, res, next) {
  const b = req.broker;
  const ok = b.role === 'admin' || b.role === 'internal_broker' ||
             (b.role === 'partner_broker' && b.canPost === 1);
  if (!ok) return res.status(403).json({ error: 'You do not have posting rights' });
  next();
}

export function notViewer(req, res, next) {
  if (req.broker.role === 'viewer') return res.status(403).json({ error: 'Viewers cannot perform this action' });
  next();
}

export function publicBroker(b) {
  const { passwordHash, ...rest } = b;
  return rest;
}
