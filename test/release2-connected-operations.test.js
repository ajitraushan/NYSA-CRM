import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('R2.1A migration adds immutable Opportunity ownership history without rewriting Release 1.1 lifecycle data',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.ok(migrations.includes('039_release2_connected_operations.sql'));
  const sql=read('src/migrations/039_release2_connected_operations.sql');
  for(const marker of ['CREATE TABLE opportunity_assignment_history','change_scope','opportunity_assignment_history_immutable','Initial owner captured from the qualified lead','OpportunityAssignment'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/UPDATE\s+leads\s+SET\s+stage/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+(leads|opportunities|lead_assignments)/i);
});

test('coordinated reassignment locks and validates the linked case then updates only explicit selections atomically',()=>{
  const routes=read('src/routes/crm.js'),opportunities=read('src/routes/opportunities.js');
  for(const marker of ["/crm/leads/:id/operating-context","/crm/leads/:id/coordinated-reassignment","FOR UPDATE","expectedLeadUpdatedAt","opportunityVersions","Select the Lead or at least one open Opportunity","eligible active Sales Agent","Closed Opportunities cannot be reassigned","opportunity_assignment_history","lead_and_opportunity","OpportunityAssignment"])assert.match(routes,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(routes,/transaction\(async client=>/);
  assert.match(routes,/UPDATE opportunity_participants SET active=FALSE/);
  assert.match(routes,/ON CONFLICT\(opportunity_id,broker_id,participation_role\)/);
  assert.match(opportunities,/assignmentHistory/);
  assert.match(opportunities,/Initial Opportunity owner captured from the qualified Lead assignment; Inventory maintenance remains with the Listing Executive/);
});

test('connected case and role dashboards guide users without hiding future release boundaries',()=>{
  const ui=read('public/app.js'),dashboard=read('public/dashboard-ui.js'),styles=read('public/index.html'),routes=read('src/routes/opportunities.js'),dashboardRoutes=read('src/routes/dashboards.js');
  for(const marker of ['GUIDED WORK','connected case','Review reassignment impact','Impact preview','Lead ownership will stay unchanged','View source Lead history','Ownership history'])assert.match(ui,new RegExp(marker));
  for(const marker of ['GUIDED SALES FLOW','My operating sequence','Team operating sequence','Every sequence count opens the exact contributing records','data-guided-step','data-guided-lead','data-guided-all','My priority cases','Open full Lead register'])assert.match(dashboard,new RegExp(marker));
  for(const marker of ['dashboard-connected-flow','flow-current','flow-ready','flow-blocked','flow-not_available','reassignment-preview','guided-work-layout','guided-next-scroll','max-height:360px'])assert.match(styles,new RegExp(marker));
  assert.match(routes,/\/crm\/operations\/guided-work/);
  for(const marker of ['awaiting manager assignment','Await assignment by','Manager-controlled; open Lead context only','Open Lead and review reassignment'])assert.match(routes,new RegExp(marker));
  assert.match(dashboard,/actionHint/);
  assert.doesNotMatch(dashboard,/data\.releaseBoundary/);
  assert.match(routes,/R2\.5 reconciles the accepted Release 2 flow/);
  assert.match(routes,/authoritative closure/);
  assert.match(dashboard,/openDashboardRecords\(`guided_\$\{button\.dataset\.guidedStep\}`/);
  assert.match(dashboardRoutes,/segment\.startsWith\('guided_'\)/);
  for(const step of ['customer','lead','qualification','opportunity','matching','viewing','offer','booking','deal'])assert.match(dashboardRoutes,new RegExp(step));
  assert.match(dashboard,/filter\(x=>x\.responsibility==='agent'\)/);
  assert.match(routes,/responsibility:'manager'/);
  assert.match(routes,/Accept assignment/);
  assert.match(routes,/Open Lead to accept or reject/);
  assert.match(routes,/LIMIT 8/);
  assert.match(styles,/priority scrolling must not stretch the operating sequence/);
  assert.match(dashboard,/class="dashboard-workspace"/);
  assert.match(dashboard,/class="dashboard-left-flow"/);
  assert.match(dashboard,/id="dashboard-priority-flow"/);
  assert.match(dashboard,/append\(priorityPanel\)/);
  assert.match(styles,/#dashboard-priority-flow\{display:none\}/);
  assert.doesNotMatch(styles,/\.guided-next-cases\{grid-column:2;grid-row:1/);
  assert.match(routes,/nextCaseResponsibility/);
  assert.match(routes,/l\.assigned_to IS NULL AND l\.assignment_status IN \('unassigned','reassignment_due'\)/);
  assert.match(dashboard,/manager action required/);
  assert.ok(dashboard.indexOf('${agentCommandBar}')<dashboard.indexOf('id="dashboard-guided-flow"'),'Agent workspace navigation must appear above the guided operating sequence');
  assert.ok(dashboard.indexOf('id="dashboard-guided-flow"')<dashboard.indexOf("${likelyType==='agent'?'':tabsMarkup}"),'manager guided sequence must remain above manager workspace tabs');
  assert.match(dashboard,/likelyType==='manager'&&activeDashboardView==='Team performance'/);
  assert.match(dashboard,/showingProposalApprovals=defaults\.view==='Proposal approvals'/);
  assert.doesNotMatch(dashboard,/slice\(0,6\)/);
});

test('workspace mutations refresh in place and assignment offers use visible governed timing',()=>{
  const app=read('public/app.js'),dashboard=read('public/dashboard-ui.js'),operations=read('src/routes/lead-operations.js'),routes=read('src/routes/opportunities.js');
  assert.match(app,/refreshActiveWorkspace\(\)/);
  assert.match(app,/window\.refreshActiveCrmDashboard/);
  assert.match(app,/!\['GET','HEAD'\]\.includes/);
  assert.match(dashboard,/window\.refreshActiveCrmDashboard=/);
  assert.match(dashboard,/personal follow-ups, accepted-lead contact work, overdue tasks and proposal corrections/);
  assert.match(dashboard,/Offered \$\{fmtDate\(x\.assignmentOfferedAt\)\} · Accept by/);
  assert.match(routes,/assignment_offer\.offered_at AS assignment_offered_at/);
  assert.match(routes,/COALESCE\(assignment_offer\.acceptance_due_at,l\.acceptance_due_at\)/);
  assert.match(operations,/acceptanceDueAt:new Date\(receivedAt\.getTime\(\)\+30\*60000\)/);
  assert.match(operations,/firstContactDueAt:new Date\(receivedAt\.getTime\(\)\+120\*60000\)/);
  assert.match(operations,/Assignment offer has no acceptance deadline/);
  assert.match(read('src/routes/crm.js'),/renewOffer[\s\S]*assignment_offer_renewed/);
});

test('D-039 and D-040 make connected operations and guided usability acceptance gates',()=>{
  const decisions=read('docs/DECISIONS.md'),scope=read('docs/RELEASE_2_SCOPE.md'),status=read('docs/CURRENT_STATUS.md');
  for(const marker of ['D-039','D-040'])assert.match(decisions,new RegExp(marker));
  for(const marker of ['Connected operating experience','Role-guided work areas','R2.1A connected operations and ownership','without developer assistance'])assert.match(scope,new RegExp(marker));
  assert.match(status,/Release 2 role-guided work areas approved/);
});
