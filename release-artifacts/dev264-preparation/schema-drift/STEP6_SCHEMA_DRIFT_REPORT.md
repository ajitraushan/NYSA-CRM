# DEV264 schema-drift investigation — Checkpoint 6

- Date: 5 November 2026
- Environment: CRM Test (`nysareal_nysa_dev247_smoke`)
Scope: report and fix outline only; no remediation performed

## Conclusion

Schema drift is confirmed. Compared with a PostgreSQL 13 schema rebuilt from the same 168 migrations, CRM Test is missing 1,008 constraints and 404 indexes. No extra or changed constraints were found. Column, function, sequence and view definitions match after normalising function line endings.

## Step 4 comparison

| Object | Expected | Actual | Missing | Extra | Changed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foreign keys | 981 | 6 | 975 | 0 | 0 |
| Primary keys | 303 | 285 | 18 | 0 | 0 |
| Unique constraints | 275 | 260 | 15 | 0 | 0 |
| Check constraints | 1,145 | 1,145 | 0 | 0 | 0 |
| Indexes | 956 | 552 | 404 | 0 | 0 |
| Columns | 4,043 | 4,043 | 0 | 0 | 0 |
| Functions | 50 | 50 | 0 | 0 | 0 after full-definition CR normalisation |
| Sequences/views | 7 | 7 | 0 | 0 | 0 |

## Step 5 data compatibility

The single read-only run completed all 1,008 checks without an error or timeout.

| Type | Checks | Non-zero checks | Finding |
| --- | ---: | ---: | --- |
| Foreign keys | 975 | 2 | 17 orphan rows |
| Primary keys | 18 | 0 | No duplicate key values and no NULL primary-key rows |
| Unique constraints | 15 | 0 | No duplicate key values |

The only non-zero checks are approved UAT264 simulator test data:

- `wa_conversation_messages_conversation_id_fkey`: 12 orphan message rows.
- `wa_inbox_notifications_conversation_id_fkey`: 5 orphan notification rows.

Raw Step 5 output SHA-256: `8c68ed3541dac411f11d3c0d3b44f5dcc77229cf211079c48833ffc6eb25851c`.

## Most likely loss mechanism and timing

The most likely cause is an interrupted or incomplete PostgreSQL post-data restore/schema rebuild during the previously bounded 1 November 21:51 to 2 November 02:35 Dubai-time window.

This is an inference from the object pattern, not a recovered command log:

- Primary-key and unique-constraint restoration stops at the alphabetical boundary `wa_inbox_notifications`; the 18 missing primary keys and 15 missing unique constraints start there and continue through later table names.
- All 404 ordinary indexes and essentially all original foreign keys are absent, consistent with later post-data phases never being reached.
- The six foreign keys present on CRM Test belong to later WhatsApp simulator migrations applied after the loss, not proof that the original foreign-key phase completed.
- Check constraints, columns, functions, sequences and views remain complete, consistent with the pre-data/table-definition portion completing.
- Triggers were also absent before DEV264 restored their contract, another post-data object class consistent with the same interrupted operation.
- There are no extra or definition-changed constraints, which makes piecemeal application edits less likely than an incomplete ordered restore.

The exact command and interruption point are unavailable, so this cause must remain labelled **most likely**, not proven.

## Proposed DEV265 fix outline

1. **Remove only the approved UAT264 simulator orphans first.** Delete the identified 12 `wa_conversation_messages` rows and 5 `wa_inbox_notifications` rows using an explicit, reviewed identity list or equally narrow UAT264 provenance predicate. Verify expected counts before deletion and fail closed if they differ.
2. **Restore primary-key and unique constraints.** Recreate the missing 18 primary keys and 15 unique constraints from the canonical PostgreSQL-13 schema contract. Recheck duplicates and primary-key NULLs immediately before creation.
3. **Restore foreign keys.** Recreate all 975 missing foreign keys from the canonical contract only after the key constraints exist. Require the orphan scan to return zero immediately before creation.
4. **Restore indexes.** Recreate all 404 missing indexes from their canonical definitions after constraints are restored.
5. **Verify the complete contract in the same migration.** Fail the migration unless constraints, indexes, triggers, columns, functions, sequences and views exactly match their expected definitions and enabled states.
6. **Make the migration idempotent and fail closed.** Existing matching objects are accepted; missing or mismatched objects are handled only according to the reviewed canonical definition; unexpected objects or data violations abort the transaction.
7. **Strengthen deployment preflight.** Compare the full schema contract before deployment, not only migration count, table count and triggers. Any missing, extra or changed governed object blocks deployment.
8. **Regression and recovery verification.** Rebuild all migrations on PostgreSQL 13, reproduce the drifted state, apply DEV265, test a second application for idempotency, run governed database tests, and verify an application-only rollback does not claim to undo a committed database migration.

This is an outline only. No migration, code, package or hosted change is authorised by this report.

## Production recommendation

Production should receive the same read-only expected-versus-actual schema-contract comparison because the loss pattern is consistent with a restore process that could have been reused. Do not run it until Ajit separately approves the exact read-only scripts and evidence destination.

## State at checkpoint

The Step 5 database session was read-only and rolled back. This investigation made no CRM Test application, database, selector, worker or simulator-setting change. CRM Test remains on the DEV264 baseline; the simulator remains paused. Step 6 stops here pending approval of any remediation work.
