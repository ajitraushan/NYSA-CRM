# CRM Test DEV215 — Assignment Queue Convenience

Target: CRM Test only. Production is unchanged.

Baseline source: DEV214 commit `71c2d04ea04c041f9b49e8bfd2b1c5745d75aec6`.
Baseline deployment rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev214-20260928T165008Z`.

## Change

- Replaced repeated Manager/Director assignment cards with one compact table.
- Added Customer/Lead search plus business type, routed team, campaign and SLA filters.
- Added closest-to-SLA and oldest-waiting ordering.
- Added row selection and **Select all visible**.
- Uses the routing-rule team by default and lists only active Sales Agents who belong to every selected routed team.
- Shows each Sales Agent's current open Lead count.
- Assigns up to 100 selected Leads in one database transaction after one confirmation.
- Keeps an individual **Assign** action for exceptional rows.
- Team change is an explicit exception and requires a reason.
- Audit evidence records the acting Manager/Director, event timestamp, original team, selected team, selected agent, batch size and team-change reason.

## Business rules preserved

- Routing rules continue to select the default team from source, business type and area.
- Managers may assign only into teams they manage; Directors retain company scope.
- The selected agent must be an active Sales Agent in the effective team and eligible for the Lead's area.
- Assignment acceptance and first-contact SLA deadlines are recalculated for the new assignment cycle.
- Any invalid or stale row aborts the whole batch; no partial assignment is committed.

## Database and rollback

No migration is required. Rollback is application-package rollback to DEV214. Assignment events committed by users after deployment remain business records and are not deleted by an application rollback.

`scripts/deploy-crm-test-dev215.sh` is locked to CRM Test and accepts only the exact DEV214 baseline or an idempotent DEV215 rerun. It verifies the origin-package checksums, manifest and embedded provenance; requires migration 129 to remain unchanged; checks disabled integrations; creates verified application and database backups before mutation; validates the live health/readiness response and runtime checksums; and confirms that Production and the R2 clone were not changed.

## Deployment record — 28 September 2026

- Environment: CRM Test only.
- Installed and served version: `2.1.0-dev.215`.
- GitHub origin commit: `8c4eeb29eacc348ec0438cf686a228f0fe012277`.
- Git tree: `299966b421de25c1bb453c166e4d4ce93431d06e`.
- Package: `nysa-core-2.1.0-dev.215-origin.zip`.
- Server-built package SHA-256: `650886bc161551a7ed5c39892d6f406df49ade7b0a5553454fb392057b21d11f`.
- Server-built manifest SHA-256: `eb46f30b5794f9130b6a96d3d93a13590c643d83d8b43e9c007e91c6354e4fba`.
- Packaging command: `npm run release:package -- --commit 8c4eeb29eacc348ec0438cf686a228f0fe012277` from a fresh clone of GitHub origin.
- Mandatory package provenance verification: passed.
- Release tests: 1,319 total; 1,239 passed; 0 failed; 80 skipped.
- Database migration state: 129 total; latest `129_dev214_offplan_developer_stock.sql`; no DEV215 migration.
- Recoverable application/database backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev215-20260928T183127Z`.
- Live health: ready, version `2.1.0-dev.215`.
- Live readiness: database ready, version `2.1.0-dev.215`.
- Production and R2 clone snapshots: unchanged.
