# CRM Development Baseline

## DEV269 D-2 candidate — 11 November 2026

- Installed CRM Test source of truth remains accepted DEV268
  `2.1.0-dev.268`, commit
  `b6272e9c9f2a17a2c082324ec8810391de7bdf01`, database
  `nysareal_nysa_dev247_smoke`, migration 170, 306 public tables and 111
  enabled triggers. No DEV269 upload or hosted action has occurred.
- DEV269 candidate is `2.1.0-dev.269`, GitHub-advertised commit
  `e5db302e12a21d2597ecab0dc340fa2eae534381`. Origin package SHA-256 is
  `05b27a47641b430e991238673f531e91b2843b644ee3fb7a9473bb313e1a6a64`;
  manifest SHA-256 is
  `683543c64a27effd1a827f8f1f448a5098ddf7fe1446018ed9c9f3c345d0aa1e`;
  generated deploy-config SHA-256 is
  `beafa2c490ee6da3063f82883a86632704dd4604ef302366ae2e6279a5aea430`.
- DEV269 is migration-neutral. Baseline and canonical schema remain byte-
  identical at 170 migrations, 306 tables and 111 triggers, schema manifest
  `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`.
- The corrected calling-hours rule is implemented for scheduled call follow-ups
  and logged outbound calls: default warning, acknowledgement plus reason,
  visible Task/call evidence and Manager/audit register; optional `refuse` mode
  returns 409. Repeat-call limits remain warnings.
- Origin regression passed 1,592 of 1,697 tests with zero failures and 105
  named fixture/process-gated skips. PostgreSQL 13.23 integration, exact-package
  full-router checks and exact-package Agent/Manager desktop/mobile browser
  checks passed. The corrected record page uses a neutral transparent `SECTION`
  heading with standard CORE ink; exact-package screenshots and assertions cover
  the record itself for Agent and Manager on desktop and mobile, and confirm no
  conflicting `header` element in the record, edit, conversion or override
  surfaces. Full evidence is in
  `release-artifacts/dev269-preparation/DEV269_D2_APPROVAL_PACKET.md`.
- Next authorization requested is artifact placement plus one non-mutating CRM
  Test Phase A only. Phases B, C, D, production and any configuration change
  remain separately controlled. A fresh scoped Phase B backup does not yet
  exist. The canonical operator/worker controls in `AGENTS.md` and
  `CRM_CHANGE_POLICY.md` remain mandatory.

## DEV268 accepted / DEV269 D-1 — 11 November 2026

- CRM Test serves accepted DEV268 `2.1.0-dev.268`, commit
  `b6272e9c9f2a17a2c082324ec8810391de7bdf01`, database
  `nysareal_nysa_dev247_smoke`, migration 170, 306 public tables and 111
  enabled triggers across 95 tables. The canonical schema manifest remains
  `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`;
  the trigger-contract file remains
  `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`.
- All four separately approved DEV267 and DEV268 phases passed. DEV268 Phase D
  receipt SHA-256 is
  `b196a7a0c38bab0d83eeb9ee906f58b77ac70861ecf012c7ca56f7c1580cc6f0`;
  it records green readiness and exactly one command/CWD-verified worker. The
  combined acceptance record and script-generated receipt index are under
  `release-artifacts/dev267a-preparation/`.
- Ajit separately performed authenticated Prospect Diary and manual-DNCR
  browser UAT on 11 November and reported it passed. Remaining visual/workflow
  defects move to DEV269, including the non-standard dark Prospect Diary
  banner, near-invisible prospect name, stale Today/Upcoming tiles, DNCR refresh,
  warning wording/reasons and duplicate action wording.
- DEV269 starts at D-1 from the exact deployed DEV268 candidate. No DEV269
  runtime implementation, package, upload or hosted change is authorized yet.
  Production, website and REM remain unchanged.

## DEV267 deployed / DEV267a (technical DEV268) D-2 preparation — 11 November 2026

- CRM Test currently serves deployed-but-not-accepted DEV267
  `2.1.0-dev.267`, commit
  `d9133a980390fe375af36ef415b84e2f4f4fda4e`, database
  `nysareal_nysa_dev247_smoke`, migration 170, 306 public tables and 111
  enabled triggers across 95 tables. The accepted Phase D receipt is
  `release-artifacts/dev267-preparation/run2/evidence/SMOKE_RESULT.json`
  (SHA-256
  `0e5e142b0affd1e5aab08125bf0bdd8d2461d6100b765eabb1a78d0e0469b74f`)
  and records green readiness plus one command/CWD-verified exact-root worker.
  This evidence supersedes the older DEV266/D-1-hold section below.
- Live review found a deterministic hosted-bootstrap defect: `app.js` replaces
  the Prospect Diary feature export and recurses. DEV267a corrects that global
  collision, validates malformed company-calling-number identifiers before the
  PostgreSQL query, and adds the approved Manager/Director manual-DNCR evidence
  controls in Prospect Diary and the WhatsApp suppression workspace.
- The release tooling requires a numeric development version, so DEV267a is
  represented technically as `2.1.0-dev.268`. It is migration-neutral: expected
  state stays 170 migrations, 306 tables and 111 triggers. The baseline schema
  folder is byte-identical to the accepted DEV267 canonical schema manifest
  `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`;
  the trigger file is
  `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`.
- This is local build and D-2 preparation only. No DEV267a package has been
  uploaded and no hosted file, database, selector, worker, configuration,
  provider or production state is authorized to change. Any later deployment
  must use the unchanged canonical operator, four separate approvals, a fresh
  scoped backup, full contract checks and exact-root worker verification under
  `AGENTS.md` and `CRM_CHANGE_POLICY.md`.

## DEV266 accepted / DEV267 D-1 hold — 10 November 2026

- Installed CRM Test source of truth is accepted DEV266 `2.1.0-dev.266`, commit
  `1abd17771a5dda3be4b5108a6453e70438ad3ed0`, migration 169, database
  `nysareal_nysa_dev247_smoke`, 303 public tables, 108 enabled triggers and one
  exact-root worker after readiness. The governed acceptance record is
  `release-artifacts/dev266-preparation/DEV266_ACCEPTANCE.md` at commit
  `85cfb0f7b18597e03120c41ece911a0ed3bd914b`.
- DEV266 round-two testing found D-A: an existing STOP suppression is not read
  when a later WhatsApp recipient import creates a new row. D-A blocks go-live
  and is now mandatory DEV267 scope with Prospect Diary and one shared contact
  suppression store/reader. The synthetic CRM Test D-A records remain in place
  for reproduction and retest.
