# Accountant Workspace specification, acceptance criteria and test plan

Reference: ACC-WS-001
Date: 2026-10-10
Status: Agreed design translated into implementation requirements; implementation and test execution pending.
Product owner: NYSA business owner. Operational owner: Accountant. Approval authority: MD/Director.

## Baseline and scope

Application baseline: 2.1.0-dev.225, Git commit 2b451ba0dbab84132bee6be139871c3e21f81fb4. CRM Test deployment evidence: uat-evidence/dev225-release-status.txt. Database baseline: 134 migrations, latest 134_customer_identity_audit_types.sql. Rollback point: /home/nysareal/crm-backups/consolidated-crm-test-dev225-20261010T095338Z. BASELINE.md retains historical DEV208 governance evidence; the DEV225 evidence establishes the current implementation baseline.

This document changes no runtime, database, permissions or configuration. Develop with synthetic fixtures and verify in CRM Test. Production and R2 remain unchanged. The uncommitted buyer-as-payer default is a separate pending source change to include and verify in the eventual release.

Scope: complete Accountant finance navigation, paginated work queues, read-only transaction tracing, agent statements and automatic payout advice after recorded agent payment. Retain existing commission calculations, receipt eligibility, MD approval, payout amounts and role boundaries. Email sending, banking integration, automatic transfer execution and new reversal business rules are outside this release.

## Workflow and navigation

Closed Won deal -> commission invoice -> actual client collection -> eligible agent credit -> payout preparation -> submission -> MD approval -> actual agent payment recorded -> agent payout advice.

Invoice creation alone does not establish payout eligibility. MD approval alone does not establish payment. The recorded agent payment is the source of payout advice.

One Accountant Workspace, with Overview as its landing page. Main tabs remain visible; each main tab contains category tabs with count badges. On narrow screens use a labelled tab selector with the same categories. My Leave remains a separate personal workspace.

| Main tab | Category tabs | Default category | Record grain / principal action |
|---|---|---|---|
| Overview | No secondary tabs | Overview | Action counts and totals; open filtered queue |
| Client Invoices | Awaiting invoice; Issued; Change requests | Awaiting invoice | One opportunity awaiting invoice, one issued invoice, or one change request; create/view/request change |
| Client Collections | Awaiting payment; Part paid; Overdue; Collected | Overdue when nonempty, otherwise Awaiting payment | One invoice; record actual receipt or view collection history |
| Agent Payouts | To prepare; Ready for approval; Pending MD; Approved - Pay now; Paid | Approved - Pay now | Eligible credit row, calculated payout row, or approval/payment batch; prepare/submit/record payment |
| Agent Statements | Current quarter; All quarters | Current quarter | One agent/quarter/currency summary; open full calculation statement |
| Payout Advice | Generated; Pending generation; Generation failed | Generation failed when nonempty, otherwise Generated | One agent per recorded batch payment; preview/download/retry |
| Opportunities | Read-only register | Register | One opportunity; view linked deal, invoices, receipts, payouts and advice |

Category definitions must follow persisted workflow state, not visual labels. Pending MD, approved and paid views use one batch summary row, with child payout rows loaded on opening details. A partially approved batch may appear in both pending and approved categories, with explicit pending/approved item counts and category-specific amount; paid history shows only the recorded paid portion. Rejected/returned items and cancelled/superseded invoices remain accessible through status filters and history; they must not disappear from audit tracing.

Collections categories are intentionally overlapping: Overdue includes unpaid or part-paid overdue invoices. Counters are labelled and must not be summed as mutually exclusive totals. Collected contains fully settled invoices; partial collection events are also accessible from invoice details.

## Screen design

Persistent workspace header: title, active tab, refresh control and updated-at time. Overview shows counts and currency-separated totals for awaiting invoice, overdue client balances, payout preparation, pending MD, approved unpaid payouts, and failed advice generation. No full register or statement is rendered on Overview. Each card opens its exact queue/filter.

Each queue has: title/count; search; category-specific filters; sortable compact table; pagination; empty/loading/error states. Search by opportunity, deal, invoice, batch or advice reference and agent/payer name as relevant. Filters include date range, agent/team where authorized, quarter, currency and status. State persists in the URL for refresh/deep links and on returning from details. Clear filters restores the category default.

Typical columns:
- Invoices: invoice/opportunity reference, payer, invoice date, due date, total, status, action.
- Collections: invoice/opportunity, payer, total, collected, balance, due date, status, action.
- Payout batches: batch, agent/row counts, category amount, approval/payment date or due date, status, action.
- Statements: agent, quarter, currency, earned, paid, remaining, View statement.
- Advice: advice reference, agent, batch, payment date, amount, generation status, Preview/Download.

