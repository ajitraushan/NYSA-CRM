# dev.177 — Opportunity commission receivables

Resumed 3 September 2026 after the owner's dev.178 Manager closure retest. This document below
is historical implementation evidence, not the current release status. Accountant access, live
Opportunity commission/split context and shorthand amounts have been reconciled locally.
The old duplicate collection workflow is awaiting a posting-design decision and is not ready
to deploy. See [current work and decision](RECEIVABLES_RESUMPTION_20260903.md).

Date: 2026-09-02. Status: implemented and machine-verified locally; not deployed; human UAT pending.

## Approved scope

User requested an opportunity-wise commission receivables module for Accountant, with customer/agency/developer payer, commission, 5% VAT, total, invoice date, invoice reference and collection status, including off-plan payment schedules. User clarified exactly: “yes separate invoice per payin”.

AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md were read in full before changes. CORE remains authoritative. Only guarded loopback synthetic data was used; no production, R2/Production clone, Property Finder, outbound integrations or real bank payments were touched. Existing dirty worktree changes and prior evidence were preserved.

## Baseline and rollback

- Before this extension: local source 2.1.0-dev.176, Git HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe` plus recorded uncommitted changes; local fixture migrations 1–112.
- Pre-change source/tests/docs snapshot: `remediation-baselines/dev176-before-receivables-20260902/source-and-evidence.zip`.
- Source snapshot SHA-256: `03f34219c56f78fa1d7951cdec8e95c33d9ebdc257c355b9748f1cc74d2a45e9`.
- Guarded fixture dump: `uat-evidence/fixture-backup-2026-09-02T18-57-17-581Z/before-commission-proof.dump` (existing backup helper's filename; this is the pre-receivables backup), 1,509,690 bytes, SHA-256 `d94de92dacd401b67c1b9f3441342346026b64df67d09c556f8ed305c22c73ba`; pg_restore listing verified. Restricted local role has no superuser/create-role/create-database privileges.
- New additive migration: `113_dev177_commission_receivables.sql`, SHA-256 `ec448e4a36854e8eb12f9756d76812e5db9827c5b1b4c10c8e2a322be32077b8`. Applied only to the guarded local fixture. Production GRANT mapping stays in the local fixture runner.
- App rollback: restore the pre-change source snapshot without deleting new financial/audit tables. A destructive DB rollback is not the default; preserve ledger records. Any fixture restoration must target the guarded local DB and use the paired dump after approval if later work would be lost.
- Last verified CRM Test deployment remains dev.175 at `https://crm-test.nysarealty.com/`, migrations 1–111, package SHA-256 `80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`, one-worker observation PID 4184054. No remote revalidation/deployment is claimed in this extension.
- Historical dev.174 remains SHA-256 `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110, historical one-worker observation PID 198393 and automated result 1,291 total / 1,261 passed / 30 protected skips / 0 failed. Not reinterpreted as human UAT.
- No dev.177 deployable package/hash is claimed. A subsequent CRM Test deployment needs the exact candidate package, fresh paired remote backup and authorization.

## Implemented workflow

1. Accountant, Director or full Administrator opens **Receivables**. Other roles cannot use its API or menu.
2. Create a payment schedule: select the existing Opportunity reference and a maintained Customer, Agency or Developer payer. Only identifiers/names/type are exposed in finance lookups, not contact details or broad Opportunity access.
3. Enter total commission excluding VAT, and 1–60 instalments with commission amount, due date and optional milestone. Amounts must reconcile exactly to the entered schedule total.
4. Each instalment is a distinct planned invoice. VAT is the user-requested fixed 5%, rounded per invoice to fils, and the total is calculated server-side. Currency is AED in this version.
5. Open each instalment and record its independently issued invoice date/reference. Case-insensitive invoice-reference uniqueness prevents duplicates. Future invoice dates and dates after the due date are rejected.
6. Record actual collection including VAT, company-account receipt date, bank/finance reference and evidence reference. Partial receipts leave an outstanding balance. Overpayments, premature/future receipts and duplicate references on the same invoice are rejected.
7. Status is derived as Scheduled, Unpaid, Part paid, Paid or Cancelled. Overdue is an additional flag/filter for issued, unpaid balances after the due date, using the Dubai calendar date. An unissued planned instalment is not called an overdue invoice.
8. Search by Opportunity, payer or invoice, filter status and use paginated results. Summary totals cover all filtered records, not just the displayed page. Scheduled amounts are separate from invoiced outstanding balances.
9. Corrections retain original entries: reverse an incorrect collection with a reason; cancel an unpaid instalment with a reason. Issued financial amounts, original collections and audit history are not overwritten. A cancelled reference is not reused. A corrected unpaid schedule/instalment is replaced through a new schedule, not edited in place.

## Explicit boundaries

- This is a receivables register, not a statutory tax-invoice/PDF generator, tax return, credit-note issuer or external accounting integration. Invoice references come from the existing invoicing process. The requested 5% calculation is not a universal tax-treatment determination.
- Collection entries here are **not** inserted again into the existing Deal commission receipt ledger. They do not freeze expectations, confirm Close Won, close a Deal, change Opportunity stage, release inventory or calculate agent payout. Existing net-commission reconciliation/confirmation remains a separate Finance Receipts step. Do not enter the VAT-inclusive total as net commission there. Existing Deal receipts are not automatically imported or allocated to invoices.
- Evidence is a required maintained reference in this register. Existing private Deal commission-proof upload/download remains in Finance Receipts and can supply that reference; no separate receivable-file upload is claimed.
- No bank feed, automatic invoice generation, reminders, foreign currency, rescheduling editor or credit-note workflow was added. No real data backfill occurred.
- Server finance authorization, same-invoice checks, row locks, actor-scoped idempotency, audit records and immutable collection/reversal tables protect writes. UI double-click protection and stable retry keys preserve failed-form input.

## Machine verification

- `npm test`: **1,326 total / 1,271 passed / 55 protected skips / 0 failed** (`dev177-ordinary-tests.log`). Protected DB tests are not counted as ordinary passes.
- New guarded real-DB suite: **8 passed / 0 failed**, covering payer roles, exact VAT/totals, two invoices, immutable history, duplicate/idempotent/concurrent actions, partial/full collection, cancellation/reversal, dates, pagination and all-result totals (`dev177-receivables-db-tests.log`).
- Existing dev.176 private-proof/finance suite: **5 passed / 0 failed** (`dev177-proof-regression.log`).
- Existing explicit governed journey/actual closure: **2 passed / 0 failed** (`dev177-closure-regression.log`). Receivables do not bypass these gates.
- Existing dev.175 UAT-remediation runtime suite: **11 passed / 0 failed** (`dev177-prior-uat-regression.log`).
- JavaScript syntax and scoped whitespace checks passed. The whole dirty-worktree whitespace check still reports pre-existing blank EOF lines in migrations 101 and 106; those unrelated edits were preserved. Initial development checks caught/fixed an ambiguous due-date SQL projection; the final DB suite is green. An ordinary-suite invocation initially inherited the opt-in DB flag without the fixture environment; rerunning in a clean shell produced the final ordinary result above.

Browser skill used for local UI verification with a synthetic Accountant at 1280×720. Created one schedule with AED 4,000 and AED 6,000 instalments; recorded independent references `AR-BROWSER-20260902-01` and `AR-BROWSER-20260902-02`. Invoice 1: AED 200 VAT, AED 4,200 total; collected AED 1,050 → Part paid, AED 3,150 balance; reload retained that result; another AED 3,150 → Paid, zero balance. Invoice 2: AED 300 VAT, AED 6,300 total, Unpaid independently. Filtered register shows AED 4,200 collected and AED 6,300 outstanding. No modal closed unexpectedly or server error occurred during the final browser flow. Desktop screenshots inspected; mobile layout is not claimed as browser-verified in this extension.

Evidence under `uat-evidence/2026-09-02-dev177-local/`:

- `01-partial-collection.png`, SHA-256 `ef9955c582a21b652ee2f94e9d2788ee791a7b5d39241a5b337be7316c631c9a`.
- `02-paid-invoice.png`, SHA-256 `a4861e808122f9a409ae09aff48c75bcd16ece7394f873ae55914d4d16eb5e9e`.
- `03-separate-invoices.png`, SHA-256 `df7916e1a1d2a99542702c40f1c281524ca181dff8048216974b34837702deb2`: filtered two-invoice register summary, synthetic data only.

These are agent-executed synthetic tests, not user-observed passes, not proof of actual money received, and not evidence that the user's original remote defects are resolved. Original human UAT remains pending against an explicitly authorized deployed candidate.
