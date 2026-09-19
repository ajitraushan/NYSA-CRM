# CRM Test dev.192 consolidated payout-workflow deployment plan

Date: 2026-09-06 (Dubai)

## Confirmed baseline

- Target: CRM Test only, `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_r2_rehearsal`
- Installed version: `2.1.0-dev.191`
- Latest migration: `122_commission_invoice_legal_and_bank_details.sql` (122 total)
- Source package: `nysa-core-consolidated-crm-test-dev191-r10.zip`
- Source SHA-256: `76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233`
- Rollback point: verified pre-dev.192 application archive and database dump created by the target-bound deployer before mutation.

## Approved release scope and corrections

The NYSA payout calculation sheet PDF is produced before the request fails. Both Print / view NYSA PDF and Download email attachment use that route. Its audit event uses entity type `AgentPayoutCalculationSheet`, but migration 121 did not permit that type in `audit_log_entity_type_check`. PostgreSQL error `23514` therefore converted both successful document renderings into HTTP 500 responses.

Migration 123 adds only `AgentPayoutCalculationSheet` to the existing audit entity-type constraint. It does not alter payout calculations, invoice data or business records.

The UI correction also adds Select all and Clear all actions to both Accountant selection tables and gives the identifier cells consistent two-line layout:

- Agent on line one; social-media status on line two.
- Opportunity reference on line one; Deal reference on line two.

Agent payout calculations use one scalable Commission payment register, matching the Receivables table pattern. Each payout calculation is one row with Agent/quarter, Opportunity/Deal, settlement and calculation figures, workflow status, and inline print/download actions for the complete Agent-quarter calculation sheet.

Bulk preparation is a single database transaction ordered by receipt chronology. Every selected row is prepared or the whole request is rolled back. Payout references include the individual commission-credit row, so multiple instalment receipts for the same Agent and Deal cannot collide.

## Verification and isolation

- Candidate: `nysa-core-consolidated-crm-test-dev192-r5.zip`
- Candidate SHA-256: `4f36f775d49324ab0056994386b6362b5c02d01a18ee8f28221147a7c983bfe7`
- Restricted local database fixture backed up before migration.
- Migration inventory advanced from 121 to 123 in the fixture (122 and 123 applied).
- Focused payout/PDF/UI tests: 29 passed, 0 failed.
- Isolated package/deployer verification: 3 passed, 0 failed.
- Full regression: 1,443 tests; 1,371 passed; 72 skipped; 0 failed.
- Release is built only from the exact deployed dev.191 r10 package plus seven checksum-listed runtime deltas: two version files, two UI files, two payout/access backend files and migration 123.
- Installer validates exact path, database, prior version/migration, package checksum, worker socket, disabled external integrations, post-migration audit constraint, health/readiness, installed runtime checksums and unchanged Production/R2 snapshots.

## Excluded

- Payout calculation policy changes.
- Invoice and receivable business-rule changes.
- Performance and campaign management.
- Production, R2 clone and Property Finder.
