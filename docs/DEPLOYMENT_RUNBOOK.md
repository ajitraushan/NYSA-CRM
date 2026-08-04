# NYSA CRM Deployment and Recovery Runbook

## Production Identity

- Application URL: https://crm.nysarealty.com
- Health URL: https://crm.nysarealty.com/api/health
- cPanel application root: `/home/nysareal/nysa-crm`
- Startup file: `app.cjs`
- Node.js: 24.16.0
- Mode: Production
- PostgreSQL database: `nysareal_nysacrm`
- PostgreSQL application user: `nysareal_nysacrmapp`

Never place passwords, session tokens, private keys, customer data, or backup
contents in this document, Git, screenshots, or support tickets.

## Production Environment Variables

Required names:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
PGPOOL_MAX
TRUST_PROXY
```

Current non-secret production values:

```text
PGHOST=localhost
PGPORT=5432
PGDATABASE=nysareal_nysacrm
PGUSER=nysareal_nysacrmapp
PGPOOL_MAX=3
TRUST_PROXY=1
```

`BOOTSTRAP_KEY` is used only when creating the first administrator in an empty
database. Remove it, save, and restart immediately after setup. Do not add it
again to an initialized production database.

cPanel supplies `NODE_ENV=production` and the application port.

## Release Inputs

Every deployment must identify:

- Approved Git commit
- Release scope and acceptance criteria
- New or changed environment-variable names
- New migrations and expected effects
- Dependency changes
- Backup filename and verification result
- Deployment operator and start time

## Pre-Deployment Checklist

1. Confirm the local repository is `C:\Users\ajitr\Projects\NYSA-CRM`.
2. Fetch GitHub and confirm the intended commit is on `main`.
3. Confirm the working tree is clean.
4. Review the diff from the currently deployed commit.
5. Run syntax, automated tests, dependency audit, and migration tests.
6. Test forward migration against an isolated restored production backup.
7. Confirm the hosting account has sufficient disk space.
8. Confirm environment-variable names are present without displaying secret values.
9. Create and verify a fresh PostgreSQL backup.
10. Record a rollback decision for code and schema.

Do not deploy if the database backup is empty, unreadable by `pg_restore --list`,
or retained only on the production server.

## Manual PostgreSQL Backup

From cPanel Terminal, create a private directory once:

```bash
mkdir -p ~/crm-backups
chmod 700 ~/crm-backups
```

Create a custom-format backup. Substitute the actual release date in the filename:

```bash
pg_dump --host=localhost --port=5432 --username=nysareal_nysacrmapp --dbname=nysareal_nysacrm --format=custom --file="$HOME/crm-backups/nysacrm-YYYY-MM-DD.dump"
```

Enter the database password at the invisible prompt. Never place it in the command.

Verify:

```bash
echo $?
ls -lh ~/crm-backups/nysacrm-YYYY-MM-DD.dump
pg_restore --list ~/crm-backups/nysacrm-YYYY-MM-DD.dump | head -n 25
```

Expected exit status is `0`, the file must be non-empty, and the restore list
must include schema and table-data entries. Download a copy off the server and
record its SHA-256.

The hosting-level scheduled PostgreSQL backup remains an operational dependency
until Tasjeel confirms `PSQLBACKUP`, frequency, retention, off-server storage,
failure notification, and restore procedure.

## Migration Verification

For a release with schema changes:

1. Create a separate restore-test database in cPanel.
2. Grant the application database user access to that test database.
3. Restore the latest custom dump using `--no-owner --no-privileges`.
4. Point a controlled test process at the restored database.
5. Apply the new migration and run workflow/data reconciliation checks.
6. Record row-count and constraint checks relevant to the release.
7. Delete only the clearly named restore-test database after approval.

Never test restore or experimental migrations against `nysareal_nysacrm`.

## Build the Deployment Archive

The archive must contain source and runtime metadata only:

```text
public/
src/
package.json
package-lock.json
README.md
DEPLOYMENT.md
```

Exclude:

```text
.git/
node_modules/
.env*
*.db*
*.dump
*.sql outside src/migrations/
*.log
crm-backups/
generated customer files
```

Use an archive tool that stores forward-slash paths and inspect the archive list
before upload. Record its SHA-256 with the release.

## cPanel Deployment

1. Enter a short maintenance window if the release changes schema or critical workflows.
2. Upload the verified archive to the cPanel home directory.
3. Extract into a new versioned staging directory or carefully overwrite the
   application files according to the approved release plan.
4. Confirm `package.json`, `package-lock.json`, `public`, and `src` are directly
   inside the application root.
5. Confirm the startup file is `app.cjs`. The CommonJS wrapper dynamically imports
   the ESM server entry for LiteSpeed/CloudLinux compatibility.
6. Confirm environment-variable names remain present.
7. Run NPM Install only when dependencies or the clean runtime installation require it.
8. Save cPanel application settings.
9. Restart the Node.js application once.
10. Wait for startup migration and inspect `stderr.log` if startup fails.

Do not repeatedly restart a failing application before reading the latest error.

## Production Verification

### Immediate

1. Open `/api/health` and confirm HTTP 200 with database ready.
2. Confirm TLS has no browser warning.
3. Log in with a controlled administrator account.
4. Confirm dashboard and existing inventory load.
5. Review `stderr.log` for new startup errors without exposing secrets.

### Release workflow smoke test

Run a controlled test for every changed workflow. For Release 1 this includes:

- Create and find a test contact
- Create, assign, accept, and move a test lead
- Record activity and complete a task
- Verify SLA and role scope
- Calculate a saved scenario
- Generate a test proposal
- Archive or close the test data according to audit policy

Confirm production health again after the smoke test.

## Rollback and Recovery

### Code-only failure

If no incompatible migration ran:

1. Restore the prior verified application archive or deploy the prior approved commit.
2. Keep the existing environment variables.
3. Restart once.
4. Verify health, login, and the affected workflow.

### Migration failure before application start

1. Stop further restarts.
2. Preserve logs and record the exact migration error.
3. Determine whether the migration transaction rolled back cleanly.
4. Prefer a reviewed forward-fix migration when production data remains consistent.
5. Restore the database only when the approved recovery decision requires it.

### Database restoration

Database restoration is a high-impact operation:

1. Confirm the incident and restoration point with NYSA ownership.
2. Preserve the failed/current database before replacement where feasible.
3. Verify backup hash and `pg_restore --list`.
4. Restore into an isolated database first and reconcile critical records.
5. Schedule the production cutover and document expected data loss window.
6. Update application database configuration only through cPanel secrets.
7. Verify migrations, health, login, permissions, and business counts.

Do not delete or rename the production database during diagnosis without an
approved recovery plan.

## Incident Checklist

- Record detection time, reporter, symptoms, and affected users.
- Check health endpoint and `stderr.log`.
- Determine application, database, TLS/DNS, storage, or external-provider scope.
- Avoid sharing secrets in incident messages.
- Preserve evidence before changing configuration.
- Communicate status and next update time.
- After recovery, record cause, corrective action, owner, and prevention item.
- Update this runbook and acceptance tests when the incident reveals a gap.

## Routine Operations

- Daily: health awareness and failed-login/error review when monitoring is available
- After material data entry until scheduled backup is confirmed: create and download a fresh dump
- Before every release: verified backup and isolated migration test
- Monthly: access, revoked users, privileged roles, audit anomalies, and disk usage
- Quarterly: restore rehearsal, dependency review, incident contacts, and recovery procedure
- On staff departure: revoke access and sessions immediately, then review ownership reassignment

## Release Record Template

```text
Release:
Git commit:
Operator:
Start/end time:
Backup filename and SHA-256:
Migration test result:
Archive SHA-256:
Health result:
Smoke-test result:
Errors or exceptions:
Rollback required: yes/no
Documents updated:
```
