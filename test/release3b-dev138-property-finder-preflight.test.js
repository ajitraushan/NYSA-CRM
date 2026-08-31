import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPropertyFinderPreflight,
  businessReadablePropertyFinderPreview,
  isExplicitlyTaggedTestInventory,
  PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION
} from '../src/property-finder-preflight.js';
import { createPropertyFinderSandboxClient, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const clock = Date.parse('2026-08-04T12:00:00.000Z');
const validEnv = () => ({
  NYSA_DEPLOYMENT_ENV: 'crm_test', PROPERTY_FINDER_ENVIRONMENT: 'sandbox', PROPERTY_FINDER_API_BASE_URL: PROPERTY_FINDER_SANDBOX_ORIGIN,
  PROPERTY_FINDER_SANDBOX_API_KEY: 'k'.repeat(40), PROPERTY_FINDER_SANDBOX_API_SECRET: 's'.repeat(32),
  PROPERTY_FINDER_SANDBOX_EXPIRES_AT: '2026-09-03T11:25:00.000Z', PROPERTY_FINDER_API_SCOPES: 'users:read,listings:read,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access',
  PROPERTY_FINDER_TIMEOUT_MS: '15000', PROPERTY_FINDER_REQUESTS_PER_MINUTE: '60', PROPERTY_FINDER_SANDBOX_ENABLED: '1', PROPERTY_FINDER_ALLOW_READS: '1'
});
const listing = () => ({ inventoryReference: 'R3B-UAT-04-NYSA-INV-1', inventoryHeadline: 'R3B-UAT-04 Dubai test', workflowStatus: 'approved', verificationStatus: 'verified', status: 'Available', marketingAgreementCount: 1, propertyType: 'Apartment', bedrooms: '2', sizeSqft: 1600 });
const preparation = () => ({ revisionNumber: 3, isCurrent: true, readinessSnapshot: { ready: true }, mappingVersionCode: 'pf-1.0.1', effectiveMappingVersionCode: 'property-finder-enterprise-api-1.0.1-dev.142', permitMatched: true, portalFields: {
  publicationTitle: 'Sea-facing two-bedroom apartment', publicationDescription: 'Accurate approved advertising copy. '.repeat(25), offeringType: 'sale', uaeEmirate: 'dubai', propertyCategory: 'residential', furnishingType: 'furnished', bathrooms: '2', publicationPrice: 2500000, downPayment: 500000, propertyType: 'apartment', complianceType: 'rera'
} });
const permitEvidence = { permitNumber: 'TEST-PERMIT-001' };
const resolutions = () => ({ publicProfile: { id: 'pf-profile-17', resolved: true }, location: { id: 'pf-location-50', resolved: true }, project: { requested: true, id: 'pf-project-2', resolved: true }, compliance: { matched: true } });
const mediaSelections = Array.from({length:6},(_,index)=>({ propertyMediaId: `00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`, deliveryUrl: `https://media.example.test/test-image-${index+1}.jpg?temporary=fixture`, availableUntil: '2026-08-12T12:00:00.000Z', width: 1920, height: 1080, colourSpace: 'sRGB' }));
const selectedMedia = mediaSelections.map((selection,index)=>({ id: selection.propertyMediaId, approvalStatus: 'approved', usageRightsConfirmed: true, rightsExpiresAt: '2026-08-20T00:00:00.000Z', mediaType: 'image/jpeg', fileSizeBytes: 500000, fileHash:String(index+1).padStart(64,'0') }));

test('dev.138 accepts only an explicit visible test tag and builds one deterministic versioned PF payload', () => {
  assert.equal(isExplicitlyTaggedTestInventory(listing(), 'R3B-UAT-04'), true);
  assert.equal(isExplicitlyTaggedTestInventory(listing(), 'ordinary-record'), false);
  const input = { listing: listing(), preparation: preparation(), permitEvidence, resolutions: resolutions(), mediaSelections, selectedMedia, now: new Date(clock) };
  const first = buildPropertyFinderPreflight(input), second = buildPropertyFinderPreflight(input);
  assert.equal(first.ready, true);
  assert.equal(first.mappingVersion, PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION);
  assert.equal(first.payloadHash, second.payloadHash);
  assert.match(first.payloadHash, /^[a-f0-9]{64}$/);
  assert.equal(first.payload.reference, 'R3B-UAT-04-NYSA-INV-1-PF-R3');
  assert.equal(first.payload.assignedTo.id, 'pf-profile-17');
  assert.equal(first.payload.location.id, 'pf-location-50');
  assert.equal(first.payload.project.id, 'pf-project-2');
  assert.equal(first.payload.compliance.listingAdvertisementNumber, 'TEST-PERMIT-001');
  assert.deepEqual(first.payload.price, { amounts: { sale: 2500000 }, type: 'sale' });
  assert.equal(first.payload.media.images.length, 6);
  const preview = businessReadablePropertyFinderPreview({ listing: listing(), preparation: preparation(), preflight: first, resolutions: resolutions() });
  assert.equal(preview.outcome, 'READY FOR REVIEW — NO LISTING WAS SENT');
  assert.equal(preview.creditsSpent, 0);
  assert.equal(preview.publicationPerformed, false);
});

test('dev.138 blocks invalid media, unresolved identities and stale preparation without constructing a payload', () => {
  const result = buildPropertyFinderPreflight({ listing: listing(), preparation: { ...preparation(), isCurrent: false }, permitEvidence, resolutions: { ...resolutions(), location: { id: 'x', resolved: false } }, mediaSelections: [{ ...mediaSelections[0], deliveryUrl: 'http://media.example.test/image.jpg' }], selectedMedia, now: new Date(clock) });
  assert.equal(result.ready, false);
  assert.equal(result.payload, null);
  assert.equal(result.payloadHash, null);
  assert.ok(result.blockers.includes('The selected preparation is the current immutable revision'));
  assert.ok(result.blockers.includes('Manually selected PF location resolved'));
  assert.ok(result.blockers.includes('Selected images meet Property Finder quality and delivery requirements'));
});

test('controlled PF resolution calls only users, locations, optional project and compliance GET endpoints and redacts details', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/auth/token')) return new Response(JSON.stringify({ accessToken: 't'.repeat(32), expiresIn: 1800 }), { status: 200 });
    if (url.includes('/v1/users?')) return new Response(JSON.stringify({ data: [{ id: 'profile-1', email: 'private@example.test' }] }), { status: 200 });
    if (url.includes('/v1/locations?')) return new Response(JSON.stringify({ data: [{ id: 'location-1', name: 'Test location' }] }), { status: 200 });
    if (url.endsWith('/v1/projects/project-1')) return new Response(JSON.stringify({ data: { id: 'project-1', privateOwner: 'never return' } }), { status: 200 });
    if (url.includes('/v1/compliances/PERMIT-1/LICENSE-1?permitType=property')) return new Response(JSON.stringify({ data: { status: 'valid', owner: 'never return' } }), { status: 200 });
    throw new Error(`Unexpected URL ${url}`);
  };
  const client = createPropertyFinderSandboxClient({ env: validEnv(), fetchImpl, now: () => clock });
  const result = await client.resolvePreflightReferences({ publicProfileId: 'profile-1', locationId: 'location-1', locationQuery: 'Dubai Marina', projectId: 'project-1', permitNumber: 'PERMIT-1', licenseNumber: 'LICENSE-1', permitType:'property' });
  assert.deepEqual(calls.slice(1).map(call => [new URL(call.url).pathname, call.options.method]), [['/v1/users', 'GET'], ['/v1/locations', 'GET'], ['/v1/projects/project-1', 'GET'], ['/v1/compliances/PERMIT-1/LICENSE-1', 'GET']]);
  assert.equal(new URL(calls.at(-1).url).searchParams.get('permitType'),'property');
  assert.equal(result.publicProfile.resolved, true);
  assert.equal(result.location.resolved, true);
  assert.equal(result.project.resolved, true);
  assert.equal(result.compliance.matched, true);
  assert.equal(result.creditsSpent, 0);
  assert.doesNotMatch(JSON.stringify(result), /private@example|privateOwner|never return/);
});

