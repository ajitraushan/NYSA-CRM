import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
};

for (const key of ['database', 'user', 'password']) {
  if (!config[key]) throw new Error(`Missing PostgreSQL configuration: PG${key.toUpperCase()}`);
}

export const db = new Pool(config);

const camel = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const camelRow = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value]));

export async function many(sql, params = [], client = db) {
  const result = await client.query(sql, params);
  return result.rows.map(camelRow);
}

export async function one(sql, params = [], client = db) {
  const result = await client.query(sql, params);
  return result.rows[0] ? camelRow(result.rows[0]) : undefined;
}

export async function execute(sql, params = [], client = db) {
  return client.query(sql, params);
}

export async function transaction(work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function uuid() { return crypto.randomUUID(); }

export async function audit(entityType, entityId, action, performedBy, details = null, client = db) {
  await client.query(
    'INSERT INTO audit_log (id, entity_type, entity_id, action, performed_by, details) VALUES ($1,$2,$3,$4,$5,$6)',
    [uuid(), entityType, entityId, action, performedBy, details ? JSON.stringify(details) : null]
  );
}

export async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const dir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  const applied = new Set((await db.query('SELECT version FROM schema_migrations')).rows.map(row => row.version));
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    await transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
  }
}

export async function closeDatabase() {
  await db.end();
}
