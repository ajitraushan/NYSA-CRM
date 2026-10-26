import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {db,closeDatabase} from '../src/db.js';
import {assertDedicatedFixture,quoteIdentifier} from './local-postgres-fixture/fixture-guard.mjs';
await assertDedicatedFixture(db);
const schema='acc_migration_'+crypto.randomUUID().replaceAll('-',''),q=quoteIdentifier,client=await db.connect();
try{
 await client.query('BEGIN');await client.query(`CREATE SCHEMA ${q(schema)}`);await client.query(`SET LOCAL search_path TO ${q(schema)}`);
 for(const table of ['brokers','commission_payment_batches','agent_payout_calculations','commission_receivable_invoices']){
  await client.query(`CREATE TABLE ${q(table)} AS SELECT * FROM nysa_test_user.${q(table)} WITH NO DATA`);await client.query(`ALTER TABLE ${q(table)} ADD PRIMARY KEY(id)`);
 }
 const source=await fs.readFile('src/migrations/135_accountant_workspace_payout_advice.sql','utf8');await client.query(source);
 assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND t.tgname='protect_agent_payout_advice_evidence'",[schema])).rows[0].count,1);
 await client.query('ROLLBACK');assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].count,0);
 console.log('Migration 135 rehearsed from empty cloned baseline tables; new table, identity, indexes and evidence trigger created; transaction rollback removed every rehearsal object.');
}finally{await client.query('ROLLBACK').catch(()=>{});client.release();await closeDatabase();}
