# CRM Test DEV199 deployment plan

- Date: 2026-09-15 (Dubai)
- Target: CRM Test only — `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_r2_rehearsal`
- Required installed baseline: `2.1.0-dev.198`, migration 126
- Source package identity: DEV198 SHA-256 `e1fba528650bc35ef20694eb6fc4db1ca2f57d05b3e66faa40b8fcfa9c839f5c`
- Rollback point: verified pre-DEV199 PostgreSQL custom dump and application archive
- Data/schema impact: none; migration-neutral, retains migration 126
- Production/R2: excluded

## Approved scope

1. Add **Total Deal Commission — Excluding VAT** to the Agent payout register and PDF.
2. Rename the receipt column **Company Gross Commission Received — Excluding VAT**.
3. Add **Commission Received in This Tranche (%)** with Partial payment, Full payment and above-total disclosure.
4. Calculate the tranche percentage as the immutable VAT-exclusive collection divided by the latest frozen total Deal commission.
5. Preserve the payout formula: only commission actually received by NYSA excluding VAT enters the tier and Agent-split calculation.

## Verification and rollback

- Synthetic tests cover AED 100,000 total Deal commission, AED 23,809.52 received, 23.81% partial tranche, 55% tier, 75% split and AED 9,821.43 payout.
- The landscape PDF is rendered to PNG and inspected for alignment and legibility.
- Tests run from the exact checksum-bound package content.
- Deployment verifies checksum, runtime manifest, Node syntax, database contract, health, readiness, migration count and worker replacement.
- Any failure before confirmation invokes the deployment trap and reports the backup for rollback.
