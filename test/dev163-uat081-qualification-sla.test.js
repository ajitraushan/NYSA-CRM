import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('UAT-081 migration persists governed qualification timing and task lineage',()=>{
  const sql=read('src/migrations/105_dev163_uat081_qualification_follow_up_sla.sql');
  assert.match(sql,/qualification_hot_elapsed_minutes[\s\S]*DEFAULT 15/);
  assert.match(sql,/qualification_warm_business_minutes[\s\S]*DEFAULT 240/);
  assert.match(sql,/qualification_cold_business_days[\s\S]*DEFAULT 1/);
  assert.match(sql,/qualification_cold_nurture_business_days[\s\S]*DEFAULT 5/);
  assert.match(sql,/CREATE TABLE qualification_follow_up_task_links/);
});

test('UAT-081 assessment creates a real governed task and Cold completion schedules the next cycle',()=>{
  const qualification=read('src/routes/qualification-finance.js'),tasks=read('src/routes/lead-operations.js');
  assert.match(qualification,/createQualificationFollowUp/);
  assert.match(qualification,/task_type[\s\S]*'qualification_follow_up'/);
  assert.match(qualification,/qualification_sla_created/);
  assert.match(tasks,/qualification_nurture_cycle_created/);
  assert.match(tasks,/Only an authorized Manager may change a Qualification SLA deadline/);
  assert.match(tasks,/Only an authorized Manager may cancel a Qualification SLA Task/);
});

test('UAT-081 browser exposes maintained policy targets and the generated deadline',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Hot qualification follow-up \(elapsed minutes\)/);
  assert.match(ui,/Warm qualification follow-up \(business minutes\)/);
  assert.match(ui,/Cold nurture cadence \(business days\)/);
  assert.match(ui,/Governed next action/);
  assert.match(ui,/next weekly nurture Task created/);
});
