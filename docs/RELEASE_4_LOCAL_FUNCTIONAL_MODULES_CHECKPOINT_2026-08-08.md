# NYSA CORE Release 4 — Local Functional Modules Checkpoint

**Checkpoint date:** 8 August 2026 (Asia/Dubai)  
**Classification:** Local functional design only — not integrated, legally approved, packaged or deployed  
**Workspace:** `canonical-worktree`

## Module 1 — Listing agreement preparation and readiness

- Policy version: `r4-listing-agreement-readiness-v1`
- Domain: `src/listing-agreement-readiness-domain.js`
- Local prototype: `tools/listing-agreement-readiness-local/`
- Review URL while running: `http://127.0.0.1:3225/`
- Status: **WITHDRAWN — DUPLICATES EXISTING READINESS FUNCTIONALITY**
- Owner review decision: withdrawn on 2026-08-08 (Asia/Dubai). This prototype is retained only as
  rejected design evidence and must not be integrated, approved or treated as the Release 4 work
  package. The replacement scope is governed standard-document assembly from immutable CRM source
  snapshots and approved versioned templates.

Proposed functional contract:

- Internal Inventory remains maintainable when agreement inputs or evidence are missing.
- Agreement preparation consumes a versioned Inventory snapshot and opaque represented-party and
  authority-evidence references; it does not expose private party details.
- Agent-controlled workflow metadata uses an approved template reference, governed mandate type,
  agreement period, exact asking-price snapshot, governed marketing scope and special-terms review.
- Draft evidence must bind the exact Inventory snapshot and approved template.
- Signed evidence must bind the accepted draft, represented party, authority evidence, template and
  agreement period, and retain a signed-document SHA-256 without displaying document content.
- External-listing eligibility requires accepted signed-agreement evidence and the separate existing
  publication-readiness evidence. Passing the gate does not publish anything.
- This functional module does not define legal wording, render a legal document, collect a signature,
  upload a file, change Inventory or authority records, or call a portal.

The final legal template, permitted mandate types, mandatory fields, signature method, retention,
access controls and jurisdictional approval require a separately authorized legal/compliance review.

## Verification

- Listing-agreement readiness focused verification: **10/10 passed**.
- Complete repository regression suite at this checkpoint: **620/620 passed**.

## Module 2 — Governed document assembly

- Policy version: `r4-governed-document-assembly-v1`
- Catalogue version: `r4-document-catalog-2026-08-08-v1`
- Domain: `src/governed-document-assembly-domain.js`
- Local prototype: `tools/governed-document-assembly-local/`
- Review URL while running: `http://127.0.0.1:3226/`
- Detailed design: `docs/RELEASE_4_GOVERNED_DOCUMENT_ASSEMBLY_DESIGN.md`
- Status: **WITHDRAWN FOR DLD DOCUMENTS — DO NOT INTEGRATE**
- Owner decision (2026-08-09, Asia/Dubai): CORE will not map fields into or generate substitute DLD
  forms. DLD/official documents are obtained from the authorized external process, uploaded as exact
  evidence, verified, versioned and linked to the relevant Inventory and/or Deal. Existing
  NYSA-controlled Marketing Agreement functionality remains a separate internal-template workflow.

This replacement module separates official smart-contract preparation for Contracts A/B/F,
CORE-generated NYSA templates, externally issued developer e-NOC evidence, and document types whose
business meaning still requires owner definition. Every ready outcome binds exact source versions,
field provenance and a deterministic manifest SHA-256. The local prototype generates no document,
official contract, signature, submission, delivery or CRM write.

Verification for the corrected module:

- Governed document-assembly focused verification: **11/11 passed**.
- Complete repository regression suite after the corrected module: **631/631 passed**.

## Module 3 — Admin document mapper and agent step advisor

- Mapper policy: `r4-document-mapper-v1`
- Step-requirement policy: `r4-document-step-requirements-v1`
- Domain: `src/document-governance-mapper-domain.js`
- Local prototype: `tools/document-governance-config-local/`
- Review URL while running: `http://127.0.0.1:3227/`
- Status: **PARTIALLY WITHDRAWN — RE-SCOPE REQUIRED**
- Owner decision (2026-08-09, Asia/Dubai): withdraw the Admin field-mapper for DLD documents. Retain
  only the useful agent-step requirement/advice concept, re-scoped to obtaining, uploading and
  verifying externally issued evidence. Document follow-up must still use the existing CRM Task model.

