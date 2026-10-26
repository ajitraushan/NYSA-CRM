# CRM Test dev.171 deployment completion

**Date:** 30 August 2026  
**Target:** CRM Test only  
**Version:** `2.1.0-dev.171`  
**Migration state:** `107_dev169_versioned_opportunity_stage_drafts.sql` (107 total; unchanged)

## Observed deployment result

The checksum-bound cumulative package deployed through the guarded CRM Test installer. The installer reported:

- `Deployment confirmed`;
- CRM Test PID `3233987` (`1 verified LiteSpeed listener process(es)`);
- installed/served version `2.1.0-dev.171`;
- latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`;
- integration switches disabled;
- backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T075833Z`;
- Production and R2 clone snapshots unchanged.

The backup directory retains the inherited `dev162` label from the reused safety body; the installer identity,
package identity, baseline, served version and runtime manifest were all bound to dev.171.

## Independent post-deployment observations

- Health returned exactly `{"ok":true,"process":"ready","version":"2.1.0-dev.171"}`.
- Readiness returned exactly `{"ok":true,"database":"ready","version":"2.1.0-dev.171"}`.
- Exact process filtering returned only `CRM_TEST_WORKER 3233987`.
- The live root asset returned the scoped `agent-dashboard-website-theme` CSS marker.
- The live `dashboard-ui.js` returned the Agent-theme scope marker.
- The live `dashboard-ui.js` did not contain `Four Overlapping KPI cards removed`.

## Candidate evidence

- Package: `nysa-core-consolidated-crm-test-dev171.zip`
- SHA-256: `a051b3150ee019961d346848d5eb0be85ffbc768fd76848630c24308c420c8ce`
- Package entries: 303
- Focused theme/version checks: 16/16 passed before packaging
- Full ordinary regression: 1,248 total; 1,218 passed; 30 protected skipped; 0 failed
- Post-build package/theme contract checks: 5/5 passed

## Acceptance boundary

These are deployment and technical smoke observations only. They do not establish a human UAT pass. UAT-094
remains pending direct user review of the signed-in Agent dashboard. Production, R2 and Property Finder were not
targeted.
