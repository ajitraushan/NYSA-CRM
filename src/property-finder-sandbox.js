const SANDBOX_ORIGIN = 'https://sandbox.atlas.propertyfinder.com';
const REQUIRED_SCOPES = Object.freeze([
  'users:read',
  'listings:read',
  'credits:read',
  'compliances:read',
  'listing_verification:full_access',
  'locations:read',
  'projects:read',
  'webhooks:full_access'
]);
const LISTING_IMPORT_REQUIRED_SCOPES = Object.freeze([
  'users:read',
  'listings:read',
  'leads:read',
  'credits:read'
]);

const enabled = value => value === '1' || value === 'true';
const integer = (value, fallback) => Number.isInteger(Number(value)) ? Number(value) : fallback;
const scopeSet = value => new Set(String(value || '').split(/[\s,]+/).map(item => item.trim()).filter(Boolean));

function exactSandboxOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin === SANDBOX_ORIGIN
      && url.pathname === '/'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

export class PropertyFinderSandboxError extends Error {
  constructor(code, message, httpStatus = 503, upstreamStatus = null, diagnosticEvidence = null) {
    super(message);
    this.name = 'PropertyFinderSandboxError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.upstreamStatus = upstreamStatus;
    this.diagnosticEvidence = diagnosticEvidence;
  }
}

export function propertyFinderSandboxStatus(env = process.env, now = new Date()) {
  const scopes = scopeSet(env.PROPERTY_FINDER_API_SCOPES);
  const missingScopes = REQUIRED_SCOPES.filter(scope => !scopes.has(scope));
  const expiry = env.PROPERTY_FINDER_SANDBOX_EXPIRES_AT
    ? new Date(env.PROPERTY_FINDER_SANDBOX_EXPIRES_AT)
    : null;
  const expiryValid = Boolean(expiry && !Number.isNaN(expiry.getTime()));
  const notExpired = Boolean(expiryValid && expiry.getTime() > now.getTime());
  const timeoutMs = integer(env.PROPERTY_FINDER_TIMEOUT_MS, 15000);
  const requestsPerMinute = integer(env.PROPERTY_FINDER_REQUESTS_PER_MINUTE, 60);
  const checks = {
    deploymentIsCrmTest: env.NYSA_DEPLOYMENT_ENV === 'crm_test',
    environmentIsSandbox: env.PROPERTY_FINDER_ENVIRONMENT === 'sandbox',
    baseUrlIsApproved: exactSandboxOrigin(env.PROPERTY_FINDER_API_BASE_URL),
    connectorEnabled: enabled(env.PROPERTY_FINDER_SANDBOX_ENABLED),
    readsEnabled: enabled(env.PROPERTY_FINDER_ALLOW_READS),
    apiKeyConfigured: typeof env.PROPERTY_FINDER_SANDBOX_API_KEY === 'string'
      && env.PROPERTY_FINDER_SANDBOX_API_KEY.length === 40,
    apiSecretConfigured: typeof env.PROPERTY_FINDER_SANDBOX_API_SECRET === 'string'
      && env.PROPERTY_FINDER_SANDBOX_API_SECRET.length === 32,
    expiryValid,
    notExpired,
    scopesComplete: missingScopes.length === 0,
    timeoutValid: timeoutMs >= 1000 && timeoutMs <= 30000,
    rateLimitValid: requestsPerMinute >= 1 && requestsPerMinute <= 60
  };
  return {
    provider: 'property_finder',
    environment: 'sandbox',
    approvedBaseUrl: SANDBOX_ORIGIN,
    configured: checks.apiKeyConfigured && checks.apiSecretConfigured,
    networkReady: Object.values(checks).every(Boolean),
    externalWritesAvailable: false,
    publicationAvailable: false,
    listingImportReadReady: Object.values(checks).every(Boolean) && scopes.has('listings:read'),
    listingReadScopeConfigured: scopes.has('listings:read'),
    expiresAt: expiryValid ? expiry.toISOString() : null,
    missingScopes,
    timeoutMs,
    requestsPerMinute,
    checks
  };
}

