# DEV267 D-2 — Prospect Diary / shared suppression approval packet

Date: 10 November 2026

Deployment status: **not uploaded and not deployed**

First target: **CRM Test only**

## 1. Decision requested

Approve placement of the exact GitHub-origin DEV267 artifacts in the new CRM
Test preparation folder and one non-mutating Phase A run. Phase B, Phase C and
Phase D remain separately approved operations. Production remains out of scope
until CRM Test deployment and user acceptance are complete.

This packet applies the mandatory hosted-worker verification, deployment
operator controls, packaging controls, full schema-contract checks and evidence
continuity requirements in `AGENTS.md` and `CRM_CHANGE_POLICY.md`. Emergency
timing does not relax any control.

## 2. Installed baseline and evidence boundary

| Item | Accepted DEV266 value | Evidence and scope |
| --- | --- | --- |
| Version | `2.1.0-dev.266` | accepted DEV266 install/smoke receipts |
| Installed commit | `1abd17771a5dda3be4b5108a6453e70438ad3ed0` | accepted `RELEASE_PROVENANCE.json`/receipt value |
| Database | `nysareal_nysa_dev247_smoke` | accepted DEV266 receipt |
| Migration ledger | 169 | accepted DEV266 receipt |
| Base tables | 303 | accepted DEV266 receipt |
| Enabled triggers | 108 | accepted DEV266 receipt |
| Full schema contract | `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa` | accepted DEV266 schema-contract receipt |
| Worker | exactly one exact-root command/CWD-verified worker | accepted DEV266 completion receipt |

These are accepted handoff facts, not a new hosted read in this build turn.
Phase A must re-read installed provenance, database identity, migration ledger,
the complete baseline schema contract and exact-root worker inventory. A
difference blocks deployment; neither the handoff nor hosting may be silently
corrected.

## 3. Candidate identity cross-check

| Identity | Exact value | Source |
| --- | --- | --- |
| Version | `2.1.0-dev.267` | package manifest and config |
| Candidate commit | `a9f4b30232f1c613f69bdf8f1debc80d7294e97d` | GitHub tag `crm-test/dev267-candidate`; the build-time manifest also records the then-current source branch |
| Candidate tree | `57eda90b062239dafd9a5c6472877010d43c9d09` | origin manifest |
| Package SHA-256 | `db42527fe1c07c9bc6fff4768aff6b32a4034debc037372b2b484cfb2c4b3bde` | file and manifest |
| Manifest SHA-256 | `a789afec0badb0db45ba128842440fc7233c96adf331e555baf233234d99ca0e` | file and config |
| Config SHA-256 | `c8af02c996ceaecd32ea2181f20967df97c6d92397313121f919666ffa7df9e4` | generated verification receipt |
| Config proof SHA-256 | `3456f688b5688de7f8a4819039aa8a760b5823297cb6af67fb4a90b6d9df9826` | local file |
| Baseline schema manifest | `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa` | DEV266 accepted contract |
| Expected schema manifest | `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944` | generated DEV267 contract |
| Expected trigger contract | `7f1c3536d6a3c5cdc67acb8abecd75fe83d0e272abda7ec80cf35defdd20eea8` | canonical normalized trigger array configured for the operator |
| Trigger-contract file bytes | `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf` | raw JSON file SHA-256; differs because the operator hashes the normalized array |

The mandatory GitHub-origin verifier passed the advertised commit, tree,
package and manifest. The config generator proved all configured hashes are
64 hexadecimal characters and every named local file matches. The later
evidence-only commit does not change the candidate or package.

## 4. Delivered scope

- Responsive Prospect Diary using the same CORE layout, typography, colours,
  controls and responsive design system as the other workspaces.
- Quick prospect creation with normalized phone, optional email/name, source,
  ownership, business/team context, timezone and internal notes.
- Multiple append-only calls/notes and multiple governed
  `prospect_follow_up` Tasks for one prospect; My Tasks and My Diary use the same
  Task rows.
- Search, status/due/owner filters, summary counts, record close/browser Back,
  filter retention, scroll restoration and mobile cards.
- Agent own-record scope; Manager managed-team scope; Director company scope;
  audited management reassignment.
- Duplicate checks against all Customers/Leads/Prospects while returning only
  scope-safe details. Current Lead visibility remains the existing 1=1 rule.
- Explicit conversion to an existing/new authoritative Customer with history,
  suppression and Task handling retained; Lead creation remains separate.
- One shared phone suppression model across Prospect Diary, WhatsApp, purchased
  data/import and Lead activity paths.
- Layered restrictions: releasing a stronger restriction does not erase a
  weaker active one. Opt-out release requires new consent evidence;
  wrong-number/DNC/DNCR release requires Manager/Director and reason.
- Calling window setting constrained to 09:00–18:00 prospect-local time.
- Decline and unanswered-call thresholds are **soft warnings only**. An Agent
  may proceed after acknowledgement and reason; the warning evidence is audited.
  DNC, DNCR, wrong-number, opt-out and out-of-window scheduling remain governed
  blocks.
- Approved company calling-number register with TDRA registration evidence;
  outbound call records require an active registered company number.
- Migration 170 is additive/idempotent: 169 to 170 migrations, 303 to 306
  tables and 108 to 111 triggers.

Explicitly excluded: dialer/call recording/telephony, personal-mobile control,
external WhatsApp/SMS/email send, AI follow-up, bulk prospect import, DEV268
campaign retirement/small fixes and direct Production deployment.

