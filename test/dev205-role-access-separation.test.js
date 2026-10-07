import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAPABILITY,GOVERNED_API_POLICY,JOB_ROLE,LEAVE_WORKFLOW_POLICY,ROLE_ACCESS_POLICY,governedRoleRequestAllowed,hasCapability} from '../src/role-access.js';
import {mayDecideLeave,mayMaintainLeave} from '../src/agent-leave-domain.js';
import {canReadLead,canReadOpportunity,hasInternalCrmIdentity,hasNysaStaffIdentity,isCompanyReader} from '../src/crm-policy.js';

const admin={id:'admin',role:'admin',jobRole:'admin'};
const retiredAssistant={id:'assistant',role:'internal_broker',jobRole:'admin_assistant'};
const director={id:'director',role:'internal_broker',jobRole:'director'};
const salesAgent={id:'agent',role:'internal_broker',jobRole:'sales_agent'};

test('Admin combines configuration and leave administration without business-record access',()=>{
  assert.equal(governedRoleRequestAllowed(admin,'GET','/admin/brokers'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/staff'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/teams'),true);
  assert.equal(governedRoleRequestAllowed(admin,'POST','/crm/teams'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/marketing-material-compliance/configuration'),true);
  assert.equal(governedRoleRequestAllowed(admin,'PATCH','/crm/teams/11111111-1111-1111-1111-111111111111'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/customers'),false);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/listings'),false);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/finance/receivables'),false);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/admin/leave-register'),true);
  assert.equal(governedRoleRequestAllowed(admin,'POST','/admin/leave-policy-versions'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/tasks'),true);
  assert.equal(governedRoleRequestAllowed(admin,'GET','/crm/purchased-data-import/batches'),true);
  assert.equal(canReadLead(admin,{assignedTo:admin.id}),false);
  assert.equal(canReadOpportunity(admin,{ownerId:admin.id}),false);
  assert.equal(isCompanyReader(admin),false);
  assert.equal(isCompanyReader(director),true);
});

test('the former Admin Assistant assignment is retired and cannot retain access',()=>{
  assert.equal(governedRoleRequestAllowed(retiredAssistant,'GET','/admin/leave-register'),false);
  assert.equal(governedRoleRequestAllowed(retiredAssistant,'GET','/crm/customers'),false);
  assert.equal(governedRoleRequestAllowed(retiredAssistant,'GET','/admin/brokers'),false);
  assert.equal(mayMaintainLeave(retiredAssistant),false);
  assert.equal(mayMaintainLeave(admin),true);
  assert.equal(mayDecideLeave({broker:admin,application:{applicantId:'agent',approverId:admin.id}}),false);
  assert.equal(mayDecideLeave({broker:director,application:{applicantId:'agent',approverId:director.id}}),true);
  assert.equal(mayDecideLeave({broker:director,application:{applicantId:'agent',approverId:'other-manager'}}),false);
});

test('role access separates Admin maintenance from Line Manager leave decisions',()=>{
  assert.equal(hasCapability(admin,CAPABILITY.LEAVE_ADMINISTER),true);
  assert.equal(hasCapability(admin,CAPABILITY.LEAVE_DECIDE),false);
  assert.equal(hasCapability(director,CAPABILITY.LEAVE_DECIDE),true);
  assert.deepEqual(LEAVE_WORKFLOW_POLICY.approverJobRoles,[JOB_ROLE.MANAGER,JOB_ROLE.DIRECTOR]);
  assert.equal(LEAVE_WORKFLOW_POLICY.routingReason,'leave_to_line_manager');
  assert.equal(LEAVE_WORKFLOW_POLICY.approverLabel,'Line Manager');
  assert.equal(ROLE_ACCESS_POLICY.admin.label,'Admin');
  assert.deepEqual(ROLE_ACCESS_POLICY.admin.workspaceTabs,['admin','purchasedDataImport','myLeave','leaveAdministration']);
  assert.equal(hasCapability(admin,CAPABILITY.PURCHASED_DATA_IMPORT),true);
  assert.equal(hasCapability(salesAgent,CAPABILITY.PURCHASED_DATA_IMPORT),true);
  assert.equal(hasCapability(salesAgent,CAPABILITY.INVENTORY_CREATE),true);
  assert.equal(hasCapability(director,CAPABILITY.PURCHASED_DATA_IMPORT),false);
  assert.ok(GOVERNED_API_POLICY.every(rule=>rule.capability&&rule.methods.length&&rule.pattern instanceof RegExp));
  const auth=fs.readFileSync(new URL('../src/auth.js',import.meta.url),'utf8');
  assert.match(auth,/governedAccessProfile\(b\)/);
  assert.match(auth,/capabilities=\[\.\.\.capabilitiesFor\(b\)\]/);
  assert.match(auth,/accessPolicy:\{label:profile\.label,capabilities,/);
});

test('UI sends Admin directly to one Administration workspace with no Assistant role',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/Administrator dashboard|System administration|Open Administration/);
  assert.doesNotMatch(app,/Assistant workspace|admin_assistant:'Assistant'/);
  assert.match(app,/Leave Administration/);
  assert.doesNotMatch(app,/data-admin-leave-review/);
  assert.match(app,/Assigned Line Managers decide submitted leave from My Tasks/);
  assert.match(app,/accessPolicy\?\.workspaceTabs/);
  assert.match(app,/if\(!ME\.accessPolicy\)try\{/);
  assert.match(app,/initialTab==='admin'\?renderAdmin\(\):renderDashboard\(\)/);
  assert.match(app,/admin-maintenance-select/);
  assert.doesNotMatch(app,/\['integration_failures','Integration failures'\]/);
  assert.doesNotMatch(app,/workspace\.innerHTML='<aside class="admin-maintenance-nav"/);
  assert.doesNotMatch(app,/ME\.role==='admin'\?`<button data-tab="dashboard"/);
  const route=fs.readFileSync(new URL('../src/routes/agent-leave.js',import.meta.url),'utf8');
  assert.doesNotMatch(route,/job_role='admin_assistant'/);
  assert.doesNotMatch(route,/Full Administrator access required/);
  assert.match(route,/Admin leave-administration access required/);
  assert.match(route,/activeLineManager\(employment,app\.applicantId,client\)/);
  assert.match(route,/employment\.reportingManagerId/);
});

test('Admin configuration references do not restore business-record access',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const operations=fs.readFileSync(new URL('../src/routes/lead-operations.js',import.meta.url),'utf8');
  assert.equal(hasNysaStaffIdentity(admin),true);
  assert.equal(hasInternalCrmIdentity(admin),false);
  assert.match(crm,/if \(!hasNysaStaffIdentity\(req\.broker\)\)/);
  assert.doesNotMatch(crm,/if \(!hasInternalCrmIdentity\(req\.broker\)\)/);
  assert.match(operations,/r\.use\(requireAuth, staffOnly\)/);
  assert.match(operations,/if\(!hasNysaStaffIdentity\(req\.broker\)\)/);
  assert.doesNotMatch(operations,/if\(!hasInternalCrmIdentity\(req\.broker\)\)/);
  assert.match(crm,/hasCapability\(req\.broker,CAPABILITY\.STAFF_CONFIGURATION_REFERENCE_READ\)/);
  assert.match(crm,/hasCapability\(req\.broker,CAPABILITY\.TEAM_CONFIGURATION\)/);
  assert.match(crm,/Admin team-configuration access required/);
  assert.doesNotMatch(crm,/Only administrators and Admin Assistants can (?:create|edit) teams/);
  for(const path of ['/crm/customers','/crm/leads','/crm/opportunities','/listings','/finance/receivables','/commission-payments'])
    assert.equal(governedRoleRequestAllowed(admin,'GET',path),false,path);
});

test('Admin maintenance allow-list composes with the CRM staff boundary without opening business processes',()=>{
  const allowed=[
    ['GET','/admin/organization-settings'],['POST','/admin/organization-settings'],
    ['GET','/admin/value-sets'],['POST','/admin/value-sets'],
    ['GET','/admin/sla-policies'],['GET','/admin/areas'],
    ['GET','/admin/listing-mappings'],['GET','/admin/routing-rules'],
    ['GET','/admin/qualification-models'],['GET','/admin/regulatory-assumptions'],
    ['GET','/admin/proposal-templates'],['GET','/admin/market-communities'],
    ['GET','/admin/commission-payout-policies'],['GET','/admin/document-compliance/requirements'],
    ['GET','/admin/official-document-definitions'],['GET','/admin/document-templates'],
    ['GET','/admin/dashboard-targets'],['GET','/admin/property-media-approval-policy'],
    ['GET','/admin/listing-approval-policy'],['GET','/admin/users'],
    ['PUT','/admin/users/11111111-1111-1111-1111-111111111111/business-areas'],
    ['GET','/crm/staff'],['GET','/crm/teams'],['POST','/crm/teams'],
    ['PATCH','/crm/teams/11111111-1111-1111-1111-111111111111'],
    ['GET','/crm/controlled-values/document_type'],['GET','/crm/organization'],
    ['GET','/crm/tasks'],['PATCH','/crm/tasks/11111111-1111-1111-1111-111111111111']
  ];
  for(const [method,path] of allowed){
    assert.equal(governedRoleRequestAllowed(admin,method,path),true,`${method} ${path} central capability`);
    assert.equal(hasNysaStaffIdentity(admin),true,`${method} ${path} CRM staff boundary`);
  }
  const denied=[
    ['GET','/crm/customers'],['POST','/crm/contacts'],['GET','/crm/leads'],
    ['POST','/crm/leads'],['GET','/crm/opportunities'],['POST','/crm/opportunities'],
    ['GET','/crm/companies'],['POST','/crm/companies'],['GET','/listings'],
    ['POST','/listings'],['GET','/finance/receivables'],['POST','/commission-payments']
  ];
  for(const [method,path] of denied)
    assert.equal(governedRoleRequestAllowed(admin,method,path),false,`${method} ${path} must fail before routing`);
});

test('every mixed Administration router recognizes Admin as NYSA staff after central capability authorization',()=>{
  const mixedRouters=[
    'src/routes/governance.js','src/routes/dashboards.js','src/routes/dld-market-intelligence.js',
    'src/routes/document-compliance.js','src/routes/files-proposals.js','src/routes/qualification-finance.js'
  ];
  for(const file of mixedRouters){
    const source=fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/hasNysaStaffIdentity\(req\.broker\)/,`${file} must accept central-authorized Admin maintenance requests`);
    assert.doesNotMatch(source,/hasInternalCrmIdentity\(req\.broker\)/,`${file} must not reclassify Admin as external staff`);
  }
});

test('every Administration selector label maps to its own panel instead of a render position',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/definitions\[index\]/);
  assert.match(app,/definitions\.get\(heading\)/);
  const expected=[
    ['NYSA company profile and document defaults','organization','Company profile'],
    ['Controlled values','controlled_values','Controlled values'],
    ['Business hours and SLA policies','sla','Business hours & SLA'],
    ['Area maintenance','areas','Area maintenance'],
    ['Provider listing mappings','listing_mappings','Provider listing mappings'],
    ['Lead routing rules and assignment queues','routing','Lead routing & queues'],
    ['Lead Qualification Versions','qualification','Lead qualification'],
    ['Regulatory and transaction fee rules','fees','Regulatory & fee rules'],
    ['NYSA Proposal Template Designer','proposals','Proposal designer'],
    ['DLD market data and Area mapping','market_intelligence','Market intelligence'],
    ['Commission and payout policy','commission_policy','Commission & payout policy'],
    ['Customer documents','customer_documents','Customer documents'],
    ['Transaction documents','document_compliance','Transaction documents'],
    ['Official document requirements','official_documents','Official document requirements'],
    ['Controlled document templates','documents','Controlled document templates'],
    ['Dashboard targets and exception alerts','targets','Dashboard targets'],
    ['CRM teams','teams','CRM teams'],
    ['Property media approval policy','media_policy','Property media policy'],
    ['Listing approval policy','listing_policy','Listing approval policy'],
    ['User Management','users','User management'],
    ['User records','user_records','User records'],
    ['Audit and Operations log','operations','Operations & audit'],
    ['About NYSA CORE','about','About']
  ];
  for(const [heading,key,label] of expected)
    assert.ok(app.includes(`['${heading}',['${key}','${label}']]`),`${label} mapping`);
});
