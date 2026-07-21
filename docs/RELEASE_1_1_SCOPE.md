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

#### Aligned Bulk Deal schedule and derived total

- Amendment ID: R1.1-AMD-006 Revision 1
- Related UAT finding: R1.1-UAT-007 (CRM Test Bulk Deal usability retest)
- Agreed requirement: Bulk Deal property fields must remain aligned in one readable
  row at desktop widths. Business amount inputs must show their interpreted AED value
  while typing and replace shorthand such as `2m` with the formatted actual amount
  when the user tabs away, without losing focus from the listing workflow. Because
  every child property already carries its asking price, the legacy parent Asking Price
  and Reference / Market Price inputs must not be requested again. The system displays
  and persists a calculated Bulk Deal total equal to the sum of the validated property
  asking prices. Ordinary single-property listings continue to show their normal
  Asking Price and optional Reference / Market Price fields.
- Status: Implemented locally and verified by the 131-test automated suite. CRM Test
  deployment, authenticated functional retest and explicit user confirmation remain
  pending.
- Retest condition: On CRM Test, enter `2m` in a Bulk Deal property asking price and
  press Tab. Confirm the same modal remains open, the input displays `2,000,000`, its
  interpreted AED value is visible, and focus proceeds to the next control. Confirm all
  property controls remain aligned, the calculated total updates, no duplicate parent
  price fields appear, and the saved listing total equals the sum of its child property
  prices. Confirm a normal listing still requires its own Asking Price. Explicit user
  confirmation is required before closure.

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

#### Multi-photo approval submission

- Amendment ID: R1.1-AMD-004 Revision 2
- Related UAT finding: R1.1-UAT-008 (CRM Test property-media batch-upload usability retest)
- Agreed requirement: A Listing Executive must be able to select and review several
  property photos once, record the common source, usage-rights basis, optional expiry
  and rights confirmation once, and submit the selected batch once. One batch is
  limited to five validated images and 20 MB total. Each file retains its own safe
  title and consecutive display order. Every file is validated for type, content,
  dimensions, aspect ratio, size and duplicate hash before any record is committed;
  one invalid, repeated or already-linked file rejects the complete batch so partial
  uploads cannot occur. The complete batch follows the same named responsible-Manager
  or automatic-no-manager decision path, remains visible in the open media window and
  is audit recorded against every resulting media record.
- Status: Implemented locally and verified by the complete 132-test automated suite.
  CRM Test deployment, authenticated functional retest and explicit user confirmation
  remain pending.
- Retest condition: In CRM Test, select three compliant photos and confirm the screen
  lists all three before submission. Enter source and usage rights once, submit once,
  and confirm all three appear in the still-open window with consecutive order and the
  same named Manager (or the documented automatic-approval path). Repeat with one
  invalid image, an in-batch duplicate and a file already linked to the listing; each
  attempt must reject the whole batch and create no partial rows. Confirm more than
  five files and more than 20 MB are blocked. Explicit user confirmation is required
  before closure.

#### Administrator-controlled optional media approval

- Amendment ID: R1.1-AMD-004 Revision 3
- Related UAT finding: R1.1-UAT-009 (property-media approval policy review)
- Agreed requirement: Property-media approval must be optional at Administrator
  level. The maintained policy defaults to requiring responsible-Manager approval.
  When a full Administrator selects `Not required` and records a mandatory reason,
  future uploads that pass file, rights, duplicate, size and aspect-ratio controls
  are approved immediately. Re-enabling approval restores the responsible-Manager
  workflow. Existing pending media remains unchanged and every policy decision and
  automatic approval is audit recorded.
- Status: Implemented locally; CRM Test deployment, business retest and explicit
  NYSA owner confirmation remain pending.
- Retest condition: On CRM Test, set approval to `Not required`, record the reason,
  and upload a valid multi-photo batch from a listing owned by a user with a maintained
  Manager. Confirm every photo is immediately Approved and the interface identifies
  the Administrator policy. Restore `Required`, upload another valid photo and confirm
  it remains Pending for the named responsible Manager. Confirm pre-existing pending
  media is unchanged and an Admin Assistant cannot edit the policy. Explicit user
  confirmation is required before closure.

#### Responsible-Manager property-media approval queue

- Amendment ID: R1.1-AMD-004 Revision 4
- Related UAT finding: R1.1-UAT-010 (pending media absent from the responsible
  Manager dashboard)
