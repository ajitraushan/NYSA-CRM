# CRM Test dev.189 — implementation and deployment plan

Date: 2026-09-05 (Asia/Dubai)

## Authority and baseline

- User-authorized scope: implement all changes discussed after the last CRM Test deployment; request confirmation before deployment.
- Live target baseline: CRM Test `2.1.0-dev.188`.
- Baseline package: `nysa-core-consolidated-crm-test-dev188-r3.zip`.
- Baseline SHA-256: `c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4`.
- Existing rollback point: `/home/nysareal/crm-backups/consolidated-crm-test-dev188-20260905T095123Z`.
- Planned target: CRM Test application and `nysareal_nysa_r2_rehearsal` database only.
- Production, R2 clone, Property Finder, Performance Management and Campaign Management are excluded.

## Included changes

1. Receivables wording and visual clarity, including a softer NYSA navy-to-teal dark palette.
2. Invoice preview/print opens the NYSA paper invoice endpoint correctly.
3. Payment evidence uses plain terms and requires either an uploaded proof or a payment-evidence reference, not duplicate entries.
4. Decimal amount shorthand such as `2.5k` is accepted and normalized across monetary fields.
5. Empty awaiting-invoice guidance is hidden when no work exists.
6. Recording an invoice payment automatically confirms that invoice-linked receipt; duplicate manual receipt confirmation is removed from the normal path.
7. Each cleared invoice instalment creates a separately traceable agent-credit basis, including backfill for existing invoice-linked payments.
8. Requirement 189: one shared **Commission Payments** table for Accountant and MD.
9. Accountant selects prepared payment rows and submits them as one consolidated approval batch.
10. MD may select or deselect individual rows and approve the selected total in one action. Deselected rows remain pending.
11. Accountant records the actual agent payment only after MD approval; future payment dates are rejected.
12. Invoice creation uses a **Commission receivable / Closed Opportunity** selector instead of a general Opportunity selector.
13. The selector includes only Closed Won Opportunities with commission still available for invoicing and identifies each option by Opportunity reference, customer/known payer and outstanding commission.
14. Generated invoice references continue to be assigned automatically in the `NYSA-INV-YYYY-NNNNNN` sequence.

## Database change

- `119_invoice_payment_auto_confirmation.sql`: backfills invoice-linked receipt confirmation.
- `120_commission_payment_batches.sql`: adds per-instalment agent-credit identity and consolidated approval batch records.
- Existing migrations 001–118 remain byte-for-byte unchanged.

## Security and privacy

- Accountant receives preparation, submission and approved-payment recording access only.
- MD/Director alone can approve a consolidated batch.
- No external payment, banking or notification integration is added.
- No customer contact information is added to payout records or deployment evidence.

## Deployment gate

No deployment is authorized by this implementation request. Before deployment, present the candidate version, package checksum, migration list, tests, exact target, new backup location and rollback procedure, and obtain explicit user confirmation.
