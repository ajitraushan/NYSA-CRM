# CRM Test dev.186 deployment completion

- Deployment date: 2026-09-05 (Asia/Dubai)
- Target: CRM Test only (`crm-test.nysarealty.com`)
- Installed and served version: `2.1.0-dev.186`
- Latest migration: `118_dev186_187_receivable_workflow.sql` (118 total)
- Release archive: `nysa-core-consolidated-crm-test-dev186-r2.zip`
- Release SHA-256: `c755654a60d7c1574d06a76b3e109dfccb9195b03630bcfe3d472092ef1655d4`
- Rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev186-20260905T091621Z`

## Delivered scope

- CRM-186: dark, scalable Receivables table and right-side work drawer covering Closed Won handoff, payment scheduling, automatic invoice generation, and payment recording.
- Invoice numbers are system-generated in `NYSA-INV-YYYY-######` format and the invoice issue date is system-recorded.
- Payment realization date is entered by Finance; future dates and dates before the invoice issue date are rejected with a clear red validation message. The invoice due date does not block a valid early collection.
- CRM-187: an Accountant can request cancellation or amendment of an issued unpaid invoice; a Director/MD can approve or reject it. Approved amendments supersede the old invoice and create a replacement planned instalment. Approved cancellation formally records that the amount is no longer due.
- Direct cancellation remains available only for planned, unissued instalments.

## Verification

- Source test suite: 1,385 tests; 1,315 passed, 70 skipped, 0 failed.
- New focused CRM-186/187 tests: 7 passed, 0 failed.
- JavaScript syntax checks: passed.
- Deployment installer: package checksum, runtime manifest, target baseline, database target, schema contract, health, readiness, worker and integration-disable checks passed.
- Public health: `{"ok":true,"process":"ready","version":"2.1.0-dev.186"}`.
- Public readiness: `{"ok":true,"database":"ready","version":"2.1.0-dev.186"}`.

## Safety and exclusions

- A recoverable application and database backup was created before mutation at the rollback path above.
- Production and the R2 clone snapshots were verified unchanged by the installer.
- No integration was enabled and no customer/test data was introduced.
- CRM-188 (role-based left navigation), Performance Management and Campaign Management were not included.
