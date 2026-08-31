export const PARTNER_MASTER_POLICY_VERSION = 'r4-partner-master-v1';
export const PARTNER_TYPES = Object.freeze(['developer', 'external_agency', 'referral_partner', 'service_provider']);

const clean = value => String(value ?? '').trim();
const instant = value => {
  const normalized = clean(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : null;
};
const normalizeName = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function preparePartnerMasterDraft(input = {}, existingPartners = []) {
  const errors = [];
  const evaluatedAt = instant(input.now);
  if (!PARTNER_TYPES.includes(input.partnerType)) errors.push('Select a supported partner type');
  if (clean(input.legalName).length < 3) errors.push('Legal organization name is required');
  if (!clean(input.sourceEvidenceRef)) errors.push('Source evidence reference is required');
  if (!/^[a-f0-9]{64}$/i.test(clean(input.sourceEvidenceHash))) errors.push('Source evidence SHA-256 is required');
  if (!clean(input.createdByRef)) errors.push('Creator reference is required');
  if (!evaluatedAt) errors.push('now must be an ISO timestamp');
  const licenceExpiry = input.licenceExpiresAt ? instant(input.licenceExpiresAt) : null;
  if (input.licenceExpiresAt && !licenceExpiry) errors.push('Licence expiry must be a valid timestamp');
  if ((clean(input.licenceIssuer) || licenceExpiry) && !clean(input.licenceRef)) errors.push('Licence reference is required when licence details are supplied');

  const normalizedLicence = clean(input.licenceRef).toLowerCase();
  const normalizedLegalName = normalizeName(input.legalName);
  const duplicateCandidates = existingPartners.filter(partner => partner.status !== 'retired' && (
    (normalizedLicence && clean(partner.licenceRef).toLowerCase() === normalizedLicence) ||
    normalizeName(partner.legalName) === normalizedLegalName
  )).map(partner => ({ partnerRef: partner.partnerRef, legalName: partner.legalName, matchBasis: normalizedLicence && clean(partner.licenceRef).toLowerCase() === normalizedLicence ? 'exact_licence' : 'normalized_legal_name' }));

  if (errors.length) return { valid: false, errors, duplicateCandidates, draft: null };
  const version = 1;
  const code = input.partnerType.toUpperCase().replaceAll('_', '-');
  return {
    valid: true,
    errors: [],
    duplicateCandidates,
    draft: {
      policyVersion: PARTNER_MASTER_POLICY_VERSION,
      partnerRef: `${code}-SYN-${String(existingPartners.length + 1).padStart(3, '0')}`,
      partnerType: input.partnerType,
      legalName: clean(input.legalName),
      tradeName: clean(input.tradeName) || null,
      licenceRef: clean(input.licenceRef) || null,
      licenceIssuer: clean(input.licenceIssuer) || null,
      licenceExpiresAt: licenceExpiry,
      licenceEvidenceStatus: clean(input.licenceRef) ? 'provided' : 'not_provided',
      serviceAreas: [...new Set((input.serviceAreas ?? []).map(clean).filter(Boolean))],
      projectReferences: [...new Set((input.projectReferences ?? []).map(clean).filter(Boolean))],
      sourceEvidence: { reference: clean(input.sourceEvidenceRef), hash: clean(input.sourceEvidenceHash) },
      version,
      supersedesPartnerVersionRef: null,
      immutable: true,
      status: duplicateCandidates.length ? 'duplicate_review' : 'pending_verification',
      createdByRef: clean(input.createdByRef),
      createdAt: evaluatedAt,
      privateContactStored: false
    }
  };
}

export function decidePartnerDuplicateReview({ draft, decision, existingPartnerRef, reason, reviewerRef, now }) {
  if (!draft?.immutable || draft.status !== 'duplicate_review') throw new Error('Only a duplicate-review draft can be decided');
  if (!['continue_new', 'use_existing'].includes(decision)) throw new Error('Unsupported duplicate decision');
  if (!clean(reviewerRef)) throw new Error('Reviewer reference is required');
  if (clean(reason).length < 10) throw new Error('A meaningful duplicate-review reason is required');
  const reviewedAt = instant(now);
  if (!reviewedAt) throw new Error('now must be an ISO timestamp');
  return { ...structuredClone(draft), status: decision === 'continue_new' ? 'pending_verification' : 'duplicate_closed', duplicateReview: { decision, existingPartnerRef: clean(existingPartnerRef) || null, reason: clean(reason), reviewerRef: clean(reviewerRef), reviewedAt } };
}

export function verifyPartnerMaster({ draft, decision, reason, verifierRef, now }) {
  if (!draft?.immutable || draft.status !== 'pending_verification') throw new Error('Only a pending partner draft can be verified');
  if (!['verified', 'returned', 'rejected'].includes(decision)) throw new Error('Unsupported verification decision');
  if (!clean(verifierRef)) throw new Error('Verifier reference is required');
  if (decision !== 'verified' && clean(reason).length < 10) throw new Error('A meaningful reason is required');
  const verifiedAt = instant(now);
  if (!verifiedAt) throw new Error('now must be an ISO timestamp');
  if (decision === 'verified' && draft.licenceExpiresAt && Date.parse(draft.licenceExpiresAt) <= Date.parse(verifiedAt)) throw new Error('An expired licence cannot be verified');
  return { ...structuredClone(draft), status: decision === 'verified' ? 'active' : decision, verification: { decision, reason: clean(reason) || null, verifierRef: clean(verifierRef), verifiedAt } };
}

export function createPartnerRevision(active, changes = {}, actorRef, now) {
  if (!active?.immutable || active.status !== 'active') throw new Error('An active partner version is required');
  const createdAt = instant(now);
  if (!createdAt) throw new Error('now must be an ISO timestamp');
  if (!clean(actorRef)) throw new Error('Actor reference is required');
  const version = Number(active.version) + 1;
  return { ...structuredClone(active), ...structuredClone(changes), version, supersedesPartnerVersionRef: `${active.partnerRef}-V${active.version}`, status: 'pending_verification', verification: null, createdByRef: clean(actorRef), createdAt, immutable: true };
}

export function evaluateInventoryOrganizationLinkage({ sourceType, ownerPartyRef, activePartner }) {
  const supported = ['direct_owner', 'internal_agent', 'developer', 'external_agency', 'referral_partner', 'portal_or_import'];
  if (!supported.includes(sourceType)) throw new Error('Select a supported Inventory origin');
  if (sourceType === 'direct_owner' && !clean(ownerPartyRef)) throw new Error('Direct-owner Inventory requires a secured owner-party reference');
  const organizationExpected = ['developer', 'external_agency', 'referral_partner'].includes(sourceType);
  const organizationLinkReady = organizationExpected && activePartner?.immutable === true && activePartner.status === 'active';
  return {
    sourceType,
    inventoryMaintenanceAllowed: true,
    ownerPartyRef: clean(ownerPartyRef) || null,
    partnerMasterRequiredForMaintenance: false,
    organizationExpected,
    organizationLinkReady,
    nextAction: !organizationExpected ? 'No Partner Master relationship required' : organizationLinkReady ? 'Optional organization relationship may be recorded' : 'Organization relationship may be completed later'
  };
}

export function prepareInventoryOrganizationLink({ activePartner, inventoryRef, relationship, linkedByRef, now }) {
  if (!activePartner?.immutable || activePartner.status !== 'active') throw new Error('Only an active verified partner can be linked');
  if (!clean(inventoryRef)) throw new Error('Inventory reference is required');
  if (!['developer', 'listing_source_agency', 'referral_source'].includes(relationship)) throw new Error('Select a supported Inventory relationship');
  if (!clean(linkedByRef)) throw new Error('Linking actor reference is required');
  const linkedAt = instant(now);
  if (!linkedAt) throw new Error('now must be an ISO timestamp');
  return { policyVersion: PARTNER_MASTER_POLICY_VERSION, inventoryRef: clean(inventoryRef), partnerRef: activePartner.partnerRef, partnerVersion: activePartner.version, relationship, sourceEvidenceHash: activePartner.sourceEvidence.hash, linkedByRef: clean(linkedByRef), linkedAt, immutable: true, inventoryMutationPerformed: false };
}
