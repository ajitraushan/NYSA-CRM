# NYSA CORE Current Status

## Release 1 production-promotion decision — 2026-07-19

- The NYSA owner explicitly accepted Release 1 on 2026-07-19.
- The accepted application has passed all 106 local automated tests.
- The CRM Test routing suite passed 30/30 authenticated scenarios; the user then
  confirmed the maintained routing rules are ready.
- Production promotion is authorized but has not yet occurred.
- Promotion will use one consolidated source package and migrations 011 through 026,
  rehearsed first against an isolated restore of the production database.
- No CRM Test database, synthetic users, fixture records, seed scripts, test output,
  private uploads, generated proposals, logs, backups, credentials or `.env` files may
  enter production.
- Release 1.1 inventory and area-routing refinements remain outside this Release 1
  production package.
- Release 1 source `42a8c42` is now deployed to production. Migrations 011 through
  026 are recorded, runtime syntax passed, the production worker is running and health
  is database-ready. Initial smoke testing raised R1-UAT-034 for alignment of selected
  administration entry forms. R1-AMD-030 Revision 1 passed 107 automated tests, was
  deployed to CRM Test and was explicitly accepted by the user on 2026-07-19. A
  separate production presentation hotfix remains pending.

## Snapshot

- Date: 2026-07-18
- Production environment: Release 1 deployed with the NYSA CORE user-facing brand
- URL: https://crm.nysarealty.com
- Health endpoint: `GET /api/health`
- Expected health response: `{ "ok": true, "database": "ready" }`
- Production database: PostgreSQL 13.23
- Node.js hosting runtime: 24.16.0
- Canonical repository: `C:\Users\ajitr\Projects\NYSA-CRM`
- GitHub repository: `ajitraushan/NYSA-CRM` (private)
- Production deployed source commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- Release 1 requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- Local completion branch: `agent/release-1-completion`
- Dashboard production package commit: `b7341df639f6afa28045535651a2502930ab468c`
- Effective dashboard production release commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- Dashboard staging URL: `https://crm-test.nysarealty.com`
- Dashboard staging database: `nysareal_nysacrm_r1test`
- Phase 1 field review: RR-001 through RR-011 incorporated into Revision 2
- Review workbook: 462 fields across 24 modules, awaiting business sign-off

## Implemented

- Secure first-administrator bootstrap, now disabled in production
- Login, logout, server-side sessions, and access revocation
- Invitations and current broker-role administration
- Property listing creation, editing, filtering, status, comments, and archiving
- Dashboard-first user interface
- PostgreSQL migrations and startup health check
- Audit records for material current-MVP actions
- cPanel production deployment and TLS endpoint
- Private Git source control with secrets and runtime data excluded
- R1-AMD-001 through R1-AMD-012 are deployed to CRM Test as effective source
  `3b49652`. The current consolidated package is
  `nysa-core-r1-uat-crm-test-3b49652.zip`; all earlier CRM Test correction packages
  through un-deployed `7705e0b` are superseded.
- The automated suite passes 69 assertions. CRM Test migrations 011 and 012 are
  recorded, and health returns HTTP 200 with database ready.
- R1-AMD-012 Revision 3 is deployed: oversized-logo validation occurs before profile
  creation, failed-logo retry stays linked to the saved draft, unused drafts alone can
  be reason-deleted, and version comparison is explained. Profile v5 is Approved with
  logo evidence; v1-v4 are Retired protected history. Profile v5 was subsequently
  activated during user retest; proposal-output confirmation remains pending.
- R1-AMD-006 Revision 6 is deployed to CRM Test as hotfix source `53aa930`. The user
  confirmed the closed-by-default edit/new-version workflow and aligned version summary
  on 2026-07-16. Funding-method calculation and proposal-output retests remain pending.
  Revision 6 keeps the form closed until Start new rule set, Edit draft or Create new
  version. The
  earlier Revision 4 attempt was not accepted because CRM Test still served the old
  screen. Revisions 5 and 6 replace the incomplete simple fee rows with contextual
  bases/formulas, conditional bands, VAT,
  quantities, estimates/caps, payer/source governance and scenario snapshot details;
  drafts can be explicitly edited/tested, saved versions remain read-only, new versions
  can be created from governed history, bank-finance-only fees are excluded from cash
  purchases, versions can be compared, and unused draft/approved versions can be
  reason-retired before administrator approval and activation.
- R1-UAT-001 through R1-UAT-013 remain open at `Deployed to CRM Test`; R1-UAT-013 has
  partial user confirmation for its fee-screen workflow only. None may close until all authenticated
  retesting passes and the user explicitly confirms it.
- Production is excluded from this correction cycle. The only authorized deployment
  and manual-test target is `https://crm-test.nysarealty.com/`.
- Lead-creation package source `60c9b82` and migrations `017` and `018` are deployed to
  CRM Test. Health is database-ready and both migrations are recorded. User retest then
  found lowercase budget-suffix handling and a split customer/lead save outcome: the
  first lead request failed after its customer request committed, so retry detected the
  retained email/phone as a duplicate. R1-AMD-016 Revision 2 and R1-AMD-020 Revision 1
  are implemented locally: business amounts are normalized before submission and a new
  customer, channels, role, lead, queue history and audit evidence commit atomically.
  CRM Test deployment, retest and explicit user confirmation remain pending.