- DEV267 is stopped at revised checkpoint D-1. The design is
  `release-artifacts/dev267-preparation/DEV267_D1_PROSPECT_DIARY_SHARED_SUPPRESSION_DESIGN.md`.
  No DEV267 package, upload, hosted query, Phase A or hosted mutation is
  authorized. The partial worktree implementation predates the addendum and is
  not release evidence.
- Earlier local PostgreSQL 13.23 and browser passes cover only the superseded
  Prospect-only draft. They do not cover D-A, the shared suppression reader,
  normal My Tasks/My Diary integration, purchased-data provenance, calling
  controls or the final migration 170 contract.
- DEV268 is deferred until DEV267 is accepted. Its scope is campaign retirement,
  local reply-lock pill formatting, consistent out-of-scope 404 responses and
  removal of material `storageKey` from list responses. Intermittent Chrome
  Admin login drops remain a watch item.
- Any later CRM Test deployment must use the mandatory detached-origin package,
  full schema/trigger contracts, canonical operator, four separately approved
  phases and exact-root worker verification. Production remains the separately
  governed RC1 baseline and requires its own reconciliation, backup, package
  and exact approval.

## DEV265 accepted CRM Test baseline — 9 November 2026

- CRM Test is accepted on `2.1.0-dev.265`, candidate commit
  `ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`, migration 169 and 303 public
  tables. The database is ready and the complete canonical schema contract
  matches after restoration of 975 foreign keys, 18 primary keys, 15 unique
  constraints and 404 indexes. The governed trigger contract remains 108
  enabled triggers across 93 tables.
- Migration 169 deleted exactly the 12 synthetic UAT264 simulator messages and
  five synthetic UAT264 notifications approved for cleanup, wrote its governed
  audit evidence, restored the contract in one transaction and verified the
  final state. No customer/business record was removed.