- Agreed requirement: When approval is required, each compliant Pending media item
  must appear in a dedicated `Media approvals` tab on the dashboard of the active
  Manager maintained against the listing owner's team. The queue must not appear in
  an unrelated Manager's scope. It must identify the inventory record, property,
  media title and file, team, uploader, source, usage-rights basis and exact submission
  time; provide authenticated preview and download; and support Approve or Reject
  with a mandatory rejection reason. A completed decision must refresh the count and
  remove the item from the Pending queue while retaining the existing audit record.
  `My tasks` and `Proposal approvals` remain separate workflows.
- Status: Implemented locally; CRM Test deployment, business retest and explicit
  NYSA owner confirmation remain pending.
- Retest condition: With the Administrator policy set to `Required`, sign in as a
  Listing Executive whose maintained team Manager is Aadivya and upload a compliant
  image. Confirm Aadivya's `Media approvals` count and queue show the record, preview
  and download work, and an unrelated Manager cannot see or decide it. Approve one
  item and reject another with a reason; confirm each disappears from the Pending
  queue, the listing media screen shows the resulting status/reason and audit history
  identifies Aadivya. With policy set to `Not required`, confirm new valid media is
  auto-approved and does not enter the queue. Explicit user confirmation is required
  before closure.

#### Ten-photo governed batch

- Amendment ID: R1.1-AMD-004 Revision 5
- Related UAT finding: R1.1-UAT-011 (five-photo batch limit is insufficient for a
  normal property presentation)
- Agreed requirement: A Listing Executive may select and submit up to 10 property
  photographs in one governed batch. The existing 20 MB total batch limit remains in
  place, together with every per-image content, format, dimension, aspect-ratio and
  size check, duplicate detection, atomic all-or-none persistence, usage-rights
  confirmation and the maintained approval policy. Eleven or more selected files
  must be rejected before upload.
- Status: Implemented locally; CRM Test deployment, business retest and explicit
  NYSA owner confirmation remain pending.
- Retest condition: On CRM Test, select 10 compliant photographs whose combined size
  is no more than 20 MB and confirm all 10 are reviewed and saved in one submission.
  Confirm 11 photographs are blocked before upload, a batch over 20 MB is blocked,
  and one invalid or duplicate image still prevents every file in that batch from
  being committed. Explicit user confirmation is required before closure.

#### Governed MPEG property video

- Amendment ID: R1.1-AMD-004 Revision 6
- Related UAT finding: R1.1-UAT-012 (property media also requires MPEG video)
- Agreed requirement: In addition to the governed batch of up to 10 photographs, an
  authorized Listing Executive may upload one private MPEG property video at a time.
  Accepted files are `.mpeg` or `.mpg` with verified MPEG content and a maximum size
  of 20 MB. The video requires a title, source, recorded usage rights, duplicate-hash
  checking and the maintained media-approval policy. It remains listing-scoped and
  downloadable by authorized staff; it is not embedded in proposal PDFs.
- Status: Implemented locally; CRM Test deployment, business retest and explicit
  NYSA owner confirmation remain pending.
- Retest condition: On CRM Test, upload a genuine MPEG file no larger than 20 MB and
  confirm it remains visible against the inventory record and follows the maintained
  approval policy. Confirm the responsible Manager can identify and download it from
  the Media approvals queue when approval is required. Confirm a renamed non-MPEG
  file, an `.mp4`, a file over 20 MB and a duplicate file are rejected without a
  partial record, and confirm the video is not offered as proposal-PDF media. Explicit
  user confirmation is required before closure.

#### Property-media policy save and audit

- Amendment ID: R1.1-AMD-004 Revision 7
- Related UAT finding: R1.1-UAT-013 (changing the property-media approval policy
  returns an internal-server error)
- Agreed requirement: A full Administrator must be able to change the maintained
  responsible-Manager approval policy with a mandatory reason. The policy update and
  its `PropertyMediaApprovalPolicy` audit entry must commit together; an audit failure
  must never leave an unrecorded policy change.
- Status: Root cause corrected locally in migration
  `034_property_media_policy_audit.sql`; CRM Test deployment, database verification,
  functional retest and explicit NYSA owner confirmation remain pending.
- Retest condition: On CRM Test, change the policy from Required to Not required with
  a reason and confirm the saved status refreshes immediately. Confirm migration 034
  is recorded, the audit log contains `PropertyMediaApprovalPolicy / policy_changed`,
  and a subsequent compliant upload follows the new policy. Change it back to Required
  with a second reason and confirm the second audited decision. Explicit user
  confirmation is required before closure.

