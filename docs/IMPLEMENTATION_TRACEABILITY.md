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

### Qualification and financial snapshots

Implementation files:

- `src/migrations/006_qualification_and_finance.sql`
- `src/routes/qualification-finance.js`
- deterministic calculation and validation functions in `src/crm-domain.js`
- administration, assessment-history, and scenario screens in `public/app.js`

Acceptance areas addressed:

- Draft, approval, activation, retirement, and immutable model versions
- Explainable factor contributions, boundary thresholds, missing-input policy,
  prohibited sensitive/social inputs, controlled override, and assessment history
- Mortgage principal, payment, repayment, interest, LTV, and DBR calculations
- Gross/net yield, annual cost, vacancy, and cash-on-cash calculations
- Versioned regulatory assumptions and immutable customer/property scenario snapshots

Verification evidence:

- Qualification boundary, missing-input, override, model-change, and prohibited-factor tests
- Independently calculable mortgage and investment headline-output tests
- PostgreSQL and HTTP workflow execution remain open deployment-environment checks

### Private media, documents, and proposal versions

Implementation files:

- `src/migrations/007_media_documents_proposals.sql`
- `src/private-files.js`, `src/simple-pdf.js`, and `src/routes/files-proposals.js`
- media, document, proposal-template, builder, review, delivery, and download screens
  in `public/app.js`

Acceptance areas addressed:

- Private random-key storage outside public/Git paths with configured limits
- Type, magic-byte, extension, size, security-test, hash, ownership, order, source,
  approval, and download-audit controls
- Operational document metadata, exact immutable versions, record links, revisions,
  scoped metadata/download, and precise sent-document activity linking
- Quick, Investment, and Comparison templates; one-to-three-property validation;
  authoritative organization/contact/requirement/property/media/finance snapshots;
  generated PDF hash; review; immutable versioning; and exact delivery evidence

Verification evidence:

- Upload validation, malicious-test rejection, SHA-256, and PDF structure tests pass
- Full JavaScript syntax and Git patch checks pass
- Visual PDF fidelity, timed three-minute preparation, PostgreSQL execution, and
  end-to-end authenticated download workflows remain environment-level tests

## Remaining increments

1. Agent, Manager, and Managing Director dashboards, drill-down, filtering, and audited export
2. Full workflow, permission, migration, backup, and controlled smoke-test evidence
