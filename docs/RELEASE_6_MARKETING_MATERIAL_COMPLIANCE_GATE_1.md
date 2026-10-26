# Release 6 - Marketing Material Compliance - Gate 1

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 1 owner-approved; Gate 2 contract design authorized  
**Scope:** local/offline design only  
**Proposed migration:** `091_release6_marketing_material_compliance.sql` (not created or applied)

## 1. Business outcome

Create one governed release register for a complete marketing item before it may be used through an
intended channel. A marketing item can combine approved copy, a final creative or document, approved
property media, applicable listing permit evidence and required disclosures.

This story closes the gap between approving an individual property image and approving the complete
material in which that image and its claims will appear. It must not create a second Property Media
approval workflow, document store, campaign register, permit register, work queue or audit system.

## 2. Included material types and channel labels

The initial configurable material types are:

- property social creative or post;
- digital advertisement or banner;
- email or WhatsApp marketing creative;
- property brochure or flyer;
- print or outdoor creative; and
- other material type added directly by a full Administrator.

Channel labels are configuration and release-control dimensions only. They may include social,
website, email, WhatsApp, digital advertising, print and outdoor. Approval for one channel does not
authorize another channel.

Customer-specific proposals are excluded because the existing governed proposal workflow remains
authoritative for them.

## 3. Existing authorities to reuse

| Concern | Existing authority | This story's use |
| --- | --- | --- |
| Property and listing facts | Inventory/listing record | Required link for property-specific material and source of governed property facts |
| Images and usage rights | Property Media | Only approved media with confirmed, current rights may be attached |
| Final creative file | Existing private Documents/Versions | Reference a frozen file version; do not create another file store |
| Campaign identity and dates | `marketing_campaigns` | Optional link when the item belongs to a governed campaign |
| Permit and disclosure evidence | Inventory permit fields and Release 4 official-document evidence | Reference applicable current evidence without duplicating it |
| Follow-up work | Tasks / My Task Queue | Surface review, return and expiry work; a Task never constitutes approval |
| Accountability | Existing role scope and audit log | Enforce access and record every material decision |

## 4. Governed marketing-item version

Each submitted version freezes the following facts:

- material type, title, purpose, audience and intended regions;
- intended channels;
- property/listing and optional campaign link;
- final Document Version;
- selected approved Property Media references;
- headline, body-copy and disclosure snapshot or their frozen source references;
- applicable permit and official-evidence references;
- requested release-from and release-until dates; and
- author, submission time and declared change summary.

Editing an approved item creates a new draft version. It never changes the approved version or its
decision history.

## 5. Configuration and authority

### Full Administrator

A full Administrator directly maintains material types, channels, applicable regions, required
evidence/disclosure rules, review routes and validity settings. Administrator configuration and
Administrator operational decisions do **not** require maker-checker approval.

The Administrator may also approve, return, reject, withdraw or expire a material version directly,
with a mandatory reason and audit entry.

### Administrator Assistant

An Administrator Assistant may prepare draft configuration changes and draft marketing items within
assigned scope, but cannot activate configuration or approve/release material.

### Agent / Listing Agent

An Agent may create and submit material only for listings within existing authority. The author
cannot approve their own submitted material.

### Manager

A Manager is an authorized approver for marketing material concerning listings and agents within the
Manager's existing team scope. The Manager may approve, return or reject each requested channel. The
Manager cannot approve their own submitted material.

### Director

A Director is an authorized approver with organization-wide scope and may approve, return or reject
each requested channel. A Director may also handle escalated, company-wide or configured higher-risk
material. A Director cannot approve their own submitted material. This story does not automatically
classify any legal or regulatory category as high risk.

## 6. Workflow

1. **Draft:** author selects the item type, listing, optional campaign, final file version, approved
   media, channels, copy/disclosures and applicable evidence.
2. **Preflight:** CORE evaluates every selected channel against the active Admin configuration and
   existing source records. Missing, unapproved or expired dependencies block submission.
