import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildPropertyFinderProductionDraftPayload,
  createPropertyFinderProductionDraftRunner,
  PROPERTY_FINDER_PRODUCTION_CREATE_CONFIRMATION,
  PROPERTY_FINDER_PRODUCTION_ORIGIN,
  PROPERTY_FINDER_PRODUCTION_PREFLIGHT_CONFIRMATION,
  propertyFinderProductionDraftStatus,
  validatePropertyFinderProductionDraftPayload
} from '../src/property-finder-production-draft.js';

const baseEnv = () => ({
  NYSA_DEPLOYMENT_ENV: 'crm_test',
  PROPERTY_FINDER_PRODUCTION_ENVIRONMENT: 'production',
  PROPERTY_FINDER_PRODUCTION_API_BASE_URL: PROPERTY_FINDER_PRODUCTION_ORIGIN,
  PROPERTY_FINDER_PRODUCTION_API_KEY: 'production-key',
  PROPERTY_FINDER_PRODUCTION_API_SECRET: 'production-secret-value',
  PROPERTY_FINDER_PRODUCTION_DRAFT_GUARD_SECRET: 'g'.repeat(32),
  PROPERTY_FINDER_PRODUCTION_API_SCOPES: 'users:read,locations:read,compliances:read,listings:read,listings:full_access,credits:read',
  PROPERTY_FINDER_PRODUCTION_ALLOW_READS: '1',
  PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '0',
  PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH: '0',
  PROPERTY_FINDER_SANDBOX_API_KEY: 'sandbox-key',
  PROPERTY_FINDER_SANDBOX_API_SECRET: 'sandbox-secret-value'
});

const payload = () => ({
  assignedTo: { id: '77' },
  bathrooms: 2,
  bedrooms: 2,
  category: 'residential',
  compliance: {
    listingAdvertisementNumber: 'permit-from-immutable-evidence',
    issuingClientLicenseNumber: 'licence-from-immutable-evidence',
    type: 'rera'
  },
  createdBy: { id: '77' },
  description: { en: 'A'.repeat(800) },
  downPayment: 0,
  furnishingType: 'unfurnished',
  location: { id: '42' },
  media: { images: [{ original: { url: 'https://crm-test.example.test/media/one.jpg' } }] },
  price: { type: 'sale', amounts: { sale: 2500000 } },
  reference: 'NYSA-R3B-PRODUCTION-DRAFT-ONE',
  size: 1600,
  title: { en: 'Approved production draft test title' },
  type: 'apartment',
  uaeEmirate: 'dubai'
});

