# Release 2 CRM Test Deployment — 2026-07-22

## Boundary and package

- Target: `https://crm-test.nysarealty.com/` only
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Node.js: `24.17.0`
- Application mode: Development
- Startup file: `app.cjs`
- Database: `nysareal_nysa_r2_rehearsal`
- Package: `nysa-core-r2-0-r2-1-crm-test-488e811.zip`
- Package source commit: `488e811`
- Package SHA-256: `05f3aee1194ae55d174a486528f72b1a6174d6c811a160332128fd05fe260386`

Production, the original `nysareal_nysacrm_r1test` database and frozen Release 1.1 candidate
commit `1001906` were not modified or deployed.

## Rollback evidence

- Existing CRM Test version before copy: `1.1.0`
- Application backup: `nysa-core-crm-test-pre-r2-20260722.tar.gz`
- Backup SHA-256: `6350a146c5e6acc43c8de8ea10119112eb946bcbb498d89bc937fb8305682e52`
- Backup size: 27 MiB
- Existing private storage and cPanel `node_modules` link were preserved.

## Deployment verification

- Staged JavaScript syntax passed under Node.js `24.17.0`.
- The staged PostgreSQL dependency loaded successfully.
- Copied application files matched the verified staging directory byte-for-byte.
- Pre- and post-deployment health returned HTTP 200 with `{"ok":true,"database":"ready"}`.
- Post-start latest migration remained `038_release2_opportunity_foundation.sql`.
- Control counts remained brokers 11, contacts 32, leads 25, listings 12 and audit log 377.
- Reconciliation remained `5,5,0,0,0`.
- The Release 1.1 Managing Director dashboard and 25-lead pipeline rendered from the restored
  database.
- The additive Opportunity workspace rendered with zero Opportunities.
- The legacy review ledger rendered five pending records and reported automatic conversion as
  disabled.
- Browser console errors: none observed.
- No functional-test record was created or changed during this read-only verification.

## Remaining acceptance

Run controlled authenticated tests for role denials, explicit Opportunity creation from a
qualified assigned lead, immutable attribution, duplicate protection, optimistic concurrency,
Requirements/Matching/Closed Lost transitions and unchanged Release 1.1 counts. Production
deployment remains unauthorized.
