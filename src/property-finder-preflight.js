import { createHash } from 'node:crypto';

export const PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION = 'property-finder-enterprise-api-1.0.1-dev.142';
export const PROPERTY_FINDER_PREFLIGHT_CONFIRMATION = 'PREFLIGHT_PROPERTY_FINDER_SANDBOX';
export const PROPERTY_FINDER_IMAGE_POLICY = Object.freeze({
  acceptedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  minBytes: 5 * 1024,
  maxBytes: 15 * 1024 * 1024,
  minWidth: 800,
  minHeight: 600,
  maxWidth: 1920,
  maxHeight: 1080,
  minAspectRatio: 1.3,
  maxAspectRatio: 1.8,
  maxCount: 30,
  urlLifetimeDays: 7,
  colourSpaces: Object.freeze(['rgb', 'srgb', 'adobe_rgb'])
});

const text = value => String(value ?? '').trim();
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

export function propertyFinderPayloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export function isExplicitlyTaggedTestInventory(listing = {}, suppliedTag = '') {
  const tag = text(suppliedTag);
  if (tag.length < 3) return false;
  return `${text(listing.inventoryReference)} ${text(listing.inventoryHeadline)}`.toLowerCase().includes(tag.toLowerCase());
}

export function propertyFinderMinimumImageCount(listing = {}, fields = {}) {
  const category = text(fields.propertyCategory).toLowerCase();
  const type = text(fields.propertyType).toLowerCase();
  if (category === 'residential') {
    const bedrooms = text(listing.bedrooms).toLowerCase();
    if (bedrooms === 'studio') return 4;
    const count = Number.parseInt(bedrooms, 10);
    if (count <= 1) return 5;
    if (count === 2) return 6;
    if (count === 3) return 8;
    return 10;
  }
  return ['compound', 'full-floor', 'half-floor', 'hotel-apartment', 'villa', 'whole-building', 'bulk-rent-unit', 'business-center'].includes(type) ? 10 : 5;
}

function normalizedSelections(selections = [], selectedMedia = [], listing = {}, fields = {}, now = new Date()) {
  const requiredCount = propertyFinderMinimumImageCount(listing, fields);
  if (!Array.isArray(selections) || selections.length < requiredCount) return { error: `Select at least ${requiredCount} approved Property Finder-quality images for this property` };
  if (selections.length > PROPERTY_FINDER_IMAGE_POLICY.maxCount) return { error: `No more than ${PROPERTY_FINDER_IMAGE_POLICY.maxCount} images can be selected for one Property Finder preflight` };
  const mediaById = new Map(selectedMedia.map(item => [text(item.id), item]));
  const seen = new Set();
  const seenHashes = new Set();
  const images = [];
  for (const selection of selections) {
    const id = text(selection?.propertyMediaId);
    if (!id || seen.has(id)) return { error: 'Each selected Inventory image must have one unique propertyMediaId' };
    seen.add(id);
    const media = mediaById.get(id);
    if (!media) return { error: 'Every selected image must belong to the explicitly selected Inventory' };
    if (media.approvalStatus !== 'approved' || media.usageRightsConfirmed !== true) return { error: 'Every selected image must be approved and rights-cleared' };
    if (media.rightsExpiresAt && new Date(media.rightsExpiresAt).getTime() <= now.getTime() + 7 * 86400000) return { error: 'Selected image rights must remain valid for at least seven days' };
    if (!PROPERTY_FINDER_IMAGE_POLICY.acceptedTypes.includes(media.mediaType)) return { error: 'Property Finder images must be JPEG, PNG or WebP' };
    const fileHash = text(media.fileHash);
    if (fileHash && seenHashes.has(fileHash)) return { error: 'Duplicate Property Finder images are not permitted' };
    if (fileHash) seenHashes.add(fileHash);
    const bytes = Number(media.fileSizeBytes);
    if (!Number.isFinite(bytes) || bytes < PROPERTY_FINDER_IMAGE_POLICY.minBytes || bytes > PROPERTY_FINDER_IMAGE_POLICY.maxBytes) return { error: 'Each Property Finder image must be between 5 KB and 15 MB' };
    let deliveryUrl;
    try { deliveryUrl = new URL(text(selection.deliveryUrl)); } catch { return { error: 'Every selected image requires a valid temporary HTTPS delivery URL' }; }
    if (deliveryUrl.protocol !== 'https:' || deliveryUrl.username || deliveryUrl.password || deliveryUrl.hash) return { error: 'Every selected image requires a credential-free HTTPS delivery URL' };
    const availableUntil = new Date(selection.availableUntil);
    if (Number.isNaN(availableUntil.getTime()) || availableUntil.getTime() < now.getTime() + PROPERTY_FINDER_IMAGE_POLICY.urlLifetimeDays * 86400000) return { error: 'Each temporary image URL must be confirmed available for at least seven days' };
    const width = Number(selection.width), height = Number(selection.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < PROPERTY_FINDER_IMAGE_POLICY.minWidth || height < PROPERTY_FINDER_IMAGE_POLICY.minHeight || width > PROPERTY_FINDER_IMAGE_POLICY.maxWidth || height > PROPERTY_FINDER_IMAGE_POLICY.maxHeight) return { error: 'Each image must be between 800 x 600 and 1920 x 1080 pixels' };
    const aspectRatio = width / height;
    if (aspectRatio < PROPERTY_FINDER_IMAGE_POLICY.minAspectRatio || aspectRatio > PROPERTY_FINDER_IMAGE_POLICY.maxAspectRatio) return { error: 'Each image aspect ratio must be between 1.3:1 and 1.8:1' };
    if (!PROPERTY_FINDER_IMAGE_POLICY.colourSpaces.includes(text(selection.colourSpace).toLowerCase())) return { error: 'Each image colour space must be RGB, sRGB or Adobe RGB; CMYK is not supported' };
    images.push({ propertyMediaId: id, original: { url: deliveryUrl.toString() } });
  }
  return { images, requiredCount };
}

