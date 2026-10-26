# NYSA CORE dev.159 — Consolidated Defect Log, RCA, Deployment and UAT Plan

**Prepared:** 24 August 2026  
**Deployed baseline:** NYSA CORE `2.1.0-dev.158`  
**Local candidate:** NYSA CORE `2.1.0-dev.159`  
**Target if separately authorized:** CRM Test only  
**Current release state:** Local correction, automated verification and deterministic packaging complete; no deployment performed  
**Integration boundary:** Property Finder and all integration switches remain disabled and excluded

## Release-control statement

This document separates the user-observed dev.158 result, confirmed code/data cause, local dev.159 implementation, deployment state and future human retest. A local correction or automated test is not a UAT pass. Every affected item remains pending until the user observes the expected behaviour after an authorized CRM Test deployment.

## Executive scope

The dev.159 candidate addresses 22 tracked observations: reopened UAT-008 plus UAT-049 through UAT-069. UAT-067 and UAT-068 were journey blockers in dev.158. UAT-059 is a confirmed regression; UAT-060 and UAT-061 are confirmed sibling pagination defects found by the same audit. UAT-052 is a repeat manifestation of the earlier explainability/hard-matching concern. The remaining items are newly discovered correction-coverage, workflow, governance or terminology defects unless stated otherwise.

## Consolidated defect, RCA and correction log

