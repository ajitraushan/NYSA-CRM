import { createHash } from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { audit, many, one, transaction, uuid } from '../db.js';
import { createPropertyFinderListingImportClient, createPropertyFinderSandboxClient, PropertyFinderSandboxError } from '../property-finder-sandbox.js';
import { portalPermitReconciliation } from '../portal-publication-domain.js';
import { validateListingIntakePayload } from '../listing-intake-domain.js';
import { readPrivate } from '../private-files.js';
import { createPropertyFinderMediaDelivery, inspectPropertyFinderImage, propertyFinderMediaDeliveryStatus, PROPERTY_FINDER_MEDIA_DELIVERY_CONFIRMATION } from '../property-finder-media-delivery.js';
import { processEventWithClient } from './listing-intake.js';
import {
  buildPropertyFinderDraftIntake,
  isTaggedPropertyFinderTestListing,
  normalizePropertyFinderListingForImport,
  propertyFinderListingImportPreview,
  signPropertyFinderListingReview,
  verifyPropertyFinderListingReview,
  PROPERTY_FINDER_LISTING_DISCOVERY_CONFIRMATION,
  PROPERTY_FINDER_LISTING_IMPORT_CONFIRMATION,
  PROPERTY_FINDER_LOCATION_SEARCH_CONFIRMATION
} from '../property-finder-listing-import.js';
import {
  buildPropertyFinderPreflight,
  businessReadablePropertyFinderPreview,
  isExplicitlyTaggedTestInventory,
  PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION,
  PROPERTY_FINDER_PREFLIGHT_CONFIRMATION
} from '../property-finder-preflight.js';

const r = Router();
const client = createPropertyFinderSandboxClient();
const listingImportClient = createPropertyFinderListingImportClient();
const isFullAdmin = req => req.broker.role === 'admin' && req.broker.jobRole === 'admin';
const requireFullAdmin = (req, res, next) => isFullAdmin(req)
  ? next()
  : res.status(403).json({ error: 'Full Administrator access is required' });

r.use(requireAuth, requireFullAdmin);

r.get('/integrations/property-finder/sandbox/status', (req, res) => {
  const status = client.status(), listingImport = listingImportClient.status();
  res.json({
    ...status,
    listingImportReadReady: listingImport.listingImportReadReady,
    listingReadScopeConfigured: listingImport.listingReadScopeConfigured,
    leadReadScopeConfigured: listingImport.leadReadScopeConfigured,
    listingImportCredentialConfigured: listingImport.configured,
    listingImportExpiresAt: listingImport.expiresAt,
    listingImportMissingScopes: listingImport.missingScopes,
    mediaDelivery: propertyFinderMediaDeliveryStatus()
  });
});

r.post('/integrations/property-finder/sandbox/public-profiles', async (req, res) => {
  if (req.body?.confirmation !== 'LIST_PROPERTY_FINDER_SANDBOX_PUBLIC_PROFILES') return res.status(400).json({ error: 'Exact PF public-profile read confirmation is required', requiredConfirmation: 'LIST_PROPERTY_FINDER_SANDBOX_PUBLIC_PROFILES' });
  try {
    const result = await client.listPublicProfiles();
    await audit('Broker', req.broker.id, 'property_finder_sandbox_public_profiles_listed', req.broker.id, { returnedCount: result.profiles.length, detailsReturned: false, externalReadsPerformed: true, externalWritesPerformed: false });
    return res.json(result);
  } catch (error) {
    if (!(error instanceof PropertyFinderSandboxError)) throw error;
    return res.status(error.httpStatus).json({ error: error.message, code: error.code, upstreamStatus: error.upstreamStatus, diagnosticEvidence: error.diagnosticEvidence });
  }
});