Details open in a keyboard-accessible side panel with full-width fallback on small screens. Closing restores scroll/filter/page/selection. Wide calculation statements open a dedicated page with back navigation and PDF controls. Numbers remain full precision to currency display rules, with right-aligned amounts. Colour supplements text labels. Primary actions use shared visual components; no whole-row implicit financial submission.

Bulk preparation/submission: explicit selection, count and currency-separated totals. Default no rows selected. Select page selects visible records only; cross-page selection requires an explicit count and review list. No batch mixes currencies. Refresh preserves still-eligible selections and identifies removed/stale rows. Recording payment retains current whole-approved-batch semantics; no new partial agent-payment feature.

## Volume and data contract

All queue filtering, sorting, totals and pagination occur on the server. Default 25 rows; selectable 50. Requests reject page sizes above 50. Responses return items, filtered total count, currency-separated totals, as-of time and pagination information. Stable ordering includes a unique identifier tie-breaker. Where keyset pagination is appropriate, preserve cursor history for Previous; report real totals without silently capping them.

Only the active queue loads full rows. Badge counts use aggregate queries. No full payout history, every batch item, or every agent-quarter calculation may be sent to render one page. Details and statements load on demand. Switching filters resets the page; stale in-flight responses cannot overwrite the current queue. Counts/totals use the same filters and eligibility definitions as rows. API authorization applies independently of UI visibility. Add indexes based on representative query plans, through governed migrations if needed.

Proposed performance acceptance budget on a documented CRM Test-like environment: synthetic 100,000 invoices, 100,000 payout rows, 10,000 batches and 10,000 advice documents. At 20 concurrent read users, filtered first-page API p95 <= 2 seconds and p99 <= 5 seconds; advice download p95 <= 3 seconds for stored files. Initial active-queue row response <= 300 KB excluding PDF. No more than 50 top-level register rows in the DOM. Record hardware, dataset, query plans and cache state; do not claim production capacity from an unrepresentative local run.

## Payout advice specification

Create one immutable advice per agent, currency and recorded batch payment. Group that agent's paid items into the advice; include no other agent's rows. Unique identity binds payment event/batch payment identity + agent ID + currency. Retry/replayed payment calls reuse the same advice intent and document; sequential advice references use a governed unique allocation, provisionally NYSA-PA-YYYY-######.

Document title: Agent Commission Payout Advice. Fields: advice reference, agent display name, batch reference, approval reference/date, actual payment date, bank payment reference, currency, total actually paid, and line items containing opportunity/deal references, property/unit where maintained, settlement quarter, paid commission and applicable paid adjustment. Line totals reconcile exactly to the agent's recorded payment share. Include NYSA branding and a statement that Finance recorded the payment. The advice documents that payment, not the entire quarter's earnings or a bank-issued confirmation. Avoid full bank account details and private identity data.

Use the existing governed PDF/private-document infrastructure with a new approved document type/template as necessary. Preserve stored input snapshot, template/brand version, generated file hash, private storage key, creator/system actor, payment linkage and creation time. Download returns the stored document; subsequent name, policy, branding or statement changes cannot rewrite it. Existing quarterly statement remains a separate document.

Payment transaction atomically writes current release events/status/audit and a durable advice generation intent for each paid agent. Commit payment before rendering PDF. An asynchronous recoverable worker generates the documents, without executing bank transfers. Render failure sets generation failed/pending with a safe error and retry; it never rolls back or repeats payment. Worker crash, duplicate delivery and concurrent retry must not allocate duplicate advice or attach the wrong file. Payment success UI shows advice pending/generated status and links when available. Generation failures appear on Overview and Payout Advice; ordinary refresh can discover completed generation.

Access: Accountant and existing authorized MD/Director finance roles may view relevant advice; agents can view/download only their own through a scoped My Payout Advice entry. No new access to colleagues' payments. Storage is private; every preview/download checks authorization. Advice is generated automatically; email is not sent automatically in this release. View/download/retry is auditable under existing document audit conventions.

Historical paid batches: no automatic bulk backfill. Offer an explicitly scoped generate-advice action only after implementation confirms sufficient recorded payment evidence; mark it as generated retrospectively with original payment date and current generation date. Missing evidence produces a visible blocker. Existing payment records remain untouched. If payment correction/reversal is already supported, link the advice to that event and visibly flag its current validity without changing the original PDF; do not introduce a new reversal authority in this work.

## Acceptance criteria

