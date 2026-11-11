# DEV267a D-2 — Prospect Diary, validation and manual-DNCR approval packet

**Status:** build and verification complete; ready for review only. No package,
configuration, application file or deployment tool has been uploaded. No hosted
application, database, selector, setting or worker has changed.

**Functional name:** DEV267a. **Technical version:** `2.1.0-dev.268`, because
the canonical release/config tooling accepts numeric `2.1.0-dev.<number>`
versions and does not accept an alphabetic `267a` suffix.

## 1. Baseline and target

CRM Test remains on deployed-but-not-accepted DEV267 `2.1.0-dev.267`, commit
`d9133a980390fe375af36ef415b84e2f4f4fda4e`, database
`nysareal_nysa_dev247_smoke`, migration 170, 306 public tables and 111 enabled
triggers across 95 tables. Evidence is the accepted DEV267 Phase D receipt
`release-artifacts/dev267-preparation/run2/evidence/SMOKE_RESULT.json`, SHA-256
`0e5e142b0affd1e5aab08125bf0bdd8d2461d6100b765eabb1a78d0e0469b74f`.

The retained DEV267 rollback point is
`/home/nysareal/crm-release-preparation/20261110-dev267-run2/scoped-backup-dev267-phased-run2-63ad3c5`.
It is baseline evidence only. A later approved Phase B must take a fresh scoped
application/database backup before Phase C.

## 2. Exact candidate identity

| Field | Final value | Evidence |
| --- | --- | --- |
| Version | `2.1.0-dev.268` | package manifest/config |
| Candidate commit | `b6272e9c9f2a17a2c082324ec8810391de7bdf01` | advertised `origin/codex/dev267-prospect-diary` |
| Git tree | `1ea74d323004885da3a5b067c88d9f31c082cb54` | origin manifest |
| Package SHA-256 | `6ebacdb5f19e7c65b5a99e31cbf62d88e7a0b737d736a96367f382b463c43b3c` | origin builder and verifier |
| Manifest SHA-256 | `447f6a655219c4d108e2cb164d0520bc502cefac2ee55d40b180bece81ca5b5d` | origin builder and verifier |
| Config SHA-256 | `3a1fa077651a99e036658d99787fe5627e5da391484f65f98b95300fa4baf74d` | script-generated config proof |
| Operator commit | `63ad3c5595d7e7d58296641351b47ac623ef8071` | unchanged from DEV267 |
| Operator LF SHA-256 | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911` | local governed tool bytes |

Packaging used only the mandatory command:

```text
npm run release:package -- --commit b6272e9c9f2a17a2c082324ec8810391de7bdf01
```

The mandatory provenance verifier passed the origin commit, tree, package and
manifest. The earlier local packages from `c0ab2d66…` and `021ba78c…` are
superseded and preserved in explicitly named local evidence folders; neither
was uploaded or deployed. Approval must identify the final SHA-256 values above,
not only the shared filename.

## 3. Implemented corrections

### 3.1 Hosted-bootstrap recursion

`app.js` now calls its uniquely named `renderProspectDiaryWorkspace` adapter,
which calls the feature-owned `window.renderProspectDiary` exactly once. A scan
of the final packaged source reports zero collisions between `app.js` top-level
function names and feature `window.*` exports.

The old DEV267 packaged UI check passed because it injected only
`prospect-diary-ui.js` into synthetic HTML and directly called the feature
export. It did not load `index.html` through `bootstrap.js`, did not load
`app.js` afterwards, and therefore could not reproduce classic-script global
replacement. DEV267a's exact-package browser check loads the real files in the
hosted order `bootstrap.js` → feature modules → `app.js`.

### 3.2 Dashboard collision ownership

Before and after this correction, the implementation actually reached from the
shell is `app.js`'s `renderCrmDashboard` / `openDashboardRecords`; classic-script
declarations had silently replaced the same-named `dashboard-ui.js` exports.
DEV267a preserves those effective `app.js` implementations and renames only the
feature-module exports to `renderDashboardFeatureModule` and
`openDashboardRecordsFeatureModule`. A repository-wide caller scan proves the
renamed exports are used only inside `dashboard-ui.js`; no new external caller
was introduced.

### 3.3 Calling-number validation

The outbound-call route validates `companyCallingNumberId` before querying the
PostgreSQL UUID column:

- missing: 400;
- malformed: 400 without a database cast error;
- well-formed but absent/inactive: 409;
- active TDRA-evidenced company number: existing 201 path.

The PostgreSQL 13.23 route integration covers all four cases.

### 3.4 Manual DNCR evidence

Prospect Diary and the WhatsApp recipient/suppression screen now expose a
Manager/Director-only action labelled **Manual DNCR evidence (not a registry
check)**.

- Agent attempts return 403.
- Recording requires an evidence reference and writes the shared phone-level
  `dncr` restriction.
- The shared reader blocks WhatsApp import, campaign eligibility, outbound
  Prospect calls and follow-up creation.
- Release requires a meaningful Manager/Director reason; any weaker active
  restriction remains effective through the pre-existing governed release
  logic.
- Both record and release are audited with actor and evidence/reason.

No external DNCR registry query is claimed or implemented.

## 4. Database and configuration continuity

DEV267a is migration-neutral. The script-verified expectation is:

| Contract | Before | After |
| --- | ---: | ---: |
| Migration ledger | 170 | 170 |
| Public tables | 306 | 306 |
| Enabled triggers | 111 | 111 |

All six baseline schema files are byte-identical to the corresponding DEV267
canonical contract files. The schema manifest is
`59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`;
the baseline/canonical trigger file is
`70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`.

During D-2, the first migration-neutral config proof correctly exposed that the
generator inherited DEV267's pre-migration 108-trigger array. The generator was
fixed and regression-tested before this final candidate was packaged. The final
config now records 111 baseline and 111 expected triggers and matches every
named file/hash. No faulty config was uploaded.

The deployment operator and four helpers are unchanged:

| File | LF SHA-256 |
| --- | --- |
| `crm-test-direct-node-release-operator.mjs` | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911` |
| `database-schema-contract.mjs` | `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c` |
| `hosted-worker-lifecycle.mjs` | `6bbb2833fbafcaf4f78d7a0f1269b4c0062c022c4292d594bcd40a7f61dae785` |
| `crm-test-backup-verification.mjs` | `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215` |
| `database-trigger-contract.mjs` | `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd` |

