export const GOVERNED_DOCUMENT_ASSEMBLY_POLICY_VERSION = 'r4-governed-document-assembly-v1';
export const GOVERNED_DOCUMENT_CATALOG_VERSION = 'r4-document-catalog-2026-08-08-v1';

const CATALOG = Object.freeze({
  dld_contract_a: {
    label: 'Contract A', purpose: 'Seller-to-broker property marketing agreement',
    mode: 'official_system_preparation', officialSystem: 'Dubai REST',
    requiredSources: ['organization', 'agent', 'seller_authority', 'inventory', 'commercial_terms'],
    fields: [
      ['seller_reference','seller_authority','partyReference','locked'], ['authority_evidence','seller_authority','authorityEvidenceReference','locked'],
      ['property_reference','inventory','inventoryReference','locked'], ['property_description','inventory','propertyDescription','locked'],
      ['asking_price','inventory','askingPrice','locked'], ['broker_reference','agent','brokerReference','locked'],
      ['agency_licence','organization','licenceReference','locked'], ['mandate_type','commercial_terms','mandateType','controlled'],
      ['commission_terms','commercial_terms','commissionTerms','controlled']
    ]
  },
  dld_contract_b: {
    label: 'Contract B', purpose: 'Buyer-to-broker purchase agreement',
    mode: 'official_system_preparation', officialSystem: 'Dubai REST',
    requiredSources: ['organization', 'agent', 'customer', 'requirement', 'commercial_terms'],
    fields: [
      ['buyer_reference','customer','customerReference','locked'], ['identity_status','customer','identityStatus','locked'],
      ['requirement_reference','requirement','requirementReference','locked'], ['purchase_objective','requirement','purchaseObjective','locked'],
      ['budget','requirement','budget','locked'], ['broker_reference','agent','brokerReference','locked'],
      ['agency_licence','organization','licenceReference','locked'], ['commission_terms','commercial_terms','commissionTerms','controlled']
    ]
  },
  dld_contract_f: {
    label: 'Contract F / MOU', purpose: 'Seller-to-buyer property sale agreement',
    mode: 'official_system_preparation', officialSystem: 'Dubai REST',
    requiredSources: ['organization', 'agent', 'seller_authority', 'customer', 'inventory', 'accepted_offer', 'booking', 'deal_terms'],
    fields: [
      ['seller_reference','seller_authority','partyReference','locked'], ['buyer_reference','customer','customerReference','locked'],
      ['property_reference','inventory','inventoryReference','locked'], ['title_evidence','inventory','titleEvidenceReference','locked'],
      ['agreed_price','accepted_offer','amount','locked'], ['offer_revision','accepted_offer','revisionReference','locked'],
      ['booking_reference','booking','bookingReference','locked'], ['booking_status','booking','status','locked'],
      ['target_completion','deal_terms','targetCompletion','controlled'], ['additional_terms','deal_terms','additionalTerms','controlled']
    ]
  },
  nysa_marketing_consent: {
    label: 'NYSA Marketing Agreement', purpose: 'Customer marketing-consent agreement',
    mode: 'core_generated',
    requiredSources: ['organization', 'agent', 'customer', 'consent_terms'],
    fields: [
      ['customer_reference','customer','customerReference','locked'], ['customer_display_name','customer','displayName','locked'],
      ['organization_name','organization','legalName','locked'], ['agent_reference','agent','brokerReference','locked'],
      ['consent_scope','consent_terms','scope','controlled'], ['permitted_channels','consent_terms','channels','controlled'],
      ['effective_date','consent_terms','effectiveDate','controlled'], ['expiry_date','consent_terms','expiryDate','controlled']
    ]
  },
  developer_e_noc: {
    label: 'Developer e-NOC', purpose: 'Externally issued transfer evidence',
    mode: 'external_evidence_capture', officialSystem: 'Developer / Dubai REST',
    requiredSources: ['inventory', 'seller_authority', 'developer', 'transfer_context'],
    fields: [
      ['property_reference','inventory','inventoryReference','locked'], ['title_evidence','inventory','titleEvidenceReference','locked'],
      ['owner_reference','seller_authority','partyReference','locked'], ['developer_reference','developer','developerReference','locked'],
      ['transfer_reference','transfer_context','transferReference','locked']
    ]
  },
  listing_noc: {
    label: 'Listing NOC', purpose: 'Owner definition required before activation',
    mode: 'definition_required', requiredSources: [], fields: []
  }
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function sha256(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function clean(value) { return String(value ?? '').trim(); }
function present(value) { return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && clean(value) !== ''; }

export function governedDocumentCatalog() {
  return Object.entries(CATALOG).map(([code, item]) => ({ code, ...item, fields: item.fields.map(field => [...field]) }));
}

export async function prepareGovernedDocumentAssembly({ documentType, sources = {}, templateProfile = null, externalEvidence = null, mappingProfile = null, now }) {
  const profile = mappingProfile ? {
    label: mappingProfile.label, purpose: mappingProfile.purpose, mode: mappingProfile.mode,
    officialSystem: mappingProfile.officialSystem, requiredSources: mappingProfile.requiredSources,
    fields: mappingProfile.fields
  } : CATALOG[documentType];
  if (!profile) throw new Error('Unknown governed document type');
  if (mappingProfile && (mappingProfile.status !== 'active' || !/^[a-f0-9]{64}$/i.test(clean(mappingProfile.hash)))) throw new Error('Only an active hashed mapping profile can be used');
  const evaluatedAt = clean(now);
  if (!Number.isFinite(Date.parse(evaluatedAt))) throw new Error('now must be an ISO timestamp');

  if (profile.mode === 'definition_required') {
    return { policyVersion: GOVERNED_DOCUMENT_ASSEMBLY_POLICY_VERSION, catalogVersion: GOVERNED_DOCUMENT_CATALOG_VERSION, documentType, label: profile.label, purpose: profile.purpose, mode: profile.mode, status: 'definition_required', missing: [{ code: 'owner_definition', label: 'Confirm the business and issuer meaning of Listing NOC' }], fieldMap: [], manifest: null, manifestHash: null, output: null };
  }

  const missing = [];
  for (const sourceCode of profile.requiredSources) {
    const source = sources[sourceCode];
    if (!source?.ref || !source?.version || !source?.hash || !source?.asOf) missing.push({ code: `source_${sourceCode}`, label: `${sourceCode.replaceAll('_',' ')} source snapshot` });
  }
  const fieldMap = profile.fields.map(([outputField, sourceCode, sourceField, editability]) => {
    const source = sources[sourceCode] ?? {};
    const value = source.facts?.[sourceField];
    if (!present(value)) missing.push({ code: `field_${outputField}`, label: outputField.replaceAll('_',' ') });
    return { outputField, sourceCode, sourceRef: source.ref ?? null, sourceVersion: source.version ?? null, sourceField, value: present(value) ? value : null, editability };
  });

  if (profile.mode === 'core_generated') {
    if (!templateProfile?.id || !templateProfile?.version || !/^[a-f0-9]{64}$/i.test(clean(templateProfile.hash)) || templateProfile?.status !== 'approved') {
      missing.push({ code: 'approved_template', label: 'Approved versioned NYSA template and SHA-256' });
    }
  }

  let capturedEvidence = null;
  if (profile.mode === 'external_evidence_capture' && externalEvidence) {
    capturedEvidence = {
      evidenceReference: clean(externalEvidence.evidenceReference), issuerReference: clean(externalEvidence.issuerReference),
      documentHash: clean(externalEvidence.documentHash), issuedAt: clean(externalEvidence.issuedAt),
      sourceInventoryVersion: clean(externalEvidence.sourceInventoryVersion)
    };
    if (!capturedEvidence.evidenceReference || !capturedEvidence.issuerReference || !/^[a-f0-9]{64}$/i.test(capturedEvidence.documentHash) || !Number.isFinite(Date.parse(capturedEvidence.issuedAt))) missing.push({ code: 'valid_external_evidence', label: 'Valid externally issued evidence metadata' });
    if (capturedEvidence.sourceInventoryVersion !== sources.inventory?.version) missing.push({ code: 'external_inventory_match', label: 'External evidence matching the Inventory snapshot' });
  }

  const ready = missing.length === 0;
  const manifest = ready ? {
    policyVersion: GOVERNED_DOCUMENT_ASSEMBLY_POLICY_VERSION,
    catalogVersion: GOVERNED_DOCUMENT_CATALOG_VERSION,
    documentType,
    mode: profile.mode,
    evaluatedAt,
    templateProfile: profile.mode === 'core_generated' ? { id: templateProfile.id, version: templateProfile.version, hash: templateProfile.hash } : null,
    mappingProfile: mappingProfile ? { id: mappingProfile.id, version: mappingProfile.version, hash: mappingProfile.hash } : null,
    officialSystem: profile.officialSystem ?? null,
    sources: Object.fromEntries(profile.requiredSources.map(code => [code, { ref: sources[code].ref, version: sources[code].version, hash: sources[code].hash, asOf: sources[code].asOf }])),
    fieldMap,
    capturedEvidence
  } : null;
  const manifestHash = manifest ? await sha256(manifest) : null;

  let status = 'source_validation_blocked';
  let output = null;
  if (ready && profile.mode === 'official_system_preparation') {
    status = 'official_preparation_ready';
    output = { kind: 'preparation_packet', officialContractGenerated: false, officialSystem: profile.officialSystem };
  } else if (ready && profile.mode === 'core_generated') {
    status = 'core_generation_preview_ready';
    output = { kind: 'nysa_template_preview', documentGenerated: false, templateRef: `${templateProfile.id}@${templateProfile.version}` };
  } else if (ready && profile.mode === 'external_evidence_capture') {
    status = capturedEvidence ? 'external_evidence_captured' : 'external_evidence_pending';
    output = { kind: 'external_evidence_register', issuerDocumentGenerated: false, captured: Boolean(capturedEvidence) };
  }

  return { policyVersion: GOVERNED_DOCUMENT_ASSEMBLY_POLICY_VERSION, catalogVersion: GOVERNED_DOCUMENT_CATALOG_VERSION, documentType, label: profile.label, purpose: profile.purpose, mode: profile.mode, status, missing, fieldMap, manifest, manifestHash, output };
}