#### Property-photo organizer and duplicate recovery

- Amendment ID: R1.1-AMD-004 Revision 8
- Related UAT finding: R1.1-UAT-014 (duplicate photo cannot be identified or removed,
  and uploaded property photos are difficult to organize)
- Agreed requirement: The property-media workspace must show a thumbnail, original
  filename, title, caption, approval status and cover status for every uploaded photo.
  Before upload, each selected photo must have its own thumbnail, filename, validation
  result and Remove action. Exact duplicates of an uploaded photo or another selected
  photo must be identified before submission by filename and existing record title, and
  the batch must remain available while the user removes the problem file. After upload,
  an authorized maintainer must reorder photos using Move earlier / Move later controls
  and explicitly choose the cover photo without entering technical display-order numbers.
  Unused media may be deleted with confirmation and audit evidence; media retained in an
  immutable proposal version must never be deleted and must return a clear protection
  message.
- Status: Deployed to CRM Test and retested on 2026-07-21. Retest failed because the
  updated static browser files were served while the Node.js worker retained an older
  backend route module: thumbnails did not load and reorder/delete returned Not found.
  Superseded by Revision 9; the finding remains open.
- Retest condition: On CRM Test, open a listing with an approved photo and confirm its
  thumbnail and original filename are visible. Select that same file together with two
  new photos and confirm the duplicate is highlighted before upload; remove only the
  duplicate and upload the remaining photos. Move photos earlier and later, choose a
  cover, refresh and confirm order and cover persist. Delete one unused photo and confirm
  it disappears. Attempt to delete media used in an immutable proposal and confirm it is
  protected with a clear message. Explicit user confirmation is required before closure.

#### Property-photo organizer runtime alignment and direct placement

- Amendment ID: R1.1-AMD-004 Revision 9
- Related UAT finding: R1.1-UAT-014 (property thumbnails do not appear and organizer
  actions return Not found after deployment)
- Agreed requirement: The browser and running backend must expose the same property-photo
  organizer contract. The media response must carry an explicit organizer-version marker;
  when an old worker is still active, the screen must stop and explain that the Node.js
  application requires a full restart instead of displaying unusable actions. Authenticated
  thumbnail, reorder and safe-delete routes must be loaded together. Photo ordering must use
  clear up/down arrow controls and also allow an authorized maintainer to choose any target
  position directly. A thumbnail storage failure must be shown as a specific preview/storage
  problem while retaining the filename and download action.
- Status: Implemented locally and verified by the 135-test automated suite. CRM Test
  deployment with a confirmed full worker stop/start, authenticated functional retest and
  explicit NYSA owner confirmation remain pending.
- Retest condition: Deploy the cumulative package to CRM Test, fully stop the prior Node.js
  worker and confirm no stage worker remains before starting it again. Confirm unauthenticated
  probes to the thumbnail and delete endpoints return 401 rather than 404. Sign in, open the
  same listing and confirm photos render. Move a photo once with each arrow and then directly
  from its current position to a non-adjacent target position; refresh and confirm the exact
  order persists. Delete an unused photo and confirm it disappears. Confirm proposal-retained
  media remains protected. Explicit user confirmation is required before closure.

#### Listing-queue cover-photo visibility

- Amendment ID: R1.1-AMD-004 Revision 10
- Related UAT finding: R1.1-UAT-014 (the maintained cover photo is not visible in the
  Listing Executive action queue)
- Agreed requirement: Every row in the Listing Executive Records requiring action queue
  must show the listing's current approved, rights-valid cover photo. A listing without a
  maintained cover must show a compact `No cover photo` placeholder rather than an empty
  space. If the database identifies a cover but its private file cannot be read, the row must
  show `Cover unavailable` without breaking queue navigation. The image remains private and
  must be served through the authenticated property-media thumbnail route.
- Status: Implemented locally and verified by the 135-test automated suite. CRM Test
  deployment, authenticated functional retest and explicit NYSA owner confirmation remain
  pending.
- Retest condition: On CRM Test, open the Listing Executive dashboard and confirm a listing
  with a maintained approved cover shows that photo in Records requiring action. Confirm a
  listing without a cover shows `No cover photo`. Select a different approved cover in the
  property-media workspace, return to or refresh the dashboard and confirm the replacement
  photo appears. Explicit user confirmation is required before closure.

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
