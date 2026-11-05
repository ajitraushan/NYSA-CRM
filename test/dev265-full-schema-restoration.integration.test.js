import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { compareSchemaContracts, loadSchemaContract, readDatabaseSchemaContract } from '../tools/database-schema-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const enabled = process.env.NYSA_RUN_DB_INTEGRATION === '1';
const gate = { skip: enabled ? false : 'Set NYSA_RUN_DB_INTEGRATION=1 inside the disposable PostgreSQL fixture', timeout: 120000 };
const id = (suffix) => `d2651000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

test('DEV265 exact drift restoration, audit actor, idempotency and cascade contract', gate, async () => {
  assert.equal(process.env.PGDATABASE, 'nysa_test_fixture');
  assert.equal(process.env.PGUSER, 'nysa_test_user');
  const pool = new pg.Pool({ max: 1 });
  const client = await pool.connect();
  try {
    const canonical = loadSchemaContract(path.join(root, 'src', 'database-schema-contract'), path.join(root, 'src', 'database-trigger-contract.json'));
    const comparison = compareSchemaContracts(canonical, await readDatabaseSchemaContract(client));
    assert.equal(comparison.matches, true, JSON.stringify(comparison));
    const ledger = (await client.query(`SELECT COUNT(*)::int count,MAX(version) latest FROM schema_migrations`)).rows[0];
    assert.deepEqual(ledger, { count: 169, latest: '169_restore_full_schema_contract.sql' });
    const orphans = (await client.query(`SELECT
      (SELECT COUNT(*)::int FROM wa_conversation_messages m WHERE m.simulated AND NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=m.conversation_id)) messages,
      (SELECT COUNT(*)::int FROM wa_inbox_notifications n WHERE NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=n.conversation_id)) notifications`)).rows[0];
    assert.deepEqual(orphans, { messages: 0, notifications: 0 });
    const audit = (await client.query(`SELECT performed_by,details::jsonb details FROM audit_log WHERE action='uat264_simulator_orphan_cleanup'`)).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].performed_by, 'd2650000-0000-4000-8000-000000000001');
    assert.deepEqual(audit[0].details, {
      approval: 'Ajit 5 Nov 2026', messages: 12, notifications: 5,
      reason: 'UAT264 simulator orphans removed for FK restoration',
    });

    const migration = await fs.readFile(path.join(root, 'src', 'migrations', '169_restore_full_schema_contract.sql'), 'utf8');
    await client.query('BEGIN');
    const beforeAudit = Number((await client.query(`SELECT COUNT(*) count FROM audit_log WHERE action='uat264_simulator_orphan_cleanup'`)).rows[0].count);
    await client.query(migration);
    const afterAudit = Number((await client.query(`SELECT COUNT(*) count FROM audit_log WHERE action='uat264_simulator_orphan_cleanup'`)).rows[0].count);
    assert.equal(afterAudit, beforeAudit);
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    await client.query(`INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)`, [id(1), 'DEV265 cascade team', audit[0].performed_by]);
    await client.query(`INSERT INTO wa_conversations
      (id,conversation_reference,normalized_phone,display_name,source_type,owner_team_id,owner_agent_id,simulated)
      VALUES($1,'DEV265-CASCADE-1','+971509999901','DEV265 cascade customer','other',$2,$3,TRUE)`,
    [id(2), id(1), audit[0].performed_by]);
    await client.query(`INSERT INTO wa_conversation_messages(id,conversation_id,direction,message_type,occurred_at,retention_expires_at,simulated)
      VALUES($1,$2,'inbound','text',NOW(),NOW()+INTERVAL '12 months',TRUE)`, [id(3), id(2)]);
    await client.query(`INSERT INTO wa_inbox_notifications(id,conversation_id,broker_id,notification_type)
      VALUES($1,$2,$3,'new_message')`, [id(4), id(2), audit[0].performed_by]);
    await client.query(`DELETE FROM wa_conversations WHERE id=$1`, [id(2)]);
    const cascaded = (await client.query(`SELECT
      (SELECT COUNT(*)::int FROM wa_conversation_messages WHERE id=$1) messages,
      (SELECT COUNT(*)::int FROM wa_inbox_notifications WHERE id=$2) notifications`, [id(3), id(4)])).rows[0];
    assert.deepEqual(cascaded, { messages: 0, notifications: 0 });
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
});

test('DEV265 preflight rejects any schema state other than the exact baseline or canonical contract', gate, async () => {
  const pool = new pg.Pool({ max: 1 });
  const client = await pool.connect();
  try {
    const migration = await fs.readFile(path.join(root, 'src', 'migrations', '169_restore_full_schema_contract.sql'), 'utf8');
    await client.query('BEGIN');
    await client.query('ALTER TABLE comments DROP CONSTRAINT comments_pkey CASCADE');
    await assert.rejects(client.query(migration), /approved pre-migration baseline constraints contract mismatch/);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
});
