import { buildInventoryMarketIntelligence, prepareReviewedMarketSnapshot } from '/modules/inventory-market-intelligence-domain.js';

const asOf = '2026-08-09T10:00:00.000Z';
const hash = 'a'.repeat(64);
const mapping = {
  coreCommunityId: 'CORE-COMM-SYN-MARINA',
  coreCommunityName: 'Synthetic Marina',
  dldAreaLabel: 'Synthetic Marina',
  mappingVersion: 'dld-core-community-map-v1',
  status: 'admin_approved'
};
const baseSubject = {
  inventoryRef: 'NYSA-INV-SYN-018', transactionType: 'sale', propertyType: 'apartment',
  areaId: 'CORE-AREA-DUBAI', area: 'Dubai', communityId: mapping.coreCommunityId,
  community: mapping.coreCommunityName, communityMappingVersion: mapping.mappingVersion,
  bedrooms: 2, price: 2100000, sizeSqft: 1000
};
const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
const obs = (id, price, sizeSqft, date, extra = {}) => ({
  observationRef:`OBS-SYN-${id}`, inventoryRef:`INV-COMP-${id}`, transactionType:'sale', propertyType:'apartment',
  areaId:'CORE-AREA-DUBAI', area:'Dubai', communityId:mapping.coreCommunityId, community:'Synthetic Marina', bedrooms:2,
  price, sizeSqft, transactionAt:date, sourceDatasetRef:'DLD-GOVERNED-IMPORT-SYN-1', sourceEvidenceHash:hash,
  usageBasis:'governed_import', verified:true, ...extra
});

function rowsFor(scenario) {
  const recent = [obs(1,1950000,1000,'2026-08-01T00:00:00.000Z'), obs(2,2050000,1050,'2026-07-20T00:00:00.000Z'), obs(3,2000000,980,'2026-07-15T00:00:00.000Z')];
  if (scenario === 'insufficient') return recent.slice(0, 2);
  if (scenario === 'mixed') return [...recent, obs(4,1800000,900,'2026-08-01T00:00:00.000Z',{communityId:'CORE-COMM-OTHER',community:'Other Community'}), obs(5,1900000,950,'2026-08-01T00:00:00.000Z',{verified:false})];
  if (scenario === 'trend') return [...recent, obs(6,1850000,950,'2026-04-01T00:00:00.000Z'), obs(7,1900000,970,'2026-05-15T00:00:00.000Z')];
  if (scenario === 'stale') return [obs(8,1700000,900,'2024-01-01T00:00:00.000Z'), obs(9,1750000,920,'2024-02-01T00:00:00.000Z'), obs(10,1800000,940,'2024-03-01T00:00:00.000Z')];
  return recent;
}
const money = value => value === null || value === undefined ? 'Unavailable' : `AED ${Number(value).toLocaleString('en-AE', { maximumFractionDigits:2 })}`;

