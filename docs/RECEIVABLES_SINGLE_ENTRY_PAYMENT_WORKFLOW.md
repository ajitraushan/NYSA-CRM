# Receivables: single-entry payments — 3 September 2026

Status: implemented and verified locally, **not packaged/deployed or human accepted**.
Owner agreed after clarification: each scheduled instalment has its own invoice; each invoice
can receive multiple partial payments. Each payment is entered once, not again in Finance Receipts.

## Owner correction — Opportunity is authoritative (implemented locally)

Owner: “it should be opportunity and not deal..”. This supersedes the Deal prerequisite
described below. Schedules, invoices, collections, balances and finance receipt identity must link
directly to Opportunity ID/reference. A Deal must not be required to record payment, and any later
Deal association must not duplicate or re-enter that payment.

That implementation gap is now corrected locally by additive migration116 and Opportunity-scoped
APIs/UI. It is not packaged, deployed or human accepted. The older migration115 limitations retained
below are historical; current scope and evidence are authoritative in
[Opportunity finance rework](OPPORTUNITY_FINANCE_REWORK_20260903.md).

## Baseline and safety

AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md were read before changes. CORE remains
authoritative; preserve business rules, role boundaries and evidence. Local source is provisional
2.1.0-dev.177 plus approved later changes, HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`.
No deployable candidate version/hash is claimed. Existing dirty changes were preserved.

CRM Test remains dev.178, package SHA-256
`1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migration114/count113
(deferred receivables113 absent), historical one-worker observation PID280206. Remote rollback:
`/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z`.

Source snapshot: `remediation-baselines/receivables-single-entry-20260903/before-single-entry.zip`,
SHA-256 `145f12185b2528df168bc92e94ce510fafc967bcafcd32135a2481f75ea3fa52`.
Guarded loopback fixture backup, archive listing verified:
`uat-evidence/fixture-backup-2026-09-02T21-20-59-402Z/before-commission-proof.dump`,
1,683,083 bytes, SHA-256 `c1d0b8006e75c351a3724f6bfbc573ef0f9ae0aa2df6260645968c952631bc55`.
The established backup helper retains its historical filename. Initial sandbox subprocess restriction
was resolved with approved execution of that same local-only helper; no credentials printed.

## Implemented workflow

1. Accountant prepares an Opportunity-linked schedule, selecting a maintained customer, agency
   or developer payer. Each instalment has its own invoice reference/date, due date and commission.
   Agreed commission and originating/servicing split flow in as read-only context. User-requested
   5% VAT and gross total remain separate; K/M input is supported.
2. Accountant records an actual payment against an issued invoice: gross amount including VAT,
   date, method, bank/finance reference and existing proof or evidence reference.
3. One database transaction writes the gross invoice collection and its net commission-only
   Finance Receipt. Invoice balance/status updates; Finance history shows invoice and Opportunity
   references. No second payment entry is needed. Partial receipts allocate exact integer cents;
   total net/VAT reconciles to the invoice. A VAT-only rounding cent does not invent a zero receipt.
4. Accountant separately confirms reconciliation of the recorded Finance Receipts. New receipt
   or reversal supersedes an old confirmation without changing its historical amounts/evidence.
   No automatic agent credit, payout or transaction closure occurs.
5. An incorrect payment is corrected by linked immutable reversals with a reason, restoring its
   exact original gross/net/VAT allocation. If frozen credit or a non-reversed payout already uses
   the Deal, correction is blocked for Director-led review; this does not implement payout reversal.

Permissions: Accountant sees Dashboard, Opportunities, My Leave, Finance Receipts and Receivables.
No operational Leads/Inventory/Customers/admin or Accountant payout permission is added. Finance
selectors expose maintained reference/name only, not personal contact details. Manager closure remains
independent of commission collection. Director payout approval is unchanged.

## Safeguards and limitations

- New payment posting requires exactly one existing AED Deal linked to the Opportunity, because
  the existing Finance receipt ledger is Deal-backed. Schedule/invoice preparation can happen before
  that Deal exists, but collection cannot. The system neither creates nor closes a Deal implicitly.
- Duplicate normalized bank references are rejected across Receivables and direct Finance entry;
  idempotent retries do not duplicate postings. Concurrent invoice payments cannot overcollect.
- Existing receipts/legacy unlinked collections are not automatically imported or backfilled.
  They require reviewed reconciliation; no allocation/reconciliation UI for historical receipts was
  added. A payment already entered directly in Finance cannot simply be entered again on an invoice.
- This remains a receivables/invoice-reference register, not a statutory invoice/PDF generator,
  tax-credit-note system, bank integration or payment-execution system. No such claims are made.
- Payout requests/calculations/payment confirmations remain outside this change.

## Migration, verification and rollback

Additive migration115 links collections/reversals to their exact Finance receipt and validates
Opportunity/Deal/currency/net amount/identity. Confirmation evidence stays immutable; only
confirmed-to-superseded lifecycle changes are permitted. Shared locks serialize receipt posting,
reconciliation and credit freezing. Applied **only to the guarded synthetic local fixture**,
now through115/count115. Historical113 was not edited. Any future release must include deferred113
and115 with dev.178's existing114; this code must not deploy without its schema dependencies.

- Ordinary suite: **1,356 total /1,293 passed /63 protected skips /0 failed**;
  `receivables-single-entry-ordinary.log`.
- Enabled synthetic receivables HTTP/PostgreSQL: **14/14**;
  `receivables-single-entry-db.log`. Covers partial/complete payments, exact VAT, VAT-only rounding,
  reversals, idempotency/concurrency, duplicates across ledgers, proof/method validation, confirmation
  supersession/reconfirmation, role boundaries, and forced collection-write failure rolling back
  the Finance receipt and idempotency record. The logged synthetic database exception is intentional.
- Existing proof/receipt regression: **6/6**, `receivables-single-entry-proof.log`.
- Existing Manager closure with outstanding commission, then Accountant collection: **2/2**,
  `receivables-single-entry-closure.log`; no automatic payout, no changed closed transaction.
- Syntax/scoped whitespace checks passed. A new rounding test initially assumed a wrong proportional
  split; its scenario was corrected to exercise the actual VAT-only rounding boundary, then passed.

Local in-app browser, synthetic Accountant `AR-UAT-1788384374962`: five intended tabs observed;
entering `0.105K` posted AED105 gross /AED100 commission /AED5 VAT. Finance Receipts independently
displayed the same bank reference and AED100 linked to invoice `AR-UAT-1788384374962-INV-1` and
the Opportunity. Old confirmation remained Awaiting confirmation. No manual duplicate receipt entry.
Screenshots: `uat-evidence/2026-09-03-receivables-single-entry/`.
These are agent-driven local checks, **not human UAT passes**; end-to-end new release UAT is pending.

Rollback: restore only scoped source files from the pre-change archive; retain new immutable financial
history. If migration rollback becomes necessary, stop local writes and restore the paired fixture
backup into a separate guarded recovery database first, rather than dropping linked financial columns
or overwriting subsequent work. No remote rollback was performed or needed.

Production, R2/Production clone and Property Finder untouched. No production personal data used.
Historical dev.174 SHA `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
migrations108–110, one-worker observation and 1,291/1,261/30/0 automated result remain unchanged.