export function buildPropertyFinderPreflight({ listing = {}, preparation = {}, permitEvidence = null, resolutions = {}, mediaSelections = [], selectedMedia = [], now = new Date(), rentFrequency = null, hasParkingSpace = null } = {}) {
  const fields = preparation.portalFields || {};
  const checks = [];
  const add = (code, label, passed, detail = null) => checks.push({ code, label, passed: Boolean(passed), detail });
  add('inventory_approved', 'Internal Inventory is approved', listing.workflowStatus === 'approved');
  add('inventory_verified', 'Inventory verification is current', ['verified', 'not_required'].includes(listing.verificationStatus));
  add('inventory_available', 'Inventory is currently Available', listing.status === 'Available');
  add('marketing_authority', 'Active internal marketing authority exists', Number(listing.marketingAgreementCount) > 0);
  add('immutable_preparation', 'The selected preparation is the current immutable revision', preparation.isCurrent === true);
  add('preparation_ready', 'The immutable internal preparation passed its saved readiness checks', preparation.readinessSnapshot?.ready === true);
  add('mapping_version', 'The exact PF payload mapping version is fixed', preparation.effectiveMappingVersionCode === PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION,
    preparation.mappingVersionCode ? `Preparation mapping ${preparation.mappingVersionCode}; payload mapping ${preparation.effectiveMappingVersionCode}` : `Code-locked payload mapping ${preparation.effectiveMappingVersionCode}`);
  add('public_profile', 'Selected PF public profile resolved', resolutions.publicProfile?.resolved === true);
  add('location', 'Manually selected PF location resolved', resolutions.location?.resolved === true);
  add('project', 'Optional PF project resolved or deliberately omitted', !resolutions.project?.requested || resolutions.project?.resolved === true);
  add('compliance', 'Dubai permit and company licence reconciled in PF sandbox', fields.uaeEmirate !== 'dubai' || resolutions.compliance?.matched === true);
  add('permit_evidence', 'Immutable internal permit evidence matches this preparation', preparation.permitMatched === true);
  add('size', 'Inventory size is a positive number', Number(listing.sizeSqft) > 0);
  add('content', 'Approved advertising title and description are present', Boolean(text(fields.publicationTitle) && text(fields.publicationDescription)));
  add('price', 'Approved portal price is a positive number', Number(fields.publicationPrice) > 0);
  add('bathrooms', 'Bathrooms are recorded unless the property is Land or Farm', ['land', 'farm'].includes(text(fields.propertyType)) || /^\d+$/.test(text(fields.bathrooms)));
  const media = normalizedSelections(mediaSelections, selectedMedia, listing, fields, now);
  add('media', 'Selected images meet Property Finder quality and delivery requirements', !media.error, media.error || `${media.images?.length || 0} image(s); minimum ${media.requiredCount}`);
  const type = text(fields.propertyType);
  const offeringType = text(fields.offeringType);
  if (offeringType === 'rent') add('rent_frequency', 'Rental frequency is explicitly selected', ['yearly', 'monthly', 'weekly', 'daily'].includes(text(rentFrequency)));
  if (type === 'co-working-space') add('parking', 'Parking availability is explicitly stated', typeof hasParkingSpace === 'boolean');

  const ready = checks.every(check => check.passed);
  if (!ready) return { ready: false, checks, blockers: checks.filter(check => !check.passed).map(check => check.label), payload: null, payloadHash: null, mappingVersion: PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION };

  const priceType = offeringType === 'sale' ? 'sale' : text(rentFrequency);
  const payload = {
    assignedTo: { id: resolutions.publicProfile.id },
    bathrooms: ['land', 'farm'].includes(type) ? undefined : Number(fields.bathrooms),
    category: fields.propertyCategory,
    compliance: ['dubai', 'abu_dhabi'].includes(fields.uaeEmirate) ? { listingAdvertisementNumber: permitEvidence.permitNumber, type: fields.complianceType } : undefined,
    createdBy: { id: resolutions.publicProfile.id },
    description: { en: fields.publicationDescription },
    downPayment: offeringType === 'sale' ? Number(fields.downPayment) : undefined,
    furnishingType: fields.furnishingType,
    hasParkingSpace: type === 'co-working-space' ? hasParkingSpace : undefined,
    location: { id: resolutions.location.id },
    media: {
      images: media.images.map(image => ({ original: image.original })),
      videos: fields.videoUrl || fields.virtualTourUrl ? {
        default: fields.videoUrl || undefined,
        view360: fields.virtualTourUrl || undefined
      } : undefined
    },
    price: { amounts: { [priceType]: Number(fields.publicationPrice) }, type: priceType },
    project: resolutions.project?.requested ? { id: resolutions.project.id } : undefined,
    reference: `${listing.inventoryReference}-PF-R${preparation.revisionNumber}`,
    size: Number(listing.sizeSqft),
    title: { en: fields.publicationTitle },
    type,
    uaeEmirate: fields.uaeEmirate
  };
  if (listing.bedrooms && /^\d+$/.test(text(listing.bedrooms))) payload.bedrooms = Number(listing.bedrooms);
  const exactPayload = JSON.parse(JSON.stringify(payload));
  const payloadHash = propertyFinderPayloadHash({ mappingVersion: PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION, payload: exactPayload });
  return {
    ready: true,
    checks,
    blockers: [],
    mappingVersion: PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION,
    payload: exactPayload,
    payloadHash,
    mediaBindings: media.images.map(image => ({ propertyMediaId: image.propertyMediaId, transmittedAs: 'media.images[].original.url' }))
  };
}

