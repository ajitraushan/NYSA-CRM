import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {compareDatabaseTriggerContract,normalizeExpectedTriggerContract} from '../tools/database-trigger-contract.mjs';
import {parsePgRestoreListContracts} from '../tools/crm-test-backup-verification.mjs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const contract=JSON.parse(read('src/database-trigger-contract.json'));

test('the cumulative release publishes the exact current migration trigger catalogue',()=>{
  assert.equal(contract.schema,'nysa.database-trigger-contract.v1');
  assert.equal(contract.generatedFrom.migrationCount,172);
  assert.equal(contract.generatedFrom.latestMigration,'172_prospect_tracking.sql');
  assert.equal(contract.triggerCount,113);
  assert.equal(contract.tableCount,96);
  assert.equal(contract.triggers.length,113);
  assert.equal(new Set(contract.triggers.map(item=>`${item.table}\0${item.name}`)).size,113);
  assert.equal(new Set(contract.triggers.map(item=>item.table)).size,96);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(contract.triggers)).digest('hex'),contract.canonicalSha256);
  for(const item of contract.triggers){
    assert.match(item.table,/^[a-z0-9_]+$/);
    assert.match(item.name,/^[a-z0-9_]+$/);
    assert.match(item.function,/^public\.[a-z0-9_]+$/);
    assert.ok(['BEFORE','AFTER','INSTEAD OF'].includes(item.timing));
    assert.ok(item.events.length>0);
    assert.match(item.sourceMigration,/^\d{3}_.+\.sql$/);
  }
  const leadReference=contract.triggers.find(item=>item.table==='leads'&&item.name==='leads_assign_reference');
  assert.equal(leadReference.function,'public.nysa_assign_lead_reference');
});

test('migration 168 restores triggers only, reconciles counters upward and verifies the full contract',()=>{
  const migration=read('src/migrations/168_restore_governed_trigger_contract.sql');
  assert.doesNotMatch(migration,/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
  assert.equal((migration.match(/DROP TRIGGER IF EXISTS/g)||[]).length,108);
  assert.equal((migration.match(/CREATE (?:CONSTRAINT )?TRIGGER/g)||[]).length,108);
  assert.match(migration,/GREATEST\(lead_month_number_counters\.last_value,EXCLUDED\.last_value\)/);
  assert.match(migration,/WHERE lead_reference ~ '\^NYSA-LD-/);
  assert.match(migration,/Governed trigger contract mismatch/);
  assert.match(migration,/expected 108/);
  assert.match(migration,/current_schema\(\)/);
  assert.doesNotMatch(migration,/migration 060/i);
});

test('trigger comparison reports names, functions and enabled-state drift',async()=>{
  const expected=[{table:'leads',name:'leads_assign_reference',function:'public.nysa_assign_lead_reference',enabled:'O'}];
  const exact={query:async()=>({rows:[{table_name:'leads',trigger_name:'leads_assign_reference',function_name:'public.nysa_assign_lead_reference',enabled:'O'}]})};
  assert.equal((await compareDatabaseTriggerContract(exact,expected)).matches,true);
  const drift={query:async()=>({rows:[{table_name:'leads',trigger_name:'leads_assign_reference',function_name:'public.wrong_function',enabled:'D'},{table_name:'tasks',trigger_name:'unexpected',function_name:'public.fn',enabled:'O'}]})};
  const result=await compareDatabaseTriggerContract(drift,expected);
  assert.equal(result.matches,false);
  assert.equal(result.wrongFunction.length,1);
  assert.equal(result.wrongEnabled.length,1);
  assert.deepEqual(result.extra,[{table:'tasks',name:'unexpected'}]);
  assert.deepEqual(result.missing,[]);
  assert.throws(()=>normalizeExpectedTriggerContract([...expected,...expected]),/duplicate/);
});

test('scoped backup verification reads table and trigger entries from pg_restore output',()=>{
  const parsed=parsePgRestoreListContracts(`;
; Archive created at 2026-11-04 12:00:00 UTC
123; 1259 10001 TABLE public leads nysareal_nysar2app
456; 2620 10002 TRIGGER public leads leads_assign_reference nysareal_nysar2app
789; 2620 10003 TRIGGER public tasks tasks_terminal_lead_follow_up_guard nysareal_nysar2app
`);
  assert.deepEqual(parsed.tableNames,['leads']);
  assert.deepEqual(parsed.triggerKeys,['leads\0leads_assign_reference','tasks\0tasks_terminal_lead_follow_up_guard']);
});

test('canonical operator blocks trigger drift before backup/install and verifies the candidate contract after readiness',()=>{
  const source=read('tools/crm-test-direct-node-release-operator.mjs');
  assert.match(source,/baselineTriggers/);
  assert.match(source,/expectedTriggerCount/);
  assert.match(source,/expectedTriggerContractSha256/);
  assert.match(source,/triggerComparison\(pool,config\.baselineTriggers,'stage'\)/);
  assert.match(source,/triggerComparison\(pool,config\.baselineTriggers,'backup'\)/);
  assert.match(source,/triggerComparison\(pool,config\.baselineTriggers,'pre-install'\)/);
  assert.match(source,/triggerComparison\(verificationPool,expectedCandidateTriggers,'post-deployment'\)/);
  assert.match(source,/triggerDriftDataComparison\(pool,'stage'\)/);
  assert.match(source,/triggerDriftDataComparison\(pool,'pre-install'\)/);
  assert.match(source,/triggerDriftDataComparison\(verificationPool,'post-deployment'\)/);
  assert.match(source,/leadCounterComparison\(pool\)/);
  assert.match(source,/leadCounterComparison\(verificationPool\)/);
  assert.match(source,/dumpTriggerContractVerified/);
  assert.match(source,/missing.*extra.*wrong function.*wrong enabled/);
});

test('the pre-restore data scan is read-only and covers affected governed domains',()=>{
  const source=read('src/trigger-drift-data-checks.js');
  assert.match(source,/BEGIN READ ONLY/);
  for(const marker of ['invalid_lead_stage_history','terminal_leads_with_open_followups','booking_extension_without_exact_evidence','offer_bilateral_acceptance_incomplete','active_commission_policy_overlap_pairs','active_agent_adjustment_overlap_pairs','leave_self_approval_decisions','leave_approval_task_assignment_mismatch'])assert.match(source,new RegExp(marker));
  assert.doesNotMatch(source,/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i);
});
