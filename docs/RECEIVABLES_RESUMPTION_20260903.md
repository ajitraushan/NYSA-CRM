# Receivables resumption — 3 September 2026

Status: **local work in progress, not packaged or deployed**. Owner request: “can u now work receivables part”.
Manager Deal closure was separately human-confirmed on CRM Test dev.178; this is not receivables acceptance.

## Governance and baseline

Read AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md completely. CORE remains authoritative;
preserve dirty work, use only guarded synthetic local data, retain recoverable snapshots, do not
alter protected environments or unapproved finance/approval rules. No browser or remote mutation.

Recorded deployed baseline: dev.178, package SHA-256
`1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migration114/count113
(deferred113 absent), historical worker280206. Remote rollback:
`/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z`.
Local source is still provisional dev.177 plus approved later corrections; no deployable version
or candidate hash is claimed for this unfinished work. Historical migration113 already exists
on the local fixture and was not edited or re-applied.

Before changes: `remediation-baselines/receivables-resume-20260903/before-resume.zip`, SHA-256
`91ad86480814a225d76141ee2ce5e44ae6e913d69bea6f1e272b328a09b08f5d`.
Guarded local fixture backup, archive listing verified:
`uat-evidence/fixture-backup-2026-09-02T20-57-24-396Z/before-commission-proof.dump`,
1,664,479 bytes, SHA-256 `77d8ba47fb32dc8850f9d0131a631131bae08d7fcc25653cf7b8e4dd0f4485e1`.
The established helper retains its historical filename. Initial sandbox spawn EPERM was resolved
by approved execution of that same loopback-only backup helper. No remote credentials printed.

## Work completed locally in this turn

- Reconciled prior receivables draft against the newer Accountant boundary: add only Receivables
  to Dashboard, Opportunities, My Leave and Finance Receipts. Explicit API route allowlist;
  unrelated customer/lead/inventory/admin access and Accountant payout remain denied.
- Add finance-only Opportunity context: current agreed commission, originating/servicing split,
  frozen expected company receipt and existing non-cancelled scheduled commission. Read-only;
  no contact/private operational details. Uses existing commission calculation. Missing Deal
  value is shown as unavailable, never invented. UI offers remaining commission as an initial
  value when the amount is empty, without overwriting entered figures or treating splits as payout.
- Share K/M/comma monetary parsing across receivable schedule, instalments and collections.
  Server validates exact cents, amount ceiling and invoice balance; UI schedule preview parses
  shorthand. Existing per-invoice fixed 5% user-requested VAT calculation remains unchanged.
- Retain separate invoices per instalment, payer selection, dates/reference, statuses, partial
  collection, reversals/cancellation and immutable audit mechanisms from the prior draft.

## Historical decision point — superseded by owner approval

Owner subsequently agreed: separate invoices per scheduled instalment, multiple partial payments
per invoice, each payment entered once with a linked net Finance Receipt. Implemented locally with
additive migration115 and synthetic verification; not deployed. See
[single-entry workflow, constraints and evidence](RECEIVABLES_SINGLE_ENTRY_PAYMENT_WORKFLOW.md).
The following describes the earlier unresolved state, retained as history.

Prior draft keeps receivable collections and Deal commission receipts in separate ledgers with
no posting link. This would require duplicate recording and has not been approved as the final
workflow. Asked owner whether to record payment once per invoice and carry its commission-only
(excluding VAT) amount into Finance Receipts, preserving Director payout approval.
Awaiting that choice before implementing the financial-posting contract. No automatic receipt
posting, confirmation, credit or payout was added in this turn. Current local collection UI
still explicitly discloses the old separation; this is unfinished, not a ready-to-deploy claim.

Following approval, define and test linked immutable postings, partial-payment VAT allocation,
reversals/idempotency, handling existing receipts without double counting, and confirmation after
closure. Final invoice production versus recording externally issued invoice references also
needs to remain explicit. Statutory invoice/PDF, tax-credit-note and external accounting claims
are not made by this register. No banking/payment execution, payout-request development or
production data backfill authorized or performed.

## Verification

- Ordinary suite: **1,349 total /1,291 passed /58 protected skips /0 failed**,
  `docs/receivables-resume-ordinary.log`.
- Guarded receivables HTTP/DB: **9/9**,
  `docs/receivables-resume-db.log`; includes read-only split/context permissions.
- Guarded proof/receipt regression: **6/6**,
  `docs/receivables-resume-proof-db.log`; includes existing Deal commission flowing into context.
- Focused domain/access/UI-contract checks7/7; syntax and scoped whitespace checks passed.
- First DB rerun expected400 for malformed path; Accountant's strict boundary correctly returned403.
  Test now explicitly expects boundary denial. No permission was broadened for malformed paths.

No fresh browser validation or human receivables pass claimed. No migration/deployment in this
turn. Existing dev.178 closure fix, Director payout authority, historical dev.174 package/migrations/
worker/test evidence and production/R2/Property Finder exclusions preserved. Safe rollback is a
scoped source restoration; never restore the entire fixture over later work or delete financial history.
