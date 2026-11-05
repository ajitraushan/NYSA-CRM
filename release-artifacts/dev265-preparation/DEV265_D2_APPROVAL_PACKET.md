# DEV265 Checkpoint D-2 approval packet

Date: 6 November 2026 (Asia/Dubai)

Target: CRM Test only

Status: built, tested and packaged; **not uploaded and no Phase A executed**

## 1. Candidate identity

- Version: `2.1.0-dev.265`
- Application commit: `ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`
- Git tree: `dca4d774c800034c4486112c5187d0e4a5493bcf`
- GitHub ref: `refs/heads/codex/dev265-schema-contract-restoration`
- Origin package SHA-256: `99166cabaa57e7f69320a207e84b166e5a4957a12bf004572fc705fdc0e9ad2a`
- Manifest SHA-256: `4184c3600b04eb72150c1d88e5b4033933b14f2e17a3108f940f59b75e61ca37`
- Migration count after install: 169
- Latest migration: `169_restore_full_schema_contract.sql`
- Migration 169 Git-content SHA-256: `ca0ab210ba6d65875e3494a81d93bc138fc1e89a3a36ac2cccf6a25eb3ec2e97`
- Mandatory origin-package verification: passed against GitHub origin.

The package was created only with:

`npm run release:package -- --commit ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`

The earlier `d4541b7...` archive is superseded and retained locally as evidence only. PostgreSQL 13.23 validation found an ambiguous implicit SQL alias in its migration 169; that archive was never uploaded or deployed. The corrected migration uses explicit aliases and was repackaged from the exact GitHub-origin commit above.

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
| Exact GitHub-origin governed package suite | 1,663 tests: 1,562 passed, 101 intentionally skipped, 0 failed | package test-output `2c81334709020dccfcab666a2b837d4c36db1410a6fe24f7b699958fb1fccc3a` |
| DEV265 static/generator/verifier suite | 7 passed, 0 failed | `e6837a8569c561578222959d8243af94e5872da9d5f2ee32531aeadb72a098b2` |
| DEV265 exact-drift PostgreSQL 13.23 integration | 2 passed, 0 failed | `afb33eec372ca1412470033212d91e08f5a46533f0ce4807833a3cf4a4432606` |
| Operator regression plus DEV265 operator tests | 20 passed, 0 failed | `0b9521faa29f1163b802435f2fd16704cceb7a0236208612712c2ac7e4530b0f` |

The origin manifest is the authoritative governed-suite receipt. Its selected-file count is 311 and selection SHA-256 is `9fdb8801d489d613320a5bf06d4150d12494e6dd42682f7b518a86c380676806`.
The retained `FULL_TEST_RESULTS.json` is explicitly labelled as a superseded receipt for the earlier `d4541b7...` package and is not evidence for this candidate.

### Additional database aggregate diagnostic

A shared-fixture sequential diagnostic produced 1,577 passed, 80 skipped and 3 failed. It is retained, not hidden, in `test-results/GOVERNED_DB_ENABLED_SEQUENTIAL_SUITE.txt`. The DEV265 cleanup test was corrected by rebuilding the exact accepted 17-orphan damaged state; the focused PostgreSQL 13.23 integration then passed 2/2, including the audit actor, idempotency, fail-closed preflight and conversation cascade.

The other two failures were reproduced without DEV265 at exact DEV264 commit `8d9be904149bec1b9b6d56dd8a39f17c2789fd12` on PostgreSQL 13.23:

- `dev158_business_conditions_section3.integration.test.js`: 3 passed, 1 failed with the same acceptance-evidence precedence mismatch; evidence SHA-256 `9bdb867dc45352ca0d3c83e0f106545e116a1d6bab9b21d74a8c8447845cae77`.
- `dev159-uat067-068-real-db.integration.test.js`: 1 failed and 1 skipped with the same `409 !== 200`; evidence SHA-256 `07a94d9d9fb1802d4908d7b005b224c40654d3f240a4df7023e987074d94c6ec`.

The scripted comparison passed and records `matchesDEV265Diagnostic: true` (SHA-256 `df9499fc73c56bdef93389c3d8960634f81d9ff0e943fbc3ed3142635462ae0e`). They are recorded as pre-existing test defects in the backlog; no runtime Offer rule was weakened.

## 5. Phase C lock and duration rehearsal

Receipt: `PHASE_C_REHEARSAL.json`

JSON SHA-256: `0108ec21d368e3ea408e802d14bab7b632dbff2ebb8abc31ef0627e88537301b`

Text receipt SHA-256: `035300a5bc6d682b2b1318e68db2ccf420bca5864ae8ca8031ab790418926103`

- Database: isolated `nysa_test_fixture`; PostgreSQL **13.23 (Debian 13.23-1.pgdg13+1)**.
- Started: `2026-11-05T21:39:46.162Z`.
- Completed: `2026-11-05T21:39:52.293Z`.
- Duration: **6,120 ms**.
- Samples: 242 at 20 ms.
- Maximum observed locks: 1,966.
- Affected relations observed: 872.
- Lock observations by mode: AccessExclusive 18; AccessShare 868; Exclusive 1; RowExclusive 24; RowShare 144; Share 200; ShareRowExclusive 288.
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
- Local LF SHA-256: `079cc117a2df11c3555272659d1a6ba4a9a1ca0e6e2a8e5bd37579013f5663a1`
- Script-generated hash proof SHA-256: `16e98fab564b84939bf467f0bc783ffa9b478fb1f5da3fe2033e377b33cb1c61`
- Script proof: every hash field is exactly 64 lowercase hexadecimal characters; package, manifest and both named schema-contract manifests equal their actual file hashes; configured governed-test pass count equals the origin manifest (`1,562`).
- Baseline: DEV264 commit `8d9be904149bec1b9b6d56dd8a39f17c2789fd12`, migration 168, 303 tables, 108 triggers, accepted damaged full-schema baseline.
- Expected: DEV265 application commit above, migration 169, 303 tables, 108 triggers, full canonical schema contract.

## 8. Deployment controls and impact

The mandatory hosted-worker verification in `AGENTS.md` and hosted-deployment controls in `CRM_CHANGE_POLICY.md` are acceptance criteria. Any later deployment must use four separately approved phases: stage, scoped backup, install/start, and settled smoke. Each phase is one run unless the approval explicitly says otherwise. The exact application-root worker command and `/proc/<pid>/cwd` must be verified before stop and after readiness; acceptance requires exactly one verified worker after readiness.

Privacy/security impact: only the 17 explicitly approved synthetic UAT264 orphan rows are deleted. The audit actor is derived from retained notification evidence. No credentials or customer data are in this packet. Production, website, REM, Meta and 360dialog are unchanged.

## Checkpoint D-2

DEV265 is ready for review at Checkpoint D-2. No package, config or operator file has been uploaded to hosting, and Phase A has not been requested or executed.
