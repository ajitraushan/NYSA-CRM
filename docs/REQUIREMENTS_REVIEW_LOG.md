# NYSA CRM Requirements Review Log

## Purpose

This log records gaps, clarifications, and change requests discovered while NYSA
reviews the field and label register. Items remain here until they are incorporated
into the approved requirements, data model, acceptance criteria, and signed-off
field register.

## Review Findings

### RR-001: Phase 1 Lead Documents and Attachments

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Activities, Leads, Proposal Builder, File Storage, Audit

#### Business need

NYSA must retain the exact operational document sent to or received from a customer,
such as an offer letter, proposal, brochure, floor plan, quotation, payment plan,
mortgage illustration, requirement document, or correspondence attachment. An
activity such as "Offer letter sent" must link to the precise document version.

#### Phase 1 fields to add

- Document ID and document reference
- Document type and title
- Related contact, lead, activity, and property
- File name, media type, extension, and size
- Storage reference and file hash
- Version number and superseded-document reference
- Direction: sent, received, or internal
- Communication channel
- Uploaded by and uploaded time
- Sent by, sent time, and recipient
- Received time and acknowledgement time
- Status: draft, final, sent, acknowledged, or superseded
- Access classification
- Notes

#### Phase boundary

Phase 1 includes operational lead documents and correspondence attachments. Full
transaction and compliance document management, including identity documents,
title deeds, contracts, Ejari, expiry rules, approval workflows, and completion
checklists, remains a later phase unless NYSA separately approves the necessary
restricted-access, retention, and compliance controls.

#### Required updates

- Add a Lead Documents and Attachments module to the field register.
- Add document links to activities, leads, properties, and proposals.
- Add secure file metadata and version relationships to the data model.
- Add upload, access, send, version, and audit acceptance criteria.

### RR-002: Marketing Consent Requires an Executed Marketing Agreement

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Contacts, Contact Channels and Consent, Documents, Templates,
  Activities, Communications, Audit

#### Business rule

Marketing consent may be recorded as `Granted` only when an executed NYSA Marketing
Agreement exists for the contact. The agreement must be generated from an approved,
version-controlled standard template and linked to the consent record. An agent may
not manually set consent to `Granted` without that evidence.

The following are not sufficient by themselves to record marketing consent as
`Granted`:

- Verbal confirmation
- An unlinked website or campaign checkbox
- An imported consent flag without the executed agreement
- A note, email, or WhatsApp message that is not the approved agreement
- An administrator or agent selecting `Granted` without documentary evidence

#### Fields and controls to add

- Consent agreement document ID
- Marketing agreement template ID and version
- Agreement status: draft, issued, viewed, executed, declined, withdrawn, expired,
  or superseded
- Issued date and issued by
- Executed date, execution method, and evidence reference
- Signatory/contact identity reference
- Consent scope and approved communication channels
- Effective date and optional expiry/review date
- Withdrawal date, reason, and recorded by
- Superseding agreement reference

#### Workflow and validation

1. An authorized user generates or issues the standard Marketing Agreement.
2. The customer executes the agreement through the approved method.
3. The system verifies that the agreement is in `Executed` status.
4. Only then may the linked channel consent status become `Granted`.
5. Withdrawal, expiry, invalidation, or supersession immediately updates the effective
   consent status and prevents prohibited marketing communication.
6. Every status change, document version, actor, and timestamp is auditable.

Operational communication required to service an active enquiry must remain separate
from marketing consent and follow NYSA's approved legal and privacy policy.

#### Required updates

- Replace free manual selection of `Granted` with agreement-driven status.
- Add a standard Marketing Agreement template to Phase 1 document requirements.
- Link consent records to the exact executed agreement version.
- Add API validation preventing unsupported consent grants.
- Add acceptance tests for issue, execution, withdrawal, expiry, supersession, and
  communication suppression.

### RR-003: Contact Channel Type and Value Validation

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Contacts, Contact Channels and Consent, Duplicate Detection,
  Website Intake, Meta and Portal Lead Intake, Communications

#### Data design refinement

Use separate controlled fields rather than treating WhatsApp as a second copy of a
mobile number:

- Channel kind: `Phone` or `Email`
- Channel label: `Mobile`, `Work`, `Home`, or `Other`
- WhatsApp enabled: `Yes`, `No`, or `Unknown` for phone channels
- Raw value: the value supplied by the customer or provider
- Normalized value: the canonical value used for matching and communication

The channel kind and label use controlled lists and do not permit arbitrary free text.

#### Conditional validation rules

For phone values:

- Remove display spaces, dashes, and brackets during normalization.
- Store the normalized value in E.164 form with country code.
- Require a valid country calling code and plausible digit length.
- Do not assume that a syntactically valid number exists or belongs to the customer.
- WhatsApp enabled may only apply to a phone channel.

For email values:

