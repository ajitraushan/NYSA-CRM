import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV215 replaces repeated assignment cards with one filterable compact table',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html'),start=ui.indexOf('async function openAssignmentQueue()'),end=ui.indexOf('\nfunction openContactVerification',start),queue=ui.slice(start,end);
  assert.match(queue,/assignment-table/);
  assert.match(queue,/Select all visible/);
  for(const filter of ['business','team','campaign','sla','sort'])assert.match(queue,new RegExp(`data-assignment-filter="${filter}"`));
  assert.match(queue,/Closest to SLA first/);
  assert.match(queue,/Oldest waiting first/);
  for(const heading of ['Customer \/ business','Lead reference \/ title','Source \/ campaign','Routed team','Waiting','SLA deadline'])assert.match(queue,new RegExp(heading));
  assert.match(queue,/Assign selected Leads/);
  assert.match(queue,/data-assign-one/);
  assert.doesNotMatch(queue,/GOVERNED OWNERSHIP/);
  assert.match(styles,/\.assignment-table-modal/);
  assert.match(styles,/\.assignment-filters/);
});

test('DEV215 uses routed team eligibility and displays each agent open Lead count',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/lead-operations.js'),crm=read('src/routes/crm.js');
  assert.match(ui,/teamIds\.every\(teamId=>Array\.isArray\(s\.teamIds\)&&s\.teamIds\.includes\(teamId\)\)/);
  assert.match(ui,/openLeadCount\|\|0/);
  assert.match(routes,/AS open_lead_count/);
  assert.match(routes,/workload\.stage NOT IN \('Won','Lost'\)/);
  assert.match(routes,/\['manager','director'\]\.includes\(req\.broker\.jobRole\)/);
  assert.doesNotMatch(crm,/AS open_lead_count/);
});

test('DEV215 bulk assignment is atomic, locked, permission checked and fully audited',()=>{
  const routes=read('src/routes/lead-operations.js'),start=routes.indexOf("r.post('/crm/assignment-queue/bulk-assign'"),end=routes.indexOf("r.get('/crm/leads/:id/assignments'",start),bulk=routes.slice(start,end);
  assert.match(bulk,/transaction\(async client/);
  assert.match(bulk,/ORDER BY id FOR UPDATE/);
  assert.match(bulk,/leads\.length!==leadIds\.length/);
  assert.match(bulk,/managed\.includes\(effectiveTeamId\)/);
  assert.match(bulk,/eligibleSalesAgentTeamSql/);
  assert.match(bulk,/bulk_assigned_from_queue/);
  for(const auditField of ['originalTeamId','teamId','teamChanged','teamChangeReason','agentId','batchSize'])assert.match(bulk,new RegExp(auditField));
  assert.match(bulk,/A reason is required to change the routed team/);
});

test('DEV215 requires explicit confirmation and a reason for a team exception',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/lead-operations.js');
  assert.match(ui,/Change team/);
  assert.match(ui,/Why the routing rule is being overridden/);
  assert.match(ui,/Assign \$\{selected\.length\} selected Lead/);
  assert.match(routes,/originalTeamId&&originalTeamId!==teamId&&!teamChangeReason/);
  assert.match(routes,/teamChanged&&!teamChangeReason/);
});
