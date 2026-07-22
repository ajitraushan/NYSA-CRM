# NYSA CRM Data Model

## Modeling Principles

- PostgreSQL is authoritative for CRM business records.
- Primary keys are UUIDs; timestamps use `TIMESTAMPTZ`.
- Monetary values use fixed-precision numeric types and explicit currency.
- Status values are constrained and changed through validated workflows.
- Material history is appended rather than overwritten.
- Customer identity is separated from leads and transactions.
- Files are stored outside Git and represented by controlled metadata.
- Every new schema change is a forward-only numbered migration.

## Current Tables

### `brokers`

Current user identity, authentication profile, role, posting permission, status,
inviter, and join time. Release 1 will extend or migrate this concept to the
approved internal role model without breaking existing administrator identity.

### `invitations`

Invitation code, issuer, intended email, role, use limit, expiry, status, and use count.

### `listings`

Property inventory including project, developer, area, type, bedrooms, size,
price, reference price, payment plan, handover, availability, exclusivity,
owner, contact, notes, and soft deletion.

### `comments`

Listing discussion with author, optional parent, creation/edit time, and soft deletion.

### `audit_log`

Current MVP entity, action, actor, timestamp, and details. Release 1 must expand
the allowed entity coverage and use structured JSON details.

### `sessions`

Hashed session token, user, creation time, and expiry.

### `schema_migrations`

Migration filenames already applied to the database.

## Release 1 Entities

### Identity and teams

#### `teams`

- Name, business line, manager, status, business-hours policy, and routing settings

#### `team_memberships`

- Team, user, membership role, start/end time, active status
- Unique active membership rules where appropriate

#### User role extension

- Approved role: admin, sales agent, listing agent, manager, director, accountant
- Active status, posting permission, and default team
- Existing administrator and sessions must survive migration

### Contacts and companies

#### `organization_settings`

- Singleton/versioned NYSA legal identity, trading name, contact details, brand assets,
  proposal footer, approved disclaimers, default currency, locale, and effective dates
- Separate from external companies and never used as a customer or partner record

#### `property_media_approval_policy`

- Singleton Administrator-governed policy controlling whether future compliant
  property-media uploads require responsible-Manager approval
- Defaults safely to approval required; every decision records its reason,
  Administrator and timestamp
- Policy changes never rewrite existing pending media, preserving submission and
  audit history

#### `contacts`

- Person identity and display name
- Normalized primary email and mobile
- Preferred language, channel, and contact time
- Consent and communication restriction status
- Source, owner, lifecycle status, and merge pointer
- Created/updated/deleted metadata

#### `contact_roles`

- Contact and role such as buyer, seller, landlord, tenant, or investor

#### `external_companies`

- Legal/display name, controlled category, registration fields when required,
  contact details, owner, status, and merge pointer

#### `external_company_roles`

- Company, controlled business role, validity period, primary flag, and status
- Allows one company to be developer, agency, employer, supplier, or another
  approved role without duplicate company records

#### `company_contacts`

- Company, contact, job/relationship role, primary flag, and validity period

#### `contact_channels`

- Channel kind (`Phone` or `Email`), controlled usage label, raw value, normalized
  value, WhatsApp capability for phone channels, verification status/time,
  preferred flag, and restriction status
- Uniqueness and duplicate-review rules use normalized values; WhatsApp does not
  create a second phone record

#### `marketing_agreements`

- Contact, exact executed document version, template version, signed/effective/
  expiry/withdrawal times, consent scope, permitted channels, status, and audit data
- Effective `Granted` marketing consent is derived only from a valid executed agreement

### Leads

#### `lead_sources`

- Source name, category, active status, and optional campaign/channel metadata

#### `leads`

- Contact, company, source, business line, transaction type
- Company queue, team, responsible agent
- Status, temperature, received time, accepted time, first-contact time
- SLA due times and breach flags
- Next action, next-action due time, lost/unqualified reason
- Created/updated/closed metadata

#### `lead_assignments`

- Lead, from/to team, from/to agent, reason, assigned by, assigned time,
  accepted/rejected/expired time

#### `lead_stage_history`

- Lead, previous status, new status, reason, actor, and timestamp

#### `lead_requirements`

- Areas, projects, developers, property types, bedrooms, sizes, budget,
  financing, purpose, target yield, timeline, and freeform constraints

Multi-value preferences should use child tables or JSON only where query and
validation requirements justify it. Frequently filtered fields remain relational.

### Activities and tasks

#### `activities`

- Contact, lead, optional opportunity
- Type: call, note, meeting, email, WhatsApp, viewing, or system event
- Direction, subject, body/summary, outcome, occurred time, actor
- External provider/message identifier where applicable

#### `tasks`

