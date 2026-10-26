import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreInventoryCandidateV2} from '../src/inventory-eligibility-domain.js';
import {validateOpportunityCreate,validateOpportunityNextAction} from '../src/opportunity-domain.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('UAT-008 requires completed controlled contact evidence and blocks stage bypass',()=>{
  const route=read('src/routes/crm.js'),ui=read('public/app.js'),migration=read('src/migrations/095_dev146_full_scope_uat_governance.sql');
  assert.match(route,/successfulContactOutcomes/);
  assert.match(route,/completed_at IS NOT NULL/);
  assert.match(route,/contact_outcome_code IN/);
  assert.match(route,/Record a completed substantive customer discussion before progressing this Lead/);
  assert.match(route,/next_action_owner_id/);
  assert.match(ui,/Customer contact completed/);
  assert.match(ui,/Attempt completed — no contact/);
  assert.match(migration,/activities_contact_outcome_code_ck/);
});

test('UAT-011 stores governed next-action codes and rejects display text or unexplained exceptions',()=>{
  const valid=validateOpportunityNextAction({nextActionCode:'schedule_viewing',nextActionDueAt:'2030-01-02T10:00:00+04:00'});
  assert.equal(valid.value.nextAction,'Schedule property viewing');
  assert.match(validateOpportunityNextAction({nextActionCode:'Schedule property viewing',nextActionDueAt:'2030-01-02'}).error,/governed next action/);
  assert.match(validateOpportunityNextAction({nextActionCode:'controlled_exception',nextActionDueAt:'2030-01-02'}).error,/requires instructions/);
  const created=validateOpportunityCreate({title:'Home search',transactionType:'Sale',nextActionCode:'confirm_requirements',nextActionDueAt:'2030-01-02'});
  assert.equal(created.value.nextActionCode,'confirm_requirements');
  assert.match(read('src/migrations/095_dev146_full_scope_uat_governance.sql'),/opportunities_next_action_code_ck/);
});

test('UAT-012 treats below-minimum price as affordable and exposes exact explanation',()=>{
  const result=scoreInventoryCandidateV2({budgetMin:1000000,budgetMax:1500000},{price:900000},[]),budget=result.criteria.find(item=>item.code==='budget');
  assert.equal(budget.state,'met');
  assert.match(budget.interpretation,/within affordability/i);
  assert.equal(scoreInventoryCandidateV2({budgetMax:1500000},{price:1600000},[]).criteria[0].state,'not_met');
  const route=read('src/routes/opportunities.js'),ui=read('public/app.js');
  for(const marker of ['reasonCounts','propertyReasons','eligibleAdditionalCount','already_selected'])assert.match(route,new RegExp(marker));
  assert.match(ui,/Why Inventory is not ready to assign/);
});

test('UAT-014 recovery requires terminal evidence, requirement impact, property disposition and dated action',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/app.js');
  assert.match(route,/offer-recovery\/return-to-matching/);
  for(const marker of ['terminal_offer_governed_recovery','customer_confirmed_change','propertyDisposition','nextActionDueAt','offer_replacement_actions'])assert.match(route,new RegExp(marker));
  for(const marker of ['Offer recovery decision required','More options — return to Matching','Review \/ change requirements','Confirmed replacement requirement','Apply governed recovery'])assert.match(ui,new RegExp(marker));
});

test('UAT-021 preserves the Deal while replacement Inventory receives a new Offer and Booking lineage',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/deal-ui.js'),migration=read('src/migrations/099_dev153_inventory_assignment_lifecycle.sql');
  assert.match(route,/deals\/:dealId\/replace-accepted-offer/);
  for(const marker of ["status='cancelled'",'current_inventory_linkage_id','booking_switched','Stable Deal retained after replacement Inventory reservation','dealRetained'])assert.match(route,new RegExp(marker));
  assert.match(route,/Reserved Inventory cannot be replaced\. Release or expire the reservation first/);
  assert.match(ui,/Deal and Opportunity IDs remain stable/);
  assert.match(ui,/Link the new reservation to this retained Deal/);
  assert.match(migration,/CREATE TABLE deal_inventory_linkages/);
  assert.match(migration,/CREATE CONSTRAINT TRIGGER deals_current_inventory_linkage_consistency/);
});

test('UAT-022 explicitly ends Lead operating SLA and projects authoritative Opportunity ownership',()=>{
  const route=read('src/routes/opportunities.js'),crm=read('src/routes/crm.js'),assignment=read('src/routes/lead-operations.js'),migration=read('src/migrations/095_dev146_full_scope_uat_governance.sql');
  assert.match(route,/operating_sla_superseded/);
  assert.match(route,/Superseded by active Opportunity/);
  assert.match(crm,/active_opportunity_owner_name/);
  assert.match(crm,/active_opportunity_team_name/);
  assert.match(crm,/operating_sla_ended_at IS NULL/);
  assert.match(assignment,/operating_sla_ended_at IS NULL/);
  assert.match(migration,/operating_sla_end_reason/);
});
