# Release 1.1 production candidate — HOLD

This is a preparation record, not production deployment authorization. Testing and deployment
remain limited to `https://crm-test.nysarealty.com/`. Do not run production deployment commands
until R1.1-UAT-030 is accepted on CRM Test, every remaining Release 1/1.1 gate is reconciled,
the exact commit is approved for `main`, and the NYSA owner separately authorizes production.

## Candidate identity

- Source commit: `4c8266b`
- File: `nysa-core-r1-1-production-candidate-4c8266b.zip`
- SHA-256: `39cf70b695ebde22ff3d0801c46fcfe44e6fbadc4c15542fee6ef4fb3f73dfaf`
- Archive policy: explicit tracked-source allowlist; `.git`, `.env`, `node_modules`, output,
  release artifacts, dumps and logs excluded
- Entries: 138
- Included migrations: numbered migrations through `037_listing_mapping_governance.sql`

## Promotion gates

1. Deploy commit `4c8266b` to CRM Test using the dedicated Agent lifecycle instructions.
2. Record 155/155 deployed automated tests and explicit `R1.1-UAT-030` acceptance.
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
PACKAGE="/home/nysareal/nysa-core-r1-1-production-candidate-4c8266b.zip"
STAGE_DIR="/home/nysareal/nysa-r1-1-production-4c8266b-stage"
```

Verify the package before any backup or file change:

```bash
sha256sum "$PACKAGE"
```

Expected SHA-256:

```text
39cf70b695ebde22ff3d0801c46fcfe44e6fbadc4c15542fee6ef4fb3f73dfaf
```

The separately authorized production run must then follow `docs/DEPLOYMENT_RUNBOOK.md` in
order: verified database backup, isolated restore/migration rehearsal, staged archive
validation, versioned code backup, controlled file promotion, cPanel dependency action if
required, one restart, migration evidence, health/login/role/workflow smoke tests and rollback
readiness. No production command in this document overrides those gates.
