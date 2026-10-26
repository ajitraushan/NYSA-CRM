# CRM Test DEV198 deployment plan

- Date: 2026-09-15 (Dubai)
- Target: CRM Test only — `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_r2_rehearsal`
- Required installed baseline: `2.1.0-dev.197`, migration 126
- Source package identity: DEV197 SHA-256 `4f3a3e38a303d981914a18cb151fd2c6ec7f4872f566e47ff3b296b2b13126ee`
- Rollback point: verified pre-DEV198 PostgreSQL custom dump and application archive
- Data/schema impact: none; migration-neutral, retains migration 126
- Production/R2: excluded

## Approved scope proposed for confirmation

1. Fix **Prepare selected** for Deals whose Agent split is below 100% by persisting the payout band on the Agent commission basis required by the immutable reconciliation constraint.
2. Preserve and display the company gross commission received separately from the Agent’s frozen Deal split and eligible commission amount.
3. For historical receivable-derived calculations, use the linked immutable collection net commission as the authoritative company gross received.
4. Use the frozen credit-line split for the on-screen calculation register.
5. Keep both inline print and downloaded email-attachment PDFs in landscape and remove the rejected explanatory paragraph.

## Verification and rollback

- Focused calculation tests cover the exact AED 23,809.52 receipt, 75% Deal split, 55% tier and AED 9,821.43 payout.
- Landscape PDF is rendered to PNG and visually inspected before packaging.
- The 85-test payout/regression suite and isolated-package tests run from the exact package content; the separate restricted-database contract test validates the deployed reconciliation constraint.
- Deployment verifies checksum, runtime manifest, Node syntax, database contract, health, readiness, migration count and worker replacement.
- Any failure before confirmation invokes the deployment trap and reports the backup for rollback.