- All four separately approved hosted phases passed. Phase D completed with
  eight expected HTTP results, database readiness green and exactly one
  command/CWD-verified worker for
  `/home/nysareal/nysa-core-dashboard-dd6262a-stage`. The mandatory worker and
  hosted-deployment controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` remain
  acceptance criteria for every later release.
- The verified scoped rollback point is
  `/home/nysareal/crm-release-preparation/20261106-dev265-run2/scoped-backup-dev265-phased-run2-d7a5a34`.
  Application archive SHA-256 is
  `706b529aa96449334e323c14d6580aedfbc86fef19e3a29cca3d79d0c38e05b2`;
  database dump SHA-256 is
  `a99fbaa179acf3ea68410c1ffa85a204e84fee7213990e2d094189ae4544a533`.
  The dump verified all 303 table names and 108 triggers. No database restore
  was run.
- Ajit accepted E2E E-1 through E-4. E-3a passed through the separately
  approved corrected rollback-only fixture with SQLSTATE 23503 on
  `tasks_lead_id_fkey`; all database E2E scripts ended in `ROLLBACK`.
- Acceptance evidence and script-generated receipt hashes are recorded in
  `release-artifacts/dev265-preparation/DEV265_ACCEPTANCE.md` and
  `DEV265_ACCEPTANCE_RECEIPT_HASHES.json`.
- Known limitations remain open: operator receipt schema summaries omit
  expected/observed object counts even though the full contract reports
  `matches: true`; two Offer integration-test defects are proven pre-existing;
  and D-01 through D-12, WN-01 through WN-16 and WL-01 through WL-05 remain
  deferred.
- Production, website, REM, Meta, 360dialog and live messaging were unchanged.
  This acceptance does not authorize another CRM Test or production operation.

## DEV264 accepted CRM Test baseline — 5 November 2026

- CRM Test is accepted on `2.1.0-dev.264`, commit
  `8d9be904149bec1b9b6d56dd8a39f17c2789fd12`, migration 168 and 303 public
  tables. The governed contract is restored to 108 enabled triggers across 93
  tables. The simulator is paused with fault mode `none`. Production, website,
  REM, Meta, 360dialog and live messaging remain unchanged.
- Acceptance evidence records Layer 1 passing; Layer 2 passing for all rules
  with suitable data; Layer 3 WhatsApp simulator UAT W-01 through W-15 passing;
  and Layer 4 passing in its approved reduced scope. Deferred and not-exercised
  cases remain explicitly deferred/not exercised. See
  `release-artifacts/dev264-preparation/DEV264_ACCEPTANCE.md`.
- Known limitation tracked as DEV265: CRM Test remains missing 975 foreign
  keys, 18 primary keys, 15 unique constraints and 404 indexes. A read-only
  compatibility scan found only 17 orphan UAT264 simulator rows (12 messages
  and 5 notifications) and no duplicate/NULL-key issue for the missing primary
  or unique constraints. DEV264 acceptance does not authorise repair. See
  `release-artifacts/dev264-preparation/schema-drift/STEP6_SCHEMA_DRIFT_REPORT.md`.
- The failed plain simulated inbound reached the Lead insert and PostgreSQL
  rejected a null `lead_reference` (`23502`) because
  `leads_assign_reference` was absent. Read-only reconciliation then found that
  every user trigger was absent, while the trigger functions, tables and the
  migration ledger remained present. This is database-wide schema drift rather
  than a simulator-only defect.
- The exact final contract generated from migrations 001-167 is 108 enabled
  triggers across 93 tables. Its canonical SHA-256 is
  `a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073`.
  The governed catalogue records table, trigger, function, timing/events and
  source migration for every entry.
- Retained evidence bounds the loss between the 108-trigger backup captured
  1 November 2026 at 21:51:12 Dubai time and the first known zero-trigger
  scoped backup captured 2 November 2026 at 02:35:36 Dubai time. The exact
  mutating command was not retained. The uniform loss of post-data trigger
  objects while functions and tables survived is consistent with a restore or
  schema rebuild that omitted trigger entries; this remains an evidence-based
  inference, not a claim that a specific unrecorded command has been proven.
- Read-only pre-recovery checks found zero exceptions across 15 governed-data
  checks covering Lead transitions/follow-ups, booking expiry evidence,
  bilateral acceptance, commission/payout overlap and slabs, and leave/task
  approval rules. A follow-up live reconciliation corrected an earlier
  transcription error: the October Lead counter is 209, not 2,091. It exactly
  matches 209 retained October references (sequence 1 through 209), so there is
  no counter gap to explain. All 45 distinct functions required by the 108
  final triggers are present. The bounded drift window contains no retained
  audit-log entry and no row carrying a creation/edit/update/recorded timestamp;
  this is evidence of no recorded activity, not proof against an undetectable
  mutation that left no durable timestamp or was later removed.
- DEV264 adds forward migration 168. It raises counters only when necessary,
  recreates all 108 triggers from their final definitions, does not replace any
  trigger function (including the migration-061 Lead-reference function), is
  idempotent, and fails if the resulting exact trigger contract differs.
- The canonical four-phase CRM Test operator was extended to block stage,
  backup and install when the live trigger contract, the 15 governed-data
  checks or Lead counters differ from the approved baseline. It also verifies
  trigger entries in the scoped PostgreSQL dump and the complete post-migration
  contract. All hosted-worker and deployment controls in `AGENTS.md` and
  `CRM_CHANGE_POLICY.md` remain mandatory. DEV264 completed its four separately
  approved phases; no later hosted run is authorised by this acceptance.
- Local verification rebuilt all 168 migrations as the restricted fixture role,
  reproduced zero triggers, restored the full contract twice, passed plain
  inbound/stage/follow-up behavior and passed the complete simulator flow with
  loopback unavailable. The governed release suite ran 1,652 tests: 1,556
  passed, 96 were intentionally fixture-gated and zero failed. Its 307-file
  selection hash is
  `da9473dc9fb79bcbf57b9f9b8976637dd3567e0a2835b3eedf1e6cebe8d0da83`.

## DEV263 in-process WhatsApp simulator correction — 4 November 2026

- Target is CRM Test only. Installed baseline is DEV262 with migration 166 and
  303 tables. Production, website, REM, Meta, 360dialog, live WhatsApp
  credentials and live messaging are unchanged and outside this correction.
- Read-only inspection of the CRM Test application error log confirmed that the
  failed simulated template submission and simulated inbound request both ended
  in `TypeError: fetch failed`, caused by `ECONNREFUSED 127.0.0.1:3000`. The
  application was trying to call its own simulator route over a loopback HTTP
  port that LiteSpeed/lsnode does not expose to the worker.
- DEV263 removes that internal network dependency. Workspace, campaign and
  administrative simulator actions call the same isolated simulator service in
  process. The authenticated HTTP simulator boundary remains available for
  explicit test harness calls; its scope, token and synthetic-recipient guards
  are unchanged. Live-provider code is not relaxed or reused.
- The correction also aligns synthetic CTWA source data with the migration-165
  `ctwa` constraint and gives simulator failures a persistent, accessible UI
  alert instead of relying only on a transient toast.
- Full local flow verification with the configured loopback port deliberately
  unreachable found that the application accepted the `invalid_number` fault
  but migration 166's check constraint did not. DEV263 therefore adds forward
  migration 167 to align the persisted fault whitelist; it adds no table or
  column. The same verification covers approved/rejected/pending templates,
  CTWA/button/media inbound, success and failure callbacks, frozen campaign
  recipients, all six fault presentations, 23/25/71/73-hour windows and both
  run-specific and global cleanup.
- Rollback is application-only to DEV262; the database must not be
  automatically restored. Any hosted release must use the approved canonical
  four-phase operator (stage, backup, install, smoke), with separate approval
  for each phase and the mandatory exact-root worker checks. Deployment must
  expect migration 167 after install while preserving the 303-table baseline.

## DEV262 phased CRM Test operator preparation — 4 November 2026

- Scope is local, version-controlled deployment-tool preparation only. No CRM
  Test, production, website, REM, Meta or 360dialog hosting state may change
  until the exact operator commit and SHA-256 receive separate approval.
- The canonical operator is being changed from one combined transaction to
  four separate commands and approvals: stage/package verification, scoped
  backup verification, quiesce/install/simulator-environment/start, and settled
  smoke/report. Each phase writes a commit-, version- and config-bound receipt
  required by the next phase. The smoke phase is read-only, retries within a
  configured 30-60 second total window and records every response.
- Before readiness acceptance, an install/start failure may automatically
  restore only the prior application files and original CloudLinux selector
  environment. It must not run `pg_restore` or otherwise change the database;
  database restoration remains a separate explicitly approved action. After
  readiness is green with one verified worker, later table/runtime/worker
  failures preserve the running candidate and evidence and stop/report.
  Application rollback acceptance still requires health/readiness for the
  baseline version, `/` visibly serving NYSA CORE and exactly one
  command/CWD-verified exact-root worker. Failure of any acceptance check ends
  in a report requiring attention with no further automatic fix.
- Migration 166 currently grants its simulated-provider tables to the CRM Test
  role `nysareal_nysar2app`. Production uses `nysareal_nysacrmapp`. Every future
  production release containing migration 166 must render and verify that role
  mapping explicitly, record original/rendered migration hashes and refuse the
  raw CRM Test grant. This is a mandatory production-release approval item, not
  part of CRM Test workflow behavior.
- A read-only live reconciliation on 4 November 2026 confirmed that CRM Test is
  already at migration 166 with 303 public tables. The ordered table-name list
  has SHA-256
  `69e336181d98d9965ac6916b032a6bdb1496951917ecf912831f769738dbfeec`.
  DEV262 therefore uses 166/303 as both its pre-install and post-install
  expectation. Application startup still invokes the standard migration runner,
  which skips migration 166 because that version is already recorded; no new
  migration is expected to run.

## DEV262 CRM Test simulated WhatsApp provider — 3 November 2026

- Authorized scope is source implementation and synthetic verification of the
  attached CRM Test WhatsApp-provider-stub specification. Target release is
  `2.1.0-dev.262`; branch `codex/dev262-whatsapp-provider-stub`; reproducible
  source/rollback point is GitHub-advertised commit
  `4905e89d1812391bdd8cc80a5fc2a51cae7efbf6`. No hosted deployment,
  configuration activation or external connector operation is authorized by
  this development request.
- Installed CRM Test baseline is DEV261. Production, website, REM, Meta,
  360dialog, live numbers, live API keys, AI and calling remain outside scope
  and must not be changed. Authenticated DEV261 browser acceptance is a
  separate deployment close-out item; this source work does not rewrite that
  evidence.
- DEV262 is default-off and startup must fail closed if simulation is enabled
  anywhere except `LEAD_RESPONSE_ENVIRONMENT=crm-test`, if the provider URL is
  not the exact loopback stub route, or if live WhatsApp credentials coexist.
  The initial bounded synthetic range is `+971509000000` through
  `+971509999999`. Simulator controls and load-run cleanup are Administrator
  only; existing Agent/Manager/Director workspace ownership remains unchanged.
- DEV262 adds migration 166. All simulated conversations, messages, provider
  events and load runs are explicitly marked and filterable; payload evidence
  is stored as hashes, not customer content. The local provider supports
  template outcomes, message identifiers, sent/delivered/read/failed events,
  inbound text/media/button shapes, CTWA markers, opt-out processing,
  idempotent replay, 23/25/71/73-hour window tests, controlled provider faults,
  repeatable load generation and one-run cleanup.
- Before any later CRM Test deployment: commit and advertise the exact source
  through GitHub origin, package only with the mandatory detached-origin
  builder, verify package provenance, use the versioned direct-node operator
  from outside the app root, take and verify the scoped app/database rollback
  set in the same run, and require readiness plus exactly one verified
  exact-root worker. Any external network dependency or non-synthetic recipient
  fails acceptance.

## DEV261 WhatsApp workspace runtime blocker — 2 November 2026

- Target is CRM Test only. The user reports DEV260 `2.1.0-dev.260` is
  installed and its technical deployment checks passed. Production, website,
  REM, Meta/360dialog configuration and WhatsApp sending remain unchanged.
- DEV260 removed the earlier feature-bundle load-order error, but opening the
  workspace then raised `ReferenceError: recipientForm is not defined` from
  `public/whatsapp-workspace-ui.js`. The correction is one local declaration
  bound to the existing `#wa-recipient-form`; no workflow, API, schema,
  permission, provider or data behavior changes.