r.post('/integrations/property-finder/sandbox/media/prepare', async (req, res) => {
  if (req.body?.confirmation !== PROPERTY_FINDER_MEDIA_DELIVERY_CONFIRMATION) return res.status(400).json({ error: 'Exact CRM-Test PF media preparation confirmation is required', requiredConfirmation: PROPERTY_FINDER_MEDIA_DELIVERY_CONFIRMATION });
  const listingId = String(req.body?.listingId || ''), mediaIds = Array.isArray(req.body?.mediaIds) ? req.body.mediaIds.map(String) : [];
  if (!uuidPattern.test(listingId) || !mediaIds.length || mediaIds.length > 30 || mediaIds.some(id => !uuidPattern.test(id)) || new Set(mediaIds).size !== mediaIds.length) return res.status(400).json({ error: 'Select 1 to 30 unique media UUIDs from one explicit Inventory' });
  const rows = await many(`SELECT id,listing_id,approval_status,usage_rights_confirmed,rights_expires_at,media_type,file_size_bytes,file_hash,storage_key
    FROM property_media WHERE listing_id=$1 AND id=ANY($2::uuid[])`, [listingId, mediaIds]);
  if (rows.length !== mediaIds.length) return res.status(409).json({ error: 'Every selected image must belong to the explicitly selected Inventory' });
  const now = new Date(), prepared = [];
  for (const media of rows) {
    if (media.approvalStatus !== 'approved' || media.usageRightsConfirmed !== true || (media.rightsExpiresAt && new Date(media.rightsExpiresAt).getTime() < now.getTime() + 8 * 86400000)) { prepared.push({ propertyMediaId: media.id, eligible: false, blocker: 'Approval or media-use rights do not remain valid through the delivery window' }); continue; }
    const inspection = inspectPropertyFinderImage(await readPrivate(media.storageKey), media.mediaType);
    if (!inspection.eligible) { prepared.push({ propertyMediaId: media.id, ...inspection }); continue; }
    const delivery = createPropertyFinderMediaDelivery({ media, now });
    if (delivery.error) return res.status(503).json({ error: delivery.error, code: 'media_delivery_not_configured' });
    prepared.push({ propertyMediaId: media.id, ...inspection, ...delivery });
  }
  await audit('Listing', listingId, 'property_finder_sandbox_media_delivery_prepared', req.broker.id, { selectedCount: mediaIds.length, eligibleCount: prepared.filter(item => item.eligible).length, externalReadsPerformed: false, externalWritesPerformed: false, publicationPerformed: false });
  return res.json({ mediaSelections: prepared, externalReadsPerformed: false, externalWritesPerformed: false, publicationPerformed: false, creditsSpent: 0 });
});

r.post('/integrations/property-finder/sandbox/verify', async (req, res) => {
  if (req.body?.confirmation !== 'VERIFY_PROPERTY_FINDER_SANDBOX') {
    return res.status(400).json({
      error: 'Exact CRM-Test sandbox verification confirmation is required',
      requiredConfirmation: 'VERIFY_PROPERTY_FINDER_SANDBOX'
    });
  }
  try {
    const result = await client.verifySafeReads();
    await audit('Broker', req.broker.id, 'property_finder_sandbox_safe_reads_verified', req.broker.id, {
      provider: result.provider,
      environment: result.environment,
      creditsReadable: result.credits.readable,
      usersReadable: result.users.readable,
      externalWritesPerformed: false,
      publicationPerformed: false
    });
    return res.json(result);
  } catch (error) {
    if (!(error instanceof PropertyFinderSandboxError)) throw error;
    return res.status(error.httpStatus).json({
      error: error.message,
      code: error.code,
      upstreamStatus: error.upstreamStatus,
      diagnosticEvidence: error.diagnosticEvidence
    });
  }
});

