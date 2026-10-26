import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePartnerMasterDraft, decidePartnerDuplicateReview, verifyPartnerMaster, createPartnerRevision, evaluateInventoryOrganizationLinkage, prepareInventoryOrganizationLink } from '../src/partner-master-domain.js';

const now = '2026-08-09T09:00:00.000Z';
const hash = 'a'.repeat(64);
const input = { partnerType: 'developer', legalName: 'Synthetic Developments LLC', tradeName: 'Synthetic Developments', licenceRef: 'LIC-SYN-001', licenceIssuer: 'Synthetic Authority', licenceExpiresAt: '2027-01-01T00:00:00.000Z', serviceAreas: ['Dubai', 'Dubai'], projectReferences: ['PROJECT-SYN-1'], sourceEvidenceRef: 'EVIDENCE-SYN-1', sourceEvidenceHash: hash, createdByRef: 'ADMIN-SYN-1', now };

test('licence is optional for every external organization while source evidence remains required', () => {
  assert.equal(preparePartnerMasterDraft(input).valid, true);
  const withoutLicence = preparePartnerMasterDraft({ ...input, licenceRef: '', licenceIssuer: '', licenceExpiresAt: null });
  assert.equal(withoutLicence.valid, true);
  assert.equal(withoutLicence.draft.licenceEvidenceStatus, 'not_provided');
  assert.equal(preparePartnerMasterDraft({ ...input, sourceEvidenceHash: 'bad' }).valid, false);
});

test('partner master stores organization evidence without private contacts', () => {
  const draft = preparePartnerMasterDraft(input).draft;
  assert.equal(draft.status, 'pending_verification');
  assert.equal(draft.privateContactStored, false);
  assert.deepEqual(draft.serviceAreas, ['Dubai']);
  assert.equal('phone' in draft, false);
  assert.equal('email' in draft, false);
});

test('exact licence or normalized legal name triggers explicit duplicate review', () => {
  const existing = [{ partnerRef: 'DEV-SYN-OLD', legalName: 'Synthetic Developments L.L.C.', licenceRef: input.licenceRef, status: 'active' }];
  const result = preparePartnerMasterDraft(input, existing);
  assert.equal(result.draft.status, 'duplicate_review');
  assert.equal(result.duplicateCandidates[0].matchBasis, 'exact_licence');
  const reviewed = decidePartnerDuplicateReview({ draft: result.draft, decision: 'continue_new', existingPartnerRef: existing[0].partnerRef, reason: 'Separate licensed legal organization', reviewerRef: 'MANAGER-SYN-1', now });
  assert.equal(reviewed.status, 'pending_verification');
});

test('verification rejects expired licences and activates current evidence', () => {
  const pending = preparePartnerMasterDraft(input).draft;
  assert.equal(verifyPartnerMaster({ draft: pending, decision: 'verified', reason: '', verifierRef: 'MANAGER-SYN-1', now }).status, 'active');
  const expired = preparePartnerMasterDraft({ ...input, licenceExpiresAt: '2026-08-01T00:00:00.000Z' }).draft;
  assert.throws(() => verifyPartnerMaster({ draft: expired, decision: 'verified', reason: '', verifierRef: 'MANAGER-SYN-1', now }), /expired licence/i);
});

test('corrections create an immutable revision rather than overwrite the active version', () => {
  const active = verifyPartnerMaster({ draft: preparePartnerMasterDraft(input).draft, decision: 'verified', reason: '', verifierRef: 'MANAGER-SYN-1', now });
  const revision = createPartnerRevision(active, { tradeName: 'Synthetic Development Group' }, 'ADMIN-SYN-1', '2026-08-10T09:00:00.000Z');
  assert.equal(active.tradeName, 'Synthetic Developments');
  assert.equal(revision.version, 2);
  assert.equal(revision.supersedesPartnerVersionRef, `${active.partnerRef}-V1`);
  assert.equal(revision.status, 'pending_verification');
});

test('direct-owner Inventory maintenance requires no Partner Master relationship', () => {
  const result = evaluateInventoryOrganizationLinkage({ sourceType: 'direct_owner', ownerPartyRef: 'OWNER-PARTY-SYN-1', activePartner: null });
  assert.equal(result.inventoryMaintenanceAllowed, true);
  assert.equal(result.partnerMasterRequiredForMaintenance, false);
  assert.equal(result.organizationExpected, false);
  assert.match(result.nextAction, /No Partner Master/i);
});

test('an incomplete organization relationship never blocks Internal Inventory maintenance', () => {
  const result = evaluateInventoryOrganizationLinkage({ sourceType: 'external_agency', ownerPartyRef: null, activePartner: null });
  assert.equal(result.inventoryMaintenanceAllowed, true);
  assert.equal(result.organizationLinkReady, false);
  assert.match(result.nextAction, /completed later/i);
});

test('only an active verified partner can produce an immutable optional Inventory organization link', () => {
  const pending = preparePartnerMasterDraft(input).draft;
  assert.throws(() => prepareInventoryOrganizationLink({ activePartner: pending, inventoryRef: 'NYSA-INV-SYN-018', relationship: 'developer', linkedByRef: 'AGENT-SYN-1', now }), /active verified partner/i);
  const active = verifyPartnerMaster({ draft: pending, decision: 'verified', reason: '', verifierRef: 'MANAGER-SYN-1', now });
  const link = prepareInventoryOrganizationLink({ activePartner: active, inventoryRef: 'NYSA-INV-SYN-018', relationship: 'developer', linkedByRef: 'AGENT-SYN-1', now });
  assert.equal(link.partnerVersion, 1);
  assert.equal(link.inventoryMutationPerformed, false);
  assert.equal(link.immutable, true);
  assert.throws(() => prepareInventoryOrganizationLink({ activePartner: active, inventoryRef: 'NYSA-INV-SYN-018', relationship: 'service_provider', linkedByRef: 'AGENT-SYN-1', now }), /supported Inventory relationship/i);
});