- The automated suite passes 94 tests after the governed Structured Requirements save and
  visible AI-failure corrections. Changed
  browser and route JavaScript pass syntax validation; PostgreSQL-backed CRM Test failure-
  rollback and committed-success verification remain required.
- R1-AMD-017 Revision 2 restores the existing-customer dropdown as a separately labelled,
  always-visible alphabetical selector; search remains an optional ranking aid and does
  not replace or hide the dropdown. This revision supersedes hotfix package `377f77e`
  before deployment.
- CRM Test retest of hotfix `0da2d89` exposed a browser-only submit regression: Create lead
  was implicitly a submit button, while the new save guard searched for an explicit
  `type="submit"` and stopped before calling the API. R1-AMD-020 Revision 2 explicitly
  identifies the control and adds a visible fallback; a superseding CRM Test hotfix is
  required.
- R1-AMD-021 Revision 1 is agreed for a dedicated Customer workspace. Existing KYC is
  already stored once against the reusable contact record, but its maintenance is currently
  reachable only from a lead. The new workspace will make the customer authoritative across
  leads, proposals and related operations while retaining masked output and role-restricted
  private-document access. Implementation and CRM Test deployment have not started.
- R1-AMD-021 Revision 2 is implemented locally: Customers is a primary CRM
  workspace and owns verification/KYC maintenance; customer detail shows related leads.
  Lead detail becomes a consumer with a read-only summary and Open customer record action,
  rather than requiring users to open a lead before maintaining the customer.
- CRM Test now successfully created a new-customer lead after deployment of `82acac1`,
  confirming the route and submit correction for a valid case; R1-UAT-021 remains open for
  rollback, duplicate and exact-count evidence. R1-AMD-022 Revision 1 is implemented locally
  to require customer name/email/phone/preferred channel plus both lead budget limits and at
  least one preferred area, including direct API and incomplete-existing-customer guards.
- R1-AMD-009 Revision 2 is implemented locally after qualification-maintenance usability retest failed.
  CRM Test has no active model applicable to the tested lead, while the current screen uses
  free-text Business line, unlabeled dense factor rows and no understandable activation path.
  The next revision will provide governed business-line choices, active coverage, labelled
  factor cards and a guided Draft -> Test -> Approve -> Activate lifecycle.
- The generic sensitive-factor message was traced to substring matching: `age` incorrectly
  matched the legitimate factor word `mortgage`. Whole-term matching and a message naming
  the actual prohibited personal/social attribute are implemented locally and tested;
  mortgage readiness remains permitted.
- CRM Test typography hotfix `378b3a8` increased maintained interface font sizes by 15%; the
  user explicitly confirmed on 2026-07-18 that the new size is working. R1-UAT-025 and
  R1-AMD-025 Revision 1 are closed.
- R1-AMD-026 through R1-AMD-028 are implemented locally: financial scenarios use separate
  mortgage/investment business forms instead of JSON, private lead documents have a scoped
  immutable register and separate consent-evidence action, and lead tasks are presented as an
  owned action plan. CRM Test deployment and explicit workflow/security confirmation remain
  pending; production remains excluded.
- R1-AMD-006 Revision 13 and R1-AMD-014 Revision 4 are implemented in the current
  local commit. Proposal builder now reports missing prerequisites, creates a
  preparation shell only from an active template, presents a transparent governed
  shortlist, groups approved media under its inventory property, drafts editable AI
  highlights/suitability only after user selection, explains saved-scenario assumptions
  and preserves separate immutable generation. The complete automated suite passes. The
  cumulative CRM Test package and script are prepared; deployment, authenticated retest
  and explicit user confirmation remain pending, and no related finding is closed.
- CRM Test financial-scenario retest exposed that no Regulatory and Fee Assumption version
  was active. The server correctly rejected persistence, but the screen accepted all inputs
  before exposing that prerequisite and did not provide a calculation-only review. R1-AMD-026
  Revision 2 now reports readiness first and separates Calculate and review from Save immutable
  snapshot, with explicit EMI, LTV, DBR, repayment, interest and fee output bound to the exact
  reviewed assumption version. All 94 automated tests pass; CRM Test deployment,
  authenticated retest and explicit user confirmation remain required.

## Release 1 Deployed Implementation

The deployed Release 1 source implements the governance, scoped CRM
access, contacts/companies/channels, documentary marketing consent, lead routing and
SLA, signed/idempotent website intake, lifecycle/requirements/tasks, explainable
qualification, immutable finance scenarios, private media/documents, controlled
proposal versions, role dashboards, reports, governed values, activity correction,
and hierarchical drill-down described by the `3ccbcc7` baseline. The user-facing
header is branded NYSA CORE under decision D-030.

Evidence is recorded in `docs/RELEASE_1_ACCEPTANCE_STATUS.md`. Deployment does not
by itself close Release 1 acceptance: authenticated end-to-end, controlled-data
reconciliation, timed proposal, and remaining production workflow gates stay open.

