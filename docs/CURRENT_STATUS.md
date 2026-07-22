# NYSA CORE Current Status

## Release 2.1A CRM Test deployment and Agent-guidance correction — 2026-07-22

- Version `2.0.0-dev.2` implements the approved D-039/D-040 connected operating experience on
  CRM Test.
  It adds a role-scoped guided operating sequence to Agent and Manager dashboards and a connected
  case view showing Customer, Lead, qualification, active Opportunities, ownership, blockers and
  next action without re-entering authoritative data.
- Administrator, Director and managed-scope Manager users receive an explicit **Review
  reassignment** action. It previews the Lead and each open Opportunity separately, requires a
  reason, validates an active eligible Sales Agent and commits only the selected records atomically.
- Migration `039_release2_connected_operations.sql` adds immutable Opportunity ownership history
  and safely backfills the initial owner of existing Opportunities. Lead assignment history remains
  authoritative and unchanged; Opportunity creation now records its initial owner directly.
- The complete automated suite passes 168/168 tests, including all 164 prior tests plus four new
  migration, transaction/history, guided-flow and documentation contracts; the existing permission
  contract now reflects the approved Administrator reassignment amendment.
- Exact-commit CRM Test package `nysa-core-r2-1a-crm-test-9cb226d.zip` was built from source commit
  `9cb226d` with SHA-256
  `3a8a00faa7d767484786522ec4e471d1814fa3a3b8ddc02d55b54a6af1fa4edc`. Migration 039 inside the
  package has SHA-256 `f002a889c6d13376c12a18f5437f1d882cddb93645df38070c984fade2292349`.
  The earlier working-tree checksum used CRLF line endings; the recorded value here is the
  authoritative LF-normalized file extracted from the exact Git package and matches CRM Test.
- Before deployment, the rehearsal database and CRM Test application were backed up as
  `nysa-r2-rehearsal-pre-r2-1a-20260722.dump` (SHA-256
  `da191d17652cb96f34a19b6d13d68b92f81032b2c68d003567679109491ae1ac`) and
  `nysa-core-crm-test-pre-r2-1a-20260722.tar.gz` (SHA-256
  `77459f706e1512919e278e798822f7944fc66245c43fb045ecd6037701bb882d`). Migration 039 committed
  atomically; brokers 11, contacts 32, leads 25, listings 12, Opportunities 1 and audit rows 383
  reconciled without loss. The existing Opportunity remained at Requirements version 3 and its
  initial ownership history reconciled 1/1. CRM Test health returned HTTP 200 and database ready.
- Agent UAT identified finding `R2.1A-UAT-001`: an unassigned case told an Agent to assign a
  responsible agent even though governed reassignment is intentionally unavailable to Agents.
  Version `2.0.0-dev.3` corrects this R2-only guidance: Agents now see **Await assignment by
  [manager]** and **Manager-controlled; open Lead context only**, while Manager, Director and
  Administrator users retain the actionable assignment prompt. Peer-to-peer Agent reassignment is
  not introduced. The complete suite passes 168/168 after the correction; CRM Test deployment of
  this small correction and continued role UAT remain pending. Exact source commit `f7e17d3` is
  packaged as `nysa-core-r2-1a-agent-guidance-f7e17d3.zip` with SHA-256
  `a46f5c5c09a0eb86ff4e8d76d1eff2fcd6179734f3aaf24ace23e188a465226d`; it contains no new
  migration and must be deployed only to CRM Test.
- Agent UAT then identified `R2.1A-UAT-002`: the selected Lead lifecycle used every historical
  stage visit as completed styling, so a governed backward move from Negotiation to Viewing left
  Negotiation green. Version `2.0.0-dev.4` makes the current Lead stage authoritative for the
  visual path: stages before Viewing are complete, Viewing is current, and later stages return to
  pending; immutable stage history is preserved. This correction supersedes the pending dev.3
  package, which must not be uploaded or deployed. The combined dev.4 corrections are packaged
  from exact source commit `76c12d9` as `nysa-core-r2-1a-uat-corrections-76c12d9.zip` with SHA-256
  `4c99634a950c888faec308bc3bd78ef0ee879fe62835e3d3bcb673f35ae3ab06`; the package is
  application-only and restricted to CRM Test.
- The owner clarified finding `R2.1A-UAT-001` through approved D-041: an unassigned Lead must not
  appear anywhere in the Agent dashboard or guided work area. Version `2.0.0-dev.5` applies an
  assigned-only operational scope to Agent dashboard counts, lifecycle, next cases, filters and
  dashboard export. Manager and company assignment scopes remain unchanged, and the underlying
  Release 1.1 Lead record/history is not altered. This supersedes the pending dev.4 package.
  The complete dev.5 UAT correction is packaged from exact source commit `186217f` as
  `nysa-core-r2-1a-uat-corrections-186217f.zip` with SHA-256
  `ae335fe6456cee9eb7dd1d8991a12408ce398bba58fbf95cd39269f9a9638cf4`; only this latest
  correction package may proceed to CRM Test.
- CRM Test Agent UAT passed the assigned-only scope and corrected backward-stage display. The owner
  requested removal of the redundant release-boundary sentence below the guided flow; locked future
  steps already communicate availability. Version `2.0.0-dev.6` removes only that displayed line
  and leaves the endpoint boundary metadata and all governed behavior unchanged.
- Production and the frozen Release 1.1 candidate remain untouched and excluded.

## Release 2 connected operations direction approved — 2026-07-22

- The NYSA owner directed that Release 2 operate as one clear linked flow without repeated entry,
  hidden ownership changes, duplicate pursuits or loss of history. D-039 records this as the
  governing connected-operating-experience requirement.
- R2.1A is inserted before matching/viewing. It will provide guided Customer-to-Lead-to-Opportunity
  context, authoritative-data reuse, related-record navigation, duplicate warnings, ownership and
  next-action visibility, plus transactional Lead/selected-open-Opportunity reassignment.
- Administrator and Director receive company-wide governed reassignment; Manager/Team Lead remains
  limited to managed teams. The action must preview affected records, require an explicit selection,
  validate active team membership and append immutable assignment/audit history atomically.
- This direction is additive. It does not rewrite Release 1.1 data or authorize production. Build,
  testing and acceptance remain restricted to `https://crm-test.nysarealty.com/`.