The Admin mapper creates and validates new versioned mapping drafts without changing the active
version. Only an approved active mapping profile may feed document assembly. The agent advisor tracks
required/advisory document evidence against an exact workflow step and case, blocks required missing,
pending, expired or mismatched evidence, and proposes follow-up through the existing CRM Task model.

Verification:

- Mapper, step-advisor and assembly-contract focused verification: **17/17 passed**.
- Complete repository regression suite after this module: **641/641 passed**.

## Replacement scope — External document requirement and evidence register

- Status: **OWNER-DIRECTED SCOPE — NOT YET BUILT OR INTEGRATED**
- An active step-requirement profile tells the agent which official document must be obtained and why.
- CORE records the official document type/reference, issuer/source, issued/executed time, expiry where
  applicable, private file version/hash, uploader, verifier and verification decision.
- Each evidence version links to the exact Inventory and/or Deal and may also retain Opportunity,
  Customer and workflow-step provenance where applicable.
- A correction creates a new immutable version; it never overwrites the uploaded official evidence.
- Required missing, pending, rejected, expired or wrong-case evidence blocks only the applicable
  workflow completion gate. It does not prevent unrelated Internal Inventory maintenance.
- The facility does not generate a DLD form, submit to Dubai REST, create a parallel work queue or
  publish a listing.

## Module 4 — Official document requirement and evidence register

- Policy version: `r4-official-document-evidence-v1`
- Domain: `src/official-document-evidence-domain.js`
- Local prototype: `tools/official-document-evidence-local/`
- Review URL while running: `http://127.0.0.1:3228/`
- Status: **OWNER-ACCEPTED LOCAL DESIGN FOR NOW — NOT INTEGRATED**

The local module implements the simplified owner-directed scope using synthetic PDF metadata only.
It validates exact official/issuer references, issue/expiry dates, PDF hash, private evidence version,
Inventory/Deal links and case context. Verification produces the accepted official/external evidence
status consumed by the retained agent-step requirement gate. Revisions append and supersede immutable
versions. No real file, private identity, external request, official-form generation or CRM mutation
is present in the prototype.

Verification on 2026-08-09:

- Official-document evidence focused coverage: **11/11 passed**.
- Combined focused coverage with the retained agent-step requirement gate: **17/17 passed**.
- Full repository suite: **659/659 passed** after the maintenance extension.
- Browser scenarios confirmed: verified transfer evidence may complete; expired and wrong-case evidence
  remain blocked. The review page was left on the safe missing-document scenario.

Owner clarification and maintenance extension on 2026-08-09:

- Workflow steps are predefined by the governed CRM workflow; Admin cannot create an arbitrary step.
- Admin may add an official/external document definition through immutable draft and activation stages.
- Admin may associate an active document with a predefined step as Required or Advisory, with a business
  reason, again through separate draft and activation stages.
- A new CRM workflow step remains a controlled product configuration/development release because its
  transitions, permissions and business effects must be defined together.
- The local Admin Maintenance and Agent View demonstrate that an activated association immediately feeds
  agent advice, but all prototype maintenance remains memory-only and resets on refresh.
- Current focused configuration, evidence, retained step-gate and local-page coverage: **24/24 passed**.

### CRM integration Gate 1 initiated — 13 August 2026

- The next offline package is the Official Document Requirement and Evidence Register integration.
- Gate 1 is documented in `RELEASE_4_OFFICIAL_DOCUMENT_EVIDENCE_INTEGRATION_GATE_1.md`.
- It reuses existing private Documents/Versions/Links, Inventory, Deal, Task and audit authorities.
- No migration, API or CRM UI implementation has started pending owner approval.
- Gate 1 was approved by the owner on 13 August 2026 (Asia/Dubai).
- Gate 2 migration/API review is documented in
  `RELEASE_4_OFFICIAL_DOCUMENT_EVIDENCE_GATE_2_MIGRATION_API_CONTRACT.md`; proposed migration 086
  remains unimplemented and unapplied pending owner approval.

