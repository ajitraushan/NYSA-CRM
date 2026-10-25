# DEF-134–137 local fixes and verification

Date: 25 October 2026, Asia/Dubai. Status: local implementation verified; not deployed.

## Baseline and scope

- Source baseline: DEV227, commit `00d391f3182ba6117ae7a156c36f0b3045c0d4a5`, migration 136.
- Target: local development and restricted synthetic PostgreSQL fixture only.
- Pre-edit copies and baseline note: `tmp/uat-def134-137-baseline/`.
- Production, CRM Test deployed files/data, and R2 were not changed by this implementation.
- No schema migration, operational data correction, routing-rule change or rerouting.
- Separate enhancements ENH-004–008 remain outside this fix scope. Pre-existing untracked files and unrelated work were preserved.

## Changes

| Reference | Result |
|---|---|
| DEF-134 | Admin routing API provides options derived from the active classification catalogue and maintained routing rules. The effective Admin routing loader populates its Business type select from that response and retains the selected value. It excludes the Unconfirmed classification fallback, which the existing routing validator does not accept. No operational access exception or changed routing evaluation rule. |
| DEF-135 | Customer Reset clears Mobile, Passport last four and Emirates ID last four, along with existing filters, before resetting to page one and reloading. |
| DEF-136 | Negotiation form starts with explicit blank outcome/party choices, requires acceptance evidence for acceptance, and names the selected party in the submit button. Non-acceptance history labels identify the actual responding party. A separately downloadable acceptance record uses the exact accepted revision and two valid saved acceptance events. It includes party names, Dubai timestamps, evidence references, recording Agent, agreed amount and original PDF filename/hash. Original PDF and event history are preserved. No acceptance is inferred from remarks. |
| DEF-137 | Opportunity Approved documents includes its Offer issuances, with revision identity and accepted-revision marker, original view/download links and separate acceptance-record download. Unrelated Opportunities are excluded. |

DEF-136 RCA limitation: the live record subsequently saved Seller acceptance and progressed to Booking/Deal without a code change. Backend payload corruption was not reproduced. The local fix removes the observed default-selection ambiguity; it does not claim to correct a proven backend corruption. Historical viewed/acknowledged events are not rewritten. Acceptance records report CRM confirmations, do not fabricate signatures, and do not automatically satisfy the separately configured signed-document approval requirement.

The acceptance record is generated on download from saved events; it is not a newly issued replacement Offer. Historical accepted records without separately recorded evidence for both parties return an actionable conflict rather than inventing acceptance. The new read-only document route follows the already approved all-active-role document-read policy; write, approval and operational workspace permissions remain unchanged. Downloads are authenticated, audited and marked private/no-store.

Runtime files: `public/app.js`, `public/offer-ui.js`, `src/document-read-policy.js`, `src/routes/lead-operations.js`, `src/routes/opportunities.js`, `src/routes/approved-documents.js`, and new `src/offer-acceptance-pdf.js`.

## Verification

- `npm run test:release`: **1,446 tests; 1,360 passed, 86 skipped, 0 failed**. Log: `tmp/def134-137-release-result.txt`.
- New focused tests: **8 passed, 0 failed**, included in the release suite. They execute the changed reset handler, effective Admin loader, routing-options response, acceptance submission handler and issued-document row rendering; verify explicit party/outcome/evidence survive the submitted request; test PDF validation, timestamps, content, original hash, long-evidence pagination and existing document access policy.
- Restricted synthetic database tests: **3 passed, 0 failed**, separately enabled. Existing approved-document schema/immutability tests and new Offer issuance query integration test. The latter creates synthetic issuance rows inside a transaction, proves related Offer and Opportunity rows are included and another Opportunity is excluded, then rolls back. Log: `tmp/def134-137-fixture.txt`.
- Both changed document SQL queries passed PostgreSQL EXPLAIN validation against the restricted fixture. The synthetic catalogue/routing options included Rental.
- Acceptance PDF sample rendered through Poppler and visually inspected after final footer change: legible labels, both party sections, Dubai times, hash and footer; no overlap or clipping. Long evidence is covered by a pagination test. Internal synthetic preview: `tmp/def134-137-pdf/`.
- Changed JavaScript syntax checks and `git diff --check` passed.

The 86 release-suite skips are not passes. Three database cases from that skipped set were subsequently run successfully as stated above; remaining gated suites were not run. There was no deployment or live end-to-end browser test of these modified files. The local unit/handler tests, database contract tests and regression result do not establish a deployment result.

The first sandboxed release run encountered existing loopback-network EACCES failures. The suite was rerun with local networking available and passed. An options refactor was rejected by automatic review; the retained implementation uses catalogue/maintained-rule values and leaves the existing business validator unchanged.

## Rollback and release

No database rollback or migration is required. Revert only the seven runtime files listed above (remove the new acceptance module) to restore DEV227 source behaviour; preserve unrelated user changes. Pre-edit copies are retained locally. No live file rollback is necessary because nothing was deployed.

For deployment, first commit/push the reviewed source, package only through `npm run release:package -- --commit <full-advertised-origin-SHA>`, verify provenance with the required verify-package command, and take a fresh target backup before deploying. No release archive was built from this working directory.
