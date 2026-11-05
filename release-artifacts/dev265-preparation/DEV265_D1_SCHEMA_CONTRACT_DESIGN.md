# DEV265 D-1 — schema-contract design checkpoint

Date: 6 November 2026  
Target: CRM Test only  
Status: design checkpoint; migration 169 has not been written

## Baseline and boundary

- Runtime source baseline: DEV264 commit `8d9be904149bec1b9b6d56dd8a39f17c2789fd12`.
- Accepted CRM Test baseline: `2.1.0-dev.264`, migration 168, 303 public tables and 108 enabled triggers across 93 tables.
- Known approved drift: 975 missing foreign keys, 18 missing primary keys, 15 missing unique constraints and 404 missing indexes. The only data incompatibility is approved UAT264 simulator evidence: 12 simulated orphan messages and 5 orphan notifications.
- Production schema was compared read-only with the PostgreSQL 13.23 reconstruction of its own installed commit and is clean. No Production remediation is included in DEV265.
- No CRM Test or Production application, database, configuration, worker, selector or integration was changed at D-1.
- Hosted deployment and worker controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` remain mandatory acceptance criteria. No upload or Phase A is authorised.

## Canonical contract generation

The committed generator `tools/generate-schema-contract.mjs` consumed the schema exports produced by the disposable PostgreSQL 13.23 rebuild of migrations 1–168 at DEV264. It preserves multiline constraints as whole records, hashes full `pg_get_functiondef` text after removing carriage returns, sorts every contract deterministically and references the existing governed trigger contract.

- Generator SHA-256: `1c6ff9168b8fe82e3179e62025e7ca36da9b6b811e96c3d500f841684084a187`
- Generator test SHA-256: `095520c8e176a03022e42e138dc84fb059154cef43445b68082e5353c3a7257c`
- Test result: 1 passed, 0 failed
- Manifest file SHA-256: `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`

### Contract counts and hashes

| Contract | Count | Canonical SHA-256 | File SHA-256 |
| --- | ---: | --- | --- |
| Constraints | 2,704 | `42767d11543825b6e85dd343ff47fb9b8ac9bb87d64b9abdaf31557ef6ac7482` | `f724230e8c8f08954140c34a31a98ebc9388fb045becce75d1240df44a3ad648` |
| Indexes | 956 | `53e1919a249c34ca2fcfbb12a6131e90c0d68c4a715149a2638954df63e34164` | `3f9361a65846bcb60b743fd41f44b0a02523fad1e7c1e7184d0348bf307ba44a` |
| Columns | 4,043 | `3f6bc04421b6fdf9da71742e540a3a59c466e695aa6df9b95c60735e776adde2` | `ee9f3f4c797b7d2b4387621e58b650cf2d307907a04fac69d3f4de5e62c015af` |
| Functions | 50 | `0e549674e17946ba5776ad45f29c5be537cfa68fe55319a9ee7da18aea4adb85` | `1289a5b5714be1bb4aa0cbef9de8a04db5337c929fd6f214ecd60f715b20391d` |
| Sequences/views | 7 | `e824808d94586694e26e84f4c268452bfa56d7df371d064c00f7263786fcdb7e` | `33a173bb3e1bd8fe928e09b703fc9d713c9ef9c389fbb365ad1175e47a01100d` |
| Triggers | 108 across 93 tables | `a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073` | `2c5ccb6df5a24e6b3040e56b02965de0c06874451b988cf7a014daf17aef38f4` |

Constraint breakdown: 303 primary keys, 981 foreign keys, 275 unique constraints, 1,145 check constraints and 0 exclusion constraints. Sequence/view breakdown: 2 sequences and 5 views.

## Migration 169 outline — not yet implemented

Migration 169 will be one PostgreSQL transaction and will fail closed. A catalog guard will first classify the live objects against the approved pre-migration CRM Test contract; any drift other than the approved missing set aborts before persistent change. The transactional operations will then be:

1. **Narrow UAT264 orphan cleanup.**
   - Identify orphan `wa_conversation_messages` only where `simulated = TRUE` and the referenced conversation is absent.
   - Identify orphan `wa_inbox_notifications` only for those same missing simulated conversation identifiers.
   - Assert exact counts of 12 messages and 5 notifications before deletion; any difference aborts the entire transaction.
   - Delete exactly those rows and insert one deterministic `audit_log` entry with counts and reason `UAT264 simulator orphans removed for FK restoration (approved by Ajit 5 Nov 2026)`. The `performed_by` value will be the asserted retained broker referenced by the affected UAT notification evidence; the migration will abort rather than invent an actor if that evidence is ambiguous or absent.
2. **Primary-key and unique restoration.**
   - Recheck duplicate key values for the 18 missing primary keys and 15 missing unique constraints, plus NULLs in primary-key columns.
   - Abort on any non-zero result or on a same-name definition mismatch.
   - Create only absent approved constraints; accept already-present exact matches so a correct database is idempotent.
3. **Foreign-key restoration.**
   - Recheck all 975 approved missing foreign keys for orphans immediately before creation.
   - Abort on any non-zero result or definition mismatch, then create only absent approved foreign keys.
4. **Index restoration.**
   - Reconcile the 404 approved missing index definitions. Primary/unique creation may already have recreated their backing indexes; those are accepted only when their exact definitions match. Create the remaining absent indexes and reject changed or unexpected definitions.
5. **Full contract verification.**
   - Compare constraints, indexes, columns, sequences/views and triggers exactly against the canonical files.
   - Compare functions by normalized full definition. The SQL verifier will use exact normalized text equality and will not add a new `pgcrypto` dependency; the application/operator verifier will enforce the contract's SHA-256 values.
   - Raise an exception with missing/extra/changed counts for every object type unless the resulting schema exactly matches the approved contract.

Re-running migration 169 on a correct database must delete nothing, create nothing, add no duplicate audit entry and pass the same contract verification. No object outside the canonical contract may be created, dropped or altered.

## Later implementation and approval gates

- The migration SQL, full-contract runtime verifier and canonical operator change remain unwritten at D-1.
- The operator change requires its own GitHub commit, focused tests, SHA-256 and separate approval under `AGENTS.md`; candidate approval will not approve operator code.
- Required tests remain those in the approved Part 3 instructions: exact drift reproduction, 12+5 cleanup, mismatch aborts, foreign-key/duplicate guards, idempotency, cascade behavior, simulator cleanup and operator blocking for missing/extra schema objects.
- Phase C lock duration and affected tables will be measured in a PostgreSQL 13 rehearsal and reported at D-2. Phase C must run while CRM Test is not in use.
- Packaging, provenance verification, deploy configuration, scoped backup and four separately approved phases are D-2 work. Nothing at D-1 authorises hosting activity.