r.post('/integrations/property-finder/sandbox/listing-import/discover', async (req, res) => {
  if (req.body?.confirmation !== PROPERTY_FINDER_LISTING_DISCOVERY_CONFIRMATION) {
    return res.status(400).json({
      error: 'Exact CRM-Test PF listing-discovery confirmation is required',
      requiredConfirmation: PROPERTY_FINDER_LISTING_DISCOVERY_CONFIRMATION
    });
  }
  const page = Math.max(1, Math.min(10000, Number(req.body?.page) || 1));
  const perPage = Math.max(1, Math.min(100, Number(req.body?.perPage) || 50));
  try {
    const result = await listingImportClient.discoverListings({ page, perPage });
    const normalized = result.listings.map(normalizePropertyFinderListingForImport);
    const externalIds = normalized.map(item => item.externalRecordId).filter(Boolean);
    const references = normalized.map(item => item.reference).filter(Boolean);
    const existing = externalIds.length || references.length ? await many(`SELECT id,inventory_reference,source_provider,external_record_id,
      project,community,property_type,bedrooms,size_sqft,price,currency
      FROM listings WHERE deleted_at IS NULL AND ((source_provider='property_finder' AND external_record_id=ANY($1::text[]))
        OR inventory_reference=ANY($2::text[]))`, [externalIds, references]) : [];
    const signingSecret = process.env.PROPERTY_FINDER_IMPORT_REVIEW_SECRET || '';
    const listings = normalized.map(item => {
      const linked = existing.find(row => row.sourceProvider === 'property_finder' && row.externalRecordId === item.externalRecordId);
      const possibleReferenceMatch = existing.find(row => row.inventoryReference === item.reference && row.id !== linked?.id);
      const preview = propertyFinderListingImportPreview(item, { linked, possibleReferenceMatch });
      return {
        ...preview,
        reviewToken: preview.draftImportEligible ? signPropertyFinderListingReview(item, signingSecret) : null
      };
    });
    await audit('Broker', req.broker.id, 'property_finder_sandbox_listings_discovered', req.broker.id, {
      page,
      perPage,
      returnedCount: listings.length,
      linkedCount: listings.filter(item => item.match.kind === 'linked').length,
      possibleDuplicateCount: listings.filter(item => item.match.kind === 'possible_duplicate').length,
      linkedChangeCount: listings.filter(item => item.reconciliation?.changed).length,
      externalReadsPerformed: true,
      externalWritesPerformed: false,
      ordinaryRecordsChanged: false,
      creditsSpent: 0
    });
    return res.json({
      listings,
      pagination: result.pagination,
      draftImportCommitReady: signingSecret.length >= 32,
      importEffect: 'Explicit selection creates only a blocked Internal Inventory Draft',
      externalWritesPerformed: false,
      publicationPerformed: false,
      creditsSpent: 0
    });
  } catch (error) {
    if (!(error instanceof PropertyFinderSandboxError)) throw error;
    return res.status(error.httpStatus).json({ error: error.message, code: error.code, upstreamStatus: error.upstreamStatus, diagnosticEvidence: error.diagnosticEvidence });
  }
});

r.post('/integrations/property-finder/sandbox/locations/search', async (req, res) => {
  if (req.body?.confirmation !== PROPERTY_FINDER_LOCATION_SEARCH_CONFIRMATION) return res.status(400).json({
    error: 'Exact CRM-Test PF location-search confirmation is required', requiredConfirmation: PROPERTY_FINDER_LOCATION_SEARCH_CONFIRMATION
  });
  try {
    const result = await client.searchLocations({ query: req.body?.query, parent: req.body?.parent || null });
    await audit('Broker', req.broker.id, 'property_finder_sandbox_locations_searched', req.broker.id, {
      queryHash: createHash('sha256').update(String(result.query)).digest('hex'), returnedCount: result.locations.length,
      externalReadsPerformed: true, externalWritesPerformed: false, ordinaryRecordsChanged: false, creditsSpent: 0
    });
    return res.json(result);
  } catch (error) {
    if (!(error instanceof PropertyFinderSandboxError)) throw error;
    return res.status(error.httpStatus).json({ error: error.message, code: error.code, upstreamStatus: error.upstreamStatus, diagnosticEvidence: error.diagnosticEvidence });
  }
});

