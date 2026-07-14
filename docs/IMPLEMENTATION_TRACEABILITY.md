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

### Role dashboards, reports, and export

Implementation files:

- `src/migrations/008_dashboards_reporting.sql`
- `src/dashboard-domain.js` and `src/routes/dashboards.js`
- role-specific dashboard, common filters, call report, saved views, drill-down,
  targets, and export screens in `public/app.js`

Acceptance areas addressed:

- Default Agent, Manager, and Managing Director/Executive views
- Effective record scope, personal/team/company workload, qualification, SLA,
  tasks, activity, calls, follow-up, proposals, consent, documents, data quality,
  integration exceptions, and inventory readiness
- Executive tabs, current/prior/target/variance/trend context, approved definitions,
  data-as-of, leading indicators, and explicit unavailability for later-phase metrics
- Shared date/source/team/agent/business-line/stage filters, saved views, scoped
  contributing-record drill-down, detailed call report, and audited CSV export

Verification evidence:

- Dashboard role-selection and KPI arithmetic/reconciliation tests pass
- Existing record-scope tests cover company, managed-team, own-record, and denied scope
- Controlled-dataset SQL reconciliation and browser interaction tests remain
  environment-level checks

## Remaining production-readiness evidence

1. PostgreSQL migrations on a fresh database and isolated restored production backup
2. Authenticated end-to-end workflow and role-permission tests with controlled data
3. Dependency audit, verified pre-deployment backup, and production smoke tests
4. Final deployed-commit documentation and release-note reconciliation

### Acceptance hardening

Implementation files:

- `src/migrations/009_acceptance_hardening.sql`
- hardening changes in CRM, governance, lead operations, website intake, private
  documents/proposals, dashboards, and `public/app.js`
- `docs/RELEASE_1_ACCEPTANCE_STATUS.md`

Acceptance behavior added or corrected:

- Exact executed Marketing Agreement enforcement for outbound channels
- Governed lost/unqualified/duplicate reasons and database stage-transition guard
- Explicit SLA continue/pause policy with original and effective deadline history
- Auditable activity correction and soft-void behavior
- Generic scoped document links and approved document-template versions
- Controlled-value activation reason and impact review
- Approved proposal disclaimers/sections, immutable version-labelled PDF snapshots,
  and literal company-to-business-to-team-to-manager-to-agent drill-down
- Manager-visible failed intake exceptions without retaining sensitive payloads

Local verification now totals 24 passing assertions. All JavaScript syntax checks,
`git diff --check`, the production dependency audit, and rendered PDF visual QA pass.
The line-by-line status and remaining environment gates are recorded in
`docs/RELEASE_1_ACCEPTANCE_STATUS.md`.
