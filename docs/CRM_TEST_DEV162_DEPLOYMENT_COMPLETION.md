# CRM Test dev.162 Deployment Completion

## Deployment identity

- Target: CRM Test only.
- Installed and served version: `2.1.0-dev.162`.
- Package: `nysa-core-consolidated-crm-test-dev162.zip`.
- Verified SHA-256: `79fede37ec8d7be926d94e51fe9e804035cdf5c0dd4dd8b3a1f5b1008a52efe9`.
- Package was reproduced twice with the identical SHA-256.
- Latest migration: `104_dev160_uat070_079_journey_unblock.sql`.
- Migration count: 104; dev.162 introduced no migration.

## Deployment verification

- Deployment script completed successfully.
- CRM Test worker PID: `3010377`.
- Exactly one verified LiteSpeed CRM Test listener remained.
- Health: `ok=true`, `process=ready`, version `2.1.0-dev.162`.
- Readiness: `ok=true`, `database=ready`, version `2.1.0-dev.162`.
- Runtime files matched the embedded runtime manifest.
- Dev.160 database contract remained satisfied.
- Integration switches remained disabled.
- Property Finder remained disabled and excluded.
- Production and Production/R2 clone package snapshots were unchanged.
- Backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260825T101852Z`.

## Automated evidence

- Full ordinary regression: 1,199 total; 1,172 passed; 0 failed; 27 protected tests skipped by the ordinary runner.
- UAT-080 questionnaire UI/runtime tests: 2/2 passed.
- Dev.162 package integrity test: 1/1 passed.
- Dev.161 UAT-079 CSP-safe retirement wiring regression: 1/1 passed.
- Targeted package and browser-wiring set: 4/4 passed.

## Human UAT boundary

UAT-080 remains pending human retest. Automated evidence and successful deployment do not establish a UAT pass. The user must observe the complete configured questionnaire in CRM Test and confirm the expected answer choices and successful test calculation.
