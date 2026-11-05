# DEV265 Checkpoint D-2 approval packet

Date: 6 November 2026 (Asia/Dubai)

Target: CRM Test only

Status: built, tested and packaged; **not uploaded and no Phase A executed**

## 1. Candidate identity

- Version: `2.1.0-dev.265`
- Application commit: `d4541b7a0bd4b70e3a2642c27a387c4e7c192225`
- Git tree: `7dd9778cf1d53ecab3f168645fb0403f49a300a0`
- GitHub ref: `refs/heads/codex/dev265-schema-contract-restoration`
- Origin package SHA-256: `e809353434e3a1687f5a7e678325b95fcf36820085155f8b21338c2c3a7973d0`
- Manifest SHA-256: `bfa912882f60a692d6f6f6fbc69298932178a14f34204eae20c04527b8ec67ed`
- Migration count after install: 169
- Latest migration: `169_restore_full_schema_contract.sql`
- Migration 169 Git-content SHA-256: `a8d5afc3e1f318521a6e9ab4a1f1ca25b33da70d445b4a325bebab085fe032f3`
- Mandatory origin-package verification: passed against GitHub origin.

The package was created only with:

`npm run release:package -- --commit d4541b7a0bd4b70e3a2642c27a387c4e7c192225`

## 2. Migration 169 scope and ordering

Migration 169 is one application-controlled transaction. It fails closed and rolls back the entire transaction on any mismatch.

1. Recognise either the exact accepted pre-migration contract or the already-restored canonical contract.
2. On canonical rerun, change nothing.
3. On the accepted damaged baseline, require exactly 12 simulated WhatsApp-message orphans and 5 WhatsApp-notification orphans.
4. Delete exactly those 17 approved UAT264 simulator rows and write one governed audit record.
5. Restore 18 primary keys and 15 unique constraints.
6. Restore 975 foreign keys, each preceded by an orphan check.
7. Restore 371 standalone indexes.
8. Verify the complete canonical contract: constraints, indexes, columns, full function bodies, sequences/views and triggers.

No table, schema or customer/business record is dropped or truncated.

### Index split

- Missing indexes in accepted drift: **404**.
- Constraint-owned backing indexes created by the 18 PK + 15 unique constraints: **33**.
- Explicit standalone `CREATE INDEX` statements: **371**.
- Total restored: **33 + 371 = 404**.

### `audit_log.performed_by` choice

The audit actor is not a hard-coded developer or system user. Migration 169 reads the five approved orphan `wa_inbox_notifications` rows and requires exactly one distinct, non-null retained `broker_id`. That broker is used as `audit_log.performed_by`. The migration aborts if the actor is absent or ambiguous. The local exact-drift fixture uses a synthetic broker only; CRM Test will use the retained actor already attached to its five approved UAT264 notifications.

## 3. Committed pre-migration baseline contract

The baseline contract is generated from the accepted Step 3 `ACTUAL_*.txt` exports. The manifest records these source hashes:

| Step 3 export | Accepted source SHA-256 |
|---|---|
| Constraints | `caafa66bc5eb558facaf02bcb4cebdf10cc2fa89261ba2c3fadc907dc0c34a52` |
| Indexes | `754e56f705db9271a504216ed41b9daaba9e58c12a9a5f857a553fff1c6c510d` |
| Columns | `150b934f2ae10d5919bf96015ad87e7f0bc8d931876a23754b2fea47660a043f` |
| Functions | `b32e48a948acfc071e7f0298b07974440722c2f5f32077c38a94c58739d8cbf3` |
| Sequences/views | `3584692018940889010888c5003784255d706f3ac7593edab52c7ba57b36dfad` |

The committed GitHub file hashes are:

| Contract file | Records | Git-content SHA-256 |
|---|---:|---|
| `constraints.json` | 1,696 | `9dd45178077abc337e52562e68d731b92b505824e2215f158ebf674016809eb0` |
| `indexes.json` | 552 | `fd83ff0385b32f087fe328021bb7d40c144148bba7770c2955eb8b7423dfa471` |
| `columns.json` | 4,043 | `ee9f3f4c797b7d2b4387621e58b650cf2d307907a04fac69d3f4de5e62c015af` |
| `functions.json` | 50 | `1289a5b5714be1bb4aa0cbef9de8a04db5337c929fd6f214ecd60f715b20391d` |
| `sequences-views.json` | 7 | `33a173bb3e1bd8fe928e09b703fc9d713c9ef9c389fbb365ad1175e47a01100d` |
| `manifest.json` | 5 object sets | `4b3a04e9136193de9ec7413e51962381ffb9576eb71b062b7c263c50452390a9` |

The candidate canonical-contract manifest SHA-256 is `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`.

## 4. Test evidence

