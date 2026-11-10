# DEV266 D-2 approval packet

Status: **build and verification complete; not uploaded or deployed**  
Prepared: 10 November 2026  
Target if later approved: CRM Test only

## Candidate identity

- Version: `2.1.0-dev.266`
- Application commit: `1abd17771a5dda3be4b5108a6453e70438ad3ed0`
- Git tree: `914b92044dc50591ab2c4117b494040a9e579847`
- Origin branch: `refs/heads/codex/dev266-reply-lock`
- Package SHA-256: `5bf0479e9be519d708c8b94a076975c24caec93718c2550161badab450e112b5`
- Manifest SHA-256: `b760f9dd3a9201017a3fc7aa00ddc5b954de4c1969e7aa7dbfd9cd7ad800c0c8`
- Config SHA-256: `6c44f4625e916cd2c5dac344b093051abf4e7f16cf0db9b4f793647a289062f3`
- Mandatory origin builder: `npm run release:package -- --commit 1abd17771a5dda3be4b5108a6453e70438ad3ed0`
- Mandatory provenance verifier: passed for the exact archive, manifest, Git commit and tree above.

## Approved scope delivered

- Fixes PostgreSQL 13 `42P08` by typing the reply-lock UUID parameter explicitly.
- Enforces Option B: only the active lock holder can send a one-to-one reply; management does not bypass another holder.
- Allows release by the holder or an in-scope Manager/Director; Manager/Director override release is audited.
- Serializes concurrent acquisitions using a row lock; exactly one acquisition succeeds.
- Clears the lock in the same transaction as reassignment/takeover.
- Refreshes the lock only after a newly accepted send; duplicate or failed sends do not refresh it.
- Uses PostgreSQL database time for expiry. `WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES` defaults to 30, accepts whole minutes 5–240, and invalid values fail process startup before database work.
- Adds visible lock controls and error banners to the actual packaged WhatsApp workspace UI.
- Campaign delivery remains outside the one-to-one lock gate, as designed.

## Accepted DEV265 baseline synchronization

DEV266 adds no migration. Its migration ledger remains 169 and the latest migration remains `169_restore_full_schema_contract.sql`.

The accepted DEV265 Phase C receipt `release-artifacts/dev265-preparation/run2/INSTALL_RESULT.json` has SHA-256 `0681d4023185ccf04b215b7b69f3871cf63bc23e6f5be46388523cfd08db814f` and records:

- `INSTALLED_STARTED_AND_READY` on DEV265;
- migration ledger 169;
- 303/303 exact table-name match;
- 108/108 enabled trigger match;
- post-deployment canonical schema comparison `matches: true` for constraints, indexes, columns, functions, sequences/views and triggers;
- canonical manifest SHA-256 `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`;
- readiness green with exactly one exact-root worker.

The accepted DEV265 E2E evidence in `release-artifacts/dev265-preparation/e2e/` records all E-1 to E-4 checks passing, including the corrected E-3a foreign-key check. Therefore the current installed DEV265 schema is the canonical post-migration state. The DEV266 baseline must represent that state, not the historical pre-migration Step-3 drift.

All six files in `src/database-schema-baseline/` are now byte-identical to their unchanged counterparts in `src/database-schema-contract/`. Script evidence is in `DEV266_BASELINE_CANONICAL_VERIFICATION.json`; the common manifest SHA-256 is `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`. A no-migration test enforces all six byte comparisons. The historical DEV265 migration proof is now anchored to the immutable migration-169 SHA-256 and parsed 18 PK / 15 unique / 975 FK / 371 standalone-index counts, rather than to the mutable deployment baseline.

## Database and governance invariants

- PostgreSQL test server: 13.23.
- Synthetic fixture identity: migration ledger 169, 303 public tables, 108 user triggers.
- Baseline and expected migration counts in the config: 169 / 169. No migration will run.
- Baseline and canonical schema manifest hashes: both `496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`.
- Canonical schema contract files, trigger contract and all migrations are unchanged by the final baseline-sync commits.
- Trigger contract file SHA-256: `2c5ccb6df5a24e6b3040e56b02965de0c06874451b988cf7a014daf17aef38f4`; canonical trigger hash: `a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073`.
- Operator and helpers are unchanged:
  - operator: `3c47f64247750435ec7e1593de3c027a930e79ac96c5571ef30707c48db694cb`, commit `d7a5a347fc185ad21ae42d83b75203c690445bf6`;
  - schema helper: `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c`;
  - worker helper: `6bbb2833fbafcaf4f78d7a0f1269b4c0062c022c4292d594bcd40a7f61dae785`;
  - backup helper: `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215`;
  - trigger helper: `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd`.

