# Release 5 — Commission Receipt and Real-Time Agent Payout

**Gate:** 1 — revised functional scope and authority reuse  
**Date:** 14 August 2026 (Asia/Dubai)  
**Classification:** local/offline design only; no migration, API or CRM UI implementation authorized  
**Proposed migration number:** `088` (not created and not applied)

**Owner decision:** Gate 1 approved on 14 August 2026 (Asia/Dubai). This revision replaces the narrower
expected-commission proposal. Approval authorizes Gate 2 schema/API design only; it does not authorize
material implementation, migration application, packaging or deployment.

## Purpose

Deliver the complete governed calculation chain from a Deal's expected commission through actual
commission receipt, Deal closure eligibility, agent revenue credit, real-time slab selection and final
agent/company payout calculation. Full Administrator maintains the approved payout structures, while a
separate Director-only Payout workspace tracks cumulative credited commission and drills from an agent
or quarter to every payout trigger and contributing Deal.

This package calculates and approves payout entitlement when Director triggers it, tracks the policy
deadline to release the payout within three bank working days of confirmed receipt in the company account, and
records release confirmation. It does not connect to a bank, move money, run payroll, post an
accounting journal or transmit data to an external finance service.

## Owner-mandated sequence

```text
Expected commission
        ↓
Actual commission receipt confirmed
        ↓  required before Deal closure
Deal becomes Closed Won
        ↓  required before payout eligibility
Actual received commission credited to one or two agents
        ↓
Agent's quarter-to-date cumulative credited commission, including this Deal,
selects the applicable payout slab
        ↓
Real-time Deal payout + company-retained amount
        ↓
Payout release due within 3 bank working days of confirmed company-account receipt
```

Receipt confirmation and Deal closure are deliberately separate facts. A receipt may be recorded and
confirmed while the Deal is completing, but it cannot enter an agent payout calculation until that
Deal is Closed Won. There is no quarterly payout run: the quarter only defines when the cumulative
commission counter resets to zero.

## Existing authorities retained

| Concern | Retained CORE authority |
| --- | --- |
| Transaction and closure | existing `deals` record, reference, value, currency, type, status and version |
| Expected commission terms | existing Opportunity buyer/seller percentage and minimum fields |
| One-/two-agent Deal split | existing Deal workflow's Originating-agent split % and Servicing-agent split % fields and governed broker identities |
| Internal agents and scope | existing broker identities, job roles and reporting hierarchy |
| Referral organization | accepted active governed Partner Organization version, when applicable |
| Source evidence | opaque evidence references and existing Documents when a document is required |
| Actor and permission | existing Administrator, Director, Manager, Agent and Accountant authorities |
| Audit evidence | existing `audit_log` |
| Presentation | existing Deal detail plus one Finance workspace; no parallel work queue |

No customer, owner, private partner contact or authority identity is copied into the commission or
payout registers.

## Proposed operating workflow

### 1. Maintain company and agent payout structures

1. A full Administrator maintains the versioned company default structure in **Administration →
   Commission and payout policy**. Admin Assistant may prepare a draft but cannot activate, supersede
   or retire it. A full Administrator acts directly and requires no second approval.
2. The company structure is effective-dated by currency and contains ordered, non-overlapping revenue
   slabs. Every slab states its lower/upper cumulative
   credited-commission boundary and the agent payout percentage; the company percentage is the exact
   residual to 100%.
3. The company structure explicitly chooses how a payout trigger crossing a boundary is calculated:
   - **trigger attained-rate:** the slab reached after adding the current Deal credit applies to that
     Deal's current payout only; prior approved or released payouts are never recalculated; or
   - **progressive trigger:** the current Deal credit is divided across each slab boundary it crosses.
4. There is no silent default between these methods. The method and slab table are visible in preview,
   approval and every Deal payout result.
5. A full Administrator may optionally create an effective-dated adjustment for one exact active
   agent. The adjustment may replace selected slab thresholds, agent percentages or the trigger method,
   but must show the company value, adjusted value, business reason and opaque approval/evidence
   reference. It applies only to that agent and never changes the company default or another agent.