### Official Document Evidence CRM integration checkpoint — 13 August 2026

- Gate 2 was approved by the owner and implemented locally through additive migration 086, which
  remains unapplied.
- Existing private Documents, immutable Document Versions, entity Links, Inventory, Deals, Tasks and
  audit records remain authoritative; no parallel file store, case master or work queue was created.
- Administrator configuration supports immutable document-definition and predefined-step rule drafts,
  separate activation, revisions and retirement. Admin cannot create workflow steps.
- The Deal workflow displays required/advisory evidence, accepts an exact restricted PDF with official
  and issuer references, preserves exact case binding, and requires independent verification.
- Missing, pending, returned, rejected, expired, superseded and wrong-case evidence fails closed for
  the named required step only. Advisory evidence never blocks.
- Follow-up reuses one existing CRM Task per reason/case/cycle. Task completion cannot verify evidence
  or satisfy the step requirement.
- Upload, review and Task creation use canonical fingerprints, transaction advisory locks, immutable
  evidence and atomic audit records. Failed upload persistence removes the newly stored private file.
- No official form is generated, mapped, signed, submitted or transmitted. No Inventory, Opportunity,
  Offer, Booking, Reservation or Deal state changes automatically.
- The real CRM Administration page now lets an authorized user draft document definitions and select
  `Required — mandatory` or `Advisory — non-blocking` for a predefined workflow step.
- Owner authority correction on 13 August 2026: a full Administrator may activate or retire their own
  configuration version without further approval. Admin Assistant remains draft-only; immutable
  versioning and audit remain. Independent verification continues only for uploaded official evidence.
- Active external-listing rules are consumed by the existing Inventory detail workflow; active
  buyer/sale/transfer rules are consumed by the existing Deal workflow.
- Focused official-document integration, CRM UI and upstream verification after the Admin authority
  correction: **45/45 passed**.
- Complete repository regression after the Admin authority correction: **802/802 passed**.
- Migration-free synthetic review surface: `http://127.0.0.1:3234/`; it is loopback-only, GET-only,
  outbound-network blocked and uses synthetic references only.
- Gate 3 local functional story and revised Administrator authority model were owner-approved on
  13 August 2026.
- Gate 4 package completion was owner-approved on 13 August 2026. The Official Document Requirement
  and Evidence Register integration is complete locally; migration `086` remains unapplied.
- No CRM Test, Production, R2, cPanel, Property Finder or external service was accessed or changed.

### DLD Market Data and Inventory Market Intelligence CRM integration Gate 1 — 13 August 2026

- The next proposed offline package combines Module 8's governed DLD CSV import with Module 7's
  Inventory Market Intelligence because accepted observations are the intelligence evidence source.
- Gate 1 is documented in `RELEASE_4_DLD_MARKET_INTELLIGENCE_INTEGRATION_GATE_1.md`.
- The package reuses existing Inventory, governed Area, Document/Version, broker permission and audit
  authorities. It proposes only the minimum canonical Community/crosswalk authority needed to prevent
  unsafe text matching.
- Full Administrator activity requires no second approval; Admin Assistant is stage/draft-only.
- No migration, API or CRM UI implementation has started pending owner Gate 1 approval.
- Gate 1 functional scope was owner-approved on 13 August 2026. Gate 2 schema/API design may proceed;
  material implementation remains pending a separate approval.
- Gate 2 migration/API review is documented in
  `RELEASE_4_DLD_MARKET_INTELLIGENCE_GATE_2_MIGRATION_API_CONTRACT.md`; the exact design-only schema is
  `schema-proposals/release4_dld_market_intelligence.sql.proposed`.
- Gate 2 was owner-approved on 13 August 2026. Local Gate 3 implementation and tests are authorized;
  migration `087` remains prohibited from application.
- Gate 3 is implemented locally through additive migration `087_release4_dld_market_intelligence.sql`
  (unapplied), bounded raw-CSV staging, direct full-Administrator batch/configuration decisions, exact
  Community mapping, immutable observations, Inventory intelligence and reviewed snapshots.
- No legacy Inventory Community was backfilled. Community assignment is explicit and audited; absent
  or inactive mapping/batch evidence blocks only the advisory intelligence panel.
