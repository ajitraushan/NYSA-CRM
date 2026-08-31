# NYSA CORE Release 4 — Governed Partner Organization Integration Design

**Design date:** 12 August 2026 (Asia/Dubai)  
**Design gate:** Gate 2 — proposed for owner review; no implementation approval yet  
**Classification:** Local functional design only; not integrated, packaged, migrated or deployed  
**Proposed policy version:** `r4-partner-master-integration-v1`  
**Governing prototype policy:** `r4-partner-master-v1`

## Decision requested

Approve, revise or reject the design below before any migration, route, UI or runtime implementation.
The recommended decisions are:

1. Reuse the existing CRM Company Master as the one stable organization identity. Do not create a
   parallel Partner Master identity.
2. Add immutable governed verification versions to eligible Company records.
3. Limit governance maintenance and activation to Administrators, and require the activating
   Administrator to be different from the draft creator.
4. Add only optional, append-only Inventory organization relationships. A missing relationship never
   blocks ordinary Internal Inventory maintenance.
5. Preserve every existing Company and Inventory value as-is. Do not backfill, rename, merge or verify
   existing records by assumption.

## Purpose

Provide a governed, reviewable organization identity for developers, external agencies, referral
partners and service providers, then allow an existing Inventory transaction to reference an exact
active organization version where useful.

The package improves source accountability without collecting new private contacts, creating a new
work queue, changing Inventory ownership, or making Partner Master a prerequisite for Internal
Inventory maintenance.

## Existing-system finding and integration boundary

CORE already maintains organizations in `companies` and business classifications in
`external_company_roles`. The existing Company Master also supports Customer/contact relationships.
A second stable Partner Master would create duplicate organization identities and competing company
histories.

This package therefore treats:

- `companies.id` as the stable organization identifier;
- existing Company profile/contact fields as operational CRM data outside this package;
- new immutable verification versions as the authoritative partner-governance evidence;
- new append-only Inventory link events as optional organization provenance; and
- individual sellers, landlords, owners and representatives as secured Inventory Party records,
  never Partner Master records.

The package does not copy Company email, phone, address, contacts, owner assignments or notes into
governed verification evidence. It does not display those fields in the partner-governance review.

## Supported organization classifications

| Governed classification | Existing Company role relationship | May be linked to Inventory as |
| --- | --- | --- |
| Developer | `developer` | `developer` |
| External agency | `agency` | `listing_source_agency` |
| Referral partner | Add `referral_partner` as an allowed Company role | `referral_source` |
| Service provider | Add `service_provider` as an allowed Company role | Not linkable to Inventory |

The operational Company category remains a broad display/category field. An active governed
classification requires a matching active Company role, but an ordinary Company role alone does not
mean the organization is verified.

## Functional principles

- Licence information is optional for every supported organization.
- When licence information is supplied, its reference is required; issuer and expiry are optional.
- An expired supplied licence cannot be activated.
- Independent source evidence is always required.
- Source evidence is represented only by an opaque reference and SHA-256; this package stores no file.
- Exact normalized legal-name or licence matches require explicit duplicate review.
- A duplicate decision never merges or overwrites a Company.
- Corrections append a new immutable version; they never edit an active version in place.
- One Company may have one active governed version and at most one open draft/review version.
- A pending revision does not invalidate the last active version.
- Retirement is an explicit event and does not archive the Company or alter Inventory automatically.
- Inventory relationships bind the exact organization version used at the time.
- Link, replacement and unlink actions are append-only events.
- No action publishes, imports, synchronizes or communicates externally.

## Proposed data contract

### `partner_organization_versions`

Immutable governed evidence linked to one existing Company.

| Field | Rule |
| --- | --- |
| `id` | UUID primary key |
| `company_id` | Required FK to `companies.id` |
| `version_number` | Positive integer; unique per Company |
| `policy_version` | Required; `r4-partner-master-integration-v1` |
| `classification` | `developer`, `external_agency`, `referral_partner`, or `service_provider` |
| `legal_name` | Required, trimmed, minimum three characters |
| `normalized_legal_name` | Deterministic lowercase/collapsed-space comparison value |
| `licence_reference` | Optional unless other licence facts are supplied |
| `normalized_licence_reference` | Nullable deterministic comparison value |
| `licence_issuer` | Optional |
| `licence_expires_at` | Optional timestamp |
| `licence_evidence_status` | `provided` or `not_provided` |
| `source_evidence_reference` | Required opaque business reference |
| `source_evidence_sha256` | Required 64-character hexadecimal SHA-256 |
| `status` | Lifecycle value defined below |
| `supersedes_version_id` | Nullable FK to the prior active version |
| `created_by` / `created_at` | Required creator and timestamp |
| `duplicate_decision*` | Nullable decision, existing Company, reviewer, reason and time |
| `verification*` | Nullable decision, verifier, reason and time |
| `retirement*` | Nullable actor, reason and time |

