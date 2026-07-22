# Release 2 Scope: Opportunity and Deal Pipeline

## Status and authority

Release 2 requirements reconciliation and design began on 2026-07-22 from continuity commit
`6588047` on the separate `agent/release-2-design` branch. This document is a design baseline,
not authorization to deploy or to alter the held Release 1.1 production candidate.

The accepted Release 1.1 source remains frozen at commit `1001906` in
`nysa-core-r1-1-production-candidate-1001906.zip`, SHA-256
`d77192894c6d9996a84c6c928784d0b3280986f6eec4b969687e2194c6d11fe5`.
Release 2 source, migrations, packages and test evidence must remain separate. Testing and any
deployment are limited to `https://crm-test.nysarealty.com/`; production requires separate
written authorization and the production runbook gates.

## Reconciled outcome

Release 2 turns a qualified lead into one or more governed property pursuits without merging
Customer, Lead, Opportunity, Listing or Deal records.

The operational sequence is:

```text
Customer -> Lead -> Qualification -> Opportunity -> Match -> Viewing -> Offer
         -> Negotiation -> Booking/Reservation -> Closed Won or Closed Lost
```

- Customer is the canonical person or company and may have several leads.
- Lead owns source, routing, assignment, SLA, contact and qualification history.
- Opportunity owns a specific qualified property pursuit and its post-qualification stage.
- Listing remains the authoritative inventory record; matching never edits inventory.
- Deal is created only from a booked/reserved or otherwise approved winning opportunity and
  owns the transaction parties, completion workflow and final outcome.

## Requirements reconciliation

| Source requirement | Current Release 1.1 position | Release 2 treatment |
| --- | --- | --- |
| Keep lead and opportunity lifecycles separate | The accepted lead stage currently includes Viewing, Negotiation, Won and Lost | Introduce a separate opportunity lifecycle through a compatibility migration; never rewrite historical lead-stage evidence |
| Convert a qualified lead without retyping customer or requirement data | Contact, versioned lead requirements and qualification assessments exist | Create the opportunity transactionally from an in-scope qualified lead and snapshot/link the exact current requirement and qualification evidence |
| One qualified lead may produce multiple opportunities | Planned relationship is one-to-many; no tables or API exist | Permit multiple active property pursuits, with duplicate-open-pursuit protection for the same lead/listing/business line |
| Buyer-to-property matching | Requirements and governed inventory exist; manual proposal selection is not a match register | Add explainable match records with requirement version, listing, fit status, source, rationale, exceptions and actor/time |
| Viewing scheduling, attendance, feedback and follow-up | Viewing is only an activity/lead-stage label; calendar is `.ics` fallback | Add viewing and attendee records; use local scheduling and `.ics` fallback until a Release 3 calendar adapter is approved |
| Offers and negotiation history | Offer-letter document versions can exist, but there is no commercial offer ledger | Add offer, immutable revision and negotiation-event records; sent-document actions must link the exact document version |
| Booking and reservation records | Roadmap requires them, but the planned entity list omitted them | Add explicit `bookings` and `booking_status_history`; do not model booking only as an opportunity stage |
| Closed-won and closed-lost deals | Existing Won/Lost are lead stages, not authoritative transactions | Add governed opportunity closure and a deal record; Closed Lost requires a controlled reason, while Closed Won requires transaction validation |
| Buyer/seller/landlord/tenant/broker/property/developer relationships | Contact roles, external companies and listings exist; transaction parties do not | Add dated, role-specific deal parties linked to canonical contacts/companies/listings without duplicating identities |
| Configurable sale and rental completion checklists | Checklist names are planned for later documents/compliance scope | Bring operational checklist templates and instantiated deal checklists into Release 2; sensitive document content and advanced compliance remain Release 6 |
| Sequential Agent workspace | Release 1.1 dashboard shows an accepted lead-stage aggregate | Add opportunity work queues and next actions progressively; preserve the accepted lead dashboard until compatibility acceptance approves its replacement |

## Lifecycle ownership and compatibility

### Target lead lifecycle

The product requirement remains the target:

`New -> Assigned -> Contact Attempted -> Contacted -> Qualified -> Converted`

`Nurture`, `Unqualified`, `Lost` and `Duplicate` are lead holding or terminal outcomes. A lead
becomes Converted when its first opportunity is created; later opportunity stages never mutate
the lead into Viewing, Negotiation or Won.

### Target opportunity lifecycle

`Requirements -> Matching -> Viewing -> Offer -> Negotiation -> Booking -> Closed Won`

