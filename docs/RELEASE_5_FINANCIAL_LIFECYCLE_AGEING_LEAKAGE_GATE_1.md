# Release 5 — Financial Lifecycle, Ageing and Leakage Gate 1

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** withdrawn by owner on 14 August 2026 — existing accounting system is authoritative  
**Proposed migration:** `090_financial_lifecycle_ageing_leakage.sql` — not created or applied  
**Boundary:** local/offline design only

## Business outcome

Provide one governed Deal-level company-receivable lifecycle from expected commission through approval,
invoice, company-account receipt and settlement, with partial allocation, ageing, leakage alerts and
accountable follow-up. The package must reuse the commission and receipt authorities already completed
under migration 088 and must not create a second source of truth for receipt or agent payout.

## Owner decision — package not required

On 14 August 2026 the owner confirmed that NYSA already has an invoice/accounting system. This proposed
CORE invoice, receivable, ageing and settlement package is therefore withdrawn before Gate 1 approval.
No migration 090, domain, API, UI or test implementation is authorized or required from this design.

CORE will not become a second invoice ledger. Migration 088 remains authoritative for Deal commission,
confirmed company-account receipt, agent revenue credit and Director-only agent payout. Any future
accounting work must be designed as a bounded interface/reconciliation with the existing accounting
system after that system, supported exchange method and authoritative ownership are explicitly supplied
and approved.

## Authoritative lifecycle

```text
Expected → Approved → Invoiced → Partially received → Paid/settled
               ↘ Returned       ↘ Overdue          ↘ Variance/exception
```

### Expected

- Source: the current frozen `deal_commission_expectation_versions` record from migration 088.
- Amount, currency, Deal/opportunity version and referral settlement basis are not re-entered.
- A changed commercial basis requires a new governed expectation version, never editing history.

### Approved

- Director approves the exact expected company-receivable amount for invoicing.
- Approval freezes the expectation version and the bill-to party/version.
- Return requires a reason and sends a correction Task to the responsible finance user.
- Full Administrator maintains configuration but does not approve operational receivables merely
  because they are Admin.

### Invoiced

- Accountant prepares and records one or more invoice versions/instalments against the approved amount.
- Each issued invoice records a unique invoice reference/number, bill-to governed party version,
  issue date, due date, currency, amount, tax/fee components if explicitly configured, and controlled
  document/evidence reference.
- Draft invoices may be corrected by versioning. Issued invoices are immutable; cancellation or credit
  note is a separate governed event.
- CORE records/prepares invoice evidence locally but does not email, transmit or post it externally.

### Received

- Source: immutable `deal_commission_receipts` and the current confirmed aggregate receipt from
  migration 088.
- Finance allocates confirmed receipt value across exact issued invoices. Allocation cannot exceed the
  unallocated confirmed receipt or invoice outstanding balance.
- Partial receipt is explicit; receipt allocation never creates or edits a bank-receipt event.

### Paid / settled

- An invoice is `paid` only when allocations and approved credit notes equal the issued amount.
- A Deal financial case is `settled` only when all active issued invoices are paid and there is no
  unresolved expected-versus-invoiced or received-versus-allocated variance.
- “Paid” in this lifecycle means the customer/counterparty has paid NYSA. Agent payout remains the
  separate Director-only migration 088 Payout authority and is never inferred from invoice status.

## Roles and access

| Actor | Proposed authority |
|---|---|
| Accountant | Prepare invoice drafts; record issued invoice evidence; allocate confirmed receipts; work assigned finance Tasks; view accounting-operational values. |
| Director | View all financial cases; approve/return expected receivable; approve credit notes, write-offs and material variances; reroute escalations. |
| Full Administrator | Maintain ageing thresholds, invoice numbering/configuration and controlled tax/fee rules directly; no operational approval or actual payout visibility from Admin authority alone. |
| Deal owner/Manager | View status, due date and required operational action for in-scope Deals; no bank evidence, broad finance register, write-off or payout values. |
| Other users | No access outside exact role and Deal authority. |

No maker-checker process is added to routine Admin configuration. Operational financial approval is a
Director responsibility, not an approval of Admin activity.

## Finance workspace

Create one **Finance** workspace for Accountant and Director with:

- lifecycle counts: awaiting approval, approved not invoiced, due soon, overdue, partially received,
  unallocated receipts, variance and settled;
- filters by lifecycle state, ageing band, due period, currency and responsible finance user;
- Deal, expected amount, approved amount, invoice total, received total, allocated total, outstanding
  amount and oldest due date;
- drill-down showing the exact chain: expectation → approval → invoice versions → receipt evidence →
  allocations/credit notes → current settlement state;
- Director exception decisions and Accountant operational actions.

The Director-only agent Payout workspace remains separate. Finance lifecycle drill-down must not expose
calculated agent payout to Accountant or Full Administrator.

## Ageing and leakage controls

Full Administrator maintains effective-dated thresholds directly, initially:

