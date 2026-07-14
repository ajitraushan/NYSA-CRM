# Release 1 Implementation Traceability

## Authority

- Requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- Foundation implementation: `b738961a6f8253a459ee0e9737b52d986f7f95c4`
- Active completion branch: `agent/release-1-completion`

`docs/ACCEPTANCE_CRITERIA.md` is authoritative. A feature is not complete merely
because a screen, route, or table exists; the corresponding acceptance behavior
and tests must pass.

## Completion increments

### Governance and record scope

Implementation files:

- `src/migrations/004_governance_and_scope.sql`
- `src/crm-policy.js`
- `src/routes/governance.js`
- scoped changes in `src/routes/crm.js`
- administration and contact-governance screens in `public/app.js`

Acceptance areas addressed:

- Users, Roles, and Teams: effective-dated memberships and role/record scope
- Contacts and Companies: organization separation, multi-role records, normalized
  channels, duplicate review, merge history, consent evidence, and restrictions
- Dashboards and Reports: the same record scope is applied to overview and summary data
- Controlled Values: stable codes, lifecycle metadata, retirement/replacement model,
  and no destructive delete endpoint
- Security, Privacy, and Audit: explicit Agent, Manager, Director, Accountant, and
  Administrator access behavior with sensitive-action auditing

Verification evidence:

- JavaScript syntax checks across the repository
- dependency-free domain and CRM policy tests
- PostgreSQL migration execution remains required against a fresh database and an
  isolated restored production backup before this increment can pass deployment acceptance

### Lead operations and secured intake

Implementation files:

- `src/migrations/005_lead_operations.sql`
- `src/routes/lead-operations.js`
- `src/routes/website-intake.js`
- lifecycle, routing, activity, and UI changes in `src/routes/crm.js` and `public/app.js`

Acceptance areas addressed:

- Stable imported identifiers and idempotent signed website events
- Configurable business calendar and immutable activated SLA policy versions
- Rule-based team/agent routing and effective assignment sequence history
- Acceptance, rejection, timeout, scoped reassignment, and required next action
- Validated lead transitions, stage history, versioned structured requirements,
  inventory links, conversion scaffolding, task outcomes, and SLA queues
- Support-visible intake failures and controlled replay without retaining or exposing
  full sensitive payloads

Verification evidence:

- Fifteen dependency-free domain and authorization assertions pass
- JavaScript syntax checks and Git whitespace/error checks pass
- PostgreSQL migration execution and end-to-end HTTP workflow tests remain required
  in the deployment environment

## Remaining increments

1. Versioned qualification models/assessments and persisted financial scenarios
2. Private property media, proposals, generated versions, documents, and attachments
3. Agent, Manager, and Managing Director dashboards, drill-down, filtering, and audited export
4. Full workflow, permission, migration, backup, and controlled smoke-test evidence
