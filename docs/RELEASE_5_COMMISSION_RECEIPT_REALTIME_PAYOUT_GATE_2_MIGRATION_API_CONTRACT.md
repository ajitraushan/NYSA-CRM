# Release 5 — Commission Receipt and Real-Time Payout Gate 2

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 2 owner-approved; local Gate 3 implementation authorized  
**Proposed migration:** `088_release5_commission_receipt_realtime_payout.sql` — implementation in progress; must remain unapplied  
**Schema proposal:** `docs/schema-proposals/release5_commission_receipt_realtime_payout.sql.proposed`

**Owner decision:** Gate 2 approved on 14 August 2026 (Asia/Dubai), including the existing Deal split
field linkage and Director-only Payout workspace clarifications. Approval authorizes local migration,
domain, API, CRM UI and test implementation only. Migration 088 must remain unapplied.

## Gate 1 authority

Gate 1 was owner-approved on 14 August 2026. This contract translates that approved workflow into an
additive schema and API design. It preserves these controlling rules:

- confirmed actual receipt is mandatory before Close Won;
- Closed Won is mandatory before payout calculation;
- payout is triggered per Deal in real time, not quarterly;
- each agent's cumulative credited commission resets at calendar-quarter boundaries;
- company default slabs may be adjusted for one individual agent by full Administrator;
- the payout deadline is three Monday–Friday working days after confirmed company-account receipt;
- Saturday and Sunday do not count and no holiday calendar is maintained; and
- full Administrator maintains configuration directly but only Director can access payout calculations
  and Deal-level payout drill-down.

## Additive data model

Migration 088 will add these authorities.

### Configuration

1. `commission_payout_policy_versions` — immutable effective-dated company policy per currency, with
   status `draft`, `active`, `superseded` or `retired`, trigger method `attained_trigger` or
   `progressive_trigger`, creator/activation evidence and version number.
2. `commission_payout_policy_slabs` — ordered lower/upper cumulative commission boundaries and agent
   payout percentage for one company policy version.
3. `agent_payout_adjustment_versions` — optional immutable effective-dated adjustment for one exact
   active internal agent/currency, pinned to its base company-policy version and carrying the complete
   resolved trigger method and reason/evidence.
4. `agent_payout_adjustment_slabs` — the complete resolved slab table for the individual agent. The API
   starts from the selected company policy, applies Admin edits, validates the complete result and
   stores that result; calculations never merge mutable configuration at runtime.

### Deal commission and receipt

5. `deal_commission_expectation_versions` — immutable Deal/Opportunity context, expected gross and
   company-account receivable commission, currency, referral amount and explicit referral settlement
   basis, source fingerprint and lifecycle `draft` or `frozen`.
6. `deal_commission_expectation_components` — represented-side formula evidence: side, percentage,
   minimum, percentage result and selected expected amount. No private party identity is stored.
7. `deal_commission_receipts` — immutable receipt or reversal entry with amount, received date,
   controlled method, normalized non-sensitive finance reference, evidence reference/fingerprint and
   actor. Amounts are signed only through explicit `receipt` or `reversal` entry type.
8. `deal_commission_receipt_confirmations` — immutable confirmation of the aggregate receipts against
   one frozen expectation and current Deal context, including expected/actual variance, status
   `confirmed` or `reversed`, reason, evidence and confirmation fingerprint.
9. `deal_commission_variance_decisions` — terminal approval/return evidence for a non-zero variance.
   Director or full Administrator may approve; full Administrator may approve directly.

### Revenue credit and real-time payout

10. `deal_agent_credit_versions` — immutable allocation header for one eligible Deal receipt
    confirmation, including external referral amount, internal credited amount, context fingerprint and
    lifecycle `draft` or `frozen`.
11. `deal_agent_credit_lines` — one or two broker lines freezing the standard percentages from the
    existing CRM Deal workflow fields `opportunities.originating_agent_split_percent` and
    `opportunities.servicing_agent_split_percent`, their governed agent role components and exact
    credited amount. Percentages and amounts reconcile to the header. No new standard split field is
    added by migration 088.