const hashText = value => createHash('sha256').update(String(value)).digest('hex');
const governanceContext = () => ({
  inventorySelection: { inventoryId: 'inventory-18', inventoryReference: 'NYSA-INV-000018', revisionNumber: 4 },
  immutablePermitEvidence: {
    evidenceId: 'permit-evidence-18-v2', version: 2, immutable: true, evidenceSha256: 'e'.repeat(64), permitType: 'property',
    permitNumberSha256: hashText(payload().compliance.listingAdvertisementNumber)
  },
  officialLicenceConfirmation: {
    confirmationId: 'pf-expert-confirmation-20260807', source: 'PF Expert', confirmedAtUtc: '2026-08-07T07:30:00.000Z',
    licenceNumberSha256: hashText(payload().compliance.issuingClientLicenseNumber)
  }
});
const operatorApproval = ({ action, payloadHash, approvedAtUtc, preflightSignature } = {}) => ({
  approved: true,
  action,
  environment: 'production',
  endpoint: `${PROPERTY_FINDER_PRODUCTION_ORIGIN}/v1/listings`,
  effect: 'one_unpublished_draft_only',
  payloadHash,
  inventoryId: 'inventory-18',
  operatorId: 'authorized-operator',
  approvedAtUtc,
  ...(preflightSignature ? { preflightSignature } : {})
});
const readPreflightInput = (approvedAtUtc = '2026-08-07T08:00:00.000Z') => {
  const exactPayload = payload();
  return {
    confirmation: PROPERTY_FINDER_PRODUCTION_PREFLIGHT_CONFIRMATION,
    payload: exactPayload,
    locationQuery: 'Exact reviewed location',
    governanceContext: governanceContext(),
    operatorApproval: operatorApproval({ action: 'production_read_preflight', payloadHash: validatePropertyFinderProductionDraftPayload(exactPayload).payloadHash, approvedAtUtc })
  };
};
const createInput = (approvedPreflight, approvedAtUtc = '2026-08-07T08:00:01.000Z') => ({
  confirmation: PROPERTY_FINDER_PRODUCTION_CREATE_CONFIRMATION,
  payload: payload(),
  governanceContext: governanceContext(),
  operatorApproval: operatorApproval({ action: 'create_one_unpublished_draft', payloadHash: approvedPreflight.attestation.payloadHash, approvedAtUtc, preflightSignature: approvedPreflight.signature }),
  preflight: approvedPreflight
});

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test('Production draft boundary requires exact origin, separate secrets, scopes, switches and no publish capability', () => {
  const ready = propertyFinderProductionDraftStatus(baseEnv());
  assert.equal(ready.readReady, true);
  assert.equal(ready.draftCreateReady, false);
  assert.equal(ready.publishSupported, false);
  assert.equal(ready.automaticPostRetries, 0);
  assert.equal(propertyFinderProductionDraftStatus({ ...baseEnv(), PROPERTY_FINDER_PRODUCTION_API_BASE_URL: 'https://sandbox.atlas.propertyfinder.com' }).configured, false);
  assert.equal(propertyFinderProductionDraftStatus({ ...baseEnv(), PROPERTY_FINDER_PRODUCTION_API_KEY: 'sandbox-key' }).configured, false);
  assert.equal(propertyFinderProductionDraftStatus({ ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH: '1' }).configured, false);
  const noAuditRunner = createPropertyFinderProductionDraftRunner({ env: { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' } });
  assert.equal(noAuditRunner.status().auditSinkConfigured, false);
  assert.equal(noAuditRunner.status().draftCreateReady, false);
});

test('Dubai payload requires immutable permit and company licence values and rejects private fields', () => {
  assert.equal(validatePropertyFinderProductionDraftPayload(payload()).ok, true);
  const missing = payload(); delete missing.compliance.issuingClientLicenseNumber;
  assert.equal(validatePropertyFinderProductionDraftPayload(missing).ok, false);
  const privateField = { ...payload(), ownerName: 'must not leave CORE' };
  assert.equal(validatePropertyFinderProductionDraftPayload(privateField).ok, false);
});

test('Production payload builder adds the live licence only in memory and normalizes PF enum strings', () => {
  const reviewed = payload();
  delete reviewed.compliance.issuingClientLicenseNumber;
  reviewed.compliance.permitType = 'property';
  reviewed.bathrooms = 2;
  reviewed.bedrooms = 2;
  const result = buildPropertyFinderProductionDraftPayload({ reviewedPayload: reviewed, issuingClientLicenseNumber: 'licence-from-immutable-evidence' });
  assert.equal(result.ok, true);
  assert.equal(result.payload.bathrooms, '2');
  assert.equal(result.payload.bedrooms, '2');
  assert.equal(result.payload.compliance.issuingClientLicenseNumber, 'licence-from-immutable-evidence');
  assert.equal('permitType' in result.payload.compliance, false);
});

test('Read preflight is sanitized, signed, duplicate-aware and performs no listing write', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 }, name: 'withheld by runner' }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42, name: 'Exact reviewed location' }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{ property: { id: 1 } }] });
    if (url.includes('/v1/listings?')) return response({ results: [] });
    if (url.endsWith('/v1/credits/balance')) return response({ total: 10, remaining: 10, used: 0 });
    throw new Error(`unexpected ${url}`);
  };
  const runner = createPropertyFinderProductionDraftRunner({ env: baseEnv(), fetchImpl, now: () => Date.parse('2026-08-07T08:00:00Z') });
  const result = await runner.preflight(readPreflightInput());
  assert.equal(result.ready, true);
  assert.equal(result.preview.publicProfileResolved, true);
  assert.equal(result.preview.locationResolved, true);
  assert.equal(result.preview.complianceMatched, true);
  assert.equal(result.preview.duplicateReferenceCount, 0);
  assert.equal(result.preview.publicationSupported, false);
  assert.ok(!JSON.stringify(result).includes('permit-from-immutable-evidence'));
  assert.ok(!JSON.stringify(result).includes('licence-from-immutable-evidence'));
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 0);
  const audit = runner.auditEvidence();
  assert.equal(audit.length, 1);
  assert.ok(!JSON.stringify(audit).includes('permit-from-immutable-evidence'));
  assert.ok(!JSON.stringify(audit).includes('licence-from-immutable-evidence'));
  assert.ok(!JSON.stringify(audit).includes('authorized-operator'));
});