- Related entity, assignee, creator, subject, priority, due time, status,
  completion time, and outcome

#### `activity_participants`

- Activity and participating user/contact with participant role

### Qualification

#### `qualification_models`

- Versioned model name/code, purpose, business-line scope, status, factors, weights,
  thresholds, missing-input treatment, response guidance, approval, and effective period

#### `qualification_assessments`

- Lead, model version, factor inputs, calculated score, calculated temperature,
  final temperature, override reason, assessor, and timestamp

The model result is explainable and historical; recalculation does not overwrite
an assessment used in a prior decision.

### Property media and sales enablement

#### `listings`

- Governed Area identity and retained customer-facing area label
- Separate optional Community/building/district text
- One property type, commercial package price and normal single-property attributes
- Bulk Deal parents derive their combined size from relational property rows

#### `listing_units`

- Bulk Deal listing, unique unit/property reference and display order
- Property-specific non-bulk type, bedrooms where applicable, size and asking price
- Plot rows have no bedrooms; built-property rows require bedrooms
- Rows are replaced atomically with a governed parent edit and retain database
  constraints against incomplete or duplicate property schedules

#### `property_media`

- Listing, storage key, media type, title, sort order, approval status, hash,
  source, created by, and timestamps

#### `financial_scenarios`

- Lead/opportunity, property, scenario type, input JSON, output JSON, currency,
  regulatory-assumption version, creator, and timestamp

Calculator JSON is acceptable for versioned scenario detail, but searchable
headline outputs such as price, loan amount, monthly payment, and yield should
also have typed columns.

#### `proposal_templates`

- Template type, version, brand version, active status, and configuration

#### `proposals`

- Lead/opportunity, contact, template version, status, creator, and timestamps

#### `proposal_versions`

- Proposal, version number, recipient and requirement snapshot, selected property,
  developer, media and financial snapshots, narrative, template/brand/disclaimer
  versions, data-as-of time, file metadata/hash, approval, created/sent/acknowledged times

#### `proposal_properties`

- Proposal version, listing, display order, and immutable property snapshot

#### `proposal_media`

- Proposal version, property media, display order, caption, placement, and immutable
  storage/hash snapshot for the exact customer output

### Operational documents

#### `document_templates`

- Controlled template type, version, approval status, effective period, storage key,
  hash, owner, and permitted usage

#### `documents`

- Logical document reference, type, title, direction, classification, status,
  owner, and created/updated metadata

#### `document_versions`

- Document, version number, superseded version, file metadata, private storage key,
  hash, creator, recipient, created/sent/received/acknowledged times, and immutable flag

#### `document_links`

- Document version, related entity type/ID, relationship type, and creator/time
- Phase 1 permits links to contacts, leads, activities, listings, proposals, and channels

### Reporting and configuration

#### `report_definitions` and `dashboard_definitions`

- Stable code, version, audience, scope policy, measures, dimensions, default filters,
  drill-down path, refresh/data-as-of behavior, export policy, status, and owner

#### `saved_views`

- User, dashboard/report, name, filter/sort configuration, private/shared status,
  and last-used time

#### `value_sets` and `value_definitions`

- Stable code, label, description, definition status, display order, default flag,
  configuration class, effective dates, replacement mapping, and audit metadata
- Used values are retired or mapped, never hard-deleted

#### `workflow_transitions`

- Workflow, from/to stable value codes, role/condition guard, reason requirement,
  effective dates, definition version, and approval metadata

### Release 1 integration foundation

#### `listing_intake_events` (Release 1.1 implemented)

- Stable event ID, provider code, source kind, external record ID and mapping version
- SHA-256 payload identity, database-only normalized payload, processing status,
  bounded safe error detail, attempt count and receive/process times
- Assigned NYSA reviewer, resulting Draft listing or possible-duplicate listing, and
  authorized replay actor
- Accepted events link exactly one Draft; failed, unmapped and duplicate-review events
  never create a partial or second listing

#### `listing_mapping_versions` and `listing_value_mappings` (Release 1.1 implemented)

- Provider/version stable identity, business name, Draft/Tested/Approved/Active/Retired
  status, test and approval evidence, actors, effective times and replacement lineage
- Listing field code, exact case-insensitive external value and governed CORE value;
  entries are editable only while their version is Draft
- One Active mapping version per provider; prior versions remain immutable and linked
  from the event/listing records that consumed them

#### `listings` integration identity (Release 1.1 implemented)

- Source kind, provider code, external record ID, mapping version text and immutable
  mapping-version identity are retained on integration/import-created inventory
- A partial unique index prevents two live listings for one provider/external record

#### `integration_accounts`

- Provider, environment, external account reference, enabled capabilities,
  credential reference, owner, status, and token/key expiry metadata
