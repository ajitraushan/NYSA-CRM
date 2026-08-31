import {prepareGovernedSharePreflight} from '/modules/governed-share-preflight-domain.js';
import {evaluateCommunicationPolicy} from '/modules/communication-domain.js';

const checkedAt='2026-08-08T12:00:00.000Z';
const properties=[
  {reference:'NYSA-SYN-001',project:'Cedar Court',community:'Nad Al Sheba',bedrooms:2,sizeSqft:1280,amount:1950000,currency:'AED',matchReasons:['Within confirmed budget','Preferred family community','Two-bedroom layout'],tradeOffs:['Handover is six months later than preferred'],missingFacts:['Service-charge confirmation'],floorPlans:[{assetReference:'FLOOR-SYN-001',label:'Approved two-bedroom plan',bedrooms:2,sizeSqft:1280}],marketEvidence:{evidenceReference:'MARKET-SYN-001',sourceLabel:'Synthetic governed transaction set',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Nad Al Sheba',propertySegment:'Two-bedroom apartments',sampleSize:18,subjectPricePerSqft:1523,medianComparablePrice:1880000,medianComparablePricePerSqft:1485,observedPriceChangePercent:4.2,completedTransactions:18,methodNote:'Observed completed transactions only; no forecast.'}},
  {reference:'NYSA-SYN-002',project:'Garden Terrace',community:'Meydan',bedrooms:2,sizeSqft:1160,amount:1740000,currency:'AED',matchReasons:['Below maximum budget','Preferred bedroom count','Flexible payment plan'],tradeOffs:['Smaller internal area'],missingFacts:['Final school travel time'],floorPlans:[{assetReference:'FLOOR-SYN-002',label:'Approved two-bedroom plan',bedrooms:2,sizeSqft:1160}],marketEvidence:{evidenceReference:'MARKET-SYN-002',sourceLabel:'Synthetic governed transaction set',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Meydan',propertySegment:'Two-bedroom apartments',sampleSize:24,subjectPricePerSqft:1500,medianComparablePrice:1790000,medianComparablePricePerSqft:1512,observedPriceChangePercent:3.6,completedTransactions:24,methodNote:'Observed completed transactions only; no forecast.'}}
];
const shortlist={evidenceHash:'a'.repeat(64),properties};
const inventory=()=>properties.map((item,index)=>({inventoryReference:item.reference,project:item.project,community:item.community,bedrooms:item.bedrooms,sizeSqft:item.sizeSqft,price:item.amount,currency:item.currency,status:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-01T00:00:00.000Z',activeReservation:false,id:`INV-SYN-${index+1}`,floorPlans:item.floorPlans.map(plan=>({...plan,approvalStatus:'approved',rightsStatus:'cleared'})),marketEvidence:{...item.marketEvidence,status:'approved'}}));
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const money=value=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(value);

function packageDetails(item){
  const floor=item.floorPlans[0],market=item.marketEvidence;
  return `<div class="package-details"><section class="floor-plan"><div class="plan-shape" aria-hidden="true"><span>Living</span><span>Bed 1</span><span>Bed 2</span><span>Kitchen</span></div><div><h4>Approved floor plan</h4><p>${esc(floor.label)} · ${floor.sizeSqft.toLocaleString()} sq ft</p><small>${esc(floor.assetReference)}</small></div></section><section class="market"><div class="market-head"><div><h4>Market comparison and recent performance</h4><p>${esc(market.geography)} · ${esc(market.propertySegment)}</p></div><span>As of ${esc(market.asOf)}</span></div><div class="metrics"><div><small>Asking rate</small><b>${money(market.subjectPricePerSqft)} / sq ft</b></div><div><small>Comparable median</small><b>${money(market.medianComparablePrice)}</b></div><div><small>Observed change</small><b>${market.observedPriceChangePercent.toFixed(1)}%</b></div></div><p>${esc(market.sourceLabel)} · ${esc(market.periodLabel)} · ${market.completedTransactions} completed transactions</p><small>${esc(market.methodNote)}</small></section></div>`;
}

$('#cards').innerHTML=properties.map((item,index)=>`<article><span>0${index+1}</span><div><small>${esc(item.reference)}</small><h3>${esc(item.project)}</h3><p>${esc(item.community)} · ${item.bedrooms} bedroom · ${item.sizeSqft.toLocaleString()} sq ft</p><b>${money(item.amount)}</b><div class="highlights"><div><em>Why selected</em>${item.matchReasons.map(esc).join(' · ')}</div><div><em>Trade-off</em>${esc(item.tradeOffs[0])}</div><div><em>To confirm</em>${esc(item.missingFacts[0])}</div></div>${packageDetails(item)}</div></article>`).join('');

function policy(scenario){
  const decision=evaluateCommunicationPolicy({id:'POLICY-SYN-001',subjectRef:'CUSTOMER-SYN-001',scopeRef:'OPP-SYN-001',channelRef:'CHANNEL-SYN-001',actorRef:'AGENT-SYN-001',purpose:'transactional_share',channel:'whatsapp',policyVersion:'policy-syn-v1',evaluatedAt:'2026-08-08T11:59:00.000Z',validUntil:'2026-08-08T12:10:00.000Z',actorAuthorized:true,channelEligible:true,consentPermits:true,restrictionClear:scenario!=='restricted',subjectEligible:true}).value;
  return scenario==='expired'?{...decision,validUntil:'2026-08-08T11:59:30.000Z'}:decision;
}

$('#run').addEventListener('click',async()=>{
  const scenario=$('#scenario').value,live=inventory();
  if(scenario==='reserved')Object.assign(live[0],{status:'Reserved',activeReservation:true});
  if(scenario==='changed')live[0].price=1990000;
  const response=await prepareGovernedSharePreflight({checkedAt,shortlist,liveInventory:live,policyDecision:policy(scenario),actorRef:'AGENT-SYN-001',subjectRef:'CUSTOMER-SYN-001',scopeRef:'OPP-SYN-001'}),node=$('#result');
  if(response.error){const detail=response.reasons?.map(item=>item.label).join(' · ')||response.changes?.map(item=>`${item.field}: ${item.prepared} → ${item.live}`).join(' · ')||response.reasonCodes?.join(' · ')||'The preflight failed closed.';node.className='result blocked';node.innerHTML=`<p>SHARE BLOCKED</p><h2>${esc(response.error)}</h2><span>${esc(detail)}</span><small>Nothing was sent. Broker review is required before another preflight.</small>`;return;}
  const value=response.value;node.className='result ready';node.innerHTML=`<p>SHARE PREFLIGHT READY</p><h2>Broker-prepared package ready for customer review · not sent</h2><span>${value.cards.length} complete customer-review property cards · valid until ${esc(value.expiresAt)}</span><dl><div><dt>Policy</dt><dd>${esc(value.policyDecisionRef||'Bound decision')}</dd></div><div><dt>Template</dt><dd>${esc(value.templateRef)}</dd></div><div><dt>Evidence hash</dt><dd>${value.evidenceHash.slice(0,18)}...</dd></div><div><dt>Connector</dt><dd>Disabled</dd></div></dl><small>No recipient contact value, message dispatch or provider connection exists in this module.</small>`;
});
