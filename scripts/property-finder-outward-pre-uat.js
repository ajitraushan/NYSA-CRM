#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  buildPropertyFinderPreflight,
  businessReadablePropertyFinderPreview,
  isExplicitlyTaggedTestInventory
} from '../src/property-finder-preflight.js';
import { createPropertyFinderSandboxClient, propertyFinderSandboxStatus, PROPERTY_FINDER_SANDBOX_ORIGIN } from '../src/property-finder-sandbox.js';

const CLOCK = Date.parse('2026-08-05T12:00:00.000Z');
const RUN_TAG = `PF-OUTWARD-PRE-UAT-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${process.pid}`;
const checks = [];
const check = (id, title, passed, evidence) => checks.push({ id, title, status: passed ? 'pass' : 'fail', evidence });
const env = (overrides = {}) => ({
  NYSA_DEPLOYMENT_ENV: 'crm_test', PROPERTY_FINDER_ENVIRONMENT: 'sandbox', PROPERTY_FINDER_API_BASE_URL: PROPERTY_FINDER_SANDBOX_ORIGIN,
  PROPERTY_FINDER_SANDBOX_API_KEY: 'k'.repeat(40), PROPERTY_FINDER_SANDBOX_API_SECRET: 's'.repeat(32),
  PROPERTY_FINDER_SANDBOX_EXPIRES_AT: '2026-09-03T11:25:00.000Z',
  PROPERTY_FINDER_API_SCOPES: 'users:read,listings:full_access,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access',
  PROPERTY_FINDER_TIMEOUT_MS: '15000', PROPERTY_FINDER_REQUESTS_PER_MINUTE: '60', PROPERTY_FINDER_SANDBOX_ENABLED: '1',
  PROPERTY_FINDER_ALLOW_READS: '1', PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS: '0', ...overrides
});
const listing = () => ({ inventoryReference: 'R3B-UAT-OUTWARD-NYSA-INV-1', inventoryHeadline: 'R3B UAT outward Dubai test', workflowStatus: 'approved', verificationStatus: 'verified', status: 'Available', marketingAgreementCount: 1, propertyType: 'Apartment', bedrooms: '2', sizeSqft: 1600 });
const preparation = () => ({ revisionNumber: 3, isCurrent: true, readinessSnapshot: { ready: true }, mappingVersionCode: 'pf-1.0.1', permitMatched: true, portalFields: {
  publicationTitle: 'Sea-facing two-bedroom apartment', publicationDescription: 'Accurate approved advertising copy. '.repeat(25), offeringType: 'sale', uaeEmirate: 'dubai', propertyCategory: 'residential', furnishingType: 'furnished', bathrooms: '2', publicationPrice: 2500000, downPayment: 500000, propertyType: 'apartment', complianceType: 'rera', videoUrl:'https://www.youtube.com/watch?v=syntheticPF140'
} });
const permitEvidence = { permitNumber: 'SYNTHETIC-PERMIT-001' };
const mediaSelections = Array.from({length:6},(_,index)=>({ propertyMediaId:`00000000-0000-4000-8000-${String(140+index).padStart(12,'0')}`, deliveryUrl:`https://media.example.invalid/synthetic-test-image-${index+1}.jpg`, availableUntil:'2026-08-20T12:00:00.000Z', width:1920, height:1080, colourSpace:'sRGB' }));
const selectedMedia = mediaSelections.map((selection,index)=>({ id:selection.propertyMediaId, approvalStatus:'approved', usageRightsConfirmed:true, rightsExpiresAt:'2026-08-25T00:00:00.000Z', mediaType:'image/jpeg', fileSizeBytes:500000, fileHash:String(index+1).padStart(64,'0') }));

