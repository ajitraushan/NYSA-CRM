# CRM Test dev.188 deployment completion

Date: 2026-09-05 (Asia/Dubai)

## Deployment result

- Target: CRM Test `/home/nysareal/nysa-core-dashboard-dd6262a-stage` only.
- Database: `nysareal_nysa_r2_rehearsal`.
- Installed and served version: `2.1.0-dev.188`.
- Package: `nysa-core-consolidated-crm-test-dev188-r3.zip`.
- Verified SHA-256: `c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4`.
- Latest migration: `118_dev186_187_receivable_workflow.sql`; migration count remained 118. This deployment was migration-neutral.
- Deployment completed successfully and the target-locked installer confirmed health, readiness, the runtime manifest and the served version.

## Backup and rollback point

- Recoverable pre-deployment backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev188-20260905T095123Z`.
- The backup contains the pre-dev.188 application archive, PostgreSQL dump, file listings and SHA-256 verification records.
- Rollback is to restore the application archive and database dump from that directory, then restart the CRM Test worker.

## Delivered scope

- Added responsive left-side role navigation on desktop, with horizontal navigation retained on small screens.
- Renamed and clarified the Commission Receivables Register and its receivable, Opportunity and instalment identity.
- Replaced generic `Open invoice` actions with the applicable next action: generate invoice, record payment, or view receipt/details.
- Replaced the right-side overlay with an in-page Receivable workspace and a clear return to the register.
- Made the payment due-date picker visible in the dark theme.
- Allowed an additional invoice row to be removed before confirmation.
- Made schedule confirmation issue each invoice immediately with a system-generated `NYSA-INV-YYYY-######` number and system invoice date.
- Added a NYSA-branded paper tax-invoice PDF for preview, printing and download.
- Clarified the payout relationship: recording collection creates the linked commission-only Finance Receipt excluding VAT. That receipt is a source for the separate agent-credit and payout workflow; invoice creation itself does not create or approve a payout.

## Verification

- Full source regression: 1,395 tests; 1,325 passed, 70 skipped, 0 failed.
- Focused dev.188 tests: 5 passed.
- dev.186/dev.187 continuity tests: 5 passed.
- JavaScript syntax checks passed.
- Changed-file credential and secret scan reported no findings.
- Deployment installer confirmed one served CRM Test version, unchanged migrations, healthy database readiness and the runtime package manifest.
- The public login page loaded after deployment. Authenticated Accountant UI validation remains the user's UAT step.

## Environment protection

- Production remained at `2.1.0-dev.91`.
- The R2 clone remained at `2.2.0-dev.93`.
- The installer confirmed Production and R2 clone snapshots were unchanged.
- External integrations remained disabled as required for CRM Test.
- No Production or R2 schema, configuration, data or application files were changed.

