import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAPABILITY,GOVERNED_API_POLICY,JOB_ROLE,LEAVE_WORKFLOW_POLICY,ROLE_ACCESS_POLICY,governedRoleRequestAllowed,hasCapability,principalForCapability} from '../src/role-access.js';
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
  assert.equal(mayDecideLeave({broker:admin,application:{applicantId:'agent'}}),true);
  assert.equal(mayDecideLeave({broker:admin,application:{applicantId:admin.id}}),false);
  assert.equal(mayDecideLeave({broker:director,application:{applicantId:'agent'}}),false);
});

test('role access, route access and leave routing are resolved from central Admin policy',()=>{
  assert.equal(hasCapability(admin,CAPABILITY.LEAVE_ADMINISTER),true);
  assert.deepEqual(principalForCapability(CAPABILITY.LEAVE_DECIDE),{accountRole:'admin',jobRole:JOB_ROLE.ADMINISTRATOR});
  assert.equal(LEAVE_WORKFLOW_POLICY.approverAccountRole,'admin');
  assert.equal(LEAVE_WORKFLOW_POLICY.approverJobRole,JOB_ROLE.ADMINISTRATOR);
  assert.equal(LEAVE_WORKFLOW_POLICY.approverLabel,'Admin');
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
  assert.match(app,/Review and decide/);
  assert.match(app,/Admin records the governed decision/);
  assert.match(app,/accessPolicy\?\.workspaceTabs/);
  assert.match(app,/if\(!ME\.accessPolicy\)try\{/);
  assert.match(app,/initialTab==='admin'\?renderAdmin\(\):renderDashboard\(\)/);
  assert.match(app,/admin-maintenance-select/);
  assert.doesNotMatch(app,/workspace\.innerHTML='<aside class="admin-maintenance-nav"/);
  assert.doesNotMatch(app,/ME\.role==='admin'\?`<button data-tab="dashboard"/);
  const route=fs.readFileSync(new URL('../src/routes/agent-leave.js',import.meta.url),'utf8');
  assert.doesNotMatch(route,/job_role='admin_assistant'/);
  assert.doesNotMatch(route,/Full Administrator access required/);
  assert.match(route,/Admin leave-administration access required/);
  assert.match(route,/principalForCapability\(LEAVE_WORKFLOW_POLICY\.decisionCapability\)/);
  assert.match(route,/WHERE role=\$2 AND job_role=\$3/);
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
