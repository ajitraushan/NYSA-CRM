# NYSA CRM Roadmap

## Delivery Principles

- Deliver a usable internal workflow at the end of every release.
- Establish ownership, audit, and data quality before adding automation.
- Add external integrations only after the underlying CRM records are stable.
- Treat customer-facing financial outputs as transparent estimates.
- Keep business rules configurable and migration-safe.

## Release 0: Production Inventory MVP - Implemented

- PostgreSQL production deployment
- Authentication, invitations, roles, and access revocation
- Property inventory, search, status, ownership, comments, and archiving
- Admin dashboard and audit history
- Secure session handling and production health endpoint
- Manual PostgreSQL backup with successful isolated restore test
- Private GitHub repository and initial source commit

Remaining operational item: hosting-provider confirmation of scheduled
PostgreSQL backup frequency, retention, and off-server storage.

## Release 1: Lead Operations and Sales Enablement - Local Completion Candidate

The implementation below is present on `agent/release-1-completion`. Production
acceptance remains gated by fresh/restored PostgreSQL migration, authenticated
workflow and reconciliation tests, timed proposal acceptance, verified backup,
exact-commit deployment, and production smoke testing.

### Foundation

- Product rename from NYSA Pocket Ledger to NYSA CRM
- Internal role model aligned to NYSA operations
- Teams, team membership, and team leads
- Contacts, companies, roles, communication preferences, and duplicate handling
- Lead sources, capture, ownership, assignment, acceptance, SLA, and reassignment
- Lead stage and assignment history
- Integration event, external mapping, idempotency, failure, and controlled-replay foundation
- Secured NYSA website form intake into the company lead queue
- NYSA Organization Settings and external-company category/multi-role separation
- Validated and normalized phone/email channels with duplicate review
- Versioned controlled-value administration and workflow-change governance

### Daily work

- Calls, notes, meetings, tasks, reminders, and next actions
- Agent work queue and overdue dashboard
- Manager queue and SLA dashboard
- Hot/Warm/Cold qualification with reasons and override audit
- Customer property requirements and inventory links
- Role-specific interactive Agent, Manager, and Managing Director dashboards
- Agent Call Report with filter, drill-down, reconciliation, and audited export

### Sales enablement

- Mortgage and ROI calculator with configurable assumptions
- Property media required for customer output
- Quick Proposal, Investment Presentation, and Property Comparison templates
- PDF generation, version history, and sent-status tracking
- Operational lead documents and attachments with secure versioned storage
- Approved Marketing Agreement template and agreement-driven consent status
- Versioned Qualification Model Setup separate from lead assessments
- Proposal cross-module data/media snapshots and exact-version delivery history

### Management

- New lead, movement, activity, conversion, lost-reason, and SLA reports
- CSV/Excel-ready exports where appropriate
- Import framework for data from the current CRM
- Executive targets, comparisons, trends, forward-looking risk indicators, and
  hierarchical summary-to-record drill-down

## Release 1.1: Listing Executive Workspace and Inventory Intake

- Dedicated personalized Listing Executive workspace for the existing
  `listing_agent` role
- Manual draft listing creation through a guided inventory workflow
- Controlled integration/import intake that creates reviewable, idempotent drafts
- Listing source, ownership, property, commercial, availability, verification,
  permit and readiness capture
- Private multi-image, floor-plan and brochure upload with cover, order, caption,
  source, rights, hash and approval controls
- Own/team/company inventory permissions and complete audit history
- Availability, expiry, completeness, duplicate, media and intake-exception queues
- Manager/admin review and approval controls
- Governed Area maintenance and area-specific lead routing with an `All areas`
  fallback under R1.1-AMD-001
- Business-friendly inventory amounts, structured handover, calculated publication
  readiness and governed Payment Plan/Funding compatibility under R1.1-AMD-002

The detailed boundary and acceptance criteria are in `RELEASE_1_1_SCOPE.md`.
Live Property Finder, Bayut/dubizzle and other publication connectors remain
Release 4 scope.