test('dev.138 HTTP boundary is full-admin, exact-confirmation, tagged-test-only, audit-minimised and write-free', () => {
  const route = read('src/routes/property-finder-sandbox.js'), listingsRoute = read('src/routes/listings.js'), connector = read('src/property-finder-sandbox.js'), ui = read('public/app.js');
  for (const marker of ["req.broker.role === 'admin'", "req.broker.jobRole === 'admin'", 'PROPERTY_FINDER_PREFLIGHT_CONFIRMATION', 'isExplicitlyTaggedTestInventory', 'current_preparation_version_id', 'property_finder_sandbox_listing_preflighted', 'creditsSpent: 0']) assert.ok(route.includes(marker), marker);
  assert.doesNotMatch(route, /client\.(create|update|delete|publish|unpublish|registerWebhook)/);
  assert.doesNotMatch(connector, /method:\s*['"](?:PUT|PATCH|DELETE)['"]|\/v1\/webhooks/);
  assert.match(connector, /request\(`\/v1\/listings\?page=\$\{safePage\}&perPage=\$\{safePerPage\}`/);
  for (const marker of ['propertyFinderPreflightMedia', "media.approval_status='approved'", '4. Property Finder sandbox outward preflight', 'Build no-send PF preview', 'PREFLIGHT_PROPERTY_FINDER_SANDBOX', 'Review exact versioned PF payload', 'No Property Finder listing was sent']) assert.ok(`${listingsRoute}\n${ui}`.includes(marker), marker);
  const outwardStart = ui.indexOf('4. Property Finder sandbox outward preflight'), outwardEnd = ui.indexOf('Connector ETL mapping register', outwardStart), outwardUi = ui.slice(outwardStart, outwardEnd);
  assert.ok(outwardStart > 0 && outwardEnd > outwardStart);
  assert.doesNotMatch(outwardUi, /<button[^>]*>\s*(?:Send|Publish)/i);
  assert.match(outwardUi, /no-send dry run/i);
  const outwardHarness = read('scripts/property-finder-outward-pre-uat.js'), pkg = JSON.parse(read('package.json'));
  for (const marker of ['credential-free-outward-pre-uat', 'externalNetworkCalls: 0', 'propertyFinderWrites: 0', 'publicationPerformed: false', 'creditsSpent: 0', "flag: 'wx'"]) assert.ok(outwardHarness.includes(marker), marker);
  assert.equal(pkg.scripts['uat:property-finder:outward:pre'], 'node scripts/property-finder-outward-pre-uat.js');
  assert.equal(JSON.parse(read('package.json')).version, '2.1.0-dev.174');
  assert.equal(JSON.parse(read('package-lock.json')).version, '2.1.0-dev.174');
});
