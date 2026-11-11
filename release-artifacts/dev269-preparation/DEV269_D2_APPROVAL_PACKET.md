# DEV269 D-2 approval packet — Prospect editing, calling-window governance and workspace corrections

**Prepared:** 11 November 2026  
**Status:** build and verification complete; no upload, hosted query, Phase A or deployment has been run.  
**Target if separately approved:** CRM Test only. Production, website, REM and external providers remain unchanged.

## 1. Baseline and candidate identity

The installed source of truth remains accepted CRM Test DEV268, taken from
`BASELINE.md` and the accepted DEV267/DEV268 receipts rather than from memory:

| Identity | Accepted baseline | DEV269 candidate |
| --- | --- | --- |
| Version | `2.1.0-dev.268` | `2.1.0-dev.269` |
| Git commit | `b6272e9c9f2a17a2c082324ec8810391de7bdf01` | `e5db302e12a21d2597ecab0dc340fa2eae534381` |
| Git tree | accepted DEV268 receipt | `48159080f93f77f8ede3b0511f5619ec96d97f16` |
| Database | `nysareal_nysa_dev247_smoke` | unchanged |
| Migration ledger | 170 | 170; no migration |
| Public tables | 306 | 306 |
| Enabled triggers | 111 | 111 |
| Schema manifest | `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944` | unchanged before and after |
| Baseline trigger file | `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf` | unchanged |
| Origin package | — | `05b27a47641b430e991238673f531e91b2843b644ee3fb7a9473bb313e1a6a64` |
| Origin manifest | — | `683543c64a27effd1a827f8f1f448a5098ddf7fe1446018ed9c9f3c345d0aa1e` |
| Deploy config | — | `beafa2c490ee6da3063f82883a86632704dd4604ef302366ae2e6279a5aea430` |

The package was built only with
`npm run release:package -- --commit e5db302e12a21d2597ecab0dc340fa2eae534381`
from the GitHub-advertised commit. The mandatory package verifier passed exact
commit, tree, archive and manifest provenance. The manifest's detached-origin
test receipt records 1,697 tests: 1,592 passed, 105 skipped and zero failed.

Evidence:

- `release-artifacts/origin/nysa-core-2.1.0-dev.269-origin.zip`
- `release-artifacts/origin/nysa-core-2.1.0-dev.269-origin.manifest.json`
- `release-artifacts/dev269-preparation/DEV269_CONFIG_HASH_VERIFICATION.json`

The config verifier reports every configured hash as 64 lowercase hexadecimal
characters and every named-file hash equal to the file it names. Baseline and
canonical schema files have matching SHA-256 values file by file, which proves
their byte identity. This is local/package evidence; no hosted schema check has
yet run.

## 2. Implemented scope

### Prospect profile and diary

- Owner or in-scope Manager/Director may edit name, email, phone and notes;
  source details remain Manager/Director-only.
- Email is normalized and validated. Phone changes require a reason, repeat
  duplicate and shared-suppression checks, reject an active wrong-number block,
  and refresh the phone-derived timezone suggestion.
- Converted prospects are read-only. No edit weakens or clears an active
  suppression. Every change records exact before/after audit evidence and
  notes retain their prior version.
- The black banner was removed from both the list and record views by using the
  standard neutral CORE page-heading structure. The record heading is a
  transparent `SECTION`, not a generic HTML `header`; its prospect name uses
  standard CORE ink. The edit form, conversion panel and Manager override
  register contain no conflicting `header` element. Today, Upcoming and Overdue
  share the same prospect-local predicates and refresh with the list.
- Manual DNCR changes refresh the visible record immediately. Warning codes are
  rendered as plain-language messages with the Agent's recorded reason.
- Outside-scope duplicate matches remain privacy-minimized and never expose an
  `Open existing prospect` action.

### Calling-window correction approved after D-1

Both a scheduled call follow-up and a logged outbound call outside the
prospect-local 09:00–18:00 window use the same governed policy:

