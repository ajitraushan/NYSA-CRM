# CRM Development Baseline

Version: `NYSA-CRM-GOV-1.1`
Effective date: 2026-09-20
Status: DEV208 cumulative source recovery established in Git; CRM Test human UAT remains open.

## Approved source baseline

- Repository: `https://github.com/ajitraushan/NYSA-CRM.git`
- Recovery branch: `codex/crm-dev208-reconciled`
- Governed DEV208 source commit: `654be10ccac61be7c4bda638ce4be5eccebbb0f9`
- Recovery character: cumulative source recovery from the DEV174 repository state; this does not
  claim that DEV175 through DEV207 existed as separate Git commits before their deployments.

## CRM Test deployment baseline

- Environment: CRM Test only
- Installed and served version: `2.1.0-dev.208`
- Deployed package SHA-256: `989d6b628ee3a06b744012a5cb6a59eddd2db1a37e84642cbb63bb938cad8aa2`
- Package source baseline: `nysa-core-consolidated-crm-test-dev207-r2.zip`
- Package source baseline SHA-256: `2fd2bfc33d4c753020f71a6f1500ae719a957bfe881d8f8fbd5d4f08b45e27db`
- Latest migration: `127_governed_purchased_data_intake.sql` (127 total)
- Server rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`
- Verification: 1,523 tests; 1,445 passed; 78 skipped; 0 failed
- Production and R2 clone: unchanged

The DEV208 deployment predates the recovery commit. Its binding to the commit above is a documented
retrospective reconciliation based on the immutable package, checksums and runtime manifest, not a
claim that the package was originally built from that commit.

## Required future release controls

Before mutation, record the application version, file/database snapshot, target environment and
rollback point. Before any deployment request, all governed source, migrations, tests and release
metadata must be committed and pushed; the package manifest must identify that resolvable source
commit and immutable baseline package; and the exact candidate must pass the required tests.

Never use `current` or `latest` as the only baseline identifier. Production data, schema,
configuration and deployment continue to require explicit approval for that exact change.

Effective 2026-09-20, future packages must use the canonical origin-only release command documented
in `AGENTS.md` and `CRM_CHANGE_POLICY.md`. Historical packages remain evidence of prior deployments,
not templates for new builds. Repository branch protection should require the release-provenance CI
check; activating that required check is a separate GitHub repository-settings action.
