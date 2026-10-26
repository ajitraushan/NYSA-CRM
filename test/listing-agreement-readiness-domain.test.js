import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateListingAgreementReadiness, LISTING_AGREEMENT_POLICY_VERSION } from '../src/listing-agreement-readiness-domain.js';

const now = '2026-08-08T10:00:00.000Z';
const inventory = { inventoryRef: 'INV-SYN-1', snapshotVersion: 'INV-V7', askingPrice: 1950000, currency: 'AED', verificationStatus: 'verified', availabilityStatus: 'Available' };
const partyAuthority = { partyRef: 'PARTY-SYN-1', authorityEvidenceRef: 'AUTH-SYN-V2', authorityStatus: 'verified', validUntil: '2026-12-31T23:59:59.000Z' };
const controlledTerms = { approvedTemplateRef: 'TEMPLATE-SYN-V1', mandateType: 'exclusive', validFrom: '2026-08-08T00:00:00.000Z', validUntil: '2026-11-08T00:00:00.000Z', askingPrice: 1950000, currency: 'AED', marketingChannels: ['property_finder'], specialTermsReviewed: true };
const draftEvidence = { draftRef: 'DRAFT-SYN-1', draftVersion: '1', inventorySnapshotVersion: 'INV-V7', templateRef: 'TEMPLATE-SYN-V1', preparedAt: '2026-08-08T08:00:00.000Z' };
const signedEvidence = { agreementRef: 'AGREEMENT-SYN-1', draftRef: 'DRAFT-SYN-1', documentHash: 'b'.repeat(64), signedAt: '2026-08-08T09:00:00.000Z', partyRef: 'PARTY-SYN-1', authorityEvidenceRef: 'AUTH-SYN-V2', templateRef: 'TEMPLATE-SYN-V1', validFrom: '2026-08-08T00:00:00.000Z', validUntil: '2026-11-08T00:00:00.000Z' };
const publicationReadiness = { status: 'ready', evidenceRef: 'PUB-READY-SYN-V4' };

test('missing agreement inputs never block Internal Inventory maintenance', () => {
  const result = evaluateListingAgreementReadiness({ inventory, partyAuthority: {}, controlledTerms: {}, publicationReadiness: {}, now });
  assert.equal(result.policyVersion, LISTING_AGREEMENT_POLICY_VERSION);
  assert.equal(result.internalInventory.maintainable, true);
  assert.equal(result.internalInventory.agreementIsPrerequisite, false);
  assert.equal(result.externalListingGate.eligible, false);
  assert.equal(result.externalListingGate.publicationPerformed, false);
});

test('complete sources and controlled terms become ready for a draft without creating one', () => {
  const result = evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, publicationReadiness, now });
  assert.equal(result.agreement.state, 'ready_for_draft');
  assert.equal(result.agreement.preparationReady, true);
  assert.equal(result.agreement.draftAccepted, false);
  assert.equal(result.externalListingGate.eligible, false);
});

test('accepted draft evidence remains signature pending', () => {
  const result = evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence, publicationReadiness, now });
  assert.equal(result.agreement.state, 'signature_pending');
  assert.equal(result.agreement.draftAccepted, true);
  assert.equal(result.agreement.signedEvidenceAccepted, false);
  assert.deepEqual(result.externalListingGate.blockers.map(item => item.code), ['signed_agreement']);
});

test('signed evidence alone cannot weaken the existing publication-readiness gate', () => {
  const result = evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence, signedEvidence, publicationReadiness: { status: 'blocked', evidenceRef: 'PUB-BLOCKED' }, now });
  assert.equal(result.agreement.signedEvidenceAccepted, true);
  assert.equal(result.externalListingGate.eligible, false);
  assert.deepEqual(result.externalListingGate.blockers.map(item => item.code), ['publication_readiness']);
});

test('both evidence gates yield eligibility but never perform publication', () => {
  const result = evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence, signedEvidence, publicationReadiness, now });
  assert.equal(result.agreement.state, 'signed_evidence_accepted');
  assert.equal(result.externalListingGate.eligible, true);
  assert.equal(result.externalListingGate.publicationPerformed, false);
});

test('stale authority, mismatched price, draft, party or document hash fail closed', () => {
  assert.equal(evaluateListingAgreementReadiness({ inventory, partyAuthority: { ...partyAuthority, validUntil: '2026-08-01T00:00:00.000Z' }, controlledTerms, publicationReadiness, now }).agreement.preparationReady, false);
  assert.equal(evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms: { ...controlledTerms, askingPrice: 2000000 }, publicationReadiness, now }).agreement.preparationReady, false);
  assert.equal(evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence: { ...draftEvidence, inventorySnapshotVersion: 'OLD' }, signedEvidence, publicationReadiness, now }).agreement.signedEvidenceAccepted, false);
  assert.equal(evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence, signedEvidence: { ...signedEvidence, partyRef: 'OTHER' }, publicationReadiness, now }).agreement.signedEvidenceAccepted, false);
  assert.equal(evaluateListingAgreementReadiness({ inventory, partyAuthority, controlledTerms, draftEvidence, signedEvidence: { ...signedEvidence, documentHash: 'not-a-hash' }, publicationReadiness, now }).agreement.signedEvidenceAccepted, false);
});
