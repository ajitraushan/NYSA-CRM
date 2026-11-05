import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { compareSchemaContracts, loadSchemaContract, readDatabaseSchemaContract } from './database-schema-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required for the disposable fixture');
if (process.env.PGDATABASE !== 'nysa_test_fixture' || process.env.PGUSER !== 'nysa_test_user') {
  throw new Error('Refusing to operate outside nysa_test_fixture/nysa_test_user');
}

const pool = new pg.Pool({ max: 1 });
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const canonicalDir = path.join(root, 'src', 'database-schema-contract');
const baselineDir = path.join(root, 'src', 'database-schema-baseline');
const triggerFile = path.join(root, 'src', 'database-trigger-contract.json');
const canonical = loadSchemaContract(canonicalDir, triggerFile);
const baseline = loadSchemaContract(baselineDir, triggerFile);
const canonicalConstraints = new Set(canonical.constraints.map((entry) => `${entry.table}|${entry.name}|${entry.type}`));
const baselineConstraints = new Set(baseline.constraints.map((entry) => `${entry.table}|${entry.name}|${entry.type}`));
const baselineIndexes = new Set(baseline.indexes.map((entry) => `${entry.table}|${entry.name}`));
const missingConstraints = canonical.constraints.filter((entry) => !baselineConstraints.has(`${entry.table}|${entry.name}|${entry.type}`));
const standaloneIndexes = canonical.indexes.filter((entry) => !baselineIndexes.has(`${entry.table}|${entry.name}`))
  .filter((entry) => !missingConstraints.some((constraint) => ['p', 'u'].includes(constraint.type) && constraint.table === entry.table && constraint.name === entry.name));

const actor = 'd2650000-0000-4000-8000-000000000001';
const conversation = 'd2650000-0000-4000-8000-000000000002';
const id = (suffix) => `d2650000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const client = await pool.connect();
const pg16ConstraintDeparseDifferences = new Set([
  'agent_employment_versions|agent_employment_versions_reason_check|c',
  'leave_application_decisions|leave_application_decisions_reason_check|c',
  'leave_applications|leave_applications_reason_check|c',
  'leave_policy_versions|leave_policy_versions_reason_check|c',
  'leave_type_versions|leave_type_versions_reason_check|c',
]);
function matchesExceptPg16ConstraintDeparse(result) {
  return Object.entries(result).filter(([name]) => name !== 'matches').every(([name, value]) => {
    if (name !== 'constraints') return value.matches;
    return value.missing.length === 0 && value.extra.length === 0
      && value.changed.length === pg16ConstraintDeparseDifferences.size
      && value.changed.every((key) => pg16ConstraintDeparseDifferences.has(key));
  });
}
try {
  const identity = (await client.query(`SELECT current_database() database,current_user username,current_setting('server_version') version`)).rows[0];
  if (identity.database !== 'nysa_test_fixture' || identity.username !== 'nysa_test_user') throw new Error(`Fixture identity mismatch: ${JSON.stringify(identity)}`);
  const before = compareSchemaContracts(canonical, await readDatabaseSchemaContract(client));
  const pgMajor = Number.parseInt(identity.version, 10);
  if (!(before.matches || (pgMajor === 16 && matchesExceptPg16ConstraintDeparse(before)))) {
    throw new Error(`Fixture must start canonical: ${JSON.stringify(before)}`);
  }

  await client.query('BEGIN');
  for (const entry of missingConstraints.filter((item) => item.type === 'f')) {
    await client.query(`ALTER TABLE ${quote(entry.table)} DROP CONSTRAINT ${quote(entry.name)}`);
  }
  for (const entry of missingConstraints.filter((item) => ['p', 'u'].includes(item.type))) {
    await client.query(`ALTER TABLE ${quote(entry.table)} DROP CONSTRAINT ${quote(entry.name)}`);
  }
  for (const entry of standaloneIndexes) await client.query(`DROP INDEX ${quote(entry.name)}`);

  await client.query(`INSERT INTO brokers(id,name,email,role,status,password_hash)
    VALUES($1,'DEV265 retained audit actor','dev265-actor@example.invalid','internal_broker','active','fixture-only')`, [actor]);
  for (let index = 1; index <= 12; index += 1) {
    await client.query(`INSERT INTO wa_conversation_messages
      (id,conversation_id,direction,message_type,body,occurred_at,retention_expires_at,simulated,provider_message_id)
      VALUES($1,$2,'inbound','text',$3,NOW(),NOW()+INTERVAL '12 months',TRUE,$4)`,
    [id(100 + index), conversation, `DEV265 UAT264 orphan ${index}`, `dev265-orphan-${index}`]);
  }
  for (let index = 1; index <= 5; index += 1) {
    await client.query(`INSERT INTO wa_inbox_notifications(id,conversation_id,broker_id,notification_type)
      VALUES($1,$2,$3,'new_message')`, [id(200 + index), conversation, actor]);
  }
  await client.query('COMMIT');

  const after = compareSchemaContracts(baseline, await readDatabaseSchemaContract(client));
  if (!(after.matches || (pgMajor === 16 && matchesExceptPg16ConstraintDeparse(after)))) {
    throw new Error(`Generated drift differs from committed Step 3 baseline: ${JSON.stringify(after)}`);
  }
  const orphans = (await client.query(`SELECT
    (SELECT COUNT(*)::int FROM wa_conversation_messages m WHERE m.simulated AND NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=m.conversation_id)) messages,
    (SELECT COUNT(*)::int FROM wa_inbox_notifications n WHERE NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=n.conversation_id)) notifications`)).rows[0];
  if (orphans.messages !== 12 || orphans.notifications !== 5) throw new Error(`Orphan fixture mismatch: ${JSON.stringify(orphans)}`);
  process.stdout.write(`${JSON.stringify({ identity, dropped: { constraints: missingConstraints.length, standaloneIndexes: standaloneIndexes.length }, orphans, baselineMatches: true, pg16KnownConstraintDeparseDifferences: pgMajor === 16 ? [...pg16ConstraintDeparseDifferences] : [] }, null, 2)}\n`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