test('Preflight blocks before authentication when selected Inventory or immutable evidence does not match', async () => {
  let called = false;
  const runner = createPropertyFinderProductionDraftRunner({ env: baseEnv(), fetchImpl: async () => { called = true; throw new Error('network must remain unused'); }, now: () => Date.parse('2026-08-07T08:00:00Z') });
  const input = readPreflightInput();
  input.governanceContext.immutablePermitEvidence.permitNumberSha256 = '0'.repeat(64);
  await assert.rejects(() => runner.preflight(input), error => error.code === 'invalid_governance_context');
  assert.equal(called, false);
});

test('One exact confirmation creates one draft, performs no POST retry and verifies zero credits', async () => {
  const env = { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' };
  const calls = [];
  let created = false;
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'; calls.push({ url, method });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 } }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42 }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{ property: { id: 1 } }] });
    if (url.includes('/v1/listings?')) return response({ results: created ? [{ id: 'draft-1', reference: payload().reference, state: { type: 'draft' } }] : [] });
    if (url.endsWith('/v1/credits/balance')) return response({ total: 10, remaining: 10, used: 0 });
    if (url.endsWith('/v1/listings') && method === 'POST') { created = true; return response({ id: 'draft-1', reference: payload().reference, state: { type: 'draft' } }); }
    if (url.includes('/v1/credits/spent?')) return response({ listings: [{ listingId: 'draft-1', totalSpent: 0 }], grandTotal: 0 });
    throw new Error(`unexpected ${url}`);
  };
  let clock = Date.parse('2026-08-07T08:00:00Z');
  const runner = createPropertyFinderProductionDraftRunner({ env, fetchImpl, now: () => clock, auditSink: () => {} });
  const approved = await runner.preflight(readPreflightInput());
  clock += 1000;
  const result = await runner.createDraft(createInput(approved));
  assert.equal(result.state, 'draft');
  assert.equal(result.creditsSpent, 0);
  assert.equal(result.creditDelta, 0);
  assert.equal(result.publicationPerformed, false);
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 1);
  assert.equal(calls.some(call => /publish|unpublish|DELETE|PUT/.test(`${call.url} ${call.method}`)), false);
  await assert.rejects(() => runner.createDraft(createInput(approved)), error => error.code === 'preflight_already_consumed');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 1);
});

test('Any post-create credit movement stops the workflow and records only redacted evidence', async () => {
  const env = { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' };
  const calls = [];
  let created = false;
  let balanceReads = 0;
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'; calls.push({ url, method });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 } }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42 }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{}] });
    if (url.includes('/v1/listings?')) return response({ results: created ? [{ id: 'draft-credit-change', reference: payload().reference, state: { type: 'draft' } }] : [] });
    if (url.endsWith('/v1/credits/balance')) { balanceReads += 1; return response({ remaining: balanceReads === 1 ? 10 : 9 }); }
    if (url.endsWith('/v1/listings') && method === 'POST') { created = true; return response({ id: 'draft-credit-change', reference: payload().reference, state: { type: 'draft' } }); }
    if (url.includes('/v1/credits/spent?')) return response({ listings: [{ listingId: 'draft-credit-change', totalSpent: 1 }] });
    throw new Error(`unexpected ${url}`);
  };
  const runner = createPropertyFinderProductionDraftRunner({ env, fetchImpl, now: () => Date.parse('2026-08-07T08:00:00Z'), auditSink: () => {} });
  const approved = await runner.preflight(readPreflightInput());
  await assert.rejects(() => runner.createDraft(createInput(approved)), error => error.code === 'unexpected_credit_change');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 1);
  assert.equal(calls.some(call => /publish|unpublish|DELETE|PUT/.test(`${call.url} ${call.method}`)), false);
  const auditText = JSON.stringify(runner.auditEvidence());
  assert.match(auditText, /production_draft_unexpected_credit_change/);
  assert.ok(!auditText.includes('permit-from-immutable-evidence'));
  assert.ok(!auditText.includes('licence-from-immutable-evidence'));
});