## Release 2 role-guided work areas approved — 2026-07-22

- D-040 requires the Agent and Manager work areas to demonstrate the end-to-end operating sequence,
  highlight the current position and show one clear next action, with business-language explanations
  and correction links for blocked steps.
- The Agent experience is case-oriented and progressively discloses advanced detail. The Manager
  experience uses the same flow at team level with ownership, SLA, overdue, blocker, duplicate-risk
  and reassignment indicators, then drills into the shared linked-case context.
- R2.1A cannot be accepted from technical tests alone. Representative Agent and Manager CRM Test
  users must be able to identify ownership, current step, blocker and next action without developer
  assistance. Production remains excluded.

## Release 2.0/2.1 Opportunity foundation migration rehearsal passed — 2026-07-22

- The additive R2.0/R2.1 foundation is implemented locally on `agent/release-2-design`.
  Migration `038_release2_opportunity_foundation.sql` creates Opportunity identity, scoped owner
  and participant records, immutable stage history, immutable original-enquiry attribution,
  duplicate-open-pursuit protection, optimistic concurrency, a legacy-lead review ledger and
  reconciliation view. It never updates a Release 1.1 lead stage or creates an Opportunity from a
  legacy lead automatically.
- `src/routes/opportunities.js` provides scope-enforced list/detail/create, next-action and stage
  APIs. Creation requires an assigned qualified lead, current structured requirement and recorded
  qualification assessment. R2.1 permits Requirements, Matching, reasoned return and reasoned
  Closed Lost only; Viewing through Closed Won remain inaccessible.
- The existing Lead pipeline and lifecycle remain intact. A separate Opportunity workspace and an
  explicit `Create / review opportunities` action were added without replacing Release 1.1
  screens, stages, counts, APIs or history.
- The full automated suite passes 164/164 tests: all 156 prior assertions plus eight Release 2
  domain, permission, migration, attribution, concurrency, UI-boundary and documentation checks.
- The CRM Test database was backed up to
  `nysacrm-r1test-pre-r2-20260722.dump` (SHA-256
  `cb4dc2790f94e2e696ed1b1aa9794d8ea5ba4fa2607b9707cf62d2ed91556e0e`) and restored into the
  isolated `nysareal_nysa_r2_rehearsal` database. Migration 038 ran atomically and was recorded
  exactly once. Release 1.1 control counts remained brokers 11, contacts 32, leads 25, listings
  12 and audit log 377; reconciliation returned `5,5,0,0,0`, proving that all five legacy
  candidates entered review and no Opportunity was created automatically.
- The live migration/reconciliation gate has passed. Authenticated permissions, creation,
  duplicate, concurrency, transition and browser workflow checks remain required on CRM Test.
- Exact-commit CRM Test package `nysa-core-r2-0-r2-1-crm-test-488e811.zip` was built from
  rehearsal-evidence commit `488e811` with SHA-256
  `05f3aee1194ae55d174a486528f72b1a6174d6c811a160332128fd05fe260386` and deployed only to
  `https://crm-test.nysarealty.com/`, using the isolated rehearsal database. Health returned HTTP
  200 with database ready; post-start counts and reconciliation remained unchanged.
- Authenticated read-only browser verification passed for the Release 1.1 dashboard and 25-lead
  pipeline, the empty additive Opportunity workspace, and the five-record legacy review ledger
  with automatic conversion disabled. No browser console error or record mutation was observed.
- Opportunity creation, duplicate/concurrency enforcement, stage movement and role-denial tests
  remain open. Production and the original CRM Test database remain unchanged and excluded.
- No deployment was performed. Testing/deployment remain restricted to
  `https://crm-test.nysarealty.com/`; production and the frozen Release 1.1 candidate remain
  unchanged and excluded.

## Release 2 recommended defaults and build authorization — 2026-07-22

- The NYSA owner approved D-038 and authorized the R2.0/R2.1 build using the recommended defaults
  in `docs/RELEASE_2_SCOPE.md`.
- Every behavior accepted through Release 1.1 is a compatibility invariant and remains unchanged
  unless the owner explicitly approves a documented amendment. Release 2 begins as additive
  schema, scoped APIs and a separate Opportunity workspace.
- R2.1 enables Opportunity Requirements, Matching, reasoned return and Closed Lost only. Later
  stages remain unavailable until their viewing, offer, booking, party and completion modules are
  implemented and accepted.
- Legacy Viewing, Negotiation, Won and ambiguous Lost leads are review-ledger candidates only; no
  lead stage, history or dashboard population is automatically rewritten or converted.
- Testing and any deployment remain restricted to `https://crm-test.nysarealty.com/`. Production
  and the frozen Release 1.1 candidate remain excluded.

## Campaign management release allocation — 2026-07-22

- The NYSA owner approved the planning boundary recorded as D-037 and
  `ENH-CAMPAIGN-001`: Release 2 preserves immutable campaign/source attribution through
  Opportunity, Booking and Deal; Release 3A delivers governed campaign management before Release
  3B channel automation; Release 6 adds reconciled CPL, CPA and marketing ROI.
- Release 2 records original-enquiry campaign, advert, form, landing-page, source and property
  identifiers as provenance only. It does not create campaign budgets, infer multi-touch credit or
  claim financial marketing return.
- Release 3A owns campaign identity, owner, objective, properties, audience, channels, dates,
  budgets, status, source identifiers, targets and operational performance. Release 3B providers,
  landing pages, communications, nurture and advertising consume those governed identities.
- This is a requirements/design allocation only. No feature implementation or deployment was
  performed; testing and deployment remain restricted to `https://crm-test.nysarealty.com/` and
  production remains unauthorized.

## Release 2 requirements reconciliation and design — 2026-07-22

- Release 2 design work began from continuity commit `6588047` on the separate
  `agent/release-2-design` branch. No Release 1.1 source, candidate archive or production system
  was changed.
- `docs/RELEASE_2_SCOPE.md` reconciles the roadmap with the implemented Release 1.1 lead,
  requirements, qualification, activity, document and inventory foundations. It defines distinct
  Customer, Lead, Opportunity, Listing and Deal ownership; proposed data contracts; API-enforced
  authorization; delivery slices; acceptance criteria and migration/reconciliation gates.