- expected commission awaiting Director approval;
- approved commission not invoiced;
- invoice due soon;
- invoice overdue bands (for example 1–7, 8–30, 31–60 and 61+ days);
- confirmed receipt not fully allocated;
- expected, invoiced, received or allocated variance;
- cancelled/credited invoice with unresolved replacement or balance;
- settled invoice whose applicable agent payout release evidence is overdue—status link only for
  Accountant; payout amount remains Director-only.

Ageing uses calendar dates for invoice due dates. The three-working-day agent payout policy remains
unchanged and separate.

## Existing My Task Queue integration

There will be no separate finance-alert inbox.

- A material lifecycle gap creates or reuses one governed `finance_follow_up` Task in the responsible
  Accountant's existing My Task Queue.
- Escalation creates/reassigns a Director Task only according to the frozen threshold and reason.
- Task content contains controlled financial status and Deal reference, not bank evidence or private
  counterparty/contact details.
- Generic Task completion cannot close the financial exception. Completing the underlying governed
  action closes the Task atomically.
- Repeated ageing runs are idempotent and cannot create duplicate open Tasks for the same case, gap and
  cycle.

## Proposed durable records for Gate 2

Migration 090 should add:

- `deal_financial_cases` and immutable/effective `deal_financial_case_versions`;
- `deal_receivable_approval_events`;
- `deal_invoice_versions` and invoice amount/component rows;
- immutable `deal_invoice_issue_events`, `deal_invoice_credit_events` and Director exception decisions;
- immutable `deal_receipt_allocations` linked only to migration 088 receipt/confirmation evidence;
- `finance_ageing_policy_versions` and controlled threshold rows;
- `finance_leakage_cases` with deterministic category, severity, cycle and resolution evidence;
- `finance_follow_up_task_links` connected to the existing Task model;
- indexes, idempotency keys, optimistic versions, immutable triggers and expanded audit types.

Migration 090 must extend Task context safely after migration 089: a `finance_follow_up` Task links to a
financial/leakage case and cannot carry fake Lead/Contact or leave-application context.

## Required validations

- approved amount reconciles exactly to the frozen expectation unless a Director-approved exception
  explicitly records before/after values;
- sum of active issued invoices, credit notes and approved write-off reconciles to the approved amount;
- invoice number is unique within the configured company numbering authority;
- issue/due dates and currency are valid and immutable after issue;
- allocated receipt cannot exceed confirmed receipt value or invoice outstanding amount;
- reversal/credit cannot exceed the referenced event;
- status is derived from evidence, never freely selected by the browser;
- every write is idempotent and every transition uses optimistic locking;
- no deletion or silent overwrite of issued financial evidence;
- no financial value crosses role/Deal scope through registers, Tasks, exports or audit details.

## Gate 3 acceptance scenarios

1. Frozen expected commission appears once in the Finance approval queue without re-entry.
2. Director approves or returns it; return produces one Accountant Task in My Task Queue.
3. Accountant records two invoice instalments whose total reconciles to the approved receivable.
4. A partial confirmed receipt is allocated to the first invoice without altering migration 088 receipt
   evidence.
5. A later confirmed receipt settles both invoices; status derives `paid/settled` automatically.
6. Over-allocation, currency mismatch, duplicate invoice number and stale version fail closed.
7. Overdue invoice creates exactly one Accountant Task and escalates only under configured policy.
8. Resolving the invoice/receipt gap atomically closes the governing Task.
9. Credit note/write-off requires Director decision and preserves before/after evidence.
10. Accountant can see receivable values but cannot see calculated agent payout; Admin configuration
    does not reveal operational finance values.
11. Deal owner sees status/action only, without bank evidence or restricted finance details.
12. Full focused tests and repository regression pass; synthetic offline review shows all roles.

## Explicitly deferred

- bank feeds, payment gateways and automatic bank reconciliation;
- invoice email/transmission, e-invoicing or tax-authority submission;
- accounting journals, general ledger, chart of accounts and external accounting integration;
- VAT/tax interpretation not supplied through an approved controlled rule;
- payment execution, payroll and agent-payout calculation changes;
- statements and accounting exports, which remain the final separate Release 5 package;
- CRM Test, Production, R2, cPanel or external-service action.

## Gate 1 owner decisions requested

1. The lifecycle reuses migration 088 expected commission and confirmed receipts; no duplicate amount
   or receipt input is permitted.
2. Accountant prepares/issues invoices and allocates receipts; Director approves receivables and all
   material credit/write-off/variance exceptions.
3. Full Admin maintains finance configuration directly but does not receive operational approval or
   payout access from Admin authority.
4. Finance alerts appear in the existing My Task Queue, not a separate approval/alert queue.
5. Multiple invoice instalments and partial receipts are included in the first package.
6. `paid` means NYSA's invoice is fully settled; agent payout remains separate and Director-only.
7. Invoice due-date ageing uses calendar days; agent payout continues to use its separate Monday–Friday
   three-working-day rule.
8. CORE records invoice evidence locally but does not send invoices or connect to accounting/banking.

Gate 1 approval authorizes Gate 2 migration/API design only. It does not authorize migration 090
creation, implementation, applying migrations 083–090, deployment, packaging, service restart,
credential access or external environment action.

This approval path is closed because the package was withdrawn. Migration number 090 remains unused
and may be assigned only to a future separately approved requirement.