- A pinned ESLint `no-undef` scan of the entire release file found seven
  references to one undeclared name (`recipientForm`) before the correction.
  The same scan completes with zero errors after the correction.
- The new release test launches real Chrome as a synthetic Sales Agent, loads
  the tracked `public/whatsapp-workspace-ui.js` file, records its SHA-256 and
  opens Template library, Recipient import, Segments, Campaign composer,
  Conversation inbox and Materials catalogue. All six passed with zero page
  errors and zero console errors. The test is included in the governed release
  selection and is not skipped.
- Governed source regression: 1,543 passed, 96 intentionally skipped, zero
  failed; selection SHA-256
  `d596b26bf4db38667f0373fe4903c1e3b0f7a13d5bb0c99de2e838d0da8e08e8`.
  The exact browser evidence is retained under
  `release-artifacts/dev261-preparation/browser-evidence`.
- The direct-node deployment operator and its policy controls were committed
  and advertised first in GitHub commit
  `885a76b7baabf4112bfccf221b8fe51e56818a8b`. The operator accepts the backup path and freshness/time limits as
  inputs, performs stage then deploy once, never edits installed
  `package.json`, verifies the exact-root worker before and after readiness,
  and permits only exact DEV260 cleanup files after DEV261 is healthy.
- The versioned direct-node operator creates a scoped CRM Test rollback set in
  the same bounded run: one exact app-root archive plus a database-only dump of
  `nysareal_nysa_dev247_smoke`. It verifies size, SHA-256 and contents before
  mutation, including `pg_restore --list` readability, an exact 299-table
  live-versus-dump reconciliation, and `pg_dump`/`pg_restore` client-major
  compatibility with the live PostgreSQL server before backup begins. Database
  credentials remain in the existing registered environment and are never
  command arguments or log output. Its
  failure path restores only those two Test targets. It does
  not request or rename a full-account cPanel backup; those are reserved for
  production or scheduled weekly protection.
- DEV261 remains a pre-approval source candidate. It must be committed and
  advertised by GitHub origin, packaged only by the mandatory detached-origin
  builder, provenance-verified, and presented with exact hashes and a fresh
  backup plan before any CRM Test mutation.

## DEV260 WhatsApp workspace loader blocker - 1 November 2026

- Target environment: CRM Test only. Installed rollback point is verified
  DEV259a `2.1.0-dev.259`, GitHub commit
  `e7dc3728d38d719287afbc330507cdea232d962a`, migration 165, package SHA-256
  `4bd9794001b05a19926489d503e87b4b17fbae9ad3e6da01da829c17c8396623`.
- QA reproduced a deterministic browser-load failure before any WhatsApp API
  call: `ReferenceError: esc is not defined` in
  `public/whatsapp-workspace-ui.js`. Bootstrap loads independent feature
  bundles before `app.js`; the WhatsApp bundle evaluated `safe()` immediately
  while depending on the later lexical `app.js` helper.
- Authorized correction is limited to making the WhatsApp feature bundle's
  HTML escaping self-contained and adding a load-order regression test. BUG-02
  through BUG-06, dashboard/task/intake business logic, workflows, schemas,
  provider configuration and all external systems are outside this correction.
- No migration is required. Production, website, REM, provider configuration
  and WhatsApp sending remain unchanged. A new GitHub-advertised exact
  candidate, mandatory origin package verification, fresh paired CRM Test
  rollback evidence and exact-candidate approval are required before deployment.
- Pre-deployment verification completed against the corrected source: focused
  loader/domain checks passed 7/7; governed release regression passed 1,541
  with 96 skipped and zero failures; the synthetic browser check rendered all
  six WhatsApp sections, exposed no send action and had no horizontal overflow
  at 1280, 768 or 390 pixels. These results do not authorize deployment.

## WA-001 DEV259a review-correction baseline - 1 November 2026

- The user confirmed that simulated calling remains a separate DEV259b release.
  CAL01-CAL04 and the five first-screen call placements are therefore excluded
  from DEV259a and remain mandatory for the later, separately tested candidate.
- DEV259a correction work starts from clean, GitHub-advertised commit
  `5d999da9f7767029134abecf841d1b15806c3303` on branch
  `codex/wa001-dev259a`. CRM Test still serves `2.1.0-dev.258`; production,
  website, REM, provider configuration and WhatsApp sending remain unchanged.
- The earlier DEV259a archive SHA-256
  `e1ca1cc7b707d70979e07d9ea5862b8800a0ce8e08d73bbf1fa2662ff1667d60`
  is superseded for acceptance and must not be deployed. It remains retained as
  source/release evidence only.
- Revised DEV259a scope implements Addendum 2 sections A and C plus B2-B8:
  distinct Website and CTWA sources; audited Manager/Director self-approval;
  mandatory marketing opt-out action and cross-list suppression foundation;
  mapped CSV/XLSX imports with exact reconciliation/error output; expanded
  unique-phone segments; recipient preview, schedule, budget and immutable
  campaign approval snapshots; Lead-linked inbox ownership controls; governed
  retention; and the remaining Meta-template preflight checks. Provider
  submission, sending, connected inbound/replies, AI and real calls remain off.
- Before any CRM Test installation, the corrected candidate requires migration
  execution in an isolated PostgreSQL fixture, authenticated role/lifecycle
  checks, governed regression, a new GitHub-advertised commit, mandatory
  origin-only packaging and verification, fresh paired rollback evidence and
  exact-candidate approval.
- The complete 001-165 migration chain now passes in a restricted synthetic
  PostgreSQL fixture (non-superuser, no database/role creation rights). The
  authenticated DEV259a lifecycle also passes, including team scoping,
  recipient reconciliation, unique-phone preview and immutable campaign
  approval snapshot. CRM Test and all external systems remain unchanged.
