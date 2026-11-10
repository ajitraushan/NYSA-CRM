# NYSA-CRM-20261110-PROSPECT-DIARY-001 — Prospect Diary / Cold Calling Desk

## Status and authority

- Status: implementation baseline for DEV267; hosted deployment is not yet approved.
- Owner: Nysa Realty.
- Target for first deployment: CRM Test only, followed by user UAT.
- Production: requested as an emergency release, but still requires CRM Test acceptance,
  cumulative reconciliation from production RC1, a fresh verified production backup,
  rollback evidence and exact deployment approval.
- Source baseline: accepted CRM Test DEV266, application commit
  `1abd17771a5dda3be4b5108a6453e70438ad3ed0`, migration ledger 169.
- Hosted baseline evidence: `release-artifacts/dev266-preparation/INSTALL_RESULT.json`
  and `SMOKE_RESULT.json`. Those receipts record 303 tables, 108 enabled triggers,
  a matching full schema contract, database `nysareal_nysa_dev247_smoke`, readiness
  green and one command/CWD-verified exact-root worker.
- Local development rollback point: Git commit
  `65d45ead0ae95b4260dbbdfcbf6c49765079f34d` plus the retained DEV266 origin
  package and scoped-backup evidence.

This change must follow the hosted-deployment controls in `CRM_CHANGE_POLICY.md`
and the mandatory hosted-worker and operator controls in `AGENTS.md`. Emergency
timing does not relax those controls.

## Business purpose

Sales Agents need a quick private working desk for cold-call prospects who are
not yet formal Customers or Leads. An Agent can retain multiple calls, notes and
follow-up actions for the same person and decide later whether the person should
be converted into CORE's authoritative Customer and Lead records.

The Prospect Diary is a pre-customer work ledger. It does not create a second
Customer Master and does not make a prospect eligible for Customer or Lead
workflows before an explicit conversion.

## DEV267 scope

### Prospect record

Each prospect has:

- optional display name;
- mandatory phone number, normalized for duplicate detection;
- optional email, normalized for duplicate detection;
- source and a brief internal note;
- current owner and owning team;
- status: `not_contacted`, `no_answer`, `call_back`, `interested`,
  `not_interested`, `do_not_contact`, or `converted`;
- created/updated timestamps and actor evidence;
- a conversion link to the authoritative Customer when converted.

Only one active prospect may use the same normalized phone number. The API shows
an existing match instead of silently creating a duplicate.

### Activity history

The same prospect can have any number of append-only call/note events. Each event
records the occurred time, direction, outcome, notes and actor. Existing events
are not overwritten; a correction is a new event explaining the correction.

### Follow-up actions

The same prospect can have any number of dated follow-ups. DEV267 extends the
governed `tasks` context with a Prospect-only context and task type
`prospect_follow_up`; it does not create a parallel follow-up table. Each Task
records subject, details, assignee, due date, priority, channel and status. At
most one open/in-progress Task can be the prospect's primary next action.
Completing or cancelling it through Prospect Diary, My Tasks or My Diary updates
the same Task row and does not delete its history.

Conversion rechecks suppression and duplicates under lock. Open Prospect Tasks
are relinked to the authoritative Customer when the governed Task context allows,
or explicitly closed with a conversion outcome before the normal Lead next action
is created. No follow-up is silently copied, discarded or kept in a competing
store.

### Do-not-contact

Setting `do_not_contact` requires a reason, cancels open prospect follow-ups and
prevents new call events or follow-ups. Notes remain permitted so the Agent can
record why contact stopped. Reopening outreach requires a Manager/Director action
with a reason and is audited.

### Visibility and ownership

- Sales Agent: own prospects only; may create, record calls/notes, maintain
  follow-ups and convert owned prospects.
- Manager: own prospects plus active team members' prospects; may reassign within
  the managed team and may clear do-not-contact with a reason.
- Director: company-wide read access; may reassign and clear do-not-contact.
- Listing Agent, Accountant, Administrator and external identities: no Prospect
  Diary access in DEV267.

Managers and Directors do not silently edit another Agent's call evidence. Their
management actions are append-only/audited.

### Conversion

Customer conversion is one database transaction and locks the prospect row.

