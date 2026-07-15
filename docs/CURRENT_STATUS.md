# NYSA CORE Current Status

## Snapshot

- Date: 2026-07-15
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
- External broker and customer access are intentionally excluded.
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
