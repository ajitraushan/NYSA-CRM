# CRM TEST DEV219 release record

## Frozen baseline

- Target: CRM TEST only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`)
- Source branch: `codex/crm-dev218-approved-documents-theme`
- Pre-change source commit: `30a6e618415626811f2c8544a3640b6f5bf99d36`
- Installed/served baseline: `2.1.0-dev.218`
- Database baseline: migration `132_approved_documents_and_brand.sql` (132 total)
- Prior rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev218-20261005T050909Z`
- Protected environments: production and R2 clone are outside scope and must remain unchanged.

## DEV219 scope

1. Restore a direct **My Tasks** navigation entry for operational users, including Managers.
2. Require and persist KYC expiry for pending/verified identity review; display business dates without timestamps outside TAT/audit contexts.
3. Base AI requirement assistance on the current unsuperseded Requirement and latest qualification assessment, with explicit evidence precedence over initial Lead intake notes.
4. Repair Linux Offer PDF generation by aligning packaged Chromium with Puppeteer and using the packaged headless-shell launch mode; return an actionable service error if rendering fails.
5. Preserve explicit signature and company-stamp spaces in the Offer Letter.
6. Select the correct Offer direction in the generated document even when its template option contains a Sale/Rent caption.

No database migration or external integration change is included. No production data is used by the automated test suite.

## Acceptance and rollback

- Full automated suite must report zero failures from the exact GitHub-advertised release commit.
- Production dependency audit must report zero known vulnerabilities.
- The package and manifest must pass `release:verify-package` before upload.
- The installer must take and verify a fresh database dump and application archive before mutation.
- Rollback uses the DEV219 pre-deployment backup and restores the DEV218 application/database state.
- Health, readiness, exact installed version, runtime manifest, migration state, and protected-environment snapshots must pass after restart.
