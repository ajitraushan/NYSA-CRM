import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGovernedMatchingRunV2} from '../src/governed-matching-domain.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-082 journey completes Requirements only after confirmation and exact Opportunity alignment',()=>{
  const route=read('src/routes/crm.js'),opportunities=read('src/routes/opportunities.js'),app=read('public/app.js'),migration=read('src/migrations/106_dev165_opportunity_requirement_realignment.sql');
  assert.match(route,/requirementConfirmed&&opportunityRequirementAligned\?'completed':'current'/);
  assert.match(route,/requires broker confirmation before matching/);
  assert.match(route,/is not the version linked to/);
  assert.match(route,/Align the Opportunity to the current confirmed Requirement/);
  assert.match(opportunities,/\/crm\/opportunities\/:id\/requirement-alignment/);
  assert.match(opportunities,/requirement_version_aligned/);
  assert.match(opportunities,/inventory_assignment_events/);
  assert.match(opportunities,/property_match_history/);
  assert.match(app,/Review and align/);
  assert.match(app,/acknowledgeStaleMatching/);
  assert.match(migration,/property_matches_opportunity_requirement_listing_uq/);
});

test('UAT-083 Opportunity workspace identifies deterministic ranking and binds the exact Opportunity',()=>{
  const app=read('public/app.js'),ui=read('public/matching-completion-ui.js');
  assert.match(app,/Inventory recommendation and assignment/);
  assert.match(app,/Rank available Inventory/);
  assert.match(app,/body:\{opportunityId:opportunity\.id\}/);
  assert.doesNotMatch(app,/Run AI-assisted Inventory ranking/);
  assert.match(ui,/Deterministic · advisory ranking/);
});

test('UAT-084 reviewed AI narrative is retained in authoritative Requirement and matching context',()=>{
  const requirement={id:'req',versionNo:2,businessLine:'Sale',purpose:'own_use',areas:['Dubai South'],propertyTypes:['Apartment'],fundingMethod:'cash',timelineCode:'0_3_months',
    aiReviewedEvidence:{summary:'Reviewed customer requirement summary',confidence:'medium',unansweredQuestions:['Confirm exact community'],warnings:['Budget remains indicative']}};
  const run=buildGovernedMatchingRunV2(requirement,[],'2026-08-25T12:00:00.000Z','Sale');
  assert.deepEqual(run.requirementSnapshot.reviewedAiSummary,requirement.aiReviewedEvidence);
  const app=read('public/app.js'),ui=read('public/matching-completion-ui.js');
  assert.match(app,/saved-ai-requirement-summary/);
  assert.match(app,/unansweredQuestions:generatedSuggestion\?\.unansweredQuestions/);
  assert.match(ui,/Reviewed AI requirement summary used as Agent context/);
});

test('UAT-085 shortlist is one governed decision and assignment action with legacy recovery',()=>{
  const app=read('public/app.js'),ui=read('public/matching-completion-ui.js'),route=read('src/routes/governed-matching.js');
  assert.match(app,/Shortlist and assign to Opportunity/);
  assert.match(app,/assignToOpportunity/);
  assert.match(route,/createGovernedMatchAndAssignment/);
  assert.match(route,/INSERT INTO inventory_assignments/);
  assert.match(route,/INSERT INTO inventory_assignment_events/);
  assert.match(route,/governed_shortlist_assigned/);
  assert.match(route,/delinkGovernedAssignmentForDecision/);
  assert.match(route,/assignmentDelinked:Boolean\(delinkedAssignment\)/);
  assert.match(ui,/Assign shortlisted property to Opportunity/);
  assert.doesNotMatch(ui,/data-promote-candidate/);
});

test('matching layout uses scoped responsive controls instead of the global checkbox promotion row',()=>{
  const html=read('public/index.html');
  assert.match(html,/\.opportunity-ranking-workspace/);
  assert.match(html,/\.governed-match-actions\{display:grid/);
  assert.match(html,/@media\(max-width:900px\)\{\.governed-match-actions/);
});
