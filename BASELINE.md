# CRM Development Baseline

## CRM Test observation and DEV244 source baseline — 27/28 October 2026

- CRM Test serves `2.1.0-dev.243`, commit `31778b9b248690239e492c1c110d2aef53c5c8e0`, through migration 155. Its verified GitHub-origin archive SHA-256 is `74e3b24d5a1b92dbec636d854bc8005ba8925606f86e0138d0f4c5c7fe3a8f07`.
- The current recoverable server rollback point is `/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z`; its verified encrypted private local copy is `crm-test-dev243-20261027T193434Z/recovery.nyback`, encrypted SHA-256 `bee74240b3253cc6049a6b268c7f13760fa3460185fbf05578fbb4761c92694d`.
- Staging WordPress uses the governed CORE bridge 1.0.1 and the active NIA route. Live WhatsApp, email, Meta and voice sending remain disabled.
- DEV244 development starts from that exact commit. Target is CRM Test and the staging-to-CRM-Test test path only; production remains unchanged. DEV244 adds migration 156 and the owner-free Lead Response queue described in `docs/change-requests/NYSA-CRM-20261027-LEAD-001-DEV244-UNASSIGNED-QUEUE.md`.
- A new paired CRM Test/staging backup and encrypted verified off-server copy are required immediately before any DEV244 deployment. The DEV243 rollback evidence above remains the source-development rollback point, not a substitute for that predeployment refresh.

## CRM Test observation - 27 October 2026

CRM Test now serves 2.1.0-dev.241, commit a375e86156150be257f913a392b60e8f6a701227, migrations154. Origin archive SHA256 c46f36da50ef6b3e03f30d3ffc0fbadde708a52343cc6eeb94fd8b0f67f4fa11. Fresh paired rollback point /home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z; encrypted private local copy verified by isolated restore and all257 original table digests. Encrypted SHA256 51fc763a6eeb268f10728f4dca95e9b8baf785fb02177203401c9cbb116cbfed. Health/readiness200, all10 PDF formats passed. Live integrations disabled; production not targeted. Historical observations below are retained. See docs/change-requests/NYSA-CRM-20261026-LEAD-001-DEV241-DEPLOYMENT.md.

## Current observed baselines — 26 October 2026

- Production remains `2.1.0-dev.91`, with 61 migrations through `061_dev90_reference_and_status_governance.sql`. Actual 129-file runtime recovered read-only in GitHub commit `f32be47430c6869bec72e7c17e3f2f42d28c5f6b`, branch `codex/production-dev91-baseline-20261026`, observed tag `production/dev91-observed-20261026`. This is retrospective recovery, not original deployment provenance.
- Production source-only archive SHA-256: `0ee1fd83d10a3ae2f0c1ea05983d2afc004b489931429678362d8b5c1c10b8bf`. This is not a database rollback backup. No production code/configuration/data was changed during reconciliation.
- CRM Test remains `2.1.0-dev.239`, commit `5c0b31ec228679973494888ad166cb8a87c24849`, migration 140; origin package SHA-256 `cc3080c29f2ab8a379cc11d453d3522ad5b5a702f399b90c06db32dd3e8854a7`. Its verified predeployment paired backup is `/home/nysareal/crm-backups/consolidated-crm-test-dev239-20261025T224651Z`.
- Production upgrade candidate preparation: `2.1.0-rc.1`; production deployment HOLD pending exact-version approval, main promotion, fresh paired backups and authorized data-bearing rehearsal. See `docs/PRODUCTION_RELEASE_PREPARATION_20261026.md` and `docs/production-baselines/20261026-dev91.json`.
- The DEV208 reconciliation below is retained as historical evidence; it is not the current installed Test version.

## Historical DEV208 development baseline

Version: `NYSA-CRM-GOV-1.1`
Effective date: 2026-09-20
Status: DEV208 cumulative source recovery established in Git; CRM Test human UAT remains open.

## Approved source baseline

- Repository: `https://github.com/ajitraushan/NYSA-CRM.git`
- Recovery branch: `codex/crm-dev208-reconciled`
- Governed DEV208 source commit: `654be10ccac61be7c4bda638ce4be5eccebbb0f9`
- Recovery character: cumulative source recovery from the DEV174 repository state; this does not
  claim that DEV175 through DEV207 existed as separate Git commits before their deployments.

## CRM Test deployment baseline

- Environment: CRM Test only
- Installed and served version: `2.1.0-dev.208`
- Deployed package SHA-256: `989d6b628ee3a06b744012a5cb6a59eddd2db1a37e84642cbb63bb938cad8aa2`
- Package source baseline: `nysa-core-consolidated-crm-test-dev207-r2.zip`
- Package source baseline SHA-256: `2fd2bfc33d4c753020f71a6f1500ae719a957bfe881d8f8fbd5d4f08b45e27db`
- Latest migration: `127_governed_purchased_data_intake.sql` (127 total)
- Server rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`
- Verification: 1,523 tests; 1,445 passed; 78 skipped; 0 failed
- Production and R2 clone: unchanged

The DEV208 deployment predates the recovery commit. Its binding to the commit above is a documented
retrospective reconciliation based on the immutable package, checksums and runtime manifest, not a
claim that the package was originally built from that commit.

## Required future release controls

Before mutation, record the application version, file/database snapshot, target environment and
rollback point. Before any deployment request, all governed source, migrations, tests and release
metadata must be committed and pushed; the package manifest must identify that resolvable source
commit and immutable baseline package; and the exact candidate must pass the required tests.

Never use `current` or `latest` as the only baseline identifier. Production data, schema,
configuration and deployment continue to require explicit approval for that exact change.

Effective 2026-09-20, future packages must use the canonical origin-only release command documented
in `AGENTS.md` and `CRM_CHANGE_POLICY.md`. Historical packages remain evidence of prior deployments,
not templates for new builds. Repository branch protection should require the release-provenance CI
check; activating that required check is a separate GitHub repository-settings action.