## Release 2: Opportunity and Deal Pipeline

Status: Authorized to begin by the NYSA owner on 2026-07-22. The accepted Release 1.1 source is
frozen in a separately checksummed production candidate on HOLD; Release 2 changes must remain
outside that candidate.

R2.0/R2.1 opportunity foundation is implemented locally on 2026-07-22 with 164 passing automated
tests. The isolated PostgreSQL migration/reconciliation passed against a restored CRM Test
snapshot with Release 1.1 counts unchanged and no automatic Opportunity creation. CRM Test
deployment and explicit functional acceptance remain open; no Release 2 feature is deployed or
accepted yet.

Requirements reconciliation, lifecycle compatibility, proposed data contracts, delivery slices,
acceptance criteria and decisions required before development are defined in
`RELEASE_2_SCOPE.md`.

- Reorganize the Agent workspace into a clear operational sequence from Customer
  creation to Lead generation, inventory matching, contact/qualification, viewing,
  offer, negotiation and outcome, without merging the customer and lead records
- Opportunities created from qualified leads
- Buyer-to-property matching
- Viewing scheduling, attendance, feedback, and follow-up
- Offers and negotiation history
- Booking and reservation records
- Closed-won and closed-lost deals
- Buyer, seller, landlord, tenant, broker, property, and developer relationships
- Configurable sale and rental completion checklists
- Preserve immutable original-enquiry campaign, advert, form, landing-page, source and property
  attribution from Lead through Opportunity, Booking and Deal, without introducing campaign
  management, spend or ROI calculations in Release 2

## Release 3: Campaign Management, Communications and External Lead Channels

Release 3 is intentionally sequenced as:

1. **Release 3A — Campaign Management MVP:** governed campaign master, ownership, objectives,
   properties, audiences, channels, dates, budgets, status, source identifiers, targets and
   operational lead/qualification/conversion reporting using the Release 2 attribution chain.
2. **Release 3B — Channels and Automation:** approved communications, calendars, lead providers,
   landing pages, advertisements, nurture and provider reconciliation consume the governed
   campaign identities rather than creating disconnected campaign labels.

Release 3 reporting may show lead volume, response, qualification and accepted deal conversion.
Financially authoritative CPL, CPA and ROI remain Release 6 until governed spend, revenue and
commission sources reconcile.

- Governed campaign management covering campaign identity, owner, objective,
  applicable properties, audience, channels, dates, budget, status, source identifiers
  and performance targets
- Preserve campaign, advert, form, landing-page and property attribution when an
  external enquiry enters the common lead-management workflow
- Expand automated routing only through an approved policy change, with candidate
  dimensions including governed territory/Area, language, property type, source and
  campaign; retain team-queue routing unless direct-to-agent assignment is separately
  approved
- Email connection, message logging, and approved templates
- Google Calendar synchronization
- WhatsApp Business Platform integration, approved templates, consent, and message logging
- Approved SMS integration and nurture sequences where the provider, consent basis,
  sender identity, opt-out handling and retention policy are confirmed
- Property Finder lead retrieval after Enterprise API access and scopes are approved
- Bayut lead retrieval after Profolio Leads API entitlement is approved
- Meta Facebook/Instagram lead retrieval after business assets, permissions, and forms are approved
- Google Ads lead/campaign attribution and LinkedIn lead integration only after
  account ownership, supported APIs, privacy basis and sandbox access are approved
- Optional Meta conversion-outcome feedback as a separate privacy-approved data flow
- Integration failure queue, retry controls, and audit history
- Provider-neutral Call, WhatsApp and Email action rail that preserves manual launchers
  before configuration and automatically correlates connected conversations afterward
- Connected meeting scheduling with provider event IDs, synchronization, cancellation,
  failure recovery and a clearly labelled `.ics` fallback
