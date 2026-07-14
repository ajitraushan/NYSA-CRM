# NYSA CRM Product Requirements

## Document Control

- Product: NYSA CRM
- Owner: NYSA Realty
- Status: Working baseline for phased delivery
- Last updated: 2026-07-14
- Current release: Production inventory and collaboration MVP
- Next release: Lead Operations and Customer Sales Enablement

## Product Purpose

NYSA CRM will be the internal operating system for NYSA Realty. It will manage
customer relationships, lead ownership, broker activity, property inventory,
sales execution, transaction records, commissions, documents, and management
reporting across sales, rentals, off-plan, secondary-market, and commercial
business.

The immediate business problems are lost or delayed leads, paper-based
follow-up, incomplete communication history, disconnected deal information,
and inconsistent inventory management.

## Confirmed Scope

### Business lines

- Residential and commercial sales
- Residential and commercial rentals
- Off-plan property
- Secondary-market property

### Internal users

- Administrators
- Sales agents
- Listing agents
- Team leads and managers
- Directors
- Accountants

### Excluded for now

- External broker access
- Customer self-service portal
- Automated decisions based on social-media screening
- Full accounting ledger or banking functions

## Existing Production Baseline

The current application already provides:

- PostgreSQL-backed production deployment
- Administrator and broker accounts, invitations, roles, and revocation
- Property inventory, filtering, ownership, status changes, and archiving
- Listing comments and collaboration
- Audit logging and secure cookie sessions
- Dashboard-first browser interface
- Versioned database migrations
- Verified database backup and restore procedure

## Next Release: Lead Operations and Customer Sales Enablement

### 1. Teams and ownership

- Create teams with a manager or team lead.
- Add internal users to one or more permitted teams.
- Receive new leads into a company-owned queue.
- Route leads to a team and then assign them to one responsible agent.
- Record every assignment, reassignment, acceptance, and rejection.
- Apply configurable response-time targets during configured business hours.
- Alert the agent and team lead before an SLA breach.
- Allow team-lead reassignment after timeout, absence, rejection, or workload review.

### 2. Contacts and companies

- Maintain one canonical person or company record.
- Allow a contact to act as buyer, seller, landlord, tenant, investor, or other
  approved role without creating duplicate people.
- Store normalized email and E.164 mobile numbers.
- Record preferred language, channel, contact time, consent, and communication restrictions.
- Detect likely duplicates by phone, email, and normalized identity fields.
- Preserve merge history and audit information.

### 3. Lead capture and qualification

- Capture leads from website forms, WhatsApp, existing CRM imports, referrals,
  social media, walk-ins, and manual entry.
- Record source, campaign, received time, business line, and customer requirement.
- Separate lead status from the post-qualification opportunity pipeline.
- Classify leads as Hot, Warm, or Cold using transparent first-party criteria.
- Show the score factors and allow an authorized manual override with a reason.
- Recommend response urgency and communication strategy without making an
  irreversible automated decision.
- Validate email or phone through appropriate verification services or customer
  confirmation; validation must not imply identity verification.

#### Website lead intake

- Provide a secured server-to-server endpoint for approved NYSA website forms.
- Capture the form, page, source, campaign, UTM values, consent evidence, and
  customer-submitted requirement data with the original received time.
- Authenticate requests with a rotatable secret or signature, apply rate and
  body-size limits, and reject invalid or replayed requests.
- Use an external event identifier or deterministic idempotency key so a retry
  cannot create a duplicate lead.
- Preserve a redacted integration event and processing result for support and audit.
- Route accepted records into the company queue; the public website must never
  assign a lead directly to an individual broker.

### 4. Customer requirements

Capture, at minimum:

- Transaction type and business line
- Preferred areas, projects, developers, and property types
- Bedrooms, size range, and other property constraints
- Minimum and maximum budget
- Cash, mortgage, or developer-plan funding
- Mortgage pre-approval status
- End-use or investment purpose
- Target yield when applicable
- Purchase or move-in timeline
- Decision-maker and other stakeholders
- Must-have, preferred, and excluded requirements