r.post('/integrations/property-finder/sandbox/listing-import/commit', async (req, res) => {
  if (req.body?.confirmation !== PROPERTY_FINDER_LISTING_IMPORT_CONFIRMATION) {
    return res.status(400).json({
      error: 'Exact CRM-Test PF Draft-import confirmation is required',
      requiredConfirmation: PROPERTY_FINDER_LISTING_IMPORT_CONFIRMATION
    });
  }
  const importBoundary = listingImportClient.status();
  if (!importBoundary.networkReady || !importBoundary.listingReadScopeConfigured) {
    return res.status(503).json({ error: 'PF Draft import is available only inside the enabled CRM-Test sandbox listing-read boundary' });
  }
  const reviewed = verifyPropertyFinderListingReview(req.body?.reviewToken, process.env.PROPERTY_FINDER_IMPORT_REVIEW_SECRET || '');
  if (reviewed.error) return res.status(400).json({ error: reviewed.error, code: reviewed.code });
  const discovered = reviewed.value.listing;
  if (!isTaggedPropertyFinderTestListing(discovered, req.body?.testRecordTag)) {
    return res.status(409).json({ error: 'Selected PF sandbox listing is not visibly tagged with the supplied non-private test tag' });
  }
  const existing = await one(`SELECT id,inventory_reference FROM listings WHERE deleted_at IS NULL AND
    ((source_provider='property_finder' AND external_record_id=$1) OR inventory_reference=$2) LIMIT 1`, [discovered.externalRecordId, discovered.reference]);
  if (existing) return res.status(409).json({
    error: 'This PF listing is already linked or may duplicate Internal Inventory; reconcile it instead of importing',
    existingInventoryId: existing.id,
    existingInventoryReference: existing.inventoryReference
  });
  const allowedOverrideFields = ['inventoryHeadline', 'project', 'developer', 'areaCode', 'community', 'propertyType', 'bedrooms', 'sizeSqft',
    'price', 'currency', 'handoverStatus', 'handoverExpectedDate', 'originatingAgentId', 'responsibleAgentId'];
  const overrides = Object.fromEntries(allowedOverrideFields.filter(key => req.body?.overrides?.[key] !== undefined).map(key => [key, req.body.overrides[key]]));
  const candidate = buildPropertyFinderDraftIntake(discovered, overrides);
  const checked = validateListingIntakePayload(candidate);
  if (checked.error) return res.status(400).json({ error: checked.error, code: checked.code });
  const value = checked.value, payloadHash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const result = await transaction(async dbClient => {
    const event = await one(`INSERT INTO listing_intake_events(id,event_id,provider_code,source_kind,external_record_id,mapping_version,
      received_mapping_version,mapping_version_id,payload_hash,received_payload_hash,payload,received_payload,status,assigned_to)
      VALUES($1,$2,$3,$4,$5,$6,$6,NULL,$7,$7,$8,$8,'processing',$9)
      ON CONFLICT(provider_code,event_id) DO NOTHING RETURNING *`,
    [uuid(), value.eventId, value.provider, value.sourceKind, value.externalRecordId, value.mappingVersion, payloadHash, value, req.broker.id], dbClient);
    if (!event) {
      const prior = await one('SELECT status,listing_id FROM listing_intake_events WHERE provider_code=$1 AND event_id=$2', [value.provider, value.eventId], dbClient);
      return prior?.status === 'accepted'
        ? { status: 'already_imported', listingId: prior.listingId, idempotent: true }
        : { status: prior?.status || 'conflict', error: 'This PF listing import is already queued for review' };
    }
    return processEventWithClient(event, value, req.broker, {}, dbClient);
  });
  if (result.error) return res.status(409).json(result);
  return res.status(result.status === 'accepted' ? 201 : 200).json({
    ...result,
    createdAsDraft: result.status === 'accepted',
    automaticVerificationPerformed: false,
    automaticActivationPerformed: false,
    externalWritesPerformed: false,
    publicationPerformed: false,
    creditsSpent: 0
  });
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const selectedText = (value, max = 200) => typeof value === 'string' && value.trim() && value.trim().length <= max;

r.post('/integrations/property-finder/sandbox/listing-preflight', async (req, res) => {
  if (req.body?.confirmation !== PROPERTY_FINDER_PREFLIGHT_CONFIRMATION) {
    return res.status(400).json({
      error: 'Exact CRM-Test Property Finder sandbox preflight confirmation is required',
      requiredConfirmation: PROPERTY_FINDER_PREFLIGHT_CONFIRMATION
    });
  }
  const { listingId, preparationVersionId, testRecordTag, publicProfileId, locationId, locationQuery, projectId = null } = req.body || {};
  if (![listingId, preparationVersionId].every(value => uuidPattern.test(String(value || '')))) return res.status(400).json({ error: 'Explicit Inventory and immutable preparation UUIDs are required' });
  if (!selectedText(testRecordTag, 100)) return res.status(400).json({ error: 'A visible non-private test Inventory tag is required' });
  if (![publicProfileId, locationId, locationQuery].every(value => selectedText(value))) return res.status(400).json({ error: 'Explicit PF public profile, location and location search values are required' });
  if (projectId !== null && !selectedText(projectId)) return res.status(400).json({ error: 'Optional PF project ID must be a non-empty selected value' });
  const mediaSelections = req.body?.mediaSelections;
  if (!Array.isArray(mediaSelections) || mediaSelections.some(item => !uuidPattern.test(String(item?.propertyMediaId || '')))) return res.status(400).json({ error: 'Explicit approved Inventory media UUID selections are required' });

  const preparation = await one(`SELECT prep.id,prep.publication_id,prep.revision_number,prep.portal_fields,prep.readiness_snapshot,
      prep.mapping_version_id,p.current_preparation_version_id,p.channel,mapping.version_code AS mapping_version_code,
      l.id AS listing_id,l.inventory_reference,l.inventory_headline,l.project,l.area,l.community,l.status,l.workflow_status,
      l.verification_status,l.property_type,l.bedrooms,l.size_sqft,l.price,l.currency,l.updated_at,
      (SELECT COUNT(*)::int FROM inventory_agreements a WHERE a.listing_id=l.id AND a.status='active' AND a.marketing_authorized=1
        AND (a.effective_from IS NULL OR a.effective_from<=CURRENT_DATE) AND (a.effective_to IS NULL OR a.effective_to>=CURRENT_DATE)) AS marketing_agreement_count
    FROM external_listing_preparation_versions prep
    JOIN external_listing_publications p ON p.id=prep.publication_id
    JOIN listings l ON l.id=p.listing_id AND l.deleted_at IS NULL
    LEFT JOIN external_portal_mapping_versions mapping ON mapping.id=prep.mapping_version_id
    WHERE prep.id=$1 AND l.id=$2`, [preparationVersionId, listingId]);
  if (!preparation) return res.status(404).json({ error: 'Selected Inventory and immutable preparation were not found together' });
  const listing = { ...preparation };
  preparation.isCurrent = preparation.currentPreparationVersionId === preparation.id;
  preparation.effectiveMappingVersionCode = PROPERTY_FINDER_PAYLOAD_MAPPING_VERSION;
  if (preparation.channel !== 'property_finder') return res.status(409).json({ error: 'The selected immutable preparation is not for Property Finder' });
  if (preparation.portalFields?.uaeEmirate !== 'dubai') return res.status(409).json({ error: 'dev.138 sandbox preflight is limited to Dubai permit/compliance reconciliation' });
  if (!isExplicitlyTaggedTestInventory(listing, testRecordTag)) return res.status(409).json({ error: 'Selected Inventory is not visibly tagged with the supplied non-private test tag' });

  const permitEvidence = await one(`SELECT *,facts_snapshot->>'permitType' AS permit_type FROM external_portal_permit_evidence_versions
    WHERE listing_id=$1 AND portal_code='property_finder' ORDER BY created_at DESC LIMIT 1`, [listingId]);
  const internalPermit = portalPermitReconciliation({ listing, fields: preparation.portalFields, permitEvidence });
  preparation.permitMatched = internalPermit.matched;
  if (!internalPermit.matched) return res.status(409).json({ error: 'Internal Dubai permit evidence must reconcile before any controlled PF sandbox read' });
  const mediaIds = mediaSelections.map(item => item.propertyMediaId);
  const selectedMedia = mediaIds.length ? await many(`SELECT id,approval_status,usage_rights_confirmed,rights_expires_at,media_type,file_size_bytes,file_hash
    FROM property_media WHERE listing_id=$1 AND id=ANY($2::uuid[])`, [listingId, mediaIds]) : [];
  if (selectedMedia.length !== mediaIds.length) return res.status(409).json({ error: 'Every selected media UUID must belong to the explicitly selected Inventory' });

  try {
    const status = client.status();
    if (!status.networkReady) throw new PropertyFinderSandboxError('sandbox_not_ready', 'Property Finder sandbox reads are disabled or incompletely configured');
    const resolutions = await client.resolvePreflightReferences({
      publicProfileId,
      locationId,
      locationQuery,
      projectId,
      permitNumber: permitEvidence?.permitNumber || '',
      licenseNumber: permitEvidence?.issuingCompanyLicenseNumber || '',
      permitType: permitEvidence?.permitType || ''
    });
    const preflight = buildPropertyFinderPreflight({
      listing,
      preparation,
      permitEvidence,
      resolutions,
      mediaSelections,
      selectedMedia,
      rentFrequency: req.body?.rentFrequency,
      hasParkingSpace: req.body?.hasParkingSpace
    });
    const preview = businessReadablePropertyFinderPreview({ listing, preparation, preflight, resolutions });
    await audit('Broker', req.broker.id, 'property_finder_sandbox_listing_preflighted', req.broker.id, {
      listingId,
      preparationVersionId,
      ready: preflight.ready,
      payloadHash: preflight.payloadHash,
      mappingVersion: preflight.mappingVersion,
      selectedMediaCount: mediaSelections.length,
      externalReadsPerformed: true,
      externalWritesPerformed: false,
      publicationPerformed: false,
      creditsSpent: 0
    });
    return res.json({
      preview,
      checks: preflight.checks,
      exactVersionedPayload: preflight.payload,
      deterministicPayloadHash: preflight.payloadHash,
      payloadMappingVersion: preflight.mappingVersion,
      externalWritesPerformed: false,
      publicationPerformed: false,
      creditsSpent: 0
    });
  } catch (error) {
    if (!(error instanceof PropertyFinderSandboxError)) throw error;
    return res.status(error.httpStatus).json({ error: error.message, code: error.code, upstreamStatus: error.upstreamStatus, diagnosticEvidence: error.diagnosticEvidence });
  }
});

export default r;
