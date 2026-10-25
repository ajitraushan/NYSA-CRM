# DEV232 — approved role-scoped dashboard cards

Target CRM Test only. Baseline DEV231 commit 5675f2afed5c6573e3f03b477d318a948fb26ed6, schema 137, rollback backup /home/nysareal/crm-backups/consolidated-crm-test-dev231-20261025T203029Z. Fresh validated backups are required immediately before deployment.

User-approved scope: remove exactly Lead stages, Source quality, Team workload, Agent workload, Task status and Data/consent/integration exceptions sections from Agent dashboard. Retain its top cards and their drill-down. Manager and Director existing sections become summary cards opening their original details. Existing record links within detail dialogs remain usable. No replacement dashboard renderer or loading-order change.

Managers see managed teams only, including current/prior dashboard filters, lead drill-down and call reports. Dashboard-only scope recognizes the existing team manager, active manager membership and active manager role assignment. Personal ownership outside managed teams does not widen scope. Director retains company scope. Inventory totals use the poster's team, consistent with existing Inventory ownership/review queries. Company integration failures are excluded from Manager exceptions because they have no attributable team. Team inventory snapshots must not overwrite company snapshots. General CRM access and document permissions are unchanged.

Functional runtime files: public/app.js, src/routes/dashboards.js and new src/dashboard-scope.js. No schema migration, data correction, dependency change or external integration change. Summary totals use existing response values; flags may overlap and are labelled flags; recent activity is the existing latest-eight list. The complete existing detail content opens on drill-down.

Validation: navigation concurrency, original top-card handlers, Agent removal, Manager/Director cards and detail content, object/array task totals; synthetic PostgreSQL temporary-table checks for managed teams, cross-team filters, ended memberships/inactive teams, Director/Agent scope, with rollback. Full release suite and extracted-package tests plus all ten PDF render checks. Hosted verification follows deployment.

Build only from the pushed GitHub commit with npm run release:package -- --commit SHA. Verify package/manifest provenance before deployment. Production and R2 are excluded. Rollback restores the fresh pre-DEV232 app archive; schema remains137.