### 5. Lead and opportunity lifecycle

Lead statuses:

`New -> Assigned -> Contact Attempted -> Contacted -> Qualified -> Converted`

Terminal or holding statuses:

`Nurture`, `Unqualified`, `Lost`, and `Duplicate`

After qualification, an opportunity follows:

`Requirements -> Matching -> Viewing -> Offer -> Negotiation -> Booking -> Closed Won`

An opportunity may also become `Closed Lost`, with a required reason.

### 6. Activities and follow-up

- Record calls, meetings, notes, tasks, emails, WhatsApp interactions, and viewings.
- Require a next action and due date for active leads unless explicitly placed in nurture.
- Show overdue and upcoming work on the agent dashboard.
- Maintain an immutable activity and stage history.
- Allow managers to review activity without altering the original author or timestamp.

### 7. Customer qualification model

The initial score will use configurable weights for:

- Requirement clarity and property fit
- Budget confirmation and funding readiness
- Purchase or rental timeline
- Decision-maker access
- Responsiveness and engagement
- Completed next steps

The result must show why a lead is Hot, Warm, or Cold. Sensitive personal traits
and unverified social-media conclusions must not influence scoring.

### 8. Financial and ROI calculator

- Calculate loan amount, down payment, monthly repayment, total repayment, and interest.
- Support interest rate, term, fees, and alternative scenarios.
- Display estimated loan-to-value and debt-burden indicators when sufficient inputs exist.
- Calculate gross yield, net yield, annual costs, vacancy assumptions, and cash-on-cash return.
- Make every assumption visible and editable.
- Mark results as estimates and never represent financing approval or guaranteed returns.
- Keep regulatory thresholds and fee assumptions configurable rather than hard-coded.

### 9. Customer Proposal Builder

An agent must be able to create a concise NYSA-branded proposal by selecting a
customer and one or more properties rather than retyping information.

Required output:

- Customer objective and requirement summary
- Property details, developer, location, price, status, and handover information
- Approved photographs, floor plan, and property highlights
- Payment plan and estimated acquisition costs
- Mortgage, yield, and ROI scenarios with visible assumptions
- Customer-specific suitability points
- Risks, disclaimers, agent details, generation date, and version
- Optional comparison of up to three properties

Initial templates:

- Quick Proposal: one to two pages
- Investment Presentation: three to five pages
- Property Comparison: up to three properties

The agent must review and edit narrative text before export. Each generated PDF
must be linked to the lead or opportunity and record creator, version, creation
time, and sent time. Generated customer documents and their personal data are
stored securely outside Git.

### 10. Dashboards and reports

Minimum reports:

- New leads by source, team, and agent
- Unassigned, unaccepted, overdue, and SLA-breached leads
- Lead movement and stage-aging report
- Calls, activities, and follow-up completion
- Qualification distribution and conversion funnel
- Lost and unqualified reasons
- Viewings, offers, bookings, closed deals, and booked value
- Inventory availability, verification, and aging
- Agent and team performance
- Data-quality and duplicate report

Reports must support date, source, team, agent, business line, and stage filters.

### 11. External lead integrations

- Retrieve Property Finder leads through the approved Enterprise API scopes.
- Retrieve Bayut lead activity through the approved Leads API, subject to NYSA's
  Profolio account entitlement and vendor-issued access.
- Retrieve Meta leads generated by approved Facebook or Instagram instant-form
  and messaging campaigns through Meta's supported CRM integration mechanisms.
- Store portal, account, form, campaign, advert, listing, and external lead
  identifiers where the provider supplies them.
- Normalize each provider payload into the same company-owned lead workflow while
  retaining its original source and processing history.
- Deduplicate retries, handle out-of-order events, expose failures to an authorized
  support queue, and allow controlled replay after correction.
- Treat Meta lead retrieval and sending later CRM conversion outcomes to Meta as
  separate, separately approved data flows.

### 12. Property portal publication

- Publish approved listing data to Property Finder using its supported Enterprise API.
- Publish approved listing data to Bayut/dubizzle using the vendor-approved XML feed.
- Keep NYSA CRM as the operational source for listing content and availability,
  subject to portal-side verification, credit, quality, and regulatory rules.
