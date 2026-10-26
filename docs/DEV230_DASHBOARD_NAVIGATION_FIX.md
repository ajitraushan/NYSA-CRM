# DEV230 — dashboard navigation race, CRM Test only

User-authorized scope: fix the dashboard navigation error present in DEV228/DEV229, test regression and deploy from GitHub. No other functional changes.

Baseline: deployed DEV229, commit `4b4f7c69a3f819e5517188bc164553cf6e557b8a`, package SHA-256 `982555f60d8210d453733bb28bbacf0f8b6f3f73cb71eeeb6e91ec19e977b131`, 137 migrations through `137_uat_inventory_viewing_and_reservations.sql`. Existing recovery point: `/home/nysareal/crm-backups/consolidated-crm-test-dev229-20261025T201003Z`. Source archived before editing; deployment must take a fresh verified database/application backup.

Root cause: `renderCrmDashboard` awaits staff and dashboard requests, then queries global dashboard element IDs. Opportunity restoration or navigation can replace/disconnect those elements while requests are pending. A late success dereferences a missing control; its error handler also dereferences a missing KPI container. Overlapping dashboard renders can additionally deliver an old response into newer controls with the same IDs.

Fix: capture this render's dashboard context element and verify its connectivity and identity after each awaited request phase and before error presentation. Obsolete renders return before writing or binding events. Current-page request failures still display normally. No request payload, dashboard calculation, role, API, document, database, layout or business workflow change.

The only functional runtime file changed is `public/app.js`. Package version advances to `2.1.0-dev.230`; existing version assertions advance accordingly. New tests and release companions are supporting controls. No new migration: schema remains at 137. Production and R2 excluded.

Verification before build: seven new deterministic tests cover navigation during staff success/failure, late dashboard success/failure, old/new renders sharing IDs, normal rendering/binding/export and visible current-page errors. All pass. Full release regression: **1,376 passed / 87 skipped / 0 failed**, 1,463 total. Synthetic real-browser checks confirm late success/failure preserve another workflow and normal rendering remains functional, with no console errors.

Package only through `npm run release:package -- --commit <full-advertised-origin-SHA>`, then `npm run release:verify-package -- <zip> <manifest> <manifest-sha256-file>`. Post-build checks repeat seven dashboard tests and nine prior enhancement tests against the extracted package, and render all ten approved PDF formats. Hosting checks must confirm the exact DEV229/137 baseline, backups, package/companion hashes, Test worker listener, unchanged schema, health/readiness and protected environment snapshots. Finally check live reload/deep-link navigation and normal dashboard loading.

Rollback: restore the fresh pre-DEV230 application archive and restart only the Test worker. No database rollback is required. Do not restore/delete operational data for this UI fix. No security/privacy policy changes or external provider operations.

Final Git SHA, package hashes, backup, hosted checks and screenshot are recorded separately in `uat-evidence/release-dev230-20261026/` after deployment.