Proposed lifecycle values:

- `duplicate_review`: deterministic candidate exists; cannot be verified;
- `pending_verification`: complete draft awaiting independent review;
- `active`: accepted version available for optional linkage;
- `rejected`: verification rejected with reason;
- `duplicate_closed`: reviewer selected an existing Company instead;
- `superseded`: historical accepted version replaced by a newer activation; and
- `retired`: deliberately withdrawn from new use.

Database safeguards:

- unique `(company_id, version_number)`;
- one `active` version per Company;
- one open `duplicate_review` or `pending_verification` version per Company;
- indexes on normalized legal name and non-null normalized licence reference;
- status-dependent checks for reviewer/verifier/retirement facts;
- creator and verifier must differ when status becomes `active`;
- expiry validation at activation time in the transaction; and
- no `UPDATE` API for governed business facts after insertion.

Activation is one transaction: lock the Company and its open version, re-run duplicate and expiry
checks, mark the prior active version `superseded` if present, activate the reviewed version, ensure
the matching Company role exists, and write audit evidence.

### `inventory_organization_link_events`

Append-only relationship evidence against an existing Inventory record.

| Field | Rule |
| --- | --- |
| `id` | UUID primary key |
| `listing_id` | Required FK to `listings.id` |
| `relationship` | `developer`, `listing_source_agency`, or `referral_source` |
| `action` | `linked`, `replaced`, or `unlinked` |
| `partner_version_id` | Required for linked/replaced; null for unlinked |
| `supersedes_event_id` | Required for replaced/unlinked; null for first link |
| `reason` | Required meaningful business reason |
| `performed_by` / `performed_at` | Required actor and timestamp |
| `policy_version` | Required policy version |

The current relationship is the latest valid event in each `(listing_id, relationship)` stream.
The application locks that stream while appending an event. The database rejects link/replacement
events whose organization version is not active or whose classification is incompatible.

The link stores no owner/contact facts and does not replace the existing `listings.developer` display
text in this package. The exact governed organization name is shown separately as linked provenance.

## Duplicate-review contract

Before inserting a governed version, comparison runs against all non-retired governed versions and
unarchived Companies:

1. exact normalized licence reference, when supplied;
2. exact normalized governed legal name; and
3. exact normalized existing Company name/legal name where no governed version exists yet.

The API returns candidate Company references, names, classifications and match bases only. It does
not return Company contacts or private profile fields.

Reviewer outcomes:

- **Use existing Company:** close the draft as `duplicate_closed`; store the chosen Company and reason.
- **Continue as distinct:** move to `pending_verification`; require a meaningful evidence-based reason.

Duplicate review is contained within Admin Company maintenance. It does not create a separate menu,
queue or generic CRM work item.

## Permissions and separation of duties

Recommended matrix:

| Action | Administrator | Admin Assistant | Other CRM roles |
| --- | --- | --- | --- |
| Read governed organization summary | Yes | Yes | Read active summary only where already permitted to read the Company |
| Create draft/revision | Yes | No | No |
| Decide duplicate review | Yes, not own draft | No | No |
| Activate/reject | Yes, not own draft | No | No |
| Retire | Yes, not own active version | No | No |
| Link active organization in writable Inventory | Yes | No | Existing authorized Inventory maintainers |
| Replace/unlink Inventory relationship | Yes | No | Existing authorized Inventory maintainers |

All endpoints also enforce existing Company and Inventory read/write scope. UI hiding is not treated
as authorization.

## Proposed API surface

Admin governance endpoints:

- `GET /api/admin/partner-organizations`
- `GET /api/admin/partner-organizations/:companyId`
- `POST /api/admin/partner-organizations/:companyId/versions`
- `POST /api/admin/partner-organization-versions/:versionId/duplicate-decision`
- `POST /api/admin/partner-organization-versions/:versionId/verification`
- `POST /api/admin/partner-organization-versions/:versionId/retirement`

Inventory relationship endpoints:

- `GET /api/listings/:listingId/organization-relationships`
- `POST /api/listings/:listingId/organization-relationships`

Every mutating endpoint uses a database transaction, validates current state after locking, rejects
stale decisions with HTTP 409, and writes the existing audit log. Responses use Company business
references/names rather than exposing raw evidence payloads. UUIDs remain navigation identifiers.

## Proposed user experience

### Admin Company maintenance

Extend the existing Company experience; do not add a top-level Partner Master module.

- Add a **Governed organization status** column/filter.
- Open a Company to view active classification, verification state, licence supplied/not supplied,
  licence expiry where maintained, evidence reference, version and last review time.
