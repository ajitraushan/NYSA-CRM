# UAT fix reconciliation — 13 October 2026

Target: CRM Test only. Baseline: DEV226, Git commit `9db8387b8bdbd66087414ec62adf387c82172e79`. Candidate changes are local and not deployed. Production and R2 are unchanged.

## Count and scope

Exactly **12 items: 7 defects, 3 specification gaps, 2 enhancements**. No extra numbered item is included. The original session register preserves the reported issues; this reconciliation records implementation progress rather than rewriting historical observations.

| Reference | Approved scope and implementation | Verification / remaining acceptance |
|---|---|---|
| DEF-126 | Allow ordinary property-source `contact` text edits; reject explicit calculated portal-readiness writes; retain edit authority and cross-field validation. | Synthetic PATCH persists corrected text; explicit portal write rejected. Exact-record human retest pending deployment. |
| DEF-127 | Submitted Inventory verification/exemption appears once in the responsible Manager's My Tasks; Review Inventory opens the exact record; source decision resolves it. | Synthetic submission, current Manager scope, Director exclusion, open/completed lifecycle passed. Browser task navigation and volume checks remain. |
| DEF-128 | Mandate is optional for internal conversion; Inventory provides private PDF upload, retained replacement versions and existing agreement metadata. External publication authority is unchanged. | Private PDF versions, retrieval and unauthorized denial passed; browser register shows both versions. Upload retry retains the same agreement. Internal conversion and rollback rehearsal remain. |
| DEF-129 | Actionable safe Calendar errors; deterministic event ID, serialized retries, atomic mapping/audit and provider reconciliation. | Mocked invalid authorization, provider success/local persistence failure and concurrent retries passed without external sends. Test log identifies refresh-token failure before creation. Live connection diagnosis/reconnection and final human send remain. |
| DEF-130 | Derive words from exact Offer revision amount, including fils; retain issued PDF immutability. | Domain tests passed; synthetic AED 7,200,000.45 PDF rendered and visually inspected, one A4 page without clipping. Historical PDFs require governed revision/reissue. |
| DEF-131 | Both sides, actual party identity and evidence on the same new/revised Offer are required; enforce API and Booking/Deal guards. Flag historical accepted/booked records without rewriting them. | Seller-only stays sent; direct accepted-state mutation and Booking rejected; buyer acceptance unlocks exact revision. Domain duplicate/mismatched revision/legacy tests passed. Additional concurrency/revision/Deal tests remain. |
| DEF-132 | Pending MD says Pending MD approval; no blank payment metadata or postpayment advice controls before payment. Retain recorded-payment advice guards. | Implementation present; complete browser and lifecycle verification remains. |
| SPEC-GAP-003 | Link existing Customer to Inventory owner/party, inherit master identity, persist ID and audit corrections; retain manual capture and permissions. | Synthetic link/correction passed without duplicate Customer. Browser search selects master and locks inherited fields. Correction/add-new transitions remain to check. |
| SPEC-GAP-004 | Shared mobile and clearly labelled Passport/Emirates ID **last-four** search across Customer, Lead, Opportunity, linked-owner Inventory and Customer selectors. No full identifier storage/search. | Scoped API results and invalid full-ID rejection passed. Owner picker browser passed. Lead/Finance selectors, phone-format variants, reset and volume checks remain. |
| SPEC-GAP-005 | Readable property/unit/Dubai date/revision Offer filenames for view/download headers; bounded, sanitized Unicode; unchanged PDF bytes and permissions. | Domain filename/header tests passed. Exact browser Save As/download verification remains. |
| ENH-001 | Reusable task category/request-type catalogue, scoped counts, search/status, 25-row pages, retained navigation context and General/Other. | Domain filtering/paging and unknown types passed. Filters plus DEF-127 implemented. All eligible Manager/Director review queues are explicitly approved for inclusion. Nineteen additional source examples passed exact-link, role-exclusion, duplicate and decision-sync checks. Director read access to every CRM document is explicitly approved; approval/edit authority stays governed. Remaining source/UI coverage is still in progress. |
| ENH-002 | MD Agent/current Team/currency summary, submitted pending amount, Dubai quarter/calendar-year YTD/lifetime net recorded payments; filters/sort/pages; drill-down retains approvals and evidence requirements. | Independent synthetic reconciliation: pending 150, quarter 1,000, YTD 1,200, lifetime 1,300 after reversals. Director allowed/Accountant denied. Browser summary/detail/back passed before latest filters; boundaries/currencies/volume/final UI checks remain. |

