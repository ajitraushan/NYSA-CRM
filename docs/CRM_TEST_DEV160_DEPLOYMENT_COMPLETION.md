# CRM Test dev.160 deployment completion

Deployment date: 25 August 2026  
Deployment target: CRM Test only  
Version: `2.1.0-dev.160`

## Result

The cumulative UAT-070 through UAT-079 correction candidate was deployed successfully to CRM Test.

- Package: `nysa-core-consolidated-crm-test-dev160.zip`
- Verified SHA-256: `9aa22ad1a354eb22d99d1b1020f331bf65adb7ad191b6af50c22c18be5589679`
- Latest migration: `104_dev160_uat070_079_journey_unblock.sql` (104 total)
- CRM Test worker: PID `2165245`; exactly one verified LiteSpeed listener process
- Health: `ok=true`, `process=ready`, version `2.1.0-dev.160`
- Readiness: `ok=true`, `database=ready`, version `2.1.0-dev.160`
- Backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev160-20260825T094556Z`
- Integration switches: disabled
- Production and R2 clone snapshots: unchanged
- Property Finder: disabled and excluded

## Pre-deployment evidence

- Ordinary regression: 1,167 passed, 0 failed; 26 protected tests excluded (1,193 total).
- Protected PostgreSQL: 27/27 passed in isolated fresh disposable schemas.
- dev.160 correction/package gate: 5/5 passed.
- Candidate reproduced deterministically twice with identical SHA-256.
- Embedded archive manifest and installed runtime manifest were verified.

## UAT status

Deployment is complete, but no item is marked passed merely because it was implemented, automatically tested, or deployed. UAT-070 through UAT-078 remain pending human retest. UAT-079 failed human retest: its `Retire version` button is inert because an inline click handler is blocked by the deployed Content Security Policy. The backend endpoint remains automatically verified, but browser wiring requires correction and redeployment.
