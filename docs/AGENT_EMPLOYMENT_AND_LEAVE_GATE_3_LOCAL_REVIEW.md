# Agent Employment and Leave — Gate 3 Local Review

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** owner-approved on 14 August 2026; local completion evidence frozen  
**Review URL:** `http://127.0.0.1:3237/`  
**Migration:** `089_agent_employment_leave.sql` — implemented locally, unapplied

## Implemented package

- Effective-dated agent employment with reporting Manager, work pattern and leave-policy assignment.
- Admin-maintained, versioned leave types, policy entitlements and direct activation without a
  maker-checker step.
- Immutable balance ledger and immutable leave decisions.
- Agent My Leave workspace with current balances, full-/half-day application, submission, withdrawal
  and history.
- Monday–Friday working-day calculation; Saturday/Sunday excluded; no public-holiday maintenance.
- Server-derived reporting Manager. A Manager's own request routes to Director; self-approval is
  prohibited in both domain logic and migration 089.
- Exactly one `leave_approval` Task per submitted approval cycle in the existing My Task Queue.
- Context-aware Task model: leave Tasks require a leave application and prohibit fake Lead/Contact
  links; existing CRM Tasks retain their Lead/Contact context.
- Generic Task completion/cancellation cannot decide leave. Approve/reject writes the immutable
  decision, balance movement where applicable and Task completion in one transaction.
- Admin organization register and Manager Task row do not expose private leave reason or evidence.
- Owner review correction on 14 August 2026: the Manager Task now labels the leave type explicitly;
  Review leave displays both leave type and reason for leave prominently to the assigned approver.
  The broad Admin register and team calendar remain privacy-restricted.
- No payroll, salary deduction, attendance device, commission adjustment, notification provider or
  external HR integration.

## Synthetic review story

The loopback-only, GET-only review provides:

1. **My Leave** — balances, application and history from the agent perspective;
2. **Manager · My Task Queue** — the submitted leave beside normal CRM Tasks, with Review leave;
3. **Governed leave decision** — balance impact and atomic Task completion explanation;
4. **Administration** — leave type, policy, reporting line and employment register; and
5. organization leave visibility without private reason/evidence content.

All displayed names, references, dates and balances are synthetic.

## Verification

- Focused agent employment/leave domain and integration tests: **34/34 passed**.
- Complete local repository suite: **884/884 passed**.
- JavaScript syntax checks passed for domain, routes, server, app, bootstrap, UI and review tool.
- No migration was applied and no database, external API, external environment or service was
  accessed.

## Owner review points

1. Agent balances and application history are understandable.
2. Submission clearly routes to the reporting Manager without agent selection.
3. Leave approval appears in the existing My Task Queue, not a new approval inbox.
4. Review leave supplies enough controlled context to decide without exposing private facts broadly.
5. Generic Complete Task cannot bypass approve/reject.
6. Admin employment, policy and leave-register separation is correct.
7. Manager-own-leave routing to Director and the no-self-approval rule are acceptable.

## Owner decision

The owner accepted the corrected Gate 3 review on 14 August 2026 after confirming that the assigned
approver can clearly see both Leave type and Reason for leave. Gate 3 approval authorizes local Gate 4
documentation only. It does not authorize applying migration 089, deployment, external packaging,
service restart or external access.
