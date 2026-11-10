# DEV266 acceptance record

- Accepted by: Ajit
- Acceptance date: 10 November 2026
- Environment: CRM Test only
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_dev247_smoke`
- Version: `2.1.0-dev.266`
- Candidate commit: `1abd17771a5dda3be4b5108a6453e70438ad3ed0`
- Migration ledger: 169; DEV266 added no migration
- Public tables: 303
- Governed triggers: 108 enabled triggers across 93 tables

## Accepted scope

DEV266 corrected the PostgreSQL 13 reply-lock `42P08` failure, enforced the
approved active-lock-holder sending rule, added governed Manager/Director lock
release, serialized concurrent acquisitions, and made expiry configurable by
`WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES` with an unset default of 30 minutes.
Ajit accepted the release after the four canonical deployment phases and
WhatsApp round-two testing on CRM Test.

The deployed package was produced and verified through the mandatory
GitHub-origin builder:

- package SHA-256:
  `5bf0479e9be519d708c8b94a076975c24caec93718c2550161badab450e112b5`;
- manifest SHA-256:
  `b760f9dd3a9201017a3fc7aa00ddc5b954de4c1969e7aa7dbfd9cd7ad800c0c8`;
- configuration SHA-256:
  `6c44f4625e916cd2c5dac344b093051abf4e7f16cf0db9b4f793647a289062f3`;
- canonical operator commit:
  `d7a5a347fc185ad21ae42d83b75203c690445bf6`;
- canonical operator SHA-256:
  `3c47f64247750435ec7e1593de3c027a930e79ac96c5571ef30707c48db694cb`;
- hosted schema helper SHA-256:
  `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c`.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory
hosted-worker verification in `AGENTS.md` remain acceptance criteria. This
record does not authorize another deployment or any production change.

## Four-phase evidence

The receipt values below were generated from the retained local files with
PowerShell `Get-FileHash -Algorithm SHA256` and cross-checked against each
receipt's candidate identity and result. The structured index is
`DEV266_ACCEPTANCE_RECEIPT_HASHES.json`, SHA-256
`15c0bc61b882c85a31a58922e451ac54369a5234219375912995ecd0eec08608`.

| Evidence | Result | SHA-256 |
|---|---|---|
| `STAGE_RESULT.json` | `STAGED_AND_VERIFIED` | `2224dee5e3cbd5e9820e323fe1ca18e22514f0a97380992a138ac2e182af0186` |
| `BACKUP_RESULT.json` | `SCOPED_BACKUP_VERIFIED` | `dc6835a6deb720e90bca52edbfded7ef0f27599d5c86d3a4a7e17ba00991d61e` |
| `SCOPED_BACKUP_VERIFIED.json` | app and database backup verified | `304850a01a610739eed2f4f518724aec53cd3fb758f358561e8664b5efc69e4e` |
| `INSTALL_RESULT.json` | `INSTALLED_STARTED_AND_READY` | `167e54e024f6c5a84ef7eea66dbfb4a200392817b8240942652e404c0b9c05e0` |
| `SMOKE_RESULT.json` | `SETTLED_SMOKE_PASSED` | `5cb05ffeb38642152f8bcfdc5165faea20a63a0eea11a64632e4b7449c0d9483` |

Phase D retained eight HTTP attempts. `/`, health and readiness returned 200;
the protected unauthenticated checks returned their expected 401 responses.
Readiness reported DEV266 with the database ready. Exactly one exact-root worker
remained at completion:

- PID: `2100505`
- command: `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`
- cwd: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`

## Database and rollback evidence

The pre-install and post-install full schema comparisons matched canonical
manifest SHA-256
`496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`.
The ledger remained 169, the exact table-name set remained 303, and all 108
governed triggers matched their expected name, table, function and enabled
state.

The verified CRM Test rollback point is:

`/home/nysareal/crm-release-preparation/20261110-dev266/scoped-backup-dev266-phased-run1-d7a5a34`

- application archive SHA-256:
  `074dda295832e7c221c12dc2d13354c0193a68623ad5a195b68509f259d07b8f`;
- PostgreSQL custom dump SHA-256:
  `cfdbaa5f271d51478637adf445eea55a6ea4246fd95295065629750a982e412e`;
- PostgreSQL client and server: 13.23;
- verified: 303 exact tables, 108 triggers and complete schema contract.

No automatic database restore was run. Production, website, REM, Meta and
360dialog were unchanged.

## Build and test evidence

The governed release suite recorded 1,672 tests: 1,570 passed, 102 explicitly
skipped and zero failed. The exact package passed full-route and actual packaged
browser checks for Sales Agent, Manager and Director. PostgreSQL 13.23 receipts
cover default 30-minute locking, the non-default 10-minute setting, concurrency
and the simulator flow. Skips remain skips; this acceptance does not convert
them into passes.

## Round-two result and carried work

Ajit accepted DEV266 but the round-two test found D-A: a later recipient import
could bypass an existing STOP suppression because new rows were inserted as
`not_suppressed` and eligibility read only the row flag. D-A is therefore a
high-severity go-live blocker assigned to DEV267 together with Prospect Diary
and one shared suppression store/reader. The synthetic CRM Test records used to
reproduce D-A are deliberately retained for DEV267 retest.

The following remain in DEV268, after DEV267 acceptance:

- campaign retirement;
- local formatting of the reply-lock expiry pill;
- consistent 404 responses for out-of-scope conversation lock access; and
- removal of the internal material storage key from list responses.

Intermittent Chrome Admin session drops remain a watch item. They are not
recorded as an accepted DEV266 application defect without a reproducible server
failure.
