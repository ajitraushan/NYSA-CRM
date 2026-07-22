# NYSA CORE R2.2 CRM Test Deployment

## Boundary

- Target: `https://crm-test.nysarealty.com/` only.
- Version: `2.0.0-dev.17`.
- Production and frozen Release 1.1 candidate `1001906` must not change.
- Full application package; migrations 040, 041 and 042 apply forward on startup.
- Never place the downloaded Google OAuth JSON, client secret, refresh token or integration
  encryption key inside the package, Git repository or deployment evidence.

## Secure CRM Test settings

Configure these in the cPanel Node.js application environment before running the installer:

```text
GOOGLE_CALENDAR_CLIENT_ID=<client ID from the downloaded JSON>
GOOGLE_CALENDAR_CLIENT_SECRET=<client secret from the downloaded JSON>
GOOGLE_CALENDAR_REDIRECT_URI=https://crm-test.nysarealty.com/api/integrations/google-calendar/callback
INTEGRATION_ENCRYPTION_KEY=<new random value of at least 32 characters>
```

Retain the existing PostgreSQL and application settings. Keep the encryption key stable after the
first Google connection; changing it makes the stored refresh token unreadable.

## Install

1. Upload the supplied ZIP and deployment script outside the public web root.
2. In the same secure shell session, export the existing `PGDATABASE`, `PGUSER`, `PGPASSWORD` and
   the four Google settings above. Do not save secrets in shell history.
3. Run:

```bash
bash deploy-crm-test-r2-2-dev17.sh /absolute/path/package.zip <PACKAGE_SHA256>
```

4. Restart the CRM Test Node.js application. Startup must apply migrations 040–042 atomically.
5. Confirm `/api/health` returns HTTP 200 and database ready.
6. Confirm the latest `schema_migrations.version` is
   `042_google_calendar_sync_reconciliation.sql` and reconcile brokers, contacts, leads, listings,
   opportunities and audit counts against the pre-deployment snapshot.

## Connect Google

1. Sign in to CRM Test as the full Administrator.
2. Open `/api/integrations/google-calendar/connect` in the same authenticated browser.
3. Sign in to `nysarealtyy@gmail.com`, accept the tester warning if shown, and approve Calendar
   access. Google must return to the exact configured callback.
4. Check `/api/integrations/google-calendar/status`; `connected` must be true and the account must
   be `nysarealtyy@gmail.com`.

## UAT

- With Google disconnected, complete matching, shortlist, viewing, attendance, feedback and
  follow-up using `.ics` only.
- Connect Google, create one Meet for a scheduled viewing and confirm exactly one event, customer
  and Agent invitations, Join Google Meet and Open Calendar controls.
- Repeat Create Google Meet and confirm no duplicate event.
- Reschedule the viewing and confirm the Google event time/location update.
- Cancel the viewing and confirm the linked Google event is cancelled.
- Force a recoverable sync failure, confirm the visible error, restore connectivity and use Retry
  calendar sync successfully.
- Run reconciliation and confirm CORE and Google agree while credentials remain absent from browser
  responses, logs and packaged files.

## Rollback

Stop the application, restore the application tarball and PostgreSQL custom dump created in the
reported backup directory, restore the unchanged secure environment, restart and verify health.
Database rollback is required because migrations 040–042 are forward-only; do not delete their
tables manually. Production remains out of scope.
