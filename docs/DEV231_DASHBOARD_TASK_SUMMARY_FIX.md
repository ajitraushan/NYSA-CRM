# DEV231 — approved dashboard task-summary follow-up

Target: CRM Test only. User explicitly approved the additional task-summary compatibility correction after DEV230 fixed navigation but normal live dashboard rendering exposed `rows.map is not a function`.

Baseline: deployed DEV230, GitHub commit `71859211d0385a587f1f518cde3f904e40a5a92d`, package SHA-256 `2ed610b3ffdcee6f353fb1ba81d0f8e187c8bcc7a909310b522badf0065338bc`, 137 migrations. Fresh DEV230 backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev230-20261025T202313Z`. The DEV231 deployment must take another fresh validated application/database backup.

Root cause: the existing dashboard API returns `tasks:taskSummary`, an object of existing label/count pairs. The legacy renderer calls the array-based table helper directly with that object. The seven navigation tests initially used array-shaped synthetic tasks and did not exercise this existing response mismatch. The live check caught it before final completion was claimed.

Minimal correction: convert the returned task label/count pairs into table rows at the existing Task status call. Preserve historical array responses. Do not alter totals, labels, API, layout, dashboard calculations, permissions or data. The DEV230 connectivity/identity guards remain intact.

Only functional runtime file changed from DEV230: `public/app.js`, within `renderCrmDashboard`. Package metadata advances to `2.1.0-dev.231`; current-version test literals advance accordingly. No migrations, database corrections, business-rule changes or external-provider operations. Production and R2 excluded.

Nine focused dashboard tests cover the seven navigation/current-page scenarios plus object and historical-array task summaries; normal fixtures now match the real API object shape. Full regression: 1,378 passed, 87 skipped, 0 failed (1,465 total). Post-build verification repeats nine dashboard and nine prior-enhancement tests against the extracted package and renders all ten approved templates. Hosted checks must exercise the actual Manager dashboard, filters/export controls, deep-link reload and rapid navigation with no console errors.

Build exclusively with the canonical advertised-origin commit command and verify package/manifest provenance before deployment. Verify exact DEV230/137 baseline, fresh backups, runtime manifest, listener, health/readiness and protected environment snapshots. Roll back the application archive only if needed; schema remains 137 and no data restore is necessary for these UI corrections.

Final evidence: `uat-evidence/release-dev231-20261026/`. The preceding DEV230 deployment record must retain the discovered normal-dashboard failure; DEV231 supersedes it only after hosted checks pass.
