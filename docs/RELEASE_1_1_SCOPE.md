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

#### Listing Executive workspace and manual review lifecycle

- Amendment ID: R1.1-AMD-003
- Related UAT finding: R1.1-UAT-002 (pre-implementation listing-workspace and lifecycle review)
- Agreed requirement: A maintained `listing_agent` must be presented as a Listing
  Executive and land on a dedicated, own-record inventory workspace rather than the
  lead-centric Sales Agent dashboard. The workspace must provide a clear manual-draft
  action, reconciled workload counts and actionable queues for drafts, returned
  records, approval, availability, verification, permit, media and readiness attention.
  A new manual listing is saved as a resumable Draft and cannot enter operational
  availability until its readiness evidence is complete, the Listing Executive submits
  it and the responsible Manager or Administrator approves it. A reviewer may return
  the exact record with mandatory correction instructions, block it with a reason or
  restore a blocked record to Draft. Material owner edits to an approved listing require
  a new review. Existing inventory is preserved as approved during migration. Sales
  Agents can read approved inventory but cannot create manual drafts without a future
  separately governed grant. Non-approved drafts remain limited to their owner,
  responsible management scope and authorized administration. Every transition records
  actor, timestamp, prior/new state and reason in immutable audit history.
- Status: Implemented locally and verified by the 126-test automated suite. CRM Test
  deployment, authenticated role/scope retest and explicit user confirmation remain
  pending.
- Retest condition: On CRM Test, sign in as a Listing Executive and confirm the
  dedicated title, own-record KPIs/queues and manual Draft action. Save and resume an
  incomplete draft; confirm it cannot be submitted until readiness blockers are
  resolved. Submit it, confirm it appears in the responsible Manager's Inventory
  `Awaiting review` filter, request changes with instructions, correct and resubmit the
  same record, then approve it. Confirm availability changes are blocked before
  approval and enabled afterward. Confirm a Sales Agent cannot create a draft or read
  another user's non-approved draft, an unrelated Manager cannot review it, existing
  inventory remains approved, and the full workflow history is visible. Explicit user
  confirmation is required before closure.

#### Listing Executive inventory presentation

- Amendment ID: R1.1-AMD-003 Revision 1
- Related UAT finding: R1.1-UAT-004 (CRM Test Listing Executive workspace presentation retest)
- Agreed requirement: The Listing Executive experience must remain visibly distinct
  when the user moves from the Dashboard to Inventory. The navigation and page heading
  must identify the Listing Executive inventory workspace; own working inventory is the
  default view with workload counts for Draft, Awaiting review, Changes requested and
  Media incomplete records. Approved company inventory is available through a separate
  reference view and must not be mixed into the default personal work queue. The primary
  navigation presents Dashboard and My inventory workspace for this operational role,
  rather than exposing the lead-centric Sales Agent navigation.
- Status: Implemented locally and verified by the 130-test automated suite; CRM Test
  deployment, functional retest and explicit user confirmation remain pending.
- Retest condition: Sign in to CRM Test as a Listing Executive. Confirm the navigation
  says `My inventory workspace`, the Inventory page displays the Listing Executive
  heading and own-work counts, and the default list contains only that executive's
  records. Switch to Approved company inventory and confirm only approved company
  records appear. Confirm the common header remains available. Explicit user
  confirmation is required before closure.

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

#### Governed listing location

- Amendment ID: R1.1-AMD-005
- Related UAT finding: R1.1-UAT-006 (Release 1.1 findings document — listing location capture)
- Agreed requirement: Area / Community must not remain one ambiguous free-text field.
  Area is a mandatory dropdown sourced from active Area Maintenance records and the
  listing stores the selected governed identity and its customer-facing label.
  Community is a separate optional business field for the building, district or
  sub-community. Create, edit, search, inventory cards, listing detail, API filtering
  and audit evidence must preserve that distinction for every authorized role.
- Status: Implemented locally and verified by the 131-test automated suite. CRM Test
  deployment, authenticated functional retest and explicit user confirmation remain
  pending.