- Focused DLD import, intelligence, CRM integration and local-story coverage: **43/43 passed**.
- Complete local repository regression after this package: **816/816 passed**.
- Migration-free synthetic Gate 3 review: `http://127.0.0.1:3235/`; loopback-only, GET-only and
  outbound-network blocked.
- Owner rejected the initial Gate 3 intelligence story on 13 August 2026 because it did not adequately
  distinguish Studio, 1 BR, 2 BR, 3 BR, 4+ BR, Penthouse and Villa or expose exact building/Community
  scope. Gate 3 was reopened; the earlier 43/43 and 816/816 totals are pre-correction evidence only.
- Corrected Gate 3 retains immutable DLD project/building evidence, derives the seven governed market
  segments, prefers at least three exact building + Community + segment comparables, and visibly falls
  back to same-Community + segment evidence when building evidence is insufficient.
- Corrected focused coverage: **46/46 passed**. Complete repository regression: **819/819 passed**.
- The corrected Gate 3 local story was owner-approved on 13 August 2026 after consistent label/value
  spacing was applied to Inventory ID, building, Community, segment and source-period context cards.
- Gate 4 structured completion evidence and the future dependency/deployment order are documented in
  `RELEASE_4_DLD_MARKET_INTELLIGENCE_GATE_4_COMPLETION.md`.
- Gate 4 was owner-approved on 13 August 2026. The combined DLD Market Data and Inventory Market
  Intelligence integration is complete locally; migration `087` remains unapplied and release/deployment
  work requires separate authorization.
- Property Finder, live DLD access, private-party ingestion and all external/environment work remain
  explicitly excluded.

## Module 5 — Developer, agency and partner master

- Policy version: `r4-partner-master-v1`
- Domain: `src/partner-master-domain.js`
- Local prototype: `tools/partner-master-local/`
- Review URL while running: `http://127.0.0.1:3229/`
- Status: **OWNER-ACCEPTED BACKEND CONTROL SPECIFICATION — INTEGRATION ACCEPTANCE PENDING**

The local module maintains governed organization identities for developers, external agencies,
referral partners and service providers. Licence details are optional for every external organization;
when supplied they are tracked and validated, while unavailable licence information is explicitly
recorded as `not_provided`. Independent source evidence and review remain required.
Exact licence and normalized legal-name matches enter explicit duplicate review. Only a verified,
active immutable version may produce an optional Inventory-organization link; pending, duplicate,
expired and revision-pending versions cannot be linked. This never blocks Internal Inventory
maintenance. Direct owner, internal agent and portal/import origins require no Partner Master;
individual owners remain in the separate secured Inventory Party structure. Service providers are
not Inventory-source relationships. Corrections append a new version rather than overwrite the
accepted identity. The prototype stores no private contact, changes no Inventory and performs no
external request or CRM write.

Verification on 2026-08-09:

- Owner UI correction: page 3229 is Admin organization maintenance only. Inventory origin and owner
  selection belong in the existing Inventory transaction, not the maintenance screen.
- Partner-master domain and maintenance-page focused coverage: **13/13 passed**.
- The optional organization-link contract remains tested for later integration, but is not rendered as
  a separate transaction screen.

## Module 6 — Inventory price and availability history

- Policy version: `r4-inventory-history-v1`
- Domain: `src/inventory-history-domain.js`
- Local prototype: `tools/inventory-history-local/`
- Review URL while running: `http://127.0.0.1:3230/`
- Status: **WITHDRAWN BY OWNER — DO NOT INTEGRATE**

Price and availability changes are append-only evidence events with exact effective time, recording
time, source reference and SHA-256. Only accepted events derive the current Inventory view. A newer
accepted price produces an auditable amount and percentage movement; a stale availability remains the
last accepted value but is visibly marked for reconfirmation. Contradictory same-time observations
enter conflict review and cannot silently replace the accepted state. Returned or rejected events do
not become current. The local module derives a view only and performs no Inventory mutation.

Verification on 2026-08-09:

- Inventory-history domain and local-page focused coverage: **9/9 passed**.
- Full repository suite after Module 6: **681/681 passed**.
- Browser scenarios confirmed accepted price movement, stale availability and conflict review while
  preserving the prior accepted current state.