| ID | Pass condition |
|---|---|
| ACC-01 | All seven main tabs and category tabs render for Accountant; My Leave remains accessible; URLs reopen the same authorized category/filter. |
| ACC-02 | Overview cards show complete actionable counts/totals and open matching queues; no historical statements load there. |
| ACC-03 | Every register supports server-side search/filter/sort and 25/50 paging with deterministic ordering; no hidden hard cap loses records. |
| ACC-04 | Back/close/refresh preserve category, filters and page; rapid navigation cannot display an old response in a new category. |
| ACC-05 | Detail panels and statement pages expose linked references and history; the source opportunity remains read-only for Accountant. |
| ACC-06 | Awaiting invoice loads a Closed Won opportunity; maintained buyer defaults for applicable resale deals, remains editable, and off-plan Developer requirement holds. Company TRN is used; individual TRN remains not applicable. |
| ACC-07 | Invoice issuance and client collection retain VAT, instalment reconciliation, date, evidence, audit and idempotency checks; an invoice alone creates no eligible payout. |
| ACC-08 | Eligible receipt rows can be prepared, selected and submitted with reviewed totals; stale/ineligible selections are rejected; currency mixing is prevented. |
| ACC-09 | Pending/partially approved/returned batches show accurate item counts and amounts; only MD-authorized decisions create approved payout items. |
| ACC-10 | Only Accountant records actual payment for an approved unpaid batch; duplicate/concurrent submission produces one payment; paid rows leave Pay now and appear in Paid history. |
| ACC-11 | Agent statement paid/remaining values reconcile to recorded releases; the existing calculation policy and totals are unchanged. |
| ACC-12 | A successful new batch payment creates durable advice intents, one per paid agent/currency; no advice exists for merely prepared/submitted/approved items. |
| ACC-13 | Advice references are unique, amounts reconcile, documents contain only the recipient's rows, and original files remain immutable. |
| ACC-14 | Generation failure leaves payment paid; retry/worker recovery produces exactly one advice without repeating payment. |
| ACC-15 | Finance access follows existing authority; Agent A cannot list/preview/download Agent B's advice, including direct API requests. |
| ACC-16 | PDF is legible for single/multiple pages, long names/references and many line items; stored input/hash/template/payment linkage is auditable. |
| ACC-17 | Layout works at 360, 768, 1280 and 1920 px; keyboard/tab focus, labels, status announcements and detail focus restoration work. |
| ACC-18 | Volume budgets above pass with recorded reproducible evidence; queries load only the requested page and details. |
| ACC-19 | Legacy records remain traceable; no silent historical backfill, new payment, recalculation or permission expansion occurs. |
| ACC-20 | Governed migrations, backup/restore, canonical origin package verification and postdeploy smoke pass before release completion. |

## Test plan

Use synthetic identities and financial fixtures only. Establish known expected totals independently of UI output. Retain baseline snapshots and redact operational evidence. All cases below are planned, not executed by creating this document.

| Test | Scenario and checks | Criteria |
|---|---|---|
| T-01 | Accountant opens each tab/category/deep link; reload/back restores state; other roles receive only permitted navigation. | 01,04,05 |
| T-02 | Fixtures for every queue and overlapping overdue/part-paid states; compare cards/badges/filter totals to independent database aggregates. | 02,03,09 |
| T-03 | More than 50 matches, tied sort values, first/last/empty pages, concurrent insertion; no duplicate/skipped rows within declared paging semantics. | 03,04 |
| T-04 | Delayed request then switch filter/tab; latest request wins; API failure exposes retry while retaining filters. | 04 |
| T-05 | Closed resale buyer default, manual agency override, late context response, missing buyer, off-plan Developer, company TRN and individual no TRN. | 06 |
| T-06 | Invoice instalments and 5% VAT rounding; invalid dates/amounts/evidence; partial/full collections and duplicate receipt; invoices alone cannot prepare payout. | 07 |
| T-07 | Prepare selected rows, missing payout policy, stale receipt/row, select-page count, reviewed total, mixed currency, replay/concurrent submit. | 08 |
| T-08 | MD full/partial approval and return; Accountant cannot approve; only selected approved items reach Pay now; partial batch amounts reconcile. | 09,15 |
| T-09 | Record approved payment, invalid/future/preapproval date, missing reference, unauthorised actor; concurrent duplicate calls; verify one release per item and paid history. | 10 |
| T-10 | Compare statement before/after payment, multiple quarters, split agents and adjustment rows against independent expected totals. | 11 |
| T-11 | Pay batch with three agents and several rows each; exactly three private advice intents/files; per-agent totals sum to batch paid total. | 12,13 |
| T-12 | Crash after payment commit before worker; crash after render before persistence; storage/PDF failure; duplicate jobs and simultaneous retry recover without duplicate payment/advice. | 12,14 |
| T-13 | Change name, branding or statement inputs after generation; original downloaded bytes/hash unchanged; repeated payment returns same intent. | 13,16 |
| T-14 | Agent A tests Agent B IDs via list/detail/file endpoints; logged-out and wrong-role requests fail; only own advice visible. | 15 |
| T-15 | Render synthetic advice PDFs with 1, 50 and 200 lines, long/wrapped text, non-ASCII names; inspect every page for totals, page breaks, headers and clipping. | 16 |
| T-16 | Desktop/mobile widths and keyboard-only use; large table scroll contained; panel focus/back state; status text visible without colour dependence. | 17 |
| T-17 | Seed volume fixture; measure p95/p99 and response size under concurrent reads, filtered scans/counts and detail loading; retain plans/environment evidence. | 18 |
| T-18 | Existing paid/returned/rejected/legacy rows, no evidence for old advice; historical generation blocker; no automatic historical mutations. | 19 |
| T-19 | Forward migration from DEV225 copy; restart/resume generation; rehearse rollback and verify old runtime compatibility or restore requirements. | 20 |
| T-20 | Complete end-to-end CRM Test UAT: closed deal through invoice, collection, payout preparation, MD approval, payment and Agent advice download; reconcile every step. | 01-20 |

