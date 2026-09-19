# CRM Test dev.189 deployment completion

Date: 2026-09-05 (Asia/Dubai)

## Deployment result

- Target: CRM Test `/home/nysareal/nysa-core-dashboard-dd6262a-stage` only.
- Database: `nysareal_nysa_r2_rehearsal`.
- Installed and served version: `2.1.0-dev.189`.
- Package: `nysa-core-consolidated-crm-test-dev189-r4.zip`.
- Verified SHA-256: `9f7569b86eaf8b4d35fec6bd2a2cbd8b81dcade62872b48f28bed937c4d06451`.
- Latest migration: `120_commission_payment_batches.sql`; migration count is 120.
- Public health and readiness endpoints both reported `ok: true`, version `2.1.0-dev.189`, and a ready database.

## Backup and rollback point

- Recoverable pre-deployment backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev189-20260905T105119Z`.
- The backup contains the pre-dev.189 PostgreSQL dump, application archive, file listings and SHA-256 verification records.
- Rollback is to restore the application archive and database dump from that directory, then restart the CRM Test worker.

## Delivered scope

- Requirement 189: Commission Payment and Consolidated MD Approval.
- A paid commission invoice automatically creates payout eligibility from the collected commission excluding VAT.
- Accountants can select multiple eligible payout rows and submit one consolidated payout batch.
- The MD reviews the same tabular batch, can select or deselect individual rows, and approves the selected rows together; deselected rows remain pending.
- Accountants record actual agent payment only after approval.
- The legacy duplicate Finance Receipts confirmation is excluded from the payout workflow.
- The Closed Opportunities awaiting invoicing panel is hidden when it has no actionable records, while load errors remain visible.
- The receivable selector is labelled `Commission receivable / Closed Opportunity`, shows Opportunity, customer or known payer, and outstanding commission, and permits only Closed Won commission that remains available for invoicing.
- Payment-entry wording now uses `Incoming payment reference`, `Payment proof already uploaded`, and `Payment evidence reference`, with mutually exclusive proof/evidence entry and matching server validation.
- Standard monetary inputs accept decimal `K` and `M` shorthand, including `2.5k` as `2,500` and `1.25m` as `1,250,000`, and expand to full values on leaving the field.
- Invoice print preview now uses the `/api/finance/...` PDF route and opens the generated NYSA invoice PDF with browser print and download controls.
- Receivables use the softer NYSA navy-to-teal dark palette with reduced saturation and retained gold accents.
- Automatic `NYSA-INV-YYYY-######` invoice numbering and per-instalment invoice handling remain in force.

## Verification

- Full source regression: 1,407 tests; 1,337 passed, 70 skipped, 0 failed.
- Focused dev.189 tests: 54 passed, 0 failed.
- Package checks: 3 passed, 0 failed.
- Targeted real local database selector tests: 2 passed, 0 failed.
- Server-side package SHA-256 and installer syntax checks passed before mutation.
- The guarded installer verified the runtime manifest, migrations, schema contracts, health, readiness and protected-environment snapshots.
- Independent post-deployment checks confirmed version `2.1.0-dev.189`, healthy readiness and exactly one CRM Test worker (PID 1855922).
- Authenticated business-flow validation remains the user's CRM Test UAT step.

## Environment protection

- Production remained at `2.1.0-dev.91`.
- The R2 clone remained at `2.2.0-dev.93`.
- The installer confirmed Production and R2 clone snapshots were unchanged.
- External integrations remained disabled for CRM Test.
- No Production or R2 schema, configuration, data or application files were changed.
