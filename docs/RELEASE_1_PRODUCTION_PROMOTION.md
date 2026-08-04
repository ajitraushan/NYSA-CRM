# Release 1 Production Promotion

## Decision

NYSA accepted Release 1 on 2026-07-19 for controlled promotion from CRM Test to
production. Production is `https://crm.nysarealty.com`; CRM Test remains
`https://crm-test.nysarealty.com`.

Promotion uses one consolidated package. Historical CRM Test hotfix archives must
not be replayed one by one.

## Package boundary

Include only:

- `app.cjs`
- `package.json`
- `package-lock.json`
- `public/`
- `src/`, including migrations `001` through `026`
- `README.md` and `DEPLOYMENT.md`

Exclude:

- `.env`, `.env.example` and credentials
- `.git`, `node_modules`, tests and fixture/seed scripts
- `tmp`, `outputs`, `release-artifacts` and CRM Test reports
- uploads, private storage, generated PDFs and customer documents
- logs, dumps, backups and database contents
- CRM Test identities, passwords and synthetic records

CRM Test records are stored in `nysareal_nysacrm_r1test`; they are not part of the
source package and must never be exported or restored into production.

## Required gates

1. Freeze and record the exact accepted Git commit.
2. Pass syntax checks and the complete local automated suite.
3. Inspect the archive manifest and scan it for excluded paths and likely secrets.
4. Back up the production application and `nysareal_nysacrm`; verify both backups.
5. Restore the production database backup into a separately named rehearsal database.
6. Run the consolidated application against the rehearsal restore and confirm that
   migrations `011` through `026` apply exactly once.
7. Reconcile critical production row counts and perform authenticated role/workflow
   smoke tests against the rehearsal environment.
8. Only after rehearsal passes, deploy the same verified archive to
   `/home/nysareal/nysa-crm`, preserving production environment variables and private
   storage.
9. Restart the production Node.js application once, verify `/api/health`, confirm
   migrations and run a read-only production smoke test using existing authorized
   accounts and records.
10. Record the deployed commit, archive SHA-256, backup hashes, migration evidence,
    operator, timestamps and smoke-test result in `docs/DEPLOYMENT_HISTORY.md`.

## Stop conditions

Do not promote if the production backup is empty or unverified, the rehearsal restore
is unavailable, any migration fails, the archive contains an excluded path, health is
not database-ready, or authenticated scope checks fail. Production must not be used as
the migration rehearsal environment.

Do not create synthetic contacts, leads, inventory, proposals, tasks or users as a
production smoke test. A production write is permitted only when it is a genuine
business transaction entered by an authorized user.
