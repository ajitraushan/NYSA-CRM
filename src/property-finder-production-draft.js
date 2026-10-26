import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const PROPERTY_FINDER_PRODUCTION_ORIGIN = 'https://atlas.propertyfinder.com';
export const PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION = 'property-finder-enterprise-api-1.0.1-production-draft-v2';
export const PROPERTY_FINDER_PRODUCTION_PREFLIGHT_CONFIRMATION = 'PREFLIGHT_ONE_PROPERTY_FINDER_PRODUCTION_DRAFT';
export const PROPERTY_FINDER_PRODUCTION_CREATE_CONFIRMATION = 'CREATE_ONE_UNPUBLISHED_PROPERTY_FINDER_PRODUCTION_DRAFT';
export const PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT = `${PROPERTY_FINDER_PRODUCTION_ORIGIN}/v1/listings`;
export const PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT = 'one_unpublished_draft_only';

const REQUIRED_SCOPES = Object.freeze([
  'users:read',
  'locations:read',
  'compliances:read',
  'listings:read',
  'listings:full_access',
  'credits:read'
]);
const PREFLIGHT_TTL_MS = 5 * 60 * 1000;
const enabled = value => String(value || '').trim() === '1';
const text = value => String(value ?? '').trim();
const integer = value => Number.isInteger(Number(value)) ? Number(value) : null;
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const sha256 = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const sha256Text = value => createHash('sha256').update(text(value)).digest('hex');
const validHash = value => /^[a-f0-9]{64}$/.test(text(value));
const scopeSet = value => new Set(text(value).split(/[\s,]+/).filter(Boolean));
const exactProductionOrigin = value => {
  try {
    const url = new URL(value);
    return url.origin === PROPERTY_FINDER_PRODUCTION_ORIGIN
      && url.pathname.replace(/\/+$/, '') === ''
      && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};
const rows = (payload, names = []) => {
  if (Array.isArray(payload)) return payload;
  for (const name of names) if (Array.isArray(payload?.[name])) return payload[name];
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === 'object') {
    for (const name of names) if (Array.isArray(payload.data[name])) return payload.data[name];
  }
  return [];
};
const profileId = value => text(value?.publicProfile?.id ?? value?.publicProfileId ?? value?.id);
const locationId = value => text(value?.id ?? value?.locationId);
const listingReference = value => text(value?.reference ?? value?.listing?.reference);
const listingId = value => text(value?.id ?? value?.listingId ?? value?.listing?.id);
const listingState = value => text(value?.state?.type ?? value?.state?.stage ?? value?.status ?? value?.listing?.state?.type).toLowerCase();
const finiteRemainingCredits = value => {
  const remaining = Number(value?.remaining);
  return Number.isFinite(remaining) && remaining >= 0 ? remaining : null;
};

function sameSecret(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function propertyFinderProductionDraftStatus(env = process.env) {
  const scopes = scopeSet(env.PROPERTY_FINDER_PRODUCTION_API_SCOPES);
  const sandboxKey = env.PROPERTY_FINDER_SANDBOX_API_KEY || env.PROPERTY_FINDER_API_KEY;
  const sandboxSecret = env.PROPERTY_FINDER_SANDBOX_API_SECRET || env.PROPERTY_FINDER_API_SECRET;
  const separateCredentialValues = !sameSecret(env.PROPERTY_FINDER_PRODUCTION_API_KEY, sandboxKey)
    && !sameSecret(env.PROPERTY_FINDER_PRODUCTION_API_SECRET, sandboxSecret);
  const checks = {
    operatorEnvironmentOnly: env.NYSA_DEPLOYMENT_ENV === 'crm_test',
    environmentIsProduction: env.PROPERTY_FINDER_PRODUCTION_ENVIRONMENT === 'production',
    baseUrlIsExactProductionOrigin: exactProductionOrigin(env.PROPERTY_FINDER_PRODUCTION_API_BASE_URL),
    productionKeyConfigured: text(env.PROPERTY_FINDER_PRODUCTION_API_KEY).length >= 8,
    productionSecretConfigured: text(env.PROPERTY_FINDER_PRODUCTION_API_SECRET).length >= 16,
    guardSecretConfigured: text(env.PROPERTY_FINDER_PRODUCTION_DRAFT_GUARD_SECRET).length >= 32,
    separateCredentialNamesAndValues: separateCredentialValues,
    requiredScopesConfigured: REQUIRED_SCOPES.every(scope => scopes.has(scope)),
    publicationSwitchDisabled: !enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH)
  };
  const configured = Object.values(checks).every(Boolean);
  return {
    approvedBaseUrl: PROPERTY_FINDER_PRODUCTION_ORIGIN,
    mappingVersion: PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION,
    checks,
    configured,
    readsEnabled: enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_READS),
    draftCreateEnabled: enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE),
    readReady: configured && enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_READS),
    draftCreateReady: configured && enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_READS) && enabled(env.PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE),
    publishSupported: false,
    updateSupported: false,
    deleteSupported: false,
    automaticPostRetries: 0
  };
}