async function run() {
  const disabled = propertyFinderSandboxStatus(env({ PROPERTY_FINDER_ALLOW_READS: '0' }), new Date(CLOCK));
  check('PF-OUT-001', 'Outward reads remain independently default-off', disabled.networkReady === false,
    'PROPERTY_FINDER_ALLOW_READS=0 returned networkReady=false while the separate import switch remained 0.');

  const calls = [];
  const client = createPropertyFinderSandboxClient({ env: env(), now: () => CLOCK, fetchImpl: async (url, options) => {
    calls.push({ path: new URL(url).pathname, method: options.method });
    if (url.endsWith('/v1/auth/token')) return new Response(JSON.stringify({ accessToken: 'offline-outward-token-placeholder', expiresIn: 1800 }), { status: 200 });
    if (url.includes('/v1/users?')) return new Response(JSON.stringify({ data: [{ id: 'pf-profile-1', email: 'withheld@example.invalid' }] }), { status: 200 });
    if (url.includes('/v1/locations?')) return new Response(JSON.stringify({ data: [{ id: 'pf-location-1', name: 'Synthetic Dubai location' }] }), { status: 200 });
    if (url.endsWith('/v1/projects/pf-project-1')) return new Response(JSON.stringify({ data: { id: 'pf-project-1', owner: 'withheld' } }), { status: 200 });
    if (url.includes('/v1/compliances/SYNTHETIC-PERMIT-001/SYNTHETIC-LICENCE-001?permitType=property')) return new Response(JSON.stringify({ data: { status: 'valid', contact: 'withheld' } }), { status: 200 });
    throw new Error('Offline harness refused an unexpected PF path');
  } });
  const resolutions = await client.resolvePreflightReferences({ publicProfileId: 'pf-profile-1', locationId: 'pf-location-1', locationQuery: 'Synthetic Dubai location', projectId: 'pf-project-1', permitNumber: 'SYNTHETIC-PERMIT-001', licenseNumber: 'SYNTHETIC-LICENCE-001', permitType:'property' });
  const expectedPaths = ['/v1/auth/token', '/v1/users', '/v1/locations', '/v1/projects/pf-project-1', '/v1/compliances/SYNTHETIC-PERMIT-001/SYNTHETIC-LICENCE-001'];
  check('PF-OUT-002', 'Only the approved resolution reads are rehearsed', JSON.stringify(calls.map(item => item.path)) === JSON.stringify(expectedPaths) && calls.slice(1).every(item => item.method === 'GET'),
    'Synthetic token exchange was followed only by users, locations, selected project and selected compliance GETs.');
  check('PF-OUT-003', 'PF resolution details are privacy-minimized', resolutions.publicProfile.detailsReturned === false && resolutions.location.detailsReturned === false && !/withheld|example\.invalid/.test(JSON.stringify(resolutions)),
    'Only selected IDs and resolution booleans were retained; user, owner and contact details were absent.');
  check('PF-OUT-004', 'Only visibly tagged Inventory qualifies', isExplicitlyTaggedTestInventory(listing(), 'R3B-UAT-OUTWARD') && !isExplicitlyTaggedTestInventory(listing(), 'ordinary'),
    'Synthetic visible UAT tag accepted and unrelated tag rejected.');

  const input = { listing: listing(), preparation: preparation(), permitEvidence, resolutions, mediaSelections, selectedMedia, now: new Date(CLOCK) };
  const first = buildPropertyFinderPreflight(input), second = buildPropertyFinderPreflight(input);
  check('PF-OUT-005', 'Governed outward payload is ready only after every check', first.ready === true && first.checks.every(item => item.passed) && Boolean(first.payload),
    `${first.checks.length} governed readiness checks passed and one in-memory payload was constructed.`);
  check('PF-OUT-006', 'Exact payload and mapping hash are deterministic', first.payloadHash === second.payloadHash && /^[a-f0-9]{64}$/.test(first.payloadHash),
    `Repeated construction produced SHA-256 ${first.payloadHash}.`);
  check('PF-OUT-007', 'Exact PF mapping binds selected identities, permit, quality media and optional video', first.payload.assignedTo.id === 'pf-profile-1' && first.payload.location.id === 'pf-location-1' && first.payload.project.id === 'pf-project-1' && first.payload.compliance.listingAdvertisementNumber === permitEvidence.permitNumber && first.payload.media.images.length === 6 && first.payload.media.videos.default.includes('youtube.com'),
    `Reference=${first.payload.reference}; profile/location/project/compliance resolved; six quality-ready images and one optional YouTube link bound.`);

  const blocked = buildPropertyFinderPreflight({ ...input, preparation: { ...preparation(), isCurrent: false }, resolutions: { ...resolutions, location: { id: 'pf-location-1', resolved: false } } });
  check('PF-OUT-008', 'A stale or unresolved preparation constructs no payload', blocked.ready === false && blocked.payload === null && blocked.payloadHash === null && blocked.blockers.length >= 2,
    `Blocked with ${blocked.blockers.length} business-readable reason(s); payload and hash remained null.`);
  const preview = businessReadablePropertyFinderPreview({ listing: listing(), preparation: preparation(), preflight: first, resolutions });
  check('PF-OUT-009', 'Outward rehearsal remains no-send and credit-free', preview.externalWritesPerformed === false && preview.publicationPerformed === false && preview.creditsSpent === 0 && /NO LISTING WAS SENT/.test(preview.outcome),
    'External writes=false; publication=false; credits=0; no database or portal mutation client was invoked.');

  const summary = { pass: checks.filter(item => item.status === 'pass').length, fail: checks.filter(item => item.status === 'fail').length };
  const report = { schemaVersion: 1, runTag: RUN_TAG, generatedAt: new Date().toISOString(), mode: 'credential-free-outward-pre-uat', result: summary.fail ? 'fail' : 'pass', summary,
    safety: { realCredentialsUsed: false, externalNetworkCalls: 0, coreDatabaseWrites: 0, propertyFinderWrites: 0, publicationPerformed: false, creditsSpent: 0, privateOwnerContactDataStored: false }, checks };
  const baseRoot = resolve('outputs/property-finder-outward-pre-uat'), root = resolve(baseRoot, RUN_TAG);
  await mkdir(baseRoot, { recursive: true }); await mkdir(root, { recursive: false });
  const rows = checks.map(item => `| ${item.id} | ${item.status.toUpperCase()} | ${item.title} | ${item.evidence.replace(/\|/g, '\\|')} |`).join('\n');
  const markdown = `# Property Finder outward listing — offline pre-UAT\n\n- Run: \`${RUN_TAG}\`\n- Result: **${report.result.toUpperCase()}**\n- Checks: ${summary.pass} pass, ${summary.fail} fail\n- External calls: **0**\n- CORE/PF writes: **0**\n- Publication: **false**\n- Credits spent: **0**\n\nSynthetic evidence only; no credentials, private owner/contact data, permit response body or live media URL is stored.\n\n| Check | Result | Control | Evidence |\n|---|---|---|---|\n${rows}\n`;
  await Promise.all([writeFile(resolve(root, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' }), writeFile(resolve(root, 'report.md'), markdown, { flag: 'wx' })]);
  process.stdout.write(`${JSON.stringify({ result: report.result, summary, reportDirectory: root })}\n`); process.exitCode = summary.fail ? 1 : 0;
}

run().catch(error => { process.stderr.write(`Property Finder outward pre-UAT failed: ${String(error?.message || error).slice(0, 300)}\n`); process.exitCode = 1; });
