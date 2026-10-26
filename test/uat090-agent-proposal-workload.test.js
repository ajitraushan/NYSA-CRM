import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-090 removes the redundant Proposal workload summary from the Agent dashboard only',()=>{
  const ui=read('public/dashboard-ui.js');
  const start=ui.indexOf("if(data.dashboardType==='agent')"),end=ui.indexOf("if(data.view==='Proposal approvals')",start),agentBlock=ui.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(agentBlock,/disclosure\('Proposal workload'/);
  assert.match(agentBlock,/Proposal work remains in its governed Lead workspace and returned corrections remain in My tasks/);
  assert.match(ui,/dashTable\('Proposal workload',objectRows\(data\.proposals\)\)/);
});

test('UAT-090 preserves proposal history, preparation and returned-correction paths',()=>{
  const app=read('public/app.js'),html=read('public/index.html');
  assert.match(app,/openProposals=async function/);
  assert.match(app,/Existing proposals/);
  assert.match(app,/proposalHistory/);
  assert.match(app,/PROPOSAL CHANGES REQUESTED/);
  assert.match(app,/switchTab\('tasks'\)/);
  assert.match(html,/proposal-correction-task/);
});