export function validatePropertyFinderProductionDraftPayload(payload = {}) {
  const errors = [];
  const requiredText = (value, label) => { if (!text(value)) errors.push(label); };
  const allowed = new Set(['assignedTo', 'bathrooms', 'bedrooms', 'category', 'compliance', 'createdBy', 'description', 'downPayment',
    'furnishingType', 'location', 'media', 'price', 'project', 'projectStatus', 'reference', 'size', 'title', 'type', 'uaeEmirate']);
  for (const key of Object.keys(payload || {})) if (!allowed.has(key)) errors.push(`unsupported field ${key}`);
  requiredText(payload.reference, 'reference');
  requiredText(payload.category, 'category');
  requiredText(payload.type, 'type');
  requiredText(payload.furnishingType, 'furnishingType');
  requiredText(payload.uaeEmirate, 'uaeEmirate');
  requiredText(payload.title?.en, 'title.en');
  requiredText(payload.description?.en, 'description.en');
  requiredText(payload.createdBy?.id, 'createdBy.id');
  requiredText(payload.assignedTo?.id, 'assignedTo.id');
  requiredText(payload.location?.id, 'location.id');
  if (!(Number(payload.size) > 0)) errors.push('size');
  if (!(Number(payload.price?.amounts?.[payload.price?.type]) > 0)) errors.push('price.amounts');
  if (payload.price?.type === 'sale' && !(Number(payload.downPayment) >= 0)) errors.push('downPayment');
  if (!['land', 'farm'].includes(text(payload.type).toLowerCase()) && !/^([1-9]|1\d|20|none)$/.test(text(payload.bathrooms))) errors.push('bathrooms');
  if (text(payload.uaeEmirate).toLowerCase() === 'dubai') {
    requiredText(payload.compliance?.listingAdvertisementNumber, 'compliance.listingAdvertisementNumber');
    requiredText(payload.compliance?.issuingClientLicenseNumber, 'compliance.issuingClientLicenseNumber');
    requiredText(payload.compliance?.type, 'compliance.type');
  }
  const allowedCompliance = new Set(['listingAdvertisementNumber', 'issuingClientLicenseNumber', 'type', 'userConfirmedDataIsCorrect']);
  for (const key of Object.keys(payload.compliance || {})) if (!allowedCompliance.has(key)) errors.push(`unsupported compliance field ${key}`);
  const images = payload.media?.images;
  if (!Array.isArray(images) || images.length < 1 || images.length > 30) errors.push('media.images');
  for (const image of Array.isArray(images) ? images : []) {
    try {
      const url = new URL(text(image?.original?.url));
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) errors.push('media.images.original.url');
    } catch {
      errors.push('media.images.original.url');
    }
  }
  const prohibited = ['ownerName', 'owner', 'phone', 'email', 'contact', 'authorityDocument', 'agreementEvidence', 'internalNotes'];
  const serialized = JSON.stringify(payload);
  for (const key of prohibited) if (new RegExp(`"${key}"`, 'i').test(serialized)) errors.push(`prohibited field ${key}`);
  return errors.length
    ? { ok: false, errors: [...new Set(errors)] }
    : { ok: true, payload: JSON.parse(JSON.stringify(payload)), payloadHash: sha256({ mappingVersion: PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION, payload }) };
}