12. `agent_payout_calculations` — one immutable current calculation per Deal-credit line, recording
    receipt date, quarter key, prior cumulative amount, current credit, resulting cumulative amount,
    resolved method, company-policy version, optional agent-adjustment version, deadline and status
    `calculated`, `approved`, `released`, `reversed` or `adjusted`.
13. `agent_payout_calculation_bands` — exact current-credit portions assigned to each applicable slab,
    rate, agent payout and company-retained amount. Attained-trigger has one band; progressive-trigger
    may have multiple bands.
14. `agent_payout_decision_events` — immutable approve/return decision events. An authorized Director
    may trigger and approve the deterministic calculation directly; no second Director is required.
15. `agent_payout_release_events` — immutable release or release-reversal confirmation, amount,
    timestamp and opaque evidence. This records a payment performed outside CORE; it does not initiate
    one.

The proposal adds no bank-account, customer, owner, private partner-contact or authority-identity
column. Existing broker IDs and governed Partner Organization version IDs are the only party links.

## Key database invariants

- Effective ranges use `[effective_from, effective_to)` and cannot overlap for active company
  policy/currency or active agent adjustment/agent/currency.
- A company policy or agent adjustment has at least one slab, starts at zero, has contiguous boundaries,
  has no overlap/gap, and has agent percentages between 0 and 100.
- An active agent adjustment references the company version it adjusts and stores a complete valid slab
  set. It never changes the company table.
- A frozen expectation binds exact Deal version/value/currency/type and Opportunity version/commission
  terms in its SHA-256 source fingerprint.
- Receipt finance reference is unique within currency and entry type after controlled normalization.
  Exact evidence fingerprint/idempotency keys also prevent duplicate receipt entry.
- A receipt reversal references one prior unreversed receipt, uses the same currency and cannot exceed
  its remaining amount.
- A confirmation's effective receipt date is the latest received date among its unreversed contributing
  receipts: the date on which the reviewed aggregate became available in the company account.
- A current confirmation aggregate equals receipt entries less reversals. A non-zero variance cannot be
  closure-ready without an approved variance decision.
- A database trigger rejects any `deals.status` transition to `closed_won` unless the Deal has a current
  closure-ready receipt confirmation bound to its current commission context.
- A Deal credit can freeze only after Closed Won. Its standard source is the exact Deal-linked
  Opportunity version and existing originating/servicing split fields. It contains one or two distinct
  agent lines; source percentages total 100 and amounts total internal credited commission.
- The payout quarter is derived from the confirmed receipt date in Asia/Dubai time, not from calculation
  time, Close Won time or release time.
- An agent cumulative stream is isolated by agent + quarter + currency. Cross-currency totals are never
  combined.
- Calculation locks serialize that stream before reading prior eligible credits and inserting the
  current calculation. One credit line contributes exactly once.
- Deadline is calculated by advancing from the receipt date and counting only Monday–Friday. Receipt
  date is day 0; there is no holiday/calendar table.
- Approved calculations, bands, decisions and release events have no update/delete path. Correction is
  a linked reversal or adjustment.
- Company policy and agent-adjustment versions referenced by any approved calculation cannot be altered
  or deleted.

## Deterministic calculation contract

### Expected and received commission

- For each represented side, percentage result = Deal agreed value × recorded percentage ÷ 100.
- Side expected amount = greater of percentage result and recorded minimum.
- Expected gross = sum of supported side expected amounts.
- Referral settlement basis is mandatory when referral amount is positive:
  `deducted_before_company_receipt` means expected company receipt is gross minus referral;
  `payable_from_company_receipt` means expected company receipt is gross.
- Expected company receipt follows that explicit basis; a zero referral has basis `none`.
- Confirmed actual received = confirmed receipt entries minus confirmed reversals.
- Variance = confirmed actual received minus expected company receipt.
- Receipt readiness requires confirmed actual received greater than zero and either zero variance or an
  approved variance decision.

### Agent credit

- Internal credited commission equals confirmed actual received when referral was deducted before
  company receipt; otherwise it equals confirmed actual received minus the referral payable from the
  received sum. The referral is therefore deducted exactly once.
