# CRM Test dev.175 UAT remediation — working record

Date: 2 September 2026. User request: fix all reported UAT issues.

## Baseline and boundaries

- Source baseline: package version `2.1.0-dev.174`, Git HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`.
- Existing changes before remediation: cumulative UAT/defect documents and screenshot evidence only; preserved.
- Recoverable pre-edit source/evidence archive:
  `remediation-baselines\dev174-before-uat-fixes-20260902-205015\source-and-evidence.zip`.
- Archive SHA-256: `4fc64d638e27456d70443da37c2fb4315168a8f74a0d7cb8ac27925225cd0d54`.
- Runtime: Node `v24.16.0`, npm `11.13.0`; project dependencies remain locked by package-lock.json.
- Retained deployed CRM Test package SHA-256: `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`.
- Retained deployment evidence: migrations 108–110, one worker, 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
- Historical remote file/database rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`.
  Not accessed or restored. No remote data, schema or configuration mutation is part of the local investigation.
- Target: isolated local synthetic verification and a new CRM Test candidate. Production, R2/Production clone and
  Property Finder are excluded. Never overwrite the dev.174 package or historical UAT evidence.

## Scope

DEF-102 and DEF-107 through DEF-117: focused-stage layout/modal/refresh lifecycle; Lead and Inventory internal
errors; explicit governed Deal creation and booking lineage; official document requirements/upload; Manager
exception detail/navigation; commission receipt role guidance; stage draft persistence; active pipeline state.
The earlier dev.174 corrections remain regression requirements. No role, ownership, closure, receipt or compliance
gate may be bypassed to remove an error. Contact history must not force a qualified Lead backwards.

## Verification plan

1. Reproduce SQL/runtime errors against a disposable synthetic database, not just source-text assertions.
2. Add regression tests for each diagnosed cause and authorization/validation failures.
3. Verify rendered stage layout, nested outcome dialogs, form save/return, explicit Deal creation and responsive widths.
4. Run focused and full ordinary automated suites; record protected skips separately.
5. Preserve exact human failed observations. Local automation is not a human UAT pass or deployment evidence.

## Implemented local corrections

| Defect | Correction and verification |
| --- | --- |
| DEF-102 | Opaque stage header/footer, independent scroll area, readable heading colour, reserved footer space and narrow-screen wrapping. Stage 1 starts at scroll position zero; switching stages resets the inner scroll. Desktop and 390px browser checks show no header/body/footer overlap. |
| DEF-107 / DEF-109 / DEF-114 | Removed misplaced `body.parkingSpaces` validation from GET Inventory and restored it to write validation. The undefined variable broke Inventory, including the Inventory request in Lead-opening UI. Real Lead/Inventory requests now return 200. Existing permission filters remain. |
| DEF-108 | Nested outcome dialog now sits above the focused stage with a translucent backdrop. Successful save removes the dialog, refreshes the same stage and displays persisted feedback; duplicate submission is disabled while saving. Browser result: zero remaining dialogs, Stage 2 still open, saved synthetic feedback visible. |
| DEF-110 | Offer, Booking and Deal action refreshes preserve the active stage and scroll position. Browser checklist completion shows the saved item as completed while Stage 6 stays open. |
| DEF-111 | Removed the generic footer Save that implicitly submitted a form; only explicitly named governed actions commit business changes. The separate acceptance → reservation → Deal API journey passes, exact lineage is retained and duplicate creation returns 409. No database bypass has been proven for the user's original record; human retest remains required. |
| DEF-112 | Corrected nonexistent `listings.reference` to `inventory_reference` in official-document context. Corrected a null left-join review object so uploaded PDFs become `pending_verification`, not a null state. The visible upload form is reachable; real PDF upload creates restricted immutable evidence, stays incomplete pending independent review, rejects self-review (403), and replays idempotently. |
| DEF-113 | Manager recovery rows display the evidence's exact task subject/next action and task identifier alongside the category, instead of only a generic category. Original recovery rules unchanged. |
| DEF-115 | Replaced ambiguous MAINTAIN label with finance or expectation/handoff wording. Stage 6 links to Commission and receipt; guidance explains preparation, actual receipt and confirmation and identifies Director/full Administrator navigation. Accountant receipt authority remains unchanged; Agent/Manager receipt writes and confirmations return 403. No access-control widening. |
| DEF-116 | Added migration 111 to permit the exact `OpportunityStageDraft` audit entity while preserving the prior allowlist. Real draft persistence and stale-version rejection pass. Browser saves v2 successfully. Distinct stable form keys prevent repeated checklist fields restoring into the wrong item; unambiguous legacy drafts remain readable; file bytes remain excluded. |
| DEF-117 | Dashboard and drilldown share an actor-scoped active-Opportunity projection, including Offer, Booking and Deal/completion. Drilldown opens the linked Opportunity. Counts reconcile. First contact advances a New Lead to Contacted in this read projection; further contact does not regress Qualified. No automatic Won while closure is pending, no historical Lead rewrite. |

These are **local implementation/verification results**, not human acceptance or proof that every observed
failure had only one cause. All 12 user-reported open issues remain pending candidate deployment and human retest.
No change was made to the user's actual booking, Deal, Lead, commission, evidence or closure status.

## Verification results — 2 September 2026

- Ordinary suite: **1,305 total / 1,264 passed / 41 protected skips / 0 failed**.
  The added 11 database tests are protected in this run; they were enabled and run separately below.
  Command: `npm test`. Local log: `docs/dev175-ordinary-tests.log`.
