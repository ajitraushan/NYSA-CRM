import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('operational users have a direct My Tasks navigation entry',()=>{
  assert.match(app,/WORKSPACE_TABS=\{[^}]*tasks:'My Tasks'/);
  assert.match(app,/hasCrmAccess\(\) \? '<button data-tab="tasks">My Tasks<\/button>' : ''/);
});

test('My Tasks navigation opens the existing personal task workspace',()=>{
  assert.match(app,/currentTab === 'tasks' \? renderTasks\(\)/);
  assert.match(app,/tab === 'tasks' \? renderTasks\(\)/);
  assert.match(app,/api\(`\/crm\/tasks\?mine=1&bucket=/);
  assert.match(app,/NYSA CORE \/ PERSONAL WORK QUEUE/);
});