- Trim surrounding whitespace and normalize the comparison value to lowercase.
- Apply a standards-based email syntax check and a maximum length of 254 characters.
- Do not treat syntax validation as proof that the mailbox exists or belongs to the
  customer.
- Email channels cannot be marked as WhatsApp enabled.

#### Duplicate and verification controls

- The same normalized value may not be duplicated on one contact without an explicit
  exception.
- A match on another contact produces a duplicate-review warning; verified matches
  require authorized reuse or merge review.
- Verification status remains separate: unverified, pending, verified, invalid, or
  bounced.
- Provider-imported values pass through the same server-side validation and
  normalization as manually entered values.
- Validation is enforced by the API and database constraints where practical, not
  only by the screen.

#### Required updates

- Replace the current single `channel_type` list with channel kind, label, and
  WhatsApp-enabled fields.
- Document type-specific validation messages and examples in the field register.
- Add normalized-value uniqueness and duplicate-review rules.
- Add tests for UAE and international numbers, email edge cases, provider imports,
  duplicate contacts, and invalid channel/WhatsApp combinations.

### RR-004: Separate NYSA Organization Settings from External Companies

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Organization Settings, Companies, Contacts, Leads, Inventory,
  Integrations, Documents, Future Deals and Commissions

#### Scope clarification

The Companies module represents external organizations with which NYSA has a
business relationship. Examples include developers, corporate customers, other
real-estate agencies, referral partners, banks or mortgage providers, property
managers, vendors, professional service providers, and relevant government bodies.

Creating an external company record does not create a user account or grant access
to NYSA CRM. External access remains out of scope unless separately approved.

NYSA Realty's own legal identity, branches, licence details, branding, and provider
accounts belong in a separate Organization Settings module and must not be mixed
with external company records.

#### Data design refinement

Replace the single `company_type` concept with two separate concepts:

- Company category: the organization's fundamental classification, such as
  Developer, Real-estate Agency, Corporate Customer, Financial Institution,
  Vendor, Government, or Other.
- Company roles: one or more business roles in relation to NYSA, such as Buyer,
  Seller, Landlord, Tenant, Developer, Referral Partner, Service Provider, Mortgage
  Provider, or Listing Source.

A company may hold multiple roles without creating duplicate company records.

#### Phase 1 company scope

- Company ID and external reference
- Legal and display name
- Company category and multiple roles
- Registration country and trade licence when applicable
- Primary contact and additional associated contacts
- NYSA relationship owner
- Lifecycle/status
- Contact details and website
- Related leads, activities, documents, projects, and listings
- Current CRM and future portal mapping identifiers

Company selection remains optional and unobtrusive for individual consumer leads.
It becomes required when the customer or another material party is an organization.

#### Required updates

- Add a separate NYSA Organization Settings module and field group.
- Rename/refine the Companies module as External Companies or Business Accounts.
- Replace `company_type` with company category and multi-role relationships.
- Ensure company records do not imply authentication or external access.
- Add company-to-contact, lead, activity, document, project, and listing relationships.
- Add duplicate review based on normalized legal name, trade licence, registration
  country, and verified contact details.

### RR-005: Proposal Composition, Media Selection, and Version Snapshot

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Proposal Builder, Property Inventory, Property Media, Financial
  Calculator, Contacts, Documents, Activities, Audit

#### Scope clarification

Proposal Setup should contain composition and delivery controls, not duplicate all
customer, property, media, and financial data. A proposal pulls approved data from
the linked contact, lead requirement, selected properties, property media, and saved
financial scenarios. Before generation, it creates an immutable version snapshot so
the exact content sent to the customer remains reproducible even if source records
later change.

Property images are managed in Property Media. Proposal Setup allows the agent to
select which approved images, cover image, floor plans, brochure pages, video/virtual
tour links, and captions appear in each property section. The proposal version stores
the selected media references and immutable display snapshot.

#### Proposal fields and controls to add

- Proposal title, language, currency, and validity date
- Recipient name, recipient company, and delivery contact
- Agent name, title, phone, email, and team snapshot
- Selected sections and display order
- Selected properties and comparison order
- Selected cover image and approved media per property
- Image captions, floor-plan inclusion, and optional media links
- Customer objective and requirement summary snapshot
- Property highlights, location highlights, amenities, and suitability narrative
- Payment-plan and acquisition-cost sections
- Selected mortgage/ROI scenarios and visible assumptions
- Key considerations, risk notes, disclaimer, and call to action
- Template version, brand version, disclaimer version, and data-as-of time
- Proposal version number and superseded-version reference
- Review/approval status, reviewer, and approval time
- Generated file name, storage reference, file hash, and generation time
- Delivery channel, recipient, sent by, sent time, and acknowledgement/view status

#### Validation and audit

- Only approved property media may be selected.
- Required property, price, permit, media-rights, and financial assumptions must pass
  validation before generation.
- Generated or sent versions are immutable; editing creates a new version.
- Every generated version links to the customer, lead, properties, financial scenario,
  template, media snapshot, creator, and delivery activity.
