# NYSA CORE Release 1 Dashboard Production Candidate

## Release identity

- Planned production URL: `https://crm.nysarealty.com`
- Production application root: `/home/nysareal/nysa-crm`
- Production database: `nysareal_nysacrm`
- Currently deployed commit: `1179cca8345fe76ebe0167aaede1feed4f56450d`
- Dashboard implementation through: `0f836f2`
- Requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- New migration: `010_role_dashboard_rebuild.sql`
- Dependency changes: none
- Environment-variable changes: none

The final archive filename, release commit, and SHA-256 are recorded alongside the
generated artifact. Production remains on `1179cca` until every cutover and smoke
test step below succeeds.

## Included scope

- Distinct Managing Director, Manager, and Agent dashboards
- Executive, Sales, Inventory, and Operations & Risk contracts
- Phase 1 leading indicators without manufactured financial forecasts
- KPI targets, benchmarks, trends, thresholds, refresh time, and exceptions
- Ranked management interventions and complete hierarchy drill-down
- Maintained-user names in dashboard titles
- Role-scoped Agent and Manager controls
- Period presets and source-dependent Campaign dropdowns
- Explicit listing creator attribution and full-detail affordance
- Additive dashboard target, inventory readiness, and metric-snapshot schema

## Staging evidence

- Staging URL returned HTTP 200 and database ready.
- The staging Node process resolved to `nysareal_nysacrm_r1test`.
- Migrations `001` through `010` were recorded; a second migration run passed.
- Guarded fixtures were refused outside a database ending `_r1test`.
- Managing Director, Manager, and Agent role presentations were visually tested.
- Period, hierarchy, drill-down, source/campaign, and inventory-card checks passed.
- Automated suite: 48 passed, 0 failed.
- Production dependencies are unchanged from the previously audited lockfile.

## Hard stop conditions

Do not deploy if any of these conditions is true:

- The fresh production backup is missing, empty, or fails `pg_restore --list`.
- The uploaded archive hash does not match the release manifest.
- The cPanel application is not configured for `nysareal_nysacrm`.
- The archive contains `.env`, `node_modules`, test fixtures, dumps, logs, or private storage.
- Existing production record counts have not been captured.
- The operator cannot restore the prior application files.

## Production preflight

Enter the production application directory and record the current database identity
without printing its password:

```bash
cd ~/nysa-crm
psql -Atc "SELECT current_database(),current_user;"
psql -Atc "SELECT version FROM schema_migrations ORDER BY version;"
```

The database must be `nysareal_nysacrm`. Record pre-deployment counts:

```bash
psql -Atc "SELECT 'audit_log',COUNT(*) FROM audit_log UNION ALL SELECT 'brokers',COUNT(*) FROM brokers UNION ALL SELECT 'comments',COUNT(*) FROM comments UNION ALL SELECT 'contacts',COUNT(*) FROM contacts UNION ALL SELECT 'leads',COUNT(*) FROM leads UNION ALL SELECT 'listings',COUNT(*) FROM listings UNION ALL SELECT 'sessions',COUNT(*) FROM sessions ORDER BY 1;"
```

## Mandatory backups

Create a new database backup and a code backup immediately before the maintenance
window. The commands do not embed a password:

```bash
mkdir -p ~/crm-backups
chmod 700 ~/crm-backups
pg_dump -Fc -h localhost -U nysareal_nysacrmapp -d nysareal_nysacrm -f ~/crm-backups/nysacrm-pre-dashboard-20260715.dump
pg_restore --list ~/crm-backups/nysacrm-pre-dashboard-20260715.dump | head -n 25
tar --exclude='nysa-crm/node_modules' --exclude='nysa-crm/storage' -czf ~/crm-backups/nysa-crm-app-pre-dashboard-20260715.tar.gz -C ~ nysa-crm
sha256sum ~/crm-backups/nysacrm-pre-dashboard-20260715.dump ~/crm-backups/nysa-crm-app-pre-dashboard-20260715.tar.gz
```

Both files must be non-empty. Download the database backup off-server before cutover.

## Archive verification and staging

Upload the approved production archive to the cPanel home directory, then use the
actual release filename in these commands:

