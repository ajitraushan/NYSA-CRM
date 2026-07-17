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
  for(const column of ['exception_threshold','threshold_direction','benchmark_source'])assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
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

test('user-management API returns effective role assignments with browser-facing field names',()=>{
  const source=read('src/routes/admin.js');
  for(const field of ["'jobRole',r.job_role","'teamId',r.team_id","'isPrimary',r.is_primary=1","'startsAt',r.starts_at"])assert.match(source,new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('administration navigation consolidates read-only website intake into audit operations',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Audit and Operations/);
  assert.match(ui,/WebsiteIntake/);
  assert.doesNotMatch(ui,/data-admin-section="website-intake"/);
});

test('administration uses a left maintenance menu and proposal designer enforces buyer booklet controls',()=>{
  const app=read('public/app.js'),routes=read('src/routes/files-proposals.js');
  assert.match(app,/setupAdminWorkspace\(\)/);
  assert.match(app,/className='admin-workspace'/);
  assert.match(app,/admin-maintenance-nav/);
  assert.match(app,/\['users','User management'\]/);
  assert.match(app,/Maximum matched properties/);
  assert.match(app,/max="3"/);
  assert.match(app,/Approved media per property/);
  assert.match(app,/max="2"/);
  assert.match(app,/Property information and display rules/);
  assert.match(app,/Preview with sample buyer data/);
  assert.match(app,/organizationVersions\.find\(x=>x\.status==='active'\)/);
  assert.match(app,/approved logo shown here will govern live proposals/);
  assert.match(app,/proposal-preview-brand/);
  assert.match(app,/Create new version/);
  assert.match(routes,/proposal\.templateType==='Quick'.*listingIds\.length<1/);
  assert.match(routes,/requireAvailabilityCheck/);
  assert.match(routes,/maxMediaPerProperty/);
  assert.match(routes,/Only approved media from selected properties/);
});

test('organization profile copy action cannot silently clear an unsaved first profile',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Copy active profile into form/);
  assert.match(ui,/button\.disabled=!active/);
  assert.match(ui,/No active profile exists to copy/);
  assert.match(ui,/It is listed below and remains inactive until approved and activated/);
});

test('organization profile save ignores an unselected logo and reports partial logo failure accurately',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/rawFile\?\.name\?rawFile:null/);
  assert.match(ui,/Company profile saved; logo not attached/);
  assert.match(ui,/form remains linked to draft/);
  assert.match(ui,/selected logo file is empty/);
});

test('organization profile retries reuse the saved draft and unused duplicates can be deleted safely',()=>{
  const ui=read('public/app.js'),routes=read('src/routes/governance.js');
  assert.match(ui,/fillOrganizationForm\(saved\)/);
  assert.match(ui,/Delete unused draft/);
  assert.match(ui,/Compare changes shows what differs from the immediately preceding version/);
  assert.match(routes,/r\.delete\('\/admin\/organization-settings\/:id'/);
  assert.match(routes,/status='draft'/);
  assert.match(routes,/unused_draft_deleted/);
  assert.match(routes,/approved, active and historical versions are retained/);
});

test('fee maintenance is business-labelled and drives contextual scenario calculations',()=>{
  const ui=read('public/app.js'),domain=read('src/admin-governance.js'),routes=read('src/routes/qualification-finance.js');
  for(const label of ['Calculation formula','Calculated on','VAT added to this charge','Transaction applicability','Funding method applicability','Property type applicability','Service channel','Usually paid by','Official source/reference','Include in calculated total','Conditional amount bands'])assert.match(ui,new RegExp(label));
  for(const formula of ['conditional_fixed','percentage_plus_fixed','estimate_range','quantity'])assert.match(domain,new RegExp(formula));
  assert.match(domain,/mortgage_amount/);assert.match(domain,/bank_finance/);assert.match(domain,/totalMinimum/);assert.match(domain,/matchedBand/);
  assert.match(routes,/regulatoryFeeDetails/);assert.match(routes,/regulatoryFeeTotalMinimum/);assert.match(routes,/fundingMethod:b\.inputs/);assert.match(routes,/propertyType:b\.inputs/);assert.match(routes,/serviceChannel:b\.inputs/);
});

test('fee rule-set lifecycle supports safe draft editing comparison approval activation and retirement',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html'),routes=read('src/routes/qualification-finance.js');
  for(const contract of ['fillAssumptionForm','closeAssumptionForm','form-grid hidden','Start new rule set','Save draft changes','Saved versions are read-only','Create new version','Compare changes','Edit draft','Retirement reason'])assert.match(ui,new RegExp(contract));
  assert.match(ui,/method:id\?'PATCH':'POST'/);
  assert.match(routes,/r\.patch\('\/admin\/regulatory-assumptions\/:assumptionId'/);
  assert.match(routes,/r\.post\('\/admin\/regulatory-assumptions\/:assumptionId\/retire'/);
  assert.match(routes,/status IN \('draft','approved'\)/);
  assert.match(routes,/activate a replacement to retire the active version/);
  assert.match(routes,/Rule-set name, authority\/reference and disclaimer are required/);
  assert.match(ui,/Authority\/reference:/);assert.match(ui,/fee-rule-summary/);assert.match(styles,/fee-version-table td small\{display:block/);assert.match(styles,/#assumption-table>\.tool-note\{margin:0 0 12px/);
});
