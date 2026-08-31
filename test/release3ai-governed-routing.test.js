import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routingReason,websiteAiRoutingDecision } from '../src/website-ai-routing.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const body=(form,decision)=>({form,businessType:'Sale',sourceEvidence:{sourceSpecific:{aiRoutingDecision:decision}}});

test('AI Advisory defers team routing until Property Selection',()=>{
  const decision=websiteAiRoutingDecision(body('ai_advisory_v1',{status:'awaiting_property_selection',businessType:null,reason:'Awaiting Property Selection'}));
  assert.equal(decision.status,'awaiting_property_selection');
  assert.equal(decision.businessType,null);
  assert.equal(routingReason(decision,null),'Website AI routing pending completed Property Selection');
});

test('signed Property Selection decisions accept only Sale or Off-plan',()=>{
  assert.equal(websiteAiRoutingDecision(body('ai_property_selection_v1',{status:'determined',businessType:'Sale',reason:'Ready property'})).businessType,'Sale');
  assert.equal(websiteAiRoutingDecision(body('ai_property_selection_v1',{status:'determined',businessType:'Off-plan',reason:'Off-plan'})).businessType,'Off-plan');
  assert.equal(websiteAiRoutingDecision(body('ai_property_selection_v1',{status:'determined',businessType:'Rental',reason:'Invalid'})).status,'review_required');
});

test('connector maps the real staging status values and ambiguous route safely',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  for(const marker of ["statusCode === 'ready'","statusCode === 'offplan'","statusCode === 'handover'","statusCode === 'either'",'Developer payment-plan opportunity','Family villa or townhouse play'])assert.match(bridge,new RegExp(marker));
  assert.match(bridge,/businessType = 'Sale'/);assert.match(bridge,/businessType = 'Off-plan'/);assert.match(bridge,/status = 'review_required'/);
});

test('CRM reroutes only unassigned journey Leads and preserves assigned ownership for manager review',()=>{
  const route=read('src/routes/website-intake.js'),migration=read('src/migrations/074_release3ai_governed_website_routing.sql'),plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(route,/applyContinuationAiRouting/);assert.match(route,/if\(lead\.assignedTo&&requiresChange\)return queueRoutingReview/);
  assert.match(route,/Review Website AI routing change/);assert.match(route,/Website AI routing decision before agent assignment/);
  assert.match(migration,/ai_routing_status/);assert.match(migration,/ai_routing_decision JSONB/);assert.doesNotMatch(migration,/schema_migrations/);
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');assert.match(plugin,/VERSION = '1.9.4'/);
});

test('dev.110 deployment is checksum-bound, rerunnable and CRM-Test-only',()=>{
  const deployment=read('release-artifacts/release-3/r3a/deploy-crm-test-r3ai-dev110-complete.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.110','PREVIOUS_VERSION=2.1.0-dev.109','EXPECTED_PACKAGE=nysa-core-r3ai-governed-website-routing-dev110.zip','PREVIOUS_MIGRATION=073_release3ai_lossless_website_recommendations.sql','LATEST_MIGRATION=074_release3ai_governed_website_routing.sql','sha256sum -c','Deployment already confirmed','Production and R2 clone snapshots: unchanged'])assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(deployment,/EXPECTED_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(deployment,/installed_migration.*74\|\$LATEST_MIGRATION/);
});
