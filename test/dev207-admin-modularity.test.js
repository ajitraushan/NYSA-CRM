import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasInternalCrmIdentity,hasNysaStaffIdentity} from '../src/crm-policy.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Admin is NYSA staff but is not an operational CRM identity',()=>{
  const admin={role:'admin',jobRole:'admin'};
  assert.equal(hasNysaStaffIdentity(admin),true);
  assert.equal(hasInternalCrmIdentity(admin),false);
  assert.equal(hasNysaStaffIdentity({role:'internal_broker',jobRole:'sales_agent'}),true);
  assert.equal(hasNysaStaffIdentity({role:'internal_broker',jobRole:'admin_assistant'}),false);
  assert.equal(hasNysaStaffIdentity({role:'partner',jobRole:'sales_agent'}),false);
  const policy=read('src/crm-policy.js');
  assert.match(policy,/export function hasNysaStaffIdentity/);
  assert.match(policy,/broker\.role === 'admin'/);
  assert.doesNotMatch(policy,/\['admin','internal_broker'\]\.includes\(broker\.role\)/);
});

test('business domains contain no retired Assistant or Admin review bypass',()=>{
  const files=[
    'src/inventory-agent-governance.js','src/marketing-material-compliance-domain.js',
    'src/routes/listings.js','src/routes/opportunities.js','src/routes/campaigns.js',
    'src/routes/inventory-import.js','src/routes/listing-intake.js','src/routes/partner-organizations.js'
  ];
  for(const file of files)assert.doesNotMatch(read(file),/admin_assistant/,file);
  assert.doesNotMatch(read('src/marketing-material-compliance-domain.js'),/broker\.role==='admin'/);
  assert.doesNotMatch(read('src/inventory-agent-governance.js'),/broker\.role==='admin'/);
  assert.doesNotMatch(read('src/routes/opportunities.js'),/broker\.role==='admin'/);
  assert.doesNotMatch(read('src/commission-proof.js'),/actor\.role==='admin'/);
  assert.doesNotMatch(read('src/dashboard-domain.js'),/role==='admin'\|\|broker\?\.jobRole==='director'/);
  assert.match(read('src/routes/property-finder-sandbox.js'),/jobRole === 'director'/);
});

test('browser business workspaces do not grant Admin operational authority',()=>{
  const app=read('public/app.js');
  assert.doesNotMatch(app,/ME\.role==='admin'\|\|\['manager','director'\]/);
  assert.doesNotMatch(app,/ME\.role==='admin'\|\|ME\.jobRole==='manager'/);
  assert.doesNotMatch(app,/ME\.jobRole==='director'\|\|ME\.role==='admin'/);
  assert.doesNotMatch(read('public/opportunity-finance-ui.js'),/ME\.role==='admin'/);
  assert.doesNotMatch(read('public/dashboard-ui.js'),/ME\.role==='admin'/);
  assert.doesNotMatch(read('public/receivables-ui.js'),/ME\.role==='admin'/);
  assert.match(read('public/document-compliance-ui.js'),/const canReview=\(\)=>\['manager','director'\]\.includes\(ME\?\.jobRole\)/);
  assert.doesNotMatch(read('public/commission-payout-ui.js'),/ME\.role==='admin'\|\|\['accountant','director'\]/);
});

test('active role catalogue and account selector present the role as Admin',()=>{
  const app=read('public/app.js'),roles=read('src/role-access.js'),domain=read('src/crm-domain.js');
  assert.match(app,/admin:'Admin'/);
  assert.match(app,/<option value="admin">Admin<\/option>/);
  assert.doesNotMatch(app,/admin_assistant:'Assistant'/);
  assert.match(roles,/label:'Admin'/);
  assert.doesNotMatch(domain,/admin_assistant/);
});

test('active user-facing JavaScript consistently calls the role Admin',()=>{
  const files=['public/app.js','public/commission-payout-ui.js','public/document-compliance-ui.js',
    'src/routes/admin.js','src/routes/auth.js','src/routes/commission-payout.js','src/routes/crm.js',
    'src/routes/document-compliance.js','src/routes/files-proposals.js','src/routes/integrations.js',
    'src/routes/inventory-import.js','src/routes/lead-operations.js','src/routes/qualification-finance.js',
    'src/routes/release3c-governed-shares.js','src/routes/website-intake.js'];
  for(const file of files){
    assert.doesNotMatch(read(file),/["'`]([^"'`]*\bAdministrator\b)/,file);
    assert.doesNotMatch(read(file),/["'`]([^"'`]*\badministrator\b)/,file);
  }
});