- The principal compatibility issue is explicit: Release 1.1 accepted Viewing, Negotiation, Won
  and Lost as lead stages, while the approved target model assigns post-qualification execution
  to a separate opportunity. Historical lead-stage evidence must remain immutable, and no Won
  lead may be converted automatically into an authoritative deal.
- The reconciliation adds explicit booking and booking-history records omitted from the earlier
  entity list, and brings configurable operational sale/rental checklists into Release 2 while
  retaining sensitive document/compliance work in Release 6.
- Development is gated on the eight business decisions in `docs/RELEASE_2_SCOPE.md`, including
  lifecycle presentation, multi-opportunity rules, transition/closure policy, checklists,
  booking/inventory behavior, party rules, commercial visibility and legacy backfill approval.
- Testing and deployment remain limited to `https://crm-test.nysarealty.com/`. Production and the
  held Release 1.1 candidate remain untouched and unauthorized for deployment.

## Release 1.1 listing workflow-history layout correction — 2026-07-21

- Amendment `R1.1-AMD-015` / finding `R1.1-UAT-029` records the CRM Test observation
  that a listing's Workflow history reused the three-column activity layout without a
  marker element, causing its content to collapse into the 34px marker column.
- The correction is implemented locally: Inventory detail and edit use wider governed
  modals; Workflow history presents Action, Updated by/time and Reason as explicit
  columns; coordination notes present author/time, comment and actions as columns. The
  layouts collapse responsively only on narrow screens.
- The complete automated suite passes 153 tests. Cumulative package commit `e337946`
  was deployed to CRM Test, health returned database ready, and the NYSA owner visually
  retested the Inventory edit, Workflow history and coordination-note presentation and
  explicitly confirmed it is fine on 2026-07-21. `R1.1-UAT-029` is closed and
  `R1.1-AMD-015` is accepted.

## Communications, calendar and Agent lifecycle enhancements — 2026-07-21

- `ENH-COMMS-001` records a future provider-neutral Call, WhatsApp and Email action rail with
  automatic conversation/activity correlation, consent controls, idempotent webhooks and
  failure recovery. Current buttons remain external launchers plus manual activity recording.
- `ENH-CALENDAR-001` records connected meeting scheduling and synchronization. The current
  Calendar action is accurately treated as `.ics` download only until a provider is approved.
- `ENH-DASH-001` / `R1.1-AMD-016` is implemented locally as the final proposed Release 1.1
  enhancement. The Agent dashboard now shows a visual current-stage aggregate for Lead,
  Contacted, Qualified, Viewing, Negotiation and Won, with Lost separate. Every zero-count
  stage remains visible; each count opens the exact role-scoped contributing leads with a
  stage-appropriate action that opens the governed lead record. The customer context is a
  distinct-customer count and is never treated as a lead stage.
- All 156 automated tests pass. Revision 4 is deployed to CRM Test and the NYSA owner explicitly
  confirmed the corrected lifecycle counts and contributing-record behavior on 2026-07-22;
  `R1.1-UAT-030` is closed. Communications/calendar remain planned Release 3 candidates and are
  not included in this correction.
- `R1.1-AMD-016 Revision 1` clarifies placement: the lifecycle is the first operational
  component on the Agent's My dashboard, immediately below its tabs and before filters and
  KPI cards. It is not repeated lower in the dashboard and does not appear on My Tasks.
- `R1.1-AMD-016 Revision 2` follows CRM Test evidence that the correct Revision 1 JavaScript
  was present on disk while the browser still rendered the prior dashboard. The page now
  requests `dashboard-ui.js` with a release-specific cache key so ordinary reloads fetch the
  corrected placement instead of a stale static asset.
- `R1.1-AMD-016 Revision 3` follows CRM Test functional evidence that a stage change made from
  the lifecycle drill-down left the aggregate stale. A successful stage update now closes the
  stale contributing-record list and automatically redraws the dashboard with the original
  filters while keeping the updated lead open. The browser bundle key is advanced again.
- `R1.1-AMD-016 Revision 4` follows CRM Test evidence that a backward Viewing-to-Qualified
  transition updated the underlying lead but not the aggregate. Operational API reads now bypass
  caches and the post-transition dashboard request receives a unique refresh key, covering both
  permitted forward and backward movements.
- All earlier lifecycle packages through `eee18a7` are superseded and must not be deployed.
  Revision 4 source commit `3a92bcb` is packaged as
  `nysa-core-r1-1-lifecycle-fresh-counts-crm-test-3a92bcb.zip`, SHA-256
  `9345b7fd003baa595e031ee0771c279f8b6c14ba882e8891a066871b05ea86b4`.
  CRM Test serves both Revision 4 bundle keys and reports database-ready health. Production
  remains on hold pending the separate consolidated Release 1.1 promotion gates and authority.

## Release 1.1 held production candidate and Release 2 transition — 2026-07-22

- The accepted Release 1.1 source at commit `1001906` is frozen as the held production candidate
  `nysa-core-r1-1-production-candidate-1001906.zip`, SHA-256
  `d77192894c6d9996a84c6c928784d0b3280986f6eec4b969687e2194c6d11fe5`.
- The archive contains 138 tracked allowlisted entries, includes migrations through 037 and
  excludes environment files, dependencies, outputs, uploads, logs, dumps and release artifacts.
  The complete 156-test suite passes and extracted JavaScript syntax validation passes.
- The candidate is build-only and remains on HOLD. No production deployment is authorized or
  performed; later promotion must use the recorded candidate and complete the production gates.
- The NYSA owner authorized Release 2 work to begin while Release 1.1 production promotion is
  deferred. Release 2 changes must not be added to or overwrite the frozen Release 1.1 candidate.

## Release 1.1 Sales Agent customers and lead lifecycle — 2026-07-21

- R1.1-AMD-008 / R1.1-UAT-021 isolates customer permission resolution from the
  presentation-metadata query used by `GET /api/crm/contacts`. A Sales Agent can load
  customers they own or serve through an assigned/created lead, including a customer
  they have just created before any lead exists.
- R1.1-AMD-008 Revision 1 was deployed to CRM Test and, after the stale Node worker was
  fully replaced, the user confirmed that Sales Agent Ajit created a customer. The broader
  customer/lead-scope finding remains open pending the complete retest and explicit closure.