1. CORE rechecks normalized phone/email against active Customer channels.
2. If matches exist, the Agent must explicitly select the existing Customer.
3. If no match exists, CORE may create a Customer using the existing governed
   Customer identity rules. A new Customer requires name, phone and email;
   DEV267 does not weaken that rule.
4. The prospect is marked converted and linked to the authoritative Customer.
   All prospect activities and follow-ups remain readable.
5. If the Agent selects **Continue to Lead**, CORE opens the existing governed
   Lead form with that Customer preselected. Lead creation remains a separate,
   explicit action subject to all existing classification, routing and assignment
   rules; Customer conversion does not silently create a Lead.
6. Repeating the same Customer-conversion request returns the existing conversion
   result; it never creates another Customer.

### Screen

The responsive **Prospect Diary** workspace contains:

- summary counts for Today, Overdue, Upcoming, Interested and Do not contact;
- search and filters for status, owner (management only) and due state;
- a compact list with name/phone, status, last contact and next action;
- a quick-create form;
- a detail workspace with timeline, Add call/note, Add follow-up, conversion and
  management actions;
- visible validation/error banners;
- Close and browser Back behavior that restores filters and scroll position;
- mobile cards with no collapsed single-character controls or page overflow.

## API surface

- `GET /api/crm/prospects`
- `POST /api/crm/prospects`
- `GET /api/crm/prospects/:id`
- `PATCH /api/crm/prospects/:id/status`
- `POST /api/crm/prospects/:id/activities`
- `POST /api/crm/prospects/:id/follow-ups`
- `PATCH /api/crm/prospects/:id/follow-ups/:followUpId`
- `POST /api/crm/prospects/:id/reassign`
- `GET /api/crm/prospects/:id/conversion-matches`
- `POST /api/crm/prospects/:id/convert`

Every endpoint applies the same owner/team/company visibility boundary server-side;
the client is not trusted to enforce authorization.

## Data, privacy and audit

- Phone/email are operational personal data and are returned only inside the
  authenticated authorized scope.
- Search uses normalized identity values; logs and test evidence must use
  synthetic numbers/emails only.
- Prospect create, status, DNC, activity, follow-up, reassignment and conversion
  actions write `audit_log` entries.
- No credential, customer row or production data is copied into local tests.

## Explicit exclusions

- live dialer, call recording, telephony integration or personal-mobile calling;
- WhatsApp, SMS, email or any external message send;
- AI qualification or automated follow-up;
- bulk prospect upload;
- unrelated changes to existing Customer, Lead, dashboard or workflow rules;
- campaign retirement and the small fixes held for DEV268;
- production installation before CRM Test UAT and separate approval.

## Acceptance criteria

1. Multiple calls and multiple follow-ups persist against one prospect.
2. At most one open next action is enforced under concurrent requests.
3. Duplicate phone creation is blocked with the existing prospect returned.
4. Agent, Manager and Director scopes are enforced by integration tests.
5. DNC cancels open follow-ups and blocks calls/new follow-ups; note evidence remains allowed.
6. Conversion duplicate checks, existing-Customer linkage, new-Customer creation,
   governed Lead-form handoff and idempotent repeat all pass on PostgreSQL 13.23.
7. Conversion retains all earlier history and writes an audit trail.
8. Migration 170 is additive/idempotent and the complete post-migration schema
   contract matches its approved hash on both clean and hosted-shape fixtures.
9. Actual packaged UI files pass real-browser Agent, Manager and Director checks,
   including filters, modal/Back return, scroll restoration and mobile width.
10. Governed regression has zero failures; every skipped test is listed by name
    and reason. Origin package provenance verifies exactly.

## Deployment and rollback boundary

CRM Test deployment, if approved, uses only the canonical GitHub-origin operator
and four separately approved phases: stage, scoped backup, install/start and
settled smoke. The scoped backup must include the exact application root and
database dump and pass full schema verification. Before and after controlled
start, workers are matched by exact command marker and `/proc/<pid>/cwd`; after
readiness exactly one matching worker must serve the expected version with the
database ready. No retry follows a failed authorized run.

Automatic rollback is application-only and only before readiness returns green.
Database restore is separately approved. Production requires a fresh production
backup and cumulative migration rehearsal from its documented RC1 baseline.
