# Release 4 — DLD Market Data and Inventory Market Intelligence Gate 2

**Date:** 13 August 2026 (Asia/Dubai)  
**Status:** Gate 2 owner-approved; Gate 3 implemented locally  
**Migration:** `087_release4_dld_market_intelligence.sql` — implemented locally but not applied  
**Schema proposal:** `docs/schema-proposals/release4_dld_market_intelligence.sql.proposed`

**Owner decision:** Gate 2 approved on 13 August 2026 (Asia/Dubai). Approval authorizes local Gate 3
implementation and testing only. Migration `087` must remain unapplied.

**Gate 3 status:** initial story rejected by the owner because property segments and building/Community
scope were not adequately represented. Corrected Gate 3 now distinguishes Studio, 1 BR, 2 BR, 3 BR,
4+ BR, Penthouse and Villa; preserves building/project evidence; and visibly selects exact-building or
same-Community fallback scope. Corrected focused coverage **46/46 passed**; complete regression
**819/819 passed**.

**Owner decision:** corrected Gate 3 story approved on 13 August 2026 after the governed segment,
building/Community scope and context-card spacing corrections.

## Gate 1 authority

Gate 1 was owner-approved on 13 August 2026. This Gate 2 contract translates that scope into an
additive database and API design. Approval authorizes local implementation only. It does not authorize
migration application or any external action.

## Additive data model

Migration 087 will add these authorities:

1. `market_communities` and immutable `market_community_versions` — canonical Community identity under
   one existing governed Area, with one draft and one active version per identity.
2. nullable `listings.community_id` — exact optional linkage only; no automatic legacy backfill.
3. `dld_community_mapping_versions` — versioned source-dataset/source-area to Community crosswalk,
   with one draft and one active version per source identity.
4. `dld_market_source_batches` — one immutable private Document Version and one decision lifecycle per
   source file hash/dataset.
5. `dld_market_source_rows` — immutable row outcome, source-row hash, canonical eligible payload or
   controlled rejection reasons.
6. `dld_market_observations` — immutable accepted sale observations, unique by source dataset and
   source transaction reference.
7. `inventory_market_intelligence_snapshots` and terminal review events — frozen deterministic report,
   narrative and customer-readiness decision.

The proposal deliberately contains no customer, owner, buyer, seller, contact or authority columns.

## Database invariants

- Community stable code is unique. The active normalized label is unique within its exact Area.
- Community version Area must equal its stable Community Area through a composite foreign key.
- A listing may reference only a stable canonical Community. API evaluation requires an active version.
- One active mapping exists per source dataset + normalized source identity. A mapping pins the exact
  active Community version reviewed by Admin.
- One batch exists per source dataset + file SHA-256 and per idempotency key.
- Source row counts reconcile exactly: eligible + rejected = total.
- Only an accepted, non-retired batch may materialize observations.
- Source dataset + source record reference is globally unique among observations.
- Accepted observations, source rows and snapshots have no update/delete API.
- One terminal review event exists per snapshot. Returned/rejected decisions require a meaningful reason.
- Full Administrator may be creator and decider for configuration, batch or snapshot review. The schema
  intentionally contains no creator/approver inequality constraint.

## File handling and bounded processing

The current HTTP layer accepts JSON only and defaults to a 32 MiB request limit. Base64 would make the
approved 50 MiB CSV limit larger and is therefore rejected for this package.

Implementation will add a narrowly scoped, content-type-aware raw `text/csv` upload path for the DLD
staging endpoint only:

- exact maximum: 50 MiB before persistence;
- no global JSON-body limit increase;
- calculate SHA-256 over the exact received bytes;
- validate UTF-8, supported header and no more than 100,000 data rows;
- parse/hash rows in bounded batches and bulk-insert bounded row groups;
- store the exact CSV as an existing restricted/private Document + immutable Document Version;
- remove the newly stored private file if database staging fails; and
- never echo raw source rows or storage keys in ordinary API responses.

