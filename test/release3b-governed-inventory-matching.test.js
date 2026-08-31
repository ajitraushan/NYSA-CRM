import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryEligibility,buildGovernedMatchingRun,validateInventoryMatchDecision,validateInventoryMatchFeedback,INVENTORY_MATCHING_POLICY_VERSION } from '../src/governed-matching-domain.js';
import { detectWebsiteRequirementConflicts,requirementAuthorityHash,validateRequirementConfirmation,validateRequirementConflictResolution } from '../src/requirement-confirmation-domain.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const base={id:'00000000-0000-0000-0000-000000000001',inventoryReference:'NYSA-INV-1',project:'Marina Home',area:'Dubai Marina',
  propertyType:'Apartment',bedrooms:'2',price:2200000,currency:'AED',status:'Available',effectiveStatus:'Available',workflowStatus:'approved',
  verificationStatus:'verified',verificationExpiresAt:'2026-09-01T00:00:00.000Z',availabilityConfirmedAt:'2026-08-01T00:00:00.000Z',activeReservation:false};
const requirement={id:'10000000-0000-0000-0000-000000000001',versionNo:2,businessLine:'Sale',purpose:'own_use',areas:['Dubai Marina'],
  propertyTypes:['Apartment'],budgetMin:2000000,budgetMax:2500000,fundingMethod:'mortgage',bedroomsMin:2,bedroomsMax:2,
  timelineCode:'0_3_months'};

test('R3B-AI-MATCH-49 permits shared consideration and excludes governed-ineligible Inventory before ranking',()=>{
  const excluded=[
    {...base,id:'3',effectiveStatus:'Sold'},
    {...base,id:'4',workflowStatus:'draft'},
    {...base,id:'5',verificationStatus:'pending'},
    {...base,id:'6',verificationExpiresAt:'2026-07-31T23:59:59.000Z'}
  ];
  for(const listing of excluded)assert.equal(inventoryEligibility(listing,'2026-08-02T00:00:00.000Z').eligible,false);
  const shared={...base,id:'2',effectiveStatus:'Reserved',activeReservation:true};
  assert.equal(inventoryEligibility(shared,'2026-08-02T00:00:00.000Z').eligible,true);
  const run=buildGovernedMatchingRun(requirement,[base,shared,...excluded],'2026-08-02T00:00:00.000Z');
  assert.equal(run.eligibleCount,2);assert.equal(run.excludedCount,4);
  assert.deepEqual(run.candidates.filter(x=>x.eligibilityStatus==='eligible').map(x=>x.listingId),[base.id,shared.id]);
  assert.ok(run.candidates.filter(x=>x.eligibilityStatus==='excluded').every(x=>x.presentedRank===null&&x.score===null));
});

test('R3B-EXPLAINABILITY-50 creates deterministic ranked evidence without an operational commitment',()=>{
  const weaker={...base,id:'00000000-0000-0000-0000-000000000002',inventoryReference:'NYSA-INV-2',project:'Downtown Home',area:'Downtown Dubai',price:2700000};
  const first=buildGovernedMatchingRun(requirement,[weaker,base],'2026-08-02T00:00:00.000Z');
  const replay=buildGovernedMatchingRun(requirement,[weaker,base],'2026-08-02T00:00:00.000Z');
  assert.equal(first.policyVersion,INVENTORY_MATCHING_POLICY_VERSION);assert.equal(first.evidenceHash,replay.evidenceHash);
  assert.deepEqual(first.candidates.map(x=>x.listingId),[base.id,weaker.id]);
  assert.equal(first.candidates[0].presentedRank,1);assert.equal(first.candidates[0].score,100);
  assert.ok(first.candidates[1].criteria.some(x=>x.code==='area'&&!x.pass));
  assert.ok(first.candidates[1].criteria.some(x=>x.code==='budget'&&!x.pass));
});

test('R3B governed matching is immutable, broker-triggered and separate from website suggestions',()=>{
  const migration=read('src/migrations/075_release3b_governed_inventory_matching.sql'),route=read('src/routes/governed-matching.js'),
    server=read('src/server.js'),ui=read('public/app.js');
  for(const marker of ['inventory_matching_runs','inventory_matching_candidates','requirement_snapshot','evidence_hash','prevent_release2_immutable_evidence_mutation'])assert.match(migration,new RegExp(marker));
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(route,/canOperateLead/);assert.match(migration,/broker_requested/);assert.match(route,/automaticCommitment:false/);
  assert.match(route,/websiteSuggestionsIncluded:false/);assert.match(route,/reservesInventory:false/);
  assert.match(server,/governedMatchingRoutes/);
  assert.match(ui,/Match available Inventory/);assert.match(ui,/does not create a CRM property match/);assert.match(ui,/Website AI suggestions are not included/);
});

