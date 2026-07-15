# NYSA CRM - Release 1

Internal real-estate CRM with lead lifecycle management, customer activity tracking, inventory, and controlled broker collaboration.

## Requirements baseline

The formal Release 1 scope is defined by the documents in `docs/` at commit
`3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`. Implementation work must start from
that repository history and be traced to `docs/ACCEPTANCE_CRITERIA.md`.

The features listed below describe the current implementation increment. They do
not certify Release 1 acceptance until every committed criterion has passed in an
isolated test environment and the controlled production smoke test has succeeded.

## Project documents

Start with [`docs/README.md`](docs/README.md). The formal scope and delivery controls are maintained in:

- [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md)
- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
- [`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md)

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

- Customer and company records with ownership, type, communication preference, verification status, and search
- Lead capture, source tracking, related inventory, team/broker assignment, and standard pipeline stages
- Hot/Warm/Cold qualification with response targets and communication guidance
- Lead claiming, assignment SLA status, and manager reassignment queue
- Tasks, calls, emails, WhatsApp, meetings, viewings, notes, reminders, and downloadable calendar events
- Email, telephone, and WhatsApp handoffs from a customer record
- Dashboard metrics for open, new, hot, and overdue leads, plus pipeline, source, activity, agent, movement, call, and closure reports
- Mortgage repayment calculator and customer property value briefs with ROI calculations and print view
- Internal-only customer access; partner brokers remain limited to inventory collaboration
- Dashboard-first workspace
- Invitation-gated broker registration
- Admin, director, manager, accountant, sales-agent, listing-agent, partner-broker, and viewer job/access roles
- Property inventory, filters, status management, and soft deletion
- Listing comments with moderation and edit windows
- Broker access management
- Audit logging
- HttpOnly cookie sessions

## Structure

```text
app.cjs                LiteSpeed/CloudLinux-compatible CommonJS startup wrapper
src/server.js          ESM application entry point and migration startup
src/db.js              PostgreSQL pool, transaction, migration, and query helpers
src/migrations/        Numbered PostgreSQL schema migrations
src/auth.js            Passwords, sessions, and authorization middleware
src/routes/            Authentication, listings, comments, and administration APIs
src/routes/crm.js      Contacts, teams, leads, qualification, and activity APIs
src/crm-domain.js      CRM lifecycle rules and qualification guidance
public/                Lightweight browser application
test/                  Dependency-free domain tests
```

Do not add production credentials to this repository. Use hosting environment variables.

## Verification

Run the dependency-free domain test suite with:

```bash
npm test
```

The email and WhatsApp buttons open the user's configured mail or messaging client, calendar events are downloaded as ICS files, and contact verification is recorded by an authorized user. Automated provider-backed messaging and identity verification require separately selected providers and credentials.