`Closed Lost` is a terminal alternative and requires a controlled reason. Stage transitions are
API-enforced, versioned/configurable where the existing workflow-governance pattern applies,
and appended to immutable history in the same transaction as the current-stage update.

### Release 1.1 compatibility rule

Release 1.1 has accepted historical lead stages `New`, `Contacted`, `Qualified`, `Viewing`,
`Negotiation`, `Won` and `Lost`. Release 2 must not relabel those audit rows in place.

Before implementation, a migration/backfill rehearsal must classify each non-early legacy lead:

- Qualified: eligible for explicit opportunity creation; no automatic property assumption.
- Viewing or Negotiation: create a review candidate only when the required customer,
  requirement and property evidence can be identified; otherwise leave it in an exception queue.
- Won: never manufacture an authoritative deal from the stage alone; require reviewed property,
  parties, commercial terms and completion evidence.
- Lost: retain the lead outcome unless evidence shows that the loss belongs to a distinct
  opportunity.

The existing Agent lifecycle dashboard remains a Release 1.1 view until a CRM Test acceptance
plan proves the new lead/opportunity split, reconciles every count and explicitly approves the
replacement labels and drill-downs.

## Proposed module data contracts

### Opportunities

- `opportunities`: stable reference, originating lead, customer/contact, business line,
  transaction type, owner/team, current stage, priority, current requirement version,
  qualification evidence, primary listing when selected, next action/due time, opened/closed
  metadata and optimistic update version.
- `opportunity_stage_history`: prior/new stable stage code, reason, actor and timestamp.
- Opening is allowed only from an authorized, qualified in-scope lead with a current structured
  requirement. It reuses identities and references evidence; it does not copy editable customer
  fields into a second master.

### Property matching

- `property_matches`: opportunity, exact requirement version, listing, match source
  (`manual`, `rule`, or future advisory service), fit status, scored dimensions where used,
  plain-language rationale, exceptions, shortlist decision, actor and timestamps.
- A match records a considered relationship and never changes listing availability, price,
  approval or publication readiness.
- Automated scores are advisory and reproducible. Missing or incompatible facts are visible;
  the system must not invent values or silently override an agent.

### Viewings

- `viewings`: opportunity, listing, organizer, start/end/timezone, location/instructions,
  status, outcome, feedback, follow-up action/due time, calendar UID and timestamps.
- `viewing_attendees`: viewing, canonical participant reference or bounded guest identity,
  attendee role, invitation/attendance status and feedback visibility.
- Initial scheduling is provider-neutral and supports `.ics` download. External create/update/
  cancel synchronization is not implied and remains gated by `ENH-CALENDAR-001`.

### Offers and negotiations

- `offers`: opportunity, listing, offer type, current status, currency, owner and timestamps.
- `offer_revisions`: immutable sequence, commercial terms, validity, conditions, financing,
  exact document version when sent, proposer, created/sent/received times and supersession link.
- `negotiation_events`: offer, event type, direction, counterparty role, summary, exact offer
  revision/document reference where applicable, actor and occurrence time.
- Monetary values use typed decimal columns plus currency; material terms must not live only in
  free text or mutable JSON.

### Bookings and reservations

- `bookings`: opportunity, listing, accepted offer revision, booking/reservation reference,
  status, booking amount/currency, refundable state, expiry, evidence document, owner and dates.
- `booking_status_history`: prior/new status, reason, actor and timestamp.
- Booking never changes inventory silently. Any inventory reservation action is an explicit,
  authorized cross-module transaction with conflict protection and audit history.

### Deals, parties and completion

- `deals`: opportunity, booking where applicable, listing, deal type, current status, agreed
  value/currency, target/actual completion, closed-won/lost metadata, approver and audit version.
- `deal_parties`: deal, canonical contact or external company, controlled role, side,
  representation, primary flag, effective dates and source evidence.
- `checklist_templates` and `checklist_template_items`: versioned sale/rental template,
  applicability rules, responsible role, required evidence, ordering and approval state.
- `deal_checklists` and `deal_checklist_items`: immutable template-version instantiation,
  assignee, status, due/completed metadata, exception/waiver reason and evidence reference.
- Deal closure is blocked until the applicable required items and approval rules pass. Commission
  calculation/settlement remains Release 5; sensitive transaction-document management and
  advanced compliance remain Release 6.

## Authorization baseline

- Sales Agent: create and operate opportunities, matches, viewings, offers, bookings and deal
  drafts only for owned/in-scope leads and opportunities.
- Listing Executive: read customer data only when explicitly participating; manage assigned
  listing/viewing facts but cannot approve commercial closure merely by owning inventory.
- Manager/Team Lead: team scope, reassignment/intervention and reasoned approval or exception
  actions defined by policy.
