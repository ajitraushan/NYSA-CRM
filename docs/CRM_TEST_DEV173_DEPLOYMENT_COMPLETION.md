# CRM Test dev.173 deployment completion

**Date:** 30 August 2026  
**Target:** CRM Test only  
**Version:** `2.1.0-dev.173`  
**Migration state:** `107_dev169_versioned_opportunity_stage_drafts.sql` (107 total; unchanged)

## Observed deployment result

The checksum-bound cumulative package deployed through the guarded CRM Test installer. The installer reported:

- `Deployment confirmed`;
- CRM Test PID `1835710` (`1 verified LiteSpeed listener process(es)`);
- installed/served version `2.1.0-dev.173`;
- latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`;
- integration switches disabled;
- backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T123316Z`;
- Production and R2 clone snapshots unchanged.

The inherited safety body retains its legacy `dev162` backup-directory label while enforcing the dev.172 baseline,
dev.173 package identity and migration-107 contract.

## Independent post-deployment observations

- Health returned exactly `{"ok":true,"process":"ready","version":"2.1.0-dev.173"}`.
- Readiness returned exactly `{"ok":true,"database":"ready","version":"2.1.0-dev.173"}`.
- Exact process filtering returned only `CRM_TEST_WORKER 1835710`.
- The served `dashboard-ui.js` asset returned `agent-operations-overview`.
- The served `app.js` asset returned `About NYSA CORE`.

## Candidate evidence

- Package: `nysa-core-consolidated-crm-test-dev173.zip`
- SHA-256: `ae5542cf75b597664da6a815d532f2139416647af896612cb4e8973f2b838230`
- Package entries: 307
- Focused Agent-dashboard information-hierarchy checks: 15/15 passed
- Full ordinary regression: 1,257 total; 1,227 passed; 30 protected skipped; 0 failed
- Post-build package checks: 5/5 passed

## Acceptance boundary

These are deployment and technical smoke observations only. They do not establish a human UAT pass. UAT-096
remains pending direct user review. Production, R2 and Property Finder were not targeted.