## Endpoint contract

### Admin Community and crosswalk

- `GET /api/admin/market-communities`
- `POST /api/admin/market-community-versions`
- `POST /api/admin/market-community-versions/:versionId/activate`
- `POST /api/admin/market-community-versions/:versionId/retire`
- `POST /api/admin/dld-community-mapping-versions`
- `POST /api/admin/dld-community-mapping-versions/:versionId/activate`
- `POST /api/admin/dld-community-mapping-versions/:versionId/retire`

Admin Assistant may read and create drafts. Full Administrator may perform every action directly.
Activation atomically supersedes the prior active version under a transaction advisory lock. Retiring
a Community is rejected while active mappings or linked Inventory depend on it.

### Source batches

- `POST /api/admin/dld-market-batches` with `Content-Type: text/csv`; metadata is supplied only through
  bounded headers: source format, source dataset reference and idempotency key.
- `GET /api/admin/dld-market-batches`
- `GET /api/admin/dld-market-batches/:batchId`
- `POST /api/admin/dld-market-batches/:batchId/accept`
- `POST /api/admin/dld-market-batches/:batchId/reject`
- `POST /api/admin/dld-market-batches/:batchId/retire`

Staging returns batch reference, file name, counts, date coverage, preview fingerprint, KPI summary and
bounded rejection summaries. It does not return source rows, private file keys or raw technical IDs as
business labels. Accept/reject requires the exact preview fingerprint and a meaningful reason. Full
Administrator may decide their own staged batch. Admin Assistant cannot decide or retire.

Acceptance obtains advisory locks for the batch and each dataset/source transaction identity, rechecks
the staged fingerprint and conflict set, then creates all observations and the audit evidence in one
transaction. Any conflict fails the complete acceptance; there is no partial accepted batch.

Retirement is append-only lifecycle evidence. It excludes that batch's observations from new
intelligence calculations but never deletes the source, observations or historical snapshots.

### Inventory Community assignment and intelligence

- `PATCH /api/crm/listings/:listingId/market-community` — scoped Inventory writer chooses an active
  Community explicitly and records a reason; no text suggestion may save automatically.
- `GET /api/crm/listings/:listingId/market-intelligence`
- `POST /api/crm/listings/:listingId/market-intelligence-snapshots`
- `POST /api/crm/market-intelligence-snapshots/:snapshotId/review`
- `GET /api/crm/listings/:listingId/market-intelligence-snapshots`

The GET response supplies business metrics, mapping/batch versions, evidence counts, source period and
limitations. It excludes individual raw DLD row payloads, storage keys and private identities.

Creating a snapshot requires the exact Inventory context hash and current report fingerprint. A stale
Inventory, mapping, batch or policy returns 409 and requires refresh. Agent/Manager/Director/Admin may
create a snapshot within existing Inventory scope. Manager/Director within scope or full Administrator
may record the terminal review. Full Administrator may review their own snapshot. No endpoint sends it.

## Deterministic calculation contract

- Include only sale observations from accepted, non-retired batches with an active exact mapping.
- Derive one governed segment: Studio, 1 BR, 2 BR, 3 BR, 4+ BR, Penthouse or Villa.
- Match exact transaction type, governed segment and canonical Community. Never match Community by label.
- Prefer exact normalized building/project name within the Community when at least three same-segment
  observations exist. Otherwise use the same-Community/same-segment evidence and disclose the fallback.
- Default maximum observation age: 365 days as of the report time.
- Require at least three eligible observations for comparative metrics.
- Weighted average price/sq ft = total eligible price ÷ total eligible transacted sq ft.
- Median price and median price/sq ft use deterministic sorted midpoints.
- Inventory asking price/sq ft = current asking price ÷ current maintained size.
- Quarterly evidence uses calendar quarters and at most the latest four eligible quarters.
- A percentage trend requires at least two distinct eligible quarters; one quarter shows facts only.
- Every reviewed snapshot freezes observation references, metrics, limitations, Inventory context hash,
  mapping version, policy version and narrative, and states **indicative — not a valuation**.

