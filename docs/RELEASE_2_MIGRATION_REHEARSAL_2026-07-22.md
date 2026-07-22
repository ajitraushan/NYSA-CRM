# Release 2 Migration Rehearsal — 2026-07-22

## Boundary

- Source database: `nysareal_nysacrm_r1test` (read-only dump operation)
- Isolated target: `nysareal_nysa_r2_rehearsal`
- Production database `nysareal_nysacrm` was excluded.
- Frozen Release 1.1 candidate commit `1001906` and its archive were not modified or deployed.

## Verified inputs

- Backup: `nysacrm-r1test-pre-r2-20260722.dump`
- Backup SHA-256: `cb4dc2790f94e2e696ed1b1aa9794d8ea5ba4fa2607b9707cf62d2ed91556e0e`
- `pg_restore --list` exit: `0`
- Migration: `038_release2_opportunity_foundation.sql`
- Migration SHA-256: `cc87af85f2a63cb38b536a1b56ec74fd61f0184d7df905364bbbe9b6895198a3`
- Pre-migration latest version: `037_listing_mapping_governance.sql`

## Result

- Restore exit: `0`
- Atomic migration exit: `0`
- Post-migration latest version: `038_release2_opportunity_foundation.sql`

| Control | Before | After |
|---|---:|---:|
| Brokers | 11 | 11 |
| Contacts | 32 | 32 |
| Leads | 25 | 25 |
| Listings | 12 | 12 |
| Audit log | 377 | 377 |

`r2_opportunity_reconciliation` returned:

- Legacy review population: 5
- Review ledger population: 5
- Opportunity population: 0
- Active Opportunity population: 0
- Attribution population: 0

The migration preserved all measured Release 1.1 records and stages, created the required review
ledger entries and did not infer or create an Opportunity or Deal.

## Remaining gate

Exact-commit CRM Test package `nysa-core-r2-0-r2-1-crm-test-488e811.zip` was prepared from commit
`488e811` with SHA-256
`05f3aee1194ae55d174a486528f72b1a6174d6c811a160332128fd05fe260386`. It has not been uploaded or
deployed. After controlled CRM Test installation, run authenticated permission, creation,
duplicate, concurrency, transition, reconciliation and browser tests only at
`https://crm-test.nysarealty.com/`. Production deployment remains unauthorized.