- Standard credit lines use the governed originating/servicing broker assignments and the existing
  Deal workflow values `originating_agent_split_percent` and `servicing_agent_split_percent`. The API
  rejects a standard credit when either value is missing or they do not total exactly 100.
- Where the same broker performs both roles, role components remain visible but produce one consolidated
  agent line.
- Finance cannot type replacement percentages into a standard credit. An approved exception may select
  different agents/percentages through the separate exception action, but one or two lines must total
  100% and the before/after Deal values remain visible.
- Credited amounts use the frozen split percentage; the final rounding residual is assigned
  deterministically to the servicing line, or the only line when there is one.

### Cumulative slab and payout

- Quarter key is `YYYY-Qn` from receipt date in Asia/Dubai time; a new key resets cumulative to zero.
- Prior cumulative is the sum of eligible non-reversed earlier credit lines in the same
  agent/quarter/currency, ordered by confirmed receipt timestamp, Deal reference and credit-line ID.
- Resulting cumulative = prior cumulative + current credited amount.
- `attained_trigger`: the slab containing resulting cumulative applies to the entire current credited
  amount only. No prior payout is repriced.
- `progressive_trigger`: the current credited amount is split across every cumulative slab boundary it
  crosses; each portion receives that band's rate.
- Agent payout = sum of band portion × agent percentage ÷ 100.
- Company-retained amount = current credited amount minus agent payout. The rounding residual belongs
  to company-retained amount.
- For two agents, each line is independently calculated using that agent's own prior cumulative and
  resolved policy/adjustment.

### Three-working-day deadline

- Use the receipt date in Asia/Dubai time as day 0.
- Advance one date at a time; count Monday, Tuesday, Wednesday, Thursday and Friday only.
- The confirmation effective receipt date is the latest received date among the contributing current
  receipts. The third counted date is `release_due_date`; deadline is 23:59:59 Asia/Dubai on that date.
- Example: receipt Monday → due Thursday; receipt Thursday → due Tuesday; receipt Friday → due Wednesday.
- `due-soon` and `overdue` are derived presentation states; immutable stored lifecycle remains the
  calculation/release status.

## Endpoint contract

### Admin configuration

- `GET /api/admin/commission-payout-policies`
- `POST /api/admin/commission-payout-policy-versions`
- `POST /api/admin/commission-payout-policy-versions/:versionId/activate`
- `POST /api/admin/commission-payout-policy-versions/:versionId/retire`
- `GET /api/admin/agent-payout-adjustments`
- `POST /api/admin/agent-payout-adjustment-versions`
- `POST /api/admin/agent-payout-adjustment-versions/:versionId/activate`
- `POST /api/admin/agent-payout-adjustment-versions/:versionId/retire`

Admin Assistant may read and create drafts. Full Administrator may activate, supersede and retire
directly, including their own draft. Draft preview returns the complete slab table, gap/overlap checks,
resolved method and effective-date conflicts.

### Deal commission, receipts and closure readiness

- `GET /api/crm/deals/:dealId/commission`
- `POST /api/crm/deals/:dealId/commission-expectations/preview`
- `POST /api/crm/deals/:dealId/commission-expectations`
- `POST /api/crm/deal-commission-expectations/:versionId/freeze`
- `POST /api/crm/deals/:dealId/commission-receipts`
- `POST /api/crm/deal-commission-receipts/:receiptId/reverse`
- `POST /api/crm/deals/:dealId/commission-receipt-confirmations`
- `POST /api/crm/deal-commission-receipt-confirmations/:confirmationId/variance-decision`
- existing `POST /api/crm/deals/:dealId/close-won` gains the mandatory current receipt-readiness check.

GET returns business references, formulas, receipt aggregate, variance, closure blockers, deadline and
payout state. It excludes storage keys, raw hashes and private-party values. Technical audit details are
available only to authorized Admin/Finance roles.

Standard receipt confirmation is available to Accountant, Director and full Administrator. Non-zero
variance approval is Director or full Administrator. Full Administrator needs no second approval.

### Agent credit and payout

