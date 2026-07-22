import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('R2.1A migration adds immutable Opportunity ownership history without rewriting Release 1.1 lifecycle data',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1),'039_release2_connected_operations.sql');
  const sql=read('src/migrations/039_release2_connected_operations.sql');
  for(const marker of ['CREATE TABLE opportunity_assignment_history','change_scope','opportunity_assignment_history_immutable','Initial owner captured from the qualified lead','OpportunityAssignment'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/UPDATE\s+leads\s+SET\s+stage/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+(leads|opportunities|lead_assignments)/i);
});

test('coordinated reassignment locks and validates the linked case then updates only explicit selections atomically',()=>{
  const routes=read('src/routes/crm.js'),opportunities=read('src/routes/opportunities.js');
  for(const marker of ["/crm/leads/:id/operating-context","/crm/leads/:id/coordinated-reassignment","FOR UPDATE","expectedLeadUpdatedAt","opportunityVersions","Select the Lead or at least one open Opportunity","eligible active member","Closed Opportunities cannot be reassigned","opportunity_assignment_history","lead_and_opportunity","OpportunityAssignment"])assert.match(routes,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(routes,/transaction\(async client=>/);
  assert.match(routes,/UPDATE opportunity_participants SET active=FALSE/);
  assert.match(routes,/ON CONFLICT\(opportunity_id,broker_id,participation_role\)/);
  assert.match(opportunities,/assignmentHistory/);
  assert.match(opportunities,/Initial owner captured from the qualified lead/);
});

test('connected case and role dashboards guide users without hiding future release boundaries',()=>{
  const ui=read('public/app.js'),dashboard=read('public/dashboard-ui.js'),styles=read('public/index.html'),routes=read('src/routes/opportunities.js');
  for(const marker of ['GUIDED WORK','connected case','Review reassignment impact','Impact preview','Lead ownership will stay unchanged','Open connected Lead and full flow','Ownership history'])assert.match(ui,new RegExp(marker));
  for(const marker of ['GUIDED SALES FLOW','My operating sequence','Team operating sequence','Current work, blockers and the next permitted action','data-guided-step','data-guided-lead'])assert.match(dashboard,new RegExp(marker));
  for(const marker of ['dashboard-connected-flow','flow-current','flow-ready','flow-blocked','flow-not_available','reassignment-preview'])assert.match(styles,new RegExp(marker));
  assert.match(routes,/\/crm\/operations\/guided-work/);
  for(const marker of ['awaiting manager assignment','Await assignment by','Manager-controlled; open Lead context only','Open Lead and review reassignment'])assert.match(routes,new RegExp(marker));
  assert.match(dashboard,/actionHint/);
  assert.match(routes,/Available in a later Release 2 slice/);
  assert.match(routes,/R2\.1A enables connected guidance through Matching/);
});

test('D-039 and D-040 make connected operations and guided usability acceptance gates',()=>{
  const decisions=read('docs/DECISIONS.md'),scope=read('docs/RELEASE_2_SCOPE.md'),status=read('docs/CURRENT_STATUS.md');
  for(const marker of ['D-039','D-040'])assert.match(decisions,new RegExp(marker));
  for(const marker of ['Connected operating experience','Role-guided work areas','R2.1A connected operations and ownership','without developer assistance'])assert.match(scope,new RegExp(marker));
  assert.match(status,/Release 2 role-guided work areas approved/);
});
