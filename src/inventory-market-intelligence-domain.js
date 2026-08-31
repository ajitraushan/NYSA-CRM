export const INVENTORY_MARKET_INTELLIGENCE_POLICY_VERSION = 'r4-inventory-market-intelligence-v3';

const clean = value => String(value ?? '').trim();
const instant = value => {
  const text = clean(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
};
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const quarterIdentity = value => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return { label:`${year}-Q${quarter}`, order:year * 4 + quarter };
};

function buildQuarterlyPerformance(eligible) {
  const groups = new Map();
  for (const row of eligible) {
    const identity = quarterIdentity(row.transactionAt);
    const group = groups.get(identity.label) || { ...identity, transactions:0, totalValue:0, totalAreaSqft:0, pricesPerSqft:[] };
    group.transactions += 1;
    group.totalValue += row.price;
    group.totalAreaSqft += row.sizeSqft;
    group.pricesPerSqft.push(row.pricePerSqft);
    groups.set(identity.label, group);
  }
  const series = [...groups.values()].sort((a, b) => a.order - b.order).slice(-4).map(group => ({
    quarter:group.label,
    transactions:group.transactions,
    totalSalesValueAed:Number(group.totalValue.toFixed(2)),
    weightedAveragePricePerSqft:Number((group.totalValue / group.totalAreaSqft).toFixed(2)),
    medianPricePerSqft:Number(median(group.pricesPerSqft).toFixed(2))
  }));
  const latestAvailableQuarter = series.at(-1) || null;
  const quarterlyTrend = series.length >= 2 ? {
    fromQuarter:series[0].quarter,
    toQuarter:latestAvailableQuarter.quarter,
    quartersWithData:series.length,
    fromWeightedAveragePricePerSqft:series[0].weightedAveragePricePerSqft,
    toWeightedAveragePricePerSqft:latestAvailableQuarter.weightedAveragePricePerSqft,
    changePercent:Number((((latestAvailableQuarter.weightedAveragePricePerSqft - series[0].weightedAveragePricePerSqft) / series[0].weightedAveragePricePerSqft) * 100).toFixed(2))
  } : null;
  return { quarterlySeries:series, latestAvailableQuarter, quarterlyTrend };
}

