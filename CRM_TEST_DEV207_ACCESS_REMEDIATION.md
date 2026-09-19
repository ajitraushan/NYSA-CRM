# CRM Test DEV207 — Admin access remediation

Prepared: 19 September 2026 (Asia/Dubai)

## Release baseline and rollback

- Target: CRM Test only
- Exact installed baseline: `2.1.0-dev.206`
- Baseline package SHA-256: `c1eecba608f05cf9cf2d17041a1234967c490d2e5a5bfdfc7ccff1c4b358457e`
- Baseline database: migration 126 of 126, `126_executing_agent_tier_and_social_uplift.sql`
- Server rollback point: `/home/nysareal/crm-backups/consolidated-crm-test-dev206-20260919T074455Z`
- Local pre-change snapshot: `remediation-baselines/dev207-admin-modularity-20260919T115247`
- Production and R2 clone: excluded from this release

## Line-by-line requirement comparison

| Requirement | DEV206 finding | DEV207 result | Verification |
|---|---|---|---|
| Admin is configuration-only, except governed leave administration | Central policy denied most business APIs, but dormant route and browser exceptions still named Admin | Removed Admin business exceptions from CRM identity, dashboards, customers/companies, inventory, listings, opportunities, finance receipts, payout operations, document review, marketing review, campaigns, comments and partner governance | `test/dev207-admin-modularity.test.js`; full suite |
| Retired Admin Assistant is not an alternate authority | Some route-local draft/read/write checks still accepted `admin_assistant` | Removed those operational and configuration fallbacks; retained only the fail-closed retired-role profile and schema compatibility | source scan; role-policy tests |
| Managing Director owns company-wide business functions | Some operational checks still used Admin as a company-wide fallback | Company-wide business access remains with `director`; Manager remains team-scoped; Property Finder CRM-Test sandbox operations moved to Director | policy, dashboard, partner-governance and sandbox tests |
| Admin wording is consistent | Active errors and configuration copy mixed “Administrator”, “Full Administrator” and “Admin” | Active user-facing JavaScript and API copy uses “Admin” | DEV207 terminology regression test |
| Access logic is modular | Central firewall existed, but inactive local bypasses contradicted it | Central policy remains the fail-closed boundary and local modules now express the same ownership rules | source assertions plus complete suite |
| No silent data or role reassignment | No automatic reassignment was approved | No user-role assignment, business record or customer data mutation is included | migration-neutral manifest |

## Test evidence

- JavaScript syntax: all changed runtime files passed `node --check`.
- Focused access and workflow tests: 112/112 passed.
- Full repository suite: 1,502 total; 1,429 passed; 0 failed; 73 skipped.
- Isolated DEV207 R2 access, administration and operational-message tests: 43/43 passed against the packaged runtime.
- Package, checksum file and manifest SHA-256 match: `2fd2bfc33d4c753020f71a6f1500ae719a957bfe881d8f8fbd5d4f08b45e27db`.
- Archive verification: 318 manifest entries matched, 146 packaged JavaScript files passed syntax checks, and no credential/private-key file was included.
- Deployment script uses LF line endings, requires the exact DEV206/migration-126 baseline, creates a backup first, and verifies that Production and R2 clone remain unchanged.

## Security, privacy and database impact

- Security: reduces privilege by removing source-level Admin and retired-Assistant business access.
- Privacy: no personal or customer data was added to code, tests, logs or release metadata.
- Database: no migration and no data update.
- Integrations: no external connector was enabled; deployment guard requires all protected connector switches to remain disabled.

## Required authenticated CRM Test UAT after deployment

Use separate active Admin and Managing Director sessions:

1. Admin opens directly into the single Administration workspace and can maintain configuration and governed leave.
2. Admin cannot open Customers, Leads, Inventory, Opportunities, Receivables, Commission Payments, business dashboards or operational review queues by navigation or direct URL.
3. Managing Director opens the business dashboard and can access company-wide business reviews, finance approvals and the Property Finder CRM-Test sandbox.
4. Managing Director cannot open the Administration workspace or change system configuration.
5. Manager can review only managed-team business records; a Listing Executive can maintain only owned/scoped records.
6. A retired `admin_assistant` assignment fails closed and shows no business or configuration workspace until explicitly reassigned.

Authenticated live UAT cannot be completed before DEV207 is deployed to CRM Test. Deployment requires explicit confirmation.
