# CRM Test dev.172 deployment completion

**Date:** 30 August 2026  
**Target:** CRM Test only  
**Version:** `2.1.0-dev.172`  
**Migration state:** `107_dev169_versioned_opportunity_stage_drafts.sql` (107 total; unchanged)

## Observed deployment result

The checksum-bound cumulative package deployed through the guarded CRM Test installer. The installer reported:

- `Deployment confirmed`;
- CRM Test PID `3548592` (`1 verified LiteSpeed listener process(es)`);
- installed/served version `2.1.0-dev.172`;
- latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`;
- integration switches disabled;
- backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T081058Z`;
- Production and R2 clone snapshots unchanged.

The inherited safety body retains its legacy `dev162` backup-directory label while enforcing the dev.171 baseline,
dev.172 package identity and migration-107 contract.

## Independent post-deployment observations

- Health returned exactly `{"ok":true,"process":"ready","version":"2.1.0-dev.172"}`.
- Readiness returned exactly `{"ok":true,"database":"ready","version":"2.1.0-dev.172"}`.
- Exact process filtering returned only `CRM_TEST_WORKER 3548592`.
- The served root asset contained `CORE-WEBSITE-THEME-DEV172`.
- The served root asset contained the 1,920 px shared-workspace ceiling.
- A signed-in Sales Agent browser view visibly reported `NYSA CORE 2.1.0-DEV.172` and rendered the website-aligned
  header, navigation, dashboard typography, controls and widened workspace. No record was changed during this
  read-only smoke.

## Candidate evidence

- Package: `nysa-core-consolidated-crm-test-dev172.zip`
- SHA-256: `270f1f2c7c24a1b7447e04d31888cf1aa4cacb6363e5fe68c879bf65b2d8a6be`
- Package entries: 304
- Focused shared-theme/dashboard checks: 34/34 passed
- Full ordinary regression: 1,252 total; 1,222 passed; 30 protected skipped; 0 failed
- Post-build package/theme contract checks: 4/4 passed

## Acceptance boundary

These are deployment and technical smoke observations only. They do not establish a human UAT pass. UAT-095
remains pending direct user review. Production, R2 and Property Finder were not targeted.
