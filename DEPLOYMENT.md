# NYSA CRM cPanel Deployment

## Application

- URL: `https://crm.nysarealty.com`
- Node.js: `24.16.0`
- Mode: `Production`
- Application root: `nysa-crm`
- Startup file: `src/server.js`

## Environment variables

Set these in the cPanel Node.js application. Do not place their values in source files.

```text
PGHOST=localhost
PGPORT=5432
PGDATABASE=nysareal_nysacrm
PGUSER=nysareal_nysacrmapp
PGPASSWORD=<private database password>
BOOTSTRAP_KEY=<private random value of at least 24 characters>
TRUST_PROXY=1
PGPOOL_MAX=3
```

cPanel sets `NODE_ENV=production` and the application port automatically.

## First release

1. Upload and extract the production archive into `nysa-crm`.
2. Confirm `package.json`, `package-lock.json`, `public`, and `src` are directly inside that directory.
3. Add the environment variables above.
4. Run NPM Install from the Node.js application page.
5. Restart the application.
6. Confirm `/api/health` returns `{ "ok": true, "database": "ready" }`.
7. Open the CRM and create the first administrator using the private bootstrap key.
8. Sign out and verify normal login.
9. Remove `BOOTSTRAP_KEY`, save the application settings, restart, and verify login again.

The application automatically applies pending files from `src/migrations` at startup. Never edit an applied migration; add a new numbered migration instead.

## Operations

- Back up PostgreSQL before each release.
- Test database restoration periodically.
- Keep cPanel AutoSSL active for `crm.nysarealty.com`.
- Keep application and database passwords out of screenshots and support tickets.
- Create a second controlled admin account after initial setup.
- Review the audit log and revoked accounts regularly.

## Health check

`GET /api/health` must return HTTP 200 with `{ "ok": true, "database": "ready" }`.

For the full release, backup, migration, smoke-test, rollback, and recovery
procedure, use [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md).