- Owner decision: the dedicated history package is not sufficiently valuable as a separate function.
  Retain only the current Inventory values and ordinary audit evidence; do not create a standalone
  operating module from this prototype.

## Module 7 — Inventory Market Intelligence

- Policy version: `r4-inventory-market-intelligence-v3`
- Domain: `src/inventory-market-intelligence-domain.js`
- Local prototype: `tools/inventory-market-intelligence-local/`
- Review URL while running: `http://127.0.0.1:3231/`
- Status: **DRAFT FOR OWNER REVIEW — NOT INTEGRATED**

The module selects comparable evidence only from verified licensed or governed-import sources and
requires the same transaction type, property type and exact community where maintained. It calculates
comparable count, median price, median price per square foot, range and subject variance
deterministically. Fewer than three eligible records or wholly stale evidence fails closed without
market metrics or customer output. Community performance is grouped by calendar quarter over up to
the latest four quarters. A customer snapshot requires a human-reviewed narrative, remains indicative and
is explicitly not a valuation. The prototype calls no live source or AI service and sends nothing.

Verification on 2026-08-09:

- Market-intelligence domain and local-page focused coverage: **9/9 passed**.
- Full repository suite after Module 7: **690/690 passed**.
- Browser scenarios confirmed that insufficient and stale evidence block output with unavailable
  metrics, while sufficient evidence produces deterministic review-only results.

Owner-review revision on 2026-08-10:

- Market price per square foot now includes the weighted average (total eligible transaction value
  divided by total eligible transacted square feet) beside the median. The Inventory asking price per
  square foot and its variance to the weighted community average are also shown.
- Inventory-to-market linkage uses a governed CORE community identifier. A versioned Admin-approved
  crosswalk links the DLD source-area label to that canonical identifier; integration must not
  silently auto-link communities by text.
- The Inventory Master panel shows mapping status, mapping version, DLD source area, comparable count,
  weighted average, median, asking price per square foot and variance. Missing mapping or evidence
  blocks only the advisory intelligence output and never blocks ordinary Inventory create/edit work.
- Revised focused domain and local-page verification: **12/12 passed**. The mapped and unmapped local browser scenarios
  were both verified; no CRM write or live-source call occurred.
- Owner trend rule: publish a community price-per-square-foot trend only when eligible data exists in
  at least two distinct calendar quarters. Prefer up to four quarters (one year) where available. If
  only one quarter exists, publish the latest available quarter's count, weighted average and median
  without a percentage movement or trend claim.
- The Inventory panel visualizes weighted average and median price per square foot as separate lines,
  with quarterly sales-transaction volume as bars. The evidence table retains transaction count and
  total sales value. One source transaction counts as one sales record; multi-unit volume is never
  inferred where the source does not provide a governed unit count.

## Module 8 — DLD market-data import contract

- Policy version: `r4-dld-market-import-v1`
- Domain: `src/dld-market-data-import-domain.js`
- Local prototype: `tools/dld-market-data-import-local/`
- Review URL while running: `http://127.0.0.1:3232/`
- Status: **DRAFT FOR OWNER REVIEW — NOT INTEGRATED**

The official Dubai Pulse API CSV and the human-readable DLD website transaction CSV are both treated
as immutable source evidence and normalize through separate explicit adapters. The working
local POC accepts a small UTF-8 CSV up to 5 MB and 1,000 data rows, validates its exact source header,
calculates the source-file and canonical row SHA-256 values in the browser, and offers the staged CORE
CSV as a local download. The converter
requires its file SHA-256 and a row SHA-256, validates the documented transaction identifier, date,
sales group, property, area, amount and transaction-area fields, and produces a stable CORE market-
observation CSV. It derives square feet and price per square foot deterministically. Non-sales,
invalid and in-file duplicate transaction IDs are rejected with reasons. Buyer, seller, owner and
contact identities are not mapped. Every accepted row remains `staged_admin_review`; the converter
cannot execute an import.

The initial acquisition step remains a manual download from the official service. A future agent may
replace only that step after an authorized API/download route and its reuse, retention and automation
terms are confirmed. It must preserve the source file and hash, must not bypass CAPTCHA, and cannot
approve its own import.

