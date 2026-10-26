import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_ORIGIN,APPLY_CONFIRMATION,EXPECTED_VERSION,approvedBaseUrl,buildPlan } from '../scripts/dev158-manual-uat-provisioner.mjs';

test('dev.158 UAT provisioning plan has the complete reusable baseline',()=>{
  const plan=buildPlan();
  assert.equal(plan.targetVersion,EXPECTED_VERSION);
  assert.deepEqual(plan.counts,{existingAdministrator:1,areas:5,teams:4,additionalUsers:8,companies:5,customers:12,additionalContacts:4,duplicateDrafts:1,routingRules:5,leads:16,inventory:16,counterparties:4});
  assert.equal(plan.users.length,8);
  assert.deepEqual(new Set(plan.users.map(x=>x.jobRole)),new Set(['director','manager','sales_agent','listing_agent','accountant']));
  assert.equal(new Set(plan.leads.map(x=>x.code)).size,16);
  assert.equal(new Set(plan.inventory.map(x=>x.unitReference)).size,16);
  assert.ok(plan.leads.some(x=>x.code==='MATCH-520-01'));
  assert.ok(plan.inventory.some(x=>x.code==='APT-520'&&x.sizeSqft===520));
  assert.deepEqual(plan.routingRules.map(x=>x.priority),[10,20,30,50,9999]);
  assert.ok(!plan.routingRules.some(x=>x.priority===15));
});

test('provisioning target is restricted to exact CRM Test origin',()=>{
  assert.equal(approvedBaseUrl(APPROVED_ORIGIN),APPROVED_ORIGIN);
  for(const unsafe of ['https://nysarealty.com','https://crm-test.nysarealty.com/path','https://user:secret@crm-test.nysarealty.com','http://crm-test.nysarealty.com'])
    assert.throws(()=>approvedBaseUrl(unsafe),/Refusing non-approved base URL/);
});

test('human behavior under test and external integrations are excluded',()=>{
  const text=buildPlan().excludedWorkflowActions.join(' ');
  for(const phrase of ['acceptance','rejection','rerouting','qualification','verification','availability','closure','Opportunity','offer','booking','Property Finder'])
    assert.match(text,new RegExp(phrase,'i'));
  assert.equal(APPLY_CONFIRMATION,'CRM_TEST_DEV158_UAT_DATA_PROVISION_CONFIRMED');
});

test('all generated identities are visibly synthetic and use reserved/non-routable values',()=>{
  const plan=buildPlan();
  assert.ok(plan.customers.every(x=>x.fullName.startsWith('UAT158-HUMAN ')));
  assert.ok(plan.customers.every(x=>x.email.endsWith('@example.invalid')));
  assert.ok(plan.customers.every(x=>x.phone.startsWith('+999158')));
});