## Test results

| Check | Result |
| --- | --- |
| Focused static/config/startup tests | 9/9 passed |
| PostgreSQL 13.23 route and concurrency, default 30 minutes | passed |
| PostgreSQL 13.23 route and exact expiry, non-default 10 minutes | passed |
| Full simulator flow with loopback deliberately unreachable | passed; expected paused-template fault remained visible |
| Exact final package, full app/router | health 200, readiness 200, `/` contains NYSA CORE; acquire 200, non-holder send 409, Manager release 200, post-release send 202; one outbound and zero blocked-message writes |
| Exact final package browser | Sales Agent, Manager and Director passed using the actual packaged `public/whatsapp-workspace-ui.js`; zero page or console errors |
| Governed release suite from the final GitHub commit | 1,672 tests; 1,570 passed; 102 skipped; zero failed |
| Mandatory package provenance verifier | passed |

The governed raw output is `DEV266_GOVERNED_TEST_OUTPUT.txt`. The exact test receipt is also embedded in the package manifest with output SHA-256 `1231568b2cf24e07e0a263c526a6eb19acff93865c8dbf6e3ba473b7e88f67d6`, 315 included test files and selection SHA-256 `676d036da33d8529fa2766ef8b793c76fd5ef2a3641c6724b0376158bfb2a723`.

The first direct worktree capture was sandbox-blocked on loopback connections and is retained as `DEV266_GOVERNED_TEST_OUTPUT_SANDBOX_BLOCKED.txt`; it is not release evidence. The governed origin builder and the final evidence run were executed with the required local loopback permission and both passed with the same 1,570/102/0 result.

## Four-phase deployment plan (not approved or executed)

The canonical operator and hosted-deployment controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` are acceptance criteria. Each phase requires separate written approval and one run only.

Preparation root: `/home/nysareal/crm-release-preparation/20261110-dev266`  
Scoped backup: `/home/nysareal/crm-release-preparation/20261110-dev266/scoped-backup-dev266-phased-run1-d7a5a34`

1. **Phase A — stage:** non-mutating origin/package/runtime/schema/config/worker preflight. Baseline and observed full schema must match the common `496377…3daa` manifest.
2. **Phase B — backup:** scoped CRM Test application archive plus PostgreSQL custom-format dump, verified for identity, SHA-256, contents, 303 exact tables and 108 triggers.
3. **Phase C — install:** stop all command/CWD-verified exact-root workers; require zero; install only the verified candidate; preserve the existing selector environment; validate the reply-lock configuration (default 30 when unset); run the migration runner, which must execute zero new migrations because ledger and expected count are both 169; controlled start; readiness green on DEV266; exactly one command/CWD-verified exact-root worker. Automatic rollback remains application-only and applies only before readiness becomes green; database restore requires separate approval.
4. **Phase D — settled smoke:** read-only, 30–60 seconds, recording every response attempt. Any failure stops and reports without restart, rollback or further change.

No server-side browser launch is permitted. Browser acceptance is run remotely after deployment. Production, website, REM, Meta and 360dialog remain out of scope.

## Build chronology and open item

- One origin build stopped because two historical DEV265 tests still depended on the now-superseded mutable pre-repair baseline. Only those test assertions were corrected; the immutable migration-169 artifact remains hash-pinned and its 33/371 split is parsed directly. The final governed build then passed.
- One build invocation supplied an incorrect full commit string and was rejected by the origin gate before checkout or artifact creation. The successful build used the exact `git rev-parse HEAD` value shown above.
- Future backlog suggestion: generate the next release baseline automatically from the last accepted release state. This packet records the suggestion, but the existing user-owned backlog edit was deliberately not modified or staged because this change was limited to baseline files, tests and config.

No package, config, database, worker, selector setting or application file has been uploaded to hosting. CRM Test and production remain unchanged.
