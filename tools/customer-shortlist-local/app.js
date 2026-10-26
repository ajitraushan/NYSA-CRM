import {prepareCustomerShortlist,recordCustomerShortlistResponses} from '/modules/customer-shortlist-domain.js';

const checkedAt='2026-08-08T10:00:00.000Z';
const inventory=[
  {id:'inv-1',inventoryReference:'NYSA-SYN-001',project:'Cedar Court',developer:'Demo Development',area:'Dubai',community:'Nad Al Sheba',propertyType:'Apartment',bedrooms:2,sizeSqft:1280,price:1950000,currency:'AED',paymentPlanType:'40/60',status:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-15T00:00:00.000Z',activeReservation:false,
    floorPlans:[{assetReference:'FLOOR-SYN-001',label:'Approved two-bedroom plan',bedrooms:2,sizeSqft:1280,approvalStatus:'approved',rightsStatus:'cleared'}],
    marketEvidence:{status:'approved',evidenceReference:'MARKET-SYN-001',sourceLabel:'Synthetic governed transaction set',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Nad Al Sheba',propertySegment:'Two-bedroom apartments',sampleSize:18,subjectPricePerSqft:1523,medianComparablePrice:1880000,medianComparablePricePerSqft:1485,observedPriceChangePercent:4.2,completedTransactions:18,methodNote:'Observed completed transactions only; no forecast.'}},
  {id:'inv-2',inventoryReference:'NYSA-SYN-002',project:'Garden Terrace',developer:'Sample Properties',area:'Dubai',community:'Meydan',propertyType:'Apartment',bedrooms:2,sizeSqft:1160,price:1740000,currency:'AED',paymentPlanType:'60/40',status:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-15T00:00:00.000Z',activeReservation:false,
    floorPlans:[{assetReference:'FLOOR-SYN-002',label:'Approved two-bedroom plan',bedrooms:2,sizeSqft:1160,approvalStatus:'approved',rightsStatus:'cleared'}],
    marketEvidence:{status:'approved',evidenceReference:'MARKET-SYN-002',sourceLabel:'Synthetic governed transaction set',sourceVersion:'2026-08',asOf:'2026-08-01',periodLabel:'Previous 12 months',geography:'Meydan',propertySegment:'Two-bedroom apartments',sampleSize:24,subjectPricePerSqft:1500,medianComparablePrice:1790000,medianComparablePricePerSqft:1512,observedPriceChangePercent:3.6,completedTransactions:24,methodNote:'Observed completed transactions only; no forecast.'}},
  {id:'inv-3',inventoryReference:'NYSA-SYN-003',project:'Willow Residences',developer:'Example Homes',area:'Dubai',community:'Dubai Hills',propertyType:'Apartment',bedrooms:2,sizeSqft:1340,price:2080000,currency:'AED',paymentPlanType:'Cash / mortgage',status:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-09-15T00:00:00.000Z',activeReservation:false,floorPlans:[],marketEvidence:{status:'pending'}}
];

const candidates=[
  {id:'candidate-1',listingId:'inv-1',eligibilityStatus:'eligible',score:94,fitLabel:'Strong fit',criteria:[{label:'Within confirmed budget'},{label:'Preferred family community'},{label:'Two-bedroom layout'}],evidence:{tradeOffs:['Handover is six months later than preferred'],missingFacts:['Service-charge confirmation']}},
  {id:'candidate-2',listingId:'inv-2',eligibilityStatus:'eligible',score:88,fitLabel:'Good fit',criteria:[{label:'Below maximum budget'},{label:'Preferred bedroom count'},{label:'Flexible payment plan'}],evidence:{tradeOffs:['Smaller internal area'],missingFacts:['Final school travel time']}},
  {id:'candidate-3',listingId:'inv-3',eligibilityStatus:'eligible',score:82,fitLabel:'Good fit',criteria:[{label:'Ready community'},{label:'Larger internal area'},{label:'Mortgage compatible'}],evidence:{tradeOffs:['At the upper edge of budget'],missingFacts:['Parking allocation confirmation']}}
].map(candidate=>({...candidate,listingSnapshot:inventory.find(item=>item.id===candidate.listingId)}));

const matchingRun={id:'RUN-SYN-001',requirementSnapshot:{id:'REQ-SYN-003',versionNo:3},candidates};
const decisions=candidates.map(item=>({candidateId:item.id,listingId:item.listingId,decision:'shortlisted'}));
let prepared=null;

const $=selector=>document.querySelector(selector);
const money=value=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(value);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function propertyCard(candidate){
  const item=inventory.find(row=>row.id===candidate.listingId);
  return `<article class="property card" data-candidate="${candidate.id}">
    <label class="select"><input type="checkbox" value="${candidate.id}"><span>Select</span></label>
    <div class="image"><span>${candidate.presentedRank||candidates.indexOf(candidate)+1}</span><b>${escapeHtml(item.project.slice(0,1))}</b></div>
    <div class="property-body"><div class="fit"><span>${escapeHtml(candidate.fitLabel)}</span><b>${candidate.score}%</b></div>
      <h3>${escapeHtml(item.project)}</h3><p>${escapeHtml(item.community)} · ${item.bedrooms} bed · ${item.sizeSqft.toLocaleString()} sq ft</p>
      <strong>${money(item.price)}</strong>
      <div class="facts"><div><b>Why it fits</b><ul>${candidate.criteria.map(x=>`<li>${escapeHtml(x.label)}</li>`).join('')}</ul></div><div class="trade"><b>Trade-off</b><p>${escapeHtml(candidate.evidence.tradeOffs[0])}</p></div></div>
    </div></article>`;
}

function renderCards(){
  $('#property-grid').innerHTML=candidates.map(propertyCard).join('');
  document.querySelectorAll('.property input').forEach(input=>input.addEventListener('change',()=>{
    input.closest('.property').classList.toggle('chosen',input.checked);
    const count=document.querySelectorAll('.property input:checked').length;
    $('#selected-count').textContent=`${count} selected`;
  }));
}

function liveInventory(){
  const rows=inventory.map(item=>({...item}));
  if($('#scenario').value==='reserved')Object.assign(rows[0],{status:'Reserved',activeReservation:true});
  if($('#scenario').value==='expired')rows[0].verificationExpiresAt='2026-08-01T00:00:00.000Z';
  return rows;
}

function showMessage(text,type='error'){
  const node=$('#preparation-message');node.textContent=text;node.className=`message ${type}`;
}

function propertyDetails(item){
  const floorPlan=item.floorPlans?.[0];
  const floorHtml=floorPlan?`<section class="floor-plan"><div class="plan-shape" aria-hidden="true"><span>Living</span><span>Bed 1</span><span>Bed 2</span><span>Kitchen</span></div><div><h4>Approved customer media</h4><p>${escapeHtml(floorPlan.label)} · ${Number(floorPlan.sizeSqft).toLocaleString()} sq ft</p><small>Opaque approved asset reference: ${escapeHtml(floorPlan.assetReference)}</small></div></section>`:`<section class="detail-unavailable"><h4>Floor plan unavailable</h4><p>No approved, rights-cleared floor plan is available in this snapshot.</p></section>`;
  const market=item.marketEvidence;
  const marketHtml=market?`<section class="market-block"><div class="market-head"><div><h4>Comparable market evidence</h4><p>${escapeHtml(market.geography)} · ${escapeHtml(market.propertySegment)}</p></div><span>As of ${escapeHtml(market.asOf)}</span></div><div class="market-metrics"><div><small>Subject asking rate</small><b>${money(market.subjectPricePerSqft)} / sq ft</b></div><div><small>Comparable median</small><b>${money(market.medianComparablePrice)}</b></div><div><small>Median rate</small><b>${money(market.medianComparablePricePerSqft)} / sq ft</b></div><div><small>Observed change</small><b>${Number(market.observedPriceChangePercent).toFixed(1)}%</b></div></div><p class="source">${escapeHtml(market.sourceLabel)} · ${escapeHtml(market.periodLabel)} · ${market.completedTransactions} completed transactions · sample ${market.sampleSize}</p><p class="method">${escapeHtml(market.methodNote)}</p></section>`:`<section class="detail-unavailable"><h4>Market comparison unavailable</h4><p>No approved, source-dated comparable evidence is available in this snapshot.</p></section>`;
  return `<div class="detail-pack">${floorHtml}${marketHtml}</div>`;
}

function renderPreview(shortlist){
  $('#preview-title').textContent=shortlist.title;
  $('#evidence-hash').textContent=`${shortlist.evidenceHash.slice(0,16)}...${shortlist.evidenceHash.slice(-12)}`;
  $('#preview-properties').innerHTML=shortlist.properties.map((item,index)=>`<article><span class="number">${String(index+1).padStart(2,'0')}</span><div><p class="reference">${escapeHtml(item.reference)}</p><h3>${escapeHtml(item.project)}</h3><p>${escapeHtml(item.community)} · ${item.bedrooms} bedroom · ${Number(item.sizeSqft).toLocaleString()} sq ft</p><strong>${money(item.amount)}</strong><div class="preview-evidence"><p><b>Why selected</b>${item.matchReasons.map(escapeHtml).join(' · ')}</p><p><b>Important trade-off</b>${escapeHtml(item.tradeOffs[0]||'None recorded')}</p><p><b>To confirm</b>${escapeHtml(item.missingFacts[0]||'No missing fact recorded')}</p></div>${propertyDetails(item)}</div></article>`).join('');
  $('#response-property-list').innerHTML=`<legend>Apply this response to</legend>${shortlist.properties.map(item=>`<label class="response-choice"><input type="checkbox" value="${escapeHtml(item.reference)}" checked><span><b>${escapeHtml(item.project)}</b><small>${escapeHtml(item.reference)}</small></span></label>`).join('')}`;
  $('#preview').classList.remove('hidden');$('#response-panel').classList.remove('hidden');$('#next-action').classList.add('hidden');
  $('#preview').scrollIntoView({behavior:'smooth',block:'start'});
}

function updateNotSuitableFields(){
  const visible=$('#response-outcome').value==='not_suitable';
  $('#not-suitable-evidence').classList.toggle('hidden',!visible);
  const needsDetail=visible&&$('#preference-impact').value!=='property_only';
  $('#preference-change-row').classList.toggle('hidden',!needsDetail);
}

$('#response-outcome').addEventListener('change',updateNotSuitableFields);
$('#preference-impact').addEventListener('change',updateNotSuitableFields);

$('#prepare').addEventListener('click',async()=>{
  const selected=[...document.querySelectorAll('.property input:checked')].map(input=>input.value);
  const result=await prepareCustomerShortlist({matchingRun,selectedCandidateIds:selected,decisions,liveInventory:liveInventory(),checkedAt,title:$('#selection-title').value,preparedBy:'BROKER-SYN-001',brokerReviewConfirmed:$('#review-confirmed').checked});
  if(result.error){prepared=null;$('#preview').classList.add('hidden');$('#response-panel').classList.add('hidden');const details=result.reasons?.map(x=>x.label).join('; ');showMessage(details?`${result.error}: ${details}`:result.error);return;}
  prepared=result.value;showMessage(`${prepared.properties.length} properties prepared as an immutable local snapshot. Nothing was sent.`,'success');renderPreview(prepared);
});

$('#record-response').addEventListener('click',async()=>{
  const propertyReferences=[...document.querySelectorAll('#response-property-list input:checked')].map(input=>input.value);
  const outcome=$('#response-outcome').value;
  const bodies=propertyReferences.map(propertyReference=>({propertyReference,outcome,notes:$('#response-note').value,recordedBy:'BROKER-SYN-001',occurredAt:checkedAt,rejectionReason:outcome==='not_suitable'?$('#rejection-reason').value:null,preferenceImpact:outcome==='not_suitable'?$('#preference-impact').value:null,preferenceChangeDetail:outcome==='not_suitable'?$('#preference-change-detail').value:null}));
  const result=await recordCustomerShortlistResponses(prepared,bodies);
  const node=$('#next-action');
  if(result.error){node.className='next-action error';node.textContent=result.error;return;}
  const rejection=result.value.responses[0].notSuitableEvidence;
  const trace=rejection?`<div class="decision-trace"><div><b>Why not suitable</b><span>${escapeHtml(rejection.rejectionReason.label)}</span></div><div><b>Requirement treatment</b><span>${escapeHtml(rejection.preferenceImpact.label)}</span>${rejection.preferenceChangeDetail?`<small>${escapeHtml(rejection.preferenceChangeDetail)}</small>`:''}</div><div><b>Agent handoff</b><span>${escapeHtml(rejection.agentHandoff.label)}</span><small>Proposed · not sent or applied</small></div></div>`:'';
  node.className='next-action';node.innerHTML=`<span>COMBINED NEXT CRM ACTION</span><h3>${escapeHtml(result.value.combinedAction.label)}</h3>${trace}<p>${result.value.responses.length} separate property response${result.value.responses.length===1?'':'s'} retained · Due within ${result.value.combinedAction.dueHours} hours · Inventory unchanged · Opportunity stage unchanged</p><code>${result.value.evidenceHash.slice(0,20)}...</code>`;
});

renderCards();
