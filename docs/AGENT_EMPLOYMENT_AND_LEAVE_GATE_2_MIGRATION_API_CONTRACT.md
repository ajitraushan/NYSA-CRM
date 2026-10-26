# Agent Employment and Leave — Gate 2 Migration and API Contract

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** owner-approved on 14 August 2026; local Gate 3 implementation authorized  
**Migration:** `089_agent_employment_leave.sql` — created locally and deliberately not applied  
**Boundary:** local/offline design only

## Approved Gate 1 rule

Every submitted leave approval request appears in the assigned approver's existing **My Task Queue**.
There is no separate approval inbox and no parallel task clock.

## Authority and roles

| Actor | Authority |
|---|---|
| Full Administrator | Maintain employment, leave types, policy versions and assignments; view organization leave register without private evidence content. |
| Agent | View own employment/leave balances; create, submit and withdraw own eligible application. |
| Reporting Manager | View relevant team leave context and decide submitted applications assigned to them. |
| Director | Decide a Manager's own application and perform an explicitly reasoned exceptional override if enabled later. |
| Other users | No employment or leave access outside their exact authority. |

Full Administrator does not acquire operational approval authority merely from the Admin role. No
person may approve their own leave.

## Proposed migration 089

### Stable employment and effective-dated versions

`agent_employments`

- `id`, `broker_id` (unique), `created_by`, `created_at`

`agent_employment_versions`

- `id`, `employment_id`, `version_no`, `status`
- `employment_status`, `effective_from`, `effective_to`, `start_date`, `end_date`
- `reporting_manager_id`, `work_pattern_code`, `policy_version_id`
- `reason`, `created_by`, `created_at`, activation/supersession evidence
- unique active effective coverage without overlapping versions

Only active internal agents are eligible in the first package. Ended/inactive employment blocks new
applications but preserves history.

### Leave configuration

`leave_types` and `leave_type_versions`

- stable code and effective-dated label
- paid/unpaid classification
- evidence requirement and restricted-evidence flag
- minimum/maximum duration, notice and negative-balance permission
- active/superseded/retired lifecycle with reason and audit evidence

`leave_policy_versions` and `leave_policy_entitlements`

- policy name, effective dates, allocation/accrual method, carry-forward rule and expiry
- one entitlement row per leave type with annual units and eligibility
- Manager decision SLA expressed as policy-controlled working hours/days
- no policy edit rewrites an existing application, decision or ledger movement

### Applications and immutable decisions

`leave_applications`

- `id`, governed reference, `employment_id`, frozen employment/policy version IDs
- `leave_type_version_id`, `start_date`, `end_date`, start/end day portions
- calculated working units, controlled reason, evidence reference only
- `status`: `draft`, `submitted`, `approved`, `rejected`, `withdrawn`, `cancelled`
- `version`, created/submitted/withdrawn metadata
- dates must fall within effective employment; overlap rules fail closed

`leave_application_decisions`

- immutable approve/reject/cancellation decision
- exact approver, role, decision time, reason, application version and balance snapshot
- database constraint prohibits applicant/approver identity equality

`leave_balance_ledger`

- immutable credit, approved-leave debit, cancellation reversal and governed adjustment movements
- exact employment, policy, leave type, application and decision provenance
- idempotency key and post-movement balance
- current balance is derived from the ledger, never directly overwritten

### Existing Task model integration

The current `tasks` table requires `lead_id` and `contact_id` and the current query uses inner joins.
Migration 089 therefore proposes:

- make `lead_id` and `contact_id` nullable;
- add nullable `leave_application_id` referencing `leave_applications`;
- extend `task_type` with `leave_approval`;
- add a context check:
  - normal CRM task types retain their required Lead/Contact context;
  - `leave_approval` requires `leave_application_id` and prohibits fake Lead/Contact links;
- add a partial unique index allowing one open/in-progress `leave_approval` Task for one submitted
  application cycle;
- add `leave_application_task_links` for application version, approval cycle, Task ID, approver,
  routing reason and idempotency fingerprint.

The `/crm/tasks` query changes to safe left joins and context-aware authorization. With `mine=1`, the
server always filters `tasks.assignee_id` to the authenticated broker before returning either CRM or
leave Tasks. Private leave reason/evidence is not copied into Task subject/details.