Verification on 2026-08-09:

- DLD import-domain and local-page focused coverage: **13/13 passed**.
- Complete repository regression suite: **703/703 passed**.
- A real DLD website download named `transactions-2026-08-09.csv` was validated locally: 24 source
  rows, 18 sales rows accepted for Admin review and 6 non-sales rows rejected. No import was executed.
  Source SHA-256: `e43bd843bbce71c89a0ad77dc60636a8ad38b4519e726c5ea7b231cab3bdfc41`.

Owner-review revision on 2026-08-10:

- The ambiguous export action was renamed to **Download processed file** and is explicitly described
  as an optional local export; selecting a source file does not upload or import it into CORE.
- The page now calculates descriptive analytics from accepted sales: total and median transaction
  value, median price per square foot, represented-community count, off-plan share, transaction date
  range, top-community activity and property mix.
- Analytics are limited to the selected file and are expressly not a valuation or complete-market
  statement. Rejected rows do not enter the KPI calculations.
- Following owner feedback that a monthly download can materially exceed 1,000 rows, the local POC
  now accepts up to **50 MB and 100,000 data rows**. Row hashes are calculated in bounded batches;
  analytics and the processed export cover the complete accepted dataset, while the browser renders
  only the first 100 accepted and first 100 rejected row details. A production ingestion path should
  still use governed server-side batching/streaming.
- Revised focused domain and local-page coverage: **17/17 passed**.
- Reprocessing the real 24-row DLD source produced 18 accepted sales and 6 rejected non-sales. The
  descriptive accepted-sales result was AED 97,884,037 total value, AED 1,623,028.50 median value,
  AED 1,773.86 median price per square foot, 10 communities and 72.2% off-plan share for the two-day
  source period. These figures remain local review output and were not imported.

Larger selected-period validation on 2026-08-10:

- Owner-approved KPI scope now includes accepted-row quality, transaction-value and price-per-square-
  foot quartiles, off-plan versus ready count/value/median, period activity with complete/partial-month
  labels, communities ranked separately by transaction count and value, property and bedroom mix, and
  top-project activity. Every segment displays its observation count and median price per square foot.
- The file and all community/segment breakdowns now also show weighted average price per square foot,
  calculated as total accepted transaction value divided by total accepted transaction area. Median
  remains visible because it is less sensitive to extreme transactions.
- `transactions-2026-08-10 (1).csv` was processed locally at 12,655,781 bytes and 52,196 source rows.
  52,186 sales were accepted and 10 duplicate transaction identifiers were excluded; no import ran.
- Actual source coverage was 2026-03-31 through 2026-07-31. March is correctly marked partial; April,
  May, June and July are marked complete based on file boundary dates.
- Source SHA-256: `e45e2f228eeefc23049a587fdf0e2832b6f61417cd97c074b81168bbb1abcdaf`.
- Revised focused domain and local-page verification remains **17/17 passed**.

## Module 9 — Inventory duplicate detection and merge review

- Policy version: `r4-inventory-duplicate-review-v1`
- Domain: `src/inventory-duplicate-review-domain.js`
- Local prototype: `tools/inventory-duplicate-review-local/`
- Review URL while running: `http://127.0.0.1:3233/`
- Status: **DRAFT FOR OWNER REVIEW — NOT INTEGRATED**

The module compares two Inventory records using governed identity evidence before descriptive facts.
Exact Inventory reconciliation requires the composite maintained key **Unit Reference/Unit Number +
Building + Size + Community + Area** to match. Unit Reference and Unit Number are one business field,
not duplicate inputs. Governed identifiers are used where maintained; otherwise normalized maintained
Area and Community values are compared. All five components must be present and exact for an automatic
active-record block. A close-but-different size, missing component or other descriptive similarity
creates only a review candidate and cannot merge two properties automatically.

The integrated control is designed as a background pre-save gate for manual creation, governed-identity
updates and imports. An exact composite-key match against an **active** Inventory blocks the operation
and returns the existing Inventory reference; no second active Inventory is created. A match against a
**closed** Inventory also blocks creation, alerts the user, and offers a controlled request to reopen that
same record. The record remains closed and uneditable until an immutable manager approval is recorded;
approval reopens the same Inventory with its full status and audit history preserved. Strong or possible
candidates are held as intake outside active Inventory and routed to the existing review work item. Only
an unlikely duplicate result permits new Inventory maintenance. A database uniqueness safeguard on the
normalized governed composite key and active lifecycle state remains required for concurrency protection.

