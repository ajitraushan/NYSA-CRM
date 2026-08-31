# CRM Test dev.159 deployment completion

## Outcome

- Deployment target: CRM Test only
- Result: technically deployed and ready
- Installed version: `2.1.0-dev.159`
- Package: `nysa-core-consolidated-crm-test-dev159.zip`
- Verified SHA-256: `9f32c2f4184b7f6d5c6e114f5239d5ec7a83fc6a5e7e507577e27981f062c532`
- Migration state: 103 migrations
- Latest migration: `103_dev159_uat062_single_source_classification.sql`
- Human UAT: pending; this deployment result does not imply that any UAT item passed

## Backup and rollback evidence

- Pre-deployment backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev159-20260824T205020Z`
- The guarded script verified that both the database dump and application archive were non-empty before installation.

## Runtime verification

- Public health: HTTP 200, process ready, version `2.1.0-dev.159`
- Public readiness: HTTP 200, database ready, version `2.1.0-dev.159`
- Database contract checks passed after migration 103.
- Installed runtime matched `RUNTIME_MANIFEST.sha256`.
- Integration switches remained disabled, including Property Finder, Microsoft 365 email, and Calendly.

## Worker-topology evidence

The first guarded attempt stopped before any mutation because two CRM Test processes were present. Read-only inspection confirmed that both processes used the exact CRM Test application root and owned distinct LiteSpeed sockets for the CRM Test virtual host, including the HTTPS listener. On this host, a LiteSpeed listener process may have PPID 1; PPID alone is therefore not valid orphan evidence.

The deployment guard was corrected to accept only one or two processes that satisfy both conditions:

1. the exact command label is `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`; and
2. the process owns a socket under `/usr/local/lsws/extapp-sock/APVH_crm-test.nysarealty.com`.

All validated pre-deployment listeners were restarted. The completed deployment reported one verified CRM Test LiteSpeed listener process. No Production or R2 process was selected.

## Protected-environment evidence

- Production application snapshot: unchanged
- R2 clone application snapshot: unchanged
- Production health endpoint baseline: remained HTTP 404
- R2 clone health endpoint baseline: remained HTTP 404
- Production and R2 were not deployment targets.

## Pre-deployment test evidence carried by the release

- Ordinary regression: 1,163 passed, 0 failed; 22 protected tests skipped in the ordinary run
- Protected PostgreSQL evidence: 22 of 22 passed against the disposable real-database fixture
- Package integrity and deterministic reproduction: passed

The protected database tests were not executed against the live CRM Test database because they create and mutate disposable fixtures. Human end-to-end UAT remains required against CRM Test.
