# Agent Employment and Leave — Gate 4 Completion

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** locally complete; owner-approved; migration unapplied  
**Boundary:** workforce-administration package only

## Approval chain

- Gate 1: owner-approved functional design, including Manager approval and Director routing for a
  Manager's own leave.
- Gate 2: owner-approved migration/API contract requiring approval requests in the existing My Task
  Queue rather than a separate approval inbox.
- Gate 3: owner-approved local implementation and corrected synthetic review on 14 August 2026.
- Gate 4: this record freezes the locally accepted package and evidence.

## Frozen functional outcome

- Effective-dated internal-agent employment, reporting Manager, work pattern and leave-policy version.
- Admin-maintained leave types and entitlement policies with direct Admin activation.
- Agent My Leave balances, full-/half-day application, submission, withdrawal and history.
- Monday–Friday working-day calculation without public-holiday maintenance.
- Server-derived Manager approval; Manager-own leave routes to Director; self-approval is prohibited.
- One `leave_approval` Task per submitted approval cycle in the approver's existing My Task Queue.
- The Task states Leave type explicitly. Review leave prominently displays Leave type and Reason for
  leave to the assigned approver.
- Generic Task completion/cancellation cannot decide leave.
- Approve/reject atomically records the immutable decision, applicable balance movement and Task
  completion.
- Broad Admin register and team calendar do not expose private leave reason or evidence.

## Package inventory

- Domain: `src/agent-leave-domain.js`
- Unapplied migration: `src/migrations/089_agent_employment_leave.sql`
- API: `src/routes/agent-leave.js`
- Existing My Task Queue integration: `src/routes/lead-operations.js`, `public/app.js`
- Agent/Admin/approver UI: `public/agent-leave-ui.js`, `public/bootstrap.js`
- Server mount: `src/server.js`
- Tests: `test/agent-leave-domain.test.js`, `test/agent-leave-integration.test.js`
- Synthetic review: `tools/agent-leave-local/`
- Design and review evidence: Gate 1 intake, Gate 2 contract and Gate 3 review documents in `docs/`.

## Final verification evidence

- Focused employment/leave verification: **34/34 passed**.
- Complete local repository suite: **884/884 passed**.
- JavaScript syntax checks passed.
- Browser verification confirmed the existing My Task Queue, explicit Leave type and Reason for leave,
  atomic decision explanation, Admin privacy boundary and zero console errors.

## Explicit exclusions

- Payroll, salary deductions, commission/payout changes and end-of-service calculations.
- Attendance/biometric devices, timesheets, hourly leave and public-holiday provider integration.
- External HR, accounting, notification or payment-system integration.

## Environment and promotion boundary

Migration 089 was not applied. No deployment or external-environment package was produced. CRM Test,
Production, R2, cPanel, databases and external services were not accessed or changed. No credentials
or private real-world identity information were requested, stored or displayed.

Any migration application, environment packaging, deployment, service restart or external access
requires separate explicit authorization.
