import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('Manager oversight does not become Agent operational authority',()=>{
  const policy=read('../src/crm-policy.js'),crm=read('../src/routes/crm.js'),leadOps=read('../src/routes/lead-operations.js'),qualification=read('../src/routes/qualification-finance.js');
  assert.match(policy,/export function canOperateLead/);
  assert.match(policy,/String\(lead\.assignedTo\) === String\(broker\.id\)/);
  assert.match(policy,/canCreateOpportunity[\s\S]*canOperateLead/);
  assert.match(crm,/canOperate:canOperateLead\(req\.broker,lead\)/);
  assert.match(crm,/canWrite:canOperateLead\(req\.broker,lead\)/);
  assert.match(leadOps,/if\(!canOperateLead\(req\.broker,lead\)\)/);
  assert.doesNotMatch(leadOps,/task\.assigneeId!==req\.broker\.id&&!canAssignLead/);
  assert.match(qualification,/scope==='manage'\?canWriteLead/);
  assert.match(qualification,/scope==='operate'\?canOperateLead/);
});

test('Customer 360 and Lead workspaces explain the read-only boundary',()=>{
  const app=read('../public/app.js');
  assert.match(app,/canOperatePrimaryPursuit/);
  assert.match(app,/operational actions remain with the assigned Agent/);
  assert.match(app,/Read-only contact details/);
  assert.match(app,/Managers retain review, approval, assignment and read-only oversight/);
});

test('downstream operational services enforce direct Lead authority',()=>{
  for(const path of ['../src/routes/ai.js','../src/routes/email-calendly.js','../src/routes/governed-matching.js','../src/routes/files-proposals.js','../src/routes/integrations.js']){
    const source=read(path);
    assert.match(source,/canOperateLead/,path);
    assert.doesNotMatch(source,/canWriteLead/,path);
  }
});
