# Release 1 Role Dashboard Testing

This procedure creates clearly labelled synthetic identities and records in the isolated `nysareal_nysacrm_r1test` database. The seed command refuses to run against any database whose name does not end in `_r1test` and also requires an explicit confirmation variable.

## Prepare the staging application

Deploy this source to a separate cPanel Node application whose environment points to the test database. Confirm the application process itself has:

```bash
PGHOST=localhost
PGPORT=5432
PGDATABASE=nysareal_nysacrm_r1test
PGUSER=nysareal_nysacrmapp
PGPASSWORD=<test database password>
```

Do not run the seed command in the production application directory or with production database settings.

From the staging source directory, apply migration `010_role_dashboard_rebuild.sql` and create the fixtures:

```bash
node --input-type=module -e "import { migrate, closeDatabase } from './src/db.js'; await migrate(); await closeDatabase(); console.log('MIGRATIONS_OK');"
export ALLOW_DASHBOARD_TEST_DATA=YES
export DASHBOARD_TEST_PASSWORD='<a unique test-only password of at least 12 characters>'
npm run test:dashboard:seed
```

The command prints the synthetic email addresses. They all use the reserved `.invalid` domain and cannot deliver email. Use the same test-only password to sign in as:

| Dashboard | Test identity |
| --- | --- |
| Managing Director | `core.test.director@example.invalid` |
| Manager, Sales | `core.test.manager.a@example.invalid` |
| Manager, Leasing | `core.test.manager.b@example.invalid` |
| Agent A1 | `core.test.agent.a1@example.invalid` |
| Agent A2 | `core.test.agent.a2@example.invalid` |
| Agent B1 | `core.test.agent.b1@example.invalid` |

The controlled dataset also creates company benchmarks, prior dashboard snapshots,
source and campaign examples, recorded customer engagement, proposal workload, and
inventory examples covering availability confirmation, verification expiry, permit
exposure, media readiness, portal readiness, and aging. These records are prefixed
`CORE Test` and exist only in the `_r1test` database.

## Acceptance checks

### Agent

- Only the signed-in agent's assignments contribute to KPIs and tables.
- The first screen prioritizes acceptance, near-term SLA, overdue tasks, next actions, qualification, proposals, and recent customer activity.
- No other agent or team records are exposed through filters, export, KPI drill-down, or direct record access.

### Manager

- Only managed teams contribute to the dashboard.
- Agent workload, queue, SLA, aging, source/conversion, calls, proposals, and exceptions are distinct operational panels.
- Selecting an agent narrows every component and the breadcrumb shows Team to Agent.
- A contributing KPI record opens the underlying lead without losing the selected time/filter context.
- The manager cannot select or access an agent in the other manager's team.

### Managing Director

- Executive, Sales, Inventory, and Operations & Risk contain different panels and KPIs.
- Executive answers what is happening, why, what is next, and where to intervene.
- Executive overview covers lead/source/campaign mix, funnel, SLA, capacity,
  inventory, proposals/customer engagement, and material exceptions without showing
  individual tasks or calls on the initial screen.
- Every KPI shows current, prior, trend, target, exception threshold, definition, and refresh time.
- Drill-down follows Company to Business line to Team to Manager to Agent to underlying record.
- Leading indicators are labelled with their calculation assumption.
- Weighted pipeline, revenue, bookings, and commission forecasts remain explicitly unavailable until authoritative opportunity/deal records exist.

Record screenshots and contributing-record counts for each identity. Do not promote the dashboard change to production until these role checks and cross-scope denials pass.