- `POST /api/crm/deals/:dealId/agent-credit/preview`
- `POST /api/crm/deals/:dealId/agent-credit`
- `POST /api/crm/deals/:dealId/agent-credit-exceptions`
- `POST /api/crm/deal-agent-credits/:versionId/freeze`
- `POST /api/finance/deal-agent-credit-lines/:lineId/payout/preview`
- `POST /api/finance/deal-agent-credit-lines/:lineId/payout/calculate`
- `POST /api/finance/agent-payout-calculations/:calculationId/decision`
- `POST /api/finance/agent-payout-calculations/:calculationId/release`
- `POST /api/finance/agent-payout-releases/:releaseId/reverse`
- `GET /api/finance/agent-payouts`
- `GET /api/finance/agents/:agentId/payout-summary`

Standard agent-credit preview accepts no agent IDs or percentages from the client; it resolves the
existing Deal-linked fields on the server. The exception endpoint is restricted to Director/full Admin
and requires exact before/after values, reason and evidence.

Payout preview and calculation return prior cumulative, current credit, resulting cumulative, resolved
company/agent policy, exact bands, agent amount, company amount, counted working dates and deadline.
Every payout endpoint listed in this subsection—including credit-line payout preview/calculate, list,
summary, decision, release and reversal—requires `job_role='director'`. Full Admin, Admin Assistant,
Agent, Manager and Accountant receive 403 and no payout payload. An authorized Director may calculate,
approve and record release directly.

## UI integration contract

### Administration

**Administration → Commission and payout policy** provides:

- company policy versions by currency and effective date;
- add/edit/remove slab rows while draft, including live continuity and 100% residual validation;
- explicit attained-trigger/progressive-trigger selection;
- active/superseded/retired history; and
- individual-agent adjustment drawer showing company values beside adjusted resolved values.

No bank-working-calendar screen will exist.

### Deal

**Deal → Commission** provides the pre-payout chain:

- expected side formulas and gross/net amount;
- receipt entries, confirmed aggregate and variance;
- Close Won readiness blocker;
- one-/two-agent revenue allocation linked visibly to the existing Deal-entered split percentages; and
- a Director-only status link stating that the Closed Won Deal is eligible in Payout.

Calculated agent amount, cumulative revenue, slab application, company-retained amount, deadline and
release details are never returned to or rendered in the ordinary Deal view.

### Director-only Payout

The separate **Payout** navigation item and workspace are rendered only for Director. It provides agent,
quarter, Deal, currency and status filters; calculated agent commission; quarter-to-date cumulative
credited commission; current slab and next threshold; due-soon/overdue counts; and drill-down from each
agent result to every Deal, receipt, Deal split percentage, cumulative position, slab band, calculation
and release record. It is a protected financial register, not a second general CRM queue.

Full Admin sees only policy and individual-agent adjustment configuration under Administration. That
screen contains no actual receipt, revenue, calculated payout, company-retained or Deal drill-down data.

## Permission matrix

| Action | Full Admin | Admin Assistant | Agent | Manager | Director | Accountant |
| --- | --- | --- | --- | --- | --- | --- |
| Read policy/adjustment | Yes | Yes | No | No | Yes | Yes |
| Draft company policy/agent adjustment | Yes | Yes | No | No | No | No |
| Activate/retire policy/adjustment | Yes, direct | No | No | No | No | No |
| View scoped Deal commission | Yes | Yes | Scoped | Scoped | Scoped | Yes |
| Prepare expectation | Yes | No | Scoped | Scoped | Scoped | Yes |
| Record/confirm standard receipt | Yes, direct | No | No | No | Yes | Yes |
| Approve receipt variance | Yes, direct | No | No | No | Yes | No |
| Prepare standard agent credit | Yes | No | Scoped | Scoped | Scoped | Yes |
| Approve agent-credit exception | Yes, direct | No | No | No | Yes | No |
| View payout workspace/calculations | No | No | No | No | Yes | No |
| Trigger payout calculation | No | No | No | No | Yes, direct | No |
| Approve payout calculation | No | No | No | No | Yes, direct | No |
| Confirm/reverse payout release | No | No | No | No | Yes, direct | No |

Existing Deal closure authority remains unchanged and is additionally subject to receipt readiness.

## Idempotency and concurrency