| ID | Classification | Defect and business impact | Confirmed RCA / confirmed implementation gap | dev.159 correction scope | State and required retest |
| --- | --- | --- | --- | --- | --- |
| UAT-008 | Reopened failed retest | Qualification could be recorded before substantive Customer contact, allowing readiness claims without discussion evidence. | The prior correction governed progression/activity evidence but neither the assessment route nor its UI action enforced a completed substantive contact outcome. | API gate plus disabled assessment action until completed contact and dated next action exist. | Locally corrected and automated; not deployed; repeat contact-before-qualification journey. |
| UAT-049 | New presentation defect | Developer selector polluted the company name with `Developer Master v1`. | The selector renderer concatenated internal governed-record type/version metadata into the business label; the historical reason for doing so is not established. | Render the company business name only; retain version internally. | Locally corrected and automated; not deployed; visually confirm all Developer selectors. |
| UAT-050 | New correction-coverage defect | Ordinary Inventory maintenance could record a check/effective date but not availability expiry. | UAT-048 added expiry to the focused quick action/API path, while the ordinary form and its update payload retained only the check date. | Add effective/checked and expiry fields to ordinary create/edit; merge patch values and validate expiry is later. | Locally corrected and automated; not deployed; create, edit, clear/replace and invalid chronology tests. |
| UAT-051 | New governance defect | Free-text Community/Building causes duplicates, inconsistent reporting and future portal-mapping risk. | Confirmed implementation gap: Inventory stored location labels directly and had no governed Building master or foreign key. Historical design rationale is not confirmed. | Add governed Building master under Community; Area → Community → Building selectors; retain legacy text for explicit mapping without guessing. | Locally corrected and automated; not deployed; admin maintenance and Inventory cascade tests. Property Finder remains excluded. |
| UAT-052 | Repeat policy defect | Customer-fit variance could act as an unexplained hard exclusion even though a Customer may change budget/preferences. | Opportunity selection used a reduced local predicate while shared eligibility/matching contracts mixed operational validity with Customer fit. | Only operational conditions can make Inventory unavailable; Customer fit affects explainable AI ranking, never selectability. | Locally corrected under versioned v3 policy; not deployed; test all variances plus operational exclusions and reason display. |
| UAT-053 | New workflow defect | After rejection, `Renegotiate same property` exposed no revised-price form, blocking a lower Offer revision. | The recovery button only changed recovery-choice state; no complete visible same-property revision editor was rendered. | Open an explicit recovery panel for the same property with revised amount, validity, reason and next action; preserve immutable prior revisions. | Locally corrected and automated; not deployed; reject revision 1, create/send revision 2 and verify history. |
| UAT-054 | New correction-coverage defect | Verification succeeded but left the checker in the detail screen instead of returning to the queue. | Queue-origin detail opening did not carry a return callback; success refreshed the detail state only. | Pass queue-origin context, close detail after decision and refresh verification queue. | Locally corrected and automated; not deployed; approve and reject from queue. |
| UAT-055 | New role-workspace defect | Checker saw creator guidance and an unnecessary verification-stage custody concept. | Guidance was selected by Inventory status, not viewer role; the same surface also exposed responsible-agent reassignment. | Role-specific checker instructions; remove verification-stage reassignment/custody controls. | Locally corrected and automated; not deployed; compare creator and checker screens. |
| UAT-056 | Superseded original design | Verification reassignment was not visibly reflected, creating ambiguous ownership/approval authority. | Original missing display RCA was not confirmed; the business owner superseded that design by removing the custody concept entirely. | Listing Agent lists and requests verification; checker verifies; Sales Agent selects available Inventory during Opportunity work. Historical evidence remains audit-only. | Locally corrected; not deployed; confirm no custodian/assignment action or approval dependency exists. |
| UAT-057 | New terminology/data-quality defect | Customer role `Developer` conflicted with governed corporate Developer Master. | Contact-role and corporate-governance vocabularies reused `Developer` for different entity concepts. | Remove from new Customer-role choices and reject it server-side; create corporate Developers only in Developer Master. | Locally corrected and automated; not deployed; UI and API validation retest. |
| UAT-058 | New requirement-clarity defect | Mandatory Preferred Channel forced an unconfirmed statement and implied operational/consent effects that were undefined. | The form and API made the field mandatory; no confirmed business rule linked it to routing or consent. | Make it optional and display `Not confirmed` when absent; do not treat it as marketing consent. | Locally corrected and automated; not deployed; create/edit with and without a value. |
| UAT-059 | Confirmed regression | Customer Master always presented only page 1, hiding permitted Customers. | Release 2.6 changed the API/UI to `pageSize=10`; the UI never sent a page number and provided no navigation. | Deterministic 25-row pages, Previous/Next, accurate counts and reset to page 1 on search/filter/sort. | Locally corrected and automated; not deployed; use more than 25 Customers and find a later-page record. |
| UAT-060 | Confirmed sibling regression | Lead Pipeline permanently truncated matching Leads. | The same Release 2.6 limit conversion hard-coded the first ten and exposed no page control. | 25-row pages with deterministic navigation and filter-preserving page reset. | Locally corrected and automated; not deployed; more-than-25 Lead test. |
| UAT-061 | Confirmed sibling regression | Inventory register and Add Lead picker reused an incomplete first-page array, hiding valid Inventory. | `/listings` was converted to a ten-row response and the UI reused it as both register and picker source without navigation/full search. | Paginate the register; provide governed picker search/access to all permitted Inventory. | Locally corrected and automated; not deployed; more-than-25 register and later-record picker tests. |
| UAT-062 | New data-model defect | `Business type`/`Offer type` mixed objective, market stage and segment, making rules ambiguous and inconsistent across Lead, Requirement and Offer. | The same overloaded values (`Sale`, `Rental`, `Off-plan`, `Commercial`) were independently reused as if one dimension. | Owner-confirmed `uat062-v1` catalogue: Customer objective; derived Sale/Rental transaction; Ready / Secondary, Off-plan, Either or Not confirmed market stage; Residential, Commercial, Land, Plot or Not confirmed segment; versioned labels/mappings; legacy exception queue without inference; API-driven Lead controls and AI schema; version/mapping evidence carried through Lead, Requirement, Opportunity and Offer. | Owner-confirmed and locally implemented; automated; not deployed; complete human CRM Test retest pending. |
| UAT-063 | New objective-dependent intake defect | Seller/Landlord Lead capture asked buyer-search budget/area questions and did not start from the property being marketed. | Lead form and API used one buyer-oriented required-field contract for every Customer objective. | Seller/Landlord requires governed Inventory and derives property facts; buyer/tenant keeps search requirements. | Locally corrected and automated; not deployed; test all four objectives and missing-Inventory rejection. |
| UAT-064 | New workflow/policy defect | Governed Customer Selection required prior exact-match evidence but offered no action to request AI ranking. | The selection panel filtered on matching-run/shortlist evidence and rendered no matching action; historical rationale for the hard dependency is not established. | Visible AI-assisted ranking action; explain scores/reasons; operationally valid Inventory remains manually selectable regardless of fit rank. | Locally corrected and automated; not deployed; rank, select low-ranked Inventory and test stale/no-run conditions. |
| UAT-065 | New client-document defect | PDF had a fixed Commercial title, false `Inventory Not recorded`, incomplete property substance and unsuitable broker wording/layout. | PDF title was hard-coded; its query/projection and formatter did not carry/render the full governed property snapshot. | Directional Offer title; complete property/terms; brokerage-language opening; validity; other-party action and non-binding/MOU/SPA/tenancy disclaimers; remove duplication/private contact repetition. | Locally corrected and PDF visually verified; not deployed; generate all four directions and inspect immutable revision evidence. |
| UAT-066 | New offboarding-governance defect | Access/employment could end while active Leads, Opportunities, Offers, Tasks, Viewings, Bookings or Deals still belonged to the Agent. | Access and employment routes updated user state directly and did not query operational ownership. | Impact endpoint and count; block suspend/revoke/employment end with 409 until open work is reassigned or resolved; receiver accepts governed reassignment where applicable. | Locally corrected and automated; not deployed; blocked and zero-impact offboarding tests. |
| UAT-067 | New owner-confirmed blocker | Negotiation had no acceptance outcome; Booking improperly performed acceptance, so step 4 could not complete correctly. | UI deliberately omitted `accepted` for sent/viewed/countered revisions; Booking API accepted and reserved in one action. | Record acceptance in Negotiation against the exact revision; then expose a separate seven-day reservation action that requires prior acceptance. | Locally corrected; real HTTP/PostgreSQL evidence passed in `test/dev159-uat067-068-real-db.integration.test.js`; not deployed; complete both original and revised-Offer human paths. The earlier generic protected-evidence claim was unsupported when written and is superseded by this named test. |
| UAT-068 | New blocker | Creating a governed Deal after accepted Offer and active Booking returned Internal Server Error. | Initial Deal insert had no property pointer and immediately violated `deals_single_property_ck` before the route could create/link the exact Inventory lineage. | Permit transaction-local zero-or-one property, insert staging Deal, insert exact linkage, then update direct pointers/current linkage within one transaction; deferred trigger rejects inconsistent commit. | Locally corrected; real HTTP/PostgreSQL Deal creation and exact lineage evidence passed in `test/dev159-uat067-068-real-db.integration.test.js`; not deployed. The earlier protected Deal-evidence claim was unsupported when written and is superseded by this named test. |
| UAT-069 | New objective-side qualification defect | Seller/Landlord used buyer/tenant-style qualification because models were not selected by objective. | Active model lookup was keyed only by overloaded Lead business type or all-lines fallback. | Version active Qualification Models by canonical Customer objective and select exact objective model. | Framework locally corrected and automated; not deployed. Questions, weights, thresholds and evidence rules require business-owner approval before acceptance. |