- default `PROSPECT_OUTSIDE_CALLING_HOURS_MODE=warning`;
- the user sees: **“This is outside the permitted calling hours (09:00–18:00
  in the prospect’s local time — now HH:MM there). UAE rules limit marketing
  calls to these hours. Confirm the customer requested this time and give the
  reason.”**;
- acknowledgement and a reason of at least five characters are mandatory before
  saving;
- the Task/call stores and displays **“Outside calling hours — customer
  request: <reason>”** in My Tasks, My Diary and the Prospect timeline;
- Manager override register and audit evidence retain actor, prospect,
  prospect-local time and reason; and
- setting the mode to `refuse` returns HTTP 409 without saving. Invalid setting
  values fail startup. Repeat-call limits remain soft warnings.

No new hosted setting is required for DEV269: leaving the variable unset uses
the approved default `warning`. Changing it later is a separately governed
configuration operation.

### Manager register and WhatsApp workspace

- Manager/Director team override register is derived from governed Task and
  call evidence; Agents cannot enumerate it. Decline wording now requires a
  renewed customer request or a specific business reason.
- Campaign retirement is exposed with reason and audited state/revision:
  owning Agents may retire their draft/returned campaigns; in-scope
  Managers/Directors may also retire pending/approved campaigns. Retired
  campaigns are immutable.
- Reply-lock expiry is displayed in browser-local time. Conversation detail,
  send and lock operations return the same privacy-safe 404 outside scope.
- Public material responses no longer expose `storageKey`; authorized file
  delivery remains server-side and scoped.

## 3. Verification results

### Governed origin suite

The origin package receipt and a separate TAP evidence run agree:

- 1,697 tests;
- 1,592 passed;
- 105 skipped;
- zero failed;
- 328 governed test files included;
- 94 historical local-artifact tests excluded; and
- selection SHA-256
  `1a69ac84e3e62d822ac0ba3226dae2141581616c7ec9e75f73d6e44c27386a65`.

Every skip is named with its runtime reason in
`DEV269_SKIPPED_TESTS.txt`; most require a separately enabled disposable
PostgreSQL fixture or isolated Git-process permission. A skip is not claimed as
a pass. Raw outputs are `DEV269_GOVERNED_TEST_OUTPUT.txt` and
`DEV269_GOVERNED_TEST_TAP_OUTPUT.txt`; the structured receipt is
`DEV269_GOVERNED_TEST_RECEIPT.json`.

Evidence-collection note: the first local wrapper invocation ran inside the
restricted command sandbox and reported 35 browser/local-server failures. It
did not change source, package or hosting and was not treated as release
evidence. Running the same governed selection with the local browser/server
permissions required by those tests produced the zero-failure receipt above,
which agrees with the independent detached-origin packager receipt. This
distinguishes an infrastructure-denied run from the candidate result rather
than silently discarding the failed attempt.

### PostgreSQL 13.23

The synthetic fixture reported PostgreSQL 13.23, 170 migrations, 306 tables,
111 triggers, and idempotent migration 170. Five database-enabled suites each
passed one test with zero failure/skip:

1. Prospect Diary profile, Task, suppression, registered-number and calling controls;
2. layered shared suppression and governed release evidence;
3. STOP-before-import regression;
4. WhatsApp workspace lifecycle; and
5. in-process simulated-provider lifecycle.

The Prospect suite includes Ahmed created without email, email added through
the edit route, duplicate/suppression re-evaluation and successful conversion;
it also exercises warning and refusal modes, acknowledgement/reason, stored
Task/call notes and audit/override evidence. Evidence:
`DEV269_PG13_INTEGRATION_RECEIPT.txt` and
`DEV269_PG13_INTEGRATION_RECEIPT.json`.

Evidence-collection note for this D-2 refresh: the first disposable fixture
start attempted an unavailable loopback port and did not start; the first run
on the replacement port then stopped before migrations because the freshly
created `public` schema was owned by the fixture bootstrap superuser rather
than the restricted test role. The synthetic schema ownership was corrected,
the PostgreSQL 13.23 suite was rerun from a clean schema, and only the final
zero-failure output is the release receipt. Neither event touched CRM Test or
the candidate package.

