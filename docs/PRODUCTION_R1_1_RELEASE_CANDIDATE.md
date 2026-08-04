# Release 1.1 production candidate — HOLD

This is a preparation record, not production deployment authorization. Testing and deployment
remain limited to `https://crm-test.nysarealty.com/`. Do not run production deployment commands
until every remaining Release 1/1.1 gate is reconciled, the exact commit is approved for `main`,
and the NYSA owner separately authorizes production. R1.1-UAT-030 is accepted, but that
finding-level acceptance does not by itself authorize production.

## Candidate identity

- Status: Built and verified; HOLD — do not deploy without separate production authorization.
- Source commit: `1001906`
- File: `nysa-core-r1-1-production-candidate-1001906.zip`
- SHA-256: `d77192894c6d9996a84c6c928784d0b3280986f6eec4b969687e2194c6d11fe5`
- Archive policy: explicit tracked-source allowlist; `.git`, `.env`, `node_modules`, output,
  release artifacts, dumps and logs excluded
- Entries: 138
- Included migrations: numbered migrations through `037_listing_mapping_governance.sql`

## Promotion gates

1. Completed 2026-07-22: deploy Revision 4 to CRM Test using the dedicated Agent lifecycle instructions.
2. Completed 2026-07-22: record 156/156 automated tests and explicit `R1.1-UAT-030` acceptance.
3. Reconcile every other Release 1 and 1.1 item still marked open or pending in the committed
   acceptance, finding and scope documents. User recollection alone does not replace the ledger.
4. Merge/approve the exact release commit on `main` according to the working agreement.
5. Create a fresh production PostgreSQL custom-format backup, verify it with
   `pg_restore --list`, download an off-server copy and record its SHA-256.
6. Restore that backup into an isolated test database and prove migrations through 037 plus
   critical row-count, constraint, permission and workflow reconciliation.
7. Confirm required production environment-variable names without displaying secret values.
8. Approve a maintenance window, operator, rollback archive and rollback decision.

## Production cPanel command plan — do not execute while HOLD applies

After separate production authorization, use the production runbook and these resolved values:

```bash
APP_ROOT="/home/nysareal/nysa-crm"
NODE_BIN="/home/nysareal/nodevenv/nysa-crm/24/bin/node"
PACKAGE="/home/nysareal/nysa-core-r1-1-production-candidate-1001906.zip"
STAGE_DIR="/home/nysareal/nysa-r1-1-production-1001906-stage"
```

Verify the package before any backup or file change:

```bash
sha256sum "$PACKAGE"
```

Expected SHA-256:

```text
d77192894c6d9996a84c6c928784d0b3280986f6eec4b969687e2194c6d11fe5
```

The separately authorized production run must then follow `docs/DEPLOYMENT_RUNBOOK.md` in
order: verified database backup, isolated restore/migration rehearsal, staged archive
validation, versioned code backup, controlled file promotion, cPanel dependency action if
required, one restart, migration evidence, health/login/role/workflow smoke tests and rollback
readiness. No production command in this document overrides those gates.
