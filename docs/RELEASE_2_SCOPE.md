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

### Connected operating experience — D-039

The records remain separate for audit and reporting, but the user experience must present them as
one connected case. A user opens the customer or active work item once and can see the responsible
team/agent, current lifecycle position, requirement, qualification, active opportunities, selected
or matched properties, next action and material history without searching several unrelated screens.

- Enter a business fact once in its authoritative record and reuse it everywhere else by reference.
  Customer identity/contact details belong to Customer; enquiry provenance and qualification belong
  to Lead; pursuit stage and next action belong to Opportunity; property facts belong to Listing.
- Do not create a second editable customer, requirement, source, campaign or property record when an
  Opportunity is opened. Preserve exact evidence through stable links and immutable snapshots only
  where historical reproducibility requires them.
- Creation actions show what will be reused, what is missing and what new record will be created.
  Existing matching records are shown before a user can create a duplicate pursuit.
- Every workspace shows a plain-language path back to its originating Customer and Lead and forward
  to its Opportunities, properties and later Deal. Internal identifiers remain secondary.
- Ownership is visible at every step. An authorized reassignment action must offer an impact preview
  and an explicit choice of Lead only or Lead plus selected open Opportunities. The chosen changes
  commit atomically and append immutable assignment/audit history; no Opportunity changes owner merely
  because a Lead was edited through another action.
- Administrator and Director may perform company-wide governed reassignment; Manager/Team Lead may
  reassign within managed-team scope. Assignees must be active and eligible for the selected team.
  Existing Sales Agent, Listing Executive and Accountant access boundaries remain unchanged.
- Summary cards and guided actions use business language and disclose incomplete or conflicting data.
  They must not conceal exceptions, silently overwrite another module or infer missing facts.

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
| Campaign management and outcome attribution | Leads already retain source/campaign codes, while no governed campaign master or authoritative deal outcome exists | Preserve immutable original-enquiry attribution through Opportunity, Booking and Deal; implement the campaign master in Release 3A and defer reconciled CPL/CPA/ROI to Release 6 under D-037 |

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
- `opportunity_attribution`: opportunity, originating lead/integration event, source and stable
  campaign/advert/form/landing-page/property identifiers, capture time, attribution basis and an
  immutable normalized snapshot of the original enquiry identifiers. Release 2 records
  provenance only; it does not create campaign budgets or infer multi-touch credit.
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
- A deal resolves campaign provenance through its originating opportunity attribution. Later
  campaign-master mapping may attach a governed campaign identity to the same stable external
  code, but must never rewrite the captured original-enquiry snapshot.
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
3. **R2.1A connected operations and ownership**: guided Customer-to-Lead-to-Opportunity context,
   authoritative-data reuse, related-record navigation, duplicate warnings, ownership visibility
   and transactional Lead/selected-Opportunity reassignment with immutable history.
4. **R2.2 matching and viewing**: explainable shortlist, local scheduling, attendees, attendance,
   feedback, follow-up and `.ics` fallback.
5. **R2.3 offers, negotiation and booking**: immutable revisions, exact document links,
   negotiation timeline, reservation records and inventory conflict handling.
6. **R2.4 deals, parties and completion**: governed deal creation, sale/rental parties,
   checklist instantiation, approvals and authoritative closed outcomes.
7. **R2.5 reconciliation and release candidate**: cross-role UAT, reports/count reconciliation,
   source/campaign attribution reconciliation, migration/rollback rehearsal, package identity and
   CRM Test acceptance. Production remains a separately authorized action.

Each slice needs committed requirements, migrations, API authorization, audit coverage,
automated tests, CRM Test deployment instructions and explicit acceptance before the next slice
may treat it as stable.

Implementation checkpoint on 2026-07-22: D-038 and the design portion of R2.0 are complete;
migration 038, the scoped Opportunity API, immutable attribution/history and separate workspace are
implemented locally for R2.1. All 164 automated tests pass. The isolated PostgreSQL migration
rehearsal, reconciliation evidence, CRM Test deployment and explicit functional acceptance remain
open, so neither R2.0 nor R2.1 is accepted or deployable yet.

