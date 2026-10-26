# CRM Test dev.176 commission proof and workflow verification

## Baseline and authority

Owner request: “pl do” after the missing commission-proof upload was acknowledged.
Scope: implement private commission proof upload and recheck all reported workflow issues.
No human acceptance is implied. Production, R2/Production clone and Property Finder excluded.

Baseline: deployed 2.1.0-dev.175; migrations 1–111; source HEAD
`1af87ba994599d8de1bab6d37b2005e609d449fe` plus preserved dev.175 worktree changes.
Immutable deployed archive SHA-256:
`80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`.
Remote paired rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev175-20260902T180327Z`.
Pre-edit source/tests/evidence snapshot:
`remediation-baselines\dev175-before-commission-proof-20260902\source-and-evidence.zip`.
SHA-256: `2c05dd301d537484045f522c31c077a38a57c13155457ff54159205a9f5fbc39`.
This snapshot excludes credentials and private storage. Historical dev.174/175 evidence remains intact.

## Planned acceptance checks

- Scoped agent can upload PDF/PNG/JPEG proof from the same Deal's Commission and receipt section.
- Proof is privately stored, immutable, hash-identified, reloadable and downloadable only by permitted staff.
- Upload does not confirm a receipt or close a Deal. Existing finance authority is unchanged.
- Finance can link the exact proof to an immutable receipt, then perform existing confirmation.
- Reject unsupported/spoofed/oversize files, unauthorized/cross-Deal access and conflicting retries.
- Verify replay/concurrency, persisted file bytes, UI success/error recovery and stage continuity.
- Re-run dev.175 runtime regressions, governed journey, browser workflow checks and full ordinary suite.
- Record unresolved cases honestly; original human UAT results remain pending until user confirmation.

Status: implementation in progress. No dev.176 deployment or UAT pass claimed.

## Additional confirmed scope

The owner asked whether Accountant exists and which workflow/menu it has. Inspection confirmed the assignable
role and receipt API authority, but no Finance navigation; Opportunities is intentionally unavailable to it.
Added a Finance Receipts entry for Accountant, Director and full Administrator, with a minimal searchable Deal
receipt register. General Opportunity access, closure authority and Director-only Payout are unchanged.

The enabled real-database test exposed an additional existing 500: pg DATE values were sliced from Date.toString()
as `Wed Sep 02`. Corrected calendar-date normalization and serialized receipt DATE fields as date-only text.
This failure was agent-observed locally, not a new claimed user observation.

Restricted local database backup before migration:
`uat-evidence/fixture-backup-2026-09-02T18-17-57-866Z/before-commission-proof.dump`, 1,454,863 bytes,
SHA-256 `e04e5740216d5a57f2bdb1fdb6b4d90b0c19d89d49379321dd81466f38b26905`; archive listing verified.
Migration 112 applied only to the loopback nysa_test_fixture / restricted nysa_test_user role.
Remote CRM Test remains dev.175, migration 111; no remote application/database/configuration change in this turn.

## Implemented

- Immutable private commission-proof records, PDF/PNG/JPEG (5 MB), content/extension validation, SHA-256,
  staff/Deal-scoped list/download, uploader-scoped idempotency and concurrent replay protection.
- Scoped agents can supply proof; Finance alone records/confirms payment. Upload alone changes neither
  receipt nor closure state. Proof identifiers are linked by a same-Deal foreign key to immutable receipts.
- Explicit upload control, persisted uploaded-file list and download, evidence selector, recorded-receipt
  history, stable retry keys and same-stage refresh. Existing reference-based receipts remain supported;
  requiring uploads for all historical/new receipts would be a separate business-rule change.
- Finance Receipts menu and search let Accountant perform the existing receipt duties without general CRM access.
- Date handling fixed for PostgreSQL calendar dates. No tax, payout, commission-rate or split rule changed.

Rollback must retain migration 112 and stored proof/audit records after uploads exist; do not drop proof data
or restore a database over intervening user writes. A fresh remote paired backup is required before deployment.

## Local verification completed

- Ordinary suite: **1,315 total / 1,268 passed / 47 protected skips / 0 failed** (`docs/dev176-ordinary-tests.log`).
- Enabled commission proof/finance HTTP/PostgreSQL: **5 passed / 0 failed** (`docs/dev176-real-db-tests.log`).
  Covers persisted bytes/hash, download, authorization, real cross-Deal rejection, immutable storage metadata,
  concurrent replay, conflicting retry, spoofed/unsupported/oversize files, invalid dates, same-Deal receipt
  binding, Accountant confirmation and denial of Accountant Opportunity/closure/Payout authority.
- Prior dev.175 runtime regression: **11 passed / 0 failed** (`docs/dev176-prior-uat-regression.log`).
- Extended real governed journey: **2 passed / 0 failed** (`docs/dev176-full-closure-tests.log`).
  Acceptance → explicit reservation → explicit Deal → parties/checklist → Manager approval → receipt gate blocks
  premature closure → Agent uploads proof → Accountant records/confirms → Accountant closure denied → Manager
  closes. Independent database reads verify Deal closed_won, Opportunity Closed Won, booking completed, inventory Sold.
  Synthetic seed preparation is distinguished from subsequent actual governed API transitions.
- Browser skill verified the agent/Accountant upload and finance flow at loopback 4176 and stage regressions at
  loopback 4175. Upload remains in Stage 6; evidence/receipt persist; date-only display is correct; viewing dialog
  closes without losing Stage 2; checklist stays open; stage draft v2 saves; Stage 1 desktop layout is separated.
  The general stage fixture is not proof that the original user's Deal never bypassed a stage.
- Source version assertions updated to dev.176. Historical dev.175 archive tests still check every packaged
  file hash, SHA and migration byte; worktree-equality applies only when testing the same release version.
  No immutable dev.174 or dev.175 package was overwritten. No dev.176 package hash is claimed yet.

Screenshots under `docs/uat-evidence/2026-09-02-dev176-local/`:

| Evidence | SHA-256 |
| --- | --- |
| 01-accountant-proof.png | `1ce749301ff7fd00e6cc775ceadaacdca5b4b6e55aad9a57d166bc2a4b7b55fc` |
| 02-viewing-saved.png | `ae254986a979f4a876caea6479f86cfdf54297be3f676a81fb9b0c189c4f43e8` |
| 03-checklist-draft.png | `ddf205f6201a2c90ee3156b053c158e8c8344ea80616847aabb16e841e8fb6b0` |

Status: local implementation and the above verification complete. Packaging/deployment and original-record human
retests remain pending. No universal defect closure or production approval is asserted.

Final finance browser check: uploading another synthetic proof refreshed the Finance Receipts table from two
to three proof files without closing the selected Deal's receipt detail. A workspace-loaded event refreshes the
summary after successful upload/receipt/confirmation actions. Final ordinary rerun remains 1,315/1,268/47/0.
Both loopback fixture servers were stopped after verification; synthetic data and evidence are retained.