| Test set | Result | Evidence SHA-256 |
|---|---|---|
| Exact GitHub-origin governed package suite | 1,660 tests: 1,559 passed, 101 intentionally skipped, 0 failed | package test-output `5c4133f041eb72f6c1bd5e0e5c00bfe4c4d55edc513457db0eb319b94dc5c545` |
| Full per-test result list | same 1,660 outcomes | `e86739bafac3a2f40c18cc0e5c0a75025cc8cd70c2388009665595b6a7f859b4` |
| DEV265 static/generator/verifier suite | 6 passed, 0 failed | `b8085d0199ecba3fc6ac646804db0ecb63d79641f815688b60eef43f75138c63` |
| DEV265 exact-drift PostgreSQL integration | 2 passed, 0 failed | `2d37c6899a17542c59fc58729fe2995ae8760d1b83d27bbcbccb60c6b3387626` |
| Operator regression plus DEV265 operator tests | 20 passed, 0 failed | `0b9521faa29f1163b802435f2fd16704cceb7a0236208612712c2ac7e4530b0f` |

The full test list is retained in `FULL_TEST_RESULTS.json`; it names all 1,660 tests and their passed/skipped status.

### Additional database aggregate diagnostic

A shared-fixture sequential diagnostic produced 1,577 passed, 80 skipped and 3 failed. It is retained, not hidden, in `test-results/GOVERNED_DB_ENABLED_SEQUENTIAL_SUITE.txt`. Two failures are older Offer tests that omit now-required acceptance evidence. The third expected the DEV265 cleanup audit in a fixture that had been made canonical without first creating the exact 17-orphan drift. After rebuilding the exact accepted damaged state, the focused DEV265 integration passed 2/2, including the audit actor, idempotency, fail-closed preflight and conversation cascade. This diagnostic is not substituted for the governed package result.

## 5. Phase C lock and duration rehearsal

Receipt: `PHASE_C_REHEARSAL.json`

SHA-256: `b1eefd83f7177ffbddd6593e76c72bc3b3528ff56c454226eab3ac020c687a79`

- Database: isolated `nysa_test_fixture`; PostgreSQL 16.15.
- Contract source: PostgreSQL 13.23 Step 3 exports; the local engine difference is disclosed.
- Started: `2026-11-05T21:01:02.638Z`.
- Completed: `2026-11-05T21:01:09.824Z`.
- Duration: **7,151 ms**.
- Samples: 206 at 20 ms.
- Maximum observed locks: 2,973.
- Affected relations observed: 873.
- Lock observations by mode: AccessExclusive 18; AccessShare 870; RowExclusive 26; RowShare 144; Share 200; ShareRowExclusive 288.
- Final ledger: 169 migrations, latest `169_restore_full_schema_contract.sql`.

The rehearsal reflects a database-wide restoration and therefore intentionally exposes the lock footprint. Phase C remains separately approved, time-bounded, and requires a fresh verified scoped backup.

## 6. Separate canonical-operator change

This change is **not** part of the application package.

- Operator commit: `7c276374857112dad6d0d3729461a152704418d0`
- Operator Git/LF SHA-256: `26b827055f7f7955c85921dd1390b20a2aeb2ea83a96acea0102ff6226fb72a1`
- Operator tests: 20 passed, 0 failed.
- Added acceptance gates: exact full-schema comparison at stage, backup, pre-install and post-readiness install verification; full result retained in evidence and scoped-backup receipt.
- Rollback boundary remains application-only and only before readiness turns green; no automatic database restore was introduced.

This operator commit requires separate written approval before placement or use.

## 7. Deployment config

- Config file: `DEV265_DEPLOY_CONFIG.json`
- Local LF SHA-256: `809003715227f4503b852421dd003f97352a3163ead36a30ed2204cc8c45a042`
- Baseline: DEV264 commit `8d9be904149bec1b9b6d56dd8a39f17c2789fd12`, migration 168, 303 tables, 108 triggers, accepted damaged full-schema baseline.
- Expected: DEV265 application commit above, migration 169, 303 tables, 108 triggers, full canonical schema contract.

## 8. Deployment controls and impact

The mandatory hosted-worker verification in `AGENTS.md` and hosted-deployment controls in `CRM_CHANGE_POLICY.md` are acceptance criteria. Any later deployment must use four separately approved phases: stage, scoped backup, install/start, and settled smoke. Each phase is one run unless the approval explicitly says otherwise. The exact application-root worker command and `/proc/<pid>/cwd` must be verified before stop and after readiness; acceptance requires exactly one verified worker after readiness.

Privacy/security impact: only the 17 explicitly approved synthetic UAT264 orphan rows are deleted. The audit actor is derived from retained notification evidence. No credentials or customer data are in this packet. Production, website, REM, Meta and 360dialog are unchanged.

## Checkpoint D-2

DEV265 is ready for review at Checkpoint D-2. No package, config or operator file has been uploaded to hosting, and Phase A has not been requested or executed.