- Customer documents and images remain outside Git and public storage.

#### Required updates

- Expand Proposal Setup fields and add explicit proposal-media selection.
- Link generated proposal versions to Lead Documents and Activities.
- Add proposal-version snapshot entities and relationships to the data model.
- Add generation, visual-content, version, delivery, and reproduction acceptance tests.

### RR-006: Dedicated Phase 1 Reporting and Dashboard Module

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Dashboard, Reporting, Leads, SLA, Activities, Tasks,
  Qualification, Inventory, Integrations, Audit

#### Gap

The product requirements include dashboards and management reports, and the field
register identifies fields used in reports, but the register does not currently
define a dedicated Reporting and Dashboard module with its own filters, measures,
views, drill-down behavior, export rules, and role scope.

#### Phase 1 dashboards

Agent dashboard:

- Assigned leads by status and qualification
- Leads awaiting acceptance and approaching/breaching SLA
- Overdue, due-today, and upcoming tasks and next actions
- Recent customer activities and follow-up gaps
- Personal activity counts and lead movement

Manager dashboard:

- Company/team queue, unassigned leads, and assignment workload
- Acceptance and first-contact SLA performance
- Lead aging, stage movement, and stalled leads
- Team calls, activities, follow-up completion, and overdue work
- Qualification distribution, source performance, conversion, and loss reasons
- Integration failures requiring operational attention

Director dashboard:

- Lead volume and trend by source, business line, team, and agent
- Conversion funnel and lead aging
- SLA and response performance
- Inventory availability, verification, and aging
- Proposal generation and delivery activity
- Data-quality, duplicate, consent, and integration exception indicators

#### Reporting controls and fields

- Reporting period and comparison period
- Business line, source, campaign, team, agent, queue, and lead-status filters
- Qualification, activity type, task status, inventory status, and portal filters
- Saved view name, owner, visibility, default flag, and filter definition
- Measure definition, calculation date/time, and data-as-of timestamp
- Drill-down target and record-scope enforcement
- Export format, requested by, requested time, row count, and audit reference
- Dashboard refresh status and last successful refresh time

#### Scope boundary

Phase 1 reports use Phase 1 records only. Viewing, offer, negotiation, booking, deal,
revenue, and commission measures become available when their source modules are
implemented in later releases. The dashboard must not display invented or manually
approximated deal KPIs before those records exist.

#### Required updates

- Add Reporting and Dashboard as a field-register module.
- Add a report catalogue with owner, audience, filters, measures, drill-down, export,
  and reconciliation rules.
- Add role-specific dashboard acceptance criteria.
- Require every displayed count to reconcile to accessible underlying records.
- Audit exports and enforce the same role and team scope as operational screens.

### RR-007: Separate Qualification Model Setup from Lead Assessment

- Date raised: 2026-07-14
- Raised during: Phase 1 field and label review
- Status: Accepted for inclusion in the next register revision
- Priority: Must
- Affected modules: Qualification Model Setup, Qualification Assessment, Leads,
  Activities, SLA, Dashboard, Audit

#### Scope clarification

The Qualification Scoring Model is a separate, version-controlled business-rules
configuration. A Qualification Assessment is one historical application of a
specific model version to a specific lead. The assessment references the model and
stores the factor inputs, calculated result, explanation, and any authorized
override.

Phase 1 uses an explainable weighted rules model, not an opaque AI or machine-learning
service. Sensitive traits, inferred social-media characteristics, and unverified
external conclusions are excluded.

#### Qualification model fields

- Model ID, name, and description
- Version number and version status: draft, approved, active, retired
- Effective-from and effective-to dates
- Factor code, label, guidance, input source, minimum, maximum, and required rule
- Factor weight and display order
- Missing-input treatment
- Score normalization method
- Hot, Warm, and Cold threshold ranges
- Recommended response time and communication strategy by result
- Created by/time, approved by/time, and approval reason
- Superseded-model reference

An activated model version is immutable. Changes create a new version so prior
assessments remain reproducible.

#### Assessment behavior

1. The system or authorized agent captures the approved factor inputs.
2. The active model version calculates a normalized score and proposed Hot/Warm/Cold
   result.
3. The assessment shows each factor value, weight, contribution, missing input, and
   resulting recommendation.
4. An authorized user may override the final classification only with a reason.
5. The assessment stores the exact model version and input snapshot.
6. Recalculation creates a new assessment rather than overwriting the previous one.

#### Required updates

- Add a Qualification Model Setup module to the field register.
- Keep Qualification Assessment as a separate runtime/history module.
- Rename the assessment field to `Scoring Model Version` and make it read-only.
- Add model approval, versioning, threshold, factor-weight, and effective-date fields.
- Add tests for threshold boundaries, missing inputs, model activation, retirement,
  override authorization, explanation, and historical reproducibility.