- Retest condition: On CRM Test, create and edit a listing as a Listing Executive and
  confirm Area is required and selectable only from active Area Maintenance records.
  Record a separate Community and confirm Area and Community remain distinct in the
  Inventory search, card and detail views for Listing Executive, Manager, Director and
  permitted read-only roles. Retire an area and confirm it is unavailable for new
  selection without changing historical listings. Explicit user confirmation is
  required before closure.

#### Property-level Bulk Deal capture

- Amendment ID: R1.1-AMD-006
- Related UAT finding: R1.1-UAT-007 (Release 1.1 findings document — multi-property listing capture)
- Agreed requirement: Bulk Deal represents one commercial package containing at least
  two separately identified properties; it is not a substitute for missing property
  detail. Selecting Bulk Deal opens a property schedule where every row records a
  unique unit/property reference, its own non-bulk property type, bedrooms where
  applicable, size and asking price. Plot rows do not use bedrooms. The listing retains
  one negotiated package asking price while its property schedule remains queryable,
  editable, auditable and visible in listing detail. Ordinary single-property listings
  continue to use their existing fields unchanged.
- Status: Implemented locally and verified by the 131-test automated suite. CRM Test
  deployment, authenticated functional retest and explicit user confirmation remain
  pending.
- Retest condition: On CRM Test, select Bulk Deal and confirm two property rows are
  required. Save a mixed schedule such as Apartment, Villa and Plot with different
  bedroom, size and price values; confirm Plot bedrooms are not requested, duplicate
  references and incomplete rows are rejected, and the package and all rows reopen
  correctly for editing. Confirm a normal single-property listing remains unchanged.
  Explicit user confirmation is required before closure.

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

#### Governed property-media workflow

- Amendment ID: R1.1-AMD-004
- Related UAT finding: R1.1-UAT-003 (pre-implementation property-media governance review)
- Agreed requirement: Property media must remain private and listing-scoped. An
  authorized listing owner or Administrator uploads a validated image, floor plan or
  brochure once, records its business source and confirms the documented authority to
  use it, including an optional rights-expiry date. The system rejects an exact
  duplicate file for the same listing by hash. The owner may maintain the
  customer-facing title, caption and display order; an approved image may be selected
  as the listing's single cover image. The responsible Manager or Administrator must
  either approve pending media or reject it with a mandatory reason. Only approved
  media whose recorded usage rights remain current may satisfy listing readiness or
  be selected for a customer proposal. Downloads, changes, cover selection and review
  decisions remain role-scoped and audit recorded.
- Status: Implemented locally and verified by the 129-test automated suite. CRM Test
  deployment, authenticated functional retest and explicit user confirmation remain
  pending.
- Retest condition: On CRM Test, sign in as a Listing Executive, upload a compliant
  property image with a recorded source and current usage-rights basis, and confirm it
  remains Pending and does not satisfy readiness or appear in proposal media. Upload
  the same file again and confirm the duplicate is rejected without creating a second
  record. As the responsible Manager, approve it and confirm it becomes available for
  readiness and proposal selection. Maintain its caption/order, select it as cover and
  confirm one cover only. Upload another file and reject it with a reason; confirm the
  reason is visible and the rejected file is excluded. Confirm missing/expired rights,
  an unrelated Manager and an unrelated Listing Executive are blocked. Explicit user
  confirmation is required before closure.

#### Named or automatic property-media approval

- Amendment ID: R1.1-AMD-004 Revision 1
- Related UAT finding: R1.1-UAT-005 (CRM Test property-media approval usability retest)
- Agreed requirement: The property-media window must remain open after upload and
  refresh its contents in place. Where the listing owner's team has an active maintained
  Manager, the screen and confirmation must name that responsible Manager and the media
  remains Pending for that person's decision. Where no active responsible Manager is
  maintained, a compliant upload is approved automatically instead of entering an
  ownerless queue; the automatic decision, actor, team context and reason are audit
  recorded. Migration 031 applies the same governed outcome to compliant Pending media
  created before this correction. The upload action must state which of those two paths
  will occur before the user submits it.