export function buildInventoryMarketIntelligence({ subject = {}, observations = [], asOf, maxAgeDays = 365, minComparables = 3 }) {
  const evaluatedAt = instant(asOf);
  if (!evaluatedAt) throw new Error('asOf must be an ISO timestamp');
  if (!clean(subject.inventoryRef) || !clean(subject.transactionType) || !clean(subject.propertyType) || (!clean(subject.areaId) && !clean(subject.area)) || !Number.isFinite(Number(subject.price)) || Number(subject.price) <= 0) throw new Error('Complete subject Inventory facts are required');
  const exclusions = [], eligible = [];
  for (const row of observations) {
    let reason = null;
    const transactionAt = instant(row.transactionAt);
    const ageDays = transactionAt ? (Date.parse(evaluatedAt) - Date.parse(transactionAt)) / 86400000 : Infinity;
    if (row.inventoryRef === subject.inventoryRef) reason = 'subject_record';
    else if (row.verified !== true || !['licensed','governed_import'].includes(row.usageBasis) || !/^[a-f0-9]{64}$/i.test(clean(row.sourceEvidenceHash))) reason = 'unverified_source';
    else if (row.transactionType !== subject.transactionType) reason = 'transaction_type_mismatch';
    else if (row.propertyType !== subject.propertyType) reason = 'property_type_mismatch';
    else if (clean(subject.communityId) && clean(row.communityId) !== clean(subject.communityId)) reason = 'community_mismatch';
    else if (!clean(subject.communityId) && clean(subject.community) && row.community !== subject.community) reason = 'community_mismatch';
    else if (!clean(subject.communityId) && !clean(subject.community) && clean(subject.areaId) && clean(row.areaId) !== clean(subject.areaId)) reason = 'area_mismatch';
    else if (!clean(subject.communityId) && !clean(subject.community) && !clean(subject.areaId) && row.area !== subject.area) reason = 'area_mismatch';
    else if (Number.isFinite(Number(subject.bedrooms)) && Math.abs(Number(row.bedrooms) - Number(subject.bedrooms)) > 1) reason = 'bedroom_mismatch';
    else if (!transactionAt || ageDays < 0 || ageDays > maxAgeDays) reason = 'stale_observation';
    else if (!Number.isFinite(Number(row.price)) || Number(row.price) <= 0 || !Number.isFinite(Number(row.sizeSqft)) || Number(row.sizeSqft) <= 0) reason = 'invalid_measurement';
    if (reason) exclusions.push({ observationRef:row.observationRef, reason });
    else eligible.push({ ...row, price:Number(row.price), sizeSqft:Number(row.sizeSqft), pricePerSqft:Number((Number(row.price) / Number(row.sizeSqft)).toFixed(2)), ageDays:Number(ageDays.toFixed(1)) });
  }
  const sufficient = eligible.length >= minComparables;
  const prices = eligible.map(row => row.price), pricesPerSqft = eligible.map(row => row.pricePerSqft);
  const medianPrice = sufficient ? median(prices) : null;
  const medianPricePerSqft = sufficient ? Number(median(pricesPerSqft).toFixed(2)) : null;
  const subjectVariancePercent = sufficient ? Number((((Number(subject.price) - medianPrice) / medianPrice) * 100).toFixed(2)) : null;
  const totalComparableArea = eligible.reduce((sum, row) => sum + row.sizeSqft, 0);
  const weightedAveragePricePerSqft = sufficient && totalComparableArea > 0 ? Number((eligible.reduce((sum, row) => sum + row.price, 0) / totalComparableArea).toFixed(2)) : null;
  const subjectPricePerSqft = Number.isFinite(Number(subject.sizeSqft)) && Number(subject.sizeSqft) > 0 ? Number((Number(subject.price) / Number(subject.sizeSqft)).toFixed(2)) : null;
  const subjectVarianceToWeightedAveragePercent = sufficient && subjectPricePerSqft !== null && weightedAveragePricePerSqft ? Number((((subjectPricePerSqft - weightedAveragePricePerSqft) / weightedAveragePricePerSqft) * 100).toFixed(2)) : null;
  const performance = sufficient ? buildQuarterlyPerformance(eligible) : { quarterlySeries:[], latestAvailableQuarter:null, quarterlyTrend:null };
  return {
    policyVersion:INVENTORY_MARKET_INTELLIGENCE_POLICY_VERSION,
    subject:{ inventoryRef:subject.inventoryRef, transactionType:subject.transactionType, propertyType:subject.propertyType, areaId:clean(subject.areaId) || null, area:subject.area, communityId:clean(subject.communityId) || null, community:clean(subject.community) || null, communityMappingVersion:clean(subject.communityMappingVersion) || null, bedrooms:subject.bedrooms ?? null, price:Number(subject.price), sizeSqft:subjectPricePerSqft === null ? null : Number(subject.sizeSqft) },
    asOf:evaluatedAt,
    status:sufficient ? 'ready_for_review' : 'insufficient_evidence',
    eligibleComparables:eligible.map(row => ({ observationRef:row.observationRef, transactionAt:row.transactionAt, price:row.price, sizeSqft:row.sizeSqft, pricePerSqft:row.pricePerSqft, sourceDatasetRef:row.sourceDatasetRef, ageDays:row.ageDays })),
    exclusions,
    metrics:sufficient ? { comparableCount:eligible.length, medianPrice, medianPricePerSqft, weightedAveragePricePerSqft, subjectPricePerSqft, subjectVarianceToWeightedAveragePercent, priceRange:{ min:Math.min(...prices), max:Math.max(...prices) }, subjectVariancePercent, ...performance } : null,
    limitations:[
      ...(!sufficient ? [`At least ${minComparables} eligible comparables are required`] : []),
      ...(!clean(subject.communityId) ? ['No Admin-approved canonical community mapping is assigned; integration must not auto-link by text'] : []),
      ...(sufficient && !performance.quarterlyTrend ? ['Quarterly trend is unavailable until the community has data in at least two quarters; latest available quarter is shown without a trend claim'] : [])
    ],
    aiNarrativeGenerated:false,
    customerOutputPrepared:false
  };
}

export function prepareReviewedMarketSnapshot({ report, narrative, reviewedByRef, reviewedAt }) {
  if (report?.status !== 'ready_for_review' || !report.metrics) throw new Error('Sufficient deterministic market evidence is required');
  if (clean(narrative).length < 20) throw new Error('Reviewed explanatory narrative is required');
  if (!clean(reviewedByRef)) throw new Error('Reviewer reference is required');
  const at = instant(reviewedAt);
  if (!at) throw new Error('reviewedAt must be an ISO timestamp');
  return { policyVersion:report.policyVersion, subject:structuredClone(report.subject), asOf:report.asOf, metrics:structuredClone(report.metrics), comparableEvidence:report.eligibleComparables.map(row => ({ observationRef:row.observationRef, transactionAt:row.transactionAt, price:row.price, sizeSqft:row.sizeSqft, pricePerSqft:row.pricePerSqft, sourceDatasetRef:row.sourceDatasetRef })), limitations:[...report.limitations], narrative:clean(narrative), reviewedByRef:clean(reviewedByRef), reviewedAt:at, immutable:true, indicativeNotValuation:true, privateSourceRecordExposed:false, customerOutputPrepared:true };
}
