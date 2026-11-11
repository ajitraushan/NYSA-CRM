# DEV267a D-1 — Prospect Diary hosted-bootstrap and validation correction

**Status:** design checkpoint only; no implementation, package, upload or hosted change is authorized by this record.

**Target:** CRM Test first. Production requires its own reconciliation, package, backup and exact approval.

**Change owner:** NYSA Realty / Ajit.

**Prepared:** 11 November 2026.

## 1. Evidence-based baseline

The installed CRM Test source of truth is DEV267 `2.1.0-dev.267`, commit
`d9133a980390fe375af36ef415b84e2f4f4fda4e`. The local copy of the accepted
Phase C receipt reports `INSTALLED_STARTED_AND_READY`; the Phase D receipt is
`release-artifacts/dev267-preparation/run2/evidence/SMOKE_RESULT.json`, SHA-256
`0e5e142b0affd1e5aab08125bf0bdd8d2461d6100b765eabb1a78d0e0469b74f`.
That receipt records readiness green for `2.1.0-dev.267` and one exact-root
worker. The accepted database remains `nysareal_nysa_dev247_smoke`, migration
170, 306 public tables and 111 enabled triggers across 95 tables. DEV267a is a
code-only correction: no migration, table, trigger, configuration or data
change is proposed.

The DEV267 rollback point remains the scoped app/database backup at
`/home/nysareal/crm-release-preparation/20261110-dev267-run2/scoped-backup-dev267-phased-run2-63ad3c5`.
A fresh scoped backup is still mandatory in Phase B of any approved DEV267a
CRM Test deployment; this retained backup is baseline evidence, not permission
to reuse a stale deployment-time backup.

## 2. Confirmed UI root cause

`public/bootstrap.js` loads feature modules, including
`public/prospect-diary-ui.js`, before it loads `public/app.js`.
`prospect-diary-ui.js` assigns the implementation to
`window.renderProspectDiary`. Later, the top-level declaration in `app.js`:

```js
function renderProspectDiary(){
  return window.renderProspectDiary?.(prospectDiaryOptions());
}
```

is itself installed as `window.renderProspectDiary` by the classic-script
global environment. The wrapper therefore calls itself until the browser raises
`RangeError: Maximum call stack size exceeded`.

The problem is deterministic and is caused by the hosted script order, not by
role data, the Prospect API or CRM Test database state.

## 3. Full collision audit

A read-only source scan compared all function declarations in `public/app.js`
with every `window.<name> =` feature export in the other `public/*.js` files.
It observed 222 declared function names, 70 feature-export assignments and
three unique collisions:

| Shared global name | `app.js` | Feature module | Effect in DEV267 |
| --- | --- | --- | --- |
| `renderProspectDiary` | wrapper at line 522 | `prospect-diary-ui.js` | fatal recursion; Prospect Diary never renders |
| `renderCrmDashboard` | legacy/main implementation | `dashboard-ui.js` | app declaration silently replaces the feature export; no recursion |
| `openDashboardRecords` | legacy/main implementation | `dashboard-ui.js` | app declaration silently replaces the feature export; no recursion |

The scan found no other shared names. The two dashboard collisions predate
DEV267. They are not evidence that the dashboard is currently failing, but they
are the same unsafe global-ownership pattern and must be removed or explicitly
isolated in DEV267a rather than left as hidden exceptions.

## 4. Proposed UI correction

1. Rename the `app.js` Prospect wrapper to a unique internal name such as
   `renderProspectDiaryWorkspace` and update both restoration and tab-switch
   call sites. The wrapper will call the feature-owned
   `window.renderProspectDiary(options)` exactly once.
2. Keep `openProspectRecord` as the uniquely named adapter for
   `window.openProspectDiaryRecord`; it does not collide today.
3. Remove the two dashboard name collisions without changing current dashboard
   behaviour. The implementation will use distinct, explicit names for the
   feature-module exports and update that module's internal calls. Existing
   `app.js` dashboard functions and their current callers remain unchanged.
   This avoids turning the emergency correction into a dashboard redesign.
4. Add a static global-ownership test which scans the actual packaged
   `public/app.js` and all packaged feature modules and fails if a top-level
   `app.js` function shares a name with a `window.*` export. No allow-list is
   proposed.

Acceptance for this part is zero shared names, the Prospect Diary opening for
Agent and Manager, and no regression to the existing Agent/Manager/Director
dashboard paths.

## 5. Why the DEV267 packaged browser check passed