## Permission matrix

| Action | Full Admin | Admin Assistant | Agent | Manager/Director |
| --- | --- | --- | --- | --- |
| Stage/view DLD batch | Yes | Yes | No | No |
| Accept/reject/retire batch | Yes, direct | No | No | No |
| Draft Community/mapping | Yes | Yes | No | No |
| Activate/retire Community/mapping | Yes, direct | No | No | No |
| Assign active Community to scoped Inventory | Yes | Yes | Scoped | Scoped |
| View intelligence | Yes | Yes | Scoped | Scoped |
| Create snapshot | Yes | No | Scoped | Scoped |
| Review snapshot | Yes, direct | No | No | Scoped |

## Idempotency and concurrency

- Canonical fingerprints use stable field ordering and SHA-256.
- Staging retry with the same idempotency key and same request fingerprint returns the existing batch;
  different content returns 409.
- Dataset + file hash prevents duplicate staging under a new key.
- Transaction advisory locks serialize Community, mapping, batch and source-record activation.
- Partial row inserts or observations roll back as a unit. Newly stored source files are cleaned up only
  when staging fails before a governed batch owns them.
- Terminal review retry with the same request fingerprint returns the event; a different decision returns 409.

## Rollback and reversibility

Before migration 087 is ever applied, implementation tests must prove complete rollback on an empty
schema and transaction rollback for every write path. The migration remains additive and unapplied in
this package. No legacy data is updated.

If an unshared local test database must be rolled back, drop the new objects in dependency order and
restore the previous audit constraint. After any accepted evidence exists, destructive rollback is not
an operating procedure: immutable source/audit records must first be exported and reconciled through a
separately approved recovery plan.

## Required Gate 3 tests

1. Community/mapping draft, direct full-Admin activation, supersession and guarded retirement.
2. Admin Assistant can stage/draft but cannot activate, accept, retire or review.
3. No maker-checker guard blocks a full Administrator acting on their own record.
4. Unsupported content type/schema, invalid UTF-8, oversized file and over-row-limit file fail safely.
5. Both approved DLD formats normalize through separate explicit adapters.
6. Non-sale, invalid and in-file duplicate rows receive stable rejection reasons.
7. Exact file and every row hash are stable; source file persists as restricted immutable Document Version.
8. Staging and acceptance retries/concurrency produce one batch and one observation per source identity.
9. Any acceptance conflict rolls back the entire observation set.
10. Unmapped evidence cannot feed Inventory intelligence; text similarity never links it.
11. No listing Community is backfilled; explicit scoped assignment is audited.
12. Missing/stale/retired mapping or batch fails closed only for the advisory panel.
13. Three-comparable minimum, weighted average, medians, variance and observed range are exact.
14. One-quarter evidence produces no trend; two to four quarters produce the governed series.
15. Snapshot rejects stale Inventory/report fingerprints and freezes exact evidence when accepted.
16. Snapshot review permissions and terminal idempotency are enforced.
17. API/audit output contains no storage key or buyer/seller/owner/contact/authority data.
18. No Inventory price, availability, Area, Community text, status or workflow transition changes implicitly.
19. No portal, DLD, AI, messaging or external network call exists in package code.
20. Focused tests and the complete repository suite pass offline.

## Explicit exclusions

Property Finder and every portal; live DLD/Dubai Pulse/Dubai REST access; scraping/CAPTCHA; valuation or
price recommendation; private-party ingestion; automatic Inventory mutation; AI or external delivery;
CRM Test, Production, R2, cPanel, migration execution, packaging, deployment or restart.

## Gate 2 approval

Approval authorizes implementation of proposed migration 087, local APIs, CRM UI and tests in the dirty
local worktree only. Migration 087 must remain unapplied. Gate 3 will present the working local story and
test evidence before package completion.