export function propertyFinderListingImportStatus(env = process.env, now = new Date()) {
  const scopes = scopeSet(env.PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES);
  const missingScopes = LISTING_IMPORT_REQUIRED_SCOPES.filter(scope => !scopes.has(scope));
  const expiry = env.PROPERTY_FINDER_LISTING_IMPORT_EXPIRES_AT
    ? new Date(env.PROPERTY_FINDER_LISTING_IMPORT_EXPIRES_AT)
    : null;
  const expiryValid = Boolean(expiry && !Number.isNaN(expiry.getTime()));
  const timeoutMs = integer(env.PROPERTY_FINDER_TIMEOUT_MS, 15000);
  const requestsPerMinute = integer(env.PROPERTY_FINDER_REQUESTS_PER_MINUTE, 60);
  const checks = {
    deploymentIsCrmTest: env.NYSA_DEPLOYMENT_ENV === 'crm_test',
    environmentIsSandbox: env.PROPERTY_FINDER_ENVIRONMENT === 'sandbox',
    baseUrlIsApproved: exactSandboxOrigin(env.PROPERTY_FINDER_API_BASE_URL),
    connectorEnabled: enabled(env.PROPERTY_FINDER_SANDBOX_ENABLED),
    readsEnabled: enabled(env.PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS),
    apiKeyConfigured: typeof env.PROPERTY_FINDER_LISTING_IMPORT_API_KEY === 'string'
      && env.PROPERTY_FINDER_LISTING_IMPORT_API_KEY.length === 40,
    apiSecretConfigured: typeof env.PROPERTY_FINDER_LISTING_IMPORT_API_SECRET === 'string'
      && env.PROPERTY_FINDER_LISTING_IMPORT_API_SECRET.length === 32,
    expiryValid,
    notExpired: Boolean(expiryValid && expiry.getTime() > now.getTime()),
    scopesComplete: missingScopes.length === 0,
    timeoutValid: timeoutMs >= 1000 && timeoutMs <= 30000,
    rateLimitValid: requestsPerMinute >= 1 && requestsPerMinute <= 60
  };
  const ready = Object.values(checks).every(Boolean);
  return {
    provider: 'property_finder',
    environment: 'sandbox',
    credentialPurpose: 'listing_import_and_lead_reads',
    approvedBaseUrl: SANDBOX_ORIGIN,
    configured: checks.apiKeyConfigured && checks.apiSecretConfigured,
    networkReady: ready,
    externalWritesAvailable: false,
    publicationAvailable: false,
    listingImportReadReady: ready,
    listingReadScopeConfigured: scopes.has('listings:read'),
    leadReadScopeConfigured: scopes.has('leads:read'),
    expiresAt: expiryValid ? expiry.toISOString() : null,
    missingScopes,
    timeoutMs,
    requestsPerMinute,
    checks
  };
}

function safeNumericValue(payload, names) {
  if (!payload || typeof payload !== 'object') return null;
  for (const [key, value] of Object.entries(payload)) {
    if (names.has(key) && typeof value === 'number' && Number.isFinite(value)) return value;
  }
  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const found = safeNumericValue(value, names);
      if (found !== null) return found;
    }
  }
  return null;
}

function safeUsersCount(payload) {
  if (Array.isArray(payload)) return payload.length;
  for (const key of ['data', 'results', 'users']) {
    if (Array.isArray(payload?.[key])) return payload[key].length;
  }
  return null;
}

const rows = (payload, names) => {
  if (Array.isArray(payload)) return payload;
  for (const name of names) if (Array.isArray(payload?.[name])) return payload[name];
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    for (const name of names) if (Array.isArray(payload.data[name])) return payload.data[name];
  }
  return [];
};
const identifier = value => String(value?.id ?? value?.publicProfileId ?? value?.public_profile_id ?? '');
const exactSelected = (payload, id, names) => rows(payload, names).find(item => identifier(item) === String(id));