- The next lead-form retest exposed PostgreSQL `42601` at `src/routes/crm.js:155`: the
  Sales Agent branch of `companyScopeSql` had the same missing outer parenthesis. This is
  R1.1-AMD-008 Revision 2 / R1.1-UAT-023. The failure occurs while loading permitted
  companies, before lead creation; unverified KYC is not a lead-creation prohibition.
- R1.1-AMD-010 / R1.1-UAT-024 adds a Manager KYC review queue for pending customer
  submissions in actively maintained teams and separates owner submission permission from
  scoped Manager approval permission. The existing server contract otherwise named Manager
  approval but blocked a Manager who did not own the customer.
- R1.1-AMD-011 / R1.1-UAT-025 makes Customer Master the authoritative source when
  `Create lead for this customer` is used. The lead form receives a locked customer ID and
  read-only identity summary; it does not ask the user to search for or re-enter the name,
  contact details or KYC data.
- R1.1-AMD-011 Revision 1 corrects the Lead pipeline search wording. It now says
  `Search existing leads` and explains that a customer appears only after a lead exists;
  zero-lead customers remain in Customer Master and start their first lead there.
- R1.1-AMD-012 / R1.1-UAT-026 makes a recorded Call an atomic first-contact event:
  a selected lead still at New advances to Contacted, receives `first_contact_at`, stage
  history and audit evidence in the same transaction. Calls never regress a lead already
  at Contacted or later. The stage belongs to the lead, not the shared customer record.
- R1.1-AMD-009 / R1.1-UAT-022 adds a visual tracker to every opened lead:
  Customer -> Lead -> Contacted -> Qualified -> Viewing -> Negotiation -> Won, with
  Lost shown as a separate terminal outcome. The selected lead's current stage is
  highlighted and the screen explains that one customer may have several leads at
  different stages.
- All 144 automated tests pass. The corrections are being packaged for CRM Test deployment;
  authenticated lead creation, Manager KYC queue/decision, visual lifecycle retest and
  explicit NYSA owner confirmation remain pending. No new finding is closed.
- The only authorized deployment and retest target is
  `https://crm-test.nysarealty.com/`; production is excluded.

## Release 1.1 iPhone MOV property-video support — 2026-07-21

- R1.1-AMD-004 Revision 14 extends governed property-video upload to genuine QuickTime
  `.mov` files commonly produced by iPhone, while retaining `.mpeg` and `.mpg` support.
- MOV acceptance requires the `.mov` extension, `video/quicktime` declaration and a
  QuickTime `ftyp`/`qt  ` file signature. Renamed or mismatched content is rejected.
  The existing 20 MB cap, usage-rights evidence, duplicate hashing, optional Manager
  approval policy, private storage and proposal-PDF exclusion remain unchanged.
- The correction is implemented locally. CRM Test deployment, authenticated functional
  retest and explicit NYSA owner confirmation remain pending; the finding is not closed.

## Release 1.1 commercial-fields acceptance — 2026-07-21

- R1.1-AMD-002 / R1.1-UAT-001 business-friendly inventory commercial fields were tested
  on CRM Test and explicitly accepted by the NYSA owner.
- R1.1-UAT-001 is closed. This acceptance does not close any unrelated Release 1.1
  finding or amendment.

## Release 1.1 configurable listing approval and session clarity — 2026-07-21

- The Listing Executive manual-listing submission and responsible-Manager approval path
  was tested on CRM Test and explicitly accepted by the NYSA owner.
- R1.1-AMD-003 Revision 2 adds an Administrator-maintained listing-approval policy. The
  safe default remains Manager approval required. A reasoned policy change applies only
  to future submissions; when approval is disabled, only publication-ready submissions
  auto-approve and the decision is audited. Existing pending reviews remain pending.
- R1.1-AMD-007 explains that secure sign-in is shared by all tabs and ordinary windows in
  one browser profile. Concurrent Listing Executive and Manager testing requires separate
  browser profiles, one normal and one Incognito/InPrivate profile, or different browsers.
- The complete 138-test automated suite passes. CRM Test deployment, authenticated retest
  and explicit user confirmation of these two corrections remain pending; neither finding
  is closed.

## Release 1.1 media-approval queue loading correction — 2026-07-21

- R1.1-AMD-004 Revision 13 makes an empty media-approval search safe; the API no
  longer calls `toLowerCase()` on a null value. Queue failures now replace the loading
  placeholder with the actual error and a Retry action.
- CRM Test deployment, authenticated functional retest and explicit user confirmation
  remain pending; the finding is not closed.

## Release 1.1 Manager listing-approval queue — 2026-07-21

- R1.1-AMD-004 Revision 12 adds a dedicated Manager Listing approvals tab for submitted
  listings from maintained teams, with a live count, search, pagination, submission timing
  and one-click access to approve, return for correction or block the exact listing.
- The complete 137-test automated suite passes. CRM Test deployment, authenticated
  functional retest and explicit user confirmation remain pending; the finding is not closed.

## Release 1.1 listing-workflow action clarity — 2026-07-21

- R1.1-AMD-004 Revision 11 replaces internal listing queue labels with explicit business
  next steps and single-click workflow navigation. Listings awaiting Manager review are now
  shown as waiting states rather than actions for the Listing Executive.
- The complete 136-test automated suite passes. CRM Test deployment, authenticated
  functional retest and explicit user confirmation remain pending; the finding is not closed.

## Release 1.1 listing-intake amendments — 2026-07-20

- R1.1-AMD-005 separates listing location into a mandatory governed Area selected
  from active Area Maintenance and an optional business-facing Community throughout
  create, edit, search, card, detail, API and audit paths. Migration 032 preserves the
  governed area identity without rewriting historical display labels.
- R1.1-AMD-006 replaces the ambiguous single-row Bulk Deal treatment with a child
  property schedule. Every bulk package requires at least two unique property/unit
  references with property-specific type, bedrooms where applicable, size and asking
  price; ordinary single-property listings remain unchanged. Migration 032 introduces
  relational `listing_units` records.