- Status: Implemented locally and verified by the 130-test automated suite; CRM Test
  deployment, functional retest and explicit user confirmation remain pending.
- Retest condition: In CRM Test, upload compliant media for a Listing Executive whose
  team has a maintained Manager. Confirm the window stays open, names the Manager and
  shows the new record as Pending. Repeat for an executive whose team has no active
  Manager; confirm the action says it will approve automatically, the same window stays
  open, and the new record appears as Approved with audit evidence. Explicit user
  confirmation is required before closure.

### Business-friendly inventory commercial controls

- Amendment ID: R1.1-AMD-002
- Related UAT finding: R1.1-UAT-001 (pre-implementation inventory review)
- Agreed requirement: Asking Price and optional Reference / Market Price must be
  business-amount inputs, not dropdowns or number-only controls. They and buyer
  Minimum / Maximum Budget must accept equivalent forms such as `1m`, `1M`, `1.5 m`,
  `750k`, `1,000,000` and `1000000`, show the interpreted currency amount before save,
  and persist one validated numeric value. Currency remains a governed dropdown.
  Handover must use separate status and date controls: Ready, Expected on a maintained
  date, or To be confirmed. Dates are stored unambiguously and displayed to users as
  `DD-MM-YYYY`. Replace the opaque editable Portal readiness dropdown with an explained,
  system-derived Listing publication readiness result based on completeness,
  availability, verification/permit and approved-media requirements. `Published` must
  not be manually selectable in Release 1.1 because live portal publication remains
  Release 4. Buyer Funding Method and inventory Payment Plan remain distinct business
  concepts but must use governed values, aligned layout and an explicit compatibility
  mapping for matching and proposals rather than unrelated labels.
- Status: Implemented locally and verified by the 116-test automated suite. CRM Test
  deployment, functional retest and explicit user confirmation remain pending.
- Retest condition: On CRM Test, enter every supported amount notation in Asking Price,
  Reference Price and buyer Minimum / Maximum Budget and confirm identical normalized
  values and previews. Confirm invalid, negative and reversed values are rejected.
  Maintain Ready, dated and To-be-confirmed handovers and verify `DD-MM-YYYY` display.
  Resolve and introduce publication-readiness blockers and confirm the calculated
  status and explanations change without manual Published selection. Test every
  approved Funding Method against applicable and incompatible Payment Plans and verify
  deterministic shortlist and proposal behaviour. Explicit user confirmation is
  required before closure.

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

### Area-controlled lead routing and queues

- Amendment ID: R1.1-AMD-001
- Related UAT finding: R1-UAT-005
- Agreed requirement: Add governed Area maintenance and allow a routing rule to select
  either one maintained area or `All areas`. Area records must carry a stable code,
  business label, Emirate, display order and active/retired lifecycle without deleting
  historical references. Routing continues to select only a team queue, never an
  individual broker. An area-specific rule may override an `All areas` rule through
  its maintained priority. A lead with no confirmed primary routing area, or multiple
  preferred areas without one confirmed as primary, follows the applicable `All areas`
  rule and ultimately the Company Unassigned Queue. Duplicate or ambiguous active
  source/business/area combinations are prohibited and all changes are audited.
- Status: Implemented locally and verified by the 116-test automated suite. CRM Test
  deployment, functional retest and explicit user confirmation remain pending.
- Retest condition: Maintain active and retired areas, create area-specific and
  `All areas` routing rules, and submit leads for each supported business line with a
  matching area, a different area, no area and multiple preferred areas without a
  primary selection. Confirm deterministic queue selection, priority handling,
  Company Unassigned fallback, duplicate prevention, no direct agent assignment and
  complete audit history. Explicit user confirmation is required before closure.

#### Area-maintenance bulk upload and layout