Every candidate routes to the existing CRM work-item model rather than a new queue. An authorized
reviewer may confirm a duplicate and select the canonical Inventory, keep the properties separate, or
defer for further evidence. The immutable decision preview executes no merge and changes no Inventory.
A later controlled integration must preserve source links, media/document versions, activities, audit
history, portal links, and reservation/availability state. The prototype contains no private party
details and performs no CRM or network write.

Verification on 2026-08-11:

- Duplicate-review domain and local-page focused coverage: **18/18 passed**.
- Exact identity, conflicting source identity, strong unit match, possible descriptive match and
  separate-property scenarios are covered.
- Confirm, keep-separate and defer decisions remain non-mutating and use the existing work item.
- Unit Reference and Unit Number are verified as aliases of one maintained business field. Missing
  Building or a non-exact maintained Size cannot produce an automatic duplicate block.

Owner decision recorded on 2026-08-11:

- The background Inventory duplicate-prevention requirement is **APPROVED**.
- It follows the same master-data control principle as duplicate Customer prevention: check identity
  before persistence, block a duplicate active master, and resolve through the existing master rather
  than creating another one.
- Inventory uses the maintained Unit Reference/Number + Building + Size + Community + Area composite identity. Customer identity
  continues to use its separately governed customer-identification rules; the two entities do not share
  identifiers merely because they share the prevention pattern.
- For a matching closed Inventory, creation remains blocked. The same record may be reopened and edited
  only after immutable manager approval, with its lifecycle and audit history preserved.

## Module 10 — External portal reconciliation preview

- Policy version: `r4-external-portal-reconciliation-v1`
- Domain: `src/external-portal-reconciliation-domain.js`
- Local prototype: `tools/external-portal-reconciliation-local/`
- Review URL while running: `http://127.0.0.1:3234/`
- Status: **DRAFT FOR OWNER REVIEW — NOT INTEGRATED**

This provider-neutral module compares an exact governed CORE preparation with a read-only external
portal observation. It may produce no action, a create proposal, a reviewed-update proposal, an
unpublish-review proposal, manual matching, or external-absence evidence. Every non-empty proposal
uses the existing CRM work-item model. It never creates a parallel queue.

The comparison binds the Internal Inventory reference, lifecycle and publication-readiness state,
mapping version, payload hashes, portal listing identity, governed link and observed external status
into deterministic SHA-256 evidence. A portal deletion or unpublication never deletes or closes
Internal Inventory by assumption. A field difference never silently overwrites governed CORE data.

The local prototype supports synthetic Property Finder, Bayut and Dubizzle observations but implements
no provider schema, credential, connector or external request. It performs no create, update, publish,
unpublish, deletion or CRM mutation. Connector-specific execution remains separately gated by approved
access, current vendor specifications, field ownership and explicit authorization.

Verification on 2026-08-11:

- Reconciliation domain and local-page focused coverage: **11/11 passed**.
- Browser review confirmed create proposal, aligned/no-action, reviewed update, unpublish review,
  manual match and external-absence outcomes.
- Property Finder, Bayut and Dubizzle labels all use the same provider-neutral local contract.
- No browser errors, external calls, transmissions or writes occurred.

Owner decision recorded on 2026-08-11:

- Do not create a separate Module 10 CRM menu, workspace or operating queue. Reconciliation runs in
  the background and surfaces its warning or proposed action inside the existing External Portal
  Listing and CRM work-item experiences.
- Local verification proves only deterministic comparison, outcome selection and the no-write safety
  boundary using synthetic snapshots. It does not constitute portal integration acceptance.
- Functional acceptance is deferred until the relevant portal connector can read a real, linked
  agency-owned record in the approved test environment. That later testing must verify provider IDs,
  mapping versions, field ownership, status interpretation, drift detection, retries, audit evidence,
  access denial and actual connector failure behavior without assuming that one portal's semantics
  apply to another.