- R1.1-AMD-006 Revision 1 aligns every property row, formats business shorthand on
  blur and removes duplicate parent price entry. The package price is derived from the
  validated child-property asking prices while single-property pricing is unchanged.
  The complete 131-test automated suite passes; CRM Test deployment and explicit user
  confirmation remain pending.
- Both amendments are implemented locally and the complete 131-test automated suite
  passes. CRM Test deployment, authenticated functional retest and explicit user
  confirmation remain pending; neither finding is closed.

## Release 1.1 local implementation checkpoint — 2026-07-20

- R1.1-AMD-001 / R1-UAT-005 implements governed Area maintenance and deterministic,
  priority-based area-aware routing to team queues. Migration 028 introduces governed
  areas and preserves historical routing references.
- R1.1-AMD-002 / R1.1-UAT-001 implements business amount inputs for listing prices and
  buyer budgets, governed currency, separate handover status/date, derived publication
  readiness, and explicit funding-method/payment-plan compatibility. Migration 027
  introduces the commercial-readiness fields.
- R1.1-AMD-001 Revision 1 corrects Area maintenance alignment and adds a governed,
  create-only Excel template with row-level preview and an audited all-or-none import.
- R1.1-AMD-001 Revision 2 automatically skips existing areas and exact repeated Excel
  rows while continuing to block genuine stable-code conflicts.
- R1.1-AMD-001 Revision 3 keeps the stable code in governed system controls but removes
  it from the routine business-facing Area maintenance list.
- R1.1-AMD-001 Revision 4 also removes the stable code from the Excel business-review
  table and ensures already-maintained areas are skipped without blocking valid new rows.
- CRM Test cumulative package `a875b80` was deployed, tested and explicitly confirmed
  by the NYSA owner on 2026-07-20. R1.1-AMD-001 Revisions 2, 3 and 4 are accepted;
  the later minimal `a875b80-r2` runtime package is superseded and must not be deployed.
- R1.1-AMD-003 implements the dedicated Listing Executive workspace and governed manual
  listing Draft, submission, return, approval, block and restore lifecycle. Migration 029
  preserves existing inventory as approved while new manual records require readiness
  and review; non-approved records are owner/team/administration scoped and every
  transition is audited.
- R1.1-AMD-004 implements private, listing-scoped property-media governance. Migration
  030 records confirmed usage rights and expiry, one cover image and reasoned rejection;
  the runtime enforces duplicate-file hashing, responsible-manager review, owner
  caption/order maintenance, audit history and current-rights filtering for readiness
  and customer proposals.
- R1.1-AMD-003 Revision 1 extends the dedicated Listing Executive presentation into
  the Inventory tab: own working inventory is the default, approved company inventory
  is a separate reference view and role-specific workload counts remain visible.
- R1.1-AMD-004 Revision 1 refreshes the media workflow in place, names the responsible
  maintained Manager, and automatically approves compliant media with explicit audit
  evidence when the listing owner's team has no active Manager. Migration 031 safely
  reconciles equivalent compliant Pending media created before the correction.
- R1.1-AMD-004 Revision 2 replaces repeated one-photo submissions with a governed
  five-photo, 20 MB batch. The user reviews selected file names, records common source
  and usage rights once and submits once; all files are validated before an atomic
  database commit, and any invalid or duplicate file rejects the complete batch.
- R1.1-AMD-004 Revision 3 is implemented locally. A full Administrator can maintain
  whether responsible-Manager approval is required for future property-media uploads.
  The safe default remains Required; when set to Not required, compliant uploads are
  approved immediately with an explicit policy audit record. Existing pending media
  is not silently changed.
- R1.1-AMD-004 Revision 4 is implemented locally. A Manager dashboard now has a
  dedicated, searchable `Media approvals` queue scoped to the teams for which that
  Manager is maintained. Pending media shows its listing, uploader, rights, submission
  timestamp and authenticated preview/download, with approve and reasoned-reject
  actions that refresh the queue after decision.
- R1.1-AMD-004 Revision 5 raises the governed property-photo batch from five to 10
  photographs while retaining the 20 MB aggregate limit, per-image quality and
  content checks, duplicate controls and atomic all-or-none persistence.
- R1.1-AMD-004 Revision 6 adds one-at-a-time private MPEG property-video upload with
  a 20 MB maximum, MPEG content and extension validation, usage-rights governance,
  duplicate detection and the maintained optional Manager approval policy. Videos
  remain listing-scoped downloads and are not embedded in proposal PDFs.
- R1.1-AMD-004 Revision 7 corrects the property-media policy save transaction by
  permitting its dedicated `PropertyMediaApprovalPolicy` audit entity in migration
  034. The policy and mandatory audit evidence continue to commit atomically.
- R1.1-AMD-004 Revision 8 adds the property-photo organizer: uploaded and selected
  thumbnails and original filenames, pre-upload duplicate identification and per-photo
  removal, business actions for order and cover selection, and audited deletion of
  unused media while immutable-proposal media remains protected.
- Revision 8 was deployed to CRM Test on 2026-07-21, but its functional retest failed:
  updated static files were served while an older Node.js worker retained the prior route
  module, so thumbnail, reorder and delete actions were unavailable.
- R1.1-AMD-004 Revision 9 adds an explicit browser/backend organizer-version handshake,
  blocks misleading controls when the worker is stale, replaces text ordering actions with
  up/down arrows, adds direct movement to any selected photo position, and distinguishes a
  private-storage preview failure from a missing organizer route. It passes all 135 automated
  tests locally; cumulative CRM Test deployment and functional retest remain pending.
- R1.1-AMD-004 Revision 10 adds the approved, rights-valid cover photo to every Listing
  Executive action-queue row, with explicit `No cover photo` and `Cover unavailable`
  fallbacks. It passes all 135 automated tests locally; CRM Test deployment and explicit
  user confirmation remain pending.
- CRM Test deployment, authenticated
  functional retesting and explicit user confirmation remain pending; no Release 1.1
  amendment is closed.
- Release 1.1 changes are for `https://crm-test.nysarealty.com/` only at this stage and
  must not be deployed to production before acceptance.

## Release 1 production-promotion decision — 2026-07-19

- The NYSA owner explicitly accepted Release 1 on 2026-07-19.
- The accepted application has passed all 106 local automated tests.
- The CRM Test routing suite passed 30/30 authenticated scenarios; the user then
  confirmed the maintained routing rules are ready.