Automated layers: domain/unit tests for totals/state/advice grouping; database integration for pagination, access, transactions, concurrency and uniqueness; browser tests for navigation/forms; PDF render inspection; workload tests; human Accountant/MD/Agent UAT. Regression must cover closure/document readiness, receipt posting, payout policy/tier/split calculations, invoice documents and existing quarterly statements.

## Implementation sequence and release gate

1. Shared workspace navigation and server queue contracts/counts/index plans.
2. Invoice/collection queues and transaction detail tracing, including pending buyer default.
3. Payout preparation/approval/payment queues and statement drill-down.
4. Durable advice intents, governed PDF template, retry worker and scoped Agent access.
5. Integration, volume, document, accessibility and role UAT; migration/rollback rehearsal.

Release requires all acceptance criteria satisfied, no unresolved financial integrity or authorization defect, independent amount reconciliation, volume evidence and signed-off Accountant/MD/Agent UAT. List any migrations and exact backward-compatibility constraints before deployment. Preserve verified application/database backup; rollback must preserve new payment/advice records or restore only under an explicitly approved recovery operation. A failed renderer is retried rather than triggering database rollback.

Use only npm run release:package -- --commit <full advertised-origin SHA>, followed by npm run release:verify-package -- <zip> <manifest> <manifest-sha256-file>. Deploy and smoke CRM Test first. Verify navigation, counts, synthetic payment/advice, readiness, version, migration state and protected environments. Production requires approval for the exact resulting version. No tests, migrations or deployment are claimed complete by this specification.

## DEV226 implementation verification, 10 October 2026

CRM Test UAT candidate: 2.1.0-dev.226, based on DEV225 commit 2b451ba0dbab84132bee6be139871c3e21f81fb4. Target is CRM Test only. Local verification used the guarded synthetic PostgreSQL fixture; no customer payments were recorded. Production and R2 remain outside this change.

- Regression: 1,682 tests, 1,595 passed, 87 skipped, zero failed. Skipped database suites are not claimed as executed.
- Additional database/API checks cover all 16 queues, filter validation, role boundaries, combined counts/totals, migration 135, concurrent duplicate batch payment, exactly one advice per agent/currency, failed rendering without payment rollback, retry and private file ownership.
- Synthetic SQL workload: 100,000 invoices, 100,000 payout rows, 10,000 batches/advice, 20 concurrent readers and 60 samples; aggregate p95 1.674 seconds, p99 2.195 seconds, maximum response 17,867 bytes. This excludes HTTP, network and PDF generation and does not assert production capacity.
- Browser checks: invoice buyer default, cancellation/back retaining date and page-size filters, and 360/768/1280/1920 pixel layouts without page overflow. Mobile filters collapse and tables scroll within their region.
- PDF inspection: all pages of 200-line advice (nine pages) and 50 long-text lines (four pages), repeated table headers, page numbering and reconciled final totals.

The explicitly enabled historical DEV177 invoice integration fixture still assumes obsolete open-Deal, Admin-finance and manually dated invoice contracts; it is not a passing test for this candidate and was not weakened. The new synthetic payment/advice integration and current regression suite provide the exercised evidence. Accountant/MD/Agent end-to-end human UAT remains required after CRM Test deployment before production release.

Migration 135 adds private payout advice evidence, its unique batch/agent/currency constraint, immutable-evidence trigger, runtime table/sequence privileges and queue indexes. Existing approval and payment business rules are preserved. Advice access is limited to Finance and the owning agent; there is no automatic email delivery or automatic historical backfill.

The Test installer verifies exact DEV225/migration-134 baseline and takes a dated application archive and custom database dump before changes. Failure restores the application archive; additive migration 135 and any committed advice/payment evidence are retained. Database restoration is a separate explicit recovery operation and must preserve transactions recorded after backup. Exact server backup and deployment outcome must be recorded in the deployment receipt.