- Governed origin-candidate regression after the review corrections: 1,540
  passed, 96 intentionally fixture-gated skips and zero failures. The first
  restricted run produced only expected loopback-denied failures plus one
  superseded independent-review assertion; the approved Manager/Director
  self-approval rule was asserted and the permitted loopback rerun passed.

## WA-001 DEV259a approved implementation extension — 1 November 2026

- Reproducible source rollback point: clean, GitHub-advertised team-scope
  correction commit `d7b34a3cab372bfcfa8b0fc4c7ccb57383f7c862` on branch
  `codex/wa001-stage-b-foundation`.
  Development is isolated on `codex/wa001-dev259a`; the target is CRM Test
  only. No hosted application, database, configuration, WhatsApp provider,
  website, REM or production state is changed by this source work.
- Approved extension: Meta-normalized template names; separate Internal and
  Meta statuses; Manager/Director creator auto-approval (Meta remains Not
  submitted); CSV and explicit-`Recipients`-sheet XLSX imports; maintained
  source/provenance and consent values; purchased-list evidence without an
  automatic marketing exclusion; reusable segments; draft-only campaigns;
  materials; opt-out/suppression foundations; and the owner-scoped
  conversation inbox with separate 24-hour reply and 72-hour CTWA pricing
  indicators plus Manager/Director assignment controls.
- Candidate remains `2.1.0-dev.259` and adds migration
  `164_whatsapp_dev259a_workspaces.sql`. It adds no send endpoint, provider
  submission, automated follow-up, AI response, live-number dependency or
  calling workflow. Conversation-message records have a 12-month retention
  field; actual connected-number ingestion remains a separately approved
  release.
- Source acceptance completed so far: focused WhatsApp checks pass, the
  generated XLSX contract parses successfully and the governed release suite
  passes 1,539 with 96 intentional fixture-gated skips and zero failures. A
  local PostgreSQL fixture is not listening in this worktree, so migration 164
  execution and authenticated database lifecycle verification remain mandatory
  before CRM Test installation. Exact origin packaging, provenance, fresh
  rollback backup and exact-candidate approval also remain mandatory.

## WA-001 DEV259 team-scope correction — 1 November 2026

- Source rollback point: clean, GitHub-advertised DEV259 commit
  `39a34eae789d217aa34f72c93de7c9e0e8825923` on branch
  `codex/wa001-stage-b-foundation`; CRM Test remains installed at DEV258 and
  production, website, REM and provider configuration remain unchanged.
- Live review found that the template Team selector can be empty for a valid
  Agent whose current team is recorded through `team_memberships` or
  `user_role_assignments` rather than the legacy `brokers.team_id` column.
- Authorized correction is limited to resolving WhatsApp-workspace team scope
  from current active CORE team assignments and preselecting a sole eligible
  team. It must retain the same role boundaries and add no provider submission,
  message sending, workflow or external-system change.

## WA-001 Template Library components — 1 November 2026

- Source and hosted rollback point: clean GitHub-advertised DEV258 commit
  `2e1a47e97224a376ab34afda5bd54b1288b4e4c7` on branch
  `codex/wa001-stage-b-foundation`; CRM Test is installed at
  `2.1.0-dev.258`, migration 162. Production, website, REM and provider
  configuration are unchanged.
- Authorized scope is limited to the Template Library and its supporting
  Materials catalogue: governed text/image/video/document headers, provider
  size/type checks, quick-reply and URL buttons, per-variable approval
  examples, provider-valid template names, header/body/footer counters and a
  live WhatsApp-style preview. No send or Meta-submission capability is added.
- Proposed candidate is `2.1.0-dev.259` with additive migration 163. New and
  edited templates use lowercase letters, numbers and underscores in their
  names; URL buttons require HTTPS, allow at most two URLs and allow one
  dynamic `{{1}}` only at the end. Header material remains private and
  team-scoped.
- Local acceptance completed: 13 focused domain/media checks passed; the
  governed release suite passed 1,536 with 96 intentional skips and zero
  failures; synthetic browser interactions and responsive layout passed at
  1280, 768 and 390 pixels. Migration execution, authenticated lifecycle UAT,
  package provenance, a fresh paired rollback backup and exact-candidate
  approval remain mandatory before CRM Test installation.

## WA-001 Stage B number-independent workspaces — 1 November 2026

- Source rollback point: clean GitHub-advertised commit
  `038c37fb0cd5e4a5ed4ec89b029ad06d20c30cf8` on branch
  `codex/wa001-stage-b-foundation`. Target environment is CRM Test only; it
  remains installed at `2.1.0-dev.257`, origin commit
  `b4a12928aa3678757d5c725a7f1d3861707c9c9c`, migration 160.
- Authorized source scope: number-independent WhatsApp workspaces for template
  drafts/versions/internal approval, Manager/Director review, recipient import,
  governed segments, draft-only campaign composition and a materials catalogue.
  Meta status must remain `Not submitted` until the test number is connected.
- Acceptance boundary: no send endpoint, send control, provider submission or
  live-number dependency; Agents may prepare drafts and their in-scope Manager
  or a Director may review them. Production, website, REM and the live number
  remain unchanged.
- Connected-number Stage B, after separate approval, includes CORE submission of
  internally approved templates through the 360dialog Templates API, status
  synchronization back from API/webhook evidence, and Agent manual replies from
  the CORE inbox. Free-form replies are limited to an active 24-hour customer
  service window; outside it, only a currently Meta-approved template may be
  used. Automated follow-ups and AI conversation remain Stage C.
- Proposed candidate is `2.1.0-dev.258` with migration 162. Development uses
  synthetic data only. Before any CRM Test installation: complete focused and
  governed regression, advertise the exact commit through GitHub, package only
  with the mandatory origin builder, verify provenance, refresh the paired
  rollback backup and obtain exact-candidate approval.
- Local acceptance is complete: migrations 001-162 passed in a clean isolated
  restricted-role PostgreSQL fixture; the authenticated Agent/Manager/Director
  workspace lifecycle passed; 12 focused domain tests passed; responsive
  browser checks passed at 1280, 768 and 390 pixels; and the governed release
  regression passed 1,534 with 96 intentional skips and zero failures. The
  candidate has not been committed, packaged, approved or deployed yet.

## WA-001 Stage B decision-independent foundation — 1 November 2026

- Source baseline: repository HEAD `0d8ce08a7d9c1143d6e0f931196e5f43a65beaa9`
  on branch `codex/dev256-sandbox-callback-fix`; installed CRM Test remains
  `2.1.0-dev.257` from origin commit
  `b4a12928aa3678757d5c725a7f1d3861707c9c9c`, migration 160. The working
  tree contained only the Stage A close-out evidence changes listed by Git.