- Targeted real HTTP/PostgreSQL regression: **11 passed / 0 skipped / 0 failed**.
  `NYSA_RUN_DEV175_DB_INTEGRATION=1 node --env-file=.env --test --test-isolation=none test/dev175-uat-runtime.integration.test.js`.
  Local log: `docs/dev175-real-db-tests.log`. The guard restricts this to loopback, `nysa_test_fixture`,
  `nysa_test_user`, without superuser/create-database/create-role rights.
- Existing separate acceptance/reservation/Deal-lineage regression: **1 passed / 0 failed**.
  `NYSA_RUN_DB_INTEGRATION=1 NYSA_FIXTURE_SCHEMA=1 node --env-file=.env --test --test-isolation=none test/dev159-uat067-068-real-db.integration.test.js`.
  Local log: `docs/dev175-governed-journey-tests.log`. An initial isolated-private-folder run failed because
  that folder lacked the pre-existing synthetic organization logo; rerunning with the fixture's matching
  local private storage passed. No remote storage was accessed.
- Added three executable draft-serialization tests, included in the ordinary suite; all passed.
- Modified frontend JavaScript syntax checks and `git diff --check` passed.
- Browser checks used only `http://127.0.0.1:4175` with new synthetic records. They are machine-assisted
  local checks, **not human UAT on CRM Test**. Verified Stage 1, nested outcome opening/save, persisted feedback,
  checklist completion without leaving Stage 6, successful draft save, reachable final-PDF upload, and
  desktop/mobile reserved layout. Restored the viewport after testing.
- Desktop Stage 6 measured header 0–171.81px, scroll body 171.81–737px, footer 737–800px;
  at 390×844, header 0–328.26px, body 328.26–716.73px, footer 716.73–844px. No overlapping regions.

## Synthetic browser evidence

Files are under `docs/uat-evidence/2026-09-02-dev175-local/`. No production personal data appears.

| File | SHA-256 |
| --- | --- |
| `01-final-document-upload.png` | `17ebf20ce9a4dbfea1d9aaf1f4c777f1aa5e0704f7840db469f531fbec2d7ccb` |
| `02-stage1-desktop.png` | `fc1729de40f6f42a6d382281ad60cb293a6fd2d1a7fc5207db96c84725e5d4a2` |
| `03-viewing-saved.png` | `6dc0815b3c257d0c7373c500e889066ba46ff568f9471571768b9ae34313d6f6` |
| `04-outcome-dialog-above-stage.png` | `ccb83b6090b48e7a251ecf3c5c3a5832ee9f9702605b7bf574e1c9e5417ff2e5` |
| `05-stage6-mobile.png` | `9ca230f27207f7eed294479fbfb50c8c1809ce6bc22d1a63414b4d6acfc92562` |

## Migration, rollback and deployment boundary

- Migration `111_dev175_stage_draft_audit.sql` applied successfully **only to the restricted local fixture**.
  Existing fixture migrations 108–110 were also applied locally before verification. Latest local migration: 111.
  Historical deployed CRM Test migration record remains 110. No remote migration, restart or worker change.
- Migration 111 retains the existing audit CHECK expression and adds one entity; it does not delete history,
  rewrite ownership or change business transitions. Do not remove the added entity restriction after valid
  draft audit rows exist. For rollback, restore the paired pre-deployment database/file snapshot or retain this
  additive audit compatibility while reverting application files; never delete audit evidence to downgrade.
- Local synthetic records and private fixture evidence are retained for diagnosis. The fixture's rebuild/migrate
  tooling provides a reproducible local baseline; no production dataset was copied. No destructive rebuild was run.
- Pre-edit source/evidence archive and historical remote rollback reference above are retained. Before any future
  CRM Test deployment, take a fresh paired file/database snapshot and verify the new package checksum; preserve
  the immutable dev.174 archive, migration/test/worker history, and all failed UAT evidence.
- This is the **planned dev.175 remediation**, not a packaged release. `package.json` remains `2.1.0-dev.174`;
  no new release SHA or deployment is claimed. Approval to move human UAT from the pinned dev.174 deployment
  to a new candidate is still required. Production, R2/Production clone and Property Finder remain untouched.

Status: local remediation and verification completed; candidate packaging/deployment and human acceptance pending.

### Subsequent deployment authorization and packaging

The owner then authorized “ok pl deploy”. Package 2.1.0-dev.175 is now built and release-tested:
1,307 total / 1,266 passed / 41 protected skips / 0 failed; separate enabled database 11/11 and governed journey 1/1.
The dev.174 archive is unchanged. Deployment has not started because cPanel requires manual sign-in.
See [current deployment status](CRM_TEST_DEV175_DEPLOYMENT_STATUS.md) for exact package/installer checksums,
the two byte-for-byte historical migration restorations and the access blocker. This supersedes only the
earlier packaging/authorization status, not the preserved historical deployment or UAT observations.

### Deployed after owner sign-in

The owner confirmed sign-in. CRM Test dev.175 deployed successfully on 2 September 2026; migration 111,
health/readiness, exact runtime manifest and one worker PID 4184054 were verified. Fresh paired backup:
`/home/nysareal/crm-backups/consolidated-crm-test-dev175-20260902T180327Z`.
See [completion evidence](CRM_TEST_DEV175_DEPLOYMENT_COMPLETION.md), including the pre-check stop for two
existing Test workers and the socket-verified restart. Human UAT remains pending for all 12 reported issues;
the prior failures, original package hash, migrations 108–110 and historical tests/worker observation are retained.