- Map portal-specific location, property type, offering type, amenities, agent,
  permit, media, off-plan, price, and availability fields explicitly.
- Prevent publication when required data, approved media, or regulatory permit
  information is missing or invalid.
- Record external listing identifiers, publication state, last successful sync,
  payload version, validation messages, and retry history per portal.
- Support create, update, deactivate, and reconciliation workflows without creating
  duplicate portal listings.

## Planned Later Capabilities

- Buyer-to-property matching
- Viewing scheduling and attendance
- Offers, negotiations, bookings, and deal records
- Structured sale and rental document checklists
- Commission rules, internal splits, referrals, approvals, and payment status
- Email, Google Calendar, and WhatsApp Business integrations
- Property Finder, Bayut, Meta, and accounting integrations after vendor access approval
- Broader management and financial reporting

## Non-Functional Requirements

- Responsive operation on current desktop and mobile browsers
- Role-based access enforced by the API, not only hidden in the interface
- Audit history for material access and business changes
- PostgreSQL migrations with forward-only numbered files
- Secure, HttpOnly production sessions and TLS-only access
- No production secrets in source code or Git history
- Configurable business rules and regulatory assumptions
- Duplicate prevention and idempotent imports
- Exportable business data and tested backup restoration
- Clear loading, empty, validation, success, and failure states
- Accessibility-conscious forms, labels, keyboard use, and readable contrast

## Privacy and Compliance Principles

- Collect only data required for a documented business purpose.
- Record consent and communication preferences where required.
- Support correction, restriction, and controlled deletion or anonymization requests.
- Review vendors and cross-border transfers before enabling enrichment or integrations.
- Restrict identity and transaction documents by role and purpose.
- Do not use social-media profiling in the first release.
- Validate Dubai transaction checklists with current Dubai Land Department guidance
  and validate mortgage assumptions against current Central Bank requirements before release.

## Open Business Decisions

1. Initial operating geography: Dubai only or multiple Emirates.
2. Initial team structure and routing queues.
3. Business hours and default acceptance/first-contact SLA values.
4. Existing CRM name, export format, record volume, and attachment volume.
5. Email provider and account model.
6. WhatsApp Business Platform account and dedicated number readiness.
7. Approved NYSA proposal sample, brand assets, property image sources, and disclaimer text.
8. Final sale-document checklist, which was incomplete in the original response.
9. NYSA website form inventory, hosting owner, payload fields, consent text, and deployment contact.
10. Property Finder account, Enterprise API access, sandbox keys, scopes, and portal field rules.
11. Bayut/Profolio XML and Leads API entitlement, specifications, credentials, and sync limits.
12. Meta Business Portfolio, Page, Instagram account, ad account, app ownership, lead forms,
    permissions, privacy policy, and token-management owner.

## External References

- UAE data protection: https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws.
- CBUAE mortgage regulation: https://rulebook.centralbank.ae/en/rulebook/regulations-regarding-mortgage-loans
- DLD sale registration: https://dubailand.gov.ae/en/eservices/property-sale-registration/
- DLD tenancy guidance: https://dubailand.gov.ae/en/frequently-asked-questions
- Property Finder Enterprise API integration: https://support.propertyfinder.ae/hc/en-us/articles/28266806720914-How-to-integrate-your-CRM-with-PF-Expert-2-0-using-the-Enterprise-API
- Property Finder Enterprise API documentation: https://expert-staging.propertyfinder.ae/documentation/
- Bayut external CRM XML listing feed: https://support.bayut.com/hc/en-us/articles/18984946157714-Our-listings-are-posted-through-our-own-CRM-What-are-the-guidelines-for-posting-an-Off-plan-listing
- Bayut Leads API overview: https://support.bayut.com/hc/en-us/articles/16703746688786-What-is-the-Leads-API
- Meta CRM lead retrieval distinction: https://www.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-forms
- Meta Conversions API overview: https://www.facebook.com/business/help/AboutConversionsAPI
