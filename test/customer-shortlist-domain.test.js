import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_SHORTLIST_POLICY_VERSION,customerSelectionEligibility,prepareCustomerShortlist,
  recordCustomerShortlistResponse,recordCustomerShortlistResponses,validateCustomerShortlistResponse
} from '../src/customer-shortlist-domain.js';

const checkedAt='2026-08-08T10:00:00.000Z';
const listing=(overrides={})=>({id:'inventory-1',inventoryReference:'NYSA-INV-SYN-001',project:'Synthetic Residences',developer:'Synthetic Developer',area:'Dubai',community:'Test Community',propertyType:'Apartment',bedrooms:2,sizeSqft:1200,price:1800000,currency:'AED',paymentPlanType:'40/60',status:'Available',effectiveStatus:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-01T00:00:00.000Z',activeReservation:false,...overrides});
const candidate={id:'candidate-1',listingId:'inventory-1',eligibilityStatus:'eligible',score:94,fitLabel:'Strong fit',listingSnapshot:listing(),criteria:[{label:'Within confirmed budget'},{label:'Preferred community'}],evidence:{tradeOffs:['Smaller balcony'],missingFacts:['Service charge confirmation']}};
const run={id:'run-synthetic-1',evidenceHash:'a'.repeat(64),requirementSnapshot:{id:'requirement-synthetic-1',versionNo:3},candidates:[candidate]};
const base={matchingRun:run,selectedCandidateIds:['candidate-1'],decisions:[{candidateId:'candidate-1',decision:'shortlisted'}],liveInventory:[listing()],checkedAt,title:'Reviewed property selection',preparedBy:'broker-synthetic-1',brokerReviewConfirmed:true};

test('customer selection eligibility permits shared consideration but fails closed for terminal or stale Inventory',()=>{
  assert.equal(customerSelectionEligibility(listing(),checkedAt).eligible,true);
  assert.equal(customerSelectionEligibility(listing({effectiveStatus:'Reserved',activeReservation:true}),checkedAt).eligible,true);
  for(const overrides of [{effectiveStatus:'Sold'},{effectiveStatus:'Rented'},{effectiveStatus:'Closed'},{workflowStatus:'draft'},{verificationStatus:'pending'},{verificationExpiresAt:'2026-08-01T00:00:00.000Z'},{deletedAt:checkedAt}]){
    assert.equal(customerSelectionEligibility(listing(overrides),checkedAt).eligible,false);
  }
});

test('prepared selection requires review, broker shortlist decision and live eligibility',async()=>{
  assert.match((await prepareCustomerShortlist({...base,brokerReviewConfirmed:false})).error,/Broker review/);
  assert.match((await prepareCustomerShortlist({...base,decisions:[]})).error,/shortlist decision/);
  const stale=await prepareCustomerShortlist({...base,liveInventory:[listing({effectiveStatus:'Sold'})]});
  assert.match(stale.error,/no longer eligible/);
  assert.deepEqual(stale.reasons.map(item=>item.code),['not_available']);
});

test('prepared selection is deterministic and excludes private operational fields',async()=>{
  const sensitive=listing({ownerName:'Private owner',ownerPhone:'000',permitEvidence:'private',authorityEvidence:'private'});
  const first=await prepareCustomerShortlist({...base,liveInventory:[sensitive]});
  const second=await prepareCustomerShortlist({...base,liveInventory:[sensitive]});
  assert.equal(first.value.policyVersion,CUSTOMER_SHORTLIST_POLICY_VERSION);
  assert.equal(first.value.evidenceHash,second.value.evidenceHash);
  assert.equal(first.value.automaticSend,false);
  assert.equal(first.value.automaticCommitment,false);
  const serialized=JSON.stringify(first.value);
  for(const prohibited of ['Private owner','ownerPhone','permitEvidence','authorityEvidence'])assert.doesNotMatch(serialized,new RegExp(prohibited));
  assert.deepEqual(first.value.properties[0].matchReasons,['Within confirmed budget','Preferred community']);
});

test('customer snapshot includes only approved floor plans and source-bound market evidence',async()=>{
  const enriched=listing({
    floorPlans:[
      {assetReference:'floor-syn-approved',label:'Two-bedroom layout',bedrooms:2,sizeSqft:1200,approvalStatus:'approved',rightsStatus:'cleared'},
      {assetReference:'floor-syn-private',label:'Unapproved plan',approvalStatus:'pending',rightsStatus:'unknown'}
    ],
    marketEvidence:{status:'approved',evidenceReference:'market-syn-1',sourceLabel:'Synthetic governed transactions',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Test Community',propertySegment:'Two-bedroom apartments',sampleSize:18,subjectPricePerSqft:1500,medianComparablePrice:1850000,medianComparablePricePerSqft:1450,observedPriceChangePercent:4.2,completedTransactions:18,methodNote:'Observed completed transactions; no forecast.'}
  });
  const result=await prepareCustomerShortlist({...base,liveInventory:[enriched]});
  assert.deepEqual(result.value.properties[0].floorPlans.map(item=>item.assetReference),['floor-syn-approved']);
  assert.equal(result.value.properties[0].marketEvidence.sampleSize,18);
  assert.equal(result.value.properties[0].marketEvidence.sourceLabel,'Synthetic governed transactions');
  assert.doesNotMatch(JSON.stringify(result.value),/floor-syn-private|Unapproved plan/);
  const unavailable=await prepareCustomerShortlist({...base,liveInventory:[listing({marketEvidence:{status:'pending',sourceLabel:'Unapproved'}})]});
  assert.equal(unavailable.value.properties[0].marketEvidence,null);
});

test('customer response produces a controlled next action without mutating business state',async()=>{
  const shortlist=(await prepareCustomerShortlist(base)).value;
  const result=await recordCustomerShortlistResponse(shortlist,{propertyReference:'NYSA-INV-SYN-001',outcome:'viewing_requested',notes:'Synthetic customer requested an afternoon viewing.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt});
  assert.equal(result.value.nextAction.code,'schedule_viewing');
  assert.equal(result.value.changesInventory,false);
  assert.equal(result.value.changesOpportunityStage,false);
  assert.equal(result.value.automaticSend,false);
  assert.equal(shortlist.responses.length,0);
  assert.equal(result.value.response.shortlistEvidenceHash,shortlist.evidenceHash);
});

test('multiple property interests remain separate and produce one combined follow-up',async()=>{
  const secondListing=listing({id:'inventory-2',inventoryReference:'NYSA-INV-SYN-002',project:'Second Synthetic Home'});
  const secondCandidate={...candidate,id:'candidate-2',listingId:'inventory-2',listingSnapshot:secondListing};
  const shortlist=(await prepareCustomerShortlist({...base,matchingRun:{...run,candidates:[candidate,secondCandidate]},selectedCandidateIds:['candidate-1','candidate-2'],decisions:[{candidateId:'candidate-1',decision:'shortlisted'},{candidateId:'candidate-2',decision:'shortlisted'}],liveInventory:[listing(),secondListing]})).value;
  const result=await recordCustomerShortlistResponses(shortlist,[
    {propertyReference:'NYSA-INV-SYN-001',outcome:'interested',notes:'Synthetic interest one.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt},
    {propertyReference:'NYSA-INV-SYN-002',outcome:'interested',notes:'Synthetic interest two.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt}
  ]);
  assert.equal(result.value.responses.length,2);
  assert.deepEqual(result.value.responses.map(item=>item.propertyReference),['NYSA-INV-SYN-001','NYSA-INV-SYN-002']);
  assert.equal(result.value.combinedAction.code,'multi_property_follow_up');
  assert.equal(result.value.changesInventory,false);
});

test('response validation accepts only controlled, attributable evidence',()=>{
  assert.match(validateCustomerShortlistResponse({propertyReference:'x',outcome:'unknown',notes:'Synthetic',recordedBy:'broker'}).error,/controlled customer response/);
  assert.match(validateCustomerShortlistResponse({propertyReference:'x',outcome:'interested',recordedBy:'broker'}).error,/notes are required/);
  assert.equal(validateCustomerShortlistResponse({propertyReference:'x',outcome:'interested',notes:'Synthetic evidence',recordedBy:'broker',occurredAt:checkedAt}).value.outcome,'interested');
});

test('not-suitable feedback records the reason, requirement impact and proposed agent handoff',async()=>{
  const shortlist=(await prepareCustomerShortlist(base)).value;
  assert.match(validateCustomerShortlistResponse({propertyReference:'NYSA-INV-SYN-001',outcome:'not_suitable',notes:'Synthetic feedback.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt}).error,/why the property/);
  assert.match(validateCustomerShortlistResponse({propertyReference:'NYSA-INV-SYN-001',outcome:'not_suitable',notes:'Synthetic feedback.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt,rejectionReason:'layout_or_size',preferenceImpact:'confirmed_change'}).error,/Describe/);
  const result=await recordCustomerShortlistResponse(shortlist,{propertyReference:'NYSA-INV-SYN-001',outcome:'not_suitable',notes:'Synthetic customer needs a larger layout.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt,rejectionReason:'layout_or_size',preferenceImpact:'confirmed_change',preferenceChangeDetail:'Minimum internal area is now 1,350 sq ft.'});
  assert.equal(result.value.response.notSuitableEvidence.rejectionReason.code,'layout_or_size');
  assert.equal(result.value.response.notSuitableEvidence.preferenceImpact.code,'confirmed_change');
  assert.equal(result.value.response.notSuitableEvidence.agentHandoff.route,'current_responsible_agent_work_queue');
  assert.equal(result.value.response.notSuitableEvidence.agentHandoff.status,'proposed_not_sent');
  assert.equal(result.value.nextAction.code,'version_customer_requirement');
  assert.equal(result.value.changesOpportunityStage,false);
  const propertyOnly=await recordCustomerShortlistResponse(shortlist,{propertyReference:'NYSA-INV-SYN-001',outcome:'not_suitable',notes:'Synthetic property-specific feedback.',recordedBy:'broker-synthetic-1',occurredAt:checkedAt,rejectionReason:'location_or_community',preferenceImpact:'property_only'});
  assert.equal(propertyOnly.value.nextAction.code,'record_property_feedback');
  assert.equal(propertyOnly.value.response.notSuitableEvidence.preferenceChangeDetail,null);
});