export function businessReadablePropertyFinderPreview({ listing = {}, preparation = {}, preflight = {}, resolutions = {} } = {}) {
  return {
    outcome: preflight.ready ? 'READY FOR REVIEW — NO LISTING WAS SENT' : 'BLOCKED — NO LISTING WAS SENT',
    inventory: listing.inventoryReference || 'Unreferenced test Inventory',
    preparationRevision: preparation.revisionNumber || null,
    destination: 'Property Finder Enterprise API sandbox only',
    publicProfile: resolutions.publicProfile?.resolved ? 'Selected public profile resolved' : 'Public profile unresolved',
    location: resolutions.location?.resolved ? 'Manually selected location resolved' : 'Location unresolved',
    project: resolutions.project?.requested ? (resolutions.project.resolved ? 'Optional project resolved' : 'Project unresolved') : 'No project selected',
    compliance: resolutions.compliance?.matched ? 'Dubai permit/compliance matched' : 'Compliance not matched or not required',
    media: preflight.ready ? `${preflight.payload.media.images.length} approved image(s) ready` : 'Media or another governance check is incomplete',
    payloadMappingVersion: preflight.mappingVersion,
    deterministicPayloadHash: preflight.payloadHash,
    blockers: preflight.blockers,
    externalReadsPerformed: true,
    externalWritesPerformed: false,
    publicationPerformed: false,
    creditsSpent: 0
  };
}