One `pg` deprecation warning reports a test client issuing a concurrent query;
the five suites still passed. It is test-harness maintenance, not a hosted
runtime error, and is not represented as resolved.

### Exact package and real browser

The exact origin archive was extracted and run as the full application with
routers mounted in production order against PostgreSQL 13.23:

- health 200, readiness 200 and `/` contained NYSA CORE;
- Ahmed creation without email returned 201, conversion was initially not
  ready, audited edit returned 200 and conversion returned 201;
- the WhatsApp workspace returned 200 and public material objects exposed no
  `storageKey`.

The real browser loaded the exact package through the actual `index.html` and
`bootstrap.js` order. Agent and Manager both opened Prospect Diary and an
individual prospect record on desktop and 390px mobile with zero console/page
errors. Both list and record headings were transparent standard `SECTION`
elements; prospect names were `rgb(20, 35, 44)`, record background images were
`none`, and the record/edit/conversion/override surfaces contained zero generic
`header` elements. Today=1 and Upcoming=1, Manager DNCR refresh passed, and no
mobile overflow was observed. Eight screenshots (including four record-page
screenshots) and the raw result are under `exact-package-browser/`.

The first D-2 browser check had covered only the list heading. Live review found
that the prospect record still inherited the generic dark `header` gradient.
That coverage gap was corrected before Phase A: the record markup was changed,
the package was rebuilt from the new origin commit, and the expanded assertions
were run against the extracted replacement package rather than the worktree.

Dashboard implementation continuity: `dashboard-ui.js` remains the active
dashboard module loaded before `app.js`; the renamed legacy wrappers in
`app.js` remain compatibility wrappers. DEV269 introduces no new caller of the
renamed `dashboard-ui.js` exports. The packaged load-order test confirms the
same implementation before and after this release.

These are local exact-package/browser results, not hosted UAT. Authenticated
remote CRM Test browser review remains required after a separately approved
deployment.

## 4. Security, privacy and data impact

- No role gains broader Customer, Lead, Prospect or WhatsApp visibility.
- Outside-scope duplicates and conversations remain non-disclosing.
- Prospect edits cannot weaken suppression; converted records are immutable.
- Full before/after values stay in governed audit storage and were excluded
  from test reports/screenshots.
- No migration, table, trigger, provider, website, REM, Meta or production
  change is included.

## 5. Deployment and rollback plan — approval required

This packet explicitly adopts the hosted-deployment controls in
`CRM_CHANGE_POLICY.md` and the mandatory hosted-worker verification in
`AGENTS.md` as acceptance criteria:

1. use only canonical operator
   `tools/crm-test-direct-node-release-operator.mjs` from commit
   `63ad3c5595d7e7d58296641351b47ac623ef8071`, hosted SHA-256
   `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911`;
2. reverify unchanged helpers:
   - schema `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c`;
   - worker `6bbb2833fbafcaf4f78d7a0f1269b4c0062c022c4292d594bcd40a7f61dae785`;
   - backup `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215`;
   - trigger `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd`;
3. verify candidate, evidence and backup output paths absent before Phase A;
4. obtain separate written approval for A stage, B fresh scoped app/database
   backup, C quiesce/install/start and D settled read-only smoke;
5. before stopping anything and after readiness, verify every exact-root worker
   by command marker and `/proc/<pid>/cwd`; after readiness require exactly one
   worker serving DEV269 with database readiness green;
6. automatic recovery is application-only and only before readiness acceptance;
   database restore always requires separate approval; and
7. after Phase D, run remote authenticated Agent/Manager browser verification
   before acceptance.

Phase C expects zero new migrations and the unchanged complete schema contract,
not counts alone. The fresh Phase B scoped backup will be the rollback point;
none exists yet for DEV269. No stale, duplicate or unverified exact-root worker
may remain at handoff.

## 6. Approval boundary

Requested next operation, if accepted, is **artifact placement plus one CRM Test
Phase A run only**. Phase A is non-mutating. Phases B, C, D, production and any
configuration change each remain separately controlled. On any failure, timeout
or stall, stop and report with no retry.

