# CRM Test dev.148 — Existing-Customer Lead Creation Hotfix

**Date:** 16 August 2026 (Asia/Dubai)
**Version:** `2.1.0-dev.148`
**Target:** CRM Test only
**State:** local correction; deployment requires fresh explicit approval

## Confirmed failure and RCA

Customer search and selection were corrected in dev.147, but creating the Lead failed inside the
database transaction. Live CRM Test reported PostgreSQL error `23514` against
`leads_assignment_status_check`.

The manual Sales Agent path used `assignment_status='accepted'`. The authoritative Lead constraint,
created in migration 003 and still current, permits only `unassigned`, `assigned`,
`reassignment_due`, or `closed`. `accepted` belongs to the `lead_assignments.status` history row,
not the `leads.assignment_status` lifecycle column.

The failed transaction rolled back. It did not leave a partial Lead, assignment row or stage-history
row.

## Correction

- A manually created Lead for an eligible Sales Agent now persists `leads.assignment_status` as
  `assigned`.
- Immediate acceptance remains represented by `leads.accepted_at`, the Sales Agent in
  `leads.assigned_to`, and an accepted `lead_assignments` row with `responded_at`.
- Unassigned intake continues to use `leads.assignment_status='unassigned'` and a queued assignment
  row.
- The regression test reads the authoritative migration constraint and proves that the route uses a
  permitted Lead lifecycle state while retaining the accepted assignment-history state.

No database migration or remote data repair is required.

## End-to-end Lead creation status audit

| Creation path | Lead lifecycle | Assignment history | Customer / requirement behavior | Result |
|---|---|---|---|---|
| CRM interface — new Customer | `assigned` for eligible Sales Agent self-capture, otherwise `unassigned` | `accepted` for self-capture, otherwise `queued` | Customer, roles, channels, Lead and history share one transaction | Corrected shared helper; covered |
| CRM interface — existing Customer | Same shared helper and lifecycle rules | Same shared helper and history rules | Uses the selected active Customer; entire Lead creation transaction rolls back on error | Corrected; covered |
| Website buyer/investor profile | `unassigned` | `queued` | Investment purpose keeps both `buyer` and `investor` roles; profile fields create a `website_profile` structured requirement | Unchanged; verified |
| Website Property Selection continuation | Existing Lead ownership is preserved or governed through Manager review; unassigned rerouting remains `unassigned` | Existing assignment preserved, or prior row becomes `reassigned` and the new row `queued` | Reuses the same journey Customer and Lead, supersedes the prior requirement and inserts version + 1 with conflict evidence | Unchanged; verified |
| Current CRM import | `unassigned` | `queued` | Imported Lead, assignment and stage history share one transaction | Unchanged; verified |

The audit compared direct Lead lifecycle writes with the migration-003 allowed set and assignment
history writes with the migration-005 allowed set. Website intake, evidence and AI-routing states were
also compared with migrations 064, 070 and 074. No additional invalid status write was found in
these Lead-creation flows.

## Retest

1. Search and select `August1526` or another permitted existing Customer.
2. Complete the required Lead fields and create the Lead.
3. Confirm success, the selected Customer identity, the Lead reference, and exactly one Lead row.
4. For Sales Agent creation, confirm the Lead is assigned and accepted immediately; for other
   eligible roles, confirm it enters the governed assignment queue.

No CRM Test, Production, Production/R2 clone or external integration mutation is authorized by this
local correction record.