## Production Verification Completed

- Application health returned database ready.
- Administrator setup completed and bootstrap key removed.
- Administrator logout and login succeeded after restart.
- Controlled listing create, read, update, status, comment, and archive smoke test passed.
- Production migrations `002` through `009` applied and were recorded in
  `schema_migrations`; a second migration run completed without reapplication.
- Release 1 health, authenticated dashboard, Leads, Inventory, and Administration
  pages loaded after deployment.
- Dashboard source hotfix `5299a39`, logo hotfix `17abe8d`, and NYSA CORE branding
  hotfix `1179cca` were deployed and verified.
- Manual PostgreSQL custom-format backup created with `pg_dump`.
- Downloaded backup signature and SHA-256 were verified locally.
- Backup restored successfully into an isolated database.
- Restored counts matched the expected admin, smoke-test, audit, and migration data.
- Restore-test database was removed and production health remained ready.
- Migration `010_role_dashboard_rebuild.sql` was applied to the isolated dashboard
  staging database and a second run completed without reapplication.
- Guarded dashboard fixtures were created only in the `_r1test` database.
- Managing Director, Manager, and Agent dashboards passed role-specific visual
  testing, including hierarchy scope, complete breadcrumbs, drill-down records,
  personalized titles, period presets, source-dependent Campaign filtering, and
  inventory attribution/detail access.
- The committed automated suite passes 49 tests with no failures, including the
  LiteSpeed/CloudLinux CommonJS-to-ESM startup wrapper contract.
- Production migration `010_role_dashboard_rebuild.sql` applied exactly once;
  `dashboard_metric_snapshots` exists and all captured business-record counts were
  unchanged after deployment.
- Production returned HTTP 200 with database ready after the cPanel startup file
  was changed to `app.cjs`.
- Production UI smoke testing passed for Administration, Leads, Inventory,
  personalized role dashboards, all four Managing Director views, period presets,
  and Source/Campaign filtering. No dashboard fixtures were seeded in production.

## Backup Status

- Verified pre-Release 1 server backup: `~/crm-backups/nysacrm-pre-release1-20260714.dump`
- Pre-Release 1 backup SHA-256: `176c74b46c839628b1cf1267a089839fc071ad93e7560963c32b5502ebba400c`
- Verified pre-dashboard database backup:
  `~/crm-backups/nysacrm-pre-dashboard-b7341df-20260715.dump`
- Pre-dashboard database backup SHA-256:
  `baa38ddee84f67b392b84222016ec217888f06cbbd471bb5697b52e848d3e591`
- Verified pre-dashboard application backup:
  `~/crm-backups/nysa-crm-app-pre-dashboard-b7341df-20260715.tar.gz`
- Pre-dashboard application backup SHA-256:
  `8fd0d58ca4086a4b6f82367c91b37f2965c43907dd84932bc068b88d5533701b`
- Verified server backup: `~/crm-backups/nysacrm-2026-07-13.dump`
- Verified local backup: `CRM Backup/nysacrm-2026-07-13.dump`
- Verified local SHA-256: `9FF995D145D0A7E9A348D239993E7F9280DBA672857433EE3B0294AD3FFF3C60`
- Hosting ticket created requesting `PSQLBACKUP`, schedule, retention, off-server
  storage, restore procedure, failure notification, and phpPgAdmin export repair.
- Open operational dependency: written Tasjeel confirmation is still pending.

## Known Gaps

- The Agent, Manager, and Managing Director dashboard rebuild is deployed and
  production-smoke-tested; formal requirement acceptance remains separate.
- Production source is manually deployed; deployment is not yet automated from Git.
- Release 1 migrations `002`–`009` still require execution on a fresh database and
  an isolated restored production backup for formal acceptance evidence.
- Authenticated PostgreSQL-backed role/workflow tests, dashboard reconciliation, and the timed proposal test remain pending.
- The production deployment is manual and the deployed source commit must continue
  to be recorded for every hotfix.
- Full opportunity/deal, commission, and transaction-compliance workflows remain later releases.
- No configured email, calendar, WhatsApp, portal, or accounting integration.
- No configured NYSA website, Meta, Property Finder, or Bayut integration credentials.
- External Broker remains an interface identity classification only; external broker
  authentication and CRM access, and customer access, remain intentionally excluded.
- The existing `listing_agent` role currently uses the lead-centric Agent dashboard;
  Release 1.1 will provide its approved Listing Executive inventory workspace.

## Next Approved Workstream

Complete the remaining Release 1 acceptance gates in
`docs/RELEASE_1_ACCEPTANCE_STATUS.md`, then implement the approved Release 1.1 scope
in `docs/RELEASE_1_1_SCOPE.md`. Do not start Release 2 until Release 1 acceptance,
Release 1.1, and the applicable business sign-offs are complete.

## Handoff Prompt for a New Task

Use:

> Read `docs/README.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, and the
> latest Git history. Reconcile them with the current code before making changes,
> then continue the named NYSA CRM workstream.