## Acceptance baseline

- A qualified lead creates an opportunity without retyping or duplicating customer data and
  retains the exact requirement/qualification evidence used.
- From Customer, Lead or Opportunity, a permitted user can understand the same case, ownership,
  lifecycle position, related records and next action without re-entering an authoritative fact.
- Reassignment previews affected records, updates only the explicitly selected Lead and open
  Opportunities in one transaction, rejects invalid assignees and preserves prior ownership in
  immutable assignment and audit history. A failed change leaves every record unchanged.
- Administrator and Director can govern company-wide reassignment; Manager/Team Lead remains
  limited to managed-team scope, and all existing non-management access boundaries remain intact.
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
- A controlled enquiry retains the same stable campaign/source provenance through Lead,
  Opportunity, Booking and Deal; retries or multiple opportunities do not duplicate or silently
  change the original attribution. Release 2 does not claim CPL, CPA or ROI.
- Forward migration, legacy reconciliation and rollback are rehearsed against an isolated
  sanitized/restored database before CRM Test deployment.
- The complete existing suite plus new Release 2 syntax, migration, permission, transaction,
  concurrency, workflow and reporting tests passes on the exact committed source.

## Approved recommended defaults — D-038

The NYSA owner approved these defaults on 2026-07-22 and authorized the R2.0/R2.1 build:

1. The accepted Release 1.1 lead stages, lifecycle presentation, dashboard counts, APIs and
   historical records remain unchanged. Release 2 adds a separate Opportunity workspace; any
   later replacement requires an explicit documented amendment and CRM Test acceptance.
2. One qualified lead may have several simultaneous opportunities. One open opportunity is
   permitted for the same lead, listing and transaction type; before a listing is selected, one
   open Requirements-stage opportunity per lead and transaction type is the safe default.
3. R2.1 enables `Requirements -> Matching`, a reasoned return to Requirements and reasoned
   `Closed Lost`. Later stages remain schema-ready but cannot be entered until their owning slice
   is implemented and accepted. Closed Won is unavailable before booking, deal-party and
   completion gates exist.
4. Sale/rental completion checklists are introduced only in R2.4. Until approved templates exist,
   no opportunity can be represented as an authoritative completed deal.
5. Booking never changes inventory implicitly. R2.3 must use an explicit transactional reservation
   action with unit/Bulk Deal conflict protection, expiry/release rules and audit evidence.
6. Internal NYSA staff are participation records, not duplicated customer/external parties.
   Mandatory buyer/seller/landlord/tenant/developer/broker roles are validated by deal type in
   R2.4; missing parties block closure.
7. Sales Agents receive commercial access only to owned opportunities; Managers to managed-team
   records; Directors company-wide read/approval scope; Listing Executives only explicit
   participation; Accountants only accepted Deal finance fields, not Opportunity communications.
8. Legacy Viewing, Negotiation, Won and ambiguous Lost leads enter a read-only review ledger.
   Nothing is automatically converted, relabelled or backfilled into an Opportunity or Deal.

### Release 1.1 compatibility invariant

Every behavior accepted through Release 1.1 remains unchanged unless the NYSA owner explicitly
approves a documented amendment. Release 2 must be additive, keep the frozen candidate untouched,
retain all existing regression tests, and prove its own schema, permissions, workflow and UI on
CRM Test before any accepted behavior can be reconsidered.

Campaign release allocation is approved under D-037. R2.1 preserves the existing stable source,
campaign, external-source, form, page and originating-property identifiers without changing intake
behavior. New provider-specific fields, campaign configuration and credentials remain Release 3
gates.

Until these decisions are approved and recorded in `DECISIONS.md`, work is limited to further
requirements reconciliation, prototypes that do not alter business data, and migration/test
design.
