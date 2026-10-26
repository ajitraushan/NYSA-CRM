import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('dev.139 listing-import pre-UAT is credential-free, offline and evidence-producing', () => {
  const script = read('scripts/property-finder-listing-import-pre-uat.js');
  const pkg = JSON.parse(read('package.json'));
  for (const marker of [
    'credential-free-offline-pre-uat', 'PROPERTY_FINDER_ALLOW_READS', 'listing_read_scope_missing',
    'normalizePropertyFinderListingForImport', 'propertyFinderListingImportPreview',
    'signPropertyFinderListingReview', 'verifyPropertyFinderListingReview',
    'isTaggedPropertyFinderTestListing', 'buildPropertyFinderDraftIntake', 'validateListingIntakePayload',
    'externalNetworkCalls: 0', 'coreDatabaseWrites: 0', 'propertyFinderWrites: 0', 'creditsSpent: 0',
    "writeFile(resolve(root, 'report.json')", "writeFile(resolve(root, 'report.md')", "flag: 'wx'"
  ]) assert.ok(script.includes(marker), marker);
  assert.doesNotMatch(script, /process\.env\.PROPERTY_FINDER_SANDBOX_API_(KEY|SECRET)/);
  assert.doesNotMatch(script, /fetch\(['\"]https?:\/\//);
  assert.equal(pkg.scripts['uat:property-finder:listing-import:pre'], 'node scripts/property-finder-listing-import-pre-uat.js');
});
