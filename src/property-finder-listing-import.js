import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION = 'property-finder-enterprise-api-1.0.1-dev.139';
export const PROPERTY_FINDER_LISTING_DISCOVERY_CONFIRMATION = 'DISCOVER_PROPERTY_FINDER_SANDBOX_LISTINGS';
export const PROPERTY_FINDER_LISTING_IMPORT_CONFIRMATION = 'IMPORT_PROPERTY_FINDER_SANDBOX_LISTING_AS_DRAFT';
export const PROPERTY_FINDER_LOCATION_SEARCH_CONFIRMATION = 'SEARCH_PROPERTY_FINDER_SANDBOX_LOCATIONS';

const text = value => String(value ?? '').trim();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = value => {
  const parsed = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const safeText = (value, max = 250) => text(value)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact withheld]')
  .replace(/(?:\+?971|0)[\s()-]*\d(?:[\s()-]*\d){7,9}/g, '[contact withheld]')
  .slice(0, max);

const propertyTypeMap = Object.freeze({
  apartment: 'Apartment', villa: 'Villa', townhouse: 'Townhouse', penthouse: 'Penthouse', duplex: 'Duplex', land: 'Plot', plot: 'Plot'
});

function listingPrice(item) {
  const price = object(item.price), amounts = object(price.amounts);
  return number(amounts[price.type] ?? amounts.sale ?? amounts.yearly ?? amounts.monthly ?? item.priceAmount ?? (typeof item.price === 'number' ? item.price : null));
}

function bedrooms(value, propertyType) {
  if (propertyType === 'Plot') return null;
  const normalized = text(value).toLowerCase();
  if (normalized === 'studio' || normalized === '0') return 'Studio';
  const count = Number(normalized);
  if (Number.isFinite(count) && count >= 5) return '5+';
  if ([1, 2, 3, 4].includes(count)) return String(count);
  return null;
}

export function normalizePropertyFinderListingForImport(item = {}) {
  const externalRecordId = text(item.id ?? item.listingId ?? item.listing_id).slice(0, 160);
  const reference = safeText(item.reference ?? item.externalReference ?? item.external_reference, 160);
  const titleObject = object(item.title), projectObject = object(item.project), locationObject = object(item.location);
  const title = safeText(titleObject.en ?? item.titleEn ?? (typeof item.title === 'string' ? item.title : ''), 250);
  const project = safeText(projectObject.name ?? item.projectName ?? item.project_name ?? locationObject.projectName, 250);
  const pfType = text(item.type ?? item.propertyType ?? item.property_type).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  const propertyType = propertyTypeMap[pfType] || null;
  const sizeSqft = number(item.size ?? item.sizeSqft ?? item.size_sqft);
  const price = listingPrice(item);
  const currency = text(item.currency ?? object(item.price).currency).toUpperCase();
  const status = safeText(item.status ?? item.state, 80).toLowerCase();
  const locationId = text(locationObject.id ?? item.locationId ?? item.location_id).slice(0, 160);
  const locationLabel = safeText(locationObject.name ?? locationObject.path ?? item.locationName ?? item.location_name, 250);
  const mappedBedrooms = bedrooms(item.bedrooms, propertyType);
  const blockers = [];
  if (!externalRecordId) blockers.push({ code: 'missing_pf_listing_id', label: 'Property Finder listing ID is missing' });
  if (!reference) blockers.push({ code: 'missing_reference', label: 'Property Finder reference is missing' });
  if (!project) blockers.push({ code: 'missing_project', label: 'Project requires manual confirmation' });
  if (!propertyType) blockers.push({ code: 'unmapped_property_type', label: `Property type ${pfType || 'missing'} requires governed mapping` });
  if (propertyType !== 'Plot' && !mappedBedrooms) blockers.push({ code: 'unmapped_bedrooms', label: 'Bedrooms require governed mapping' });
  if (!(sizeSqft > 0)) blockers.push({ code: 'missing_size', label: 'Positive property size is missing' });
  if (!(price > 0)) blockers.push({ code: 'missing_price', label: 'Positive asking price is missing' });
  if (!/^[A-Z]{3}$/.test(currency)) blockers.push({ code: 'missing_currency', label: 'Three-letter currency is missing' });
  if (!locationId) blockers.push({ code: 'missing_pf_location', label: 'Property Finder location identity is missing' });
  return {
    provider: 'property_finder',
    externalRecordId,
    reference,
    title,
    project,
    propertyType,
    bedrooms: mappedBedrooms,
    sizeSqft,
    price,
    currency,
    status,
    location: { id: locationId, label: locationLabel },
    mediaCount: Array.isArray(object(item.media).images) ? object(item.media).images.length : Number(item.mediaCount || 0),
    blockers,
    ownerContactDetailsReturned: false,
    mediaUrlsReturned: false
  };
}