function quarterlyChart(series) {
  if (!series.length) return '';
  const narrow=window.innerWidth<650,width=narrow?460:860,height=narrow?280:300,left=narrow?52:70,right=narrow?48:68,top=28,bottom=52,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const priceValues=series.flatMap(row=>[row.weightedAveragePricePerSqft,row.medianPricePerSqft]);
  const rawMin=Math.min(...priceValues),rawMax=Math.max(...priceValues),padding=Math.max((rawMax-rawMin)*0.18,25),priceMin=Math.max(0,rawMin-padding),priceMax=rawMax+padding;
  const volumeMax=Math.max(...series.map(row=>row.transactions),1);
  const x=index=>series.length===1?left+plotWidth/2:left+(plotWidth*index/(series.length-1));
  const yPrice=value=>top+plotHeight-((value-priceMin)/(priceMax-priceMin))*plotHeight;
  const yVolume=value=>top+plotHeight-(value/volumeMax)*plotHeight;
  const points=key=>series.map((row,index)=>`${x(index)},${yPrice(row[key])}`).join(' ');
  const priceTicks=[priceMin,(priceMin+priceMax)/2,priceMax];
  const volumeTicks=[0,Math.ceil(volumeMax/2),volumeMax];
  const grid=priceTicks.map(value=>`<line x1="${left}" y1="${yPrice(value)}" x2="${width-right}" y2="${yPrice(value)}" class="chart-grid"/><text x="${left-10}" y="${yPrice(value)+4}" text-anchor="end">${Math.round(value).toLocaleString('en-AE')}</text>`).join('');
  const bars=series.map((row,index)=>{const barWidth=Math.min(42,plotWidth/(series.length*3)),barX=x(index)-barWidth/2,barY=yVolume(row.transactions);return`<rect x="${barX}" y="${barY}" width="${barWidth}" height="${top+plotHeight-barY}" class="volume-bar"><title>${row.quarter}: ${row.transactions} sales transactions · ${money(row.totalSalesValueAed)}</title></rect>`}).join('');
  const markers=series.map((row,index)=>`<circle cx="${x(index)}" cy="${yPrice(row.weightedAveragePricePerSqft)}" r="5" class="weighted-point"><title>${row.quarter}: weighted average ${money(row.weightedAveragePricePerSqft)}/sqft</title></circle><rect x="${x(index)-4}" y="${yPrice(row.medianPricePerSqft)-4}" width="8" height="8" class="median-point"><title>${row.quarter}: median ${money(row.medianPricePerSqft)}/sqft</title></rect><text x="${x(index)}" y="${height-25}" text-anchor="middle">${esc(row.quarter)}</text>`).join('');
  const rightTicks=volumeTicks.map(value=>`<text x="${width-right+10}" y="${yVolume(value)+4}" text-anchor="start">${value.toLocaleString('en-AE')}</text>`).join('');
  return `<div class="chart-legend"><span><i class="weighted-key"></i>Weighted average / sqft</span><span><i class="median-key"></i>Median / sqft</span><span><i class="volume-key"></i>Sales volume (transactions)</span></div><svg class="quarter-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Quarterly community price per square foot and sales transaction volume"><title>Quarterly community price and sales volume</title><desc>Weighted average and median price per square foot use the left axis. Sales transaction count uses bars and the right axis.</desc>${grid}<line x1="${left}" y1="${top+plotHeight}" x2="${width-right}" y2="${top+plotHeight}" class="chart-axis"/>${bars}${series.length>1?`<polyline points="${points('weightedAveragePricePerSqft')}" class="weighted-line"/><polyline points="${points('medianPricePerSqft')}" class="median-line"/>`:''}${markers}${rightTicks}<text x="18" y="${top+plotHeight/2}" transform="rotate(-90 18 ${top+plotHeight/2})" text-anchor="middle" class="axis-title">AED / sqft</text><text x="${width-12}" y="${top+plotHeight/2}" transform="rotate(90 ${width-12} ${top+plotHeight/2})" text-anchor="middle" class="axis-title">Sales transactions</text></svg>`;
}