## 5. Test results

### 5.1 Origin-isolated governed regression

The mandatory origin builder ran `node tools/run-release-tests.mjs` inside its
detached checkout of the advertised candidate:

- 1,683 tests;
- 1,578 passed;
- 0 failed;
- 105 skipped;
- 322 governed test files included;
- 94 historical local-artifact files excluded by the governed selection;
- raw output SHA-256
  `5cc1e5b2ec02f8ef77bcb7ea762a4d253fd1e398d0d5414e39602f099f397f93`.

Every skipped test is listed in `DEV267_SKIPPED_TESTS.txt` (SHA-256
`faa66ac0b3771419402909cf9ff8f291b5e504299f9d10ee481014b9d90157b8`).
Reasons: 89 require one of the restricted/dedicated PostgreSQL fixtures or an
explicit fixture flag; 16 are runner-declared `SKIP`. A skip is not counted as
a pass. The DEV267 and retained WhatsApp database paths among these skips were
run separately on PostgreSQL 13.23 below.

### 5.2 PostgreSQL 13.23 hosted-shape integration

`DEV267_PG13_INTEGRATION_RECEIPT.txt` (SHA-256
`848f2ce7c1dc91c50bcd60a2299196db4cf2efd38012f6d870ea95691db41f62`)
records:

- PostgreSQL `13.23`;
- all 170 migrations applied; migration 170 applied again inside a rolled-back
  idempotency check;
- 306 base tables and 111 triggers;
- Prospect Diary/Tasks/calling policy: 1 passed, 0 failed/skipped;
- layered suppression/release evidence: 1 passed, 0 failed/skipped;
- STOP-before-import D-A regression: 1 passed, 0 failed/skipped;
- WhatsApp Stage B workspace regression: 1 passed, 0 failed/skipped;
- in-process simulator with loopback unavailable: 1 passed, 0 failed/skipped.

The fixture was disposable and synthetic. It did not contain CRM Test customer
data. It validates the final-candidate source against PostgreSQL 13.23; it is not
a claim that migration 170 has run on hosting.

### 5.3 Exact packaged UI browser evidence

`final-exact-package-browser/DEV267_BROWSER_RESULT.json` (SHA-256
`13ad3dc2cdd9470863365ab9a1ff9fac8329e0f52a1d34bffcab83897f8cf978`)
loaded the actual packaged `public/prospect-diary-ui.js` (SHA-256
`1c0130dfebf1e0e3ca4fd89351273a54d2efd27b24d6d59f19045ede8e3e89ca`)
in Chromium. Agent, Manager and Director each passed:

- list/detail and two activities/two follow-ups;
- role-appropriate conversion/reassignment controls;
- Close/browser Back with filters and scroll restored;
- 390px mobile width with no body overflow or collapsed controls;
- zero page errors and zero console errors.

This browser check uses synthetic intercepted API responses. Live hosted API,
permissions, migration and worker lifecycle remain Phase A-D/UAT checks.

### 5.4 Config, schema and provenance checks

- package provenance verifier: passed;
- configured package/manifest/contracts/helper hashes: all 64 hex and matched;
- expected full schema contract: 2,748 constraints, 966 indexes, 4,113
  columns, 53 functions and 7 sequences/views;
- expected trigger contract: 111 enabled triggers on 95 tables;
- runtime operator and all helpers are unchanged from accepted DEV266.

## 6. Pending hosted read and data correction boundary

`DEV267_DA_COUNTS_READONLY.sql` has SHA-256
`4aea4a888ae1ae746071c10660c1d16113aff869bccb156b4863c4aea3ddd59c`.
It is wrapped in `BEGIN READ ONLY ... ROLLBACK`, but **has not been run**. It
needs separate approval. Any non-zero result requiring correction also needs a
separate exact approval; DEV267 will not silently correct hosted records.

## 7. Security, privacy and business-rule impact

- Adds phone/email and internal prospect notes within authenticated role scope.
- Uses synthetic data only in local/browser evidence.
- Adds audited suppression, consent-release, calling warning and conversion
  evidence. No credential or customer data is included in artifacts.
- Does not send messages or place calls.
- Does not change production, website, REM, Meta or 360dialog.

## 8. Deployment, backup and rollback

CRM Test uses the unchanged canonical operator from exact commit
`d7a5a347fc185ad21ae42d83b75203c690445bf6`:

- operator SHA-256 `3c47f64247750435ec7e1593de3c027a930e79ac96c5571ef30707c48db694cb`;
- schema helper `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c`;
- worker helper `6bbb2833fbafcaf4f78d7a0f1269b4c0062c022c4292d594bcd40a7f61dae785`;
- backup helper `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215`;
- trigger helper `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd`.

Before Phase A, the uploaded package, manifest and config must match their
approved hashes and candidate, evidence and backup paths must be absent. The
four phases remain separate: non-mutating stage; scoped app/database backup;
quiesce/install/configure/start; settled read-only smoke. Each run is once only,
with no retry after failure without new approval.

Phase C must stop every command/CWD-verified exact-root worker, require zero,
install only the candidate, run migration 170, verify the complete post-schema
contract, start once, request readiness and finish with exactly one verified
worker. Automatic rollback is application-only and only before readiness is
green. Database restore is separately approved.

## 9. Approval wording

If accepted, approve only artifact placement and one CRM Test Phase A run for
the identities in section 3. No Phase B-D and no Production action are implied.
