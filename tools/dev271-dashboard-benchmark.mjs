import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { applyFixtureMigration, createFixture, migrationFiles } from './dev270-pg13-rehearsal-fixture.mjs';
import { connectedOutcomes, prospectDashboardSummary } from '../src/prospect-dashboard.js';

const client=await createFixture('nysa_test_fixture','nysa_test_user');
try {
  for(const file of migrationFiles)await applyFixtureMigration(client,file,'nysa_test_user');
  await client.query("CREATE TEMP TABLE benchmark_agents AS SELECT i,gen_random_uuid() AS id FROM generate_series(1,20) i");
  await client.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) SELECT id,'Synthetic Agent '||i,'dev271-agent-'||i||'@example.invalid','internal_broker','sales_agent','active','fixture' FROM benchmark_agents");
  await client.query("CREATE TEMP TABLE benchmark_prospects AS SELECT g.i,gen_random_uuid() AS id,owner.id AS owner_id FROM generate_series(1,50000) g(i) JOIN benchmark_agents owner ON owner.i=(g.i-1)%20+1");
  await client.query("INSERT INTO prospects(id,display_name,phone,normalized_phone,owner_id,timezone,timezone_source,created_by,created_at,source,status) SELECT id,'Fixture prospect '||i,'+97150'||lpad(i::text,7,'0'),'+97150'||lpad(i::text,7,'0'),owner_id,'Asia/Dubai','phone_inferred',owner_id,now()-((i%28)||' days')::interval,CASE WHEN (i-1)/20%2=0 THEN 'diary' ELSE 'notebook' END,CASE WHEN i<=25000 THEN 'no_answer' ELSE 'not_contacted' END FROM benchmark_prospects");
  await client.query("INSERT INTO company_calling_numbers(id,label,phone,normalized_phone,tdra_registration_reference,tdra_registered_legal_name,tdra_registered_at,tdra_verified_at,tdra_evidence_reference,created_by) SELECT '99999999-0000-4000-8000-000000000001','Fixture number','+971501000000','+971501000000','fixture','Fixture','2026-11-10',now(),'fixture',id FROM benchmark_agents WHERE i=1");
  await client.query("INSERT INTO prospect_activities(id,prospect_id,activity_type,direction,outcome,notes,company_calling_number_id,created_by,occurred_at) SELECT gen_random_uuid(),id,'call','outbound',CASE WHEN i%3=0 THEN 'answered' ELSE 'no_answer' END,'Synthetic benchmark call','99999999-0000-4000-8000-000000000001',owner_id,now()-((i%28)||' days')::interval FROM benchmark_prospects WHERE i<=25000");
  await client.query("INSERT INTO tasks(id,prospect_id,prospect_channel,task_type,subject,assignee_id,priority,due_at,created_by) SELECT gen_random_uuid(),id,'call','prospect_follow_up','Fixture follow-up',owner_id,'normal',now()+((i%20-10)||' days')::interval,owner_id FROM benchmark_prospects WHERE i<=10000");
  await client.query('ANALYZE prospects; ANALYZE prospect_activities; ANALYZE tasks; ANALYZE brokers');
  const {rows:[period]}=await client.query("SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date-30)::text AS start,(now() AT TIME ZONE 'Asia/Dubai')::date::text AS finish");
  const reports=[];
  for(const source of [null,'diary']){
    const args=[period.start,period.finish,'day',null,null,null,source,connectedOutcomes,0];
    const sql=prospectDashboardSummary({clause:'true'});
    const timesMs=[];
    for(let index=0;index<3;index++){
      const start=performance.now();
      const {rows:[result]}=await client.query(sql,args);
      assert.equal(result.agents.length,20);
      timesMs.push(Math.round(performance.now()-start));
    }
    const {rows:[plan]}=await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,args);
    reports.push({source,timesMs,explain:plan['QUERY PLAN'][0]});
    console.log(JSON.stringify({source,timesMs}));
  }
  const report={database:'synthetic PostgreSQL 13.23',agents:20,prospects:50000,calls:25000,followups:10000,period,
    query:'All dashboard panels combined, direct database timing',reports};
  await fs.writeFile('docs/change-requests/DEV271-DASHBOARD-BENCHMARK.json',JSON.stringify(report,null,2)+'\n');
  assert.ok(reports.every(run=>run.timesMs.every(ms=>ms<2000)), 'Two-second database query threshold exceeded');
}finally{await client.end();}
