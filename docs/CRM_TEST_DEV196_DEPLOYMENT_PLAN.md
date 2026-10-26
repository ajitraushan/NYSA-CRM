# CRM Test DEV196 Deployment Plan

Date: 2026-09-06 (Asia/Dubai)

## Target and baseline

- Target: CRM Test only (`/home/nysareal/crm-test.nysarealty.com`)
- Required installed baseline: `2.1.0-dev.192`, migration 123
- Source baseline commit: `1af87ba994599d8de1bab6d37b2005e609d449fe`
- Local recovery snapshot: `remediation-baselines/dev196-executing-agent-tier-social-uplift-20260906`
- Package: `nysa-core-consolidated-crm-test-dev196-r1.zip`
- Package SHA-256: `c83dbf89599c3a330bf745174b2d7c2c1c3bf5f85202bae218dbdcefceb97b7d`

## Approved scope

- Calculate the payout tier from gross commission actually received by NYSA excluding VAT.
- Apply the achieved tier to create the eligible payout pool, then apply the frozen originating/servicing Deal split.
- Assign tier achievement to the Deal-executing Agent.
- Apply the five-percentage-point social-media uplift only when that executing Agent is social-media active and has 100% of the Deal share.
- Apply no uplift to any Agent when the executing Agent's share is below 100%, including a 75%/25% Deal split.
- Preserve quarterly accumulation, selectable payout methods, batch approval, batch payment release, calculation-sheet PDF, and audit provenance.
- Add migrations 124, 125, and 126.

## Verification completed before deployment

- Focused payout regression: 30 passed, 0 failed.
- Full regression: 1,456 total; 1,384 passed, 72 skipped, 0 failed.
- Isolated deployment-package validation: 3 passed, 0 failed.
- MD review document rendered and visually inspected across five pages.

## Deployment safeguards

- Refuse any target other than the configured CRM Test application and database.
- Validate package checksum and runtime manifest before mutation.
- Create application and database backups before applying changes.
- Apply migrations through 126 and validate the new schema constraints.
- Restart CRM Test and require exactly one worker bound to its socket.
- Verify health/readiness reports version `2.1.0-dev.196`.
- Confirm Production and R2 clone snapshots are unchanged.

## Rollback

If deployment or verification fails, restore the application archive and database dump created by the deployer, restart CRM Test, and verify the prior health/version and single-worker state. Production and R2 are outside this deployment scope.