- Secret values remain outside the database record and repository

#### `integration_events`

- Provider, direction, event type, external event ID, idempotency key, received time,
  bounded/redacted payload, processing state, attempt count, and related CRM entity

#### `integration_failures`

- Event, failure category, safe error detail, first/last failure time, retry time,
  attempt count, resolution actor, resolution reason, and final state

#### `external_mappings`

- Provider, external object type/ID, internal entity type/ID, mapping version,
  active status, and last reconciliation time

## Release 2 Planned Entities

### Opportunity and deal

- `opportunities` and `opportunity_stage_history`
- `opportunity_attribution`
- `property_matches`
- `viewings` and `viewing_attendees`
- `offers`, `offer_revisions` and `negotiation_events`
- `bookings` and `booking_status_history`
- `deals` and `deal_parties`
- `checklist_templates`, `checklist_template_items`, `deal_checklists` and
  `deal_checklist_items`

The field-level design, lifecycle ownership, compatibility rules and authorization baseline are
in `RELEASE_2_SCOPE.md`. In particular, the roadmap requires explicit booking/reservation records;
booking must not exist only as a stage label. Checklist configuration and operational completion
move into Release 2, while sensitive document management and advanced compliance remain Release 6.
`opportunity_attribution` preserves the original lead/integration source plus stable campaign,
advert, form, landing-page and property identifiers as immutable provenance. Deals resolve that
provenance through their originating opportunity. Release 3 may map the stable identifiers to a
governed campaign master without rewriting history; campaign spend and ROI are not Release 2 data.

## Later Entities

### Campaign management (Release 3A)

- `campaigns` and `campaign_status_history`
- `campaign_properties`, `campaign_audiences` and `campaign_channels`
- `campaign_source_identifiers`, `campaign_targets` and governed budget records

The campaign master owns maintained business identity, ownership, objective, scope, dates, budget,
status and targets. It consumes rather than replaces the immutable Release 2 attribution chain.
Provider execution/reconciliation remains in Release 3B; authoritative cost/acquisition/return
analytics remain Release 6.

### Finance operations

- `commission_rules`
- `deal_commissions`
- `commission_splits`
- `commission_approvals`
- `commission_payments`

### Documents and compliance

- `document_access`

### Integrations

- `portal_publications`
- `portal_sync_runs`
- `portal_validation_results`
- `integration_checkpoints`

## Core Relationships

```text
Contact 1---* Lead *---1 Team
Contact 1---* Contact Channel
Contact 1---* Marketing Agreement *---1 Document Version
External Company 1---* External Company Role
                   *---1 Responsible User
Lead    1---* Assignment History
Lead    1---* Stage History
Lead    1---* Activity
Lead    1---* Task
Lead    1---* Qualification Assessment
Lead    1---1 Current Requirement
Lead    1---* Financial Scenario
Lead    1---* Proposal
Proposal 1---* Proposal Version *---* Listing Snapshot
Proposal Version 1---* Proposal Media
Document Version *---* Contact / Lead / Activity / Listing / Proposal

Qualified Lead 1---* Opportunity (Release 2)
Opportunity    1---* Viewing / Offer / Activity
Opportunity    1---0..1 Deal
Deal           1---* Commission / Document / Checklist
```

## Duplicate and Merge Rules

- Normalize emails to lowercase and trim whitespace.
- Normalize mobile numbers to E.164 before comparison.
- Exact verified email or mobile matches require merge review or explicit reuse.
- Fuzzy name matches only suggest duplicates; they never auto-merge.
- A merge retains source identifiers, relationship history, actor, reason, and time.
- Imports use stable external IDs and idempotency keys.

## Audit Requirements

Audit at minimum:

- User role, status, and team changes
- Contact merges and communication restrictions
- Marketing-agreement execution, withdrawal, expiry, and effective-consent changes
- Lead ownership, acceptance, reassignment, SLA, stage, and closure
- Qualification-model approval/versioning, calculation, and override
- Activity deletion or correction
- Financial-scenario and proposal generation, approval, delivery, and acknowledgement
- Document upload, version, link, access, send, receive, and acknowledgement
- Controlled-value, workflow-transition, dashboard, and report-definition changes
- Opportunity, offer, deal, commission, document, and approval changes
- Data exports and restricted-document access where feasible

## Migration Strategy

1. Preserve existing UUIDs and administrator access.
2. Add new tables and nullable references before enforcing new requirements.
3. Backfill role/team mappings through an explicit reviewed migration or admin workflow.
4. Deploy API support before requiring new fields where a rolling change is needed.
5. Test each migration against an isolated restored production backup.
6. Record backup, migration, smoke test, and rollback decision in the release notes.
