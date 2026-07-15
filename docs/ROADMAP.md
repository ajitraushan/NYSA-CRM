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

The detailed boundary and acceptance criteria are in `RELEASE_1_1_SCOPE.md`.
Live Property Finder, Bayut/dubizzle and other publication connectors remain
Release 4 scope.

## Release 2: Opportunity and Deal Pipeline

- Opportunities created from qualified leads
- Buyer-to-property matching
- Viewing scheduling, attendance, feedback, and follow-up
- Offers and negotiation history
- Booking and reservation records
- Closed-won and closed-lost deals
- Buyer, seller, landlord, tenant, broker, property, and developer relationships
- Configurable sale and rental completion checklists

## Release 3: Communications and External Lead Channels

- Email connection, message logging, and approved templates
- Google Calendar synchronization
- WhatsApp Business Platform integration, approved templates, consent, and message logging
- Property Finder lead retrieval after Enterprise API access and scopes are approved
- Bayut lead retrieval after Profolio Leads API entitlement is approved
- Meta Facebook/Instagram lead retrieval after business assets, permissions, and forms are approved
- Optional Meta conversion-outcome feedback as a separate privacy-approved data flow
- Integration failure queue, retry controls, and audit history

The final sequence may move selected email or calendar work into Release 1 after
provider accounts and compliance decisions are confirmed.

## Release 4: Inventory and Partner Operations

- Structured developer and agency profiles
- Listing source and verification status
- Availability and price history
- Duplicate listing detection and merge review
- Listing media and document management
- Portal-ready location, amenity, agent, permit, off-plan, and publication validation
- Property Finder listing publication and reconciliation through the Enterprise API
- Bayut/dubizzle listing publication and reconciliation through an approved XML feed
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
- Advanced management exports

## Release Gates

Every production release requires:

1. Approved acceptance criteria and migration plan.
2. Syntax, integration, permission, and workflow tests.
3. Verified PostgreSQL backup before deployment.
4. Forward migration in a non-production or isolated test database.
5. Production health, login, and controlled workflow smoke tests.
6. Updated project documents and release notes.
7. A committed and pushed Git version matching the deployed source.