6. The resolved agent plan is the active company structure plus the active agent-specific adjustment,
   if one exists. The complete resolved slab table is previewed and frozen in every payout calculation;
   the calculation never depends on a later lookup of mutable configuration.
7. One company structure per currency and at most one adjustment per agent/currency may apply at any
   point in time. Gaps, overlaps, invalid thresholds or percentages, and ambiguous effective dates fail
   closed.
8. A company or agent-adjustment version already used by an approved payout calculation is immutable.
   A later change creates a new effective-dated version and does not recalculate earlier payouts.
9. A missing active company structure blocks payout calculation. CORE never guesses a slab or rate.

### 2. Prepare expected commission per Deal

1. An authorized Deal user opens **Deal → Commission and payout**.
2. CORE reads the current Deal value/currency/version and governed Opportunity commission terms.
3. Each represented side is calculated separately. For a percentage/minimum term, expected commission
   is the greater of the Deal-value percentage and recorded minimum.
4. Optional referral/partner commission uses an exact accepted Partner Organization version and
   supported evidence. An inactive or service-provider-only version cannot be treated as a payee.
5. The preview shows formulas, source values, policy versions, expected gross commission and any
   referral deduction. Previewing performs no write. Saving freezes a source-bound draft version.
6. Missing or contradictory source terms must be corrected at their authority; this workflow never
   silently changes the Opportunity or Deal.

### 3. Record and confirm actual commission received

1. A Deal may have one or more immutable receipt entries in the Deal currency. Each entry records the
   amount, received date, controlled receipt method, non-sensitive finance reference and opaque
   evidence reference. Bank credentials, full account details and private payer data are prohibited.
2. Accountant, Director or full Administrator may record and confirm a standard receipt. A full
   Administrator may act directly and requires no second approver.
3. A correction never overwrites a confirmed receipt. An authorized reversal or correcting entry
   preserves the original evidence and recalculates the confirmed aggregate.
4. CORE compares confirmed actual receipts with expected net receivable. A difference is visible as a
   variance and requires an explicit reason and Director or full-Administrator approval before closure.
5. Duplicate finance reference, identical evidence fingerprint, stale Deal context and concurrent
   confirmation fail closed.
6. The Deal obtains **Commission receipt confirmed** status only when the confirmed aggregate is
   positive, reconciled, and either equals the expected net receivable or has an approved variance.

### 4. Enforce the Deal closure prerequisite

The existing **Close Won** transaction gains a mandatory commission gate. It succeeds only when:

- a current expected-commission version is frozen against the current Deal/Opportunity context;
- actual commission receipt is confirmed;
- any expected-versus-actual variance has its required approval; and
- the current confirmed aggregate and evidence have not changed since review.

Closing the Deal freezes the payout-eligibility source context. Commission confirmation does not close
the Deal automatically. Deal closure makes the Deal available in the separate Director-only Payout
workspace but does not silently approve or release money.

### 5. Credit revenue to one or two agents

1. The revenue-credit base is actual confirmed commission received, net of any approved external
   referral/partner amount. Expected commission never counts toward an agent's cumulative commission.
2. The standard agents and percentages come only from the existing Deal workflow's governed
   originating/servicing assignments and **Originating-agent split % / Servicing-agent split %**
   values. CORE does not introduce a second standard split input in Finance.
3. One agent may receive 100% credit. Where two agents apply, both identities and percentages are
   displayed and must total exactly 100%.
4. If originating and servicing roles resolve to the same agent, the role components remain visible
   but consolidate into that agent's total credit.
5. Finance displays the Deal-entered percentages read-only. A different agent or percentage is an
   explicit exception with before/after values, reason and
   evidence. It requires Director or full-Administrator approval; a full Administrator acts directly.
6. Once the Deal is Closed Won, its approved credit allocation is immutable. A later correction uses
   an audited adjustment version, never an overwrite.

### 6. Trigger the real-time payout calculation

1. A Director triggers payout calculation for an eligible Closed Won Deal from the separate **Payout**
   workspace; there is no scheduled or quarter-end payout calculation.
2. The commission counter uses calendar quarters in Asia/Dubai time and the confirmed company-account
   receipt date. It resets to zero at the start of each quarter. The system retrieves all earlier
   eligible, non-reversed agent credits in that same agent/quarter/currency and adds the current Deal
   credit atomically.
