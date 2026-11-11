import test from 'node:test';
import assert from 'node:assert/strict';
import {assertWn15TeamStateOutput,WN15_EXPECTED_ACCOUNTS,WN15_EXPECTED_TEAMS} from '../tools/wn15-team-state-assertion.mjs';

function output(active){
  const teams=WN15_EXPECTED_TEAMS.map(team=>[team.id,team.name,active,team.managerId,team.managerName,team.managerStatus,team.managerRole].join('|'));
  const accounts=WN15_EXPECTED_ACCOUNTS.map(account=>[account.id,account.name,account.status,account.jobRole,account.teamId,'t','f'].join('|'));
  return [
    'BEGIN','SET',
    'team_id|team_name|active|manager_id|manager_name|manager_status|manager_role',
    ...teams,
    'broker_id|name|status|job_role|team_id|non_delivery_email|has_phone',
    ...accounts,
    'ROLLBACK',''
  ].join('\n');
}

test('WN-15 team-state assertion accepts exact database integer 0 as inactive',()=>{
  assert.deepEqual(assertWn15TeamStateOutput(output('0'),{expectedActive:0}),{
    expectedActive:0,
    teamCount:2,
    accountCount:4,
    teamIds:WN15_EXPECTED_TEAMS.map(team=>team.id),
    accountIds:WN15_EXPECTED_ACCOUNTS.map(account=>account.id)
  });
});

test('WN-15 team-state assertion accepts exact database integer 1 as active',()=>{
  assert.equal(assertWn15TeamStateOutput(output('1'),{expectedActive:1}).expectedActive,1);
});

test('WN-15 team-state assertion refuses any active value other than integer 0 or 1',()=>{
  assert.throws(()=>assertWn15TeamStateOutput(output('2'),{expectedActive:0}),/active must be database integer 0 or 1/);
  assert.throws(()=>assertWn15TeamStateOutput(output('f'),{expectedActive:0}),/active must be database integer 0 or 1/);
});

test('WN-15 team-state assertion requires exact team IDs and names',()=>{
  const wrongName=output('0').replace('CORE Test Sales Team','CORE Test Sales');
  assert.throws(()=>assertWn15TeamStateOutput(wrongName,{expectedActive:0}),/name mismatch/);
  const wrongId=output('0').replace('d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000099');
  assert.throws(()=>assertWn15TeamStateOutput(wrongId,{expectedActive:0}),/missing exact id/);
});
