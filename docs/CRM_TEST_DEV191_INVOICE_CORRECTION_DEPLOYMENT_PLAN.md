# CRM Test dev.191 — Commission Tax Invoice Correction

## Status and authority

- Status: **deployed to CRM Test on 5 September 2026**; installed and served version `2.1.0-dev.191`.
- Deployment target: CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`).
- Expected database: CRM Test (`nysareal_nysa_r2_rehearsal`).
- Live baseline: `2.1.0-dev.190`, migration 121.
- Exact source baseline package SHA-256: `220c14b96cb8650d30c716acf75e4e857f06893def782421fe58eb62a94d171f`.
- Production and R2 clone are excluded and must remain unchanged.
- Deployment was explicitly confirmed by Ajit for the checksum-bound r10 package.

## Correction scope

1. Replace the rejected proposal-derived invoice with a white A4 NYSA tax-invoice layout following the supplied invoice structure:
   - NYSA logo and invoice number;
   - NYSA and payer legal identity grid;
   - commission-detail table, including total and instalment commission percentages;
   - VAT and invoice total;
   - bank-account table;
   - invoice-specific notes and NYSA authorised-signatory line only.
2. Remove proposal wording, proposal footer and financial-illustration content from commission invoices.
3. Print NYSA legal name, Trade Licence number, VAT registration number, registered address and contact number from the active versioned Organisation Settings record.
4. Maintain NYSA invoice bank details in Administration: account name, bank name, account number, IBAN, SWIFT, currency and branch.
5. Maintain a Company's Trade Licence number, VAT registration number and registered address through Company invoice details.
6. For an off-plan Deal, require the invoice payer to be the active Developer linked to the Deal or its Inventory. Require the Developer's registered address and VAT registration number before printing.
7. Preserve system-generated `NYSA-INV-YYYY-NNNNNN` invoice identity and the separate invoice-per-instalment model.
8. Show the Developer/customer only as the recipient in `Invoice To`; do not repeat the recipient in the footnote or signature area.
9. Show NYSA Realty L.L.C's maintained office address inside the formal legal-details table, opposite the recipient address.
10. Add a thin NYSA-gold separator below the logo and above the invoice-number row.
11. Render all invoice-table borders at 0.25-point width.
12. Use `#333333` for invoice body text and warm off-white table borders.
13. Keep only the short brokerage-commission description below the bank table; omit the duplicate-invoicing and VAT-liability statements.
14. Use compact single-spaced table rows and multiline text leading throughout the invoice.

## Database migration

- New migration: `122_commission_invoice_legal_and_bank_details.sql`.
- Adds nullable VAT and bank remittance fields to `organization_settings` so the existing draft → approval → activation control continues to govern changes.
- Adds nullable VAT registration number to maintained Companies.
- The print route fails closed with a precise missing-master-data message until required active invoice fields are complete.

## Existing invoices

- Previously issued invoices are not silently rewritten or renumbered.
- An existing off-plan invoice addressed to the wrong payer is blocked from printing under the new rule and must use the existing Accountant request → MD approval cancellation/amendment process.

## Verification

- Syntax checks: passed for all changed JavaScript runtime files.
- Focused invoice, receivable, Organization Settings and package tests: 17/17 passed.
- Complete source regression: 1,433 total; 1,361 passed; 72 protected/integration tests skipped; 0 failed.
- Isolated package identity and runtime-delta checks: passed.
- Rendered PDF: one A4 page; visually inspected for logo, table alignment, legal identity, VAT and bank sections.
- Test content is synthetic and contains no customer credentials or personal data.

## Package

- File: `nysa-core-consolidated-crm-test-dev191-r10.zip`
- SHA-256: `76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233`
- Runtime delta: 10 files, including package-version metadata and migration 122.

## Deployment and rollback controls

Before mutation, the installer must verify the exact CRM Test root, database, dev.190 version, migration 121 and package checksum, then create a database dump and application archive. It must apply migration 122, install the checksum-bound runtime, start exactly one CRM Test worker, and verify health, readiness, version, migration, and unchanged Production/R2 snapshots.

Rollback restores the pre-dev.191 application archive and database dump, then restarts and re-verifies the dev.190 CRM Test worker. Production and R2 clone are never rollback targets for this change.

## CRM Test deployment result — 5 September 2026

- Guarded installer: completed successfully.
- Installed/served version: `2.1.0-dev.191`.
- Latest migration: `122_commission_invoice_legal_and_bank_details.sql` (`122` total).
- Verified backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev191-20260905T190841Z`.
- Live health: `ok=true`, `process=ready`, version `2.1.0-dev.191`.
- Live readiness: `ok=true`, `database=ready`, version `2.1.0-dev.191`.
- Runtime manifest and database contract: verified by the guarded installer.
- Worker state: exactly one new CRM Test worker verified by the guarded installer.
- Production and R2 clone snapshots: unchanged.
