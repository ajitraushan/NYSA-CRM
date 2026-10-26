# Agent Employment and Leave — Controlled Requirement Intake

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 1 owner-approved on 14 August 2026; Gate 2 contract review pending  
**Boundary:** local/offline planning only

## Owner requirement

Add governed agent employment maintenance, leave-policy maintenance, agent leave applications,
Manager approval and leave tracking.

## Recommended first functional package

### 1. Agent employment master

- One effective-dated employment record per internal agent.
- Admin maintains employment status, start/end dates, reporting Manager, working pattern and active
  leave-policy assignment.
- Employment changes retain version and audit history; records are not silently overwritten.
- Inactive or ended employment cannot create new leave applications.

### 2. Leave policy maintenance

- Full Administrator maintains controlled leave types, entitlement, paid/unpaid classification,
  eligibility, accrual/allocation method, carry-forward rule, minimum/maximum request duration,
  notice rule and whether supporting evidence is mandatory.
- Policies are versioned and effective-dated. A policy change does not rewrite previously approved
  leave.
- The system calculates working leave days from the assigned work pattern; the first package has no
  public-holiday integration unless separately approved.

### 3. Agent application

- Agent selects leave type, full-day or half-day period, dates and a reason.
- The application previews working days, available balance and the approving Manager before submit.
- Overlapping applications, invalid employment dates and insufficient balance fail closed unless the
  selected leave policy explicitly permits an unpaid or negative balance.
- States: Draft, Submitted, Approved, Rejected, Withdrawn and Cancelled.

### 4. Manager approval

- The reporting Manager sees only their team’s submitted applications and relevant leave context.
- Manager approves or rejects with an auditable decision and reason.
- No user may approve their own leave. A Manager’s own application routes to Director.
- Full Administrator maintains employment and policy configuration but does not become an automatic
  leave approver. A Director override, if later permitted, must be explicit and audited.

### 5. Tracking and reporting

- Agent view: entitlement, used, approved future, pending and available balance, plus application
  history.
- Manager view: pending team approvals and a team leave calendar.
- Admin view: policy and employment maintenance plus organization-level leave register; private
  supporting evidence remains access-restricted.
- Every balance movement links to the exact application, decision, policy version and employment
  version that caused it.

## Separation from finance

Employment identity may later be reused by commission reporting, but leave approval does not change
agent commission, payout slabs or an approved Deal calculation. Payroll deductions, salary,
attendance/biometric devices, end-of-service calculations and payment execution are outside this
first package.

## Proposed offline delivery gates

1. **Gate 1 — functional design:** roles, employment fields, leave types, entitlement/balance rules,
   approval routing, privacy and acceptance scenarios.
2. **Gate 2 — migration/API contract:** effective-dated schema, permissions, immutable decisions,
   balance ledger and endpoint contract.
3. **Gate 3 — local implementation:** Admin, Agent and Manager workspaces with synthetic offline
   review and focused/full regression tests.
4. **Gate 4 — owner acceptance and structured completion record.**

## Gate 1 decisions requiring owner approval

1. Initial population is internal agents only, rather than every employee role.
2. Full-day and half-day applications are included; hourly leave is deferred.
3. Saturday and Sunday are the default non-working days, with an agent-specific working pattern where
   needed; public holidays are not maintained in the first package.
4. Leave types and entitlements are Admin-configured rather than hard-coded.
5. A Manager’s own leave routes to Director, and self-approval is always prohibited.
6. Admin maintains configuration but does not approve leave unless separately assigned as the
   reporting Manager.
7. Leave is not connected to payroll or commission payout in this package.

No source code, migration, API or UI implementation is authorized or created by this intake record.
No external environment, credential, private identity or external service is required.

## Gate 1 owner decision

Gate 1 was owner-approved on 14 August 2026 with one binding clarification: each submitted leave
approval request must appear in the assigned approver's existing **My Task Queue**. A separate leave
approval inbox must not be created. The Gate 2 contract is recorded in
`AGENT_EMPLOYMENT_AND_LEAVE_GATE_2_MIGRATION_API_CONTRACT.md`.
