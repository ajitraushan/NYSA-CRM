# NYSA CORE Release 4 — Governed Document Assembly Design

**Design date:** 8 August 2026 (Asia/Dubai)  
**Status:** Superseded for DLD documents by owner decision — not integrated or legally approved  
**Supersedes:** the withdrawn local listing-agreement-readiness prototype

## Purpose

Generate or prepare the standard documents agents need by drawing from authoritative Customer,
Inventory, Opportunity, Deal, Offer, party/authority, company and agent records without retyping or
silently changing source facts. Every output must be reproducible from an approved template version,
an immutable source snapshot and a deterministic field manifest.

## Existing foundation to reuse

CORE already has:

- approved, versioned `document_templates` with private storage and file hashes;
- logical `documents`, immutable `document_versions` and governed entity links;
- customer Marketing Agreement evidence linked to an exact executed document/template version;
- a proven Proposal generation pattern that snapshots customer, requirement, organization, agent,
  property, media, financial, template, brand and disclaimer data before PDF generation;
- private file storage, role-scoped access, audit and exact-version PDF review.

The missing increment is a generic governed assembly engine and a document-type catalogue. It is not
another Inventory or portal-readiness gate.

## Three output modes

### 1. `core_generated`

CORE may render a document only from a legally/business-approved NYSA template. The generated version
stores the template ID/version/hash, exact source snapshot, field-level provenance, permitted agent
inputs, renderer version and output SHA-256. Correction creates a new version; generated or executed
versions are never overwritten.

Initial candidate:

- NYSA customer marketing-consent agreement, building on the existing Marketing Agreement model.

### 2. `official_system_preparation`

CORE prepares a validated data packet and business preview for an official smart-contract workflow.
It must not label a CORE-rendered preview as the official contract. The official contract number,
executed PDF/evidence, source system, execution time and hash are captured back and linked to the exact
preparation snapshot.

Initial catalogue:

| Stable type | Business purpose | Primary CORE sources | Controlled outcome |
|---|---|---|---|
| `dld_contract_a` | Seller-to-broker agreement to market a property | Seller/authority, Inventory/title evidence, agency, broker, commercial terms | Official-contract preparation and executed evidence capture |
| `dld_contract_b` | Buyer-to-broker desire/agreement to purchase | Customer/KYC, confirmed requirement, agency, broker, commission/terms | Official-contract preparation and executed evidence capture |
| `dld_contract_f` | Seller-to-buyer agreement to sell | Deal, accepted Offer revision, booking/reservation evidence, parties, Inventory and agreed terms | Official-contract preparation and executed evidence capture |

`MOU` is treated as a business alias for the applicable seller/buyer sale-agreement workflow, not a
second automatically generated document alongside Contract F. The exact approved naming must be
confirmed in the maintained catalogue.

### 3. `external_evidence_capture`

CORE records a request/checklist and captures the versioned evidence issued by another authorized
party. It does not generate the issuer's document.

Initial candidate:

- developer e-NOC used in the property-sale/transfer process.

## Document assembly contract

Every assembly request must contain:

1. `documentType` and maintained catalogue version;
2. output mode;
3. approved template or official-workflow profile version;
4. transaction/customer/Inventory context references;
5. exact source-record versions and `asOf` timestamp;
6. deterministic field map showing source, source field, snapshot value and whether agent editing is
   prohibited, controlled or permitted;
7. missing, conflicting, expired and unverified source facts;
8. controlled agent inputs with stable field codes, allowed values and justification where required;
9. reviewer/approver policy;
10. immutable manifest hash.

No output may be generated or prepared when a mandatory source fact is missing, ambiguous, stale or
inconsistent. The system must direct the agent back to the authoritative source record instead of
offering a free-text replacement for a governed fact.

## Immutable version evidence

Each prepared/generated version binds:

- document/catalogue/profile/template ID and version;
- template/profile file hash;
- organization and agent snapshot;
- customer/party and authority snapshot references;
- Inventory, requirement, Opportunity, Offer, booking and Deal snapshot references as applicable;
- exact approved and agent-completed fields;
- source `asOf` timestamps and evidence references;
- renderer/mapping version;
- output or preparation-packet SHA-256;
- creator, reviewer, approver and timestamps;
- superseded version reference.

An executed or official document is a separate immutable evidence version linked to the preparation
version. It never mutates the preparation snapshot.

## Proposed lifecycle

`context_selected` → `source_validation_blocked` or `ready_for_assembly` →
`prepared/generated` → `reviewed` → `execution_pending` → `executed/official_captured` →
`superseded/expired/cancelled`

Delivery and e-signature-provider integration are separate controlled capabilities. They are not
implied by document generation.

## Admin mapper maintenance

An Administrator maintains each document mapping as a governed version, including the stable
template placeholder, approved CORE source object/field, mandatory flag, editability boundary and
verification policy. A draft must validate against the supported CORE source schema before it can be
submitted for authorized approval. Activation is a separate decision. Editing an active mapper
creates a new draft version; previous documents retain the exact mapper version and hash used.

## Workflow-step document requirements

An active, versioned step profile identifies required and advisory documents for an agent workflow
step, why each document is needed, acceptable verified statuses and the completion timing. A required
document blocks step completion when it is missing, pending verification, expired or bound to another
case. Advisory documents remain visible but do not become silent blockers. Follow-up is proposed into
the existing authoritative CRM Task model; no parallel document-action queue is created.

## Unresolved catalogue definitions

- `listing_noc`: confirm whether this means an owner-issued authorization/NOC for NYSA to list or the
  developer e-NOC used for transfer. These require different output modes.
- `marketing_agreement`: confirm whether this means the existing customer marketing-consent
  agreement, a seller/property marketing mandate (which overlaps Contract A), or both as separately
  maintained types.
- Legal/compliance must approve the authoritative template/profile, mandatory fields, Arabic/English
  handling, permitted agent-editable fields, signature method, retention and access policy before a
  document type is activated.

## Safety boundary

This design does not authorize generation of an official DLD/RERA contract, legal wording, e-signing,
submission to Dubai REST, portal publication, external transmission, deployment or use of Production
data. Local prototypes must use opaque synthetic references and must not display private identity,
owner, contact or authority details.

## Owner simplification decision — 9 August 2026

CORE will not provide a DLD field mapper or generate substitute Contracts A/B/F or DLD/NOC forms.
For externally controlled documents, the supported workflow is limited to requirement advice,
obtaining the official document through the authorized channel, private upload, verification,
immutable versioning and linking to the exact Inventory and/or Deal. The internal NYSA Marketing
Agreement remains outside this DLD simplification because it already uses an approved internal
template/evidence model.
