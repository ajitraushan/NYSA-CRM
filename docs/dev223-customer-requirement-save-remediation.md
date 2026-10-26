# DEV223 Customer documents save remediation

Date: 2026-10-08 (Asia/Dubai). Target: restricted local synthetic PostgreSQL fixture only.

## Recorded baseline and rollback

- Application/source: 2.1.0-dev.223, commit `5b051e35fef8dfd12d03d05c25e810728ad3e961`.
- Tracked source was clean; three untracked user letterhead DOCX files and `designs/` were preserved.
- CRM Test baseline supplied by the prior chat: DEV223, migration 133 (133 total), package SHA-256 `6cd68f119802c0aa788a51a6e79ab846bfa1c4c66f0f6b6d85a221b8afc1bd47`, server backup `/home/nysareal/crm-backups/consolidated-crm-test-dev223-20261008T033530Z`. No remote verification or deployment was performed in this chat.
- Before fixture mutation, restricted-role/loopback checks passed and a recoverable pg_dump was created and verified with pg_restore --list: `uat-evidence/fixture-backup-2026-10-08T03-44-16-793Z/before-commission-proof.dump`, 1,450,555 bytes, SHA-256 `950c6a1d49d9c0369b751b896b2673b1ce6325786971282e081a02238c13a45e`.
- Source rollback: revert this remediation against the recorded commit. Fixture rollback: restore the verified dump to the dedicated fixture using the governed restore workflow. A deployed downgrade must preserve audit history; do not delete new audit events merely to reinstate the old allow-list.

## Reproduction and cause

Authenticated synthetic POST requests to `/api/admin/customer-document-requirements` for both Individual and Corporate requirements returned HTTP 500 before the fix. PostgreSQL returned SQLSTATE `23514`, constraint `audit_log_entity_type_check`, from the `audit('CustomerDocumentRequirement', ...)` call. The requirement insert and audit are in one transaction, so the audit rejection rolled back the save. Domain-only tests never exercised this database guard.

DEV223 migration 133 introduced CustomerDocumentRequirement, CustomerIdentityDocument and CompanyIdentityDocument audit producers without extending the existing entity allow-list. The latter two are also affected by the same omission; their audit inserts are covered directly by the regression test.

## Changes

- `src/migrations/134_customer_identity_audit_types.sql`: preserve the existing constraint expression and add exactly the three introduced audit entities. Fail closed if the expected constraint is absent. No changes to requirement business rules, ownership, permissions, review policy or integration contracts.
- `public/index.html`: scoped flex alignment and 16px checkbox sizing under Customer documents; prevents the global full-width input rule from stretching checkboxes.
- `test/dev223-customer-requirement-save.integration.test.js`: gated restricted local fixture HTTP/database coverage for both customer kinds, authentication, non-admin denial, invalid groups, persisted groups/types/minimum/version/creator, audit persistence, duplicate drafts, activation, revision, supersession, retirement, unknown audit entity rejection and transactional migration rollback. Synthetic rows are cleaned up.

## Verification

- Before migration: both HTTP save regressions failed with the confirmed 500/23514.
- Local fixture migration runner: 134 applied, one newly applied migration.
- Dedicated database test: 4 passed, 0 failed. Run with `NYSA_RUN_CUSTOMER_REQUIREMENT_DB_INTEGRATION=1`, `node --env-file=.env --test --test-isolation=none test/dev223-customer-requirement-save.integration.test.js`.
- `npm test`: 1,663 tests; 1,576 passed; 87 skipped; 0 failed. Existing opt-in integration tests remain gated. Receipt: `uat-evidence/dev223-remediation-regression.log`.
- Database receipt: `uat-evidence/dev223-remediation-db.log`.
- Headless Chrome synthetic render at 1280px and 390px: checkbox widths 16px, parent labels flex-aligned; mobile screenshot visually inspected. Evidence: `uat-evidence/dev223-checkbox-1280.png` and `uat-evidence/dev223-checkbox-390.png`.
- `git diff --check` passed.

Security/privacy: audit validation remains enabled and rejects unknown entities; existing allowed entities remain allowed. Tests use synthetic identities and expose no credentials or customer records. No production data was read or copied.

Production state: no package, push or deployment; no production/R2 changes. CRM Test remains on DEV223/migration 133. This is an uncommitted source remediation, not a releasable package. A future release requires a committed/pushed exact origin SHA, canonical packaging and provenance verification, plus explicit deployment authorization in this chat.
