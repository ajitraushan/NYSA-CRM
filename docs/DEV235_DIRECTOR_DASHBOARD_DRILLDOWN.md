# DEV235 — Director dashboard drill-down repair

CRM Test only. Baseline DEV234 commit8d03380a71207c4b06f4e40bddeeb63185b31b22, migration137. Source snapshot app.js.before; prior recoverable server backup /home/nysareal/crm-backups/consolidated-crm-test-dev234-20261025T211607Z. Fresh validated app/database backup required before deployment.

Live Director reproduction: eight top cards appear, no lower summary cards, and TypeError reading map at app.js:1552. API-shaped tests reproduce the failure in all four Director views. The legacy renderer reads futureMetrics, while the existing API returns unavailableMetrics. Rendering stops before binding any KPI/summary handlers. Earlier Director tests omitted dashboardType executive and thus skipped this branch.

Minimal correction uses the existing unavailableMetrics array, retaining historical futureMetrics compatibility. Existing labels, values, scope, views and dashboard layout remain. All Manager/Director summary cards, including maturity details, retain their click handlers. Agent continues to show only its four top cards.

The shared record drill-down also assumed every response was a Lead. Director Inventory metrics return listing records and Operations metrics return exception records. Render the returned entity type using its existing fields and open the correct Inventory/Opportunity/Lead record. Keep filters and API/backend contracts unchanged; null-ID intake events remain informational. Preserve escaped text, service error presentation and empty results.

Only functional runtime file: public/app.js, confined to renderCrmDashboard and openDashboardRecords. No backend, CSS, permissions, calculations, migration, dependency, data or external integration changes. Other changes are tests and required release metadata/support.

Tests cover all87card clicks across Agent default, Manager default and Director Executive/Sales/Inventory/Operations and Risk:28KPI cards and59summary cards. Real server presentation data supplies KPI and unavailableMetrics contracts. Record fixtures cover listing/lead/opportunity/exception/engagement, empty results, service failure, null IDs, HTML escaping and retained filter parameters. Existing navigation races and role-scope tests remain. Full release regression, extracted-package focused tests and10PDF renders precede hosted role-by-role checks.

Canonical packaging and verification only; source must already be advertised by GitHub origin. Production and R2 excluded. Application rollback restores fresh pre-DEV235 app archive; schema remains137 and no database restore/schema reversal is required.