## Local verification evidence

- Ordinary application regression: **1,163 passed, 0 failed, 22 protected tests skipped by default** (1,185 total).
- Protected disposable-PostgreSQL gates: **22/22 passed** across dev.158 operational corrections, business-condition gaps, expired-assignment Section 3, Inventory eligibility, coordinated reassignment, real booking concurrency, and the dedicated UAT-067/UAT-068 Negotiation-to-Deal journey.
- Evidence correction: the earlier UAT-067/UAT-068 protected-evidence statement was not supported by a runtime Deal test. The replacement evidence is the named protected file `test/dev159-uat067-068-real-db.integration.test.js`, which performs real HTTP calls and independently verifies committed PostgreSQL state.
- Schema rebuild: baseline plus three uniquely ordered dev.159 migrations; candidate latest migration is `103_dev159_uat062_single_source_classification.sql`.
- Offer PDF: one dummy-data evidence PDF rendered and visually inspected for clipping, overlap, repeated content and required legal/brokerage language.
- Package integrity: **2/2 deterministic builds reproduced the same SHA-256**; the candidate contains 103 uniquely numbered migrations and embeds both owner-confirmed UAT-062 Word specifications as evidence. Final checksum is supplied beside the package and must be verified before deployment.
- These results are engineering evidence only. They do not replace human CRM Test UAT.

## Business-owner confirmations still required

1. UAT-069: approve objective-specific qualification questions, evidence, weights, thresholds, override authority and model activation. The software supplies governance/versioning but does not invent policy.
2. UAT-051: approve the internal Community/Building master maintenance process. Property Finder mapping is outside this candidate and remains disabled.

UAT-062 is owner-confirmed. The two approved Word specifications now contain a controlled confirmation/local-implementation page. This confirmation does not authorize deployment, historical report restatement, Property Finder integration or runtime catalogue editing.

## Proposed CRM Test deployment plan — approval required before execution

### Gate 0 — authority and freeze

