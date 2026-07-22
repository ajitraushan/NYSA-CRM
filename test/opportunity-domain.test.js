import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunityAttribution,validateOpportunityCreate,validateOpportunityTransition,OPPORTUNITY_STAGES } from '../src/opportunity-domain.js';

test('opportunity creation requires governed identity and next action fields',()=>{
  assert.equal(validateOpportunityCreate({}).error,'Opportunity title is required');
  assert.match(validateOpportunityCreate({title:'Marina home',transactionType:'Unknown',nextAction:'Review',nextActionDueAt:'2026-07-23'}).error,/transaction type/);
  const checked=validateOpportunityCreate({title:' Marina home ',transactionType:'Sale',priority:'high',nextAction:' Review shortlist ',nextActionDueAt:'2026-07-23T10:00:00+04:00'});
  assert.equal(checked.error,undefined);
  assert.equal(checked.value.title,'Marina home');
  assert.equal(checked.value.nextAction,'Review shortlist');
  assert.equal(checked.value.priority,'high');
});

test('Release 2.1 exposes only Requirements Matching and reasoned Closed Lost',()=>{
  assert.deepEqual(OPPORTUNITY_STAGES,['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Won','Closed Lost']);
  assert.equal(validateOpportunityTransition('Requirements','Matching').value.toStage,'Matching');
  assert.match(validateOpportunityTransition('Matching','Requirements').error,/reason is required/i);
  assert.equal(validateOpportunityTransition('Matching','Requirements',{reason:'Customer requirements changed'}).value.reasonCode,'requirements_reopened');
  assert.match(validateOpportunityTransition('Matching','Viewing').error,/not enabled in Release 2.1/);
  assert.match(validateOpportunityTransition('Matching','Closed Won').error,/not enabled in Release 2.1/);
  assert.match(validateOpportunityTransition('Requirements','Closed Lost',{reasonCode:'other',reason:''}).error,/controlled lost reason/);
  assert.equal(validateOpportunityTransition('Matching','Closed Lost',{reasonCode:'no_suitable_property',reason:'Reviewed approved inventory'}).value.toStage,'Closed Lost');
});

test('original enquiry attribution is deterministic and sensitive to provenance changes',()=>{
  const lead={id:'lead-1',source:'Website',campaignCode:'summer_2026',externalSourceId:'form-77',sourcePage:'/marina',sourceForm:'buyer',listingId:'listing-1'};
  const first=buildOpportunityAttribution(lead),second=buildOpportunityAttribution({...lead});
  assert.equal(first.provenanceHash,second.provenanceHash);
  assert.equal(first.provenanceHash.length,64);
  assert.equal(first.attributionBasis,'original_enquiry');
  assert.notEqual(first.provenanceHash,buildOpportunityAttribution({...lead,campaignCode:'autumn_2026'}).provenanceHash);
});
