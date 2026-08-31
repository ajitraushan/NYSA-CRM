import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGovernedSharePreflight} from '../src/governed-share-preflight-domain.js';
import {evaluateCommunicationPolicy} from '../src/communication-domain.js';

const checkedAt='2026-08-08T12:00:00.000Z';
const marketEvidence={status:'approved',evidenceReference:'MARKET-SYN-001',sourceLabel:'Synthetic governed transaction set',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Nad Al Sheba',propertySegment:'Two-bedroom apartments',sampleSize:18,subjectPricePerSqft:1523,medianComparablePrice:1880000,medianComparablePricePerSqft:1485,observedPriceChangePercent:4.2,completedTransactions:18,methodNote:'Observed completed transactions only; no forecast.'};
const floorPlan={assetReference:'FLOOR-SYN-001',label:'Approved two-bedroom plan',bedrooms:2,sizeSqft:1280,approvalStatus:'approved',rightsStatus:'cleared'};
const property={reference:'NYSA-SYN-001',project:'Cedar Court',community:'Nad Al Sheba',bedrooms:2,sizeSqft:1280,amount:1950000,currency:'AED',matchReasons:['Within budget'],tradeOffs:['Later handover'],missingFacts:['Service-charge confirmation'],floorPlans:[floorPlan],marketEvidence};
const shortlist={evidenceHash:'a'.repeat(64),properties:[property]};
const inventory=(overrides={})=>({inventoryReference:'NYSA-SYN-001',project:'Cedar Court',community:'Nad Al Sheba',bedrooms:2,sizeSqft:1280,price:1950000,currency:'AED',status:'Available',effectiveStatus:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-01T00:00:00.000Z',activeReservation:false,floorPlans:[floorPlan],marketEvidence,...overrides});
const policy=(overrides={})=>evaluateCommunicationPolicy({subjectRef:'CUSTOMER-SYN-001',scopeRef:'OPP-SYN-001',channelRef:'CHANNEL-SYN-001',actorRef:'AGENT-SYN-001',purpose:'transactional_share',channel:'whatsapp',policyVersion:'policy-syn-v1',evaluatedAt:checkedAt,validUntil:'2026-08-08T12:10:00.000Z',actorAuthorized:true,channelEligible:true,consentPermits:true,restrictionClear:true,subjectEligible:true,...overrides}).value;
const base={checkedAt,shortlist,liveInventory:[inventory()],policyDecision:policy(),actorRef:'AGENT-SYN-001',subjectRef:'CUSTOMER-SYN-001',scopeRef:'OPP-SYN-001'};

test('share preflight prepares only a short-lived customer-safe snapshot and never sends',async()=>{
  const result=await prepareGovernedSharePreflight(base);
  assert.equal(result.value.status,'prepared_not_sent');assert.equal(result.value.shareReady,true);assert.equal(result.value.automaticSend,false);assert.equal(result.value.connectorEnabled,false);
  assert.equal(result.value.cards[0].reference,'NYSA-SYN-001');assert.equal(result.value.cards[0].floorPlans[0].assetReference,'FLOOR-SYN-001');assert.equal(result.value.cards[0].marketEvidence.evidenceReference,'MARKET-SYN-001');assert.deepEqual(result.value.cards[0].missingFacts,['Service-charge confirmation']);
  const serialized=JSON.stringify(result.value);for(const prohibited of ['owner','phone','email','permit','authority'])assert.doesNotMatch(serialized,new RegExp(prohibited,'i'));
});

test('share preflight permits shared consideration but blocks terminal Inventory',async()=>{
  const shared=await prepareGovernedSharePreflight({...base,liveInventory:[inventory({effectiveStatus:'Reserved',activeReservation:true})]});
  assert.equal(shared.value.shareReady,true);
  const result=await prepareGovernedSharePreflight({...base,liveInventory:[inventory({effectiveStatus:'Sold'})]});
  assert.match(result.error,/no longer eligible/);assert.deepEqual(result.reasons.map(item=>item.code),['not_available']);
});

test('share preflight blocks changed customer-visible facts until broker review',async()=>{
  const result=await prepareGovernedSharePreflight({...base,liveInventory:[inventory({price:1990000})]});
  assert.match(result.error,/facts changed/);assert.deepEqual(result.changes.map(item=>item.field),['amount']);
});

test('share preflight blocks withdrawn floor plans or changed market evidence',async()=>{
  assert.match((await prepareGovernedSharePreflight({...base,liveInventory:[inventory({floorPlans:[]})]})).error,/floor plan/);
  assert.match((await prepareGovernedSharePreflight({...base,liveInventory:[inventory({marketEvidence:{...marketEvidence,sourceVersion:'2026-09'}})]})).error,/Market evidence changed/);
});

test('share preflight fails closed for denied, expired or mismatched communication policy',async()=>{
  assert.match((await prepareGovernedSharePreflight({...base,policyDecision:policy({consentPermits:false})})).error,/does not permit/);
  assert.match((await prepareGovernedSharePreflight({...base,policyDecision:{...policy(),validUntil:'2026-08-08T11:59:00.000Z'}})).error,/expired/);
  assert.match((await prepareGovernedSharePreflight({...base,policyDecision:policy({scopeRef:'OPP-OTHER'})})).error,/scope/);
});
