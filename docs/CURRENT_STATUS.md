# NYSA CRM Current Status

## Snapshot

- Date: 2026-07-14
- Environment: Production
- URL: https://crm.nysarealty.com
- Health endpoint: `GET /api/health`
- Expected health response: `{ "ok": true, "database": "ready" }`
- Production database: PostgreSQL 13.23
- Node.js hosting runtime: 24.16.0
- Canonical repository: `C:\Users\ajitr\Projects\NYSA-CRM`
- GitHub repository: `ajitraushan/NYSA-CRM` (private)
- Baseline source commit: `0a70326`

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

## Production Verification Completed

- Application health returned database ready.
- Administrator setup completed and bootstrap key removed.
- Administrator logout and login succeeded after restart.
- Controlled listing create, read, update, status, comment, and archive smoke test passed.
- Manual PostgreSQL custom-format backup created with `pg_dump`.
- Downloaded backup signature and SHA-256 were verified locally.
- Backup restored successfully into an isolated database.
- Restored counts matched the expected admin, smoke-test, audit, and migration data.
- Restore-test database was removed and production health remained ready.

## Backup Status

- Verified server backup: `~/crm-backups/nysacrm-2026-07-13.dump`
- Verified local backup: `CRM Backup/nysacrm-2026-07-13.dump`
- Verified local SHA-256: `9FF995D145D0A7E9A348D239993E7F9280DBA672857433EE3B0294AD3FFF3C60`
- Hosting ticket created requesting `PSQLBACKUP`, schedule, retention, off-server
  storage, restore procedure, failure notification, and phpPgAdmin export repair.
- Open operational dependency: written Tasjeel confirmation is still pending.

## Known Gaps

- Product package/runtime text still contains NYSA Pocket Ledger naming.
- Production source is manually deployed; deployment is not yet automated from Git.
- No dedicated team, contact, lead, activity, opportunity, deal, commission, or document modules.
- Current roles do not yet match the approved internal NYSA role model.
- No property media model suitable for customer proposals.
- No automated test suite or continuous-integration workflow.
- No configured email, calendar, WhatsApp, portal, or accounting integration.
- No configured NYSA website, Meta, Property Finder, or Bayut integration credentials.
- External broker and customer access are intentionally excluded.

## Next Approved Workstream

Release 1: Lead Operations and Customer Sales Enablement.

Start with:

1. Resolve the open decisions in `docs/DECISIONS.md`.
2. Rename product-facing NYSA Pocket Ledger references to NYSA CRM.
3. Add automated checks before changing the database schema.
4. Design and migrate teams, contacts, lead sources, leads, assignments, stage
   history, activities, tasks, requirements, qualification assessments, and the
   common integration event/mapping/failure records.
5. Implement role permissions and dashboards.
6. Implement secured NYSA website lead intake into the company queue.
7. Add calculator, property media, and Customer Proposal Builder.
8. Prepare vendor access and field-mapping checklists for Meta, Property Finder,
   and Bayut without placing credentials in Git.

## Handoff Prompt for a New Task

Use:

> Read `docs/README.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, and the
> latest Git history. Reconcile them with the current code before making changes,
> then continue the named NYSA CRM workstream.
