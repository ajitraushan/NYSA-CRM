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

