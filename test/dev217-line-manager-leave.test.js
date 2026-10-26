import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAPABILITY,LEAVE_WORKFLOW_POLICY,hasCapability} from '../src/role-access.js';
import {mayDecideLeave} from '../src/agent-leave-domain.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('leave decisions belong to the exact assigned Line Manager, never Admin',()=>{
  const manager={id:'manager-1',role:'internal_broker',jobRole:'manager'};
  const otherManager={id:'manager-2',role:'internal_broker',jobRole:'manager'};
  const admin={id:'admin-1',role:'admin',jobRole:'admin'};
  const application={applicantId:'agent-1',approverId:manager.id};
  assert.equal(hasCapability(manager,CAPABILITY.LEAVE_DECIDE),true);
  assert.equal(hasCapability(admin,CAPABILITY.LEAVE_DECIDE),false);
  assert.equal(mayDecideLeave({broker:manager,application}),true);
  assert.equal(mayDecideLeave({broker:otherManager,application}),false);
  assert.equal(mayDecideLeave({broker:admin,application}),false);
  assert.equal(LEAVE_WORKFLOW_POLICY.routingReason,'leave_to_line_manager');
});

test('submission resolves the reporting manager from the frozen employment version',()=>{
  const route=read('src/routes/agent-leave.js');
  assert.match(route,/employment\.reportingManagerId/);
  assert.match(route,/job_role=ANY\(\$2::text\[\]\)/);
  assert.match(route,/activeLineManager\(employment,app\.applicantId,client\)/);
  assert.doesNotMatch(route,/principalForCapability/);
});

test('pending legacy Admin approvals are remediated without rewriting immutable task links',()=>{
  const migration=read('src/migrations/130_line_manager_leave_approval.sql');
  assert.match(migration,/status='cancelled'/);
  assert.match(migration,/approval_cycle=next_cycle/);
  assert.match(migration,/INSERT INTO leave_application_task_links/);
  assert.match(migration,/routing_reason='leave_to_line_manager'/);
  assert.match(migration,/status='routing_required'/);
  assert.doesNotMatch(migration,/UPDATE leave_application_task_links/);
});

test('Admin UI retains configuration and register but exposes no leave decision action',()=>{
  const app=read('public/app.js');
  assert.match(app,/Assigned Line Managers decide submitted leave from My Tasks/);
  assert.doesNotMatch(app,/data-admin-leave-review/);
  assert.doesNotMatch(app,/Admin records the governed decision/);
});