## Task lifecycle contract

1. Agent submits an application in one transaction.
2. Server locks the application and current employment version.
3. Approver is derived server-side from the frozen reporting Manager; if applicant is a Manager, the
   approver is Director. The client cannot select an approver.
4. Server creates or idempotently reuses one `leave_approval` Task assigned to that approver.
5. Task appears in My Task Queue with subject, leave type, dates, working units, due time and a
   **Review leave** action. Sensitive reason/evidence is omitted from the queue row.
6. Generic Task Start may move the Task to `in_progress`. Generic Complete/Cancel is prohibited for
   `leave_approval`.
7. Approve/reject through the leave decision endpoint writes the immutable decision, balance movement
   where applicable and Task completion in one transaction.
8. Agent withdrawal before decision cancels the governing Task in the same transaction.
9. A future approved-leave cancellation follows a new approval cycle and creates/reuses a new Task;
   balance is restored only after approval.

If a reporting Manager becomes inactive before decision, the application remains submitted but is
flagged `routing_required`; no broader user silently receives it. Director may explicitly reroute with
an audit reason.

## Proposed API contract

### Admin configuration

- `GET /admin/agent-employments`
- `POST /admin/agent-employments/:brokerId/versions`
- `POST /admin/agent-employment-versions/:id/activate`
- `GET /admin/leave-policy-versions`
- `POST /admin/leave-policy-versions`
- `POST /admin/leave-policy-versions/:id/activate`
- `GET /admin/leave-register` — controlled organization facts; no evidence content

### Agent self-service

- `GET /crm/my-employment`
- `GET /crm/my-leave-balances`
- `GET /crm/my-leave-applications`
- `POST /crm/my-leave-applications` — create Draft
- `PATCH /crm/my-leave-applications/:id` — owner may edit Draft only
- `POST /crm/my-leave-applications/:id/submit`
- `POST /crm/my-leave-applications/:id/withdraw`
- `POST /crm/my-leave-applications/:id/request-cancellation`

### Manager/Director decision

- `GET /crm/leave-applications/:id/review` — exact assigned approver only
- `POST /crm/leave-applications/:id/decision` — `approve` or `reject`, optimistic version required
- `POST /crm/leave-applications/:id/reroute` — Director only, controlled reason required

There is no `/leave-approval-queue`; the authoritative work queue remains `GET /crm/tasks?mine=1`.

## UI contract

- **My leave**: agent balances, applications, application form and history.
- **My tasks**: `leave_approval` row and Review leave action for the assigned approver.
- **Leave review**: employment/policy version, dates, calculated units, balance and team-overlap facts;
  decision is made here and closes the governing Task atomically.
- **Administration**: employment, leave types/policies and organization leave register.
- **Team leave calendar**: Manager-readable team availability; it does not expose private reasons or
  evidence.

## Validation and acceptance scenarios

- submission creates exactly one Task in the correct Manager's My Task Queue;
- repeat submission/idempotency cannot duplicate the Task or debit;
- another Manager, Admin or Agent cannot read or decide the application;
- Manager cannot approve their own application; Director receives the Task instead;
- generic Task completion/cancellation cannot bypass the leave decision endpoint;
- rejection completes the Task without debiting balance;
- approval completes the Task and posts exactly one immutable debit;
- withdrawal cancels the Task; approved cancellation restores exactly the prior debit;
- overlapping leave and insufficient balance fail according to the frozen policy version;
- policy/employment changes do not rewrite historical decisions or balances;
- My Task Queue safely renders both Lead/Customer and leave contexts;
- restricted evidence and private reason never appear in Task, calendar, logs or broad Admin register.

## Explicitly deferred

- payroll and salary deductions;
- commission or payout adjustment from leave;
- biometric/attendance devices and timesheets;
- statutory assumptions hard-coded into the application;
- public-holiday provider/calendar integration;
- hourly leave and mobile push/email notifications;
- external HR, payroll or accounting system integration.

## Gate 2 approval effect

Approval authorizes local migration 089, domain/API/UI implementation and offline tests for Gate 3.
It does not authorize applying any migration, deployment, external packaging, service restart,
credential access, external notification or external environment action.

Gate 2 owner approval was recorded on 14 August 2026. Local Gate 3 implementation proceeds within
the boundary above.