test('Stale or mismatched preflight blocks the draft POST', async () => {
  const env = { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' };
  let clock = Date.parse('2026-08-07T08:00:00Z');
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 } }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42 }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{}] });
    if (url.includes('/v1/listings?')) return response({ results: [] });
    if (url.endsWith('/v1/credits/balance')) return response({ remaining: 10 });
    throw new Error('write must remain blocked');
  };
  const runner = createPropertyFinderProductionDraftRunner({ env, fetchImpl, now: () => clock, auditSink: () => {} });
  const approved = await runner.preflight(readPreflightInput());
  clock += 6 * 60 * 1000;
  await assert.rejects(() => runner.createDraft(createInput(approved, new Date(clock).toISOString())), error => error.code === 'stale_or_invalid_preflight');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 0);
});

test('A duplicate appearing after approval blocks the only draft POST', async () => {
  const env = { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' };
  let duplicateChecks = 0;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'; calls.push({ url, method });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 } }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42 }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{}] });
    if (url.includes('/v1/listings?')) {
      duplicateChecks += 1;
      return response({ results: duplicateChecks > 2 ? [{ id: 'existing', reference: payload().reference, state: { type: 'draft' } }] : [] });
    }
    if (url.endsWith('/v1/credits/balance')) return response({ remaining: 10 });
    throw new Error('draft POST must remain blocked');
  };
  const runner = createPropertyFinderProductionDraftRunner({ env, fetchImpl, now: () => Date.parse('2026-08-07T08:00:00Z'), auditSink: () => {} });
  const approved = await runner.preflight(readPreflightInput());
  await assert.rejects(() => runner.createDraft(createInput(approved)), error => error.code === 'duplicate_reference');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 0);
});

test('An indeterminate POST outcome is resolved by reference and the POST is never retried', async () => {
  const env = { ...baseEnv(), PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE: '1' };
  let created = false;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET'; calls.push({ url, method });
    if (url.endsWith('/v1/auth/token')) return response({ accessToken: 't'.repeat(32), expiresIn: 1800 });
    if (url.includes('/v1/users?')) return response({ data: [{ publicProfile: { id: 77 } }] });
    if (url.includes('/v1/locations?')) return response({ data: [{ id: 42 }] });
    if (url.includes('/v1/compliances/')) return response({ status: 'success', data: [{}] });
    if (url.includes('/v1/listings?')) return response({ results: created ? [{ id: 'draft-unknown', reference: payload().reference, state: { type: 'draft' } }] : [] });
    if (url.endsWith('/v1/credits/balance')) return response({ remaining: 10 });
    if (url.endsWith('/v1/listings') && method === 'POST') { created = true; throw new Error('connection ended after send'); }
    if (url.includes('/v1/credits/spent?')) return response({ listings: [{ listingId: 'draft-unknown', totalSpent: 0 }] });
    throw new Error(`unexpected ${url}`);
  };
  const runner = createPropertyFinderProductionDraftRunner({ env, fetchImpl, now: () => Date.parse('2026-08-07T08:00:00Z'), auditSink: () => {} });
  const approved = await runner.preflight(readPreflightInput());
  const result = await runner.createDraft(createInput(approved));
  assert.equal(result.listingId, 'draft-unknown');
  assert.equal(result.state, 'draft');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/listings') && call.method === 'POST').length, 1);
});
