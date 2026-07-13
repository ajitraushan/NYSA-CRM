# NYSA Realty CRM - Phase 1

Private, invitation-gated real-estate inventory and broker collaboration application.

## Runtime

- Node.js 22.13 or newer
- PostgreSQL

Configure `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`, then run:

```bash
npm install
npm start
```

The server applies numbered SQL migrations from `src/migrations` before accepting traffic. An empty database opens a one-time first-administrator setup screen protected by `BOOTSTRAP_KEY`.

## Implemented

- Dashboard-first workspace
- Invitation-gated broker registration
- Admin, internal broker, partner broker, and viewer roles
- Property inventory, filters, status management, and soft deletion
- Listing comments with moderation and edit windows
- Broker access management
- Audit logging
- HttpOnly cookie sessions

## Structure

```text
src/server.js          Application entry point and migration startup
src/db.js              PostgreSQL pool, transaction, migration, and query helpers
src/migrations/        Numbered PostgreSQL schema migrations
src/auth.js            Passwords, sessions, and authorization middleware
src/routes/            Authentication, listings, comments, and administration APIs
public/                Lightweight browser application
```

Do not add production credentials to this repository. Use hosting environment variables.
