# CRM Test DEV196 Deployment Completion

Date: 2026-09-06 (Asia/Dubai)

## Result

- Status: deployed and verified
- Environment: CRM Test only
- Installed and served version: `2.1.0-dev.196`
- Latest migration: `126_executing_agent_tier_and_social_uplift.sql` (126 total)
- Health: `{"ok":true,"process":"ready","version":"2.1.0-dev.196"}`
- Worker contract: exactly one new CRM Test worker, owning the expected CRM Test listener, verified by the guarded deployer
- Production and R2 clone snapshots: unchanged

## Recovery point

- Verified pre-deployment backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev196-20260905T220229Z`
- The backup contains the pre-DEV196 database dump, application archive, content inventories, and SHA-256 checksums.

## Package identity

- Package: `nysa-core-consolidated-crm-test-dev196-r1.zip`
- SHA-256: `c83dbf89599c3a330bf745174b2d7c2c1c3bf5f85202bae218dbdcefceb97b7d`
- Source package baseline: exact deployed DEV192 R5 runtime

## Verification evidence

- Focused payout regression: 30 passed, 0 failed.
- Full regression: 1,456 total; 1,384 passed, 72 skipped, 0 failed.
- Isolated package verification: 3 passed, 0 failed.
- Server package checksum and both package/runtime manifests passed.
- Database contract for batch release, received-gross provenance, executing-tier Agent, and social-uplift eligibility passed.
- External health endpoint returned ready on `2.1.0-dev.196` after restart.

## Business rule deployed

The achieved payout tier is evaluated for the Deal-executing Agent against gross commission actually received by NYSA excluding VAT. The tier creates the eligible payout pool, after which the frozen Agent split is applied. The five-percentage-point social-media uplift is allowed only when the executing Agent is social-media active and owns 100% of the Deal share. A split Deal, including a 75%/25% split, receives no social-media uplift for either Agent.

## Security and privacy

- No Production or R2 application, schema, configuration, or data was changed.
- No customer credentials or personal data were added to the release artifacts or deployment record.
- Existing Accountant/MD authorization checks remain in place; the deployed change records additional payout-calculation provenance for auditability.