- Authorized development scope: a one-page decision addendum plus isolated
  Stage B source work for recipient import and duplicate handling, reusable
  audience segments, 360dialog template catalogue synchronization, and an
  Agent-draft / Manager-or-Director-approval campaign flow. Stage B also covers
  CTWA ads, the website button and portal enquiries that create or match a Lead,
  preserve source attribution and route to an Agent. This increment must remain
  draft-only and must not dispatch provider messages.
- The Stage B test connection will use the Meta-provided virtual number under
  `Nysa Realty Test`, pending Meta verification; the approved test customer is
  `056 106 6469`. The 23-27 November canary is subject to that verification.
- Open activation decisions remain external to this increment: opt-in sources
  and evidence, sending hours/frequency/spend/Meta-tier limits, languages and AI
  provider. Stage A flags are false and sending remains disabled. CRM Test
  review deployments are planned every 2-3 days, subject to exact-candidate
  approval. Existing CRM workflows, production, website, REM, live number and
  provider configuration remain unchanged.
- Development rollback is the source baseline above. The hosted rollback point
  remains the verified DEV257 recovery set and exact-root worker evidence from
  Stage A. A fresh paired backup, GitHub-origin package and exact candidate
  approval are required before any CRM Test deployment.
- Increment 1 verification completed locally: focused Stage B domain tests 7/7;
  full governed regression 1,529 passed, 95 intentionally skipped, zero failed;
  migrations 001-161 passed in a clean isolated PostgreSQL fixture with 295
  public tables and 11 WhatsApp tables; and the Stage A durable PostgreSQL test
  passed 9/9. No hosted environment or provider configuration was changed.

## WA-001 Stage A sandbox outbound acceptance — 1 November 2026

- CRM Test DEV257 only. The user approved temporary sandbox callback and send
  activation with a local request budget of five and a single fixed test
  recipient. Production, the live receiver, REM and the website were excluded.
- One 360dialog predefined sandbox template and one verified-conversation text
  reply were each submitted once. Both were accepted and reached final `read`
  status; no retry occurred. Two of five local request reservations were used.
- The sandbox predefined template contains 360dialog test disclaimer/privacy
  wording. It is not an NYSA template and is not suitable for production. The
  live rollout must use NYSA-branded templates approved in Meta/WhatsApp Manager.
- The approved phone then sent `STOP`. CORE durably recorded one opt-out and
  automatically paused sandbox sending. The protected Admin screen reports two
  accepted/read attempts, one opt-out, one verified reply and three unused local
  reservations.
- Pre-close hosted verification at `2026-11-01T08:40:13.220Z` confirmed DEV257
  origin `b4a12928aa3678757d5c725a7f1d3861707c9c9c`, green database readiness,
  exactly one exact-root command/cwd-verified worker (`1244645`), two attempts,
  one verified inbound reply and paused connection state. Following explicit
  close-out approval, both sandbox activation flags were returned to false and
  the non-active request budget to ten. The controlled restart completed at
  `2026-11-01T08:41:00.167Z`; database readiness was green and exactly one
  exact-root worker (`1373531`) served readiness. The connection remains paused,
  the opt-out and audit evidence remain recorded, and production/main/REM/website
  are unchanged.

## DEV257 dual-identity correction baseline — 1 November 2026

- Target CRM Test only, installed DEV256 origin e9af2be, migrations160,
  source evidence7f9e8a8. Runtime459 hashes and worker345949 were verified.
  Safe hosted audit establishes callback_rejected/alternate_identity at
  2026-11-01T07:54:40.507Z after successful secret-path authentication.
- Private comparison confirms saved kind phone, approved test phone matches,
  connection paused and sending false. No phone normalization change needed.
- Narrow correction: accept a valid accompanying BSUID only when the exact
  approved phone is present; retain both within encrypted event evidence.
  Add safe recipient/empty/invalid-JSON diagnostics after authentication only.
  Live receiver and other JSON endpoints retain their existing behavior.
- Existing DEV255 recovery retained; refresh paired DEV256 recovery and verify
  encrypted off-server copy before installing a GitHub-built DEV257 package.
  Production/main/REM/website remain unchanged.
- DEV257 origin commit `b4a12928aa3678757d5c725a7f1d3861707c9c9c`
  was installed on CRM Test after the fresh DEV256 rollback pair authenticated
  all seven components in memory and was retained encrypted in the approved
  recovery folder. Installation verification completed at
  `2026-11-01T08:23:48.037Z`: all 459 runtime hashes, ten PDF formats, database
  readiness, migration ledger 160 and all 282 preserved original tables passed;
  exactly one exact-root command/cwd-verified worker (`999701`) served readiness.
  Sending and callback-activation flags remain false. The real post-fix inbound
  message was accepted: the protected Admin status showed `Authenticated callback
  observed` with one verified reply event after the user sent the DEV257 test.
  Production/main/REM/website are unchanged.

## DEV256 sandbox callback correction installed — 1 November 2026

- CRM Test serves `2.1.0-dev.256`, origin commit
  `e9af2be51e1925a9763986419eb54ffb253f5ea7`, pinned by GitHub tag
  `crm-test/dev256-candidate`. Installation completed 07:52:34 UTC; verification
  completed 07:53:08 UTC. All459 runtime hashes, ten PDF formats, database
  readiness and exactly one command/cwd-verified worker345949 passed. All282
  original non-ledger tables retained their values; migration count stays160.
- Fresh DEV255 rollback set `20261101-wa256/test-20261101T070834378Z` was
  authenticated off-server at07:50:54 UTC, all7 components verified in memory,
  no local plaintext. Encrypted copy retained in the approved recovery folder
  `20261031-dev251-preparation/test-dev256`. Worker3651688 stopped only after
  exact-root command/cwd verification. Runtime rollback retained on hosting.
- Separate sandbox secret-path receiver and URL-only provider configuration
  installed. 360dialog accepted reconfiguration; actual inbound receipt remains
  pending the user's repeated test. Do not claim the HTTP400 resolved until that
  authenticated durable receipt is observed. Sending remains paused, both
  outbound activation flags false. Live receiver, production/main/website/REM
  unchanged.

## Sandbox HTTP400 correction — 1 November 2026

- User authorizes diagnosis, narrow fix, regression and GitHub deployment to CRM
  Test; sending must remain paused. Source baseline2616e89, installed DEV255
  c4a6a04de892e50cf933ecb1821f202576b76e8d, migration160. Original verified rollback
  retained; fresh paired encrypted recovery required for the next installation.
- Provider configuration accepted. User test reached the exact callback at
  06:59:57 UTC and received HTTP400 with33-byte JSON response. No authenticated
  event persisted. This alone does not prove the rejected field. Add bounded
  static rejection-reason diagnostics only after authentication, then reproduce;
  never relax authentication or identity checks to obtain a successful response.