- Place **Create governed version**, duplicate decision, verification and revision controls inside an
  Administrator-only section.
- Show immutable version history in a collapsed section.
- Do not show Company contact details inside the governance review panel.

### Existing Inventory transaction

Add a small **Organization provenance** section to the existing Inventory create/edit/detail flow.

- The selector lists compatible active governed organizations only.
- Direct owner, internal agent, portal/import and unknown origins do not require a Partner Master link.
- Service providers never appear in the Inventory organization selector.
- Missing linkage displays “Organization relationship may be completed later” and does not block save.
- Existing `developer` text remains visible and unchanged.
- Replacement/unlink requires a reason and preserves prior events.

No separate Inventory-organization transaction screen or operating queue is created.

## Audit contract

Add `PartnerOrganization` and `InventoryOrganizationLink` to the existing audit entity constraint.
Minimum actions:

- `draft_created`, `duplicate_review_decided`, `verification_activated`,
  `verification_rejected`, `revision_created`, `version_superseded`, `version_retired`;
- `inventory_organization_linked`, `inventory_organization_replaced`, and
  `inventory_organization_unlinked`.

Audit details include stable Company/Inventory references, version numbers, classification,
relationship, reason and evidence hash reference where necessary. They exclude email, phone, address,
contact identity, private owner information and evidence content.

## Existing-data treatment

- No existing Company is automatically verified.
- No existing `companies.name`, `legal_name`, `trade_license_number`, role or contact field is changed.
- No existing Inventory `developer` value is replaced or normalized.
- No Inventory link is inferred from matching text.
- No Company is merged, archived or retired automatically.
- Existing Company creation remains operational CRM behavior; only an active governed version makes
  a Company eligible for governed Inventory linkage.

An optional future owner-approved remediation package may review legacy Companies. It is not part of
this package.

## Offline implementation slices after approval

1. **Contract slice:** update the domain policy to operate on existing Company identities; focused
   deterministic tests only.
2. **Persistence slice:** one additive local migration for version, link-event, role-constraint and
   audit-constraint changes; no migration execution outside a disposable local test database.
3. **Admin API slice:** governance read/draft/duplicate/verification/revision/retirement endpoints.
4. **Inventory API slice:** compatible selector plus append-only link/replace/unlink behavior.
5. **UI slice:** existing Company and Inventory views only.
6. **Verification slice:** focused tests, local loopback browser review, then the complete repository
   suite.

Each slice remains reversible as uncommitted local files. No deployment script, package, environment
restart or external connector is authorized.

## Offline acceptance tests

Focused coverage must prove at least:

1. An existing Company is reused; no second stable organization master is created.
2. Every classification maps to the intended Company role.
3. Licence omission is visibly `not_provided` and does not block review.
4. Supplied expired licence blocks activation.
5. Missing/invalid evidence reference or SHA-256 blocks draft creation.
6. Exact normalized legal-name and licence matches enter duplicate review.
7. Duplicate `use_existing` and evidence-based `continue_distinct` decisions are immutable.
8. A creator cannot activate, reject, decide or retire their own governed version.
9. A second Administrator can activate a valid version.
10. A revision leaves the prior version active until the revision is accepted.
11. Activation supersedes the prior version atomically.
12. Only one active and one open version can exist per Company under concurrency.
13. Only compatible active classifications appear in an Inventory selector.
14. Direct-owner Inventory needs no organization link.
15. Missing organization linkage does not block Inventory create/edit.
16. Service providers cannot be linked to Inventory.
17. Link/replacement/unlink events are append-only and retain the exact organization version.
18. Existing `developer` text and historical Inventory remain unchanged.
19. Unauthorized roles receive 403 even when calling APIs directly.
20. Duplicate/stale submissions return 409 without partial writes.
21. Audit records contain required business evidence and no private contact/owner data.
22. UI exposes no private Company contact details in governance review.
23. No external network capability, file upload, credential field or provider-specific behavior is
    introduced.
24. The complete local repository suite remains green after focused coverage.

## Explicit exclusions

- No separate Company/Partner identity or parallel queue.
- No Company merge or legacy-data cleanup.
- No individual owner, representative or contact maintenance.
- No licence lookup, validation API or external evidence download.
- No document upload or private evidence content.
- No external portal behavior, publication or reconciliation.
- No market-data import or market intelligence changes.
- No Inventory ownership replacement, status change or publication-readiness effect.
- No CRM Test, Production, R2, cPanel or external-service action.

## Approval gate

Material implementation begins only after the owner approves this Gate 2 design, including:

- reuse of the existing Company Master;
- Administrator-only governance with two-person activation;
- the classification/role mapping;
- optional append-only Inventory relationships; and
- preservation of all existing Company and Inventory values without inferred backfill.