- Production promotion is authorized but has not yet occurred.
- Promotion will use one consolidated source package and migrations 011 through 026,
  rehearsed first against an isolated restore of the production database.
- No CRM Test database, synthetic users, fixture records, seed scripts, test output,
  private uploads, generated proposals, logs, backups, credentials or `.env` files may
  enter production.
- Release 1.1 inventory and area-routing refinements remain outside this Release 1
  production package.
- Release 1 source `42a8c42` is now deployed to production. Migrations 011 through
  026 are recorded, runtime syntax passed, the production worker is running and health
  is database-ready. Initial smoke testing raised R1-UAT-034 for alignment of selected
  administration entry forms. R1-AMD-030 Revision 1 passed 107 automated tests, was
  deployed to CRM Test and was explicitly accepted by the user on 2026-07-19. The
  separate production presentation hotfix was then deployed from `d25910d`; production
  health returned database ready and the accepted browser marker was verified live.

## Snapshot

- Date: 2026-07-18
- Production environment: Release 1 deployed with the NYSA CORE user-facing brand
- URL: https://crm.nysarealty.com
- Health endpoint: `GET /api/health`
- Expected health response: `{ "ok": true, "database": "ready" }`
- Production database: PostgreSQL 13.23
- Node.js hosting runtime: 24.16.0
- Canonical repository: `C:\Users\ajitr\Projects\NYSA-CRM`
- GitHub repository: `ajitraushan/NYSA-CRM` (private)
- Production deployed source commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- Release 1 requirements baseline: `3ccbcc78edefb338c3e0d9742c0cdb6b563b537a`
- Local completion branch: `agent/release-1-completion`
- Dashboard production package commit: `b7341df639f6afa28045535651a2502930ab468c`
- Effective dashboard production release commit: `b3637d4ef398a1516298182ee4c52966968f3b4e`
- Dashboard staging URL: `https://crm-test.nysarealty.com`
- Dashboard staging database: `nysareal_nysacrm_r1test`
- Phase 1 field review: RR-001 through RR-011 incorporated into Revision 2
- Review workbook: 462 fields across 24 modules, awaiting business sign-off

## Implemented

- Secure first-administrator bootstrap, now disabled in production
- Login, logout, server-side sessions, and access revocation
- Invitations and current broker-role administration
- Property listing creation, editing, filtering, status, comments, and archiving
- Dashboard-first user interface
- PostgreSQL migrations and startup health check
- Audit records for material current-MVP actions
- cPanel production deployment and TLS endpoint
- Private Git source control with secrets and runtime data excluded
- R1-AMD-001 through R1-AMD-012 are deployed to CRM Test as effective source
  `3b49652`. The current consolidated package is
  `nysa-core-r1-uat-crm-test-3b49652.zip`; all earlier CRM Test correction packages
  through un-deployed `7705e0b` are superseded.
- The automated suite passes 69 assertions. CRM Test migrations 011 and 012 are
  recorded, and health returns HTTP 200 with database ready.
- R1-AMD-012 Revision 3 is deployed: oversized-logo validation occurs before profile
  creation, failed-logo retry stays linked to the saved draft, unused drafts alone can
  be reason-deleted, and version comparison is explained. Profile v5 is Approved with
  logo evidence; v1-v4 are Retired protected history. Profile v5 was subsequently
  activated during user retest; proposal-output confirmation remains pending.
- R1-AMD-006 Revision 6 is deployed to CRM Test as hotfix source `53aa930`. The user
  confirmed the closed-by-default edit/new-version workflow and aligned version summary
  on 2026-07-16. Funding-method calculation and proposal-output retests remain pending.
  Revision 6 keeps the form closed until Start new rule set, Edit draft or Create new
  version. The
  earlier Revision 4 attempt was not accepted because CRM Test still served the old
  screen. Revisions 5 and 6 replace the incomplete simple fee rows with contextual
  bases/formulas, conditional bands, VAT,
  quantities, estimates/caps, payer/source governance and scenario snapshot details;
  drafts can be explicitly edited/tested, saved versions remain read-only, new versions
  can be created from governed history, bank-finance-only fees are excluded from cash
  purchases, versions can be compared, and unused draft/approved versions can be
  reason-retired before administrator approval and activation.
- R1-UAT-001 through R1-UAT-013 remain open at `Deployed to CRM Test`; R1-UAT-013 has
  partial user confirmation for its fee-screen workflow only. None may close until all authenticated
  retesting passes and the user explicitly confirms it.
- Production is excluded from this correction cycle. The only authorized deployment
  and manual-test target is `https://crm-test.nysarealty.com/`.
- Lead-creation package source `60c9b82` and migrations `017` and `018` are deployed to
  CRM Test. Health is database-ready and both migrations are recorded. User retest then
  found lowercase budget-suffix handling and a split customer/lead save outcome: the
  first lead request failed after its customer request committed, so retry detected the
  retained email/phone as a duplicate. R1-AMD-016 Revision 2 and R1-AMD-020 Revision 1
  are implemented locally: business amounts are normalized before submission and a new
  customer, channels, role, lead, queue history and audit evidence commit atomically.
  CRM Test deployment, retest and explicit user confirmation remain pending.
- The automated suite passes 94 tests after the governed Structured Requirements save and
  visible AI-failure corrections. Changed
  browser and route JavaScript pass syntax validation; PostgreSQL-backed CRM Test failure-
  rollback and committed-success verification remain required.
- R1-AMD-017 Revision 2 restores the existing-customer dropdown as a separately labelled,
  always-visible alphabetical selector; search remains an optional ranking aid and does
  not replace or hide the dropdown. This revision supersedes hotfix package `377f77e`
  before deployment.
- CRM Test retest of hotfix `0da2d89` exposed a browser-only submit regression: Create lead
  was implicitly a submit button, while the new save guard searched for an explicit
  `type="submit"` and stopped before calling the API. R1-AMD-020 Revision 2 explicitly
  identifies the control and adds a visible fallback; a superseding CRM Test hotfix is
  required.
