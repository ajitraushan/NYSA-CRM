# Release 1 Test Findings

Environment: `https://crm-test.nysarealty.com/`

Started: 2026-07-15

Owner: NYSA Release 1 acceptance

This is the authoritative register for findings raised during manual Release 1
acceptance. A finding is not closed merely because code is changed. Closure requires
deployment to CRM Test, user retest, recorded evidence, and an explicit pass.

## Status workflow

`Open` -> `Implemented locally` -> `Deployed to CRM Test` -> `Retest passed` -> `Closed`

## Active findings

### R1-UAT-001: Controlled-values list alignment and hierarchy

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Open
- Priority: High
- Evidence: User screenshots show the set name and stable code joined together,
  vertically centred Class and Add definition controls, and definition labels/statuses/
  Activate buttons without fixed columns.
- Required correction:
  - Show set name and stable code on separate lines.
  - Top-align set, class and action cells.
  - Add a labelled Actions column.
  - Render definitions in fixed Definition, Status and Action columns.
  - Preserve a usable responsive layout with multiple definitions.
- Retest condition: One set containing at least five definitions remains aligned at
  desktop and narrow viewport widths and every action is clearly associated with its
  definition.

### R1-UAT-002: Safe edit, correction, deletion and retirement lifecycle

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Open
- Priority: Must
- Related acceptance criteria: 181, 183, 184 and 185
- Finding: The frontend exposes creation and activation but no Edit, Delete unused
  draft, Deprecate, Retire or Replace controls. Value sets have no maintenance actions.
  The backend can patch selected definition fields but does not provide the complete
  safe lifecycle required for administrators.
- Agreed business rule:
  - An unused draft set or definition may be edited and deleted.
  - A draft stable code may be corrected only while unused and before activation.
  - Once activated or used, the stable code is immutable.
  - Used values are never hard-deleted; they are deprecated or retired with impact,
    reason, effective date and optional replacement.
  - Class B and C changes continue to require controlled-release governance.
- Required correction:
  - Add edit actions for set details and draft definitions.
  - Add guarded deletion for unused drafts only.
  - Show usage count and impact before status changes.
  - Add Deprecate, Retire and replacement-value actions.
  - Require confirmation, reason, effective date and audit evidence.
- Retest condition: Draft correction/deletion succeeds only at zero usage; used values
  cannot be renamed/deleted; retirement preserves historical records and audit.

### R1-UAT-003: Stable-code format validation

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Open
- Priority: High
- Evidence: CRM Test accepted a mixed-case stable code (`Loss_Reason`) and the earlier
  screen accepted a space-separated code.
- Required correction: Validate new stable codes as lower-case snake_case, show an
  inline example, reject spaces/mixed case, and detect duplicates before creation.
- Retest condition: `loss_reason` is accepted; `Loss_Reason`, `loss reason`, blank and a
  duplicate are rejected with clear messages.

### R1-UAT-004: Controlled-value registry consumer wiring

- Date raised: 2026-07-15
- Area: Administration and operational CRM screens
- Status: Open
- Priority: Must for full controlled-value acceptance
- Finding: The governed registry is versioned and audited, but several Release 1
  operational dropdowns and reason fields still use fixed application values or free
  text.
- Required correction: Maintain a consumer-by-consumer map and connect approved Class
  A sets to the applicable lead, activity, assignment, task, company and listing fields.
  Class B state machines remain application-controlled.
- Retest condition: Each declared live consumer reads active definitions, excludes
  retired values from new entry, resolves historical labels, and reports by stable code.

## Review discipline

For every new test observation:

1. Assign the next `R1-UAT-###` identifier.
2. Record environment, evidence, priority, required correction and retest condition.
3. Link the finding to the relevant acceptance criterion.
4. Do not mark it closed until CRM Test retest is explicitly confirmed by the user.
5. Include all open findings in the Release 1 acceptance decision.