1. Obtain explicit user authorization for CRM Test deployment in the deployment task.
2. Confirm target is CRM Test only; record Production and R2-clone pre-deployment snapshots and do not target them.
3. Confirm Property Finder and all integration switches remain disabled.
4. Verify candidate ZIP SHA-256 against the separately generated checksum and embedded manifests.

### Gate 1 — pre-deployment protection

1. Confirm CRM Test health/readiness and current version `2.1.0-dev.158`.
2. Confirm exactly one supervised CRM Test Node worker and no PPID-1 orphan.
3. Create a timestamped application/database backup beside the prior dev.158 backup lineage.
4. Record current migration count (100) and latest migration `100_dev158_uat040_048_operational_corrections.sql`.

### Gate 2 — controlled install

1. Extract to a new temporary release directory; never overwrite the live tree in place.
2. Validate `MANIFEST.sha256` and `RUNTIME_MANIFEST.sha256` before installation.
3. Install the exact runtime files from the manifest, preserving environment configuration and private runtime storage.
4. Run migrations 101, 102 and 103 once under the application migration lock.
5. Restart only the supervised CRM Test worker using the existing service control; do not launch a second worker.

### Gate 3 — technical verification

1. Confirm migration count 103 and latest migration `103_dev159_uat062_single_source_classification.sql`.
2. Confirm `/health` and `/readiness` report ready on `2.1.0-dev.159`.
3. Confirm exactly one supervised worker and no orphan.
4. Run package integrity, smoke, protected PostgreSQL and targeted dev.159 correction gates against the installed runtime.
5. Reconfirm integration switches disabled and Production/R2 snapshots unchanged.

### Gate 4 — rollback criteria

Rollback immediately if migration integrity, health/readiness, worker topology, authentication, core register access, Negotiation/Booking/Deal lineage or data isolation fails. Stop the supervised CRM Test worker, restore the timestamped backup and prior dev.158 runtime atomically, restart the single supervised worker, then recheck dev.158 health/readiness and migration state. Do not attempt a partial manual data repair during the release window.

## Human UAT package — one complete correction round

Use named dummy records only; do not include private Customer, owner, authority or contact data in evidence.

1. **Masters and Inventory:** maintain governed Area/Community/Building; create and edit Inventory; verify effective/expiry chronology; verify checker guidance, queue return and absence of custodian assignment.
2. **Registers:** create at least 26 Customers, 26 Leads and 26 Inventory records; navigate both pages; apply search/filter/sort; select a later-page Customer and Inventory from the relevant journeys.
3. **Four objective paths:** create Buy, Sell, Rent and Rent-out Leads. Confirm buyer/tenant search requirements versus seller/landlord Inventory-derived facts. Confirm `Developer` is absent and Preferred Channel is optional.
4. **Qualification:** record attempted qualification before contact (must block), then substantive contact and dated action (must allow). Confirm the correct objective-specific model; business-owner-approved models are a prerequisite.
5. **Matching:** run AI-assisted ranking; review reasons; manually select an operationally valid low-ranked/out-of-budget property; confirm only operational invalidity blocks and gives a precise reason.
6. **Offer and recovery:** complete viewing/feedback; create and send each applicable Offer direction; inspect PDF; reject revision 1; use same-property renegotiation to lower price; send revision 2; verify immutable history.
7. **Reassignment:** reassign the open Offer/Opportunity to a second Agent, accept the governed reassignment, and verify ownership/history without losing the exact revision.
8. **Negotiation, Booking and Deal:** record Customer acceptance in Negotiation; create the separate reservation; create governed Deal; verify exact accepted revision, Booking and Inventory lineage.
9. **Offboarding:** try suspending an Agent with active work (must show counts and block); reassign/resolve all items; then suspend/end employment successfully.
10. **Regression and exceptions:** repeat rejection, counteroffer, expiry, withdrawal, administrative closure, delink/history preservation, assignment expiry/extension and concurrency cases already covered by protected automation.

## Exit criteria

- All 22 items have a recorded user-observed CRM Test result with screenshot/reference and no private data.
- UAT-067 and UAT-068 blockers pass end to end.
- UAT-062 catalogue version is active and its mapping/version evidence is visible; UAT-069 objective-specific qualification policy is explicitly approved and activated.
- No P0/P1 blocker remains; any accepted lower-severity variance has named owner and disposition.
- Health/readiness, single-worker topology, disabled integrations and untouched Production/R2 are reconfirmed.
