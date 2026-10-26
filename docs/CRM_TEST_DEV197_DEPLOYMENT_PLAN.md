# CRM Test DEV197 deployment plan

- Date: 2026-09-06 (Dubai)
- Target: CRM Test only — `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_r2_rehearsal`
- Required installed baseline: `2.1.0-dev.196`, migration 126
- Source package identity: DEV196 SHA-256 `c83dbf89599c3a330bf745174b2d7c2c1c3bf5f85202bae218dbdcefceb97b7d`
- Rollback point: verified pre-DEV197 PostgreSQL custom dump and application archive
- Data/schema impact: none; migration-neutral, retains migration 126
- Production/R2: excluded

## Approved scope

1. Use the corrected Excel-connected columns on screen and in the landscape NYSA Agent calculation PDF.
2. Show full currency values with thousands/million separators.
3. Bold the higher tier on the Deal that crosses the threshold.
4. Display the retrospective Tier Adjustment against the earlier Deal whose rate is being increased.
5. Show Agent-quarter totals for earned commission, already paid, tier adjustment, amount to be paid and status.
6. Preserve existing calculated, approval-batch and payment-release records as the authoritative workflow.

## Verification and rollback

- Focused calculation tests cover the corrected three-Deal, 55% to 60% tier-crossing example and paid/unpaid allocation.
- PDF is rendered to PNG and visually inspected before packaging.
- Full automated suite and isolated-package tests run from the exact package content.
- Deployment verifies checksum, runtime manifest, Node syntax, database contract, health, readiness, migration count and worker replacement.
- Any failure before confirmation invokes the deployment trap and reports the backup for rollback.
