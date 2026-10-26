import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const positiveInteger=(value,fallback,{minimum=1,maximum=Number.MAX_SAFE_INTEGER}={})=>{
  const parsed=Number(value);
  return Number.isInteger(parsed)&&parsed>=minimum&&parsed<=maximum?parsed:fallback;
};

export function buildPoolConfig(env=process.env){
  return {
    host: env.PGHOST || 'localhost',
    port: positiveInteger(env.PGPORT,5432,{maximum:65535}),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: positiveInteger(env.PGPOOL_MAX,3,{maximum:20}),
    idleTimeoutMillis: positiveInteger(env.PG_IDLE_TIMEOUT_MS,30000,{minimum:1000,maximum:300000}),
    connectionTimeoutMillis: positiveInteger(env.PG_CONNECTION_TIMEOUT_MS,10000,{minimum:1000,maximum:60000}),
    query_timeout: positiveInteger(env.PG_QUERY_TIMEOUT_MS,15000,{minimum:1000,maximum:120000}),
    statement_timeout: positiveInteger(env.PG_STATEMENT_TIMEOUT_MS,12000,{minimum:1000,maximum:120000}),
    idle_in_transaction_session_timeout: positiveInteger(env.PG_IDLE_TRANSACTION_TIMEOUT_MS,15000,{minimum:1000,maximum:120000}),
    maxLifetimeSeconds: positiveInteger(env.PG_CONNECTION_MAX_LIFETIME_SECONDS,300,{minimum:30,maximum:3600}),
    maxUses: positiveInteger(env.PG_CONNECTION_MAX_USES,1000,{minimum:10,maximum:100000}),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
  };
}

const config = buildPoolConfig();

for (const key of ['database', 'user', 'password']) {
  if (!config[key]) throw new Error(`Missing PostgreSQL configuration: PG${key.toUpperCase()}`);
}

export const db = new Pool(config);
db.on('error',error=>console.error(JSON.stringify({component:'nysa-core-database',event:'idle-client-error',errorName:error?.name||'Error'})));

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

export async function checkDatabaseReadiness(client=db){
  const result=await client.query({text:'SELECT 1 AS database_ready',query_timeout:positiveInteger(process.env.PG_READINESS_TIMEOUT_MS,2000,{minimum:250,maximum:10000})});
  return Number(result.rows?.[0]?.database_ready)===1;
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