export function propertyFinderListingImportPreview(listing = {}, matches = {}) {
  const linked = matches.linked || null, possibleReferenceMatch = matches.possibleReferenceMatch || null;
  const blockers = [...(listing.blockers || [])];
  if (linked) blockers.push({ code: 'already_linked', label: 'This PF listing is already linked to Internal Inventory and must be reconciled instead of imported' });
  if (!linked && possibleReferenceMatch) blockers.push({ code: 'possible_duplicate', label: 'A CORE Inventory reference may already represent this PF listing; review before import' });
  const comparable = linked ? [
    ['project', 'Project', linked.project, listing.project],
    ['propertyType', 'Property type', linked.propertyType, listing.propertyType],
    ['bedrooms', 'Bedrooms', linked.bedrooms, listing.bedrooms],
    ['sizeSqft', 'Size sqft', Number(linked.sizeSqft || 0), Number(listing.sizeSqft || 0)],
    ['price', 'Asking price', Number(linked.price || 0), Number(listing.price || 0)],
    ['currency', 'Currency', linked.currency, listing.currency],
    ['community', 'Location label', linked.community, listing.location?.label]
  ] : [];
  const changes = comparable.filter(([, , coreValue, pfValue]) => String(coreValue ?? '').trim().toLowerCase() !== String(pfValue ?? '').trim().toLowerCase())
    .map(([field, label, coreValue, pfValue]) => ({ field, label, coreValue: coreValue ?? null, propertyFinderValue: pfValue ?? null, decisionRequired: true }));
  const snapshotHash = createHash('sha256').update(JSON.stringify(listing)).digest('hex');
  return {
    ...listing,
    match: linked ? { kind: 'linked', inventoryId: linked.id, inventoryReference: linked.inventoryReference }
      : possibleReferenceMatch ? { kind: 'possible_duplicate', inventoryId: possibleReferenceMatch.id, inventoryReference: possibleReferenceMatch.inventoryReference }
        : { kind: 'unmatched', inventoryId: null, inventoryReference: null },
    blockers,
    reconciliation: linked ? { propertyFinderSnapshotHash: snapshotHash, changed: changes.length > 0, changes, effect: 'Read-only comparison; neither CORE nor Property Finder is changed' } : null,
    draftImportEligible: !linked && !possibleReferenceMatch,
    importEffect: 'Creates one blocked Internal Inventory Draft; never overwrites, verifies, activates or publishes'
  };
}

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || '')), b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
};

export function signPropertyFinderListingReview(listing, secret, { now = Date.now(), ttlMs = 10 * 60 * 1000 } = {}) {
  if (text(secret).length < 32) return null;
  const payload = encode({ version: 1, issuedAt: now, expiresAt: now + ttlMs, mappingVersion: PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION, listing });
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPropertyFinderListingReview(token, secret, { now = Date.now() } = {}) {
  if (text(secret).length < 32) return { error: 'Property Finder Draft import review signing is not configured', code: 'review_not_configured' };
  const [payload, signature, extra] = text(token).split('.');
  if (!payload || !signature || extra) return { error: 'Listing import review token is invalid', code: 'invalid_review_token' };
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return { error: 'Listing import review token is invalid', code: 'invalid_review_token' };
  let value;
  try { value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { error: 'Listing import review token is invalid', code: 'invalid_review_token' }; }
  if (value.version !== 1 || value.mappingVersion !== PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION || !value.listing?.externalRecordId) return { error: 'Listing import review token has an unsupported contract', code: 'invalid_review_token' };
  if (!Number.isFinite(value.expiresAt) || value.expiresAt < now) return { error: 'Listing import review has expired; discover the PF listings again', code: 'expired_review_token' };
  return { value };
}

export function buildPropertyFinderDraftIntake(listing = {}, overrides = {}) {
  const source = { ...listing, ...overrides };
  const eventFingerprint = createHash('sha256').update(`${listing.externalRecordId}:${PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION}`).digest('hex').slice(0, 24);
  return {
    eventId: `pf-sandbox-listing-import-${eventFingerprint}`,
    provider: 'property_finder',
    externalRecordId: listing.externalRecordId,
    mappingVersion: PROPERTY_FINDER_LISTING_IMPORT_MAPPING_VERSION,
    sourceKind: 'import',
    listing: {
      inventoryHeadline: source.inventoryHeadline || listing.title || listing.reference || listing.project,
      project: source.project,
      developer: source.developer || null,
      areaCode: source.areaCode,
      community: source.community || listing.location?.label || null,
      propertyType: source.propertyType,
      bedrooms: source.propertyType === 'Plot' ? null : source.bedrooms,
      sizeSqft: source.sizeSqft,
      price: source.price,
      referencePrice: null,
      currency: source.currency,
      handoverStatus: source.handoverStatus || 'to_be_confirmed',
      handoverExpectedDate: source.handoverExpectedDate || null,
      exclusivityTier: 'Off-market',
      originatingAgentId: source.originatingAgentId || null,
      responsibleAgentId: source.responsibleAgentId || null,
      contact: null,
      owner: null,
      notes: `Imported as Draft from Property Finder sandbox reference ${listing.reference}; PF media and owner/contact data were not imported.`
    }
  };
}

export function isTaggedPropertyFinderTestListing(listing = {}, tag = '') {
  const expected = text(tag);
  return expected.length >= 3 && `${listing.reference || ''} ${listing.title || ''} ${listing.project || ''}`.toLowerCase().includes(expected.toLowerCase());
}