- R1-AMD-021 Revision 1 is agreed for a dedicated Customer workspace. Existing KYC is
  already stored once against the reusable contact record, but its maintenance is currently
  reachable only from a lead. The new workspace will make the customer authoritative across
  leads, proposals and related operations while retaining masked output and role-restricted
  private-document access. Implementation and CRM Test deployment have not started.
- R1-AMD-021 Revision 2 is implemented locally: Customers is a primary CRM
  workspace and owns verification/KYC maintenance; customer detail shows related leads.
  Lead detail becomes a consumer with a read-only summary and Open customer record action,
  rather than requiring users to open a lead before maintaining the customer.
- CRM Test now successfully created a new-customer lead after deployment of `82acac1`,
  confirming the route and submit correction for a valid case; R1-UAT-021 remains open for
  rollback, duplicate and exact-count evidence. R1-AMD-022 Revision 1 is implemented locally
  to require customer name/email/phone/preferred channel plus both lead budget limits and at
  least one preferred area, including direct API and incomplete-existing-customer guards.
- R1-AMD-009 Revision 2 is implemented locally after qualification-maintenance usability retest failed.
  CRM Test has no active model applicable to the tested lead, while the current screen uses
  free-text Business line, unlabeled dense factor rows and no understandable activation path.
  The next revision will provide governed business-line choices, active coverage, labelled
  factor cards and a guided Draft -> Test -> Approve -> Activate lifecycle.
- The generic sensitive-factor message was traced to substring matching: `age` incorrectly
  matched the legitimate factor word `mortgage`. Whole-term matching and a message naming
  the actual prohibited personal/social attribute are implemented locally and tested;
  mortgage readiness remains permitted.
- CRM Test typography hotfix `378b3a8` increased maintained interface font sizes by 15%; the
  user explicitly confirmed on 2026-07-18 that the new size is working. R1-UAT-025 and
  R1-AMD-025 Revision 1 are closed.
- R1-AMD-026 through R1-AMD-028 are implemented locally: financial scenarios use separate
  mortgage/investment business forms instead of JSON, private lead documents have a scoped
  immutable register and separate consent-evidence action, and lead tasks are presented as an
  owned action plan. CRM Test deployment and explicit workflow/security confirmation remain
  pending; production remains excluded.
- R1-AMD-006 Revision 13 and R1-AMD-014 Revision 4 are implemented in the current
  local commit. Proposal builder now reports missing prerequisites, creates a
  preparation shell only from an active template, presents a transparent governed
  shortlist, groups approved media under its inventory property, drafts editable AI
  highlights/suitability only after user selection, explains saved-scenario assumptions
  and preserves separate immutable generation. The complete automated suite passes. The
  cumulative CRM Test package and script are prepared; deployment, authenticated retest
  and explicit user confirmation remain pending, and no related finding is closed.
- CRM Test financial-scenario retest exposed that no Regulatory and Fee Assumption version
  was active. The server correctly rejected persistence, but the screen accepted all inputs
  before exposing that prerequisite and did not provide a calculation-only review. R1-AMD-026
  Revision 2 now reports readiness first and separates Calculate and review from Save immutable
  snapshot, with explicit EMI, LTV, DBR, repayment, interest and fee output bound to the exact
  reviewed assumption version. All 94 automated tests pass; CRM Test deployment,
  authenticated retest and explicit user confirmation remain required.

## Release 1 Deployed Implementation

The deployed Release 1 source implements the governance, scoped CRM
access, contacts/companies/channels, documentary marketing consent, lead routing and
SLA, signed/idempotent website intake, lifecycle/requirements/tasks, explainable
qualification, immutable finance scenarios, private media/documents, controlled
proposal versions, role dashboards, reports, governed values, activity correction,
and hierarchical drill-down described by the `3ccbcc7` baseline. The user-facing
header is branded NYSA CORE under decision D-030.

Evidence is recorded in `docs/RELEASE_1_ACCEPTANCE_STATUS.md`. Deployment does not
by itself close Release 1 acceptance: authenticated end-to-end, controlled-data
reconciliation, timed proposal, and remaining production workflow gates stay open.

## Production Verification Completed

- Application health returned database ready.
- Administrator setup completed and bootstrap key removed.
- Administrator logout and login succeeded after restart.
- Controlled listing create, read, update, status, comment, and archive smoke test passed.
- Production migrations `002` through `009` applied and were recorded in
  `schema_migrations`; a second migration run completed without reapplication.
- Release 1 health, authenticated dashboard, Leads, Inventory, and Administration
  pages loaded after deployment.
- Dashboard source hotfix `5299a39`, logo hotfix `17abe8d`, and NYSA CORE branding
  hotfix `1179cca` were deployed and verified.
- Manual PostgreSQL custom-format backup created with `pg_dump`.
- Downloaded backup signature and SHA-256 were verified locally.
- Backup restored successfully into an isolated database.
- Restored counts matched the expected admin, smoke-test, audit, and migration data.
- Restore-test database was removed and production health remained ready.
- Migration `010_role_dashboard_rebuild.sql` was applied to the isolated dashboard
  staging database and a second run completed without reapplication.
- Guarded dashboard fixtures were created only in the `_r1test` database.
- Managing Director, Manager, and Agent dashboards passed role-specific visual
  testing, including hierarchy scope, complete breadcrumbs, drill-down records,
  personalized titles, period presets, source-dependent Campaign filtering, and
  inventory attribution/detail access.
- The committed automated suite passes 49 tests with no failures, including the
  LiteSpeed/CloudLinux CommonJS-to-ESM startup wrapper contract.
- Production migration `010_role_dashboard_rebuild.sql` applied exactly once;
  `dashboard_metric_snapshots` exists and all captured business-record counts were
  unchanged after deployment.
- Production returned HTTP 200 with database ready after the cPanel startup file
  was changed to `app.cjs`.
- Production UI smoke testing passed for Administration, Leads, Inventory,
  personalized role dashboards, all four Managing Director views, period presets,
  and Source/Campaign filtering. No dashboard fixtures were seeded in production.

## Backup Status

- Verified pre-Release 1 server backup: `~/crm-backups/nysacrm-pre-release1-20260714.dump`
- Pre-Release 1 backup SHA-256: `176c74b46c839628b1cf1267a089839fc071ad93e7560963c32b5502ebba400c`
- Verified pre-dashboard database backup:
  `~/crm-backups/nysacrm-pre-dashboard-b7341df-20260715.dump`