The DEV267 tool `tools/dev267-prospect-diary-browser-check.mjs` did load the
actual packaged `public/prospect-diary-ui.js`, but it did **not** load the
packaged application as hosted:

- it constructed a synthetic HTML document;
- it injected `prospect-diary-ui.js` directly with `page.addScriptTag`;
- it did not execute `public/bootstrap.js`;
- it did not load `public/app.js` after the feature module; and
- it directly called `window.renderProspectDiary(window.__context)`.

That check validated the feature module's rendering, responsive layout and
synthetic navigation in isolation. It did not validate the global namespace or
hosted load order. The evidence field `loadedFromActualReleaseFile: true` was
accurate only for that single feature file; it was insufficient evidence that
the complete packaged UI booted as hosted.

DEV267a replaces that boundary with a real-browser packaged-app test that:

1. extracts the exact origin ZIP under test;
2. starts the packaged application locally with synthetic fixture data;
3. opens the packaged `public/index.html`, allowing it to execute
   `bootstrap.js`, every declared feature module, and `app.js` in the exact
   hosted order;
4. authenticates as a synthetic Sales Agent, opens **Prospect Diary** from the
   real navigation, and proves the workspace and one record render with no
   console/page error;
5. repeats after authenticating as a synthetic Manager and proves team scope
   and the manager controls render;
6. records loaded script URLs and versions, screenshots, console/page errors
   and the hashes of packaged `bootstrap.js`, `app.js` and
   `prospect-diary-ui.js`; and
7. fails if the test substitutes a copied UI file, calls the feature export
   directly, or bypasses bootstrap.

The existing isolated feature test may remain as a component test, but it will
no longer be presented as hosted-bootstrap evidence.

## 6. `companyCallingNumberId` API correction

The activity route currently queries the UUID column before validating the
identifier's syntax. A malformed value can therefore reach PostgreSQL and raise
`22P02`, which is surfaced as HTTP 500.

DEV267a will validate the identifier before the query:

- missing identifier for an outbound call: HTTP 400;
- malformed/non-UUID identifier: HTTP 400 with a safe validation message;
- well-formed UUID that is absent, retired or otherwise inactive: HTTP 409;
- active TDRA-evidenced company number: existing success path unchanged.

Tests will cover all four outcomes and will assert that malformed input does
not execute the activity insert and produces no audit/data record.

## 7. Implementation boundary

Expected runtime changes are limited to:

- `public/app.js`;
- `public/dashboard-ui.js` only for collision-free export names and internal
  references, with no dashboard content or business-rule change;
- `src/routes/prospects.js` for identifier validation;
- focused static, API and real-browser tests;
- version/release metadata required for `2.1.0-dev.267a`.

No workflow, access rule, suppression rule, call-window rule, repeat-call
warning, schema, integration, connector or production change is included.

## 8. D-2 test and release evidence required

Before any upload or Phase A request, D-2 must include:

- the zero-collision packaged-source scan and its raw result;
- focused API tests for malformed, missing, inactive and active calling-number
  identifiers;
- the real-browser bootstrap test for Agent and Manager, with screenshots and
  zero console/page errors;
- dashboard regression for Agent, Manager and Director because two export names
  are being isolated;
- the governed regression suite with every skipped test named and explained;
- exact-package reruns using the GitHub-origin ZIP, not the worktree;
- proof that migration ledger 170 and schema/trigger contracts are unchanged;
- the GitHub-advertised candidate commit plus package, manifest and config
  SHA-256 values generated and compared by script; and
- privacy/security confirmation: synthetic data only and no credential or
  customer-data output.

Packaging remains restricted to:

```text
npm run release:package -- --commit <full-40-character-origin-SHA>
```

followed by the mandatory package verifier.

## 9. Future deployment controls (not yet authorized)

Any later DEV267a CRM Test deployment must follow the hosted-deployment section
of `CRM_CHANGE_POLICY.md` and mandatory worker/operator controls in `AGENTS.md`:

- canonical GitHub-origin operator only, with its exact commit and hosted hash;
- all candidate, evidence and backup output paths absent before the run;
- four separately approved phases: A stage, B scoped backup, C install/start,
  D settled smoke;
- exact app/database baseline and full schema contract checks;
- application-only automatic recovery before readiness, never a database
  restore;
- readiness green on the expected version and exactly one command/CWD-verified
  exact-root worker; and
- remote browser verification after deployment before acceptance.

Production, website, REM, WhatsApp providers and all other applications remain
out of scope.