## DEV255 approved CRM Test installation — 1 November 2026

- Exact user-approved origin commit `c4a6a04de892e50cf933ecb1821f202576b76e8d`
  is installed on CRM Test, version `2.1.0-dev.255`, migration160. All459 runtime
  files verified;11 files changed. All278 original non-ledger tables preserved.
  Ten PDF formats and HTTP authentication boundaries passed. Readiness green,
  exactly one command/cwd-verified worker3210021 at06:49:55 UTC.
- Fresh paired rollback is the private `20261101-wa255/test-20261101T063433359Z`
  set. Its encrypted off-server copy authenticated all7 components in memory in
  approved `NYSA-Recovery/20261031-dev251-preparation/test-dev255`. No plaintext
  backup downloaded. Browser download authority failed; user downloaded the
  encrypted files manually. DEV254 was temporarily restored while awaiting it,
  then safely quiesced again for the approved installation.
- Sandbox setup and authenticated receive-only probe enabled; sending and
  callback approval remain false. New private encryption key created on hosting;
  encrypted key-recovery file authenticated off-server and protected with Windows
  DPAPI CurrentUser; no plaintext written. No provider key
  entered or real provider connectivity claimed. Admin live screen acceptance
  passed: empty private fields, paused/not configured status and live refresh.
  Production/main/website/REM remain unchanged. See
  `release-artifacts/dev255-preparation/DEPLOYMENT_VERIFIED.json`.

## DEV255 sandbox foundation preparation — 1 November 2026

- Continuing the approved WA-001 v1.1 implementation, with costs and timelines
  excluded. Candidate version DEV255 extends the isolated foundation with
  protected Admin setup, durable send/event/audit storage and a locked callback
  probe. See `docs/change-requests/NYSA-CRM-20261101-WA-001/DEV255_SANDBOX_READINESS.md`.
- Migration160 has been applied only to a newly created local synthetic fixture;
  all160 migrations built successfully under a restricted role. Existing hosted
  Test remains DEV254/migration159 and production RC1/migration140, unchanged.
- Exact source rollback is DEV254 `42b25cb4d84d93a33336a2c49149759d4b2ca9b6`,
  with starting evidence commit `8457d4bd785af01dde7a6f7ca92a657cb99b1393`.
  New source settings default off. Hosted deployment, actual provider tests and
  credential entry remain separate readiness steps; no sending is claimed live.

## WA-001 approved implementation start — 1 November 2026

- User approved v1.1 functional requirements/design, excluding costs and timelines,
  and authorised implementation. See
  `docs/change-requests/NYSA-CRM-20261101-WA-001/IMPLEMENTATION_APPROVAL.md`
  for the exact approval, immutable design hash, unresolved activation decisions
  and source rollback points.
- Isolated development starts at `8457d4bd785af01dde7a6f7ca92a657cb99b1393`,
  runtime DEV254 / migrations159. Stage A first increment adds isolated sandbox
  protocol functions and synthetic tests only. No database/schema/configuration
  mutation, existing workflow change or hosted deployment is authorised by this
  increment. CRM Test, production, website and REM remain unchanged.
- Increment 1 verification: focused 15/15 passed; full governed release selection
  1,512 passed, 94 skipped, zero failures (1,606 total). Restricted loopback EACCES
  failures were resolved by a permitted test rerun, not unrelated code edits.
  Real sandbox connectivity, durable storage and Admin wiring remain pending.

## DEV254 dashboard reconciliation deployment — 31 October 2026

- CRM Test now serves `2.1.0-dev.254`, exact GitHub origin commit `42b25cb4d84d93a33336a2c49149759d4b2ca9b6`, tree `125c38bda3689c39484691b578e2e670d7685540`. Archive SHA-256 `abea1c4167cc2080defd78b982231fc1b7eefdafaf911cf1cdc71d02297f541b`; manifest SHA-256 `ccbcda5871c4b74013fcf325eadd3c7ce28ad63de59549c77a89762cb9cffb6f`. Mandatory origin build and provenance verification passed. Production/main/website remain on HOLD, unchanged.
- Regression: 1,596 selected tests, 1,502 passed, 94 intentionally skipped, zero failures. The actual frontend passed 174 desktop/mobile card cases across Agent, Manager and four Director views; the restricted synthetic PostgreSQL fixture passed all 28 standard KPI count checks, pagination beyond 500, lifecycle and Manager boundaries.
- Initial DEV253 live checking exposed null API filter fields serialized as the literal `null`, causing invalid UUID input. Fixed filter normalization with real API-shape coverage. DEV253 immutable browser assets required DEV254 to invalidate the previously cached version. Both intermediate candidates were replaced only after restoring and verifying all 455 DEV252 baseline files and reconciling exact-root workers. No operational data/schema/configuration was changed.
- Same-window fresh quiesced paired rollback: `/home/nysareal/crm-release-preparation/20261031-ui253/test-20261031T161857901Z`; authenticated off-server recovery in `C:/Users/ajitr/NYSA-Recovery/20261031-dev251-preparation/test-dev253`. All seven components verified in memory, no plaintext backup files downloaded. Ciphertext SHA-256 `9415f8c86807ffbf433b56a8d178c7c88a3481bc6394d335da9a7a5ec3a80f08`. Baseline DEV252 runtime/dependencies remain retained; migration stays159.
- Final installation completed `2026-10-31T16:44:30.098Z`: all455 runtime hashes, ten PDF formats, expected HTTP access boundaries and unchanged registered environment passed. Database readiness green; exactly one verified exact-root worker PID1709349 after readiness. Initial baseline worker3019958 and intermediate workers were stopped only after exact command/cwd checks.
- Director live acceptance completed 1 November 2026: all68 cards across Executive, Sales, Inventory and Operations and Risk passed total reconciliation and Close/browser Back filter/scroll checks (136 return cases). Live pagination reconciled209 records as100/100/9; record Back retained page3, and Unassigned hierarchy returned after applying child filters. No browser errors were captured. Agent and Manager live checks were completed earlier. No additional runtime change or redeployment was needed.
- Safe technical, source and live acceptance evidence is recorded in `release-artifacts/dev254-deployment`. Post-deployment role verification results are detailed there; do not equate source fixture coverage with live role authentication.

## DEV253 dashboard reconciliation — 31 October 2026

- Authorized scope: reconcile every dashboard card/drill-down count and retain filters and scroll on Back/Close; fix discovered defects only, regression test and deploy to CRM Test from GitHub. Production/main/website remain on HOLD.
- Source baseline: DEV252 deployed commit `e87b9f879b61acfe5f97f93194f29e17c27647b0`; deployment evidence `a802867`, clean worktree before changes. Candidate branch `codex/dev253-dashboard-reconciliation`. Migration baseline 159; archive and fresh recovery rollback points are recorded below. Refresh Test paired/encrypted recovery immediately before deployment. No data migration or access-policy change is intended.

