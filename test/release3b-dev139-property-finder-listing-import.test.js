import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPropertyFinderDraftIntake,
  isTaggedPropertyFinderTestListing,
  normalizePropertyFinderListingForImport,
  propertyFinderListingImportPreview,
  signPropertyFinderListingReview,
  verifyPropertyFinderListingReview,
  PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION
} from '../src/property-finder-listing-import.js';
import { validateListingIntakePayload } from '../src/listing-intake-domain.js';
import { createPropertyFinderListingImportClient, propertyFinderListingImportStatus, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const clock = Date.parse('2026-08-05T08:00:00.000Z');
const secret = 'review-secret-for-tests-only-1234567890';
const validEnv = (overrides = {}) => ({
  NYSA_DEPLOYMENT_ENV: 'crm_test', PROPERTY_FINDER_ENVIRONMENT: 'sandbox', PROPERTY_FINDER_API_BASE_URL: PROPERTY_FINDER_SANDBOX_ORIGIN,
  PROPERTY_FINDER_LISTING_IMPORT_API_KEY: 'k'.repeat(40), PROPERTY_FINDER_LISTING_IMPORT_API_SECRET: 's'.repeat(32),
  PROPERTY_FINDER_LISTING_IMPORT_EXPIRES_AT: '2026-09-04T16:26:00.000Z',
  PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES: 'users:read,listings:read,leads:read,credits:read',
  PROPERTY_FINDER_TIMEOUT_MS: '15000', PROPERTY_FINDER_REQUESTS_PER_MINUTE: '60', PROPERTY_FINDER_SANDBOX_ENABLED: '1', PROPERTY_FINDER_ALLOW_READS: '0', PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS: '1',
  ...overrides
});
const pfListing = () => ({
  id: 'pf-sandbox-listing-17', reference: 'R3B-UAT-PF-017', status: 'draft',
  title: { en: 'R3B UAT Marina apartment +971 50 123 4567' }, project: { id: 'project-1', name: 'R3B UAT Marina Tower' },
  location: { id: 'location-1', name: 'Dubai Marina' }, type: 'apartment', bedrooms: 2, size: 1400,
  price: { type: 'sale', amounts: { sale: 2500000 }, currency: 'AED' },
  media: { images: [{ original: { url: 'https://private.example.test/signed' } }] },
  owner: { name: 'Private Owner', phone: '+971501111111' }, assignedTo: { email: 'agent@example.test' }
});

test('dev.139 sanitizes PF listing discovery and maps only governed Inventory facts', () => {
  const listing = normalizePropertyFinderListingForImport(pfListing());
  assert.equal(listing.externalRecordId, 'pf-sandbox-listing-17');
  assert.equal(listing.propertyType, 'Apartment');
  assert.equal(listing.bedrooms, '2');
  assert.equal(listing.price, 2500000);
  assert.equal(listing.currency, 'AED');
  assert.match(listing.title, /contact withheld/);
  assert.equal(listing.mediaCount, 1);
  assert.equal(listing.ownerContactDetailsReturned, false);
  assert.equal(listing.mediaUrlsReturned, false);
  assert.doesNotMatch(JSON.stringify(listing), /Private Owner|agent@example|private\.example|50111111/);
});

test('discovery preview distinguishes linked, possible duplicate and unmatched PF listings', () => {
  const listing = normalizePropertyFinderListingForImport(pfListing());
  assert.equal(propertyFinderListingImportPreview(listing).draftImportEligible, true);
  const linked = propertyFinderListingImportPreview(listing, { linked: { id: 'core-1', inventoryReference: 'NYSA-INV-1' } });
  assert.equal(linked.match.kind, 'linked');
  assert.equal(linked.draftImportEligible, false);
  assert.ok(linked.blockers.some(item => item.code === 'already_linked'));
  const duplicate = propertyFinderListingImportPreview(listing, { possibleReferenceMatch: { id: 'core-2', inventoryReference: listing.reference } });
  assert.equal(duplicate.match.kind, 'possible_duplicate');
  assert.equal(duplicate.draftImportEligible, false);
});

test('short-lived review tokens bind the sanitized snapshot and reject tampering or expiry', () => {
  const listing = normalizePropertyFinderListingForImport(pfListing());
  const token = signPropertyFinderListingReview(listing, secret, { now: clock, ttlMs: 60000 });
  assert.ok(token);
  assert.deepEqual(verifyPropertyFinderListingReview(token, secret, { now: clock + 30000 }).value.listing, listing);
  assert.equal(verifyPropertyFinderListingReview(`${token}x`, secret, { now: clock }).code, 'invalid_review_token');
  assert.equal(verifyPropertyFinderListingReview(token, secret, { now: clock + 60001 }).code, 'expired_review_token');
  assert.equal(verifyPropertyFinderListingReview(token, 'short', { now: clock }).code, 'review_not_configured');
});

test('explicit PF import builds the existing provider-neutral Draft contract without private parties or media', () => {
  const listing = normalizePropertyFinderListingForImport(pfListing());
  assert.equal(isTaggedPropertyFinderTestListing(listing, 'R3B-UAT'), true);
  assert.equal(isTaggedPropertyFinderTestListing(listing, 'ordinary'), false);
  const candidate = buildPropertyFinderDraftIntake(listing, {
    areaCode: 'dubai_marina', responsibleAgentId: '00000000-0000-4000-8000-000000000031', originatingAgentId: '00000000-0000-4000-8000-000000000031'
  });
  assert.equal(candidate.provider, 'property_finder');
  assert.equal(candidate.sourceKind, 'import');
  assert.equal(candidate.mappingVersion, PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION);
  assert.equal(candidate.listing.contact, null);
  assert.equal(candidate.listing.owner, null);
  assert.equal(validateListingIntakePayload(candidate).error, undefined);
  assert.doesNotMatch(JSON.stringify(candidate), /Private Owner|agent@example|private\.example/);
});

test('listing discovery requires listings:read before token exchange and uses only GET v1 listings', async () => {
  assert.equal(propertyFinderListingImportStatus(validEnv(), new Date(clock)).listingImportReadReady, true);
  assert.equal(propertyFinderListingImportStatus(validEnv({ PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES: validEnv().PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES.replace('listings:read,', '') }), new Date(clock)).listingImportReadReady, false);
  let blockedCalls = 0;
  const blocked = createPropertyFinderListingImportClient({ env: validEnv({ PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES: validEnv().PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES.replace('listings:read,', '') }), fetchImpl: async () => { blockedCalls += 1; }, now: () => clock });
  await assert.rejects(blocked.discoverListings(), error => error.code === 'listing_read_scope_missing');
  assert.equal(blockedCalls, 0);
  const calls = [];
  const client = createPropertyFinderListingImportClient({ env: validEnv(), now: () => clock, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/auth/token')) return new Response(JSON.stringify({ accessToken: 't'.repeat(32), expiresIn: 1800 }), { status: 200 });
    if (url.endsWith('/v1/listings?page=2&perPage=25')) return new Response(JSON.stringify({ data: [pfListing()] }), { status: 200 });
    throw new Error(`Unexpected URL ${url}`);
  } });
  const result = await client.discoverListings({ page: 2, perPage: 25 });
  assert.deepEqual(calls.map(call => [call.url, call.options.method]), [[`${PROPERTY_FINDER_SANDBOX_ORIGIN}/v1/auth/token`, 'POST'], [`${PROPERTY_FINDER_SANDBOX_ORIGIN}/v1/listings?page=2&perPage=25`, 'GET']]);
  assert.equal(result.listings.length, 1);
  assert.equal(result.externalWritesPerformed, false);
  assert.equal(result.creditsSpent, 0);
});

