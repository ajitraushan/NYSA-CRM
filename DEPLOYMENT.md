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
WEBSITE_INTAKE_SECRET=<private random value of at least 32 characters>
WEBSITE_INTAKE_ACTOR_ID=<active internal broker UUID>
PRIVATE_STORAGE_DIR=<private absolute directory outside public and source control>
MAX_MEDIA_BYTES=8388608
MAX_DOCUMENT_BYTES=10485760
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

## Release 1 CRM upgrade

1. Back up the PostgreSQL database before replacing application files.
2. Deploy the new `public`, `src`, `test`, `package.json`, and `package-lock.json` contents.
3. Run NPM Install and restart the application.
4. Startup applies pending numbered migrations `002` through `009` transactionally and records each in `schema_migrations`. Existing brokers, sessions, listings, comments, invitations, and CRM records are retained.
5. Sign in as an administrator, create CRM teams, and assign internal staff to them.
6. Run `npm test`, `npm audit --omit=dev --audit-level=high`, and the authenticated PostgreSQL workflow suite.
7. Complete every open gate in `docs/RELEASE_1_ACCEPTANCE_STATUS.md` and the Phase 1 acceptance checks below.

### Phase 1 acceptance checks

- Create and update a company and link a customer to it.
- Create a lead with a related inventory listing, qualification, source, budget, team, and assignee.
- Claim an unassigned lead, accept an assignment, and verify an expired assignment appears in the manager reassignment queue.
- Change stages and confirm a reason is required when moving a lead to Lost.
- Add each activity type, create a reminder, and download a calendar event.
- Open the customer email, telephone, and WhatsApp handoffs and record email/phone verification.
- Run the mortgage calculator and confirm its repayment, cash requirement, and affordability results.
- Create, view, and print a value brief and verify the rental-yield/ROI result.
- Check pipeline, source, activity, agent, movement, call, and closed-lead reports.
- Confirm partner-broker and viewer accounts cannot access customer CRM APIs.

Do not give partner-broker or viewer accounts CRM customer access. Release 1 enforces this in the API as well as the browser navigation.

The application automatically applies pending files from `src/migrations` at startup. Never edit an applied migration; add a new numbered migration instead.

Email and WhatsApp actions are client handoffs, calendar events use ICS downloads, and verification is an authorized manual status in Release 1. Configure and test separate providers before advertising automated messaging, synchronization, or third-party identity verification.

## Operations

- Back up PostgreSQL before each release.
- Test database restoration periodically.
- Keep cPanel AutoSSL active for `crm.nysarealty.com`.
- Keep application and database passwords out of screenshots and support tickets.
- Create a second controlled admin account after initial setup.
- Review the audit log and revoked accounts regularly.

## Health check

`GET /api/health` must return HTTP 200 with `{ "ok": true, "database": "ready" }`.
