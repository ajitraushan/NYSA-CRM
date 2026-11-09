# DEV265 acceptance record

- Accepted by: Ajit
- Acceptance date: 9 November 2026
- Environment: CRM Test only
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_dev247_smoke`
- Version: `2.1.0-dev.265`
- Candidate commit: `ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`
- Migration: 169 (`169_restore_full_schema_contract.sql`)
- Public tables: 303
- Governed triggers: 108 enabled triggers across 93 tables

## Accepted scope

DEV265 restores and verifies the accepted CRM Test schema contract after the
DEV264 drift investigation. Migration 169 removed exactly the 12 synthetic
UAT264 simulator messages and five synthetic UAT264 notifications approved for
cleanup, then restored and verified:

- 975 foreign keys;
- 18 primary keys;
- 15 unique constraints; and
- 404 indexes, comprising 33 constraint-owned indexes and 371 standalone
  indexes.

The complete post-migration comparison matched canonical schema-contract
manifest SHA-256
`496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`.
Columns, functions, sequences/views and the 108-trigger contract also matched.
Migration 169 is recorded as the 169th migration, database readiness is green,
and the 303-table set is unchanged.

The deployed package was produced by the mandatory GitHub-origin builder and
verified before installation:

- origin package SHA-256:
  `99166cabaa57e7f69320a207e84b166e5a4957a12bf004572fc705fdc0e9ad2a`;
- package manifest SHA-256:
  `4184c3600b04eb72150c1d88e5b4033933b14f2e17a3108f940f59b75e61ca37`;
- canonical operator commit:
  `d7a5a347fc185ad21ae42d83b75203c690445bf6`;
- canonical operator SHA-256:
  `3c47f64247750435ec7e1593de3c027a930e79ac96c5571ef30707c48db694cb`;
- hosted schema helper SHA-256:
  `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c`.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory
hosted-worker verification in `AGENTS.md` remain acceptance criteria. This
acceptance records the completed release; it does not authorize another
deployment or production change.

## Four-phase deployment evidence

All receipt hashes below were generated directly from the retained local files
by the scripted hash index
`DEV265_ACCEPTANCE_RECEIPT_HASHES.json`; no hash was transcribed into that index
by hand. The hash index itself has SHA-256
`825c610a08252e374bc443d4014057c14b4153a17958474f561cca97cb71262a`.

| Phase/evidence | Result | SHA-256 |
|---|---|---|
| Phase A run 2 — `STAGE_RESULT.json` | `STAGED_AND_VERIFIED` | `741e258e01f65a66fdefd7e4cfd2fac7e141297f4555c01be582e15fc956e2de` |
| Phase B — `BACKUP_RESULT.json` | `SCOPED_BACKUP_VERIFIED` | `7a46ec873c2fe34dd4bccec4b3ccedaa567747467b564195b895087173f6f04f` |
| Phase B — `SCOPED_BACKUP_VERIFIED.json` | application and database backup contents verified | `3404e2ab53ed31fbfd49cbbe2dbc6b33559a473b26444c21ab0170a86e070fd7` |
| Phase C — `INSTALL_RESULT.json` | `INSTALLED_STARTED_AND_READY` | `0681d4023185ccf04b215b7b69f3871cf63bc23e6f5be46388523cfd08db814f` |
| Phase D — `SMOKE_RESULT.json` | `SETTLED_SMOKE_PASSED` | `5f560a56a9261971e9e7353cd01557c06320be6f7a722e72c0886dc4a6b8ec55` |

Phase D retained all eight HTTP attempts. The root, health and readiness checks
returned the expected success responses; unauthenticated protected endpoints
returned their expected 401 responses. At completion, readiness reported
`2.1.0-dev.265`, database `ready`, and exactly one command/CWD-verified worker:

- PID: `3525742`
- command: `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`
- cwd: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`

## Backup and rollback evidence

The verified CRM Test scoped rollback point is:

`/home/nysareal/crm-release-preparation/20261106-dev265-run2/scoped-backup-dev265-phased-run2-d7a5a34`

- application archive SHA-256:
  `706b529aa96449334e323c14d6580aedfbc86fef19e3a29cca3d79d0c38e05b2`;
- PostgreSQL custom dump SHA-256:
  `a99fbaa179acf3ea68410c1ffa85a204e84fee7213990e2d094189ae4544a533`;
- PostgreSQL client/server contract: 13.23 compatible;
- dump verification: 303 table names and 108 triggers matched the live
  pre-install baseline.

Automatic rollback remained application-only. No database restore was run.

## E2E acceptance

Ajit accepted DEV265 E2E cases E-1 through E-4 on 9 November 2026. The retained
database rollback evidence records E-2a, E-2b and E-3b through E-3e passing.
The first combined script's E-3a line was a test-script defect: its task fixture
omitted `contact_id` and reached a not-null rule before the intended foreign-key
check. The separately approved corrected E-3a script supersedes only that line
and passed with the intended result:

`RESULT|E-3a|PASS|sqlstate=23503 constraint=tasks_lead_id_fkey`

Both database scripts ended in `ROLLBACK`; no E2E data persisted.

| E2E evidence | SHA-256 |
|---|---|
| `dev265-e2e-db-checks-rollback.sql` | `225acb3c7128a1154549f3f82fd330302beb8f6eea4427c481b08d1b7d88098f` |
| `DEV265_E2E_DB.txt` | `e001881fe2152b784d21cd3c0c19db8d636b99458e424e7aee09f8eca5c89f49` |
| `dev265-e2e-e3a-rollback.sql` | `6db9a5134a9ae8abff7588f13e4cc32db2b35c5bd2d9a2c41a812eabf0398a3c` |
| `DEV265_E2E_E3A.txt` | `1bd16aac42edd99a435d38fccd72329e32285c6d4c8e61d60588b1d50ee6751f` |

## Known limitations carried forward

- The operator receipts report full-schema `matches: true`, but their schema
  object summaries do not include populated expected/observed object counts.
  This is an evidence-schema improvement, not an accepted schema mismatch.
- The Offer integration defects in
  `dev158_business_conditions_section3.integration.test.js` and
  `dev159-uat067-068-real-db.integration.test.js` were reproduced identically
  on DEV264/PostgreSQL 13.23 and remain tracked as pre-existing test defects.
  DEV265 did not weaken Offer rules.
- Deferred cases D-01 through D-12 and WhatsApp cases WN-01 through WN-16 and
  WL-01 through WL-05 remain deferred. Acceptance does not convert them to
  passes.

## Environment and security boundary

The accepted mutation was restricted to CRM Test and the exact synthetic
cleanup plus schema restoration above. No credential or customer data is
included in this record. Production, the website, REM, Meta, 360dialog and live
messaging were unchanged.
