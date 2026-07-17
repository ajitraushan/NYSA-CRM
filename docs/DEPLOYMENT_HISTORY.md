# NYSA CORE Deployment History

This file records the exact Git source revisions deployed to production. Runtime
secrets, database dumps, customer data, logs, and generated files are never stored
in Git.

## 2026-07-18 — CRM Test AI audit and typography corrections

- Environment: CRM Test only; production unchanged
- URL: `https://crm-test.nysarealty.com`
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- AI audit correction commit: `874ed95`
- Migration `019_ai_assistance_audit_constraint.sql` applied at
  `2026-07-17 18:10:38.433739+00`; health returned database ready and AI requirement
  notes generated successfully afterward.
- Typography correction commit: `378b3a8`
- Typography package: `nysa-core-r1-uat-typography-crm-test-378b3a8.zip`
- The user explicitly confirmed on 2026-07-18 that the increased font size is working.
- R1-UAT-025 is closed. Other AI, lead-tool and Release 1 findings remain open until
  their complete CRM Test retests and explicit confirmations pass.

## 2026-07-16 — Release 1 administration corrections on CRM Test

- Environment: CRM Test only
- URL: `https://crm-test.nysarealty.com`
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysacrm_r1test`
- Startup file: `src/server.js`
- Initial consolidated source commit/package: `b89b21e`
- Migration compatibility correction: `ab0ee8e`
- Administration smoke corrections: `2d0dfd7` and `c28fa16`
- Organization-profile retry/cleanup correction: `3b49652`
- Effective deployed source: `3b49652`
- Current consolidated package: `nysa-core-r1-uat-crm-test-3b49652.zip`
- Corrected package SHA-256:
  `948de5498e58194a063206cf4077b7b4247559a47720844ca6d863f11623dbf7`
- Packages `b89b21e`, `ab0ee8e`, `2d0dfd7`, `c28fa16` and the un-deployed
  `7705e0b` correction are superseded and must not be used for a fresh deployment.

### Backup and migration evidence

- CRM Test database backup:
  `~/crm-backups/nysacrm-r1test-before-b89b21e.dump`
- Backup size: 196 KiB; custom archive listed successfully with 394 TOC entries.
- CRM Test application backup:
  `~/crm-backups/nysa-core-dashboard-dd6262a-stage-before-b89b21e.tar.gz`
- Application backup size: 187 KiB; archive listing verified.
- Migration `011_organization_profile_governance.sql` applied at
  `2026-07-15 21:29:09.777489+00`.
- Migration `012_release1_admin_uat_corrections.sql` applied at
  `2026-07-15 21:37:21.491864+00` after the sequence-compatibility correction.

### Deployment verification and acceptance state

- CRM Test returned HTTP 200 with `{"ok":true,"database":"ready"}` at
  `2026-07-15 21:38:49+00`.
- Security headers remained present.
- The new Lead Qualification Versions frontend was confirmed from the deployed URL.
- Consolidated source `3b49652` was hash-verified, extracted and syntax-checked with
  the CloudLinux Node 24 runtime before restart. CRM Test returned HTTP 200 with the
  expected security headers at `2026-07-16 09:45:38+00`.
- Authenticated browser verification confirmed the Revision 3 explanation and
  `Compare changes` UI. Company-profile v5 is Approved with private logo evidence;
  comparison with v4 correctly identifies the approved-logo hash as the change.
  Versions v1 through v4 are Retired and retained as protected history.
- R1-UAT-001 through R1-UAT-013 and R1-AMD-001 through R1-AMD-012 are
  `Deployed to CRM Test`; none is closed. Authenticated workflow retesting and
  explicit user confirmation remain required.

## 2026-07-15 — Role dashboard production release

- Production URL: `https://crm.nysarealty.com`
- Application root: `/home/nysareal/nysa-crm`
- Production database: `nysareal_nysacrm`
- Requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- Dashboard production package commit: `b7341df639f6afa28045535651a2502930ab468c`
- CloudLinux startup compatibility commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- Effective deployed source commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- cPanel startup file: `app.cjs`
- Deployment operator account: `nysareal`