## 5. Test results

### 5.1 Governed exact-origin suite

The final origin builder ran 1,695 tests: **1,590 passed, 105 skipped, zero
failed**. It selected 327 test files; selection SHA-256 is
`67c87ed49208a0d085e2876a20d9244272656643ec435ad965decd0151d5745e`.
The manifest's raw test-output SHA-256 is
`8391b9077fb234ee862e30c7d602c6bda2cc741156a81aee2d6591a3eaa9a623`.

Skipped tests are not treated as passes. All 105 names and reasons are retained
in `DEV267A_SKIPPED_TESTS.txt`. The three DB-gated paths relevant to this change
(Prospect Diary, WhatsApp workspace and shared suppression) were run separately
and passed on PostgreSQL 13.23.

### 5.2 PostgreSQL 13.23 target-shape fixture

The disposable restricted fixture rebuilt all 170 migrations, verified 306
tables and 111 triggers, and proved migration 170 idempotent. Five integration
suites passed with zero failures:

1. Prospect Diary lifecycle, including missing/malformed/inactive/active
   company-calling-number cases, Agent DNCR refusal, Manager record, blocked
   call/follow-up, release and audit;
2. shared layered suppression and weaker-restriction survival;
3. D-A STOP-before-import regression;
4. WhatsApp workspace, including DNCR import/campaign block and Director
   release;
5. full in-process simulator regression with loopback unavailable.

The raw receipt SHA-256 is
`9d25fd5052b6e89309472ba8160bb53d8412636eef7119bd00613a254d8df4c8`.
It prints `PostgreSQL 13.23` and contains five `pass 1`, zero failure results.

### 5.3 Exact-package real browser

The final ZIP was extracted to a new absent directory and served without
substituting UI files. Chrome loaded actual `index.html` and `bootstrap.js`,
then opened Prospect Diary through the real navigation as Sales Agent and
Manager. Both rendered one synthetic prospect with zero page errors and zero
console errors. The evidence records the actual package hashes for
`bootstrap.js`, `prospect-diary-ui.js`, `dashboard-ui.js` and `app.js`.

- Agent screenshot: `exact-package-browser-final/sales_agent-prospect-diary.png`
- Manager screenshot: `exact-package-browser-final/manager-prospect-diary.png`
- Result: `exact-package-browser-final/DEV267A_HOSTED_BOOTSTRAP_BROWSER_RESULT.json`

This browser fixture proves load order, navigation and rendering. It does not
claim a hosted CRM Test login or live data check; that remains a remote
post-deployment acceptance step.

## 6. Security, privacy and impact

- Test data is synthetic; no production/customer data or credentials appear in
  evidence.
- Manual DNCR uses existing shared suppression/audit storage and does not call
  a registry or external provider.
- Role enforcement is server-side; hiding the controls in Agent UI is not the
  security boundary.
- No migration, provider activation, send capability, calling connector or
  production change is included.
- Production, website, REM, Meta, 360dialog and live WhatsApp remain unchanged.

## 7. Deferred and excluded

This release does not accept DEV267, does not implement the separately scoped
DEV268 campaign-retirement/small-fix document, and does not add a real dialer,
registry integration, automated outreach or AI. The existing governed suite's
105 fixture-gated skips remain explicitly listed. A hosted Agent/Manager DNCR
UAT and exact-root worker verification remain post-deployment requirements.

## 8. Later deployment controls — not yet authorized

Any request to place or deploy this candidate must cite the hosted-deployment
section of `CRM_CHANGE_POLICY.md` and mandatory hosted-worker/operator controls
in `AGENTS.md` as acceptance criteria:

1. only the canonical GitHub-origin operator from commit `63ad3c55…`, with its
   hosted SHA-256 reverified;
2. package, manifest and config placed through temporary paths, hash checks and
   atomic moves;
3. candidate, evidence and scoped-backup output paths absent before Phase A;
4. four separately approved phases: A stage, B scoped backup, C install/start,
   D settled smoke;
5. application-only automatic recovery before readiness, never database
   restore;
6. Phase D recording every HTTP attempt in a bounded 30–60 second window; and
7. readiness green on `2.1.0-dev.268` with exactly one command/CWD-verified
   exact-root worker, followed by remote browser/UAT before acceptance.

This D-2 packet requests review of the build only. It does **not** request
artifact placement or Phase A approval.