- Director: company-wide visibility and designated commercial/closure approvals; routine record
  editing remains constrained.
- Accountant: read only the accepted deal parties, values and evidence needed for finance review;
  no general lead communication access.
- Administrator: configuration and technical administration do not bypass business approvals.

Every API query and mutation must enforce record scope. UI visibility is not authorization.
Material stage, match, viewing, offer, booking, party, checklist and closure changes are audited.

## Delivery slices

1. **R2.0 design acceptance and migration rehearsal**: approve the open decisions below,
   fixture legacy stages, prove forward-only schema/backfill behavior and define reconciliation
   queries. No user-facing feature deployment.
2. **R2.1 opportunity foundation**: opportunity creation from qualified leads, separate lifecycle,
   history, scope enforcement, work queue and compatibility dashboard evidence.
3. **R2.2 matching and viewing**: explainable shortlist, local scheduling, attendees, attendance,
   feedback, follow-up and `.ics` fallback.
4. **R2.3 offers, negotiation and booking**: immutable revisions, exact document links,
   negotiation timeline, reservation records and inventory conflict handling.
5. **R2.4 deals, parties and completion**: governed deal creation, sale/rental parties,
   checklist instantiation, approvals and authoritative closed outcomes.
6. **R2.5 reconciliation and release candidate**: cross-role UAT, reports/count reconciliation,
   migration/rollback rehearsal, package identity and CRM Test acceptance. Production remains a
   separately authorized action.

Each slice needs committed requirements, migrations, API authorization, audit coverage,
automated tests, CRM Test deployment instructions and explicit acceptance before the next slice
may treat it as stable.

## Acceptance baseline

- A qualified lead creates an opportunity without retyping or duplicating customer data and
  retains the exact requirement/qualification evidence used.
- Cross-agent and cross-team reads and writes are denied by the API, with Manager, Director,
  Listing Executive and Accountant behavior matching the approved matrix.
- Invalid lifecycle transitions and stale concurrent updates are rejected; valid changes append
  immutable history and audit evidence.
- Multiple opportunities for one customer/lead reconcile correctly, while duplicate open
  pursuits for the same governed identity are prevented or explicitly reviewed.
- Matching explains fit and gaps against the exact requirement/listing versions and never edits
  inventory.
- Viewings preserve timezone, attendees, attendance, feedback and required follow-up; calendar
  fallback is accurately labelled.
- Every sent offer/negotiation action resolves to the exact immutable offer and document version.
- Booking/reservation conflicts cannot reserve the same governed inventory incompatibly, and a
  failed transaction leaves neither module partially updated.
- Closed Lost requires a controlled reason. Closed Won requires an accepted commercial version,
  validated parties and the approved completion gate; a lead stage alone cannot create a deal.
- Sale and rental checklists instantiate the exact approved template version and preserve
  completion, exception and evidence history.
- Opportunity, pipeline and deal reports reconcile to underlying scoped records and display a
  clear data-as-of time.
- Forward migration, legacy reconciliation and rollback are rehearsed against an isolated
  sanitized/restored database before CRM Test deployment.
- The complete existing suite plus new Release 2 syntax, migration, permission, transaction,
  concurrency, workflow and reporting tests passes on the exact committed source.

## Decisions required before development

These are not silently assumed by this design:

1. Approve the exact target lead statuses and the Release 1.1 dashboard compatibility/replacement
   presentation after opportunity separation.
2. Confirm whether one qualified lead may have several simultaneous opportunities and approve
   the duplicate-open-pursuit key (recommended: lead + listing + transaction type, with an
   exception path before a listing is selected).
3. Approve sale and rental opportunity transition guards, lost reasons, booking statuses and deal
   closure/approval thresholds.
4. Provide the initial sale and rental completion checklists, responsible roles, required evidence
   and permitted waiver/exception approvers.
5. Confirm booking/reservation behavior for unit inventory versus a Bulk Deal parent, including
   expiry, release, deposit/refund evidence and inventory status synchronization.
6. Confirm which party roles are mandatory by sale/rental deal type and whether an internal NYSA
   agent is represented as a user participation record rather than a customer/external party.
7. Approve commercial-field visibility and export policy for Sales Agent, Listing Executive,
   Manager, Director and Accountant.
8. Approve the legacy lead classification/backfill rules and exception owner after a CRM Test
   rehearsal reports exact counts; no automatic Won-to-deal conversion is recommended.

Until these decisions are approved and recorded in `DECISIONS.md`, work is limited to further
requirements reconciliation, prototypes that do not alter business data, and migration/test
design.
