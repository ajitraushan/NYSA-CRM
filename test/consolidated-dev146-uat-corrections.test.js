import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const offerUi=read('public/offer-ui.js');
const dealUi=read('public/deal-ui.js');
const index=read('public/index.html');
const crm=read('src/routes/crm.js');
const leadOperations=read('src/routes/lead-operations.js');
const opportunities=read('src/routes/opportunities.js');
const qualification=read('src/routes/qualification-finance.js');
const leave=read('src/routes/agent-leave.js');

test('administration navigation has one stable label for each rendered workspace',()=>{
  const definitionBlock=app.match(/const definitions=\[(.*?)\];\s*const workspace=/s)?.[1]||'';
  const keys=[...definitionBlock.matchAll(/\['([^']+)'/g)].map(match=>match[1]);
  assert.equal(keys.length,25);
  assert.equal(new Set(keys).size,keys.length);
  assert.equal(keys.filter(key=>key==='users').length,1);
  for(const key of ['market_intelligence','commission_policy','employment_leave','document_compliance','operations','about'])assert.ok(keys.includes(key),key);
});

test('assignment actions refresh their queue without navigating the underlying workspace',()=>{
  assert.match(app,/refreshWorkspace\s*=\s*true/);
  assert.match(app,/assignment-queue[^\n]+refreshWorkspace:false/);
});

test('routed assignment work appears in My Task Queue and closes from authoritative queue state',()=>{
  assert.match(leadOperations,/taskType:'lead_assignment'/);
  assert.match(leadOperations,/a\.status='queued'/);
  assert.match(leadOperations,/approved_event\.resolution='approve_email_only'/);
  assert.match(leadOperations,/active_o\.stage NOT IN \('Closed Won','Closed Lost'\)/);
  assert.match(app,/isLeadAssignmentTask/);
  assert.match(app,/This task closes automatically when the queued Lead is assigned/);
});

test('manual Sales Agent capture self-assigns while SLA recycling excludes active Opportunities',()=>{
  assert.match(crm,/selfAssigned=creator\?\.jobRole==='sales_agent'/);
  assert.match(crm,/selfAssigned\?'assigned':'unassigned'/);
  assert.match(crm,/selfAssigned\?'accepted':'queued'/);
  assert.match(crm,/responded_at/);
  for(const source of [crm,leadOperations])assert.match(source,/NOT EXISTS\(SELECT 1 FROM opportunities/i);
});

test('Lead detail identifies its immutable creator and initial qualification belongs to the assigned Agent',()=>{
  assert.match(app,/<b>Created by<\/b>/);
  assert.match(crm,/created_by_name/i);
  assert.match(qualification,/assigned Sales Agent/i);
  assert.match(app,/lead\.assignedTo===ME\.id/);
});

test('customer discussion and first Opportunity action are governed evidence',()=>{
  for(const marker of ['Customer interaction &amp; enrichment','followUpRequired','dueAt','Send property details and seek feedback','Confirm viewing availability'])assert.ok(app.includes(marker),marker);
  assert.match(app,/<option value="Outbound">To Customer<\/option><option value="Inbound">From Customer<\/option>/);
  assert.doesNotMatch(app,/name="direction"><option value="">Not applicable<\/option><option>Inbound<\/option><option>Outbound<\/option>/);
  assert.match(crm,/Select a controlled customer-contact outcome/i);
  assert.match(crm,/completed customer discussion must retain a dated next action/i);
  assert.doesNotMatch(app,/Set the first action/);
});

test('Offer recovery uses canonical stage values and identifies the exact pending revision',()=>{
  assert.match(app,/option value="\$\{esc\(o\)\}"/);
  assert.match(offerUi,/Communication summary \*/);
  assert.match(offerUi,/Revision \$\{esc\(current\?\.revisionNumber/);
  assert.match(opportunities,/terminal_offer_return_to_matching/);
});

test('active Deal protects accepted Offer and reservation and exposes governed release or Close Lost guidance',()=>{
  assert.match(opportunities,/active Deal[\s\S]{0,180}cannot be withdrawn independently/i);
  assert.match(opportunities,/governed Deal close-lost or future replacement action/i);
  assert.match(dealUi,/Current accepted Offer and reservation are locked/);
  assert.match(dealUi,/Release or expiry must be recorded through the Booking/);
  assert.match(dealUi,/Close Deal as Lost and release inventory/);
});

test('Opportunity lookup accepts a copied displayed identity and connected Lead is bound before optional modules',()=>{
  assert.match(opportunities,/NYSA-OP-\[0-9\]\{6\}-\[0-9\]\{6\}/);
  assert.match(opportunities,/OFFSET \$\$\{params\.length\+2\}/);
  assert.match(app,/opportunity-register-next/);
  assert.match(app,/\$\('#opportunity-open-lead',o\)\?\.addEventListener/);
});

test('SLA recycling is atomic and assignment history explains the latest transition',()=>{
  assert.match(crm,/queue_cycle_no=queue_cycle_no\+1/);
  assert.match(crm,/First-contact.*SLA breach returned Lead to routed team queue/);
  assert.match(app,/Latest assignment transition/);
  assert.match(app,/Assigned by.*deadline/);
});

test('long workspaces provide labeled close controls and readable card hierarchy',()=>{
  assert.match(app,/close-label">Close/);
  assert.match(index,/\.offer-card[^}]*font-size:13\.8px/);
  assert.match(index,/\.qualification-history \.activity-row/);
});

test('Agent leave validation returns explicit errors before persistence',()=>{
  assert.match(leave,/meaningful\(req\.body\?\.reason,'Leave reason'\)/);
  assert.match(leave,/validateLeaveApplication/);
});
