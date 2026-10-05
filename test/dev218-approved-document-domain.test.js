import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedDocumentOpportunityLinks,validateA2aIssue,validateViewingConfirmationSelection} from '../src/approved-document-domain.js';

test('Viewing Confirmation accepts only one to ten exact completed Opportunity viewings',()=>{
  assert.match(validateViewingConfirmationSelection([],[]).error,/one and ten/);
  assert.match(validateViewingConfirmationSelection(Array.from({length:11},(_,i)=>String(i)),[]).error,/one and ten/);
  assert.match(validateViewingConfirmationSelection(['v1','v2'],[{id:'v1'}]).error,/completed and belong/);
  assert.deepEqual(validateViewingConfirmationSelection(['v1','v1'],[{id:'v1'}]).value.ids,['v1']);
});

test('A2A enforces representation, sequence, property, both agents, ORN and editable agency facts',()=>{
  const valid={code:'a2a_buyer',representationPath:'buyer',hasProperty:true,otherAgent:{name:'Counterparty Agent',agency:'Counterparty Agency',brn:'BRN-2',brnIssuedOn:'2026-01-01'},organization:{orn:'56017'},draft:{otherAgencyAddress:'Dubai',otherAgencyLicence:'DED-2'},hasPriorIssue:false,hasDownstream:false};
  assert.equal(validateA2aIssue(valid).error,undefined);
  assert.match(validateA2aIssue({...valid,representationPath:'inventory'}).error,/not applicable/);
  assert.match(validateA2aIssue({...valid,hasDownstream:true}).error,/before Viewing or Offer/);
  assert.match(validateA2aIssue({...valid,hasProperty:false}).error,/Select the property/);
  assert.match(validateA2aIssue({...valid,otherAgent:{...valid.otherAgent,brnIssuedOn:null}}).error,/BRN issue date/);
  assert.match(validateA2aIssue({...valid,organization:{orn:null}}).error,/Maintain the NYSA ORN/);
  assert.match(validateA2aIssue({...valid,draft:{}}).error,/agency address and licence/);
  assert.equal(validateA2aIssue({...valid,hasPriorIssue:true,hasDownstream:true}).error,undefined);
});

test('approved Opportunity documents link the Customer, Lead, Opportunity and selected Inventory',()=>{
  assert.deepEqual(approvedDocumentOpportunityLinks({id:'op',contactId:'customer',leadId:'lead',resolvedListingId:'inventory'}),[
    ['Opportunity','op'],['Contact','customer'],['Lead','lead'],['Listing','inventory']
  ]);
});
