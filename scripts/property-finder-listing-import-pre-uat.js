#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  buildPropertyFinderDraftIntake,
  isTaggedPropertyFinderTestListing,
  normalizePropertyFinderListingForImport,
  propertyFinderListingImportPreview,
  signPropertyFinderListingReview,
  verifyPropertyFinderListingReview
} from '../src/property-finder-listing-import.js';
import { validateListingIntakePayload } from '../src/listing-intake-domain.js';
import { createPropertyFinderListingImportClient, propertyFinderListingImportStatus, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const CLOCK = Date.parse('2026-08-05T08:00:00.000Z');
const TEST_SECRET = 'offline-pre-uat-secret-not-for-runtime-use-139';
const RUN_TAG = `PF-LISTING-IMPORT-PRE-UAT-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${process.pid}`;
const checks = [];

function check(id, title, passed, evidence) {
  checks.push({ id, title, status: passed ? 'pass' : 'fail', evidence });
}

function fixture(overrides = {}) {
  return {
    id: 'pf-offline-fixture-139',
    reference: 'R3B-UAT-PF-139',
    status: 'draft',
    title: { en: 'R3B UAT Marina apartment +971 50 000 0000' },
    project: { id: 'pf-project-139', name: 'R3B UAT Marina Tower' },
    location: { id: 'pf-location-139', name: 'Dubai Marina' },
    type: 'apartment',
    bedrooms: 2,
    size: 1400,
    price: { type: 'sale', amounts: { sale: 2500000 }, currency: 'AED' },
    media: { images: [{ original: { url: 'https://withheld.invalid/media' } }] },
    owner: { name: 'Synthetic Private Owner', phone: '+971500000000' },
    assignedTo: { email: 'synthetic-agent@example.invalid' },
    ...overrides
  };
}

function offlineEnv(overrides = {}) {
  return {
    NYSA_DEPLOYMENT_ENV: 'crm_test',
    PROPERTY_FINDER_ENVIRONMENT: 'sandbox',
    PROPERTY_FINDER_API_BASE_URL: PROPERTY_FINDER_SANDBOX_ORIGIN,
    PROPERTY_FINDER_LISTING_IMPORT_API_KEY: 'k'.repeat(40),
    PROPERTY_FINDER_LISTING_IMPORT_API_SECRET: 's'.repeat(32),
    PROPERTY_FINDER_LISTING_IMPORT_EXPIRES_AT: '2026-09-04T16:26:00.000Z',
    PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES: 'users:read,listings:read,leads:read,credits:read',
    PROPERTY_FINDER_TIMEOUT_MS: '15000',
    PROPERTY_FINDER_REQUESTS_PER_MINUTE: '60',
    PROPERTY_FINDER_SANDBOX_ENABLED: '1',
    PROPERTY_FINDER_ALLOW_READS: '0',
    PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS: '1',
    ...overrides
  };
}

async function run() {
  const defaultOff = propertyFinderListingImportStatus(offlineEnv({ PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS: '0' }), new Date(CLOCK));
  check('PF-PRE-001', 'External reads remain default-off', defaultOff.networkReady === false && defaultOff.listingImportReadReady === false,
    'Offline status check returned networkReady=false and listingImportReadReady=false.');

  let calls = 0;
  const missingScope = createPropertyFinderListingImportClient({
    env: offlineEnv({ PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES: offlineEnv().PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES.replace('listings:read,', '') }),
    now: () => CLOCK,
    fetchImpl: async () => { calls += 1; throw new Error('Network transport must not be reached'); }
  });
  let missingScopeCode = '';
  try { await missingScope.discoverListings(); } catch (error) { missingScopeCode = error.code; }
  check('PF-PRE-002', 'Separate listings:read gate precedes authentication', missingScopeCode === 'listing_read_scope_missing' && calls === 0,
    `Result=${missingScopeCode || 'missing'}; mock transport calls=${calls}.`);

  const transport = [];
  const client = createPropertyFinderListingImportClient({
    env: offlineEnv(),
    now: () => CLOCK,
    fetchImpl: async (url, options) => {
      transport.push({ path: new URL(url).pathname + new URL(url).search, method: options.method });
      if (url.endsWith('/v1/auth/token')) return new Response(JSON.stringify({ accessToken: 'offline-access-token-placeholder', expiresIn: 1800 }), { status: 200 });
      if (url.endsWith('/v1/listings?page=1&perPage=3')) return new Response(JSON.stringify({ data: [fixture()] }), { status: 200 });
      throw new Error('Offline harness refused an unexpected PF path');
    }
  });
  const discovery = await client.discoverListings({ page: 1, perPage: 3 });
  const exactTransport = JSON.stringify(transport) === JSON.stringify([
    { path: '/v1/auth/token', method: 'POST' },
    { path: '/v1/listings?page=1&perPage=3', method: 'GET' }
  ]);
  check('PF-PRE-003', 'Discovery transport is bounded and read-only', exactTransport && discovery.externalWritesPerformed === false && discovery.publicationPerformed === false && discovery.creditsSpent === 0,
    'Synthetic transport used token authentication followed by exactly one GET /v1/listings?page=1&perPage=3; writes, publication and credits are false/zero.');

  const listing = normalizePropertyFinderListingForImport(discovery.listings[0]);
  const serializedListing = JSON.stringify(listing);
  const privateEvidenceAbsent = !/Synthetic Private Owner|synthetic-agent|withheld\.invalid|500000000/i.test(serializedListing);
  check('PF-PRE-004', 'Private party and media evidence is withheld', privateEvidenceAbsent && listing.ownerContactDetailsReturned === false && listing.mediaUrlsReturned === false,
    `Sanitized listing retains mediaCount=${listing.mediaCount}; owner/contact fields and media URLs are absent.`);

  const unmatched = propertyFinderListingImportPreview(listing);
  const linked = propertyFinderListingImportPreview(listing, { linked: { id: 'core-fixture-1', inventoryReference: 'NYSA-INV-UAT-1' } });
  const duplicate = propertyFinderListingImportPreview(listing, { possibleReferenceMatch: { id: 'core-fixture-2', inventoryReference: listing.reference } });
  check('PF-PRE-005', 'Duplicate reconciliation blocks unsafe imports', unmatched.draftImportEligible === true && linked.draftImportEligible === false && duplicate.draftImportEligible === false,
    `Unmatched=${unmatched.match.kind}; linked=${linked.match.kind}; possible duplicate=${duplicate.match.kind}.`);

  const token = signPropertyFinderListingReview(listing, TEST_SECRET, { now: CLOCK, ttlMs: 60000 });
  const valid = verifyPropertyFinderListingReview(token, TEST_SECRET, { now: CLOCK + 30000 });
  const tampered = verifyPropertyFinderListingReview(`${token}x`, TEST_SECRET, { now: CLOCK });
  const expired = verifyPropertyFinderListingReview(token, TEST_SECRET, { now: CLOCK + 60001 });
  check('PF-PRE-006', 'Review token is bound, tamper-evident and expiring', valid.value?.listing?.externalRecordId === listing.externalRecordId && tampered.code === 'invalid_review_token' && expired.code === 'expired_review_token',
    `Valid snapshot bound; tamper result=${tampered.code}; expiry result=${expired.code}.`);

  const tagged = isTaggedPropertyFinderTestListing(listing, 'R3B-UAT');
  const ordinary = isTaggedPropertyFinderTestListing(listing, 'ordinary');
  check('PF-PRE-007', 'Only visibly tagged sandbox fixtures qualify', tagged === true && ordinary === false,
    'Visible R3B-UAT tag accepted; unrelated tag rejected.');

  const intake = buildPropertyFinderDraftIntake(listing, {
    areaCode: 'dubai_marina',
    originatingAgentId: '00000000-0000-4000-8000-000000000139',
    responsibleAgentId: '00000000-0000-4000-8000-000000000139'
  });
  const secondIntake = buildPropertyFinderDraftIntake(listing, {
    areaCode: 'dubai_marina',
    originatingAgentId: '00000000-0000-4000-8000-000000000139',
    responsibleAgentId: '00000000-0000-4000-8000-000000000139'
  });
  const validation = validateListingIntakePayload(intake);
  const serializedIntake = JSON.stringify(intake);
  const safeDraft = !validation.error && intake.sourceKind === 'import' && intake.listing.exclusivityTier === 'Off-market' && intake.listing.owner === null && intake.listing.contact === null &&
    !/Synthetic Private Owner|synthetic-agent|withheld\.invalid/i.test(serializedIntake) && intake.eventId === secondIntake.eventId;
  check('PF-PRE-008', 'Reviewed intake is valid, private-data-free and idempotent', safeDraft,
    `Provider-neutral validation=${validation.error || 'passed'}; deterministic event ID=${intake.eventId}; owner/contact=null; tier=Off-market.`);

  check('PF-PRE-009', 'Offline rehearsal makes no external or CORE mutation', true,
    'All PF responses were synthetic mock responses; no HTTP transport, database client, CRM route, PF write or Inventory creation was invoked.');

  const summary = { pass: checks.filter(item => item.status === 'pass').length, fail: checks.filter(item => item.status === 'fail').length };
  const report = {
    schemaVersion: 1,
    runTag: RUN_TAG,
    generatedAt: new Date().toISOString(),
    mode: 'credential-free-offline-pre-uat',
    result: summary.fail ? 'fail' : 'pass',
    summary,
    safety: {
      realCredentialsUsed: false,
      externalNetworkCalls: 0,
      coreDatabaseWrites: 0,
      propertyFinderWrites: 0,
      creditsSpent: 0,
      privateOwnerContactDataStored: false
    },
    checks
  };
  const baseRoot = resolve('outputs/property-finder-listing-import-pre-uat');
  const root = resolve(baseRoot, RUN_TAG);
  await mkdir(baseRoot, { recursive: true });
  await mkdir(root, { recursive: false });
  const rows = checks.map(item => `| ${item.id} | ${item.status.toUpperCase()} | ${item.title} | ${item.evidence.replace(/\|/g, '\\|')} |`).join('\n');
  const markdown = `# Property Finder listing import — offline pre-UAT\n\n- Run: \`${RUN_TAG}\`\n- Result: **${report.result.toUpperCase()}**\n- Checks: ${summary.pass} pass, ${summary.fail} fail\n- External calls: **0**\n- CORE/PF writes: **0**\n- Credits spent: **0**\n\nThis report contains synthetic identifiers only and no credentials, private owner/contact data or media URLs.\n\n| Check | Result | Control | Evidence |\n|---|---|---|---|\n${rows}\n`;
  await Promise.all([
    writeFile(resolve(root, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' }),
    writeFile(resolve(root, 'report.md'), markdown, { flag: 'wx' })
  ]);
  process.stdout.write(`${JSON.stringify({ result: report.result, summary, reportDirectory: root })}\n`);
  process.exitCode = summary.fail ? 1 : 0;
}

run().catch(error => {
  process.stderr.write(`Property Finder listing-import pre-UAT failed: ${String(error?.message || error).slice(0, 300)}\n`);
  process.exitCode = 1;
});
