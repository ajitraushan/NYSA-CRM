# CRM Test DEV216 — DEV215 UAT remediation

## Controlled baseline

- Target: CRM Test only.
- Installed baseline: `2.1.0-dev.215`, origin commit `8c4eeb29eacc348ec0438cf686a228f0fe012277`.
- Database baseline: 129 migrations; latest `129_dev214_offplan_developer_stock.sql`.
- Recorded rollback before this work: `/home/nysareal/crm-backups/consolidated-crm-test-dev215-20260928T183127Z`.
- Candidate: `2.1.0-dev.216`; no database migration.
- Production and the R2 clone remain outside scope.

## Corrections

1. Leave submission no longer orders Admin approvers by the nonexistent `brokers.created_at` column.
2. The My Leave screen uses one atomic create-and-submit transaction, reuses an equivalent Draft left by the prior UI, and retains one idempotency key across a retry.
3. Purchased-Lead import writes the active classification catalogue identity, Customer objective, market stage, property segment and mapping evidence to both the Lead and its first Requirement version.
4. A Sales Agent whose assignment timed out cannot immediately reclaim that same recycled Lead. A Manager or Director must assign it to a different eligible Sales Agent.
5. The Sales Agent Lead screen opens on **My assigned Leads** while retaining an explicit company-visible read view.
6. Operational KPI cards no longer show Prior/null comparisons. Assignment-offer counts explicitly exclude recycled reassignment claims.

## Verification required before deployment

- Full release suite with zero failures.
- Restricted synthetic PostgreSQL migration replay through all 129 migrations.
- Database-backed Leave create/submit/replay and approval-task test.
- Database-backed routing priority, Manager assignment, Agent acceptance, SLA recycling and prior-Agent exclusion test.
- Purchased-data classification regression checks.
- DEV214 Opportunity/Inventory/Offer/Booking/Deal reference and title regression suite.
- Verified origin-built package and manifest checksums using the mandatory release verifier.

## Security, privacy and rollback

- Tests use synthetic `.invalid` identities in the restricted local fixture.
- No customer or employee data is copied into source, logs or package evidence.
- No permission expansion is introduced. Company-visible Lead read access remains; operational actions remain limited to the current assignee or authorized management role.
- Application rollback is the verified DEV215 package. Because DEV216 has no migration, database rollback is not normally required; the deployment still creates and verifies a fresh paired application/database backup before installation.