export function buildPropertyFinderProductionDraftPayload({ reviewedPayload = {}, issuingClientLicenseNumber = '' } = {}) {
  const payload = JSON.parse(JSON.stringify(reviewedPayload || {}));
  payload.compliance = {
    ...(payload.compliance || {}),
    issuingClientLicenseNumber: text(issuingClientLicenseNumber)
  };
  delete payload.compliance.permitType;
  if (payload.bathrooms !== undefined) payload.bathrooms = text(payload.bathrooms);
  if (payload.bedrooms !== undefined) payload.bedrooms = text(payload.bedrooms);
  return validatePropertyFinderProductionDraftPayload(payload);
}

function validateGovernanceContext(context = {}, validation = {}) {
  const errors = [];
  const inventory = context.inventorySelection || {};
  const permit = context.immutablePermitEvidence || {};
  const licence = context.officialLicenceConfirmation || {};
  if (!text(inventory.inventoryId)) errors.push('inventorySelection.inventoryId');
  if (!text(inventory.inventoryReference)) errors.push('inventorySelection.inventoryReference');
  if (!Number.isInteger(Number(inventory.revisionNumber)) || Number(inventory.revisionNumber) < 1) errors.push('inventorySelection.revisionNumber');
  if (!text(permit.evidenceId)) errors.push('immutablePermitEvidence.evidenceId');
  if (!Number.isInteger(Number(permit.version)) || Number(permit.version) < 1) errors.push('immutablePermitEvidence.version');
  if (permit.immutable !== true) errors.push('immutablePermitEvidence.immutable');
  if (!validHash(permit.evidenceSha256)) errors.push('immutablePermitEvidence.evidenceSha256');
  if (!text(permit.permitType)) errors.push('immutablePermitEvidence.permitType');
  if (!validHash(permit.permitNumberSha256) || permit.permitNumberSha256 !== sha256Text(validation.payload?.compliance?.listingAdvertisementNumber)) errors.push('immutablePermitEvidence.permitNumberSha256');
  if (!text(licence.confirmationId)) errors.push('officialLicenceConfirmation.confirmationId');
  if (text(licence.source) !== 'PF Expert') errors.push('officialLicenceConfirmation.source');
  if (!Number.isFinite(Date.parse(text(licence.confirmedAtUtc)))) errors.push('officialLicenceConfirmation.confirmedAtUtc');
  if (!validHash(licence.licenceNumberSha256) || licence.licenceNumberSha256 !== sha256Text(validation.payload?.compliance?.issuingClientLicenseNumber)) errors.push('officialLicenceConfirmation.licenceNumberSha256');
  const binding = {
    inventoryId: text(inventory.inventoryId),
    inventoryReference: text(inventory.inventoryReference),
    inventoryRevisionNumber: Number(inventory.revisionNumber),
    permitEvidenceId: text(permit.evidenceId),
    permitEvidenceVersion: Number(permit.version),
    permitEvidenceSha256: text(permit.evidenceSha256),
    permitType: text(permit.permitType),
    licenceConfirmationId: text(licence.confirmationId),
    licenceConfirmedAtUtc: text(licence.confirmedAtUtc)
  };
  return errors.length ? { ok: false, errors } : { ok: true, binding, governanceHash: sha256(binding) };
}

function validateOperatorApproval(approval = {}, { action, payloadHash, inventoryId, preflightSignature = null, now }) {
  return approval.approved === true
    && text(approval.action) === action
    && text(approval.environment) === 'production'
    && text(approval.endpoint) === PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT
    && text(approval.effect) === PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT
    && text(approval.payloadHash) === payloadHash
    && text(approval.inventoryId) === inventoryId
    && text(approval.operatorId)
    && Number.isFinite(Date.parse(text(approval.approvedAtUtc)))
    && Math.abs(now() - Date.parse(text(approval.approvedAtUtc))) <= PREFLIGHT_TTL_MS
    && (preflightSignature === null || text(approval.preflightSignature) === preflightSignature);
}

