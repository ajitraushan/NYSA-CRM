import assert from 'node:assert/strict';
import {db,closeDatabase} from '../src/db.js';
import {assertDedicatedFixture} from './local-postgres-fixture/fixture-guard.mjs';
import {queueDefinition} from '../src/finance-workspace-domain.js';
await assertDedicatedFixture(db);
try{for(const category of ['invoice-awaiting','invoice-issued','invoice-changes','collection-unpaid','collection-part','collection-overdue','collection-paid','payout-prepare','payout-ready','payout-pending','payout-approved','payout-paid','statements','advice-generated','advice-pending','advice-failed']){
 const d=queueDefinition(category,{jobRole:'accountant',role:'internal_broker'});const result=await db.query(`SELECT COUNT(*) FROM (${d.sql}) queue`,d.params);assert.ok(Number(result.rows[0].count)>=0); await db.query(`SELECT * FROM (${d.sql}) queue WHERE (reference ILIKE '%synthetic%' OR COALESCE(to_jsonb(queue)->>'party','') ILIKE '%synthetic%') AND COALESCE(to_jsonb(queue)->>'date',to_jsonb(queue)->>'invoice_date')::date >= '2000-01-01'::date ORDER BY reference,id LIMIT 25`,d.params);console.log(category+': SQL contract passed');
}}finally{await closeDatabase();}
