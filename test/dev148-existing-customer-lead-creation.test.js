import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const crm=read('src/routes/crm.js');
const website=read('src/routes/website-intake.js');
const operations=read('src/routes/lead-operations.js');
const app=read('public/app.js');
const phase1=read('src/migrations/003_phase1_completion.sql');
const leadOperationsMigration=read('src/migrations/005_lead_operations.sql');
const websiteProfileMigration=read('src/migrations/064_release3a_website_profile_evidence.sql');
const emailGateMigration=read('src/migrations/070_release3a_email_only_intake_gate.sql');
const aiRoutingMigration=read('src/migrations/074_release3ai_governed_website_routing.sql');

const quotedValues=source=>new Set([...source.matchAll(/'([^']+)'/g)].map(match=>match[1]));
const constraintValues=(source,pattern)=>quotedValues(source.match(pattern)?.[1]||'');

function capturedLeadSource(){
  return crm.match(/async function insertCapturedLead\([\s\S]*?\n}\n\nr\.post\('\/crm\/leads\/capture'/)?.[0]||'';
}

test('manual Sales Agent Lead creation uses the authoritative Lead assignment state',()=>{
  const source=capturedLeadSource();
  const allowed=constraintValues(phase1,/CHECK \(assignment_status IN \(([^)]+)\)\)/);
  assert.ok(allowed.has('assigned'));
  assert.ok(!allowed.has('accepted'));
  assert.match(source,/selfAssigned\?'assigned':'unassigned'/);
  assert.doesNotMatch(source,/selfAssigned\?'accepted':'unassigned'/);
});

test('self-assignment remains immediately accepted in assignment history',()=>{
  const source=capturedLeadSource();
  assert.match(source,/accepted_at=CASE WHEN \$2 THEN received_at ELSE NULL END/);
  assert.match(source,/selfAssigned\?'accepted':'queued'/);
  assert.match(source,/selfAssigned\?receivedAt:null/);
});

test('existing-Customer Lead creation is transactional and returns the created Lead only after success',()=>{
  const route=crm.match(/r\.post\('\/crm\/leads', async \(req, res\) => \{[\s\S]*?\n}\);/)?.[0]||'';
  assert.match(route,/transaction\(client=>insertCapturedLead/);
  assert.match(route,/res\.status\(201\)\.json\(lead\)/);
});

test('new- and existing-Customer interface paths share the corrected transactional insertion helper',()=>{
  const newCustomerRoute=crm.match(/r\.post\('\/crm\/leads\/capture',[\s\S]*?\n}\);\n\nr\.post\('\/crm\/leads'/)?.[0]||'';
  const existingCustomerRoute=crm.match(/r\.post\('\/crm\/leads', async \(req, res\) => \{[\s\S]*?\n}\);/)?.[0]||'';
  assert.match(newCustomerRoute,/transaction\(async client=>\{/);
  assert.match(newCustomerRoute,/insertCapturedLead\(\{\.\.\.b,contactId\},ownerId,budget,client\)/);
  assert.match(existingCustomerRoute,/transaction\(client=>insertCapturedLead\(\{\.\.\.b,budgetMin,budgetMax\},req\.broker\.id,\{min:budgetMin,max:budgetMax\},client\)\)/);
  assert.equal((crm.match(/INSERT INTO leads \(id,contact_id,title,source,business_type,customer_objective/g)||[]).length,1);
});

test('website investor intake remains unassigned, queued, transactional and role-complete',()=>{
  const processEvent=website.match(/async function processEvent\([\s\S]*?\n}\n\nfunction emailOnlyGate/)?.[0]||'';
  assert.match(processEvent,/return transaction\(async client=>\{/);
  assert.match(processEvent,/b\.requirement\?\.purpose==='investment'\?\['buyer','investor'\]/);
  assert.match(processEvent,/INSERT INTO leads\(id,contact_id,title,source,business_type,temperature/);
  assert.match(processEvent,/rule\?\.teamId\|\|null,null,'unassigned'/);
  assert.match(processEvent,/INSERT INTO lead_assignments[\s\S]*?'queued'/);
  assert.equal((website.match(/INSERT INTO leads\(/g)||[]).length,1);
});

test('website profile creates and versions structured requirements without breaking journey continuity',()=>{
  assert.match(websiteProfileMigration,/source_kind IN \('broker_recorded','website_profile'\)/);
  assert.match(website,/b\.profile\?'website_profile':'broker_recorded'/);
  assert.match(website,/b\.form==='ai_property_selection_v1'/);
  assert.match(website,/const reqFingerprint=requirementFingerprint\(mergedBody\),reqId=uuid\(\),versionNo=Number\(current\.versionNo\)\+1/);
  assert.match(website,/detectWebsiteRequirementConflicts\(current,websiteRequirement\)/);
  assert.match(website,/UPDATE lead_requirements SET superseded_at=NOW\(\) WHERE id=\$1/);
  assert.match(website,/VALUES\(\$1,\$2,\$3[\s\S]*?'website_profile'/);
});

test('website intake and AI routing status literals remain inside authoritative constraints',()=>{
  const intakeAllowed=constraintValues(emailGateMigration,/CHECK \(status IN \(([^)]+)\)\)/);
  const intakeWrites=new Set([...website.matchAll(/website_intake_events SET status='([^']+)'/g)].map(match=>match[1]));
  for(const status of intakeWrites)assert.ok(intakeAllowed.has(status),`website intake status ${status} is not allowed`);
  const aiAllowed=constraintValues(aiRoutingMigration,/ai_routing_status IS NULL OR ai_routing_status IN \(([\s\S]*?)\)\s*\)/);
  for(const status of ['awaiting_property_selection','determined','review_required','manager_review','not_emitted'])assert.ok(aiAllowed.has(status));
});

test('all direct Lead lifecycle writes in Lead routes use migration-approved values',()=>{
  const allowed=constraintValues(phase1,/CHECK \(assignment_status IN \(([^)]+)\)\)/);
  const sources=[crm,website,operations];
  const written=new Set(sources.flatMap(source=>[...source.matchAll(/assignment_status\s*=\s*'([^']+)'/g)].map(match=>match[1])));
  for(const status of written)assert.ok(allowed.has(status),`Lead assignment_status ${status} is not allowed`);
  assert.deepEqual([...written].sort(),['assigned','reassignment_due','unassigned']);
});

test('direct assignment-history writes use migration-approved values',()=>{
  const allowed=constraintValues(leadOperationsMigration,/status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/);
  for(const status of ['queued','offered','accepted','rejected','timed_out','reassigned','closed'])assert.ok(allowed.has(status));
  const combined=[crm,website,operations].join('\n');
  for(const status of ['queued','offered','accepted','timed_out','reassigned'])assert.match(combined,new RegExp(`['"]${status}['"]`));
});

test('Current CRM import remains an independent unassigned queued transaction',()=>{
  const route=operations.match(/r\.post\('\/lead-operations\/imports\/current-crm',[\s\S]*?\n}\);/)?.[0]||operations;
  assert.match(route,/transaction\(async client=>\{/);
  assert.match(route,/null,'unassigned',receivedAt/);
  assert.match(route,/null,'queued',due\.acceptanceDueAt/);
  assert.equal((operations.match(/INSERT INTO leads\(/g)||[]).length,1);
});

test('manual Lead creation UI reports the committed assignment outcome instead of always claiming queue entry',()=>{
  assert.match(app,/selfAssignedCreation=ME\?\.jobRole==='sales_agent'/);
  assert.match(app,/The Lead is self-assigned to you/);
  assert.match(app,/remains in your operating work and will not enter the Manager pending Assignment Queue/);
  assert.match(app,/creationOutcome=lead=>lead\?\.assignmentStatus==='assigned'&&lead\?\.assignedTo/);
  assert.match(app,/creationOutcome\(captured\.lead\)/);
  assert.match(app,/creationOutcome\(createdLead\)/);
  assert.doesNotMatch(app,/Lead created successfully for the selected customer\. It is now in the assignment queue/);
});