### Release and rollback artifacts

- Production package:
  `~/nysa-core-release1-dashboard-production-b7341df.zip`
- Production package SHA-256:
  `2ab4ca5a022b1de0b3788ca97e5586ab12a6698e991e772ebed3df2fc78fe0e6`
- CloudLinux startup hotfix:
  `~/nysa-core-cloudlinux-startup-b3637d4.zip`
- CloudLinux startup hotfix SHA-256:
  `59335abed57f7c4f9cff81cfb480bc9213c9459babdce165b98cca1f562a2963`
- Prior-production rollback package:
  `~/nysa-core-production-rollback-1179cca.zip`
- Rollback package SHA-256:
  `4cdecc00981fee7d5fc91d133709edfaed14bd56d11d65cf7693249e0d5270a6`

### Backup evidence

- Database backup:
  `~/crm-backups/nysacrm-pre-dashboard-b7341df-20260715.dump`
- Database backup SHA-256:
  `baa38ddee84f67b392b84222016ec217888f06cbbd471bb5697b52e848d3e591`
- Application backup:
  `~/crm-backups/nysa-crm-app-pre-dashboard-b7341df-20260715.tar.gz`
- Application backup SHA-256:
  `8fd0d58ca4086a4b6f82367c91b37f2965c43907dd84932bc068b88d5533701b`
- Both backup files were downloaded off-server. The PostgreSQL custom-format
  backup listed successfully with 387 TOC entries.

### Deployment verification

- Production returned HTTP 200 with `{"ok":true,"database":"ready"}` at
  2026-07-15 08:08 UTC.
- Migration `010_role_dashboard_rebuild.sql` was recorded exactly once and
  `dashboard_metric_snapshots` exists.
- Pre- and post-deployment record counts matched: `audit_log=14`, `brokers=2`,
  `comments=1`, `contacts=0`, `leads=0`, `listings=1`, and `sessions=3`.
- The CloudLinux-managed `node_modules` symlink remained intact.
- Production UI smoke testing passed for Administration, Leads, Inventory,
  personalized role dashboards, all four Managing Director views, period presets,
  and Source/Campaign filtering.
- No dashboard test fixtures were copied or seeded into production.

### Acceptance remaining

The role dashboard deployment is complete. Formal Release 1 acceptance still
requires the open environment and workflow checks in
`RELEASE_1_ACCEPTANCE_STATUS.md`.

## 2026-07-14 — Release 1 and CORE branding

- Production URL: `https://crm.nysarealty.com`
- Application root: `/home/nysareal/nysa-crm`
- Requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- Release 1 completion: `ac48122`
- Dashboard loading hotfix: `5299a39`
- NYSA logo hotfix: `17abe8d`
- Final deployed source commit: `1179cca8345fe76ebe0167aaede1feed4f56450d`
- User-facing system name: NYSA CORE

### Backup evidence

- Server file: `~/crm-backups/nysacrm-pre-release1-20260714.dump`
- SHA-256: `176c74b46c839628b1cf1267a089839fc071ad93e7560963c32b5502ebba400c`
- Production files before the CORE hotfix:
  `~/crm-backups/core-before-1179cca-20260714/`

### Deployment verification

- Production health returned `{"ok":true,"database":"ready"}`.
- Migrations `001` through `009` were present in production
  `schema_migrations` after startup.
- A second migration run completed without reapplying existing migrations.
- Existing production broker, listing, comment, session, and audit counts were
  reconciled before and after migration.
- The authenticated Dashboard, Leads, Inventory, and Administration pages loaded.
- The live header exposed `aria-label="NYSA Core"` and rendered CORE at `34px` on
  desktop; the committed mobile rule is `22px`.
- Staged and live SHA-256 values matched for `public/app.js` and
  `public/index.html` after the final hotfix copy.

### Acceptance remaining

Deployment is complete, but formal Release 1 acceptance still requires the open
environment and workflow checks listed in `RELEASE_1_ACCEPTANCE_STATUS.md`.
