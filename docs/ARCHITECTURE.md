# NYSA CRM Architecture

## Architectural Direction

NYSA CRM will remain a modular monolith for the planned internal-user scale.
This keeps deployment and operations suitable for the current cPanel hosting
while allowing clear module boundaries. Microservices are not justified until
real load, team ownership, or integration isolation requires them.

## Current Production Architecture

```text
Browser
  |
  | HTTPS + HttpOnly session cookie
  v
cPanel LiteSpeed / Node application
  |
  | Static files and JSON APIs
  v
NYSA Node.js application
  |
  | pg connection pool
  v
PostgreSQL
```

### Browser application

- Lightweight HTML, CSS, and JavaScript served from `public/`
- Dashboard, inventory, comments, login, setup, and administration views
- Same-origin JSON requests to `/api`
- No secrets or database access in the browser

### Application server

- Entry point: `src/server.js`
- HTTP/router helpers: `src/lib/http-kit.js`
- Authentication and authorization: `src/auth.js`
- Feature endpoints: `src/routes/`
- PostgreSQL helpers and migrations: `src/db.js`
- Forward-only schema migrations: `src/migrations/`

The cPanel LiteSpeed loader uses CommonJS `require()` to load the ESM startup
graph. The entry module must not use top-level `await`; asynchronous startup is
wrapped in `start().catch(...)`.

### Database

- PostgreSQL connection pool with small shared-hosting limits
- UUID primary keys
- Database constraints for status and value integrity
- Timestamped audit and session records
- Numbered migrations applied before the server starts listening

## Planned Module Boundaries

```text
Identity and Access
  - Users, roles, teams, memberships, invitations, sessions

CRM Core
  - Contacts, companies, communication preferences, deduplication

Lead Operations
  - Sources, queues, assignments, SLA, stages, qualification

Activity Management
  - Calls, notes, meetings, tasks, reminders, communication records

Inventory
  - Listings, media, availability, verification, ownership, comments

Opportunity and Deals
  - Requirements, matches, viewings, offers, negotiations, bookings, deals

Sales Enablement
  - Financial scenarios, ROI assumptions, proposal templates, generated versions

Finance Operations
  - Commission rules, splits, approvals, invoices, receipts, payments

Documents and Compliance
  - Document metadata, secure files, checklists, expiry, approvals

Reporting
  - Operational queries, management metrics, exports

Integrations
  - Email, Google Calendar, WhatsApp, portals, accounting adapters
```

Each module owns its validation and business rules. Cross-module operations use
database transactions where consistency is required, such as converting a lead
to an opportunity or closing a deal and creating commission expectations.

## Request and Authorization Flow

1. TLS terminates at the hosting proxy.
2. The application receives the request and applies security headers and body limits.
3. Authentication resolves the hashed session token from the cookie.
4. Authorization checks the user's active status, role, team, and record scope.
5. Route validation normalizes and validates the request body.
6. The service performs parameterized database operations.
7. Material changes append audit records in the same logical operation.
8. The API returns a minimal JSON response; sensitive fields are never returned unnecessarily.

## Security Baseline

- TLS-only production access with HSTS
- HttpOnly, Secure, SameSite session cookies
- Hashed session tokens and password hashes
- Login throttling with proxy-aware client address handling
- Parameterized PostgreSQL queries
- Content Security Policy, frame denial, MIME protection, and referrer controls
- One-megabyte default JSON body limit
- API-enforced role and record scope
- No production secrets in Git, logs, screenshots, or generated client files
- Audit history for assignments, permissions, lifecycle, financial, and document actions

## Data and File Storage

PostgreSQL stores business records and file metadata. Large property media,
identity documents, contracts, and generated proposals must not be stored in Git.
The file-storage provider is undecided and requires:

- Private objects by default
- Short-lived authorized access
- Encryption in transit and at rest
- File type and size validation
- Malware scanning where available
- Retention and deletion controls
- Backup and restore coverage

Until a suitable store is approved, Release 1 may use a restricted hosting
directory outside the public web root with application-mediated access.

## Customer Proposal Generation

The proposal module receives immutable snapshots of:

- Customer requirement summary
- Selected properties and media references
- Calculator inputs and outputs
- Agent-edited narrative and disclaimers
- Template and brand version

The generated PDF is stored outside Git. The database records its hash, creator,
version, lead/opportunity link, creation time, and delivery status. Regeneration
creates a new version rather than silently replacing a sent document.

## Integration Pattern

Integrations will use adapters behind internal interfaces. External webhook or
API events are normalized, deduplicated, and recorded before changing CRM data.
Retries must be idempotent and visible in an integration failure queue.

Integration credentials are environment or secret-manager values. They never
appear in browser code, database exports, repository files, or audit details.

## Reporting Pattern

Release 1 reports will use indexed transactional queries and limited exports.
As data volume grows, add summary tables or materialized views only after query
measurement demonstrates the need. Reporting must respect the same record scope
as operational screens.

## Deployment Constraints

- Node.js 24.16.0 on cPanel shared hosting
- Small PostgreSQL connection pool (`PGPOOL_MAX=3` in production)
- Application startup must finish database migration before listening
- No long-running work in request handlers
- PDF generation and imports require file-size and execution-time limits
- Background processing may initially use short scheduled jobs; introduce a
  dedicated queue only when workload warrants it

## Future Reassessment Triggers

Reassess hosting or architecture if any of these occur:

- Sustained resource or connection-pool exhaustion
- Proposal generation or imports exceed shared-hosting limits
- Webhook processing requires reliable asynchronous queues
- Regulatory or customer requirements mandate different data residency
- A larger engineering team needs independent deployment ownership
- Availability targets exceed what the current hosting plan can support
