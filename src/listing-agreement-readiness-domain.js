export const LISTING_AGREEMENT_POLICY_VERSION = 'r4-listing-agreement-readiness-v1';

const MANDATE_TYPES = new Set(['exclusive', 'non_exclusive']);
const CHANNELS = new Set(['property_finder', 'bayut_dubizzle', 'company_website', 'direct_marketing']);
const HASH_PATTERN = /^[a-f0-9]{64}$/i;

function text(value) {
  return String(value ?? '').trim();
}

function instant(value) {
  const normalized = text(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : null;
}

function positiveAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function addMissing(target, condition, code, label) {
  if (!condition) target.push({ code, label });
}

export function evaluateListingAgreementReadiness({
  inventory = {},
  partyAuthority = {},
  controlledTerms = {},
  draftEvidence = null,
  signedEvidence = null,
  publicationReadiness = {},
  now
}) {
  const evaluatedAt = instant(now);
  if (!evaluatedAt) throw new Error('now must be an ISO timestamp');

  const inventoryFacts = {
    inventoryRef: text(inventory.inventoryRef),
    snapshotVersion: text(inventory.snapshotVersion),
    askingPrice: positiveAmount(inventory.askingPrice),
    currency: text(inventory.currency).toUpperCase(),
    verificationStatus: text(inventory.verificationStatus),
    availabilityStatus: text(inventory.availabilityStatus)
  };
  const authorityFacts = {
    partyRef: text(partyAuthority.partyRef),
    authorityEvidenceRef: text(partyAuthority.authorityEvidenceRef),
    authorityStatus: text(partyAuthority.authorityStatus),
    validUntil: instant(partyAuthority.validUntil)
  };
  const selectedChannels = [...new Set((controlledTerms.marketingChannels ?? []).map(text).filter(Boolean))];
  const terms = {
    approvedTemplateRef: text(controlledTerms.approvedTemplateRef),
    mandateType: text(controlledTerms.mandateType),
    validFrom: instant(controlledTerms.validFrom),
    validUntil: instant(controlledTerms.validUntil),
    askingPrice: positiveAmount(controlledTerms.askingPrice),
    currency: text(controlledTerms.currency).toUpperCase(),
    marketingChannels: selectedChannels,
    specialTermsReviewed: controlledTerms.specialTermsReviewed === true
  };

  const missingInputs = [];
  addMissing(missingInputs, inventoryFacts.inventoryRef, 'inventory_ref', 'Inventory reference');
  addMissing(missingInputs, inventoryFacts.snapshotVersion, 'inventory_snapshot', 'Inventory snapshot version');
  addMissing(missingInputs, inventoryFacts.askingPrice, 'inventory_price', 'Inventory asking price');
  addMissing(missingInputs, inventoryFacts.currency, 'inventory_currency', 'Inventory currency');
  addMissing(missingInputs, authorityFacts.partyRef, 'represented_party', 'Maintained represented-party reference');
  addMissing(missingInputs, authorityFacts.authorityEvidenceRef, 'authority_evidence', 'Authority evidence reference');
  addMissing(missingInputs, authorityFacts.authorityStatus === 'verified', 'authority_status', 'Verified authority');
  addMissing(missingInputs, authorityFacts.validUntil && Date.parse(authorityFacts.validUntil) > Date.parse(evaluatedAt), 'authority_expiry', 'Current authority evidence');
  addMissing(missingInputs, terms.approvedTemplateRef, 'approved_template', 'Approved agreement template');
  addMissing(missingInputs, MANDATE_TYPES.has(terms.mandateType), 'mandate_type', 'Governed mandate type');
  addMissing(missingInputs, terms.validFrom, 'valid_from', 'Agreement start date');
  addMissing(missingInputs, terms.validUntil, 'valid_until', 'Agreement end date');
  addMissing(missingInputs, terms.validFrom && terms.validUntil && Date.parse(terms.validUntil) > Date.parse(terms.validFrom), 'valid_period', 'Valid agreement period');
  addMissing(missingInputs, terms.askingPrice, 'agreement_price', 'Agreement asking price');
  addMissing(missingInputs, terms.currency, 'agreement_currency', 'Agreement currency');
  addMissing(missingInputs, terms.askingPrice === inventoryFacts.askingPrice && terms.currency === inventoryFacts.currency, 'price_snapshot_match', 'Agreement terms matching the Inventory snapshot');
  addMissing(missingInputs, selectedChannels.length > 0 && selectedChannels.every(channel => CHANNELS.has(channel)), 'marketing_channels', 'Governed marketing channel scope');
  addMissing(missingInputs, terms.specialTermsReviewed, 'special_terms_review', 'Special-terms review');

  const preparationReady = missingInputs.length === 0;
  const normalizedDraft = draftEvidence ? {
    draftRef: text(draftEvidence.draftRef),
    draftVersion: text(draftEvidence.draftVersion),
    inventorySnapshotVersion: text(draftEvidence.inventorySnapshotVersion),
    templateRef: text(draftEvidence.templateRef),
    preparedAt: instant(draftEvidence.preparedAt)
  } : null;
  const draftAccepted = Boolean(preparationReady && normalizedDraft?.draftRef && normalizedDraft?.draftVersion &&
    normalizedDraft.inventorySnapshotVersion === inventoryFacts.snapshotVersion &&
    normalizedDraft.templateRef === terms.approvedTemplateRef && normalizedDraft.preparedAt);

  const signedBlockers = [];
  let normalizedSigned = null;
  if (signedEvidence) {
    normalizedSigned = {
      agreementRef: text(signedEvidence.agreementRef),
      draftRef: text(signedEvidence.draftRef),
      documentHash: text(signedEvidence.documentHash),
      signedAt: instant(signedEvidence.signedAt),
      partyRef: text(signedEvidence.partyRef),
      authorityEvidenceRef: text(signedEvidence.authorityEvidenceRef),
      templateRef: text(signedEvidence.templateRef),
      validFrom: instant(signedEvidence.validFrom),
      validUntil: instant(signedEvidence.validUntil)
    };
    addMissing(signedBlockers, draftAccepted, 'accepted_draft', 'Accepted agreement draft evidence');
    addMissing(signedBlockers, normalizedSigned.agreementRef, 'agreement_ref', 'Signed agreement reference');
    addMissing(signedBlockers, HASH_PATTERN.test(normalizedSigned.documentHash), 'document_hash', 'Signed-document SHA-256');
    addMissing(signedBlockers, normalizedSigned.signedAt && Date.parse(normalizedSigned.signedAt) <= Date.parse(evaluatedAt), 'signed_at', 'Valid signing timestamp');
    addMissing(signedBlockers, normalizedSigned.draftRef === normalizedDraft?.draftRef, 'signed_draft_match', 'Signature bound to the accepted draft');
    addMissing(signedBlockers, normalizedSigned.partyRef === authorityFacts.partyRef, 'signed_party_match', 'Represented-party match');
    addMissing(signedBlockers, normalizedSigned.authorityEvidenceRef === authorityFacts.authorityEvidenceRef, 'signed_authority_match', 'Authority-evidence match');
    addMissing(signedBlockers, normalizedSigned.templateRef === terms.approvedTemplateRef, 'signed_template_match', 'Approved-template match');
    addMissing(signedBlockers, normalizedSigned.validFrom === terms.validFrom && normalizedSigned.validUntil === terms.validUntil, 'signed_period_match', 'Agreement-period match');
    addMissing(signedBlockers, normalizedSigned.validUntil && Date.parse(normalizedSigned.validUntil) > Date.parse(evaluatedAt), 'signed_not_expired', 'Unexpired signed agreement');
  }
  const signedEvidenceAccepted = Boolean(normalizedSigned && signedBlockers.length === 0);

  const publicationBlockers = [];
  if (!signedEvidenceAccepted) publicationBlockers.push({ code: 'signed_agreement', label: 'Accepted signed-agreement evidence' });
  if (publicationReadiness.status !== 'ready' || !text(publicationReadiness.evidenceRef)) {
    publicationBlockers.push({ code: 'publication_readiness', label: 'Existing publication-readiness evidence' });
  }

  let agreementState = 'inputs_incomplete';
  if (preparationReady) agreementState = 'ready_for_draft';
  if (draftAccepted) agreementState = 'signature_pending';
  if (signedEvidence && !signedEvidenceAccepted) agreementState = 'signed_evidence_rejected';
  if (signedEvidenceAccepted) agreementState = 'signed_evidence_accepted';

  return {
    policyVersion: LISTING_AGREEMENT_POLICY_VERSION,
    classification: 'synthetic_local_not_integrated',
    evaluatedAt,
    internalInventory: {
      maintainable: true,
      agreementIsPrerequisite: false
    },
    inventoryFacts,
    authorityFacts,
    controlledTerms: terms,
    agreement: {
      state: agreementState,
      preparationReady,
      missingInputs,
      draftAccepted,
      signedEvidenceAccepted,
      signedBlockers
    },
    externalListingGate: {
      eligible: publicationBlockers.length === 0,
      blockers: publicationBlockers,
      publicationPerformed: false
    }
  };
}