## Approved clarifications

- Identity lookup uses existing masked final-four values, explicitly labelled.
- Existing accepted/booked offers are flagged; the bilateral gate applies to new/revised offers.
- Payment totals use Dubai reporting dates, calendar-year YTD, net reversals and current maintained Team; currencies remain separate.
- Optional mandate uses existing private PDF controls/size limit; replacements remain immutable versions.
- All eligible review queues must appear in My Tasks with category and request-type filters.
- Director may read all CRM documents, including restricted/private documents and retained versions. This expressly expands document visibility; it grants no new editing or decision permissions. Other roles retain their existing scope.

## Test receipts so far

- Full regression: **1,693 tests; 1,606 passed; 87 skipped; zero failed**, after the final Director permit-read and review-navigation edits. Skips are not claimed as executed integration coverage.
- Focused domain plus Director identity suite: 8 passed, zero failed.
- Migration 136 transactional forward/rollback rehearsal passed in a disposable local schema; no real records were changed.
- Search API matrix passed phone, Passport last-four and Emirates ID last-four across Customer, Lead, Opportunity, Inventory, Inventory owner selector and Finance payer selector, including stored phone variants and invalid full-ID rejection.
- Isolated synthetic API fixture: Inventory validation, identity searches, Customer linkage/audit, mandate private versions, Manager task lifecycle, MD authority/totals, bilateral offer enforcement and mocked Calendar recovery passed.
- Synthetic browser checks and PDF proof are saved under ignored `uat-evidence/`. No actual customer invitation, payment or approval was performed.

## Release gates still open

Complete the remaining matrix checks and final regression, finish expanded ENH-001 source/UI coverage, then commit/push only approved files and build exclusively from an origin-advertised full SHA using the canonical release command. Verify package provenance before CRM Test deployment. No package/deployment is claimed by this interim reconciliation.

Migration 136 adds optional mandate document linkage and bilateral acceptance evidence/defaults/guards. Application-only rollback to DEV226 would not be sufficient to process new bilateral revisions under the old single-acceptance code. Preserve postmigration evidence; prefer a verified roll-forward or an explicitly approved database recovery plan rather than deleting acceptance history.

Director document-read verification: generic restricted PDF view/download, optional mandate version listing/reading and external permit evidence pass for Director. Director mandate upload remains denied; Accountant private mandate/permit and scoped review-document access remain denied. Inactive/external identities do not qualify for the Director read rule. No migration is needed for this document visibility rule.

## Superseding document-access instruction — 23 October 2026

The user expanded document reading from Director-only to every active signed-in role, including KYC documents. This is implemented and verified locally; editing, uploads, financial posting and review decisions retain their existing rules. See [the document-access verification](UAT_20261023_DOCUMENT_VIEW_ACCESS.md) for the eight-role HTTP matrix, regression results, privacy impact and rollback. Earlier Director-only verification and Accountant document-read denials above are historical and superseded. Hosted deployment remains outstanding.

## DEV227 release scope — 23 October 2026

DEF-133 is assigned to the all-role document-viewing correction. The cumulative release now contains **13 items: 8 defects, 3 specification gaps, 2 enhancements**. The original 12-item count above is historical. Only these approved changes, their tests, migration 136 and required release metadata/deployer are included. Unrelated local files are excluded.
