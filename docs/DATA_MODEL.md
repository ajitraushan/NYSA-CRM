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

#### `contacts`

- Person identity and display name
- Normalized primary email and mobile
- Preferred language, channel, and contact time
- Consent and communication restriction status
- Source, owner, lifecycle status, and merge pointer
- Created/updated/deleted metadata

#### `contact_roles`

- Contact and role such as buyer, seller, landlord, tenant, or investor

#### `companies`

- Legal/display name, type, registration fields when required, contact details, owner, and status

#### `company_contacts`

- Company, contact, job/relationship role, primary flag, and validity period

#### `contact_channels`

- Multiple email or phone values, normalized value, label, verification status,
  verification time, preferred flag, and restriction status

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

- Versioned model name, active period, factors, weights, and thresholds

#### `qualification_assessments`

- Lead, model version, factor inputs, calculated score, calculated temperature,
  final temperature, override reason, assessor, and timestamp

The model result is explainable and historical; recalculation does not overwrite
an assessment used in a prior decision.

### Property media and sales enablement

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

- Proposal, version number, selected property snapshot, financial snapshot,
  narrative, disclaimer version, file metadata, file hash, created/sent times

#### `proposal_properties`

- Proposal version, listing, display order, and immutable property snapshot

### Release 1 integration foundation

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

## Later Entities

### Opportunity and deal

- `opportunities`
- `opportunity_stage_history`
- `property_matches`
- `viewings`
- `viewing_attendees`
- `offers`
- `offer_revisions`
- `negotiation_events`
- `deals`
- `deal_parties`

### Finance operations

- `commission_rules`
- `deal_commissions`
- `commission_splits`
- `commission_approvals`
- `commission_payments`

### Documents and compliance

- `document_types`
- `documents`
- `document_access`
- `checklist_templates`
- `checklist_template_items`
- `deal_checklists`
- `deal_checklist_items`

### Integrations

- `portal_publications`
- `portal_sync_runs`
- `portal_validation_results`
- `integration_checkpoints`

## Core Relationships

```text
Contact 1---* Lead *---1 Team
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
- Lead ownership, acceptance, reassignment, SLA, stage, and closure
- Qualification calculation and override
- Activity deletion or correction
- Financial-scenario and proposal generation/sending
- Opportunity, offer, deal, commission, document, and approval changes
- Data exports and restricted-document access where feasible

## Migration Strategy

1. Preserve existing UUIDs and administrator access.
2. Add new tables and nullable references before enforcing new requirements.
3. Backfill role/team mappings through an explicit reviewed migration or admin workflow.
4. Deploy API support before requiring new fields where a rolling change is needed.
5. Test each migration against an isolated restored production backup.
6. Record backup, migration, smoke test, and rollback decision in the release notes.