test('R3B-FEEDBACK-51 validates controlled broker decisions and immutable property feedback evidence',()=>{
  assert.equal(validateInventoryMatchDecision({decision:'rejected',reasonCode:'budget'}).error,'Decision notes are required');
  assert.equal(validateInventoryMatchDecision({decision:'shortlisted',reasonCode:'strong_fit',reasonNotes:'Exact recorded requirement fit'}).value.decision,'shortlisted');
  assert.match(validateInventoryMatchFeedback({outcome:'unknown',sourceKind:'customer_reported',reasonCode:'other',notes:'Recorded'}).error,/controlled property feedback outcome/);
  const feedback=validateInventoryMatchFeedback({outcome:'more_options',sourceKind:'customer_reported',reasonCode:'customer_preference',notes:'Customer asked to compare another layout',occurredAt:'2026-08-02T10:00:00Z'});
  assert.equal(feedback.value.sourceKind,'customer_reported');assert.equal(feedback.value.outcome,'more_options');
});

test('R3B-FEEDBACK-51 migration and route integration are append-only scoped and concurrency aware',()=>{
  const migration=read('src/migrations/076_release3b_match_decisions_and_feedback.sql'),route=read('src/routes/governed-matching.js'),ui=read('public/app.js');
  for(const marker of ['matching_policy_versions','inventory_match_decisions','inventory_match_feedback','previous_decision_id','live_eligibility','prevent_release2_immutable_evidence_mutation'])assert.match(migration,new RegExp(marker));
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(route,/canOperateLead/);assert.match(route,/FOR UPDATE OF c/);assert.match(route,/FOR UPDATE OF li/);
  assert.match(route,/expectedPreviousDecisionId/);assert.match(route,/evaluateInventoryEligibilityV2/);
  assert.match(route,/createsPropertyMatch:Boolean\(governedAssignment\)/);assert.match(route,/createsInventoryAssignment:Boolean\(governedAssignment\)/);assert.match(route,/reservesInventory:false/);
  for(const marker of ['Shortlist','Defer','Reject','Record immutable property feedback','Customer reported','Property feedback recorded as governed evidence'])assert.match(ui,new RegExp(marker));
});

test('R3B-REQUIREMENT-47 detects only materially changed website evidence and hashes the exact governed version',()=>{
  const prior={businessLine:'Sale',purpose:'own_use',propertyTypes:['Apartment'],areas:['Dubai Marina'],budgetMin:'2000000.00',budgetMax:2500000,
    fundingMethod:'mortgage',bedroomsMin:2,bedroomsMax:2,timelineCode:'0_3_months',declaredPriorities:['View'],mustHaves:[],preferences:[],exclusions:[],acceptableTradeOffs:[]};
  const conflicts=detectWebsiteRequirementConflicts(prior,{areas:['dubai marina'],budgetMin:2000000,budgetMax:2700000,fundingMethod:'cash'});
  assert.deepEqual(conflicts.map(item=>item.fieldCode),['budget_max','funding_method']);
  assert.equal(requirementAuthorityHash(prior),requirementAuthorityHash({...prior,unrelatedMetadata:'ignored'}));
  assert.match(requirementAuthorityHash(prior),/^[a-f0-9]{64}$/);
});

test('R3B-REQUIREMENT-47 confirmation and website conflict resolutions require controlled evidence',()=>{
  assert.match(validateRequirementConfirmation({confirmationBasis:'direct_customer'}).error,/notes/);
  assert.equal(validateRequirementConfirmation({confirmationBasis:'direct_customer',confirmationNotes:'Confirmed on recorded call'}).value.confirmationBasis,'direct_customer');
  assert.match(validateRequirementConflictResolution({resolution:'ignored',resolutionNotes:'No'}).error,/valid website conflict resolution/);
  assert.equal(validateRequirementConflictResolution({resolution:'requires_new_version',resolutionNotes:'Customer corrected the budget'}).value.resolution,'requires_new_version');
});

test('R3B-REQUIREMENT-47 migration APIs UI and matching gate preserve exact-version authority',()=>{
  const migration=read('src/migrations/077_release3b_requirement_confirmation.sql'),leadRoutes=read('src/routes/lead-operations.js'),
    matchingRoutes=read('src/routes/governed-matching.js'),websiteRoutes=read('src/routes/website-intake.js'),ui=read('public/app.js');
  for(const marker of ['lead_requirement_website_conflicts','lead_requirement_conflict_resolutions','lead_requirement_confirmations','requirement_snapshot_hash','prevent_release2_immutable_evidence_mutation'])assert.match(migration,new RegExp(marker));
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(leadRoutes,/requirementAuthorityHash/);assert.match(leadRoutes,/Resolve every declared website conflict before confirming/);
  assert.match(websiteRoutes,/detectWebsiteRequirementConflicts/);assert.match(websiteRoutes,/declaredRequirementConflicts/);
  assert.match(matchingRoutes,/must be broker-confirmed before matching Inventory/);assert.match(matchingRoutes,/Every declared website conflict must be explicitly resolved/);
  assert.match(matchingRoutes,/FOR SHARE OF lr/);assert.match(matchingRoutes,/FOR SHARE OF li/);
  for(const marker of ['Matching authority · exact version','Broker-confirmed','Confirm current value','Require corrected version','Confirm exact requirement version','Matching remains blocked'])assert.match(ui,new RegExp(marker));
});