```bash
cd ~
sha256sum ~/NYSA_RELEASE_ARCHIVE.zip
unzip -l ~/NYSA_RELEASE_ARCHIVE.zip
mkdir -p ~/nysa-core-dashboard-production-stage
unzip -o ~/NYSA_RELEASE_ARCHIVE.zip -d ~/nysa-core-dashboard-production-stage
ls -la ~/nysa-core-dashboard-production-stage
ls -1 ~/nysa-core-dashboard-production-stage/src/migrations
```

Confirm migration `010` is present and the archive contains no `node_modules`,
`.env`, dump, log, or private-storage content.

## Controlled cutover

Use cPanel to stop the production Node application for a short maintenance window.
Then replace the versioned application content:

```bash
/bin/cp -a ~/nysa-core-dashboard-production-stage/public/. ~/nysa-crm/public/
/bin/cp -a ~/nysa-core-dashboard-production-stage/src/. ~/nysa-crm/src/
/bin/cp -a ~/nysa-core-dashboard-production-stage/test/. ~/nysa-crm/test/
/bin/cp -a ~/nysa-core-dashboard-production-stage/docs/. ~/nysa-crm/docs/
/bin/cp -a ~/nysa-core-dashboard-production-stage/package.json ~/nysa-crm/package.json
/bin/cp -a ~/nysa-core-dashboard-production-stage/package-lock.json ~/nysa-crm/package-lock.json
/bin/cp -a ~/nysa-core-dashboard-production-stage/README.md ~/nysa-crm/README.md
/bin/cp -a ~/nysa-core-dashboard-production-stage/DEPLOYMENT.md ~/nysa-crm/DEPLOYMENT.md
```

Dependencies did not change. Do not remove or replace the CloudLinux `node_modules`
symlink. Restart the application once in cPanel; startup applies migration `010`
transactionally.

## Immediate verification

```bash
curl -i https://crm.nysarealty.com/api/health
psql -Atc "SELECT version FROM schema_migrations ORDER BY version;"
psql -Atc "SELECT 'audit_log',COUNT(*) FROM audit_log UNION ALL SELECT 'brokers',COUNT(*) FROM brokers UNION ALL SELECT 'comments',COUNT(*) FROM comments UNION ALL SELECT 'contacts',COUNT(*) FROM contacts UNION ALL SELECT 'leads',COUNT(*) FROM leads UNION ALL SELECT 'listings',COUNT(*) FROM listings UNION ALL SELECT 'sessions',COUNT(*) FROM sessions ORDER BY 1;"
```

Health must be HTTP 200 with `{"ok":true,"database":"ready"}`. Migration `010`
must appear exactly once. Existing business record counts must not decrease.

## Production smoke tests

Use controlled real production accounts; never seed dashboard fixtures in production.

1. Administrator login and Administration page
2. Managing Director dashboard and all four executive tabs
3. Manager team scope and Agent drill-down
4. Agent own-record scope with no hierarchy selectors
5. Period preset and source-dependent Campaign filtering
6. KPI contributing records and complete breadcrumbs
7. Leads and Inventory pages
8. Inventory detail, creator attribution, and comments
9. Existing user session revocation and role denial checks
10. Final health request and error-log inspection

## Rollback decision

Migration `010` is additive: it adds dashboard target metadata, listing readiness
fields, indexes, and a metric snapshot table. The prior application can run with
those unused additions, so the preferred rollback is code-only.

If a smoke test fails:

1. Stop the application and preserve the latest error log.
2. Restore the prior application archive or the code backup.
3. Do not reverse or edit migration `010`.
4. Restart once and verify health, login, Leads, and Inventory.
5. Restore the database only after an explicit recovery decision and an isolated
   restore verification; routine code rollback does not require database restoration.

Code-backup restore command, used only after confirming the archive path:

```bash
cd ~
tar -xzf ~/crm-backups/nysa-crm-app-pre-dashboard-20260715.tar.gz
```

## Completion record

After success, record the release archive SHA, backup SHA, migration result, record
counts, health result, smoke-test outcome, operator, and time in
`docs/DEPLOYMENT_HISTORY.md`. Only then mark the production deployed commit in
`docs/CURRENT_STATUS.md`.