- Pre-dashboard database backup SHA-256:
  `baa38ddee84f67b392b84222016ec217888f06cbbd471bb5697b52e848d3e591`
- Verified pre-dashboard application backup:
  `~/crm-backups/nysa-crm-app-pre-dashboard-b7341df-20260715.tar.gz`
- Pre-dashboard application backup SHA-256:
  `8fd0d58ca4086a4b6f82367c91b37f2965c43907dd84932bc068b88d5533701b`
- Verified server backup: `~/crm-backups/nysacrm-2026-07-13.dump`
- Verified local backup: `CRM Backup/nysacrm-2026-07-13.dump`
- Verified local SHA-256: `9FF995D145D0A7E9A348D239993E7F9280DBA672857433EE3B0294AD3FFF3C60`
- Hosting ticket created requesting `PSQLBACKUP`, schedule, retention, off-server
  storage, restore procedure, failure notification, and phpPgAdmin export repair.
- Open operational dependency: written Tasjeel confirmation is still pending.

## Known Gaps

- The Agent, Manager, and Managing Director dashboard rebuild is deployed and
  production-smoke-tested; formal requirement acceptance remains separate.
- Production source is manually deployed; deployment is not yet automated from Git.
- Release 1 migrations `002`–`009` still require execution on a fresh database and
  an isolated restored production backup for formal acceptance evidence.
- Authenticated PostgreSQL-backed role/workflow tests, dashboard reconciliation, and the timed proposal test remain pending.
- The production deployment is manual and the deployed source commit must continue
  to be recorded for every hotfix.
- Full opportunity/deal, commission, and transaction-compliance workflows remain later releases.
- No configured email, calendar, WhatsApp, portal, or accounting integration.
- No configured NYSA website, Meta, Property Finder, or Bayut integration credentials.
- External Broker remains an interface identity classification only; external broker
  authentication and CRM access, and customer access, remain intentionally excluded.
- The existing `listing_agent` role currently uses the lead-centric Agent dashboard;
  Release 1.1 will provide its approved Listing Executive inventory workspace.

## Next Approved Workstream

Begin Release 2 from the committed roadmap and requirements, while preserving the exact held
Release 1.1 production candidate recorded above. Production promotion remains a separate gated
workstream and must not absorb Release 2 changes.

## Handoff Prompt for a New Task

Use:

> Read `docs/README.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, and the
> latest Git history. Reconcile them with the current code before making changes,
> then continue the named NYSA CRM workstream.
## Release 1.1 area-import duplicate handling

- `R1.1-AMD-001 Revision 2` is implemented locally: areas already maintained in
  NYSA CORE and exact repeated Excel rows are automatically skipped during bulk
  upload, while valid new areas remain eligible for import. Genuine stable-code
  conflicts still block the transaction.
- The complete automated suite passes: 122 tests.
- CRM Test deployment, functional retest and explicit user confirmation remain
  pending.

## Release 1.1 provider-neutral listing intake

- Amendment `R1.1-AMD-013` / finding `R1.1-UAT-027` records the Release 1.1 scope
  gap identified on 2026-07-21: provider-neutral listing integration/import intake
  was specified but not implemented.
- Migration `036_provider_neutral_listing_intake.sql`, the signed
  `/api/intake/listings` endpoint and the role-scoped Integration / import intake queue
  now implement stable provider/external/event/mapping identifiers, Draft-only
  creation, idempotent replay, concurrent duplicate protection, failed/unmapped
  review and controlled replay without approved-inventory overwrite.
- All changed JavaScript passes syntax validation and the complete automated suite
  passes 148 tests.
- Package commit `f051e42` is deployed to CRM Test. The health endpoint returned
  database ready, migration 036 is recorded at `2026-07-21 14:42:39.192808+00`, and
  all 148 deployed automated tests passed. The NYSA owner completed the functional
  intake conditions and explicitly confirmed that all passed on 2026-07-21;
  R1.1-UAT-027 is closed and R1.1-AMD-013 is accepted.
- `R1.1-AMD-014` / `R1.1-UAT-028` is deployed and accepted on CRM Test: technical field-shape
  transformations remain in ETL/adapters, while full Administrators govern provider
  business-value mappings in CORE Admin through Draft, Tested, Approved, Active and
  Retired versions. Intake applies only an exact Active provider/version mapping,
  records the immutable mapping identity on the event and Draft, and leaves unknown
  values in the existing attention queue for controlled replay without guessing.
- Migration `037_listing_mapping_governance.sql` is applied. Package source commit
  `25310fd` was deployed from `nysa-core-r1-1-provider-mappings-crm-test.zip` (SHA-256
  `85ed5f44ce9e4a43644f60129cff2c9eae5de961964bc077d80f4d635c91aa6e`).
  Deployed files matched the staged package and CRM Test health returned database ready.
  The complete implementation suite passed 152 tests and the later cumulative suite
  passed 153 tests. On 2026-07-21 the NYSA owner explicitly confirmed completion of the
  signed mapped-intake, unknown-value isolation, replacement activation, controlled
  replay into exactly one Draft, duplicate-protection/history and unauthorized-role
  denial tests. `R1.1-UAT-028` is closed and `R1.1-AMD-014` is accepted.

## Reconciled future marketing and lead-management roadmap

- On 2026-07-21, additional planning inputs were allocated across the existing roadmap.
  `ENH-DASH-001` was subsequently authorized as the final proposed Release 1.1 enhancement;
  the broader sequential Agent workflow remains in Release 2. Campaign management,
  additional channels, nurture, landing
  pages and governed dynamic advertising in Release 3; MLS/listing adapters, portal
  quality and controlled external-CRM synchronization in Release 4; and marketing
  compliance, privacy operations, CPL/CPA/ROI and authoritative closed-sales analytics
  in Release 6.
- Existing functionality remains distinguished from the future scope: CORE currently
  has campaign/source attribution, team-queue routing by source/business line/Area,
  lead-level lifecycle history and response/conversion dashboards, but not a campaign
  master, direct-to-agent skill routing, automated nurture, landing-page/ad publishing,
  two-way CRM/MLS connectors or authoritative campaign-cost/acquisition reporting.