3. **Submit:** the exact version is frozen and a review Task with provenance appears in the My Task
   Queue of the Manager or Director selected by the active Admin approval route. Direct full-Admin
   review remains available.
4. **Review:** the responsible Manager, configured Director or full Administrator approves, returns
   or rejects each requested channel within their authority. A return/rejection requires a reason.
   Partial channel approval is permitted.
5. **Released for use:** an approved channel is usable only while every dependency remains current
   and its release window is open. This status authorizes internal use; it does not publish or send
   the item.
6. **Stale, expired or withdrawn:** a source expiry/change, configured validity end or explicit
   withdrawal removes current release eligibility. Re-release requires a new or resubmitted version
   as dictated by the active rule.

## 7. Channel-specific release gate

For each requested channel, release is blocked unless all configured requirements pass, including:

- the marketing-item version is approved for that exact channel;
- its final Document Version still exists and is the reviewed version;
- every attached Property Media record remains approved, has usage rights confirmed and has not
  passed its rights expiry;
- required listing permit and/or Release 4 official evidence is current;
- required configured disclosures are present in the frozen version;
- the linked campaign, when required by configuration, is in an eligible state and date range; and
- the requested release window is current.

The effective release-until time is the earliest applicable date among the requested end, marketing
item validity, campaign end, media-rights expiry, permit expiry and official-evidence expiry. A source
change never silently rewrites the original approval; it makes current eligibility stale and records
the reason.

## 8. My Task Queue and reminders

The existing Task authority will show:

- submitted material awaiting review;
- returned material awaiting correction;
- approved material approaching its effective release end; and
- material made stale by a dependency change.

Tasks must contain record identifiers and safe operational context only. They must not copy private
contact details or credential material.

## 9. Explicit exclusions

This Gate 1 story does not include:

- publishing, transmitting or synchronizing material to any external channel;
- Property Finder or any other portal work;
- external permit verification, regulator access or claims of regulatory certification;
- seeded assumptions about which RERA permit or disclosure is legally required;
- legal advice, automated legal interpretation or AI-generated compliance claims;
- a new Property Media approval queue, campaign module, proposal workflow, file store, official
  evidence register, Task system or dashboard;
- collection or display of private owner/contact/authority information; or
- CRM Test, Production, R2, cPanel, deployment, packaging or external-service changes.

Full Administrators must deliberately configure the applicable rules for NYSA's approved operating
regions and policies before those rules can block or authorize a release.

## 10. Gate 1 acceptance decisions

Gate 1 approval confirms all of the following:

1. The new business object is a complete, versioned marketing item, not another media record.
2. Property-specific items link to Inventory; Campaign is optional unless an Admin rule requires it.
3. Existing Property Media, Documents/Versions, Release 4 evidence, Tasks and audit are reused.
4. A full Administrator configures and decides directly without maker-checker approval.
5. Both Manager and Director are authorized approvers: Manager within existing team/listing scope and
   Director organization-wide. The submitting author cannot approve their own item; full-Admin direct
   authority remains available.
6. Approval and current release eligibility are evaluated separately for every intended channel.
7. The effective release end is the earliest applicable dependency expiry or configured end.
8. Actual publication, sending, external verification and Property Finder are outside scope.
9. No legal/regulatory requirement is assumed or seeded; Admin configuration is authoritative.
10. Migration `091` remains proposed and unapplied until Gate 2 is approved.

## 11. Four-gate delivery path

- **Gate 1 - Business design:** owner approves this boundary and workflow.
- **Gate 2 - Migration/API contract:** exact schema, state transitions, authority matrix, endpoints,
  Task provenance and acceptance tests are presented before implementation.
- **Gate 3 - Local implementation and review:** synthetic, offline code and UI are implemented and
  tested only after Gate 2 approval.
- **Gate 4 - Local completion:** owner accepts the local story; any future promotion remains a
  separately authorized activity.

Gate 1 approval authorizes only the Gate 2 contract design. It does not authorize implementation,
migration application, deployment or any external action.

Owner approval was recorded on 14 August 2026 after confirming that both Manager and Director are
authorized approvers within their respective scopes.