export function createPropertyFinderSandboxClient({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), credentialProfile = 'preflight' } = {}) {
  const listingImportProfile = credentialProfile === 'listing_import';
  const statusForProfile = () => listingImportProfile
    ? propertyFinderListingImportStatus(env, new Date(now()))
    : propertyFinderSandboxStatus(env, new Date(now()));
  const apiKey = () => listingImportProfile ? env.PROPERTY_FINDER_LISTING_IMPORT_API_KEY : env.PROPERTY_FINDER_SANDBOX_API_KEY;
  const apiSecret = () => listingImportProfile ? env.PROPERTY_FINDER_LISTING_IMPORT_API_SECRET : env.PROPERTY_FINDER_SANDBOX_API_SECRET;
  let cachedToken = null;
  let requestTimestamps = [];

  function requireReady() {
    const status = statusForProfile();
    if (!status.networkReady) {
      throw new PropertyFinderSandboxError(
        'sandbox_not_ready',
        'Property Finder sandbox reads are disabled or incompletely configured'
      );
    }
    if (typeof fetchImpl !== 'function') {
      throw new PropertyFinderSandboxError('fetch_unavailable', 'Outbound HTTP support is unavailable');
    }
    return status;
  }

  async function request(path, { method = 'GET', token = null, body = null } = {}) {
    const status = requireReady();
    const cutoff = now() - 60000;
    requestTimestamps = requestTimestamps.filter(timestamp => timestamp > cutoff);
    if (requestTimestamps.length >= status.requestsPerMinute) {
      throw new PropertyFinderSandboxError(
        'local_rate_limit_reached',
        'Property Finder sandbox local request limit has been reached',
        429
      );
    }
    requestTimestamps.push(now());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), status.timeoutMs);
    const headers = {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'X-PF-Error-Format': 'problem-json-v2'
    };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetchImpl(`${SANDBOX_ORIGIN}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      if (!response.ok) {
        const responseText = (await response.text()).slice(0, 20000);
        let safeBody = responseText;
        try {
          const parsed = JSON.parse(responseText), redact = value => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /secret|token|authorization|password|api.?key|email|phone|contact|owner/i.test(key) ? '[REDACTED]' : redact(item)])) : value;
          safeBody = JSON.stringify(redact(parsed));
        } catch { safeBody = responseText.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]'); }
        throw new PropertyFinderSandboxError(
          'upstream_rejected',
          'Property Finder sandbox rejected the safe read request',
          502,
          response.status,
          { method, endpoint: `${SANDBOX_ORIGIN}${path}`, requestedAtUtc: new Date(now()).toISOString(), responseStatus: response.status,
            responseContentType: response.headers.get('content-type') || null, responseBody: safeBody }
        );
      }
      try {
        return await response.json();
      } catch {
        throw new PropertyFinderSandboxError('invalid_upstream_response', 'Property Finder sandbox returned invalid JSON', 502);
      }
    } catch (error) {
      if (error instanceof PropertyFinderSandboxError) throw error;
      const code = error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_unavailable';
      const message = code === 'upstream_timeout'
        ? 'Property Finder sandbox read timed out'
        : 'Property Finder sandbox could not be reached';
      throw new PropertyFinderSandboxError(code, message, 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function accessToken() {
    requireReady();
    if (cachedToken && cachedToken.expiresAt > now() + 60000) return cachedToken.value;
    const payload = await request('/v1/auth/token', {
      method: 'POST',
      body: {
        apiKey: apiKey(),
        apiSecret: apiSecret()
      }
    });
    if (typeof payload?.accessToken !== 'string' || payload.accessToken.length < 16) {
      throw new PropertyFinderSandboxError('invalid_token_response', 'Property Finder sandbox did not return a valid access token', 502);
    }
    const lifetimeSeconds = Math.min(Math.max(integer(payload.expiresIn, 1800), 60), 1800);
    cachedToken = { value: payload.accessToken, expiresAt: now() + lifetimeSeconds * 1000 };
    return cachedToken.value;
  }

  async function verifySafeReads() {
    const token = await accessToken();
    const [creditPayload, usersPayload] = await Promise.all([
      request('/v1/credits/balance', { token }),
      request('/v1/users?page=1&perPage=1', { token })
    ]);
    return {
      provider: 'property_finder',
      environment: 'sandbox',
      baseUrl: SANDBOX_ORIGIN,
      authenticated: true,
      credits: {
        readable: true,
        total: safeNumericValue(creditPayload, new Set(['total'])),
        remaining: safeNumericValue(creditPayload, new Set(['remaining', 'remainingCredits', 'availableCredits', 'balance'])),
        used: safeNumericValue(creditPayload, new Set(['used']))
      },
      users: {
        readable: true,
        returnedCount: safeUsersCount(usersPayload),
        detailsReturned: false
      },
      externalWritesPerformed: false,
      publicationPerformed: false,
      verifiedAt: new Date(now()).toISOString()
    };
  }

  async function discoverListings({ page = 1, perPage = 50 } = {}) {
    const listingReadConfigured = listingImportProfile
      ? statusForProfile().listingReadScopeConfigured
      : scopeSet(env.PROPERTY_FINDER_API_SCOPES).has('listings:read');
    if (!listingReadConfigured) {
      throw new PropertyFinderSandboxError(
        'listing_read_scope_missing',
        'Property Finder sandbox listing discovery requires the separately approved listings:read scope',
        503
      );
    }
    requireReady();
    const safePage = Math.max(1, Math.min(10000, Number(page) || 1));
    const safePerPage = Math.max(1, Math.min(100, Number(perPage) || 50));
    const token = await accessToken();
    const payload = await request(`/v1/listings?page=${safePage}&perPage=${safePerPage}`, { token });
    const listingRows = rows(payload, ['data', 'results', 'listings']);
    return {
      listings: listingRows,
      pagination: {
        page: safePage,
        perPage: safePerPage,
        returnedCount: listingRows.length,
        hasMore: listingRows.length === safePerPage
      },
      provider: 'property_finder',
      environment: 'sandbox',
      externalReadsPerformed: true,
      externalWritesPerformed: false,
      publicationPerformed: false,
      creditsSpent: 0
    };
  }

  async function searchLocations({ query, parent = null } = {}) {
    const configuredScopes = scopeSet(env.PROPERTY_FINDER_API_SCOPES);
    if (!configuredScopes.has('locations:read')) {
      throw new PropertyFinderSandboxError('location_read_scope_missing', 'Property Finder sandbox location search requires locations:read', 503);
    }
    requireReady();
    const search = String(query || '').trim();
    const parentPath = String(parent || '').trim();
    if (search.length < 2 || search.length > 100) throw new PropertyFinderSandboxError('invalid_location_search', 'Enter 2 to 100 characters for the PF location search', 400);
    if (parentPath.length > 250) throw new PropertyFinderSandboxError('invalid_location_parent', 'PF location parent context is too long', 400);
    const token = await accessToken();
    const path = `/v1/locations?page=1&perPage=100&search=${encodeURIComponent(search)}${parentPath ? `&filter[parent]=${encodeURIComponent(parentPath)}` : ''}`;
    const payload = await request(path, { token });
    const locations = rows(payload, ['data', 'results', 'locations']).map(item => ({
      id: identifier(item),
      label: String(item?.name ?? item?.label ?? item?.path ?? '').trim().slice(0, 250),
      path: String(item?.path ?? item?.fullPath ?? item?.name ?? '').trim().slice(0, 500),
      type: String(item?.type ?? '').trim().slice(0, 80)
    })).filter(item => item.id && item.label).slice(0, 100);
    return { locations, query: search, parent: parentPath || null, externalReadsPerformed: true, externalWritesPerformed: false, publicationPerformed: false, creditsSpent: 0 };
  }

  async function listPublicProfiles() {
    const configuredScopes = scopeSet(env.PROPERTY_FINDER_API_SCOPES);
    if (!configuredScopes.has('users:read')) throw new PropertyFinderSandboxError('user_read_scope_missing', 'Property Finder sandbox profile resolution requires users:read', 503);
    const token = await accessToken();
    const payload = await request('/v1/users?page=1&perPage=100', { token });
    const profiles = rows(payload, ['data', 'results', 'users']).map(item => ({ id: identifier(item) })).filter(item => item.id).slice(0, 100);
    return { profiles, detailsReturned: false, externalReadsPerformed: true, externalWritesPerformed: false, publicationPerformed: false, creditsSpent: 0 };
  }

  async function resolvePreflightReferences({ publicProfileId, locationId, locationQuery, projectId = null, permitNumber, licenseNumber, permitType }) {
    const token = await accessToken();
    const userPath = '/v1/users?page=1&perPage=100';
    const locationPath = `/v1/locations?page=1&perPage=100&search=${encodeURIComponent(String(locationQuery || ''))}`;
    const projectPath = projectId ? `/v1/projects/${encodeURIComponent(String(projectId))}` : null;
    const compliancePath = `/v1/compliances/${encodeURIComponent(String(permitNumber))}/${encodeURIComponent(String(licenseNumber))}?permitType=${encodeURIComponent(String(permitType))}`;
    const [usersPayload, locationsPayload, projectPayload, compliancePayload] = await Promise.all([
      request(userPath, { token }),
      request(locationPath, { token }),
      projectPath ? request(projectPath, { token }) : Promise.resolve(null),
      request(compliancePath, { token })
    ]);
    const selectedUser = exactSelected(usersPayload, publicProfileId, ['data', 'results', 'users']);
    const selectedLocation = exactSelected(locationsPayload, locationId, ['data', 'results', 'locations']);
    const projectRecord = projectPayload?.data && !Array.isArray(projectPayload.data) ? projectPayload.data : projectPayload;
    const complianceRecord = compliancePayload?.data && !Array.isArray(compliancePayload.data) ? compliancePayload.data : compliancePayload;
    const complianceStatus = String(complianceRecord?.status ?? complianceRecord?.result ?? '').toLowerCase();
    return {
      publicProfile: { requested: true, id: String(publicProfileId), resolved: Boolean(selectedUser), detailsReturned: false },
      location: { requested: true, id: String(locationId), resolved: Boolean(selectedLocation), detailsReturned: false },
      project: { requested: Boolean(projectId), id: projectId ? String(projectId) : null, resolved: !projectId || identifier(projectRecord) === String(projectId), detailsReturned: false },
      compliance: { requested: true, matched: Boolean(complianceRecord) && !['invalid', 'expired', 'rejected', 'not_found'].includes(complianceStatus), detailsReturned: false },
      externalReadsPerformed: true,
      externalWritesPerformed: false,
      publicationPerformed: false,
      creditsSpent: 0
    };
  }

  return {
    status: statusForProfile,
    verifySafeReads,
    listPublicProfiles,
    searchLocations,
    resolvePreflightReferences,
    discoverListings
  };
}

export function createPropertyFinderListingImportClient(options = {}) {
  return createPropertyFinderSandboxClient({ ...options, credentialProfile: 'listing_import' });
}

export const PROPERTY_FINDER_SANDBOX_ORIGIN = SANDBOX_ORIGIN;
export const PROPERTY_FINDER_SANDBOX_REQUIRED_SCOPES = REQUIRED_SCOPES;
export const PROPERTY_FINDER_LISTING_IMPORT_REQUIRED_SCOPES = LISTING_IMPORT_REQUIRED_SCOPES;
