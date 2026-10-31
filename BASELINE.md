# CRM Development Baseline

## UI-001 and production readiness candidate — 31 October 2026

- User-approved scope: resolve DEV248 production blockers, implement the complete UI-001 presentation/design-system scope, run consistency/regression checks and prepare the final deployment for approval. Final production deployment is not yet authorized. Email OTP, voice, live outreach, unrelated functional observations and the held Admin invitation fix remain excluded.
- Reproducible source/rollback point: DEV248 commit `a6fafab35ef0042f0a5b1c31c5bd35dd33821590`, tree `5addcf071be56f3c0bb53a414eccd565e376b71b`; pinned GitHub branch `codex/production-dev248-20261031`. Development branch: `codex/dev251-ui001-release`; isolated managed worktree. Original tracked source was clean before development.
- Current installed production is active RC1, commit `b6e013c51f46be482858e733160fa7e675ff3106`, migration 140; production main merge `4f1034167c591acb87fe9c025af48835d58630e3`. CRM Test is DEV248/migration 159; R2 is original DEV93/migration 61, restored after the successful current-production-backup rehearsal. These live observations supersede older baseline sections below.
- Existing preparation evidence is in `C:/Users/ajitr/OneDrive/Desktop/nysa-pocket-ledger/canonical-worktree/release-artifacts/production/20261031-dev248`. All 19 pending migrations passed against current production data in R2; 257 original non-ledger tables retained original-column fingerprints; R2 recovery verified all 109 original tables. Fresh server-only preparation backup: `/home/nysareal/crm-release-preparation/20261031-dev248/r2-rehearsal-20261031T100407630Z`. It is not a substitute for a fresh complete deployment-time backup and verified encrypted off-server copy.
- Production readiness findings: two exact-root workers; missing production intake identity/matching keys and service actors; coordinated website bridge/configuration review required; 11 dependency advisories (10 high, one moderate) also reported for RC1. Development must address these without copying Test secrets, users or assignments, changing business policy, or enabling optional outreach/providers.
- Before any production operation: present the concrete version, source/package hashes, configuration/worker operations, complete rollback set and maintenance window for exact approval. Before a CRM Test UI deployment: create fresh paired backups and verified encrypted off-server recovery, verify origin provenance and audit exact-root workers before and after readiness.
- UI-001 implementation preserves existing server access rules and workflow commands. Separately listed functional observations require their own diagnosis; presentation must use existing authorized outcome/review routes rather than inventing new permissions or states.

## DEV248 approved intake-correction development baseline - 30 October 2026

- Approved scope: CRM Test and the staging website test path under `NYSA-CRM-20261028-NIA-001`, `NYSA-CRM-20261029-LEAD-004` through `LEAD-007`, and `NYSA-CRM-20261030-LEAD-008`. Email verification (`LEAD-009`) and the UI makeover (`UI-001`) are reserved for later approved candidates DEV249-DEV251.
- Reproducible source and rollback point: application `2.1.0-dev.247`, Git commit `72f88565be43e76254f022b426531864a269763a`, branch `codex/web-intake-phase1`. At observation, the only working-tree additions were the approved documentation files for `LEAD-009` and `UI-001`; no runtime file was modified.
- Target of this step: isolated DEV248 source implementation and synthetic/restricted-fixture testing only. CRM Test currently serves DEV247 and the staging bridge remains at its installed version until a separately packaged, provenance-verified DEV248 deployment is ready.
- Data/role boundary: preserve existing customers, users, passwords, teams, manager relationships, assignments and integration configuration. Use synthetic or explicitly approved CRM Test evidence only.
- Deployment boundary: production, WhatsApp OTP, SMS OTP, voice and all production integrations remain out of scope. Before any DEV248 deployment, refresh and verify paired CRM Test/staging backups and the encrypted private off-server copy, advertise the exact commit through GitHub origin, build only with the mandatory origin package command, verify provenance, and confirm exactly one hosted CRM worker after readiness.
- Source verification completed before commit: the guarded fixture rebuilt through all 159 migrations; the DEV248 PostgreSQL lifecycle passed; the focused intake/bridge contract passed; and the governed release selection passed 1,483 tests with 92 intentional skips and zero failures. No CRM Test, staging or production mutation occurred during these source checks.

## DEV247 WEB Intake Phase 1 source candidate — 29 October 2026

