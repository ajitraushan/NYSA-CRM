import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canManageUnassignedResponses} from '../src/nonvoice-response-workflow.js';
import {CAPABILITY,governedRoleRequestAllowed,hasCapability} from '../src/role-access.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const uuid='11111111-1111-4111-8111-111111111111';

test('only Admin and Manager can manage the unassigned response queue',()=>{
  const admin={id:uuid,role:'admin',jobRole:'admin'},manager={id:uuid,role:'internal_broker',jobRole:'manager'};
  const agent={id:uuid,role:'internal_broker',jobRole:'sales_agent'},director={id:uuid,role:'internal_broker',jobRole:'director'};
  assert.equal(canManageUnassignedResponses(admin),true);
  assert.equal(canManageUnassignedResponses(manager),true);
  assert.equal(canManageUnassignedResponses(agent),false);
  assert.equal(canManageUnassignedResponses(director),false);
  assert.equal(hasCapability(admin,CAPABILITY.LEAD_RESPONSE_UNASSIGNED),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/lead-response'),true);
  assert.equal(governedRoleRequestAllowed(admin,'POST',`/crm/lead-response/${uuid}/assign-owner`),true);
  assert.equal(governedRoleRequestAllowed(admin,'POST',`/crm/lead-response/${uuid}/takeover`),false);
});

test('Unassigned UI separates response ownership from canonical Lead ownership',()=>{
  const ui=read('public/lead-response-dev244-ui.js'),bootstrap=read('public/bootstrap.js'),workflow=read('src/nonvoice-response-workflow.js');
  const assignBody=workflow.slice(workflow.indexOf('export async function assignUnassignedResponseOwner'),workflow.indexOf('export async function scopedResponseCase'));
  assert.match(bootstrap,/lead-response-dev244-ui\.js/);
  assert.match(ui,/>Unassigned/);
  assert.match(ui,/does not accept or change the canonical Lead owner\/team/);
  assert.match(ui,/assign-owner/);
  assert.match(workflow,/canonicalLeadOwnerChanged:false,canonicalLeadTeamChanged:false/);
  assert.doesNotMatch(assignBody,/UPDATE leads SET assigned_to/);
});

test('assignment is audited, creates the Task and schedules only eligible cases',()=>{
  const workflow=read('src/nonvoice-response-workflow.js');
  assert.match(workflow,/response_owner_assigned/);
  assert.match(workflow,/INSERT INTO tasks/);
  assert.match(workflow,/if\(row\.state==='ready'\)await scheduleNonvoiceJobs/);
  assert.match(workflow,/fallback_owner_id IS NULL AND c\.next_action_task_id IS NULL/);
});