- Every write endpoint requires an idempotency key and deterministic request fingerprint.
- Same key + same fingerprint returns the existing result; same key + changed fingerprint returns 409.
- Exact Deal/Opportunity/expectation/receipt/credit context fingerprints reject stale previews.
- Transaction advisory locks serialize policy activation, agent-adjustment activation, receipt
  confirmation, Deal Close Won, credit freeze and agent/quarter/currency payout calculation.
- Payout calculation obtains locks for all Deal agent lines in stable agent-ID order to prevent deadlock
  and half-calculated two-agent Deals.
- A two-agent payout trigger commits both calculations atomically. If either agent lacks valid policy,
  has ambiguous slabs or changed cumulative context, neither calculation is saved.
- Retry and concurrent submission produce one expectation version, one receipt entry per evidence,
  one current confirmation, one credit contribution and one payout result per credit line.

## Rollback and reversibility

Migration 088 will be additive except for the guarded Close Won trigger and expanded audit entity-type
constraint. It will not update or backfill any Deal, Opportunity, broker or historical financial data.
Existing Deals remain without inferred expectations, receipts, credits or payouts.

Before any future application, an empty-schema rollback test must drop the trigger and new objects in
dependency order and restore the prior audit constraint. After immutable finance evidence exists,
destructive rollback is not an operating procedure; correction uses preserved reversal/adjustment
records and any recovery requires a separately approved plan.

## Required Gate 3 tests

1. Company-policy draft, direct Admin activation, supersession and guarded retirement.
2. Admin Assistant can draft but cannot activate/retire policy or agent adjustment.
3. Full Administrator can create and activate their own configuration without maker-checker.
4. Agent adjustment changes only its agent and every payout freezes the complete resolved slab table.
5. Effective-date overlaps, slab gaps/overlaps, invalid ranges/rates and missing zero boundary fail.
6. Expected side percentage/minimum, gross, referral and net formulas are exact.
7. Receipt duplicate/reversal/aggregate/idempotency/concurrency rules are enforced.
8. Zero variance becomes closure-ready; non-zero variance requires Director/Admin approval.
9. API and direct database Closed Won attempts both fail without current receipt readiness.
10. A changed Deal/Opportunity/receipt context invalidates preview and closure readiness.
11. Closed Won is required before agent credit freeze and payout trigger.
12. One-agent and two-agent standard credits read the existing Deal split fields, accept no client-side
    replacement percentage and reconcile exactly.
13. Same-agent originating/servicing roles consolidate without losing role evidence.
14. Agent-credit exceptions require Director/Admin approval and never mutate broker assignments.
15. Quarter reset uses receipt date in Asia/Dubai; currencies remain separate.
16. Attained-trigger applies the reached rate only to the current Deal credit.
17. Progressive-trigger splits only the current Deal credit across crossed thresholds.
18. Earlier approved/released payouts are never repriced after a later slab is reached.
19. Two-agent calculation resolves each agent's own cumulative balance and adjustment atomically.
20. Monday–Friday deadline examples pass; Saturday/Sunday are skipped and no holiday table exists.
21. Calculated/approved/released/reversed/adjusted lifecycle and three-day warnings are correct.
22. Director can trigger, approve and record release directly without a second Director.
23. Payout navigation and every payout API deny Full Admin, Admin Assistant, Agent, Manager and
    Accountant; denied responses contain no calculated value.
24. Director drill-down exactly reproduces quarter/agent and Deal totals from immutable components.
25. Output contains no credentials, account details or customer/owner/private partner/authority data.
26. No payment initiation, payroll, accounting journal, portal or external network path exists.
27. Focused tests and the complete repository suite pass offline.

## Explicit exclusions

Bank connection/payment initiation; payroll execution; invoice/VAT/tax logic; general-ledger posting;
exchange-rate inference; external accounting integration; private-party finance data; Property Finder or
any portal; email/WhatsApp/AI/external delivery; CRM Test, Production, R2, cPanel, migration execution,
packaging, deployment or restart.

## Gate 2 approval

Approval authorizes implementation of proposed migration 088, local domain/API/UI code and tests in
the dirty local worktree only. Migration 088 must remain unapplied. Gate 3 will present the working
local story and complete offline test evidence before package completion.
