# CRM Test dev.175 deployment

Authorized by the owner on 2 September 2026: “ok pl deploy”.

Target only: https://crm-test.nysarealty.com/, application root
`/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`.
Baseline dev.174, migration 110, historical package SHA-256
`30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`.
The historical one-worker observation and 1,291/1,261/30/0 test result remain unchanged historical evidence.

Candidate: 2.1.0-dev.175, migration 111 (`111_dev175_stage_draft_audit.sql`).
Correction scope and existing local tests: `CRM_TEST_DEV175_UAT_REMEDIATION.md`.
Production, R2 clone, Property Finder, Microsoft 365 and Calendly are excluded/disabled.
No new production personal data or business-record repair is authorized by this deployment.

1. Package current tested source with embedded runtime/file checksums and a sidecar SHA/JSON manifest.
2. Re-run the ordinary suite, targeted database regressions and package checks.
3. Require exact test directory, database, dev.174/migration-110 baseline and verified worker socket.
4. Before installing, create a fresh mode-700 directory containing PostgreSQL custom backup and application
   archive (including existing .env). Preserve private evidence storage in place and unchanged.
5. Verify backup readability, package paths/checksums, migration sequence and all applied migration hashes.
6. Install source without replacing .env/private evidence. Restart only the verified CRM Test worker.
7. Verify health/readiness version 175, exactly one worker, 111 migrations, audit entity constraint,
   exact runtime manifest and disabled integrations. Confirm protected root package hashes unchanged.
8. Record actual results and rollback path in completion/UAT/defect documents; no human pass inferred.

Rollback: retain the fresh paired database and file backup. Prefer reverting source while retaining additive
migration 111 audit compatibility; after new draft audit rows exist, do not delete evidence to downgrade.
A paired database restoration must account for any intervening user writes and requires stopping for approval
if it would discard them. Never restore a Test backup into Production or the R2 clone.

Pre-change local source/evidence archive is recorded in the remediation document. New release packaging
does not overwrite dev.174. The source version is now 175; it is not a deployed-version claim.