3. The resulting cumulative amount selects the applicable slab from the resolved company structure and
   optional agent adjustment effective on the receipt date.
4. Under **trigger attained-rate**, the reached slab applies only to the current Deal credit. Under
   **progressive trigger**, the current Deal credit is split across any cumulative slab boundaries it
   crosses. Earlier approved or released payouts are never retrospectively uplifted or reduced.
5. The calculation immediately produces the agent payout and company-retained amount for each agent
   on the Deal. It also updates the quarter-to-date cumulative view. Agent plus company amounts must
   reconcile exactly to credited revenue after one governed rounding residual is assigned to company.
6. The payout moves through `calculated → approved → released`. Approval freezes the receipt, Deal,
   credit allocation, prior cumulative balance, company structure, agent adjustment, resolved slabs,
   formula and result. An authorized Director may trigger and approve the deterministic calculation
   directly; no second Director approval is required.
7. The release deadline is the end of the third normal working day after the confirmed company-account
   receipt date in Asia/Dubai time. The receipt date is excluded; Monday through Friday count, while
   Saturday and Sunday do not. There is no holiday or bank-calendar maintenance. CORE shows the three
   counted dates plus due-soon and overdue warnings from the moment the receipt is confirmed. If Deal
   closure is still pending, the warning identifies closure as the blocker rather than calculating a
   payout.
8. A Director records immutable payout-release confirmation with released amount, time and opaque
   evidence reference. CORE records the release; it does not initiate a bank transfer.
9. A later correction uses a linked reversal or adjustment. It never rewrites the approved calculation
   or released confirmation, and the cumulative tracker is rebuilt deterministically from preserved
   entries.

### 7. Track and drill down

The separate **Payout** workspace is visible only to a user whose current job role is Director. It
provides:

- quarter, agent, Deal and receipt-date filters;
- quarter-to-date cumulative credited commission, current achieved slab and next threshold;
- triggered Deal credit, calculation method, agent payout and company-retained amount;
- calculated, approved, released, due-soon, overdue, blocked and adjusted status;
- missing-plan, unconfirmed-receipt, unclosed-Deal and exception warnings; and
- drill-down from agent-quarter → payout trigger → Deal → expected calculation → receipt entries →
  credit split → company structure/agent adjustment → cumulative balance/slab application → three
  counted Monday–Friday working days → agent/company result → release confirmation.

The ordinary Deal panel shows commission receipt and closure readiness but not calculated agent payout,
agent cumulative revenue, slab application, company-retained result or payout release. Those details
exist only in the Director Payout workspace. Hiding navigation is not the security boundary: every
payout read/write API independently enforces the Director role.

## Permission summary

| Action | Full Administrator | Admin Assistant | Agent | Manager | Director | Accountant |
| --- | --- | --- | --- | --- | --- | --- |
| Draft company slabs/agent adjustment | Yes | Yes | No | No | No | No |
| Activate/retire company slabs/agent adjustment | Yes, direct | No | No | No | No | No |
| View scoped Deal commission | Yes | Yes | Yes | Yes | Yes | Yes |
| Prepare expected calculation | Yes | No | Yes, scoped | Yes, scoped | Yes | Yes |
| Record/confirm standard receipt | Yes, direct | No | No | No | Yes | Yes |
| Approve receipt variance | Yes, direct | No | No | No | Yes | No |
| Prepare standard agent credit | Yes | No | Yes, scoped | Yes, scoped | Yes | Yes |
| Approve credit exception | Yes, direct | No | No | No | Yes | No |
| View payout workspace/calculations | No | No | No | No | Yes | No |
| Trigger Deal payout calculation | No | No | No | No | Yes, direct | No |
| Approve Deal payout calculation | No | No | No | No | Yes, direct | No |
| Confirm payout release | No | No | No | No | Yes, direct | No |

Existing Deal closure authority remains in force in addition to the new receipt prerequisite.

## Calculation and reconciliation rules

- All Deal commission, revenue credit and payout amounts use the Deal currency. Cumulative counters do
  not combine currencies; each agent-quarter-currency is maintained separately.