- Marketing landing-page capability for approved, localized property campaigns,
  including governed inventory/media consumption, consent-aware lead capture and
  immutable campaign attribution
- Governed dynamic advertisement templates that consume approved inventory values and
  media, surface availability/price changes for review and never silently publish
  changed advertising content
- Campaign reporting for lead volume, response, qualification and conversion, with
  cost-per-lead available only after governed channel-spend data is reconciled

The final sequence may move selected email or calendar work into Release 1 after
provider accounts and compliance decisions are confirmed.

Detailed planning records and acceptance dependencies are maintained in
`PLANNED_ENHANCEMENTS.md`. `ENH-DASH-001` was explicitly promoted into Release 1.1 as
`R1.1-AMD-016`; the broader sequential Agent workspace and deal pipeline remain Release 2.

## Release 4: Inventory and Partner Operations

- Structured developer and agency profiles
- Listing source and verification status
- Availability and price history
- Duplicate listing detection and merge review
- Listing media and document management
- Portal-ready location, amenity, agent, permit, off-plan, and publication validation
- Property Finder listing publication and reconciliation through the Enterprise API
- Bayut/dubizzle listing publication and reconciliation through an approved XML feed
- Provider-specific MLS/listing-feed adapters built on the Release 1.1 Draft-only
  intake contract, with governed CORE-admin business-value mappings and technical
  transformations retained in the integration/ETL layer
- Controlled two-way synchronization with approved external CRM platforms such as
  Salesforce, HubSpot or a bespoke system, only where field ownership, conflict
  resolution, deletion, replay and authoritative-system rules are explicitly approved
- Portal/source quality reporting that reconciles external listing, enquiry, campaign
  and lead identifiers rather than relying on source labels alone
- Co-broker and sharing controls only if NYSA later approves external access

## Release 5: Commissions and Finance Operations

- Percentage rules at broker and deal level
- NYSA, internal-agent, referral, and approved partner splits
- Approval workflow and exception handling
- Expected, approved, invoiced, received, and paid statuses
- Statements and accounting exports
- Director and accountant reporting

## Release 6: Documents, Compliance, and Advanced Reporting

- Buyer, seller, landlord, tenant, and transaction document records
- Configurable expiry reminders and completion checklists
- Restricted document access and approval history
- Lead conversion, inventory aging, source, revenue, and commission analytics
- Governed regional marketing-material compliance review, including applicable RERA
  permit/disclosure evidence, approval history, expiry and channel-specific release
  controls for digital and physical material
- Campaign cost-per-lead, cost-per-acquisition and marketing ROI only after channel
  spend, authoritative Release 2 deal outcomes and applicable revenue/commission data
  reconcile to the same campaign and property identities
- Agent performance reporting extended from response/SLA and lead conversion to
  authoritative viewings, offers, bookings, closed sales and booked value after the
  Release 2 source modules are accepted
- Privacy operations for integrated marketing data, including documented purpose,
  consent/legal basis, retention, correction, restriction, deletion/anonymization,
  vendor review and cross-border transfer controls
- Advanced management exports

## Reconciled Marketing and Lead-Management Planning Gate

The additions above were reconciled on 2026-07-21 as planning inputs. They do not
authorize development or production connection. Before implementation, NYSA must
approve the relevant release allocation, business owner, provider/account ownership,
authoritative data source, campaign and routing policy, privacy/compliance basis,
controlled-value mappings, sandbox credentials, measurable acceptance criteria and
CRM Test deployment plan. Google Ads and Google Calendar are separate integrations;
Property Finder/Bayut lead retrieval and listing publication are also separate flows.

## Release Gates

Every production release requires:

1. Approved acceptance criteria and migration plan.
2. Syntax, integration, permission, and workflow tests.
3. Verified PostgreSQL backup before deployment.
4. Forward migration in a non-production or isolated test database.
5. Production health, login, and controlled workflow smoke tests.
6. Updated project documents and release notes.
7. A committed and pushed Git version matching the deployed source.
