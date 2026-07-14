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