- Money is stored at database precision and displayed at currency precision. Percentage calculations
  use an explicit rounding policy to be frozen at Gate 2.
- External referral amount + internal credited revenue must reconcile to actual confirmed commission.
- Agent payout + company-retained amount must reconcile to internal credited revenue.
- For two agents, credit percentages must total 100% and each agent's real-time calculation uses the
  resolved company/agent plan and that agent's quarter-to-date cumulative balance.
- The system must reproduce every total using only the frozen Deal, receipt, credit, plan and earlier
  cumulative entries shown in drill-down.

## Fail-closed and non-mutation rules

- Close Won fails without current confirmed commission receipt and approved variance where applicable.
- Payout eligibility fails unless the Deal is Closed Won and its credit allocation is frozen.
- Missing/overlapping structures or adjustments, slab gaps/overlaps, changed context, invalid split,
  currency mismatch, negative residual or unreconciled total blocks calculation or approval.
- Concurrent save, confirmation, closure and payout triggers use version checks, locking and
  idempotency keys so two Deals cannot consume the same cumulative position.
- No commission action updates Deal value, Opportunity terms, broker assignment, Partner Organization,
  Inventory, Documents or customer records.
- No approved receipt, Deal credit, company structure, agent adjustment, payout calculation or release
  confirmation is edited or deleted.
- Business screens do not expose database identifiers, raw hashes, credentials, full bank details or
  customer/owner/private partner/authority identities.

## Gate sequence

1. **Gate 1 — scope:** approve this revised end-to-end package, workflow, calculations, permissions and
   exclusions.
2. **Gate 2 — migration/API contract:** review the exact additive schema, receipt and Close Won gate,
   company/agent slab resolution, fixed Monday–Friday deadline calculation, endpoints, formulas,
   idempotency, permissions,
   rollback and test matrix. Proposed migration: `088` (unapplied).
3. **Gate 3 — local CRM workflow:** review Deal commission/receipt/credit, payout-plan maintenance,
   real-time trigger, three-working-day release tracking and cumulative drill-down after focused
   and complete offline tests.
4. **Gate 4 — package completion:** accept the complete local functional package and checkpoint.

No gate authorizes applying a migration, packaging, deployment, restart or external-service access.

## Gate 1 acceptance criteria

Approval confirms that:

1. confirmed actual commission receipt is mandatory before Close Won;
2. Closed Won is mandatory before a Deal can contribute to agent payout;
3. actual received commission, not expected commission or Deal value, is the revenue-credit base;
4. one- or two-agent credit uses the existing Deal-entered Originating/Servicing split percentages,
   totalling 100%, with no duplicate standard Finance input;
5. full Administrator maintains the company default slabs and may directly maintain an effective-dated
   individual-agent adjustment without changing other agents;
6. every payout freezes the resolved company/agent slab structure and explicit trigger attained-rate
   or progressive-trigger calculation method;
7. payout is calculated in real time when Director triggers an eligible Deal, using cumulative credited
   commission that resets quarterly rather than a quarter-end calculation;
8. the release deadline is the end of the third Monday–Friday working day after confirmed receipt;
   Saturday and Sunday are excluded, with no holiday-calendar maintenance, and blocked, due-soon,
   overdue and released states remain tracked;
9. Full Administrator maintains payout structures directly but cannot see the operational Payout
   workspace or calculated Deal payouts; only Director may view, trigger, approve and release them;
10. approved plans, receipts, allocations, Deal payout calculations and release confirmations remain
   immutable and drillable; and
11. bank payment initiation, payroll, accounting journals and external finance integration remain
   excluded.

## Explicit exclusions

- Bank connection, payment initiation, payroll execution or broker/partner money transfer.
- General-ledger posting, tax filing, VAT advice or external accounting-system integration.
- Currency conversion, inferred exchange rates or cross-currency aggregation.
- Customer, owner, private partner-contact or authority identity storage in finance evidence.
- Property Finder, Bayut, Dubizzle or other portal work.
- Email, WhatsApp, AI generation, external transmission or external-service access.
- CRM Test, Production, R2, cPanel, packaging, deployment, migration execution or restart.
