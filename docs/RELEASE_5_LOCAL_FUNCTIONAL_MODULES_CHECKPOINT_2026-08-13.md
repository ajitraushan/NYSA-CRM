# Release 5 — Local Functional Modules Checkpoint

**Date:** 13 August 2026 (Asia/Dubai)  
**Scope:** local/offline functional development only  
**External environments:** untouched

## Release 5 initiation

Release 4 local functional work has reached its planned offline boundary. The remaining portal-linked
work is separately governed and is not part of this task. Work now proceeds to the frozen Release 5
sequence: commission rules and allocations, financial lifecycle, then statements/exports and
reconciliation.

## Story 1 — Commission Receipt and Real-Time Agent Payout

- Gate 1 document: `RELEASE_5_COMMISSION_RECEIPT_REALTIME_AGENT_PAYOUT_INTEGRATION_GATE_1.md`
- Status: **GATES 1–3 OWNER-APPROVED; GATE 4 LOCAL COMPLETION RECORDED**
- Migration: `088` implemented locally and deliberately not applied
- The narrower expected-commission proposal was expanded by owner direction before implementation.
- Proposed package boundary: expected commission, immutable actual receipt confirmation, mandatory
  Close Won receipt gate, one-/two-agent revenue credit, versioned per-agent payout plans and slabs,
  real-time Deal-level payout calculation, quarterly-reset cumulative tracking, company default slabs
  with optional individual-agent adjustments, fixed Monday–Friday working-day calculation,
  three-working-day release monitoring and complete drill-down. Saturday and Sunday are excluded;
  there is no holiday or bank-calendar maintenance.
- Reused authorities: existing Deal, Opportunity representation terms, broker roles/scope, governed
  Partner Organization versions, Documents/evidence references and audit log.
- Explicitly deferred: payment execution, payroll, bank integration, tax posting, accounting journals
  and external finance-system integration.

Owner approval recorded on 14 August 2026 authorizes Gate 2 schema/API design only. Material migration,
API and CRM UI implementation remains subject to Gate 2 approval.

Gate 2 owner clarification recorded on 14 August 2026: standard one-/two-agent revenue allocation must
read the existing Deal workflow's Originating-agent split % and Servicing-agent split % values. The
finance workflow will not introduce a duplicate standard percentage input. Only a separately governed
Director/full-Administrator exception may differ, with Deal values retained as before-evidence.

Gate 2 owner clarification recorded on 14 August 2026: calculated agent payout is presented in a
separate **Payout** workspace visible only to Director, with drill-down to contributing Deals and each
Deal calculation. Every payout API enforces Director-only access. Full Administrator retains policy and
individual-agent slab maintenance but cannot view operational payout calculations.

Gate 2 owner approval recorded on 14 August 2026 authorizes local Gate 3 implementation and testing.
Migration 088 must remain unapplied; no external environment action is authorized.

## Story 1 — Gate 3 local implementation checkpoint (14 August 2026)

- Migration `088_release5_commission_receipt_realtime_payout.sql` is implemented locally and unapplied.
- Deterministic domain, authenticated APIs, existing Close Won integration, Admin payout-policy UI and
  Director-only Payout UI are implemented.
- Standard agent revenue credit reads the existing Deal split fields and freezes their exact values.
- Synthetic local review: `http://127.0.0.1:3236/`.
- Focused verification: **31/31 passed**.
- Complete local repository suite: **850/850 passed**.
- Browser verification confirmed Deal drill-down, Admin/Director separation and zero console errors.
- Gate 3 owner approval recorded on 14 August 2026.
- Gate 4 completion record: `RELEASE_5_COMMISSION_RECEIPT_REALTIME_PAYOUT_GATE_4_COMPLETION.md`.
- Status: **STORY 1 LOCALLY COMPLETE; MIGRATION UNAPPLIED**.

No migration, package or application was deployed or applied to CRM Test, Production, R2, cPanel or
any external service. No credential or private owner/contact/authority information was requested,
stored or displayed.

## Remaining frozen Release 5 sequence

Story 1 completes the commission-receipt and real-time agent-payout package only. Release 5 still has
two major functional builds from the frozen plan:

1. broader expected/approved/invoiced/received/paid financial lifecycle, ageing and leakage controls;
2. statements, accounting exports and Director/accountant reconciliation.

The next story requires a fresh Gate 1 design and owner approval before material implementation.

## Story 2 — Financial lifecycle, ageing and leakage

- Gate 1 design: `RELEASE_5_FINANCIAL_LIFECYCLE_AGEING_LEAKAGE_GATE_1.md`
- Status: **WITHDRAWN BEFORE GATE 1 APPROVAL — EXISTING ACCOUNTING SYSTEM IS AUTHORITATIVE**
- Proposed migration `090` was not created or applied and remains unused
- Reuses migration 088 expected commission and confirmed receipt evidence; no duplicate receipt or
  agent-payout authority.
- Proposed boundary: Director receivable approval, Accountant invoice/receipt allocation, partial
  settlement, calendar-day invoice ageing, leakage Tasks in the existing My Task Queue and complete
  Deal drill-down.
- Statements/accounting exports remain the final separate Release 5 package.

Owner decision recorded on 14 August 2026: NYSA already operates an invoice/accounting system, so CORE
must not duplicate invoicing, receivables, ageing or accounting settlement. No implementation started.
Any future Release 5 finance continuation is limited to a separately approved accounting-system
interface/reconciliation package after the existing system and supported exchange method are identified.

## Controlled additional requirement — agent employment and leave

On 14 August 2026 the owner added agent employment maintenance, leave maintenance, agent leave
application, Manager approval and leave tracking. This is recorded in
`AGENT_EMPLOYMENT_AND_LEAVE_REQUIREMENT_INTAKE_2026-08-14.md` as a separate workforce-administration
package. It is not silently included in the completed commission/payout story and no implementation
is authorized by requirement intake alone.

Gate 1 owner approval was recorded on 14 August 2026. The owner requires submitted leave approvals
to use the existing My Task Queue. Gate 2 proposes migration `089` and a polymorphic Task context;
Gate 2 owner approval was recorded on 14 August 2026. Migration 089, the deterministic leave domain,
authenticated APIs, Admin/My Leave UI and My Task Queue integration are implemented locally; migration
089 remains unapplied. Gate 3 owner acceptance was recorded on 14 August 2026 after the approver view
was corrected to show Leave type and Reason for leave explicitly. The package is locally complete at
Gate 4; completion record: `AGENT_EMPLOYMENT_AND_LEAVE_GATE_4_COMPLETION.md`.