function render() {
  const scenario = document.querySelector('#scenario').value;
  const mapped = scenario !== 'unmapped';
  const subject = mapped ? baseSubject : { ...baseSubject, communityId:null, communityMappingVersion:null };
  const observations = scenario === 'unmapped' ? [] : rowsFor(scenario);
  const report = buildInventoryMarketIntelligence({ subject, observations, asOf });
  const ready = report.status === 'ready_for_review';
  document.querySelector('#linkage').innerHTML = `<article class="linkage ${mapped?'mapped':'unmapped'}">
    <div><span>Inventory</span><strong>${esc(subject.inventoryRef)}</strong></div>
    <div><span>CORE community</span><strong>${mapped?esc(mapping.coreCommunityName):'Not mapped'}</strong><small>${mapped?esc(mapping.coreCommunityId):'Admin mapping required'}</small></div>
    <div><span>DLD source area</span><strong>${mapped?esc(mapping.dldAreaLabel):'No approved link'}</strong></div>
    <div><span>Mapping evidence</span><strong>${mapped?'Admin approved':'Unavailable'}</strong><small>${mapped?esc(mapping.mappingVersion):'Inventory operations remain available'}</small></div>
  </article>`;
  document.querySelector('#gate').innerHTML = `<article><div><span>Evidence status</span><strong class="${ready?'good':'bad'}">${esc(report.status.replaceAll('_',' '))}</strong></div><div><span>Customer output</span><strong class="${ready?'good':'bad'}">${ready?'Review required':'Blocked'}</strong></div><small>Inventory create/edit remains available · market intelligence is advisory only · AI narrative generated: No</small></article>`;
  document.querySelector('#metrics').innerHTML = `<article><span>Eligible comparables</span><strong>${report.eligibleComparables.length}</strong></article><article><span>Weighted avg / sqft</span><strong>${report.metrics?money(report.metrics.weightedAveragePricePerSqft):'Unavailable'}</strong></article><article><span>Median / sqft</span><strong>${report.metrics?money(report.metrics.medianPricePerSqft):'Unavailable'}</strong></article><article><span>Inventory asking / sqft</span><strong>${report.metrics?money(report.metrics.subjectPricePerSqft):'Unavailable'}</strong></article><article><span>Asking vs weighted avg</span><strong>${report.metrics&&report.metrics.subjectVarianceToWeightedAveragePercent!==null?`${report.metrics.subjectVarianceToWeightedAveragePercent}%`:'Unavailable'}</strong></article><article><span>Median transaction</span><strong>${money(report.metrics?.medianPrice??null)}</strong></article>`;
  const latestQuarter = report.metrics?.latestAvailableQuarter;
  const quarterTrend = report.metrics?.quarterlyTrend;
  const quarterRows = report.metrics?.quarterlySeries?.map(row => `<tr><td>${esc(row.quarter)}</td><td>${row.transactions}</td><td>${money(row.totalSalesValueAed)}</td><td>${money(row.weightedAveragePricePerSqft)}</td><td>${money(row.medianPricePerSqft)}</td></tr>`).join('') || '';
  document.querySelector('#performance').innerHTML = report.metrics ? `<article><div class="performance-head"><div><span>Community performance</span><strong>${quarterTrend?`${esc(quarterTrend.fromQuarter)} to ${esc(quarterTrend.toQuarter)}`:`Latest available: ${esc(latestQuarter?.quarter??'Unavailable')}`}</strong></div><div><span>Published result</span><strong class="${quarterTrend?'good':''}">${quarterTrend?`${quarterTrend.changePercent}% weighted price/sqft trend`:'Latest-quarter data only · no trend claim'}</strong></div></div>${quarterlyChart(report.metrics.quarterlySeries)}<div class="performance-table"><table><thead><tr><th>Quarter</th><th>Sales transactions</th><th>Total sales value</th><th>Weighted avg / sqft</th><th>Median / sqft</th></tr></thead><tbody>${quarterRows}</tbody></table></div><small>Uses up to the latest four quarters (one year). Each accepted transaction is counted as one sales record; it is not inferred as a multi-unit count. A trend is published only when at least two quarters contain eligible community data.</small></article>` : '<article class="empty">Quarterly community performance is unavailable.</article>';
  document.querySelector('#comparables').innerHTML = report.eligibleComparables.length ? report.eligibleComparables.map(row => `<article><div><strong>${esc(row.observationRef)}</strong><span>${esc(row.transactionAt)}</span></div><div><span>${money(row.price)}</span><span>${row.sizeSqft.toLocaleString('en-AE')} sqft · ${money(row.pricePerSqft)}/sqft</span></div><small>${esc(row.sourceDatasetRef)} · ${row.ageDays} days old</small></article>`).join('') : '<article class="empty">No eligible comparable evidence.</article>';
  const exclusions = report.exclusions.map(item => `${item.observationRef}: ${item.reason.replaceAll('_',' ')}`);
  document.querySelector('#limitations').innerHTML = [...exclusions, ...report.limitations].length ? `<article class="warning">${[...exclusions,...report.limitations].map(item=>`<span>${esc(item)}</span>`).join('')}</article>` : '<article class="goodbox">No exclusion or evidence limitation in this synthetic review.</article>';
  let snapshot = null;
  if (ready) snapshot = prepareReviewedMarketSnapshot({ report, narrative:'The inventory asking price per square foot is compared with the governed community evidence. This is indicative and not a valuation.', reviewedByRef:'MANAGER-SYN-1', reviewedAt:asOf });
  document.querySelector('#snapshot').innerHTML = snapshot ? `<article class="snapshot"><strong>Review-ready preview</strong><p>${esc(snapshot.narrative)}</p><span>Mapping version: ${esc(snapshot.subject.communityMappingVersion)}</span><span>Indicative, not a valuation: Yes</span><small>Customer output remains unsent.</small></article>` : '<article class="empty"><strong>Snapshot unavailable</strong><p>Complete the community mapping and obtain sufficient eligible evidence.</p></article>';
}

document.querySelector('#scenario').addEventListener('change', render);
render();