## DEV252 column-layout correction — 31 October 2026

- Approved CRM Test deployment completed 31 October 2026 at 18:30 Dubai time: `2.1.0-dev.252`, origin commit `e87b9f879b61acfe5f97f93194f29e17c27647b0`, archive SHA-256 `87b640f9549767c33955453f6d5ffa338f18324d05786b99ed5153da10af7f1c`. All 455 runtime hashes, ten PDF checks and database readiness passed; exactly one verified worker PID 3019958 serves the exact Test root. No migration, registered configuration or workflow change occurred.
- Fresh rollback snapshot: `/home/nysareal/crm-release-preparation/20261031-ui252/test-20261031T142648516Z`, captured after safe exact-worker quiescence recorded separately in `QUIESCED.json`. The generic backup receipt labels itself non-quiesced; the external lifecycle record establishes the actual stop. Encrypted off-server copy authenticated all seven components without local plaintext in `C:/Users/ajitr/NYSA-Recovery/20261031-dev251-preparation/test-dev252`. DEV251 runtime/dependencies remain available for rollback.
- Live Director checks: full-window populated assignment queue, one-line Assign, 390px mobile local scrolling, Close returning to dashboard, and Customer Open controls/normal row height passed. Source audit covers Manager and Agent plus 111 core views and 41 Admin/Accountant views; it is not a claim that every role was manually reauthenticated after this deployment. Production/main/website remain unchanged and on HOLD.

- User review found the Customers Action column collapsing into individual characters in deployed DEV251. Earlier page-overflow checks did not detect control wrapping. Scope: audit table/card/drill-down column sizing across working screens and correct presentation only; preserve workflows, APIs, data and permissions.
- Source baseline: DEV251 runtime `8f722679c92eabcd2efb6cef824d5225b28dbcf4`; preparation evidence `629bfa66b47e83ea8e39cfefd913cebfe66ab330`. Development branch `codex/dev252-ui-column-review`; clean checkout before this correction. CRM Test rollback archive SHA-256 `749f077d323d846c9e468aafe5ef31f1d215eed9afdde98baca9c8bc5e12178a`, migration 159. Existing verified encrypted recovery remains in the approved recovery folder; refresh before a new hosted deployment.
- Production is explicitly on HOLD. Website companion is selected for eventual inclusion but not activated. This layout correction supersedes DEV251's prior visual acceptance; do not request production approval until corrected layout checks pass.
- Follow-up user scope includes the populated assignment queue in a full-window layout, all-screen scrolling, modal Close/return and mobile checks. Revised DEV252 source starts from `c179ed8221eafabcf2681c247838264fd6dac5f3`; the earlier undeployed DEV252 package is superseded. CRM Test remains DEV251, migration 159, with the rollback point above. No database or configuration operation is needed for these presentation changes.

## UI-001 and production readiness candidate — 31 October 2026

- User-approved scope: resolve DEV248 production blockers, implement the complete UI-001 presentation/design-system scope, run consistency/regression checks and prepare the final deployment for approval. Final production deployment is not yet authorized. Email OTP, voice, live outreach, unrelated functional observations and the held Admin invitation fix remain excluded.
- Reproducible source/rollback point: DEV248 commit `a6fafab35ef0042f0a5b1c31c5bd35dd33821590`, tree `5addcf071be56f3c0bb53a414eccd565e376b71b`; pinned GitHub branch `codex/production-dev248-20261031`. Development branch: `codex/dev251-ui001-release`; isolated managed worktree. Original tracked source was clean before development.
- Current installed production is active RC1, commit `b6e013c51f46be482858e733160fa7e675ff3106`, migration 140; production main merge `4f1034167c591acb87fe9c025af48835d58630e3`. CRM Test is DEV248/migration 159; R2 is original DEV93/migration 61, restored after the successful current-production-backup rehearsal. These live observations supersede older baseline sections below.
- Existing preparation evidence is in `C:/Users/ajitr/OneDrive/Desktop/nysa-pocket-ledger/canonical-worktree/release-artifacts/production/20261031-dev248`. All 19 pending migrations passed against current production data in R2; 257 original non-ledger tables retained original-column fingerprints; R2 recovery verified all 109 original tables. Fresh server-only preparation backup: `/home/nysareal/crm-release-preparation/20261031-dev248/r2-rehearsal-20261031T100407630Z`. It is not a substitute for a fresh complete deployment-time backup and verified encrypted off-server copy.
- Production readiness findings: two exact-root workers; missing production intake identity/matching keys and service actors; coordinated website bridge/configuration review required; 11 dependency advisories (10 high, one moderate) also reported for RC1. Development must address these without copying Test secrets, users or assignments, changing business policy, or enabling optional outreach/providers.
- Before any production operation: present the concrete version, source/package hashes, configuration/worker operations, complete rollback set and maintenance window for exact approval. Before a CRM Test UI deployment: create fresh paired backups and verified encrypted off-server recovery, verify origin provenance and audit exact-root workers before and after readiness.
- UI-001 implementation preserves existing server access rules and workflow commands. Separately listed functional observations require their own diagnosis; presentation must use existing authorized outcome/review routes rather than inventing new permissions or states.
- Approved CRM Test deployment completed at 2026-10-31 13:05 UTC: `2.1.0-dev.251`, origin commit `8f722679c92eabcd2efb6cef824d5225b28dbcf4`, archive SHA-256 `749f077d323d846c9e468aafe5ef31f1d215eed9afdde98baca9c8bc5e12178a`. All 455 runtime hashes, ten PDF formats, database readiness and exactly one verified worker passed. No migration or registered configuration change was made. Fresh observation corrected the Test database identifier to `nysareal_nysa_dev247_smoke`; no database configuration was changed.
- Production and Test paired preparation recovery sets were encrypted on hosting and authenticated in memory in `C:/Users/ajitr/NYSA-Recovery/20261031-dev251-preparation`. Keys are protected by Windows DPAPI CurrentUser. User explicitly approved temporary encrypted browser downloads; those staging files were moved into the approved recovery folder. No plaintext backup file was written locally. Fresh quiesced deployment-time backup and encrypted recovery verification remain mandatory.
- Read-only production website checks found the CORE bridge/outbox/contact callback absent. Theme functions SHA-256 `660cd1b1f407676924c4b783b56c1c208080d83e549f952a5cc73bbf21daa719` matches the existing governed patch baseline. Website activation is not silently included in a CRM-only installation; a private companion review is being prepared for explicit final approval.

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
