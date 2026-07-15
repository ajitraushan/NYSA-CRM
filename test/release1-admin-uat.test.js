import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('Release 1 migrations remain sequential and include the administration corrections',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.deepEqual(migrations.slice(-2),['011_organization_profile_governance.sql','012_release1_admin_uat_corrections.sql']);
  const sql=read('src/migrations/012_release1_admin_uat_corrections.sql');
  for(const contract of ['controlled_value_consumers','queue_cycle_no','user_role_assignments','pending_activation','admin_assistant','approval_reason'])assert.match(sql,new RegExp(contract));
});

test('assignment queue supports scoped visibility atomic claim and repeat-cycle deadlines',()=>{
  const source=read('src/routes/lead-operations.js');
  assert.match(source,/\/crm\/assignment-queue/);
  assert.match(source,/FOR UPDATE/);
  assert.match(source,/self_claimed/);
  assert.match(source,/queue_cycle_no=queue_cycle_no\+1/);
  assert.match(source,/first_contact_due_at=\$4,accepted_at=NULL,first_contact_at=NULL/);
  for(const team of ['Dubai Rental Team','Dubai Off-plan Team','Dubai Secondary Sales Team'])assert.match(source,new RegExp(team));
});

test('proposal creation consumes administrator-defined prompts and snapshots their answers',()=>{
  const ui=read('public/app.js'),api=read('src/routes/files-proposals.js');
  assert.match(ui,/configured-proposal-inputs/);
  assert.match(ui,/data-proposal-input/);
  assert.match(ui,/f\.inputs=Object\.fromEntries/);
  assert.match(api,/Mandatory proposal content is missing/);
  assert.match(api,/configuration:template\.configuration/);
  assert.match(api,/configuredSections\.filter\(x=>x\.source==='agent_input'/);
});

test('Admin Assistant can maintain routine teams settings and listings without approval authority',()=>{
  const crm=read('src/routes/crm.js'),governance=read('src/routes/governance.js'),qualification=read('src/routes/qualification-finance.js'),files=read('src/routes/files-proposals.js'),listings=read('src/routes/listings.js');
  assert.match(crm,/Admin Assistants can create teams/);
  assert.match(crm,/Admin Assistants can edit teams/);
  assert.match(governance,/Administrator or Admin Assistant access required/);
  assert.match(qualification,/admin_assistant.*approve\|activate/);
  assert.match(files,/admin_assistant.*approve\|activate/);
  assert.match(listings,/admin_assistant/);
});

test('administration navigation consolidates read-only website intake into audit operations',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Audit and Operations/);
  assert.match(ui,/WebsiteIntake/);
  assert.doesNotMatch(ui,/data-admin-section="website-intake"/);
});
