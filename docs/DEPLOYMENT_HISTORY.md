# NYSA CORE Deployment History

This file records the exact Git source revisions deployed to production. Runtime
secrets, database dumps, customer data, logs, and generated files are never stored
in Git.

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