test('dev.139 HTTP and UI boundary is confirmed, full-admin, duplicate-safe and Draft-only', () => {
  const route = read('src/routes/property-finder-sandbox.js'), intake = read('src/routes/listing-intake.js'), env = read('.env.example'), ui = read('public/app.js');
  for (const marker of ['createPropertyFinderListingImportClient', 'PROPERTY_FINDER_LISTING_DISCOVERY_CONFIRMATION', 'PROPERTY_FINDER_LISTING_IMPORT_CONFIRMATION', 'PROPERTY_FINDER_IMPORT_REVIEW_SECRET', 'propertyFinderListingImportPreview', 'validateListingIntakePayload', 'processEventWithClient', "source_provider='property_finder'", 'ON CONFLICT(provider_code,event_id) DO NOTHING', 'importBoundary.networkReady', 'importBoundary.listingReadScopeConfigured', 'automaticVerificationPerformed: false', 'automaticActivationPerformed: false']) assert.ok(route.includes(marker), marker);
  assert.match(route, /req\.broker\.role === 'admin'.*req\.broker\.jobRole === 'admin'/);
  assert.doesNotMatch(route, /client\.(create|update|delete|publish|unpublish)/);
  assert.match(intake, /'blocked','draft'/);
  assert.match(env, /PROPERTY_FINDER_ALLOW_READS=0/);
  assert.match(env, /PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=0/);
  assert.match(env, /PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES=users:read,listings:read,leads:read,credits:read/);
  assert.match(env, /PROPERTY_FINDER_IMPORT_REVIEW_SECRET=\r?\n/);
  for (const marker of ['Import existing Property Finder sandbox listings', 'Discover PF sandbox listings', 'Review Draft import', 'Visible sandbox test tag', 'Governed CORE Area', 'Create reviewed Internal Inventory Draft', 'PF media, owner/contact information, approval, verification and availability will not be imported', 'IMPORT_PROPERTY_FINDER_SANDBOX_LISTING_AS_DRAFT']) assert.ok(ui.includes(marker), marker);
  const importUiStart = ui.indexOf('Import existing Property Finder sandbox listings'), importUi = ui.slice(importUiStart, ui.indexOf('</section>', importUiStart));
  assert.doesNotMatch(importUi, /publish|unpublish|creditsSpent/i);
  assert.equal(JSON.parse(read('package.json')).version, '2.1.0-dev.174');
  assert.equal(JSON.parse(read('package-lock.json')).version, '2.1.0-dev.174');
});
