# NYSA CORE CRM Test dev.174 — Deployment Completion

Date: 30 August 2026  
Target: CRM Test only  
Deployed version: `2.1.0-dev.174`

## Package identity

- Package: `nysa-core-consolidated-crm-test-dev174.zip`
- SHA-256: `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`
- Archive entries: 302
- Migration inventory: 110; latest `110_dev174_financial_illustration.sql`
- Automated observation: 1,291 total; 1,261 passed; 30 protected skips; 0 failed.

## Exact deployment observations

The first guarded attempt verified the package, created the pre-deployment database and application backup, installed
the files and requested a CRM Test worker restart. The new worker did not start. The installer stopped with:

`FAIL: expected one or two new CRM Test LiteSpeed listeners; count=0`

The startup log then reported:

`Application startup failed: error: column "created_at" does not exist`

RCA: migration 110 selected the fallback Administrator from `brokers` using `created_at`, while the deployed Broker
schema uses `updated_at`. PostgreSQL rolled migration 110 back transactionally. Migrations 108 and 109 remained
registered, producing the exact interrupted migration-109 recovery state. The migration was corrected to use
`updated_at`; a regression assertion was added; the package was rebuilt and the complete 1,291-test suite passed
again with 0 failures.

The corrected migration file was restored from the corrected checksum-bound archive, the CRM Test restart marker was
touched, and an HTTP health request started the worker. A guarded rerun then reported:

`Deployment already confirmed; exact runtime manifest verified`

Observed endpoints:

- Health: `{"ok":true,"process":"ready","version":"2.1.0-dev.174"}`
- Readiness: `{"ok":true,"database":"ready","version":"2.1.0-dev.174"}`

The guarded rerun accepted only the exact migration-110 state, verified all 110 registered migrations, checked the
database contract, runtime manifest, disabled integration switches and protected-environment snapshots. The final
exact-process query returned one CRM Test LiteSpeed worker only:

`198393 lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`

The backup created before the first install is retained at:

`/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`

Production and the Production/R2 clone were not targeted and their snapshots were observed unchanged. Property
Finder remained disabled and excluded. Human UAT has not been performed after deployment, so no UAT pass is inferred.