export class PropertyFinderProductionDraftError extends Error {
  constructor(code, message, { operation = null, httpStatus = 500, upstreamStatus = null, requestedAtUtc = null, outcomeUnknown = false } = {}) {
    super(message);
    this.name = 'PropertyFinderProductionDraftError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.diagnosticEvidence = { operation, upstreamStatus, requestedAtUtc, outcomeUnknown };
  }
}

export function createPropertyFinderProductionDraftRunner({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), auditSink = null } = {}) {
  let cachedToken = null;
  const consumedPreflights = new Set();
  const auditEvidence = [];
  const auditSinkConfigured = typeof auditSink === 'function';
  const status = () => {
    const base = propertyFinderProductionDraftStatus(env);
    return { ...base, auditSinkConfigured, draftCreateReady: base.draftCreateReady && auditSinkConfigured };
  };
  const guardSecret = () => text(env.PROPERTY_FINDER_PRODUCTION_DRAFT_GUARD_SECRET);
  const audit = evidence => {
    const record = Object.freeze({ recordedAtUtc: new Date(now()).toISOString(), ...evidence });
    auditEvidence.push(record);
    if (auditSinkConfigured) auditSink(record);
  };

  async function request(operation, path, { method = 'GET', token = null, body = undefined, outcomeUnknownOnNetworkFailure = false } = {}) {
    const requestedAtUtc = new Date(now()).toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetchImpl(`${PROPERTY_FINDER_PRODUCTION_ORIGIN}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-PF-Error-Format': 'problem-json-v2'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch {
      throw new PropertyFinderProductionDraftError(
        outcomeUnknownOnNetworkFailure ? 'draft_create_outcome_unknown' : 'production_request_failed',
        outcomeUnknownOnNetworkFailure
          ? 'The one permitted draft POST had an indeterminate network outcome; do not retry it'
          : 'Property Finder Production request failed',
        { operation, httpStatus: 502, requestedAtUtc, outcomeUnknown: outcomeUnknownOnNetworkFailure }
      );
    } finally {
      clearTimeout(timeout);
    }
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      throw new PropertyFinderProductionDraftError(
        text(payload?.code) || 'production_request_rejected',
        `Property Finder Production rejected ${operation}`,
        { operation, httpStatus: response.status, upstreamStatus: response.status, requestedAtUtc }
      );
    }
    return payload;
  }

  async function token() {
    if (cachedToken && cachedToken.expiresAt > now() + 60000) return cachedToken.value;
    const state = status();
    if (!state.readReady) throw new PropertyFinderProductionDraftError('production_reads_not_ready', 'Production reads are disabled or incompletely configured', { httpStatus: 503 });
    const payload = await request('authentication', '/v1/auth/token', {
      method: 'POST',
      body: { apiKey: env.PROPERTY_FINDER_PRODUCTION_API_KEY, apiSecret: env.PROPERTY_FINDER_PRODUCTION_API_SECRET }
    });
    if (text(payload?.accessToken).length < 16) throw new PropertyFinderProductionDraftError('invalid_token_response', 'Property Finder Production returned no usable access token', { httpStatus: 502 });
    cachedToken = { value: payload.accessToken, expiresAt: now() + Math.min(Math.max(Number(payload.expiresIn) || 1800, 60), 1800) * 1000 };
    return cachedToken.value;
  }

  async function duplicateReferences(reference, jwt) {
    const encoded = encodeURIComponent(reference);
    const [drafts, live] = await Promise.all([
      request('duplicate draft reference check', `/v1/listings?draft=true&filter%5Breference%5D=${encoded}&page=1&perPage=50`, { token: jwt }),
      request('duplicate live reference check', `/v1/listings?draft=false&filter%5Breference%5D=${encoded}&page=1&perPage=50`, { token: jwt })
    ]);
    const exact = [...rows(drafts, ['results', 'items', 'listings']), ...rows(live, ['results', 'items', 'listings'])]
      .filter(item => listingReference(item) === reference);
    return [...new Map(exact.map(item => [listingId(item) || `${listingReference(item)}:${listingState(item)}`, item])).values()];
  }

  function sign(attestation) {
    return createHmac('sha256', guardSecret()).update(JSON.stringify(stable(attestation))).digest('hex');
  }

  function verifyAttestation(preflight, validation, governance) {
    const attestation = preflight?.attestation;
    const supplied = text(preflight?.signature);
    if (!attestation || !/^[a-f0-9]{64}$/.test(supplied)) return false;
    const expected = sign(attestation);
    const a = Buffer.from(supplied, 'hex'), b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b)
      && attestation.payloadHash === validation.payloadHash
      && attestation.governanceHash === governance.governanceHash
      && attestation.reference === validation.payload.reference
      && Number(attestation.expiresAtMs) > now()
      && attestation.mappingVersion === PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION
      && attestation.allChecksPassed === true;
  }

  async function preflight({ confirmation, payload, locationQuery, governanceContext, operatorApproval }) {
    if (confirmation !== PROPERTY_FINDER_PRODUCTION_PREFLIGHT_CONFIRMATION) throw new PropertyFinderProductionDraftError('confirmation_required', 'Exact Production read-preflight confirmation is required', { httpStatus: 400 });
    const validation = validatePropertyFinderProductionDraftPayload(payload);
    if (!validation.ok) throw new PropertyFinderProductionDraftError('invalid_draft_payload', `Production draft payload is incomplete: ${validation.errors.join(', ')}`, { httpStatus: 400 });
    const governance = validateGovernanceContext(governanceContext, validation);
    if (!governance.ok) throw new PropertyFinderProductionDraftError('invalid_governance_context', `Production governance evidence is incomplete: ${governance.errors.join(', ')}`, { httpStatus: 400 });
    if (!validateOperatorApproval(operatorApproval, { action: 'production_read_preflight', payloadHash: validation.payloadHash, inventoryId: governance.binding.inventoryId, now })) {
      throw new PropertyFinderProductionDraftError('operator_approval_required', 'A fresh exact operator approval for Production reads is required', { httpStatus: 400 });
    }
    if (!text(locationQuery)) throw new PropertyFinderProductionDraftError('location_query_required', 'Exact manually reviewed location query is required', { httpStatus: 400 });
    const jwt = await token();
    const profile = encodeURIComponent(text(validation.payload.createdBy.id));
    const locationSearch = encodeURIComponent(text(locationQuery));
    const permit = encodeURIComponent(text(validation.payload.compliance.listingAdvertisementNumber));
    const licence = encodeURIComponent(text(validation.payload.compliance.issuingClientLicenseNumber));
    const encodedPermitType = encodeURIComponent(governance.binding.permitType);
    const [usersPayload, locationsPayload, compliancePayload, duplicates, credits] = await Promise.all([
      request('public profile resolution', `/v1/users?id=${profile}&page=1&perPage=15`, { token: jwt }),
      request('location resolution', `/v1/locations?search=${locationSearch}&page=1&perPage=100`, { token: jwt }),
      request('compliance resolution', `/v1/compliances/${permit}/${licence}?permitType=${encodedPermitType}`, { token: jwt }),
      duplicateReferences(validation.payload.reference, jwt),
      request('credit baseline', '/v1/credits/balance', { token: jwt })
    ]);
    const publicProfileResolved = rows(usersPayload, ['results', 'items', 'users']).some(item => profileId(item) === text(validation.payload.createdBy.id));
    const locationResolved = rows(locationsPayload, ['results', 'items', 'locations']).some(item => locationId(item) === text(validation.payload.location.id));
    const complianceData = compliancePayload?.data;
    const complianceMatched = compliancePayload?.status === 'success'
      && ((Array.isArray(complianceData) && complianceData.length > 0)
        || (complianceData && typeof complianceData === 'object' && Object.keys(complianceData).length > 0));
    const duplicateReferenceCount = duplicates.length;
    const creditBaselineRemaining = finiteRemainingCredits(credits);
    const allChecksPassed = publicProfileResolved && locationResolved && complianceMatched && duplicateReferenceCount === 0 && creditBaselineRemaining !== null;
    const issuedAtMs = now();
    const attestation = {
      mappingVersion: PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION,
      payloadHash: validation.payloadHash,
      governanceHash: governance.governanceHash,
      inventoryId: governance.binding.inventoryId,
      reference: validation.payload.reference,
      issuedAtMs,
      expiresAtMs: issuedAtMs + PREFLIGHT_TTL_MS,
      publicProfileResolved,
      locationResolved,
      complianceMatched,
      duplicateReferenceCount,
      creditBaselineRemaining,
      allChecksPassed
    };
    const result = {
      ready: allChecksPassed,
      preview: {
        destination: 'Property Finder Enterprise API Production',
        mappingVersion: PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION,
        payloadHash: validation.payloadHash,
        publicProfileResolved,
        locationResolved,
        complianceMatched,
        duplicateReferenceCount,
        creditBaselineCaptured: creditBaselineRemaining !== null,
        environment: 'production',
        endpoint: PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT,
        effect: PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT,
        governanceHash: governance.governanceHash,
        publicationSupported: false,
        automaticPostRetries: 0
      },
      attestation,
      signature: sign(attestation)
    };
    audit({ event: allChecksPassed ? 'production_draft_preflight_passed' : 'production_draft_preflight_blocked', payloadHash: validation.payloadHash, governanceHash: governance.governanceHash, inventoryIdHash: sha256Text(governance.binding.inventoryId), environment: 'production', endpoint: PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT, effect: PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT, allChecksPassed, duplicateReferenceCount, creditBaselineRemaining });
    return result;
  }

  async function createDraft({ confirmation, payload, governanceContext, operatorApproval, preflight: approvedPreflight }) {
    if (confirmation !== PROPERTY_FINDER_PRODUCTION_CREATE_CONFIRMATION) throw new PropertyFinderProductionDraftError('confirmation_required', 'Exact one-draft Production confirmation is required', { httpStatus: 400 });
    const state = status();
    if (!state.draftCreateReady) throw new PropertyFinderProductionDraftError('production_draft_create_not_ready', 'Production draft creation is disabled or incompletely configured', { httpStatus: 503 });
    const validation = validatePropertyFinderProductionDraftPayload(payload);
    if (!validation.ok) throw new PropertyFinderProductionDraftError('invalid_draft_payload', 'Production draft payload is incomplete or unsafe', { httpStatus: 400 });
    const governance = validateGovernanceContext(governanceContext, validation);
    if (!governance.ok) throw new PropertyFinderProductionDraftError('invalid_governance_context', 'Production governance evidence is incomplete or does not match the payload', { httpStatus: 400 });
    if (!verifyAttestation(approvedPreflight, validation, governance)) throw new PropertyFinderProductionDraftError('stale_or_invalid_preflight', 'A fresh signed Production preflight for this exact payload and evidence is required', { httpStatus: 409 });
    if (consumedPreflights.has(approvedPreflight.signature)) throw new PropertyFinderProductionDraftError('preflight_already_consumed', 'This one-time Production preflight has already been used', { httpStatus: 409 });
    if (!validateOperatorApproval(operatorApproval, { action: 'create_one_unpublished_draft', payloadHash: validation.payloadHash, inventoryId: governance.binding.inventoryId, preflightSignature: approvedPreflight.signature, now })) {
      throw new PropertyFinderProductionDraftError('operator_approval_required', 'A fresh exact operator approval for the single Production draft POST is required', { httpStatus: 400 });
    }
    const jwt = await token();
    const duplicates = await duplicateReferences(validation.payload.reference, jwt);
    if (duplicates.length) throw new PropertyFinderProductionDraftError('duplicate_reference', 'A Property Finder listing already uses this reference; no draft was created', { httpStatus: 409 });
    consumedPreflights.add(approvedPreflight.signature);
    audit({ event: 'production_draft_post_attempted', payloadHash: validation.payloadHash, governanceHash: governance.governanceHash, inventoryIdHash: sha256Text(governance.binding.inventoryId), environment: 'production', endpoint: PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT, effect: PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT, automaticPostRetries: 0 });
    let created;
    try {
      created = await request('create one unpublished draft', '/v1/listings', { method: 'POST', token: jwt, body: validation.payload, outcomeUnknownOnNetworkFailure: true });
    } catch (error) {
      if (error?.code !== 'draft_create_outcome_unknown') throw error;
      const resolved = await duplicateReferences(validation.payload.reference, jwt);
      if (resolved.length === 1) created = resolved[0];
      else throw error;
    }
    const id = listingId(created);
    let observedState = listingState(created);
    if (!id || !['draft', 'unpublished'].includes(observedState)) {
      const resolved = await duplicateReferences(validation.payload.reference, jwt);
      const exact = resolved.find(item => listingReference(item) === validation.payload.reference);
      if (exact) observedState = listingState(exact);
      if (!id && exact) created = exact;
    }
    const resolvedId = listingId(created);
    if (!resolvedId || !['draft', 'unpublished'].includes(observedState)) throw new PropertyFinderProductionDraftError('unexpected_created_state', 'The created record could not be verified as an unpublished draft; stop all further action', { httpStatus: 502 });
    const [spent, creditsAfter] = await Promise.all([
      request('draft credit verification', `/v1/credits/spent?listingId=${encodeURIComponent(resolvedId)}`, { token: jwt }),
      request('credit balance after draft', '/v1/credits/balance', { token: jwt })
    ]);
    const exactSpent = rows(spent, ['listings']).find(item => text(item?.listingId) === resolvedId);
    const creditsSpent = Number(exactSpent?.totalSpent ?? spent?.grandTotal);
    const creditRemainingAfter = finiteRemainingCredits(creditsAfter);
    const creditDelta = creditRemainingAfter === null ? null : approvedPreflight.attestation.creditBaselineRemaining - creditRemainingAfter;
    if (!Number.isFinite(creditsSpent) || creditsSpent !== 0 || creditDelta !== 0) {
      audit({ event: 'production_draft_unexpected_credit_change', payloadHash: validation.payloadHash, governanceHash: governance.governanceHash, inventoryIdHash: sha256Text(governance.binding.inventoryId), environment: 'production', endpoint: PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT, effect: PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT, creditsSpent: Number.isFinite(creditsSpent) ? creditsSpent : null, creditDelta });
      throw new PropertyFinderProductionDraftError('unexpected_credit_change', 'Draft creation did not preserve the verified credit balance; stop all further action', { httpStatus: 502 });
    }
    const result = {
      listingId: resolvedId,
      reference: validation.payload.reference,
      state: observedState,
      creditsSpent,
      creditBaselineRemaining: approvedPreflight.attestation.creditBaselineRemaining,
      creditRemainingAfter,
      creditDelta,
      payloadHash: validation.payloadHash,
      mappingVersion: PROPERTY_FINDER_PRODUCTION_DRAFT_MAPPING_VERSION,
      publicationPerformed: false,
      publishSupported: false,
      automaticPostRetries: 0
    };
    audit({ event: 'production_draft_verified', payloadHash: validation.payloadHash, governanceHash: governance.governanceHash, inventoryIdHash: sha256Text(governance.binding.inventoryId), listingIdHash: sha256Text(resolvedId), environment: 'production', endpoint: PROPERTY_FINDER_PRODUCTION_DRAFT_ENDPOINT, effect: PROPERTY_FINDER_PRODUCTION_DRAFT_EFFECT, state: observedState, creditsSpent, creditDelta, publicationPerformed: false });
    return result;
  }

  return Object.freeze({ status, preflight, createDraft, auditEvidence: () => auditEvidence.map(record => ({ ...record })) });
}
