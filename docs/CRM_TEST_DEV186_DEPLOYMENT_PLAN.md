# CRM Test dev.186 deployment plan

Date: 2026-09-05 (Asia/Dubai)

## Approved scope

- CRM-186: dark, scalable, table-and-drawer Commission Receivables workflow from Closed Won Opportunity through invoice and payment.
- CRM-186: invoice reference generated as `NYSA-INV-YYYY-######`; invoice date generated on issue; both immutable.
- CRM-186: Accountant enters payment realization date; blank by default; not before invoice date and never after the current Dubai date; due date is not a payment-validation boundary.
- CRM-187: direct cancellation only for an unissued instalment.
- CRM-187: Accountant requests cancellation or amendment of an issued unpaid invoice; MD/Director approves or rejects; amendment creates a replacement and preserves lineage.

## Explicit exclusions

- CRM-188 role-based left-side navigation.
- Performance Management and Campaign Management.
- Production and R2 clone.

## Baseline and target

- Source/deployed baseline: `2.1.0-dev.184`.
- Baseline package SHA-256: `fca26c2a7cf558cab30f465c201c9e590e89116a90a58e4625140d9205b33592`.
- Baseline migration: `117_transaction_completion_documents.sql` (117 migrations).
- Target: CRM Test `/home/nysareal/nysa-core-dashboard-dd6262a-stage`.
- Target database: `nysareal_nysa_r2_rehearsal`.
- Candidate: `2.1.0-dev.186`, migration `118_dev186_187_receivable_workflow.sql`.

## Safety and rollback

The target-locked installer verifies package identity, target root, database identity, disabled integrations and current baseline. Before mutation it creates and verifies a PostgreSQL custom-format dump and application archive under `/home/nysareal/crm-backups/`. Rollback is restoration of those paired artifacts. Production and R2 clone package snapshots are compared before and after deployment.

## Verification

- JavaScript syntax checks.
- Full source regression suite.
- Isolated candidate CRM-186/187 and dev.184 continuity tests.
- Post-deployment health, readiness, version, migration, schema-contract, runtime-manifest and single-worker checks.