- Payload and evidence hashes are backend audit evidence, not ordinary operating information. The
  primary user view shows last-checked time, CORE source version, portal observation time and exact
  business-field differences. Hashes are available only inside a collapsed **Technical audit
  details** section intended for authorized administrators or support investigation.
## Inventory duplicate prevention — local CRM integration checkpoint (12 August 2026)

- Exact automatic identity: Unit Reference/Unit Number + Building + Size + Community + governed Area.
- New manual single-property Inventory requires all five components. Unit Reference and Unit Number remain one field.
- Create and identity edits use a transaction-scoped advisory lock and reject an exact active match.
- An exact closed match cannot create a second Inventory. The existing record requires an immutable reopening request and an authorized Manager/Administrator decision.
- Direct `Closed` to `Available` status changes are blocked; approval reopens the same Inventory and preserves the audit history.
- Existing records are not rewritten or backfilled by assumption. Bulk-deal child-property identity remains a separate later integration slice.
- Migration `083_inventory_duplicate_prevention.sql` is additive and has not been applied to CRM Test, Production or R2.
- Verification: focused duplicate/integration checks 22/22; complete local suite 743/743.

## Excel Inventory import duplicate prevention — local integration checkpoint (12 August 2026)

- Approved workbook template: v1.5; governed import contract: `inventory-import-v1.4`.
- The workbook now requires Community, Unit Reference/Unit Number and Building alongside governed Area and Size, completing the approved five-part duplicate identity.
- Preview compares every valid row with existing non-deleted Inventory before any commit. Normalization of case and repeated spaces is aligned with the transaction-time database gate.
- An exact active match is skipped and shows the readable NYSA Inventory reference with navigation to that existing Inventory. No second Inventory is created and no existing fields are overwritten.
- An exact closed match is skipped and instructs the user to request manager-approved reopening of the same Inventory. It cannot create a replacement record.
- Invalid, duplicate-source and exact-identity rows are excluded from the atomic Draft creation set. Commit re-runs the checks under database locks and stops if the reviewed facts changed.
- Duplicate exceptions reuse the existing governed listing-intake work-item model; no parallel operating queue was introduced.
- Technical database identifiers remain navigation values only. The business preview shows the NYSA Inventory reference and status, not UUID or payload-hash values.
- The workbook remains empty of real owner/contact data and contains no live sample Inventory rows.
- No migration, workbook, application package or configuration was deployed to CRM Test, Production or R2.
- Verification: focused import/duplicate/intake checks 21/21; complete local suite 745/745. Workbook contract inspection found 33 ordered columns and zero formula-error matches; all three workbook sheets passed visual review.

## Governed Partner Organization — local CRM integration checkpoint (12 August 2026)

- Policy version: `r4-partner-master-integration-v1`.
- Gate 2 detailed design and Gate 3 local UX were owner-approved before material implementation.
- The integration reuses the existing CRM Company Master as the only stable organization identity; it does not create a parallel Partner Master.
- Immutable governed versions cover developer, external-agency, referral-partner and service-provider classifications. Licence facts remain optional, while an opaque source-evidence reference and SHA-256 are required.
- Exact normalized legal-name and supplied licence-reference matches enter explicit duplicate review. Draft creation, duplicate decision, activation/rejection and retirement enforce Administrator authority and creator/decider separation.
- An accepted correction supersedes the prior active version atomically. Pending corrections do not overwrite or invalidate the accepted version.
- Existing Company contact, address, owner and note fields are not copied into governance evidence or shown in its review panel.
- Optional Inventory provenance supports exact active developer, listing-source-agency and referral-source versions. Service providers cannot be linked to Inventory.
- Inventory link, replacement and unlink evidence is append-only. It never rewrites existing developer text, ownership/represented-party evidence, Inventory state or ordinary maintenance eligibility.
- Existing Company and Inventory data is not backfilled, normalized, merged or verified by assumption.
- Migration `084_partner_organization_integration.sql` is additive and has not been applied to CRM Test, Production or R2.
- Focused Partner Master/domain/prototype/integration coverage: **33/33 passed**.
- Complete local repository suite after this package: **765/765 passed**.
- No deployment package, external request, connector, credential field, private identity value or environment restart was introduced.
