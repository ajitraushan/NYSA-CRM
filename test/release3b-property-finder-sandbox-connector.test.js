import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPropertyFinderSandboxClient,
  propertyFinderSandboxStatus,
  PropertyFinderSandboxError,
  PROPERTY_FINDER_SANDBOX_ORIGIN
} from '../src/property-finder-sandbox.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const key = 'k'.repeat(40);
const secret = 's'.repeat(32);
const validEnv = () => ({
  NYSA_DEPLOYMENT_ENV: 'crm_test',
  PROPERTY_FINDER_ENVIRONMENT: 'sandbox',
  PROPERTY_FINDER_API_BASE_URL: PROPERTY_FINDER_SANDBOX_ORIGIN,
  PROPERTY_FINDER_SANDBOX_API_KEY: key,
  PROPERTY_FINDER_SANDBOX_API_SECRET: secret,
  PROPERTY_FINDER_SANDBOX_EXPIRES_AT: '2026-09-03T11:25:00.000Z',
  PROPERTY_FINDER_API_SCOPES: 'users:read,listings:read,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access',
  PROPERTY_FINDER_TIMEOUT_MS: '15000',
  PROPERTY_FINDER_REQUESTS_PER_MINUTE: '60',
  PROPERTY_FINDER_SANDBOX_ENABLED: '1',
  PROPERTY_FINDER_ALLOW_READS: '1'
});
const clock = Date.parse('2026-08-04T12:00:00.000Z');

test('sandbox connector requires exact CRM-Test identity, exact host, flags, scopes and future expiry', () => {
  assert.equal(propertyFinderSandboxStatus(validEnv(), new Date(clock)).networkReady, true);
  for (const override of [
    { NYSA_DEPLOYMENT_ENV: 'production' },
    { PROPERTY_FINDER_ENVIRONMENT: 'production' },
    { PROPERTY_FINDER_API_BASE_URL: 'https://atlas.propertyfinder.com' },
    { PROPERTY_FINDER_API_BASE_URL: 'https://sandbox.atlas.propertyfinder.com.evil.example' },
    { PROPERTY_FINDER_SANDBOX_ENABLED: '0' },
    { PROPERTY_FINDER_ALLOW_READS: '0' },
    { PROPERTY_FINDER_API_SCOPES: 'users:read,credits:read' },
    { PROPERTY_FINDER_SANDBOX_EXPIRES_AT: '2026-08-03T00:00:00.000Z' }
  ]) {
    assert.equal(propertyFinderSandboxStatus({ ...validEnv(), ...override }, new Date(clock)).networkReady, false);
  }
});

test('safe status contains configuration facts but never credentials', () => {
  const status = propertyFinderSandboxStatus(validEnv(), new Date(clock));
  const serialized = JSON.stringify(status);
  assert.equal(status.externalWritesAvailable, false);
  assert.equal(status.publicationAvailable, false);
  assert.doesNotMatch(serialized, new RegExp(key));
  assert.doesNotMatch(serialized, new RegExp(secret));
});

test('verification uses only token, credit balance and minimal users reads and returns no user details', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/auth/token')) return new Response(JSON.stringify({ accessToken: 't'.repeat(32), tokenType: 'Bearer', expiresIn: 1800 }), { status: 200 });
    if (url.endsWith('/v1/credits/balance')) return new Response(JSON.stringify({ total: 10000, remaining: 9876, used: 124, privateNote: secret }), { status: 200 });
    if (url.includes('/v1/users?')) return new Response(JSON.stringify({ data: [{ id: 'pf-user-1', email: 'private@example.test' }] }), { status: 200 });
    throw new Error(`Unexpected URL: ${url}`);
  };
  const client = createPropertyFinderSandboxClient({ env: validEnv(), fetchImpl, now: () => clock });
  const result = await client.verifySafeReads();
  assert.deepEqual(calls.map(call => call.url), [
    `${PROPERTY_FINDER_SANDBOX_ORIGIN}/v1/auth/token`,
    `${PROPERTY_FINDER_SANDBOX_ORIGIN}/v1/credits/balance`,
    `${PROPERTY_FINDER_SANDBOX_ORIGIN}/v1/users?page=1&perPage=1`
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body), { apiKey: key, apiSecret: secret });
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${'t'.repeat(32)}`);
  assert.deepEqual(result.credits, { readable: true, total: 10000, remaining: 9876, used: 124 });
  assert.equal(result.users.returnedCount, 1);
  assert.equal(result.users.detailsReturned, false);
  assert.equal(result.externalWritesPerformed, false);
  assert.equal(result.publicationPerformed, false);
  assert.doesNotMatch(JSON.stringify(result), /private@example|privateNote|ssssssss/);
});

test('credentials are rejected before any network request when sandbox boundary is not ready', async () => {
  let calls = 0;
  const client = createPropertyFinderSandboxClient({
    env: { ...validEnv(), PROPERTY_FINDER_API_BASE_URL: 'https://atlas.propertyfinder.com' },
    fetchImpl: async () => { calls += 1; },
    now: () => clock
  });
  await assert.rejects(client.verifySafeReads(), error => error instanceof PropertyFinderSandboxError && error.code === 'sandbox_not_ready');
  assert.equal(calls, 0);
});

test('upstream failures are redacted and never echo response bodies or credentials', async () => {
  const client = createPropertyFinderSandboxClient({
    env: validEnv(),
    fetchImpl: async () => new Response(JSON.stringify({ detail: secret }), { status: 401 }),
    now: () => clock
  });
  await assert.rejects(client.verifySafeReads(), error => {
    assert.equal(error.code, 'upstream_rejected');
    assert.equal(error.upstreamStatus, 401);
    assert.doesNotMatch(error.message, new RegExp(secret));
    return true;
  });
});

test('configured request ceiling is enforced locally before another sandbox call', async () => {
  let calls = 0;
  const client = createPropertyFinderSandboxClient({
    env: { ...validEnv(), PROPERTY_FINDER_REQUESTS_PER_MINUTE: '1' },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ accessToken: 't'.repeat(32), expiresIn: 1800 }), { status: 200 });
    },
    now: () => clock
  });
  await assert.rejects(client.verifySafeReads(), error => error.code === 'local_rate_limit_reached' && error.httpStatus === 429);
  assert.equal(calls, 1);
});

test('HTTP boundary is full-admin, explicit-confirmation, read-only and server-side', () => {
  const route = read('src/routes/property-finder-sandbox.js');
  const server = read('src/server.js');
  const envExample = read('.env.example');
  for (const marker of ['requireAuth', "req.broker.role === 'admin'", "req.broker.jobRole === 'admin'", 'VERIFY_PROPERTY_FINDER_SANDBOX', 'verifySafeReads']) {
    assert.match(route, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(route, /listings\/{0,1}.*publish|createListing|updateListing|deleteListing/);
  assert.match(route, /audit\('Broker', req\.broker\.id, 'property_finder_sandbox_safe_reads_verified'/);
  assert.doesNotMatch(route, /audit\('PropertyFinderSandbox'/);
  assert.match(server, /propertyFinderSandboxRoutes/);
  assert.match(envExample, /PROPERTY_FINDER_SANDBOX_API_KEY=\r?\n/);
  assert.match(envExample, /PROPERTY_FINDER_SANDBOX_API_SECRET=\r?\n/);
  assert.match(envExample, /PROPERTY_FINDER_SANDBOX_ENABLED=0/);
  assert.match(envExample, /PROPERTY_FINDER_ALLOW_READS=0/);
});