- Scope: source build and isolated synthetic validation only. CRM Test remains `2.1.0-dev.246`; staging remains healthy on its existing bridge; production, CRM Test and staging code, data, schema, configuration, users, passwords and assignments were not changed.
- Reproducible source baseline: GitHub-advertised commit `73be0189df51858831b32e178163fbc1a7258779`, developed on branch `codex/web-intake-phase1`. The rollback point for this development step is that exact origin commit; no deployment package has been built.
- Candidate: `2.1.0-dev.247`, migration `158_web_intake_phase1_foundation.sql`. The sole approved design input is `docs/change-requests/NYSA-CRM-20261029-LEAD-003-WEB-INTAKE-DETAILED-DESIGN-v1.3-developer.md`; it supersedes earlier review documents.
- Phase 1 provides the shared **WEB Intake Leads** desk, explicit single/multi-step journeys, encrypted provisional identity with keyed deterministic matching, 30-minute incomplete-journey recovery, atomic Sales Agent/Manager pickup, **My Lead Queue**, governed Lead/Requirement creation only at pickup or confirmed recovery promotion, one primary next task, owner/manager stale warnings, release back to the desk and an audit trail.
- WhatsApp, email, AI conversation, Meta live retrieval and voice delivery are not part of this activation. The reconciliation worker is disabled by default and all customer outreach remains off.
- Verification: all 158 migrations rebuilt successfully on the restricted `nysa_test_fixture`; synthetic PostgreSQL lifecycle tests passed for dropped recovery and completed pickup; governed release selection passed 1,571 tests (1,479 passed, 92 skipped, zero failures). Ninety-two historical local-artifact tests are deliberately excluded by the governed selector in a clean origin worktree.
- Required before any CRM Test deployment: peer/UAT review, committed and GitHub-advertised SHA, mandatory origin-only package and provenance verification, fresh paired CRM Test/staging backups plus verified encrypted private off-server copy, and exact DEV247 deployment approval. Production remains out of scope.

## CRM Test DEV246 Incoming Leads candidate — 28 October 2026

- Target: CRM Test only. Production code, data, schema, configuration and assignments remain unchanged; live Meta, WhatsApp, email and voice delivery remain disabled.
- Installed baseline: CRM Test `2.1.0-dev.245`, Git commit `ac9bdd1ab28a7ac6a1fdeaffdcce3973e7fc334b`, through migration 156; staging bridge remains 1.1.0.
- Verified pre-implementation recovery evidence: `/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z`, bundle SHA-256 `054bc6fc720530e61fad649350b11383156987f2aa80dac39c87fde955be63c3`, and encrypted local copy `C:\NYSA-Recovery\crm-test-dev243-pre-20261028T054325Z\crm-test-dev243-pre-20261028T054325Z.nyback`, encrypted SHA-256 `4e6048309e8824087084a317dc74aec68284966bf67bee6067bdb32c704de8d7`.
- DEV246 adds the Admin/Manager Incoming Leads arrival, validation and response-assignment workspace plus migration 157 for non-customer Meta campaign/ad metadata and governed campaign reconciliation. Existing Lead ownership/team assignment is preserved.
- A fresh paired CRM Test backup and verified encrypted private off-server copy are mandatory immediately before deployment. See `docs/change-requests/NYSA-CRM-20261028-LEAD-002-DEV246-INCOMING-LEADS.md`.

## CRM Test/staging DEV245 NIA correction candidate — 28 October 2026

- Target: CRM Test and `staging.nysarealty.com` only. Production code, data, configuration, assignments and the production NIA journey remain unchanged.
- Installed baseline remains CRM Test `2.1.0-dev.243`, commit `31778b9b248690239e492c1c110d2aef53c5c8e0`, through migration 155, with staging bridge 1.0.1.
- Source baseline is the undeployed DEV244 candidate at commit `f9ba9759bc180f154748e7aecf17392d9e33c0db`. DEV245 retains migration 156 and adds no migration.
- Existing recoverable development rollback evidence is `/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z` plus the verified encrypted local copy `crm-test-dev243-20261027T193434Z/recovery.nyback`. A new paired CRM Test/staging backup and verified encrypted off-server copy are mandatory immediately before DEV245 deployment.
- DEV245 corrects NIA structured mapping, preserves raw evidence, retains format-valid email with separate advisory credibility status, requires the exact dedicated `System – NIA Intake` actor, and leaves canonical Lead ownership unassigned.
- Live WhatsApp, email, Meta and voice delivery remain disabled. See `docs/change-requests/NYSA-CRM-20261028-NIA-001-DEV245-MAPPING.md`.

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
