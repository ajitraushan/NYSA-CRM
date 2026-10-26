# Cumulative production release preparation — 26 October 2026

Status: **prepared candidate; production deployment HOLD**. This record does not authorize production mutation or main-branch promotion.

## Reconciled baseline

Production `https://crm.nysarealty.com`, root `/home/nysareal/nysa-crm`, actually serves `2.1.0-dev.91` and has 61 applied migrations through `061_dev90_reference_and_status_governance.sql`. GitHub main was DEV79. Production had no embedded source-provenance manifest or Git checkout, so its actual source was recovered read-only rather than inferred from its package version.

- Observed-production recovery commit: `f32be47430c6869bec72e7c17e3f2f42d28c5f6b`.
- GitHub recovery branch: `codex/production-dev91-baseline-20261026`.
- Observed-production tag: `production/dev91-observed-20261026`.
- 129 runtime/static files verified byte-for-byte in the recovery commit.
- Source-only recovery archive SHA-256: `0ee1fd83d10a3ae2f0c1ea05983d2afc004b489931429678362d8b5c1c10b8bf`.
- Production schema column contract: 1,477 columns; SHA-256 `47229f45a90938e955c73c3cba448e19081526d42d88127178e46b7ce813f5ba`.
- Metadata/file hashes: `docs/production-baselines/20261026-dev91.json`.
- Three already-applied migration files differ from canonical source only in line endings. Their SQL semantics match; they must not be replayed.

The recovery is retrospective, not a claim that its new commit was originally deployed. No production code, configuration or records changed. Credentials, actual .env, database rows and private/customer documents were excluded from Git and snapshots. No production data was copied into development.

## Candidate scope

`2.1.0-rc.1` is the cumulative tested DEV239 runtime (`5c0b31ec228679973494888ad166cb8a87c24849`) with release metadata and preparation documentation/tools. No application/workflow code or migration SQL was changed for packaging. Full-size hash checks confirm that all production branding images are already retained byte-for-byte in DEV239. Current DEV239 UI references remain unchanged; no asset restoration was needed.

| Area since production DEV91 | Cumulative scope |
|---|---|
| Customer/Lead intake | Governed intake evidence, duplicate/recovery handling, customer evidence and classification |
| Inventory and matching | Matching/requirement confirmation, readiness, assignment/availability, portal preparation and reservation fixes |
| Opportunity and documents | Stage drafts, viewing decisions, bilateral acceptance, approved PDFs, mandates/NOC and closure documents |
| Finance and compliance | Commission receipts, receivables/invoices, payment batches/payout advice, identity and document compliance |
| Reporting and administration | Dashboard navigation/cards/drill-down/scope, completed-lead task cleanup, maintainable targets and business-line/team/KPI setup |
| Optional providers | Existing gated Email/Calendly/Google/Property Finder boundaries; no account connection or provider activation is part of this promotion |

Ship one full cumulative package, not individual historical DEV archives. All 61 applied migration names remain; only migrations 062–140 (79 files) are pending. Existing account/customer/transaction data must be retained, never replaced by CRM Test data.

Route reconciliation found 277 literal production routes: the three target lifecycle actions are retained through the new shared handler loop. The old Offer-level legacy reservation-reconciliation endpoint is intentionally absent in the already-tested cumulative runtime; governed Booking release/expiry/cancellation replaces that obsolete recovery path. This preparation did not introduce that removal.

## Production role and migration review artifacts

Production uses `nysareal_nysacrmapp` on `nysareal_nysacrm`; CRM Test uses another runtime role. Do **not** blindly start the application to run pending migrations, because historical source SQL contains grants to the CRM Test runtime identity.

The committed read-only generator `scripts/prepare-production-release-plan.mjs` reads every pending migration from the exact Git commit and emits a review SQL companion plus a JSON plan. It changes only whole-token runtime-role references from `nysareal_nysar2app` to `nysareal_nysacrmapp`, preserves privileges, records both original/rendered hashes and uses per-migration transactions/ledger registration. Its SQL refuses a different database, role or 61-migration baseline. It does not connect to any database or execute the SQL.

The source package's migration files remain immutable. After separate production approval, the reviewed role-bound companion would be applied before startup; the registered migrations then prevent unmodified source files from being replayed. Existing production grants are not revoked or broadened by preparation. Actual permission execution remains part of the exact-version approval.

## Verification and migration rehearsal

- DEV239 acceptance evidence remains in its deployment report.
- Candidate canonical packaging reruns the full regression suite in a detached checkout of a pushed, origin-advertised commit. Mandatory provenance verification must pass before release use.
- The exact production DEV91 source migrations reconstructed the observed 1,477-column contract in the restricted local fixture.
- All 79 pending migrations then passed in a fresh disposable schema with synthetic Admin/Manager/Agent identities, three contacts/leads and one legacy Inventory record. Counts were preserved; three business-line mappings were created. The disposable schema was removed.
- Fixture grants were explicitly mapped to the restricted test role; no production database connection or customer data was used by the rehearsal.
- This structural/synthetic result is **not** a substitute for an isolated, authorized restored-production-backup rehearsal with data reconciliation.

## Gates before production deployment

1. Review the exact candidate commit/archive/manifest hashes and migration/role plan; approve main-branch promotion according to the runbook.
2. Approve a production maintenance window and exact-version deployment. The current request authorizes preparation, not deployment.
3. Create fresh paired production application/database backups, verify `pg_restore --list`, retain an off-server recovery copy and record checksums. The source-only snapshot is not a database rollback backup.
4. Explicitly authorize any data-bearing backup restoration into an isolated rehearsal environment; verify real-data migration effects, constraints, identifiers, balances, ownership and audit counts before promotion.
5. Review production-only configuration: preserve registered database/private storage settings, verify renderer dependencies and approved company/BRN/templates, service-actor intake configuration, team/business-line mappings, KPI targets and threshold choices. Do not copy CRM Test users, targets, documents or configuration wholesale.
6. Keep optional providers disabled unless separately configured and approved. Existing production secrets stay server-side; do not use sample .env.example values.
7. Apply only the reviewed migration plan during the approved window, promote the verified full application, install exact lockfile dependencies, restart once and verify health/readiness/login/roles/critical workflows/PDFs.
8. Roll back using the fresh paired application/database backup if the agreed acceptance checks fail. Restoring code alone against a migrated database is not a complete rollback.

Production and CRM Test remain at their existing deployed versions during preparation. Nothing in the recovery branch, tag, draft pull request or prepared artifacts grants deployment permission.
