import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunityAttribution,validateOpportunityCreate,validateOpportunityTransition,OPPORTUNITY_STAGES } from '../src/opportunity-domain.js';

test('opportunity creation requires an explicit genuine service decision and next action',()=>{
  assert.match(validateOpportunityCreate({}).error,/genuine opportunity/);
  assert.match(validateOpportunityCreate({serviceOpportunityConfirmed:true}).error,/Explain why/);
  assert.match(validateOpportunityCreate({serviceOpportunityConfirmed:true,serviceOpportunityReason:'Inventory fit',title:'Marina home',transactionType:'Unknown',nextAction:'Review',nextActionDueAt:'2026-07-23'}).error,/transaction type/);
  const checked=validateOpportunityCreate({serviceOpportunityConfirmed:true,serviceOpportunityReason:'Approved inventory fits the customer requirement',title:' Marina home ',transactionType:'Sale',priority:'high',nextAction:' Review shortlist ',nextActionDueAt:'2026-07-23T10:00:00+04:00'});
  assert.equal(checked.error,undefined);
  assert.equal(checked.value.title,'Marina home');
  assert.equal(checked.value.nextAction,'Review shortlist');
  assert.equal(checked.value.priority,'high');
  assert.equal(checked.value.serviceOpportunityReason,'Approved inventory fits the customer requirement');
});

test('Release 2.2 exposes Requirements Matching Viewing and reasoned Closed Lost',()=>{
  assert.deepEqual(OPPORTUNITY_STAGES,['Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Won','Closed Lost']);
  assert.equal(validateOpportunityTransition('Requirements','Matching').value.toStage,'Matching');
  assert.match(validateOpportunityTransition('Matching','Requirements').error,/reason is required/i);
  assert.equal(validateOpportunityTransition('Matching','Requirements',{reason:'Customer requirements changed'}).value.reasonCode,'requirements_reopened');
  assert.equal(validateOpportunityTransition('Matching','Viewing').value.reasonCode,'viewing_scheduled');
  assert.match(validateOpportunityTransition('Viewing','Matching').error,/reason is required/i);
  assert.equal(validateOpportunityTransition('Viewing','Matching',{reason:'Customer requested alternatives'}).value.reasonCode,'viewing_returned_to_matching');
  assert.match(validateOpportunityTransition('Matching','Closed Won').error,/not enabled in Release 2.2/);
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
