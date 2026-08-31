# CRM Test dev.147 — Deployment Completion

**Date:** 16 August 2026 (Asia/Dubai)  
**Version:** `2.1.0-dev.147`  
**Target:** CRM Test only  
**State:** deployed and technically verified; owner retest pending

## Deployment evidence

- The checksum-bound ZIP, SHA-256 file, JSON manifest and guarded deployment script were uploaded to `/home/nysareal/`.
- Package checksum, JSON manifest, internal manifest and installed runtime manifest passed.
- The deployer completed with `DEPLOY_EXIT=0`.
- `/api/health` reported process ready with version `2.1.0-dev.147`.
- `/api/readiness` reported database ready with version `2.1.0-dev.147`.
- Migration inventory remains 95, current through `095_dev146_full_scope_uat_governance.sql`; this hotfix required no schema change.
- CRM Test was normalized to exactly one fresh worker, PID `3592487` at deployment completion.
- Property Finder, Microsoft 365 Email and Calendly integration switches remained disabled.
- Production and Production/R2 clone package snapshots were unchanged.
- Verified rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev147-20260815T200844Z`.

## Retest scope

1. In Capture new lead, search `Aug` and confirm `August1526` appears.
2. Search by full name, email, phone and `*`; confirm the full permitted result set is accessible without a ten-record cap.
3. Select the exact Customer and create a Lead; confirm the existing Customer UUID is retained and no duplicate Customer is created.
4. From Customer Master, select an active duplicate-approved/not-required Customer beyond the first ten and use Create Lead; confirm the former false eligibility error does not appear.

No Production, Production/R2 clone or Property Finder deployment was performed.

## Post-deployment worker audit

At `2026-08-15 20:11:49 UTC` (`2026-08-16 00:11:49 Asia/Dubai`), the account-level Node and
Passenger worker audit found exactly one Node process: PID `3592487`, labelled only for
`/home/nysareal/nysa-core-dashboard-dd6262a-stage/`. No duplicate, idle, orphaned, Production,
Production/R2 clone or preview Node worker existed, so no process removal was necessary. Health
and readiness remained ready on `2.1.0-dev.147` after the audit.