- Amendment ID: R1.1-AMD-001 Revision 1
- Related UAT finding: R1-UAT-005
- Agreed requirement: Correct the Area maintenance layout so the customer-facing label
  and stable code are displayed as separate, readable values with consistently aligned
  controls and actions. Provide an approved Excel template and a governed upload tool
  for larger area lists. The import is create-only, accepts no more than 500 rows and
  must validate the exact columns, lowercase snake_case codes, UAE Emirate, whole-number
  display order, duplicate codes and duplicate active labels before saving. Users must
  preview row-level results and explicitly confirm the import. The transaction is
  all-or-none and every created area retains its actor, import reason and source-row
  audit evidence.
- Status: Implemented locally and verified by the 120-test automated suite. CRM Test
  deployment, functional retest and explicit user confirmation remain pending.
- Retest condition: Download the template from Area maintenance; confirm its Emirates
  dropdown and display-order validation. Upload valid, malformed, duplicate, oversized
  and mixed-validity workbooks. Confirm invalid rows are explained without saving any
  area, a fully valid preview imports exactly once after a reason is recorded, and the
  resulting area table keeps labels, codes, statuses and actions visibly separated.
  Explicit user confirmation is required before closure.

#### Existing-area handling during bulk upload

- Amendment ID: R1.1-AMD-001 Revision 2
- Related UAT finding: R1-UAT-005
- Agreed requirement: An area already maintained in NYSA CORE must be rejected from
  the incoming create set automatically and shown as `Already exists — skipped`.
  Existing duplicates must not require the administrator to edit and upload the Excel
  workbook again, and must not prevent other valid new rows from being imported.
  Malformed rows and genuine governance conflicts, including reuse of an existing
  stable code for a different area, continue to block the all-or-none creation of the
  remaining new rows.
- Status: Deployed to CRM Test in cumulative package `a875b80`; functionally retested
  and explicitly accepted by the NYSA owner on 2026-07-20.
- Retest condition: Upload a workbook containing one existing area, valid new areas,
  an exact duplicate row and a stable-code conflict. Confirm existing and exact
  duplicates are visibly skipped without workbook correction, valid new areas can be
  imported once, the stable-code conflict blocks creation, no duplicate database rows
  are created and audit history identifies every newly imported area. Explicit user
  confirmation is required before closure.

#### Business-facing area list

- Amendment ID: R1.1-AMD-001 Revision 3
- Related UAT finding: R1-UAT-005
- Agreed requirement: Keep the stable area code as governed internal system identity
  for creation, Excel import, routing references and audit history, but do not display
  it in the routine Area maintenance list. The list must show only the customer-facing
  area name, Emirate, display order, lifecycle status and permitted actions.
- Status: Deployed to CRM Test in cumulative package `a875b80`; functionally retested
  and explicitly accepted by the NYSA owner on 2026-07-20.
- Retest condition: On CRM Test, confirm stable code remains required during manual
  creation and present in the approved Excel template, but is absent from the saved
  Area maintenance list. Confirm editing, retirement, routing and audit behavior are
  unaffected. Explicit user confirmation is required before closure.

#### Business-facing bulk-import review and duplicate handling

- Amendment ID: R1.1-AMD-001 Revision 4
- Related UAT finding: R1-UAT-005
- Agreed requirement: The Excel review must treat an already-maintained area as an
  automatic skip rather than a correction required from the administrator. The
  preview must allow valid new areas in the same workbook to proceed, while genuine
  stable-code reuse for a different maintained area remains a blocking conflict. The
  preview is a business review and must not display the internal stable area code;
  Excel row, customer-facing area, Emirate, order and validation outcome are sufficient.
- Status: Deployed to CRM Test in cumulative package `a875b80`; functionally retested
  and explicitly accepted by the NYSA owner on 2026-07-20.
- Retest condition: On CRM Test, review a workbook containing existing areas and new
  areas. Confirm existing areas show `Already exists — skipped automatically`, no
  workbook correction is required, the import action becomes available for the new
  rows, only the new rows are created, and the preview does not display stable codes.
  Explicit user confirmation is required before closure.

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
