export const INVENTORY_DUPLICATE_REVIEW_POLICY_VERSION = 'r4-inventory-duplicate-review-v1';
export const INVENTORY_DUPLICATE_REVIEW_DECISIONS = Object.freeze(['confirm_duplicate','separate_properties','defer']);
export const INVENTORY_REOPEN_DECISIONS = Object.freeze(['approve_reopen','reject_reopen']);

const clean = value => String(value ?? '').trim();
const normalized = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const instant = value => {
  const text = clean(value);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
};
// Synchronous SHA-256 keeps candidate IDs deterministic in both Node and the
// browser-only review prototype. This domain deliberately has no Node runtime
// dependency so the exact same evidence snapshot is reviewed in both places.
const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));
const sha256 = input => {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const x = words[i - 15], y = words[i - 2];
      const sigma0 = rotateRight(x,7) ^ rotateRight(x,18) ^ (x >>> 3);
      const sigma1 = rotateRight(y,17) ^ rotateRight(y,19) ^ (y >>> 10);
      words[i] = (words[i - 16] + sigma0 + words[i - 7] + sigma1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = state;
    for (let i = 0; i < 64; i += 1) {
      const sum1 = rotateRight(e,6) ^ rotateRight(e,11) ^ rotateRight(e,25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[i] + words[i]) >>> 0;
      const sum0 = rotateRight(a,2) ^ rotateRight(a,13) ^ rotateRight(a,22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
  }
  return state.map(value => value.toString(16).padStart(8,'0')).join('');
};
const hash = value => sha256(JSON.stringify(value));
const same = (left, right) => Boolean(normalized(left)) && normalized(left) === normalized(right);
const closeSize = (left, right, tolerance = 0.02) => {
  const a = finite(left), b = finite(right);
  return a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= tolerance;
};
const sourceKeys = record => (Array.isArray(record.sourceIdentities) ? record.sourceIdentities : [])
  .map(item => `${normalized(item?.provider)}|${normalized(item?.externalRecordId)}`)
  .filter(key => key !== '|');

function publicRecord(record = {}) {
  if (!clean(record.inventoryRef)) throw new Error('Inventory reference is required');
  return {
    inventoryRef:clean(record.inventoryRef),
    lifecycleStatus:normalized(record.lifecycleStatus) || 'active',
    propertyReference:clean(record.propertyReference) || null,
    areaId:clean(record.areaId) || null,
    area:clean(record.area) || null,
    communityId:clean(record.communityId) || null,
    community:clean(record.community) || null,
    project:clean(record.project) || null,
    building:clean(record.building) || null,
    unitReference:clean(record.unitReference) || null,
    unitNumber:clean(record.unitNumber) || null,
    propertyType:clean(record.propertyType) || null,
    bedrooms:clean(record.bedrooms) || null,
    sizeSqft:finite(record.sizeSqft),
    permitNumber:clean(record.permitNumber) || null,
    sourceIdentities:(Array.isArray(record.sourceIdentities) ? record.sourceIdentities : []).map(item => ({
      provider:clean(item?.provider), externalRecordId:clean(item?.externalRecordId)
    })).filter(item => item.provider && item.externalRecordId)
  };
}

export function buildInventoryDuplicateCandidate({ left, right, evaluatedAt }) {
  const at = instant(evaluatedAt);
  if (!at) throw new Error('evaluatedAt must be an ISO timestamp');
  const a = publicRecord(left), b = publicRecord(right);
  if (a.inventoryRef === b.inventoryRef) throw new Error('Duplicate review requires two different Inventory records');
  const evidence = [], conflicts = [];
  const add = (code, label, weight, strength = 'supporting') => evidence.push({ code, label, weight, strength });
  const sharedSource = sourceKeys(a).find(key => sourceKeys(b).includes(key));
  if (sharedSource) add('same_external_source_identity','The same provider and external record ID are linked to both records',60,'strong');
  if (same(a.propertyReference,b.propertyReference)) add('same_property_reference','The property reference is identical',25,'supporting');
  if (same(a.areaId,b.areaId)) add('same_area_id','The governed Area is identical',8);
  else if (!a.areaId && !b.areaId && same(a.area,b.area)) add('same_area_label','The maintained Area is identical',8);
  if (same(a.communityId,b.communityId)) add('same_community_id','The governed Community is identical',12);
  else if (!a.communityId && !b.communityId && same(a.community,b.community)) add('same_community_label','The maintained Community is identical',12);
  if (same(a.project,b.project)) add('same_project','Project matches',12);
  if (same(a.building,b.building)) add('same_building','Building matches',18);
  if (same(a.unitNumber,b.unitNumber)) add('same_unit_number','Unit number matches',35);
  if (same(a.propertyType,b.propertyType)) add('same_property_type','Property type matches',8);
  if (clean(a.bedrooms) && clean(b.bedrooms) && same(a.bedrooms,b.bedrooms)) add('same_bedrooms','Bedroom count matches',5);
  const exactSize=a.sizeSqft!==null&&b.sizeSqft!==null&&Number(a.sizeSqft)===Number(b.sizeSqft);
  if (exactSize) add('same_size_sqft','Maintained size matches exactly',12);
  else if (closeSize(a.sizeSqft,b.sizeSqft,0.01)) add('size_within_1_percent','Size differs by no more than 1%',10,'weak');
  else if (closeSize(a.sizeSqft,b.sizeSqft,0.03)) add('size_within_3_percent','Size differs by no more than 3%',6,'weak');
  if (same(a.permitNumber,b.permitNumber)) add('same_permit_number','The current permit number matches',10);
  const areaA=a.areaId||a.area,areaB=b.areaId||b.area,communityA=a.communityId||a.community,communityB=b.communityId||b.community;
  if (areaA && areaB && !same(areaA,areaB)) conflicts.push({ code:'different_area', label:'Maintained Areas differ' });
  if (communityA && communityB && !same(communityA,communityB)) conflicts.push({ code:'different_community', label:'Maintained Communities differ' });
  if (a.building && b.building && !same(a.building,b.building)) conflicts.push({ code:'different_building', label:'Buildings differ' });
  if (a.unitNumber && b.unitNumber && !same(a.unitNumber,b.unitNumber)) conflicts.push({ code:'different_unit_number', label:'Unit numbers differ' });
  if (a.sizeSqft!==null && b.sizeSqft!==null && !exactSize) conflicts.push({ code:'different_size_sqft', label:'Maintained sizes differ' });
  if (a.propertyType && b.propertyType && !same(a.propertyType,b.propertyType)) conflicts.push({ code:'different_property_type', label:'Property types differ' });
  const unitValueA=a.unitNumber||a.unitReference,unitValueB=b.unitNumber||b.unitReference;
  const exact = Boolean(areaA && communityA && a.building && unitValueA && a.sizeSqft!==null)
    && same(areaA,areaB) && same(communityA,communityB) && same(a.building,b.building) && same(unitValueA,unitValueB) && exactSize;
  if (exact) add('same_governed_inventory_identity','Unit Number + Building + Size + Community + Area reconcile exactly',100,'exact');
  const descriptiveUnitMatch = evidence.some(item => item.code === 'same_unit_number') && evidence.some(item => ['same_building','same_project'].includes(item.code));
  const rawScore = exact ? 100 : descriptiveUnitMatch ? Math.max(92,evidence.reduce((sum,item)=>sum+item.weight,0)) : evidence.reduce((sum,item)=>sum+item.weight,0);
  const scoreCeiling = exact ? 100 : descriptiveUnitMatch ? 89 : 73;
  const score = Math.min(scoreCeiling, Math.max(0, rawScore - conflicts.length * 18));
  const classification = exact ? 'exact_identity_match' : descriptiveUnitMatch && score >= 74 ? 'strong_duplicate_candidate' : score >= 58 ? 'possible_duplicate' : 'unlikely_duplicate';
  const reviewRequired = !exact && classification !== 'unlikely_duplicate';
  const matchingInventoryClosed = exact && a.lifecycleStatus === 'closed';
  const maintenanceOutcome = matchingInventoryClosed ? 'require_manager_reopen_approval'
    : exact ? 'block_active_duplicate'
    : reviewRequired ? 'hold_intake_for_duplicate_review'
      : 'allow_inventory_maintenance';
  const identitySnapshot = { policyVersion:INVENTORY_DUPLICATE_REVIEW_POLICY_VERSION, evaluatedAt:at, left:a, right:b, evidence, conflicts, score, classification };
  return {
    ...identitySnapshot,
    candidateId:`INV-DUP-${hash(identitySnapshot).slice(0,16).toUpperCase()}`,
    evidenceHash:hash(identitySnapshot),
    reviewRequired,
    automaticMergeAllowed:false,
    inventoryMutationPerformed:false,
    maintenanceGate:{
      mode:'background_pre_save',
      outcome:maintenanceOutcome,
      inventoryCreateAllowed:maintenanceOutcome === 'allow_inventory_maintenance',
      governedIdentityUpdateAllowed:maintenanceOutcome === 'allow_inventory_maintenance',
      activeInventoryCreated:false,
      existingInventoryRef:exact ? a.inventoryRef : null,
      existingInventoryStatus:exact ? a.lifecycleStatus : null,
      managerApprovalRequired:maintenanceOutcome === 'require_manager_reopen_approval',
      existingInventoryEditable:false,
      databaseUniquenessSafeguardRequired:true
    },
    existingWorkItemRequest:reviewRequired ? {
      action:'create_or_update_existing_work_item',
      type:'inventory_duplicate_review',
      subjectRefs:[a.inventoryRef,b.inventoryRef],
      duePolicy:'normal_inventory_review_sla',
      separateQueueCreated:false
    } : null
  };
}

export function recordInventoryDuplicateDecision({ candidate, decision, canonicalInventoryRef, reason, reviewedByRef, reviewedAt, deferUntil }) {
  if (!candidate?.candidateId || !candidate?.evidenceHash) throw new Error('A deterministic duplicate candidate is required');
  if (!candidate.reviewRequired) throw new Error('An unlikely match does not require a duplicate-review decision');
  if (!INVENTORY_DUPLICATE_REVIEW_DECISIONS.includes(decision)) throw new Error('Decision must confirm duplicate, keep separate, or defer');
  if (clean(reason).length < 10) throw new Error('A review reason of at least 10 characters is required');
  if (!clean(reviewedByRef)) throw new Error('Reviewer reference is required');
  const at = instant(reviewedAt);
  if (!at) throw new Error('reviewedAt must be an ISO timestamp');
  const allowedRefs = [candidate.left.inventoryRef,candidate.right.inventoryRef];
  let canonical = null, superseded = null, deferredUntil = null;
  if (decision === 'confirm_duplicate') {
    if (!allowedRefs.includes(clean(canonicalInventoryRef))) throw new Error('Select one reviewed Inventory record as canonical');
    canonical = clean(canonicalInventoryRef);
    superseded = allowedRefs.find(value => value !== canonical);
  }
  if (decision === 'defer') {
    deferredUntil = instant(deferUntil);
    if (!deferredUntil || Date.parse(deferredUntil) <= Date.parse(at)) throw new Error('A future deferUntil timestamp is required');
  }
  const record = {
    policyVersion:INVENTORY_DUPLICATE_REVIEW_POLICY_VERSION,
    candidateId:candidate.candidateId,
    candidateEvidenceHash:candidate.evidenceHash,
    decision,
    canonicalInventoryRef:canonical,
    supersededInventoryRef:superseded,
    reason:clean(reason),
    reviewedByRef:clean(reviewedByRef),
    reviewedAt:at,
    deferUntil:deferredUntil,
    mergeExecuted:false,
    inventoryMutationPerformed:false,
    preservationRequirements:decision === 'confirm_duplicate' ? ['source_links','media_versions','document_versions','activities','audit_history','portal_links','reservation_and_availability_state'] : [],
    existingWorkItemRequest:{
      action:decision === 'defer' ? 'reschedule_existing_work_item' : 'complete_existing_work_item',
      type:'inventory_duplicate_review',
      candidateId:candidate.candidateId,
      dueAt:deferredUntil,
      separateQueueCreated:false
    }
  };
  return { ...record, decisionHash:hash(record), immutable:true };
}

export function recordInventoryReopenDecision({ candidate, decision, reason, managerRef, decidedAt }) {
  if (candidate?.maintenanceGate?.outcome !== 'require_manager_reopen_approval') throw new Error('Manager reopen approval is available only for a matching closed Inventory');
  if (!INVENTORY_REOPEN_DECISIONS.includes(decision)) throw new Error('Decision must approve or reject reopening');
  if (clean(reason).length < 10) throw new Error('A manager reason of at least 10 characters is required');
  if (!clean(managerRef)) throw new Error('Manager reference is required');
  const at = instant(decidedAt);
  if (!at) throw new Error('decidedAt must be an ISO timestamp');
  const approved = decision === 'approve_reopen';
  const record = {
    policyVersion:INVENTORY_DUPLICATE_REVIEW_POLICY_VERSION,
    candidateId:candidate.candidateId,
    candidateEvidenceHash:candidate.evidenceHash,
    inventoryRef:candidate.maintenanceGate.existingInventoryRef,
    previousStatus:'closed',
    decision,
    approved,
    resultingStatus:approved ? 'active' : 'closed',
    editAllowedAfterApproval:approved,
    newInventoryCreated:false,
    statusMutationPerformed:false,
    reason:clean(reason),
    managerRef:clean(managerRef),
    decidedAt:at,
    preservationRequirements:['status_history','activities','audit_history','source_links','media_versions','document_versions','portal_links','reservation_and_availability_state']
  };
  return { ...record, approvalHash:hash(record), immutable:true };
}
