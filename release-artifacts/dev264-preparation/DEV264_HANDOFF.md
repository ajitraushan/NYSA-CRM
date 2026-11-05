# DEV264 handoff

## Current accepted baseline

CRM Test is accepted on `2.1.0-dev.264`, application commit
`8d9be904149bec1b9b6d56dd8a39f17c2789fd12`, migration 168 and 303 public
tables. The 108-trigger contract is restored and enabled. The simulator is
paused with fault mode `none`.

DEV264 acceptance is recorded in `DEV264_ACCEPTANCE.md`. Its known limitation
is the schema drift described in `schema-drift/STEP6_SCHEMA_DRIFT_REPORT.md` and
tracked as DEV265: 975 foreign keys, 18 primary keys, 15 unique constraints and
404 indexes are missing from CRM Test.

## Next governed work

1. Complete the separately authorised, checkpointed production read-only
   schema comparison. Identify Production's installed version/commit and build
   the reference schema from that exact commit and migration count. Do not use
   DEV264 as the Production reference unless Production itself proves to be on
   that commit.
2. Start DEV265 design only after Production checkpoint P-4. Migration 169 and
   the full-schema deployment preflight are design/build work only until their
   separate checkpoints are accepted.
3. Any deployment-operator change requires a GitHub commit, meaningful tests,
   hash verification and separate approval under `AGENTS.md` and the hosted
   deployment controls in `CRM_CHANGE_POLICY.md`.
4. No Phase A, production mutation, database repair or orphan cleanup is
   authorised by this handoff.

## Evidence boundary

The production audit is definitions-and-counts only, uses read-only PostgreSQL
sessions with a 60-second statement timeout and must not copy customer rows.
Any orphan/duplicate scan requires Ajit's explicit `continue` after its script
hash and query count are presented.
