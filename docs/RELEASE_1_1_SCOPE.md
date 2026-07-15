# NYSA CORE Release 1.1 Scope

## Release identity

- Name: Listing Executive Workspace and Inventory Intake
- Sequence: after Release 1 acceptance and before Release 2
- Primary internal role code: `listing_agent`
- User-facing role label: Listing Executive
- Production principle: NYSA CORE remains the authoritative inventory record

## Objective

Give Listing Executives a dedicated operational workspace for creating, completing,
validating, maintaining, and enriching listings. Listings may begin through manual
entry or a controlled integration/import event, but every externally initiated
record enters a reviewable draft workflow before it can become approved inventory.

## Included scope

### Role-specific workspace

- Personalized Listing Executive workspace and title
- Quick actions for manual listing, integration/import intake, media upload, and
  availability confirmation
- Role-scoped KPIs for active listings, drafts, overdue availability confirmation,
  pending verification, expiring permits, incomplete media, approval queues,
  portal-readiness blocks, and failed/unmapped intake events
- Work queues for incomplete drafts, validation exceptions, duplicate candidates,
  media approval, availability refresh, permit/verification expiry, and integration
  review
- Own-listing detail and history without exposing unrelated customer records

### Listing initiation and lifecycle

- Manual listing creation by an authorized Listing Executive
- Provider-neutral integration/import intake that creates a draft rather than an
  approved or published listing
- Stable source, provider, external-record ID, event ID, mapping version, and
  idempotency controls
- Duplicate detection/review before creating a second inventory record
- Draft, review, approved/available, reserved/under-offer, closed, and blocked
  operational states with timestamped reasoned history
- Availability confirmation and aging controls
- Manager/admin approval where required by policy

### Listing information

The guided capture flow groups fields by purpose:

1. Source and ownership: origin, external reference, Listing Executive, owner/
   landlord/seller, developer/agency, mandate and exclusivity.
2. Property identity: business line, sale/rental offering, project, building,
   developer, area/community, property type, unit reference, ready/off-plan status.
3. Property attributes: bedrooms, bathrooms, size, floor, parking, furnishing,
   amenities, features, handover, description and highlights.
4. Commercial terms: price, currency, reference price, payment plan, deposit/down
   payment, handover/post-handover terms, availability and reservation status.
5. Compliance/readiness: verification state and expiry, permit number and expiry,
   authority evidence, data completeness, media completeness, and portal-readiness
   result.

Controlled values use stable codes and governed labels. Provider values are mapped
to those codes; an unmapped value creates an exception instead of silently adding a
new production value.

### Photographs and property media

- Private multi-file upload for supported photographs, floor plans and brochures
- JPEG, PNG, WebP and PDF validation within configured limits
- File type/magic, size, hash, source, owner, caption, category, display order and
  approval state
- Cover-image selection and ordered thumbnail gallery
- Media-source and permitted-usage/rights confirmation, including expiry where
  applicable
- Duplicate-file detection by hash
- Manager/admin approval and rejection with reason and audit history
- Only approved media may appear in customer proposals or satisfy readiness rules

Video and virtual-tour content is stored as an approved governed link unless a later
release explicitly approves private video-file storage.

### Integration intake

```text
Approved source or import
-> authenticated integration event
-> mapping and validation
-> idempotency and duplicate check
-> draft listing
-> Listing Executive review
-> manager/admin approval where required
-> available inventory
```

- Invalid events fail without partial listing or media records.
- Retrying an accepted event does not create another listing.
- Corrected failed events can be replayed through the controlled failure queue.
- An integration cannot silently overwrite approved fields; material changes create
  a review item and preserve prior values.
- Credentials and full sensitive payloads remain outside browser code, logs and Git.

### Permissions and audit

- Listing Executive: create listings, edit own drafts/owned listings, upload media,
  resolve assigned exceptions, and confirm availability.
- Sales Agent: read inventory; create/edit only where separately granted.
- Manager/Team Lead: team inventory, review, approval, reassignment and exception
  handling.
- Managing Director: company-wide read and drill-down, without routine operational
  editing.
- Administrator: configuration, controlled corrections, assignments and approvals.
- Accountant: read-only inventory fields required for approved finance work.
- Customer/lead access remains limited by the existing CRM scope policy.
- Creation, material edit, source mapping, media, approval, rejection, reassignment,
  status, availability and integration-replay actions are audited.

## Acceptance criteria

1. A maintained `listing_agent` user lands on a personalized Listing Executive
   workspace rather than the lead-centric Sales Agent dashboard.
2. An authorized Listing Executive can create, save, resume and submit a manual
   draft containing the approved listing fields.
3. An authenticated provider-neutral intake event creates exactly one reviewable
   draft with its source identifiers and processing history.
4. Invalid, oversized, unauthorized, duplicate or replayed intake fails safely and
   creates no partial listing/media records.
5. Own/team/company permissions are enforced by authenticated API tests, including
   cross-owner and cross-team denial.
6. Every workspace KPI and queue reconciles to its contributing inventory records.
7. Availability, verification, permit, completeness and readiness exceptions open
   the exact affected listings.
8. Authorized users can upload multiple private photographs, select a cover,
   reorder/caption them, and submit them for approval.
9. Unsupported or deceptive file content is rejected before persistence; duplicate
   hashes are identified.
10. Only approved, permitted-use media can be selected for a proposal or counted as
    media-ready.
11. Integration changes to approved inventory require review and preserve the prior
    value and actor/event history.
12. Manual and integration-created listings use the same controlled values,
    validation, lifecycle, permission and audit rules.
13. All migrations apply from zero and to an isolated restored backup; existing
    inventory and media are preserved.
14. Production health, login, workspace, manual draft, media, approval, denial and
    integration-idempotency smoke tests pass on the committed source.

## Explicitly excluded

- Direct Property Finder, Bayut/dubizzle or other vendor publication connectors
- Automatic publication or provider-controlled overwrite of NYSA inventory
- Portal credit, billing or vendor-account administration
- External broker or customer access
- Advanced partner sharing, feed reconciliation and portal performance analytics
- Full transaction/compliance document management

Those portal and partner operations remain in Release 4 unless separately approved
through the decision and release-control process.

## Entry and exit gates

- Entry: remaining Release 1 acceptance evidence and business sign-off are closed.
- Exit: all acceptance criteria above pass, a verified PostgreSQL backup exists,
  production is deployed from an exact committed revision, and the deployment
  history is updated.
