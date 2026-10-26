# CRM Test DEV201 Deployment Completion

Deployed version: `2.1.0-dev.201` to CRM Test only.

Package: `nysa-core-consolidated-crm-test-dev201-r1.zip`

Package SHA-256: `255f20f68a334206d546f5d4d18b4e9034353e833a544d6c100d4c410967f995`

Runtime delta: `package.json`, `package-lock.json`, and `src/routes/commission-payout.js`.

The release corrects same-day batch-payment validation by comparing the actual payment date and MD approval timestamp as Dubai calendar dates. No schema, migration, payout policy, payout calculation, invoice, receivable, permission or integration contract changed. Latest migration remains `126_executing_agent_tier_and_social_uplift.sql` (126 total).

Verification:

- 123 payout and receivable tests passed; 3 restricted local PostgreSQL fixture tests were skipped; no test failed.
- Deployment script confirmed installed and served version `2.1.0-dev.201`.
- Health returned process `ready`; readiness returned database `ready`.
- Exactly one CRM Test worker was running after deployment: PID `77485`.
- Live Accountant UAT recorded approved batch `CPB-20260905-C6C2D89E` as a single test payment: AED 3,273.81, payment date `2026-09-16`, reference `UAT-DEV201-DUMMY-BANK-20260916-C6C2D89E`.
- The modal closed, the success message confirmed one row recorded, and the paid-batch register displayed the same batch, amount, date and reference.
- No browser console error was logged during the successful flow.

Rollback snapshot: `/home/nysareal/crm-backups/consolidated-crm-test-dev201-20260915T202829Z`.

Production and the R2 clone snapshots remained unchanged.
