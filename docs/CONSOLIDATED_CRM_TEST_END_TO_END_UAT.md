# NYSA CORE Consolidated CRM Test - One End-to-End UAT

**Correction candidate:** `2.1.0-dev.146` (deployed to CRM Test; focused owner UAT pending)  
**Observed CRM Test build:** `2.1.0-dev.145`  
**Environment:** CRM Test only  
**Data:** new synthetic CRM Test records; do not use real private customer/owner/authority data

> **Deployment update — 15 August 2026:** dev.146 is deployed and technically verified on CRM
> Test. Every per-defect status below that says “pending CRM Test deployment/UAT” preserves the
> pre-deployment correction record and is superseded only as to deployment: the current status is
> **deployed to CRM Test in dev.146; pending focused owner UAT**. No defect is marked Passed until
> its business owner completes the recorded UAT. Existing remote records were not silently repaired.

> **Cumulative deployment update — 18 August 2026:** CRM Test is deployed on `2.1.0-dev.158`.
> The cumulative package is `release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev158.zip`
> with verified SHA-256 `5b6a50ec7bbc13fb7583c9247187fd1fdd09c29870525e508fbeaf8bb98bb8ce`.
> Health and readiness returned ready on `2.1.0-dev.158`; migration 100,
> `100_dev158_uat040_048_operational_corrections.sql`, is current. Exactly one supervised CRM Test
> Node worker remains. Integration switches, including Property Finder, remain disabled. Production
> and the R2 clone were not targeted. Deployment does not constitute UAT acceptance: UAT-040 through
> UAT-048 remain pending until the user observes each corrected behavior in CRM Test.

## Objective

Prove one governed customer-to-closed-Deal journey inside the real CRM application, with exact role
boundaries and drill-down evidence. Property Finder, native WhatsApp, Microsoft 365 Email and
Calendly are not part of this first end-to-end lane.

## Test identities

Use existing authorized CRM Test roles without recording their private details in evidence:

- one full Administrator;
- one Sales Agent with an assigned Manager;
- that Manager; and
- one Director.

## Journey

1. **Administrator readiness**
   - Confirm controlled areas, document rules, marketing rules, commission slabs, employment and
     leave policy pages open.
   - Confirm ordinary Admin maintenance is direct and does not create maker-checker approval.
   - Confirm the Administrator cannot open Director-only payout amounts.

2. **Agent creates the synthetic customer journey**
   - Create a synthetic Customer and Lead with non-real contact values reserved for testing.
   - Assign/accept the Lead, record qualification and save structured requirements.
   - Create the Opportunity only after both qualification and requirements are complete.

3. **Inventory and matching**
   - Create or select synthetic Internal Inventory with current approval, verification and
     availability evidence.
   - Run governed matching, inspect score/missing facts/trade-offs and promote one reviewed match.
   - Confirm stale or ineligible Inventory cannot be promoted or used for a Viewing.

4. **Viewing, Offer and Booking**
   - Create and confirm the Viewing from the exact Opportunity/Match context.
   - Record attendance, outcome, customer feedback and follow-up.
   - Create an Offer, record negotiation revisions and accept the exact version.
   - Create the Booking/reservation and verify the accepted deposit/expiry evidence.

5. **Deal and compliance**
   - Create the Deal from the accepted Offer and Booking; verify customer/Inventory parties are
     inherited rather than retyped.
   - Complete the required transaction document evidence and checklist items.
   - Confirm missing required evidence blocks closure without blocking unrelated CRM work.

6. **Receipt, closure and payout**
   - Record actual commission received and its confirmation before Close Won.
   - Close the Deal only after receipt readiness passes.
   - As Director, open the separate Payout workspace and drill down from the Agent calculation to
     the exact Deal, receipt, split and applicable slab.

7. **Cross-role checks**
   - Submit a small synthetic leave request as the Agent and confirm it reaches the assigned
     Manager's My Task Queue with leave type and reason visible.
   - Confirm the Manager can decide it, cannot self-approve, and the Administrator does not acquire
     approval authority merely by maintaining policy.

## Required evidence

- served application version and latest migration;
- one managed worker and healthy database response;
- synthetic record references only;
- pass/fail and exact defect description for every step;
- screenshots without private values; and
- confirmation that disabled integrations remained disabled.

Any correction changes the candidate. After corrections, rebuild, redeploy to CRM Test and repeat
the affected lane before freezing a Production-clone candidate.

## UAT observations

### Cumulative dev.158 UAT matrix

| UAT ID | Scope | dev.158 classification | Implementation | Deployment | User-observed retest |
| --- | --- | --- | --- | --- | --- |
| UAT-008 | Lead qualification can be completed before substantive Customer contact is recorded | Pre-existing correction failed its dev.158 retest | Corrected locally for dev.159; UI and API require completed substantive contact evidence before assessment | Not deployed; dev.159 candidate only | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-040 | Corporate Developer Master | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-041 | Inventory owner and internal-use authority | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-042 | Inventory market-intelligence and organization provenance clarity | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-043 | Manager verification queue record navigation | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-044 | Role-dashboard organization hierarchy | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-045 | Queue-age readability | Pre-existing defect corrected in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-046 | Shared Inventory eligibility and hard declarations | Pre-existing P0 correction included in dev.158 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-047 | Focused Inventory availability maintenance | Pre-existing defect extended by UAT-048 | Implemented and locally verified | Deployed to CRM Test | Pending |
| UAT-048 | Explicit availability effective period and dashboard quick action | Pre-existing defect corrected in dev.158 | Implemented and locally verified for the quick-action/API path | Deployed to CRM Test | Focused quick-action retest pending; ordinary-form observation reclassified as UAT-050 |
| UAT-049 | Developer selector appends governed-version label to company name | Newly discovered dev.158 presentation defect | Corrected locally for dev.159; version label removed from selector display | Not deployed; dev.159 candidate only | Failed on dev.158; dev.159 CRM Test retest pending |
| UAT-050 | Ordinary Inventory edit form omits availability expiry | Newly discovered dev.158 correction-coverage defect | Corrected locally for dev.159; effective/checked and expiry dates supported with chronology validation | Not deployed; dev.159 candidate only | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-051 | Inventory Community and Building are created as free text instead of governed masters | Newly discovered dev.158 governance defect | Corrected locally for dev.159 with governed Area → Community → Building masters; legacy text retained for explicit review | Not deployed; dev.159 candidate only; Property Finder remains excluded | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-052 | Opportunity creation offers ineligible Inventory and hides the actual exclusion reason | Repeat of UAT-012 explainability defect in a different journey; customer-fit hard gates superseded by owner | Corrected locally under versioned v3 policy; focused tests passed | Not deployed | Failed on dev.158; corrected CRM Test retest pending |
| UAT-053 | Rejected Offer cannot visibly initiate lower-price renegotiation for the same property | Newly discovered dev.158 Offer-recovery workflow defect | Corrected locally for dev.159; same-property recovery opens a visible revision form including revised amount | Not deployed; dev.159 candidate only | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-054 | Inventory verification detail does not return to verification queue after decision | Newly discovered dev.158 correction-coverage defect extending UAT-043 navigation | Corrected locally; verification-origin callback refreshes queue | Not deployed | **Failed on dev.158;** corrected CRM Test retest pending |
| UAT-055 | Verification checker sees creator guidance and an unnecessary custodian/reassignment concept | Newly discovered dev.158 checker-workspace/custody defect; owner policy removes custody from verification | Corrected locally; role-specific checker guidance and no verification reassignment | Not deployed | **Failed on dev.158;** corrected CRM Test retest pending |
| UAT-056 | Responsible-Agent reassignment made during verification is not visible on Inventory | Superseded by owner decision: no transferable Inventory custodian exists | Custodian UI/authority disabled locally; historical evidence retained audit-only | Not deployed | Original failed observation retained; replacement-policy retest pending |
| UAT-057 | Customer role `Developer` is ambiguous with the governed corporate Developer Master | Newly discovered dev.158 terminology defect | Corrected locally for dev.159; removed from new Customer-role inputs and rejected by API | Not deployed; dev.159 candidate only | Failed/ambiguous on dev.158; dev.159 CRM Test retest pending |
| UAT-058 | Mandatory Preferred channel has unclear operational effect during Customer creation | Newly discovered dev.158 requirement defect | Corrected locally for dev.159; optional and explicitly shown as “Not confirmed” when absent | Not deployed; dev.159 candidate only | Dev.159 CRM Test retest pending |
| UAT-059 | Customer Master shows only ten records and omits an existing Customer independently visible through Lead search | Confirmed Release 2.6 pagination regression | Corrected locally for dev.159; 25-row pages with Previous/Next navigation and page reset on search | Not deployed; dev.159 candidate only | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-060 | Lead Pipeline exposes only the first ten matching Leads with no later-page navigation | Confirmed sibling pagination regression | Corrected locally for dev.159; 25-row pages with Previous/Next navigation | Not deployed; dev.159 candidate only | Audit-discovered; dev.159 human retest pending |
| UAT-061 | Inventory register and Add Lead property picker expose only the first ten matching Inventory records | Confirmed sibling pagination regression | Corrected locally for dev.159; register pagination and full governed picker search | Not deployed; dev.159 candidate only | Audit-discovered; dev.159 human retest pending |
| UAT-062 | Lead/Requirement classification and Offer `Offer type` mix transaction, market stage and property segment | Newly discovered dev.158 data-model defect | Owner-confirmed `uat062-v1` catalogue and mappings deployed for core Lead, Requirement, Opportunity, Offer, AI and qualification paths; legacy rows flagged, not guessed | Deployed on CRM Test dev.159 | Partial human retest: three new Lead fields observed; persistence and full impacted-path verification pending |
| UAT-063 | Seller Lead capture incorrectly requires buyer-search fields and uses a buyer-side property prompt | Newly discovered dev.158 objective-dependent intake defect | Corrected locally for dev.159; Seller/Landlord requires Inventory and derives property facts instead of buyer-search inputs | Not deployed; dev.159 candidate only | **Failed on dev.158; dev.159 CRM Test retest pending** |
| UAT-064 | Governed Customer Selection hard-depends on an exact matching run/current shortlist, but provides no action to request AI-assisted ranking | Newly discovered dev.158 workflow defect | Corrected locally for dev.159; visible AI-assisted ranking action and customer-fit variances affect ranking only | Not deployed; dev.159 candidate only | Failed on dev.158; dev.159 CRM Test retest pending |
| UAT-065 | Generated Offer PDF has a hard-coded Commercial title, reports a false missing Inventory reference, omits property substance and is not HNW-client ready | Newly discovered dev.158 client-document defect | Corrected locally for dev.159; directional title, full property/terms, broker wording, validity and non-binding disclaimer | Not deployed; dev.159 candidate only | Failed on dev.158; sample visually verified; CRM Test retest pending |
| UAT-066 | Agent access can be suspended/revoked or employment ended without first reconciling active operational ownership | Newly discovered dev.158 offboarding governance defect | Corrected locally for dev.159; impact count and 409 block until active work is reassigned/resolved | Not deployed; dev.159 candidate only | Human offboarding retest pending |
| UAT-067 | Customer acceptance is missing from Negotiation, so step 4 cannot complete and Booking cannot validly begin | Newly discovered dev.158 workflow defect; **owner-confirmed UAT blocker** | Corrected locally for dev.159; acceptance is a Negotiation event and Booking is a later, separate reservation action | Not deployed; dev.159 candidate only | **Blocked on dev.158; real HTTP/PostgreSQL evidence now passed in `test/dev159-uat067-068-real-db.integration.test.js`; CRM Test retest pending** |
| UAT-068 | Governed Deal creation fails with an internal server error after successful acceptance and reservation | Newly discovered dev.158 Deal-lineage/schema integration defect; **UAT blocker** | Corrected locally for dev.159 with transaction-safe staged Deal/linkage creation and deferred consistency enforcement | Not deployed; dev.159 candidate only | **Blocked on dev.158; real HTTP/PostgreSQL Deal-lineage evidence now passed in `test/dev159-uat067-068-real-db.integration.test.js`; CRM Test retest pending** |
| UAT-069 | Seller/Landlord qualification is not governed separately from Buyer/Tenant qualification | Previously uncatalogued dev.158 objective-side qualification defect | Corrected locally for dev.159 with objective-specific versioned models; exact questions/weights/thresholds remain business configuration | Not deployed; dev.159 candidate only | Business-owner model approval and CRM Test retest pending |

> **dev.159 status control:** The matrix above and `CRM_TEST_DEV159_CONSOLIDATED_DEFECT_RCA_AND_DEPLOYMENT_PLAN.md`
> are the current implementation/deployment status for UAT-008 and UAT-049 through UAT-069. The detailed
> sections below preserve the original dev.158 observation and investigation record; older “not started” text
> in those historical entries must not be read as the current local-candidate state. No item is a UAT pass until
> the user observes the corrected behaviour after an authorized CRM Test deployment.

### Additional dev.158 QA automation evidence — 18 August 2026

> **Overall UAT status: IN PROGRESS.** The automated subset below is complete, but manual testing is not
> complete and dev.158 has not received final UAT acceptance.

- **Reported result:** 8/8 passed with real route/database execution. This is technical regression evidence,
  not a substitute for manual business-owner UAT.
- **Reporter:** User supplied the execution summary in this task. The raw runner output/file and its hash
  were not attached here, so this record does not claim that Codex independently reran the suite in this
  task.
- **Execution environment:** Not stated in the supplied summary. Do not infer CRM Test, local PostgreSQL or
  another environment until the raw evidence identifies it.
- **Sections 2.1/2.2 — administrative closure negative authority/validation:** Closure was blocked without
  Manager authority and blocked without a valid reason.
- **Section 2.5 — administrative closure persistence:** A real Inventory transition from `Available` to
  `Closed` completed and the reason `Withdrawn` persisted.
- **Section 5.1 — default assignment period:** A newly created Assignment measured exactly seven days to
  the millisecond.
- **Sections 5.3/5.4 — governed expiry change:** A non-Manager was blocked. A Manager then changed the
  expiry from 25 August 2026 to 31 August 2026. Independent database assertions confirmed `approvedBy`,
  `previousExpiresAt`, `approvedExpiresAt` and the exact reason text rather than relying only on the API
  response.
- **Sections 7.1–7.3 — delink and immutable history:** The Assignment was delinked. Database/event evidence
  retained both the original `created` event and the later `delinked` event with the same actor and complete
  history; no earlier event was silently erased.
- **Section 9.1 — `size_sqft` regression guard:** Inventory at 520 sqft was accepted against a 500 sqft
  minimum requirement, providing executed regression evidence for the earlier missing-`size_sqft` false
  rejection.
- **Remaining item from this QA file:** Section 4.3 remains open for manual execution. No pass is recorded
  for 4.3.
- **Technical coverage added by this evidence:** Subject to preservation of the raw output, the reported run
  fills the identified automated business-condition gaps for administrative closure, Assignment expiry
  governance, detached-linkage history and the size regression guard. **It does not close the overall
  dev.158 UAT.** Manual testing remains in progress, including section 4.3 and every user-interface or
  business-owner acceptance step still awaiting observation. UAT-049 and UAT-050 also remain open.
- **Test-fixture findings:** Five setup assumptions were corrected while making the tests execute against
  the real schema: `version_no` uniqueness, `lead_requirements_current_uq`, the `occurred_at` column name,
  the Booking foreign-key chain, and the `team_memberships`/`created_by` prerequisites for Manager
  authority. These were reported as test-fixture corrections, not application defects.

### Passed checkpoints

- **Inventory verification:** Passed by owner in CRM Test `2.1.0-dev.145`; the Inventory owner or
  represented party was maintained and the verification journey was completed successfully.
- **Viewing recovery journey through Offer:** Exercised by owner in CRM Test `2.1.0-dev.145` through
  a declined/no-show Viewing, rescheduling, recording the subsequent Viewing, and reaching the
  Offer step. This confirms the tested recovery sequence only; the remaining focused variants are
  still to be checked separately.

### Blocked journey checkpoint

- **Primary end-to-end record:** Lead `NYSA-LD-202608-000028`, Opportunity
  `NYSA-OP-202608-000004`, Inventory `NYSA-INV-000043`.
- **Reached:** Deal created from the accepted Offer and governed Booking/reservation.
- **Blocked at:** Deal workspace initialization. UAT-020's runtime exception prevents the six-step
  flow and Deal actions from being bound. UAT-021 makes the earlier-bound Booking cancellation and
  accepted-Offer withdrawal unsafe after Deal creation.
- **Evidence preservation:** Do not withdraw the Offer, release/cancel the Booking, recreate the
  Opportunity or manually change the reserved Inventory. Preserve this exact state for correction
  verification.
- **Candidate decision:** `2.1.0-dev.145` cannot pass the full customer-to-closure lane. Deal
  completion, Closed Lost/Inventory release, Closed Won/receipt and payout drill-down require a
  corrected CRM Test candidate and focused rerun.
- **Safe continuation on the current build:** Continue independent Administration, Leave and
  pre-Deal CRM checks. A separate synthetic journey may test Lead assignment/acceptance, mandatory
  customer-contact evidence, qualification, requirements, matching, Viewing, Offer and Booking.
  Use different available Inventory. To test reservation cancellation, cancel it before creating a
  Deal and verify the prior Inventory state is restored. Stop the separate journey before Deal
  creation because the known Deal binder defect will recur.

### UAT-001 — Agent leave application fails

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`
- **Working:** Administrator can create a leave record and approve it for an Agent
- **Failing:** Agent cannot submit a leave application
- **Actual result:** Internal Server Error
- **Expected result:** Agent submits a leave request with leave type and reason; the request appears
  in the assigned Manager's My Task Queue for approval, with Director approval authority also
  available under the approved role model
- **Conclusion:** Leave administration is present, but the leave journey is not yet end-to-end
  complete in CRM Test

### UAT-002 — Administration navigation is duplicated and misaligned

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`
- **User-visible evidence:** `Listing approval policy` appears twice; `User maintenance`,
  `User Management`, and `User records` appear as overlapping menu choices
- **Root cause confirmed locally:** Admin navigation labels are assigned by the positional index of
  each rendered section. Four newer sections—Market Intelligence, Commission and payout policy,
  Agent employment and leave, and Customer/transaction document compliance—were inserted without
  adding their navigation definitions. Every later label is therefore shifted onto the wrong
  content. The definitions also contain `User maintenance` twice.
- **Affected labels/content:** `CRM teams`, `Property media policy`, `Listing approval policy`,
  `User maintenance`, `Integration Failures`, and `Operations & audit` can point to unrelated
  maintenance content before later fallback entries repeat some of their actual names
- **Expected result:** One unique menu choice per business workspace, with its label bound directly
  to the correct section rather than inferred from render order. User invitation/addition and
  existing user records should remain together under one `User management` workspace.
- **Recommended correction:** Give every Admin section an explicit stable navigation key and label,
  remove the duplicate `users` definition, and add an automated assertion that menu labels are
  unique and open the matching section heading.

### UAT-003 — Assignment queue briefly switches workspace after assigning an Agent

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Company pending assignment
- **Action:** Select a destination team and responsible Sales Agent, then assign the Lead
- **Actual result:** The assignment overlay closes, briefly exposes the `Audit and Operations log`
  Admin workspace underneath, and then opens the assignment queue again
- **Expected result:** The user remains continuously in the assignment workspace; the assigned card
  disappears or shows completion and the waiting count updates without a visible screen change
- **Root cause confirmed locally:** After a successful assignment, the handler removes the current
  overlay before the asynchronously refreshed queue is ready. This exposes the currently active
  underlying Admin workspace—observed as `Audit and Operations log`. A CRM Leads reload is also
  started during the same transition, making the navigation sequence unnecessarily unstable.
- **Recommended correction:** Keep the queue overlay mounted, disable the submitted card during the
  request, remove/update that card on success, refresh the counter in the background, and avoid a
  route-level Leads reload until the user intentionally closes the queue.

### UAT-004 — Unassigned Lead is absent from both assignment workspaces

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`
- **Lead reference:** `NYSA-LD-202608-000028` — Sale Lead — Website
- **Working:** The Lead is visible as `unassigned` in the general Leads tab
- **Failing:** The Lead is not available in the Manager's Assignment Queue and no corresponding
  item appears in Pending Tasks/My Task Queue
- **Expected result for an externally sourced Lead:** When a Lead enters a routed team queue, it is
  visible in the responsible Manager's assignment workspace and has a clearly identifiable pending
  assignment task linked to the Lead
- **Current implementation gap:** Unassigned work is queried separately through
  `/crm/assignment-queue`, while My Task Queue receives no assignment record. The observed Lead is
  absent from the scoped Manager assignment result as well, despite remaining unassigned in Leads.
- **Correction design to confirm after UAT:** Surface the governed assignment work in the Manager's
  existing Pending Tasks/My Task Queue while retaining the Assignment Queue as the operational
  assignment workspace; ensure one work item per queue cycle and complete it atomically on
  assignment or recycling.

### UAT-005 — Manual Agent-created Lead is unnecessarily unassigned and Manager can qualify it

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Lead `NYSA-LD-202608-000028`
- **Observed creator:** Ajit manually created the Lead inside CRM
- **Actual ownership result:** The Lead status is `unassigned` and requires a separate assignment
  step
- **Actual authority result:** Aadivya, as Manager, can perform the qualification assessment while
  the Lead remains unassigned
- **Expected ownership rule:** A Lead manually created inside CRM by an eligible Agent should be
  owned by that Agent immediately; Manager assignment is unnecessary. Governed assignment is
  required when the Lead flows from an external system and has no responsible internal Agent.
- **Expected qualification rule:** The responsible Agent performs the initial qualification
  assessment. A Manager may review or apply an explicit audited override, but must not perform the
  initial Agent assessment merely because the Lead is in a managed team or is unassigned.
- **Root cause confirmed locally:** Both manual CRM capture routes call the same insertion function,
  which always writes `assigned_to = NULL` and `assignment_status = 'unassigned'`. The generic Lead
  write policy also grants a Manager write authority across managed-team Leads, and the
  qualification endpoint reuses that broad permission without requiring an assigned Agent.
- **Correction design to confirm after UAT:** Distinguish internal manual creation from external
  intake at the ownership boundary; auto-own an eligible Agent-created Lead and bypass the queue;
  retain routing/assignment for external intake; restrict initial qualification to the responsible
  Agent while preserving a separate audited Manager override. Define the exceptional behavior for
  a manually created Lead whose creator is not an eligible Agent before implementation.

### UAT-006 — Lead creator is not visible on the Lead screen

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`
- **Actual result:** The Lead screen does not clearly identify which Agent created the Lead
- **Expected result:** Display a prominent, read-only `Created by` field containing the creating
  Agent's name. Keep it distinct from `Responsible Agent`, assignment status, routed team and any
  later reassignment history.
- **Reason:** Users must be able to distinguish an internally Agent-created Lead—which should be
  owned by its eligible creator—from an externally sourced Lead awaiting governed assignment.
- **Implementation impact confirmed locally:** The Lead record stores `created_by`, but the Lead
  detail response does not currently resolve and return the creator's display name, and the Lead
  screen has no creator field. Both API projection and UI presentation require correction.
- **Acceptance requirement:** The creating Agent's name is visible without opening audit history;
  it remains immutable after reassignment; and synthetic/authorized role tests confirm that no
  additional private user data is exposed.

### UAT-007 — Apply the approved NYSA logo variants consistently across CRM outputs

- **Status:** Corrected locally in dev.146 from the owner-supplied production asset package; pending CRM Test deployment/UAT
- **Reference supplied:** Approved logo-usage matrix supplied by the owner during CRM Test UAT
- **Core rule:** Use the horizontal lockup wherever the space is wide and short, use the stacked
  lockup where vertical space is available, and use the mark alone where the surface is square or
  very small.
- **Shape rule:** In square or circular spaces, never shrink or squeeze a full lockup. Switch to the
  mark-only asset so the brand remains readable; this applies particularly to WhatsApp and social
  avatars.
- **Minimum rendered sizes:** Horizontal lockup at least **140px wide**; stacked lockup at least
  **90px wide**; mark at least **24px**. Below the horizontal minimum, use the mark rather than
  allowing `REALTY` to become illegible.
- **Immediate CRM/web header correction:** Use the horizontal light variant at approximately
  **44px rendered height**, while respecting the 140px minimum width and preserving its aspect
  ratio. This is intended to remove header crowding and restore contrast.
- **CRM login/vertical brand panel:** Stacked variant where the available composition is vertical;
  otherwise use the horizontal variant appropriate to the background
- **Immediate CRM/web footer correction:** Keep the approved dark variant—stacked dark by default,
  or horizontal dark where the footer is strictly wide and short
- **Favicon/browser tab and square app icon:** Mark only
- **Future WhatsApp Business and social avatars:** Mark only; do not place a full lockup inside a
  circular crop
- **Email signature and future Microsoft 365-generated signature assets:** Horizontal light PNG at
  2x resolution
- **Letterheads, contracts and generated PDF guides:** Horizontal light variant
- **Presentation decks:** Choose the approved light or dark variant to match the slide background
- **Property brochures and white-page marketing documents:** Horizontal light variant
- **Low-fidelity/monochrome output:** Mono positive or mono reversed for stamps, embroidery,
  newspaper and fax-quality printing
- **Acceptance requirement:** Centralize the approved variants as governed brand assets; do not
  stretch, recolor, crop or recreate the lockup; verify header, login, favicon, PDF/document,
  brochure, presentation and email contexts at their real rendered sizes. Automated/UI checks must
  cover the 140px, 90px and 24px minimums and confirm that small square/circular contexts select the
  mark instead of shrinking a lockup.
- **Implementation dependency:** Confirm or obtain the approved source files for every required
  variant—horizontal light/dark, stacked light/dark, mark-only and mono positive/reversed—without
  embedding credentials or private information.
- **Local correction evidence:** The owner supplied `nysa-logo-production-package.zip` with SHA-256
  `d4c5b2112834d703f70a9f97b75ba66cc39509563414b4f424df9e8f08cab369`. Dev.146 preserves the
  supplied vector and raster files byte-for-byte under `public/brand/nysa/`, records the governed
  context mapping in `brand-assets.json`, uses the dark-background horizontal lockup at 44px in the
  CRM header, switches to the supplied mark/app icon on compact screens, uses the stacked
  dark-background lockup for authentication, uses the horizontal dark-background lockup in the
  footer, and installs the supplied favicon, Apple-touch and social-share assets. Light-background
  horizontal PNG @2x is registered for governed email-signature and PDF/letterhead contexts.

### UAT-008 — Lead progression and qualification can bypass customer-discussion evidence and the next action

- **Status:** Failed through dev.158. Corrected and deployed in dev.159; partial human CRM Test retest now confirms
  the pre-contact qualification control is locked.
- **Observed in:** CRM Test `2.1.0-dev.145`, then observed again in cumulative CRM Test
  `2.1.0-dev.158` specifically through qualification without prior Customer contact.
- **Actual result:** A user can progress a Lead without recording when the customer was contacted,
  the communication channel, what was discussed, the outcome, and the next action with its due
  date. During dev.158 UAT, the CRM also allowed the assigned Agent to create a Qualification
  Assessment without first recording Customer contact. The current process is therefore easy to
  circumvent and does not provide reliable evidence that the assessment came from a Customer
  discussion.
- **Required completed-contact record:** Contact date and time; channel such as Call, WhatsApp,
  Email or Meeting; direction; meaningful discussion summary; controlled outcome; and a next action
  with responsible owner and due date/time.
- **Required no-contact record:** A genuine unsuccessful attempt must not require invented
  discussion notes. It must record attempt date/time, channel, a controlled outcome such as no
  answer, invalid contact or callback requested, and the next retry/action with owner and due
  date/time.
- **Progression rule:** The API must prevent marking a Lead as contacted, completing its operative
  qualification, or advancing it to a later active stage unless the applicable contact or
  no-contact evidence is saved. An active Lead must not be left without a dated next action.
- **Governed exceptions:** Nurture, approved holding and terminal outcomes may follow their own
  controlled path, but require an approved reason and audit evidence. A holding/nurture exception
  must also carry a review date where applicable; a blank or free-form bypass is not acceptable.
- **Confirmed dev.158 RCA:** The earlier generic Lead-stage/activity gaps were addressed, but the
  separate qualification route was not given the same prerequisite. The exact dev.158 browser
  displays `Assess qualification` whenever the Lead is writable and assigned to the signed-in
  Agent. `POST /crm/leads/:id/qualification-assessments` checks Agent ownership, active model and
  questionnaire inputs, but does not require a completed successful Customer-contact Activity,
  `first_contact_at`, contact outcome or dated next action. The API therefore accepts exactly the
  sequence observed by the user. This is an incomplete correction boundary, not user error.
- **Existing product rule:** The product requirements already state that active Leads require a
  next action and due date unless explicitly placed in nurture. This UAT result shows that the rule
  is not enforced at the Lead progression boundary.
- **Historical local solution implemented in dev.146 — incomplete for qualification:** Customer Call, Email, WhatsApp and Meeting records now
  require direction, a controlled successful/no-contact outcome, completed evidence, meaningful
  details/outcome and a dated owned next action. Only successful outcomes set first contact or
  advance New to Contacted. Direct Lead stage edits to Contacted or later require the same persisted
  completed successful-contact evidence and dated next action. The qualification endpoint and
  button were not included in that enforcement and remain defective in dev.158.
- **Acceptance requirement:** Enforce the complete rule in the API as well as the UI; present the
  customer-discussion/attempt form in the normal Lead workflow; keep the next action visible and
  open until completed or explicitly rescheduled; and add negative tests proving that direct API,
  stage-edit and incomplete-activity bypasses are rejected. Positive tests must cover substantive
  contact, failed contact with retry, nurture/holding and terminal outcomes.
- **Dev.159 implementation:** The assigned Agent sees `Qualification locked until Customer contact` while the Lead
  has no recorded first substantive contact. The assessment API independently requires a completed, non-voided
  Customer discussion with an approved substantive outcome and a retained dated next action before it will save an
  assessment.
- **Deployment status:** Deployed on CRM Test `2.1.0-dev.159`.
- **Partial human retest evidence:** The user first observed qualification locked before Customer contact. After the
  user completed the Customer-contact fields, the Lead changed to `Contacted` and selecting qualification reached the
  objective-specific questionnaire lookup. CORE then returned `No active Lead Qualification Version is available for
  Customer objective buy`. This confirms the visible contact-first lock and subsequent unlock/routing to the `buy`
  questionnaire gate; it does not yet prove direct API bypass resistance or a completed assessment.
- **Retest status:** Partially observed, not passed. Contact-first locking and the post-contact objective lookup were
  observed. Activate an owner-approved `buy` Qualification Version, complete the assessment, verify that an
  unsuccessful/no-contact attempt does not falsely unlock qualification, and verify that a direct pre-contact
  assessment request is rejected without saving data.

### UAT-009 — Previous qualification details collapse into a narrow single column

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Assess qualification → Previous assessments
- **Actual result:** The result, score, model/version and assessment date wrap almost one word per
  line in a very narrow column. The `Override this result` control occupies nearly the full
  remaining row, leaving a large empty area and making the history difficult to read.
- **Expected result:** Each prior assessment should use a readable full-width summary row or card.
  Temperature and score should be grouped prominently; calculated result, model/version,
  assessment date, assessor and override status/reason should follow in a structured layout. The
  override control should remain a compact secondary action aligned to the right on wide screens
  and move below the summary on narrow screens.
- **Root cause confirmed locally:** Qualification history reuses the generic `.activity-row` grid,
  whose three columns are `34px 1fr auto` and assume the first child is a circular activity marker.
  The qualification row does not render that marker: its summary becomes the first child and is
  therefore placed in the 34px column, while the override button is placed in the flexible column.
- **Recommended correction:** Use a dedicated qualification-history row/card class with a
  `minmax(0, 1fr) auto` desktop layout and an explicit responsive single-column layout. Do not
  depend on activity-timeline marker geometry for qualification history.
- **Acceptance requirement:** Verify normal and long values at desktop and narrow modal widths;
  no word-by-word wrapping, overlap, clipped metadata or excessive empty space; keyboard focus and
  the authorized override action remain clear and usable.

### UAT-010 — Lead assignment returned to the queue without a clear visible reason

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Lead `NYSA-LD-202608-000028`
- **Observed sequence:** The first assignment was made through the Lead record but did not appear to
  remain stamped. The Lead later appeared unassigned. The owner then reassigned the Lead to
  themselves and accepted that assignment. The screen did not make it clear whether the first
  assignment was recycled because of an SLA breach or why ownership returned to the queue.
- **What can be concluded:** SLA recycling is a code-supported explanation but is not confirmed for
  this exact Lead from the visible evidence. The system recycles an offered assignment when it is
  not accepted before `acceptance_due_at`. It can also recycle an accepted assignment when no first
  customer contact is recorded before `first_contact_due_at`. Acceptance alone therefore does not
  prevent later recycling.
- **State-consistency defect confirmed locally:** General CRM reads run one timeout refresher that
  marks an expired offer `timed_out` and changes the Lead to `reassignment_due`, but leaves
  `assigned_to` populated and does not create the new queued cycle. Opening the assignment queue
  runs a second recycler that clears `assigned_to`, increments the queue cycle and creates a queued
  assignment row. The same business transition is therefore split across two read requests and can
  expose contradictory intermediate states.
- **Traceability gap:** Assignment history exists behind a separate `Assignment history` action,
  but the Lead summary does not explain the latest transition. The table does not present the SLA
  deadline, transition actor/event, queue-cycle meaning and acceptance versus first-contact breach
  in a sufficiently clear narrative. A user cannot reliably determine from the Lead screen who
  assigned it, whether it was accepted, which deadline was missed, who/what returned it to the
  queue, or why it is currently unassigned.
- **Required behavior:** Assignment, acceptance, rejection and SLA recycling must be one consistent
  state machine. A recycle must atomically close the current offer, preserve the prior Agent, state
  the exact breach type and deadline, create the next queue cycle, clear current ownership and add
  immutable audit/history evidence. Merely opening or reading a screen must not expose a partial
  transition.
- **Required Lead-screen explanation:** Show current assignment state and cycle, responsible Agent,
  offered/accepted timestamps, active SLA type and deadline, and the latest transition reason. If
  recycled, display an explicit message such as `Returned to assignment queue — acceptance SLA
  missed` or `Returned to assignment queue — first-contact SLA missed`, with the relevant deadline.
- **Acceptance requirement:** Add deterministic tests for assignment offer, timely acceptance,
  acceptance timeout, accepted-but-first-contact timeout, rejection, reassignment and repeated
  cycles. Every test must reconcile the Lead row, current assignment row, complete history and audit
  event, and prove that repeated reads are idempotent and cannot cause an unclear partial state.

### UAT-011 — First customer action at Opportunity creation is uncontrolled free text

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Create Opportunity → `3. Set the first customer action`
- **Actual result:** `What happens next?` is an unrestricted text field. Different Agents can enter
  different wording for the same action, use vague text, or bypass the intended customer pathway,
  preventing consistent workflow control and reporting.
- **Expected result:** Replace the field with a governed pathway selector backed by stable action
  codes and business labels. Keep `Complete by` mandatory. Show an additional mandatory instruction
  or notes field only when the selected pathway needs detail.
- **Proposed standard pathways for owner review:**
  1. Confirm or clarify customer requirements
  2. Send suitable property details / shortlist and seek feedback
  3. Arrange customer consultation or meeting
  4. Schedule property viewing
  5. Obtain missing customer information or documents
  6. Confirm financing / mortgage readiness
  7. Prepare or discuss proposal / offer
  8. Follow up on property, proposal or offer feedback
  9. Await customer decision, with a mandatory follow-up deadline
  10. Nurture / future follow-up, with controlled reason and review date
  11. Controlled exception / other, with mandatory explanation and audit evidence
- **Context rule:** Present only pathways valid for the Opportunity's transaction type,
  representation path and current stage. Selecting a pathway must not falsely complete a Viewing,
  Offer, Booking or other governed stage event; it creates the first dated customer-facing action.
- **Root cause confirmed locally:** Both the Lead-conversion Opportunity form and the separate
  governed Opportunity-origin form render `nextAction` as a required text input. The creation API
  validates only that `nextAction` is non-blank and stores the supplied text; it has no controlled
  action code or approved-value validation. The later Opportunity reminder editor also remains free
  text and could immediately bypass a creation-only selector.
- **Data and reporting requirement:** Store an immutable/stable `next_action_code` separately from
  the display label and optional notes. Reports, reminders and dashboards must group by the stable
  code while retaining the exact user-entered detail and due date.
- **Local solution implemented in dev.146:** Creation and later updates use an API-validated stable
  `next_action_code`, derived business label, optional notes and mandatory due date. Nurture and
  controlled-exception choices require notes; display labels and arbitrary free text are rejected as
  codes. Internal lifecycle updates also set controlled system action codes.
- **Acceptance requirement:** Enforce allowed codes in the API as well as the UI, apply the same
  controlled model when the action is updated, require pathway-specific detail where applicable,
  reject direct free-text/API bypasses, and test valid options for each relevant stage and
  transaction/representation context.

### UAT-012 — Selected Inventory is contradicted by an unexplained “no eligible Inventory” message

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity `NYSA-OP-202608-000004`, Matching
- **Selected Inventory:** `NYSA-INV-000043 · amwaj`, asking price AED 1,200,000
- **Customer budget:** AED 1,300,000 to AED 1,400,000
- **Actual result:** The screen correctly shows that one property is available in the Opportunity
  and displays the selected Inventory, but immediately below states `No eligible Inventory is
  currently available` and offers no reason. This reads as though the selected property itself is
  ineligible.
- **Immediate cause confirmed locally:** The matching-inventory endpoint deliberately excludes every
  Inventory record already present in `property_matches` for the Opportunity. Because
  `NYSA-INV-000043` is already selected, it is not returned in the list of properties that may be
  added. The UI then interprets an empty addable list as no eligible Inventory at all. The message
  therefore means “no additional eligible Inventory,” but does not say so.
- **Required message:** Preserve the selected-property confirmation and state clearly, for example:
  `1 selected property is currently available. No additional eligible Inventory was found.` Never
  use a global no-Inventory message when a valid selected property is already shown.
- **Explanation requirement:** If no additional candidates are returned, show governed reason
  categories and counts, such as already selected, unavailable, verification expired, availability
  stale/not confirmed, reserved, transaction type mismatch, above maximum budget, or missing
  evidence requiring clarification. Allow an authorized user to inspect property-level reasons
  without exposing restricted owner/contact information.
- **Budget rule confirmed for correction:** The customer's maximum affordable budget is the hard
  price ceiling. A property priced below the stated lower target—AED 1.2m against AED 1.3m–1.4m in
  this case—must not be excluded merely for being cheaper. It remains affordable and potentially
  suitable, subject to location, property type, bedrooms, size, condition, payment terms and other
  confirmed requirements.
- **Ranking defect confirmed locally:** The newer hard-eligibility evaluator excludes only a price
  above `budgetMax`, which is correct for this rule. However, the fit-scoring component currently
  marks budget as `not_met` whenever price is below `budgetMin`, reducing the match score without
  distinguishing an affordable property below the preferred target from one above the customer's
  maximum. Older AI evidence logic uses the same strict lower-bound comparison.
- **Required ranking treatment:** A below-target price should be labelled transparently as
  `Below stated target range — within affordability; broker/customer review`, not as an eligibility
  failure. It may be a preference/fit consideration if the lower target encodes expected quality,
  but must remain explainable and must not outweigh confirmed suitability without explicit policy.
- **Local solution implemented in dev.146:** The matching API returns selected, considered and
  additional-eligible counts, aggregated reason codes and property-level reasons stripped of private
  party data. The UI distinguishes selected Inventory from additional candidates. Scoring treats a
  price below `budgetMin` but not above `budgetMax` as met with an explicit affordability-review
  explanation; above maximum remains not met.
- **Acceptance requirement:** Test selected-only, selected-plus-additional and genuinely-zero-
  eligible states; return machine-readable exclusion/clarification reasons; prove that below-minimum
  Inventory remains eligible while above-maximum Inventory is excluded; and show the exact budget
  comparison and effect in governed scoring and UI explanations.

### UAT-013 — “What was confirmed?” is ambiguous for rejected and other Offer events

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Offer sent → Customer/counterparty rejected the Offer
- **Actual result:** After selecting rejection, the form asks `What was confirmed?` with the
  placeholder `Record the customer or counterparty communication`. A rejection does not intuitively
  read as a confirmation, and users cannot tell how this field differs from the separate mandatory
  rejection reason.
- **Current intended meaning:** The field stores a short summary of the exact communication or
  decision reported by the customer/counterparty. For example: `Buyer declined Revision 1 and asked
  NYSA to return with a lower price.` The `Reason` field should separately explain why, for example:
  `Purchase price is above the buyer's revised limit.`
- **Root cause confirmed locally:** One generic Offer-event form is reused for viewed,
  acknowledged, countered, accepted, rejected, expired and withdrawn events. Its summary label is
  always `What was confirmed?`, even when the event represents rejection, expiry or an NYSA
  withdrawal. The summary is optional in both the UI and API; when blank, the API inserts a generic
  event sentence. Only rejection and withdrawal currently require a reason.
- **Required event-sensitive wording:**
  - Viewed: `Viewing evidence / note`
  - Acknowledged: `Receipt acknowledgement details`
  - Countered: `Counteroffer summary`
  - Accepted: `Acceptance confirmation details`
  - Rejected: `Customer rejection response summary`
  - Expired: `Expiry note`
  - Withdrawn: `Withdrawal communication summary`
- **Rejection layout:** Show `Customer rejection response summary *` followed by a controlled
  `Primary rejection reason *` and optional `Additional reason details`. Suggested controlled
  reasons include price, deposit, payment terms, financing, conditions, timing, property
  suitability, customer no longer proceeding and other—with explanation mandatory for `other`.
- **Evidence rule:** Customer/counterparty outcomes should require a meaningful communication
  summary and occurred-at date/time. System-derived expiry should clearly identify the system event
  and must not imply customer communication. NYSA withdrawal must record the responsible actor and
  withdrawal communication/reason.
- **Acceptance requirement:** Change labels, help text and required fields dynamically by selected
  event; enforce the same event-specific contract in the API; preserve the exact Offer revision,
  counterparty, direction, actor and occurrence time; and verify that saving rejection immediately
  changes the card from `Sent — awaiting response` to `Rejected` with the recorded summary and
  reason visible in Negotiation history.

### UAT-014 — “Customer wants more options” has no visible return to Inventory Matching

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, sent Offer rejected because the customer wants to review
  more property options
- **Actual result:** The rejection can be recorded clearly, but the Negotiation workspace presents
  no obvious next action to return to Inventory selection and matching. The user reasonably sees a
  dead end even though the Opportunity and customer relationship remain active.
- **Hidden implementation confirmed locally:** Saving a rejected, expired or withdrawn Offer places
  the Opportunity in `offer_recovery`. A `Return to Matching` transition then becomes technically
  available, but it is buried inside the collapsed `More actions: correct or close Opportunity`
  control near the bottom of the overall Opportunity modal. The same-property recovery Offer is
  more visible than the common different-property pathway.
- **Required recovery choices:** Immediately after a terminal Offer outcome, show a prominent
  `What happens next?` recovery panel with:
  1. Renegotiate the same property through a new linked Offer
  2. Customer wants more options — return to Inventory Matching
  3. Review/change customer requirements before rematching
  4. Close the Opportunity as Lost
- **More-options behavior:** Preserve the rejected Offer, exact revision, Viewing, negotiation event
  and rejection reason immutably; transition the active Opportunity back to Matching; reopen the
  Inventory-selection workspace; allow additional eligible/governed candidates; and create a dated
  next action for the responsible Agent to prepare and present more options.
- **Requirement-impact control:** Ask whether the existing confirmed requirement remains unchanged,
  needs Agent review, or has a customer-confirmed change. Only a confirmed change creates a new
  requirement version. Requesting more options must not silently rewrite prior requirements or
  erase the earlier property's evidence.
- **Property disposition:** Record whether the rejected Offer means this specific property is no
  longer suitable, remains a fallback, or may be reconsidered on different commercial terms. This
  prevents the same property from being presented again without context while still supporting
  legitimate renegotiation.
- **Root cause:** The domain/API already supports the reasoned `Offer/Negotiation → Matching`
  transition and preserves terminal Offer recovery evidence. The defect is that the normal business
  pathway is represented as a hidden corrective stage action rather than being connected directly
  to the customer rejection outcome.
- **Local solution implemented in dev.146:** A prominent recovery panel records more-options versus
  requirement review, unchanged/review/customer-confirmed requirement impact, prior-property
  disposition, reason and dated governed action. A customer-confirmed replacement must be a current
  confirmed requirement on the same Lead. The terminal Offer remains immutable and an immutable
  recovery-action record and stage history are created.
- **Acceptance requirement:** From a saved rejected Offer, one visible action must return the user
  to Matching with a mandatory reason, requirement-impact decision and dated follow-up; history
  must show the exact terminal Offer and stage transition; the rejected Offer must remain unchanged;
  and tests must cover same-property renegotiation, more options with unchanged requirements, more
  options with a new requirement version, and Closed Lost.

### UAT-015 — Return to Matching submits its display label and fails validation

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, rejected Offer recovery
- **Action:** Open the hidden Opportunity stage action, select `Return to Matching`, enter the
  required explanation and submit
- **Actual result:** `Invalid opportunity stage`
- **Expected result:** Submit the canonical stage code `Matching`, preserve the rejected Offer and
  transition the active Opportunity back to Matching with the recorded recovery reason.
- **Root cause confirmed locally:** The shared `opts()` renderer creates stage options as
  `<option>Matching</option>` without an explicit `value`. The Opportunity UI later changes the
  option's text to the friendly label `Return to Matching`. For an option without a value
  attribute, changing its text also changes its submitted value. Form submission therefore sends
  `toStage = "Return to Matching"`; the API/domain correctly accepts only the canonical value
  `Matching` and returns `Invalid opportunity stage`.
- **Scope:** The same defect can affect other relabelled stage actions produced through this
  control, including `Return to Requirements` and `Close Opportunity as Lost`.
- **Required correction:** Render every governed option with an explicit stable value, for example
  `<option value="Matching">Return to Matching</option>`, while keeping the business label separate.
  The server must continue rejecting display labels and unknown values.
- **Acceptance requirement:** UI/network tests must assert the exact submitted canonical values for
  Matching, Requirements and Closed Lost; authenticated workflow tests must complete each allowed
  transition; and the history/audit record must retain the friendly business explanation without
  replacing the stable stage code.

### UAT-016 — Offer step remains “Completed” and Negotiation omits the exact pending Offer revision

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity `NYSA-OP-202608-000004`
- **Observed sequence:** A prior Offer was rejected. The user returned to the Offer workspace and
  created/sent `NYSA-OF-202608-000003` for the same Lead/Opportunity. The process navigation still
  labels Offer as `Completed`, while Negotiation says only that the exact current revision was sent
  and a response is pending.
- **Offer-versus-revision clarification:** The screenshot shows Offer
  `NYSA-OF-202608-000003` with `1 immutable revision`. It is technically a new linked recovery Offer
  containing Revision 1, not Revision 3 inside one Offer. The UI does not expose this distinction or
  the predecessor chain clearly, so the user reasonably interprets the third Offer reference as
  Revision 3.
- **Issue 1 — misleading aggregate status:** `Offer — Completed` does not communicate that the
  current active Offer is sent and awaiting a customer response. Historical sent/rejected Offers
  also continue to satisfy the completion calculation, so the aggregate can remain completed
  regardless of the active recovery Offer's actual state.
- **Root cause confirmed locally:** The flow sets Offer to Completed when *any* Offer is not a draft
  (`offers.some(status !== draft)`). It does not first identify the current active Offer or separate
  terminal historical Offers from the pending recovery Offer.
- **Required process status:** Derive the navigation state from the current active Offer lineage and
  show a specific business status such as `Draft`, `Revision awaiting send`, `Sent — awaiting
  response`, `Countered — action required`, `Accepted`, or `Terminal — recovery decision required`.
  Historical terminal Offers must not make the active Offer appear completed.
- **Issue 2 — pending evidence is not identified:** Negotiation must prominently state the exact
  item being followed up: Offer reference, revision number, amount/currency, sent date/time,
  recipient/counterparty, delivery channel and validity deadline. The current generic sentence does
  not tell an Agent which commercial terms are with the customer.
- **Required active banner example:** `Awaiting buyer response — NYSA-OF-202608-000003, Revision 1,
  AED [amount], sent [date/time], valid until [date/time].` Provide direct access to the exact PDF
  and distinguish it from rejected/superseded predecessor Offers.
- **Lineage requirement:** Display `Recovery Offer — follows rejected [predecessor reference]` and
  show the linked chain in a compact timeline. Within an active non-terminal Offer, subsequent
  commercial changes are numbered immutable revisions; after a terminal Offer, a new recovery Offer
  begins again at Revision 1 and retains the predecessor link.
- **Acceptance requirement:** Test an original Offer with multiple revisions, a rejected Offer plus
  a linked recovery Offer, and multiple historical terminal Offers. At every point exactly one
  active follow-up target must be identified; navigation and Negotiation must agree; and acceptance,
  Booking and Deal must bind to the exact accepted Offer and revision rather than merely the latest
  record displayed.

### UAT-017 — Long modal workspaces do not provide a clear, consistent Close control

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity Booking & reservation and other modal
  workspaces
- **Actual result:** A small muted `×` appears beside the top-right status badge, but it resembles
  part of the header/status decoration and is easily missed. On long screens it is also remote from
  the user's current scroll position. Users reasonably conclude that the workspace has no close
  button.
- **Scope clarification:** This requirement concerns closing/dismissing the screen or modal; it does
  not authorize closing an Opportunity, Booking, Deal or other governed business record.
- **Root cause confirmed locally:** Modal templates generally render only
  `<button class="close-x">×</button>`. The global style floats an unlabelled, backgroundless, muted
  symbol to the right. There is no visible `Close` text, consistent header container, sticky access
  on long workspaces or common footer action.
- **Required global pattern:** Every modal/detail workspace must have a clearly labelled
  `Close` control in a consistent top-right location, visually separated from status badges. Long
  modal workspaces must retain access through a sticky header and/or a secondary `Close workspace`
  button at the bottom. Nested dialogs must close only the topmost dialog.
- **Accessibility and safety:** Give the control an accessible name, visible keyboard focus and a
  sufficiently large target; support Escape where safe; return focus to the element that opened the
  modal; and warn before closing when unsaved entered data would be lost. Do not close a form while
  a save is in progress.
- **Acceptance requirement:** Apply and test the shared pattern across Customer, Lead,
  Qualification, Opportunity, Inventory, Viewing, Offer, Negotiation, Booking, Deal, Payout,
  Administration, Task and Leave dialogs at desktop and narrow widths. Automated checks must ensure
  each modal has an accessible dismiss action and that long-scroll and nested-dialog behavior is
  predictable.

### UAT-018 — Card text is too small and lacks a clear primary/secondary hierarchy

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, particularly Opportunity lifecycle cards for Inventory,
  Viewing, Offer, Negotiation, Booking and Deal
- **Actual result:** Important card information and supporting metadata frequently use approximately
  10–12px text. Status, ownership, timestamps, evidence and instructions visually compete with one
  another, while some essential content is too small to scan comfortably.
- **Code evidence confirmed locally:** The main stylesheet contains 76 declarations at 12.65px, 48
  at 11.5px and 15 at 10.35px, plus smaller 8.75–10px declarations. These sizes are reused across
  card labels, status pills, lifecycle steps, evidence notes and metadata.
- **Per-card hierarchy required:** Apply the hierarchy inside every operational card rather than
  increasing all text without distinction:
  - **Primary:** card title/customer/property, current status, amount, deadline and required next
    action at 14–16px with suitable weight and strong contrast
  - **Secondary:** owner, source, version, timestamp, supporting explanation and ordinary metadata
    at no less than 13px with readable contrast
  - **Section/field labels:** 13–14px, concise and consistently weighted; uppercase/letter spacing
    must not reduce legibility
  - **Action buttons:** at least 14px, with the primary action visually dominant and secondary
    actions quieter but still readable
  - **Long audit evidence:** summarize at 13px and place technical IDs/full hashes in expandable
    detail rather than shrinking them to fit
- **Importance rule:** Use type weight, color, spacing, grouping and position to distinguish priority;
  do not communicate “secondary” merely by making text tiny or low contrast. Critical warnings,
  SLA deadlines, pending customer actions and blockers must never be styled as secondary metadata.
- **Card structure:** Each card should answer in order: `What is this?`, `What is its current
  state?`, `What needs attention next and by when?`, then `What supporting evidence/history exists?`
  Dense technical evidence should not interrupt that operating sequence.
- **Responsive requirement:** Maintain the same hierarchy at narrow widths without shrinking below
  the minimums; allow wrapping and stacking, and prevent buttons/status pills from compressing the
  primary content into an unreadable column.
- **Acceptance requirement:** Review representative cards in every CRM module at normal browser
  zoom and narrow widths; verify computed font sizes, contrast, wrapping and focus states; and add
  visual regression checks proving that essential card text is at least 14px and secondary text at
  least 13px.

### UAT-019 — Existing Opportunity cannot be found from its displayed identity or beyond the first page

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity queue
- **Opportunity:** `NYSA-OP-202608-000004 · Sale`
- **Actual result:** Searching the exact displayed identity returns `0 matching · showing first 0`,
  even though the same Opportunity was accessible and actively used through Booking immediately
  beforehand.
- **UAT evidence clarification:** The user did actively use the Opportunity search and no record was
  returned. This is a reproduced search failure; it must not be explained away as the Opportunity
  merely falling outside the first page of the unfiltered queue.
- **Existence and scope confirmed by the connected register:** The consolidated Lead row displays
  `NYSA-OP-202608-000004`, its Deal status and its Deal next action. That row obtains the connected
  Opportunity through a scoped Opportunity query using the same permission policy as the
  Opportunity register. The Opportunity therefore exists and is within the viewing user's scope;
  its absence from the searched Opportunity queue is not evidence of deletion or a permission
  restriction.
- **Immediate search cause confirmed locally:** The UI displays a composite identity containing the
  reference and transaction type, but the API treats the entire entered text as one substring and
  compares it separately with Opportunity title, Opportunity reference and customer name. The
  literal search value `NYSA-OP-202608-000004 · Sale` cannot match the stored reference
  `NYSA-OP-202608-000004`, and transaction type is not included in the search expression.
- **Separate secondary queue-access gap confirmed locally:** Independently of the reproduced search
  failure, the register requests only 10 rows and displays
  `showing first`; there is no offset, next page, previous page or load-more control. An in-scope
  Opportunity outside the first 10 ordered rows therefore cannot be reached through the unfiltered
  queue. This pagination limitation did not cause or invalidate the reported failed-search result.
- **Scope caution:** This evidence does not indicate that the Opportunity was deleted. The corrected
  diagnostic must distinguish `not found`, `outside your permitted scope`, `outside the current
  filters` and `not on the loaded page` rather than showing one empty table for every case.
- **Required search behavior:** Accept the exact reference, the copied composite display label,
  customer, title, transaction type and reasonable token combinations. Normalize whitespace,
  separators and case; parse a leading canonical reference independently; and show active filter
  chips so users can see why a record is excluded.
- **Required register behavior:** Add real pagination or load-more with total count and current
  range, preserve filters/sort while opening and returning from a record, and provide direct open by
  exact Opportunity reference when the user has permission.
- **Acceptance requirement:** Test exact reference, composite `reference · transaction`, partial
  reference, customer/title, transaction type, wildcard and no-result searches; create more than 10
  in-scope Opportunities and prove every page is reachable; and verify that unauthorized records
  remain undiscoverable without leaking their existence.

### UAT-020 — Connected Lead button is visible but non-functional in the Opportunity workspace

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity `NYSA-OP-202608-000004`, Deal step
- **Actual result:** `Open connected Lead and full flow` is displayed, but selecting it does not open
  the connected Lead.
- **Navigation dead end confirmed in the UAT journey:** The consolidated Lead row is deliberately
  converted into an active-Opportunity row, so selecting the row opens the Opportunity rather than
  the Lead. Because the Opportunity's source-Lead control is inert, the user then has no working
  route from this active-record journey to the underlying Lead flow and history. Reassigning the
  Lead does not repair this navigation path.
- **Evidence from the screenshot and source:** The initial Opportunity markup renders that exact
  button label. Later in the successful enhancement path, the code changes it to
  `View source Lead history`, removes primary-button styling and attaches the click handler. The
  screenshot retains the initial label and also lacks the normal enhanced flow navigation in that
  position, showing that execution stopped before the handler was attached.
- **Structural root cause confirmed locally:** Essential connected-Lead navigation is bound late,
  only after the code constructs and binds matching, governed sharing, Offer, Booking, Deal and
  flow-navigation components. A runtime failure in any preceding enhancement can leave the initial
  button visible but inert, without a local error boundary or disabled-state explanation.
- **Exact triggering exception confirmed locally:** When an official Deal exists,
  `openOpportunityDetail` calls `bindDealWorkspace(root,{opportunityId,onChanged})`. That function
  does not receive or define `writable`, but passes `{dealId, writable}` to
  `bindDocumentComplianceWorkspace`. Because the document-compliance binder is loaded in the
  current build, JavaScript throws `ReferenceError: writable is not defined` at that point.
- **Why the screenshot is partial:** Base Opportunity markup, the representation banner, source
  evidence and reminder are constructed first. Offer, Booking and Deal HTML is then inserted, but
  the exception occurs during Deal binding before the six-step flow navigation is inserted and
  before the source-Lead button is renamed/bound. This exactly explains the retained
  `Open connected Lead and full flow` label and missing lifecycle navigation.
- **Operational impact:** The Deal close-lost form may exist farther down in raw inserted markup,
  but its submit handler is installed only after the failing line. It therefore cannot be treated as
  a safe working path. Booking controls are bound earlier, but using their release/cancel action
  after Deal creation has the separate integrity hazard documented in UAT-021.
- **Required correction:** Bind stable modal controls—Close, connected Lead, customer and source
  record navigation—immediately after base markup is mounted, before optional module rendering.
  Isolate each lifecycle module with an error boundary so a failure in Deal/Booking/Offer content
  cannot disable global navigation. If a linked record cannot be opened, show a specific visible
  error rather than silently ignoring the click.
- **Navigation behavior:** Opening the connected Lead must use the stored `lead_id`, enforce normal
  read scope, identify the Opportunity as the active pursuit and provide a reliable route back to
  the same Opportunity and selected lifecycle step. It must not imply that the historical Lead
  stage is the current transaction stage.
- **Acceptance requirement:** Test the link for every Opportunity stage and role, including records
  with long histories and optional-module failures; prove one module's render exception does not
  disable global controls; verify keyboard activation/focus return; and ensure unauthorized users
  receive a clear scope error without private Lead disclosure.

### UAT-021 — Withdrawing an accepted Offer after Deal creation can leave contradictory governed records

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Opportunity `NYSA-OP-202608-000004`; the current
  business position is that the Offer was accepted, Booking/reservation is completed and the Deal
  is in progress. The user now needs to withdraw the accepted terms and issue a replacement Offer.
- **Current UI gap:** The overall workflow state is not clearly visible, and the accepted Offer
  still permits `NYSA withdrew the offer`. The UI does not explain the effect on the active Booking,
  reserved Inventory or governed Deal, nor provide a safe `Withdraw and replace` pathway.
- **Unsafe behavior confirmed locally:** Recording `withdrawn` on an accepted Offer calls the
  Offer-owned reservation release routine. That routine cancels an active reserved Booking and
  restores Inventory. The same transaction then moves the Opportunity back to `Offer` and opens
  Offer recovery. It does not check for, cancel, void or supersede a Deal already created from that
  Booking and exact accepted Offer revision. The existing Deal and its immutable links therefore
  remain while their Booking is cancelled and their Opportunity is moved backwards.
- **The direct Booking control has the same post-Deal hazard:** `Release reservation` and
  `Cancel reservation` remain visible to an authorized Manager on a reserved Booking even after a
  Deal has been created. Their route checks the Booking and Inventory status but does not check for
  a dependent Deal. It releases/restores Inventory and moves the Opportunity to Negotiation while
  leaving the Deal active. These controls must be blocked once a Deal exists or routed through the
  atomic Deal lifecycle action.
- **Immediate UAT instruction:** Do not use Offer withdrawal on this Opportunity in the current
  build. It risks creating an internally contradictory Deal/Booking/Opportunity state. Withdrawal
  before Booking may be tested on a separate synthetic Opportunity, but it does not validate the
  post-Deal replacement case.
- **Safe existing abandonment path:** If the transaction truly will not complete, an authorized
  managed-team Manager or Director must use Deal & completion → `Transaction will not complete` →
  `Close Deal as Lost and release inventory`. That governed endpoint closes the Deal and
  Opportunity, cancels the Booking and restores the prior Inventory status in one transaction.
  This is an abandonment path, not an accepted-Offer replacement path. For the affected CRM Test
  record, UAT-020 currently prevents that Deal action from being safely bound and used; do not fall
  back to the earlier-bound Booking cancellation control.
- **Required governed action:** Add an explicit `Withdraw accepted Offer and replace terms` action.
  Before confirmation, show the exact accepted Offer/revision and every dependent Booking,
  Inventory reservation and Deal. Require a reason and replacement intent. Authorization must
  follow the maintained Deal-change policy rather than relying merely on access to the Offer card.
- **Atomic lifecycle rule:** When no Deal exists, the action may cancel the Offer-owned reservation,
  restore the recorded prior Inventory state, retain all history and open a linked replacement
  Offer. When an active Deal exists, the system must either (a) block Offer withdrawal until the
  Deal is explicitly cancelled/voided under a governed reason, or (b) execute one atomic
  supersession transaction that changes the Deal, Booking, reservation, Opportunity and Offer
  lineage together. A partial rollback is never permitted.
- **Replacement semantics:** Preserve the original accepted Offer and its accepted revision as
  immutable historical evidence. Create a new linked replacement Offer at Revision 1 with a clear
  `replaces accepted Offer ...` relationship. The replacement must pass normal drafting, exact
  document, send, customer-response, acceptance, reservation and Deal controls; it must not silently
  edit the accepted commercial terms or reuse the prior acceptance.
- **Inventory safety:** Inventory must not become generally available while an active Deal still
  governs it. If a replacement is being prepared for the same property, the system must state
  whether the existing reservation remains protected during replacement or is intentionally
  released, and apply that decision consistently.
- **Visibility requirement:** The Opportunity header must prominently show the authoritative state,
  for example `Deal in progress — accepted Offer NYSA-OF-... Revision 1`, and the replacement screen
  must show the complete dependency chain and resulting state before confirmation.
- **Local solution implemented in dev.146:** Independent accepted-Offer withdrawal and Booking
  release remain blocked after Deal creation. The Deal workspace exposes an authorized atomic
  replacement action. It locks Deal, Booking, Opportunity and Offer; closes the prior Deal lost;
  cancels the Booking; restores the recorded safe Inventory status; withdraws the accepted Offer;
  creates a predecessor-linked replacement Offer with immutable generated Revision 1; returns the
  Opportunity to Offer; and writes immutable replacement lineage and audit history in one database
  transaction. Generated document storage is removed if the transaction fails.
- **Acceptance requirement:** Test withdrawal/replacement (1) before Booking, (2) with an active
  Booking but no Deal, (3) with a draft/in-progress Deal, and (4) after authoritative Deal closure.
  Inject a failure at each write boundary and prove the transaction rolls back completely. Assert
  that exactly one authoritative active lineage exists, no active Deal references a cancelled
  Booking, no Inventory is released under an active Deal, and all original evidence remains
  auditable.

### UAT-022 — Historical Lead SLA recycles ownership after the Opportunity has reached Deal

- **Status:** Corrected locally in dev.146; pending CRM Test deployment/UAT
- **Observed in:** CRM Test `2.1.0-dev.145`, Lead `NYSA-LD-202608-000028` and active Opportunity
  `NYSA-OP-202608-000004`, currently at Deal. The Opportunity had already been assigned to ajitr,
  but the record genuinely returned to the Manager assignment queue and the consolidated row showed
  `Dubai Secondary Sales Team` and `reassignment due`. The user then manually reassigned it to ajitr
  through the Manager queue.
- **What happened:** The historical Lead assignment SLA continued to run after creation of the
  active Opportunity. When the Lead still appeared to have an expired acceptance or first-contact
  deadline, opening the assignment queue invoked the SLA recycler. It timed out the Lead assignment,
  cleared the Lead's `assigned_to`, created a new team-queued assignment and set the Lead to
  `reassignment_due`. This did not establish that the active Opportunity or Deal was unowned.
- **Actual state change—not display only:** This was a real Lead assignment recycle, not merely a
  misleading label. The Lead became available for assignment in the Manager queue and required a
  new assignment action. The later Owner-column contradiction is an additional display/data-source
  defect layered on top of that improper lifecycle mutation.
- **Manual UAT recovery performed:** The user reassigned the queued Lead to ajitr through the Manager
  queue. That queue action updates the Lead assignment and creates a new offered assignment with new
  acceptance and first-contact deadlines. Its implementation does not update the existing
  Opportunity owner, so the system can now hold separate Lead and Opportunity assignment histories
  even though both happen to identify ajitr again.
- **Display defect:** The consolidated Lead register correctly shows the active Opportunity as the
  current pursuit record, but its Owner column still reads `leads.assigned_to`,
  `leads.assigned_team_id` and `leads.assignment_status`. It does not select or display the active
  Opportunity's `owner_id`. It therefore presents a stale historical Lead routing state as though it
  were the owner of the Deal-stage pursuit.
- **Lifecycle defect:** The SLA recycler excludes only Leads whose historical stage is `Won` or
  `Lost`; it does not exclude a Lead that already has an active Opportunity. Consequently, merely
  loading the assignment queue can mutate a Lead underlying an Opportunity at Matching, Offer,
  Booking or Deal.
- **Required ownership rule:** Lead assignment and its acceptance/first-contact SLA govern only the
  pre-Opportunity Lead. Once an Opportunity is created, the Opportunity owner is authoritative for
  the active pursuit and must remain ajitr unless an explicit, authorized Opportunity reassignment
  occurs. A stale Lead SLA must never reassign, unassign or imply reassignment of the Opportunity,
  Booking or Deal.
- **Required history behavior:** Retain the Lead assignment history as historical evidence and mark
  its operating SLA completed/superseded when the Opportunity is created. Do not erase or rewrite
  the previous assignment. If an Opportunity reassignment is later needed, use a separate governed
  Opportunity ownership action with reason, effective time and audit history.
- **Required UI behavior:** For a row backed by an active Opportunity, show the Opportunity owner and
  Opportunity ownership status. Historical Lead routing may appear only inside labelled source
  history. If legacy data is inconsistent, show a specific reconciliation warning rather than
  `reassignment due` as the current owner state.
- **Local solution implemented in dev.146:** Opportunity creation marks the current Lead assignment's
  operating SLA ended/superseded with the exact Opportunity reference and audit event. Both recycler
  implementations require an active unsuperseded SLA and independently exclude active
  Opportunities. The consolidated Lead query now projects the active Opportunity owner/team as the
  authoritative pursuit ownership while retaining Lead routing history.
- **Acceptance requirement:** Create an assigned Lead, accept it, create an Opportunity and progress
  through every lifecycle stage while advancing beyond the old Lead SLA deadlines. Opening the
  assignment queue must not mutate the Lead or active pursuit. Assert that the consolidated row,
  Opportunity register, task queue, Booking and Deal all show the same authoritative Opportunity
  owner, and that only an explicit governed Opportunity reassignment can change it.

### UAT-023 — Sales Agent self-created Lead incorrectly says it entered the Assignment Queue

- **Status:** Corrected locally after dev.148 deployment; pending inclusion in the next combined CRM
  Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, Lead `NYSA-LD-202608-000029`. The Lead register showed
  the Lead assigned to its Sales Agent creator, while the Manager Assignment Queue correctly did not
  include it.
- **RCA:** Manual creation by a Sales Agent intentionally self-assigns and immediately accepts the
  Lead. The API returned `assignmentStatus='assigned'` and the creator as `assignedTo`, but both UI
  success branches displayed a hard-coded statement that every new Lead entered the assignment
  queue. The capture form also always previewed an unassigned outcome.
- **Data and queue consistency:** No assignment data was missing. The Manager queue correctly limits
  itself to `unassigned` and `reassignment_due` Leads. Adding this assigned Lead to that queue would
  create a governance defect; the presentation must instead report the committed outcome.
- **Local solution:** The capture form now tells a Sales Agent, `The Lead is self-assigned to you`,
  and explains that it is accepted immediately and will not enter the Manager pending queue. After creation, both new- and
  existing-Customer paths derive the message from the API response: assigned Leads report immediate
  assignment/acceptance; unassigned Leads report entry into the governed assignment queue.
- **Regression boundary:** Website intake, investor profiles, structured requirements, Current CRM
  import, assignment queue filtering and assignment history were not changed.
- **Acceptance requirement:** Create one manual Lead as a Sales Agent and one as an eligible
  non-Sales-Agent role. Confirm the form preview, success message, Lead register, assignment history,
  Agent work and Manager queue all describe the same authoritative state.

### UAT-024 — Customer activity direction exposes internal terminology

- **Status:** Corrected locally after dev.148 deployment; pending inclusion in the next combined CRM
  Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, Lead customer-discussion activity form.
- **RCA:** The form rendered the canonical stored values `Inbound` and `Outbound` as its visible
  labels and used `Not applicable` as the empty choice. Those terms describe system flow rather
  than the staff member's interaction with the Customer.
- **Local solution:** The visible choices are now `To Customer` and `From Customer`, with `Select
  direction` as the empty prompt. Their submitted values remain `Outbound` and `Inbound`
  respectively, so API validation, reporting, historical records and integrations are unchanged.
- **Acceptance requirement:** Record one outbound and one inbound Call/Email/WhatsApp/Meeting.
  Confirm the form shows the customer-centred wording and the API retains the canonical direction
  values without changing activity governance.

### UAT-025 — Call duration input is unnecessarily recorded in seconds

- **Status:** Corrected locally after dev.148 deployment; pending inclusion in the next combined CRM
  Test candidate and UAT
- **Observed in:** Lead customer-discussion activity form. The visible field is labelled `Call
  duration (seconds)` and requires staff to enter an unnecessarily precise unit for normal CRM use.
- **RCA:** The UI exposes the database/API storage unit (`durationSeconds`) directly instead of
  translating it into the staff-facing business unit.
- **Required behavior:** Display and accept Call duration in whole minutes. Convert the entered
  minutes to canonical seconds only at the API boundary so existing stored data, historical records,
  validation and integrations remain compatible. Customer-facing reports and summaries should also
  present duration in minutes consistently.
- **Acceptance requirement:** Record Call durations in minutes, confirm the API retains the exact
  equivalent integer seconds, confirm historical second-based records remain readable, and verify
  that activity history, dashboard totals and Call reports consistently display minutes.
- **Local solution:** The interaction form accepts whole `durationMinutes`; the activity API converts
  it to canonical `duration_seconds` while retaining backward compatibility for existing API
  clients and historical rows. Lead activity history, dashboard totals and Call reports now format
  the canonical value as minutes.

### UAT-026 — Activity outcome and next action are captured as duplicate free text

- **Status:** Corrected locally after explicit v2 design approval; pending inclusion in the next
  combined CRM Test candidate and UAT
- **Observed in:** Lead customer-discussion activity form. `Outcome and next-action instructions` is
  a free-text field even though the form already provides `Discussion / attempt details` for staff
  comments and a dated next-action field.
- **RCA:** The activity interface mixes governed workflow decisions with narrative notes. The free-
  text outcome field cannot reliably drive a standard pathway, reporting, task creation or the next
  governed Lead/Opportunity action, and it duplicates the purpose of the discussion text box.
- **Required behavior:** Keep narrative comments in `Discussion / attempt details`. Replace the
  free-text outcome/next-instruction control with approved controlled outcome and next-action choices
  appropriate to the selected activity type and contact result. The chosen pathway must determine
  any required due date, follow-up Task and permitted lifecycle action without parsing free text.
  Existing activity history must remain readable and unchanged.
- **Approved design:** Narrative remains in `Discussion details / comments`. Completed customer
  interactions use a channel-specific controlled outcome plus one controlled next-action code and
  mandatory deadline. Historical free text remains unchanged. Notes and Tasks use separate
  authoritative pathways rather than masquerading as customer interaction.
- **Acceptance requirement:** For Call, Email, WhatsApp and Meeting, verify that staff can record
  narrative comments once, select an approved outcome and next action, receive the correct required
  date/Task behavior, and report consistently on the stored controlled values. Verify non-customer
  activities retain an appropriate workflow and all historical records remain intact.
- **Local solution:** Added the approved three-pathway launcher (`Completed interaction`, `Internal
  note`, `Planned task`). Tasks call `/crm/leads/:id/tasks`; Notes append only to the Lead timeline;
  interactions store `contact_outcome_code`, `next_action_code` and `next_action_due_at`. No
  historical row is reclassified and no automatic qualification, preferred-channel or no-show
  inference was introduced.

### UAT-027 — Optional document-version text causes an unhandled activity-save failure

- **Status:** Corrected locally after dev.148 deployment; pending inclusion in the next combined CRM
  Test candidate and UAT
- **Observed in:** A completed Call activity was submitted with `not yet` in `Exact document version
  ID`. CRM Test returned only `Internal server error`, and the timeline correctly remained empty.
- **RCA:** `document_version_id` is a PostgreSQL UUID column. The activity endpoint passes any supplied
  string into the insert and validates the identifier only for the special `Offer letter sent`
  subject. Non-UUID text therefore reaches PostgreSQL, fails its UUID cast and is exposed as a
  generic 500 instead of a controlled field validation error. The optional field's label/help also
  does not make its restricted purpose sufficiently clear.
- **Safe UAT workaround:** Leave `Exact document version ID` completely blank for ordinary Calls,
  Emails, WhatsApp, Meetings, Notes and Tasks. Supply it only when recording an Offer letter that was
  actually sent, using the exact immutable sent document-version identifier selected from governed
  document history. Do not enter placeholders such as `not yet`, `N/A` or a filename.
- **Local solution:** The API now validates UUID syntax before any database query, verifies that a
  syntactically valid identifier resolves to a governed document version, and continues to require
  an immutable `sent` version for `Offer letter sent`. Invalid placeholders and unknown identifiers
  return explicit 400-level field errors before the activity transaction. The redesigned form now
  provides a controlled selector containing only Customer/Lead-linked immutable sent versions.
- **Acceptance requirement:** Confirm an ordinary activity saves with no document version; invalid
  text returns an explicit validation message without a database exception; an unknown UUID is
  rejected; and `Offer letter sent` accepts only the exact immutable version whose status is `sent`.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-028 — Ordinary outbound customer discussion is blocked as marketing outreach

- **Status:** Corrected locally after dev.148 deployment; pending inclusion in the next combined CRM
  Test candidate and UAT
- **Observed in:** After clearing the invalid optional document-version text from the Call activity,
  changing the direction to the factually correct `Outbound` still prevented the activity from being
  saved. The discussion concerned the Customer's requirements, available options, budget and market
  conditions; no document was sent.
- **RCA:** Every outbound Call, Email or WhatsApp was subjected to an executed
  `marketing_agreements` channel check. That incorrectly applied property-listing marketing
  authorization to ordinary Lead/Customer discussions and blocked the completed outbound Call after
  the unrelated document-version placeholder was cleared.
- **Temporary UAT workaround:** Record a `Note` titled `Temporary UAT record — outbound customer call`
  with the actual discussion, outcome and dated follow-up. Do not falsely record an outbound Call as
  `Inbound`. This preserves narrative evidence and the next-action date but is not a functional fix:
  it will not count as governed first contact, populate Call reporting or advance a New Lead to
  Contacted.
- **Authoritative business rule:** Marketing authorization is required only for property-listing and
  publication governance. It is not a prerequisite for recording outbound Lead/Customer activity.
- **Local solution:** The customer-activity endpoint no longer queries or requires a marketing
  agreement for outbound Calls, Emails, WhatsApp or Meetings. It still checks the Customer's
  do-not-contact restriction for every outbound customer-discussion type. Direction, controlled
  outcome, meaningful details and a dated next action remain required; a document is not required
  unless the activity specifically records an Offer letter as sent.
- **Acceptance requirement:** Test inbound and outbound Call, Email, WhatsApp and Meeting activity
  with and without a property-listing marketing authorization. Confirm activity recording is
  independent of listing authorization, do-not-contact always fails closed, ordinary calls require
  no document, and successful contact counts correctly in first-contact, stage and Call reporting.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-029 — Activity form mixes completed contact, internal notes and planned work

- **Status:** Corrected locally after explicit v2 design approval; pending inclusion in the next
  combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`. Selecting `Task` still displayed Call duration,
  Direction and document fields, while the single form posted every type to the activity endpoint.
- **RCA:** One static form represented three different business records. Conditional validation had
  been added over time, but field visibility and the authoritative persistence path were not split.
- **Local solution:** The redesigned workspace has three explicit pathways. Completed interaction
  records immutable contact evidence and lifecycle snapshots; Internal note records narrative only;
  Planned task creates one authoritative Task visible in the assignee Task Queue. Post-save
  enrichment opens existing governed Customer, requirement or qualification editors and does not
  change those records automatically.
- **Opportunity snapshot scope:** Migration `096_activity_opportunity_stage_snapshot.sql` is a
  separate lifecycle-evidence increment. It stores the active Opportunity ID and stage only for new
  activities; historical rows remain null and are never guessed. Form semantics and controlled
  next work are isolated in migration `097_activity_enrichment_pathways.sql`.
- **Document governance:** The backend no longer parses Subject text. `offer_letter_sent` is a
  structured outcome valid only for outbound Email/WhatsApp and requires the exact linked immutable
  sent version.
- **Acceptance requirement:** Exercise all three pathways, every interaction channel and outcome,
  sent-document evidence, task ownership/queue visibility, Meeting start versus next-action due,
  lifecycle snapshots, and each post-save governed-editor handoff.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-030 — Opportunity creation repeats the Agent's decision with a mandatory confirmation and explanation

- **Status:** Corrected locally; pending inclusion in the next combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`. After deliberately selecting `Create opportunity`, the
  assigned Agent was required to confirm again that NYSA had a genuine service opportunity and to
  enter a mandatory free-text explanation.
- **RCA:** The Release 2 foundation added explicit service-opportunity evidence to guard against
  automatic Lead conversion. The mature flow now already requires an assigned qualified Lead,
  current structured requirements, an explicit Opportunity-creation submission, the representation
  controls and a governed first action. The extra checkbox repeated the same decision, while its
  explanation was used only as generic stage-history/audit text and did not determine eligibility.
- **Local solution:** Removed the checkbox, explanation field and corresponding backend validation.
  Submitting `Create opportunity` is now the explicit decision to pursue the Lead. The audit record
  stores the controlled creation basis `explicit_agent_creation_from_qualified_lead`, and stage
  history records that the Opportunity was explicitly created from a qualified Lead. Qualification,
  requirement, ownership, mandate, disclosure, Inventory and next-action controls remain unchanged.
- **Acceptance requirement:** From an eligible qualified Lead, create an Opportunity without an
  additional service confirmation or explanation. Confirm an ineligible Lead remains blocked,
  representation-specific controls still apply and immutable creation audit/history is retained.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-031 — Newly created Opportunity is not immediately visible in the Opportunity pipeline

- **Status:** Corrected locally; pending inclusion in the next combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`. An Opportunity could be created without selecting
  Inventory and its detail opened successfully, but closing the detail returned to the Lead workspace.
  The separate Opportunity pipeline retained earlier filters, due-date sorting and pagination, so the
  newly created record was not reliably visible as independent active work.
- **RCA:** The create-success handler removed the Lead dialogs and opened Opportunity detail without
  changing the underlying workspace. It also left the Opportunity register's previous client-side
  filter and page state intact. This was a navigation/discoverability defect, not a persistence or
  Inventory-eligibility defect: the API already includes `Requirements` Opportunities with no selected
  Inventory.
- **Local solution:** Successful creation now clears stale Opportunity filters, selects `Newest first`
  on page 1, establishes the Opportunity pipeline as the underlying workspace, and then opens the new
  Opportunity detail. Closing the detail therefore reveals the separate register with the new record
  visible; Inventory may still be selected later through the governed matching flow.
- **Acceptance requirement:** Create an Opportunity both with and without Starting Inventory while
  prior Opportunity filters and pages are active. Confirm the detail opens, Close reveals the
  Opportunity pipeline, the new reference appears on page 1, exact search finds it, and scoped users
  cannot see Opportunities outside their authority.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-032 — Inventory Developer field bypasses the maintained Developer Master

- **Status:** Corrected locally; pending inclusion in the next combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, Inventory create/edit. `Developer` was an unrestricted
  text input even though governed Developer organizations are maintained in the Company master.
- **RCA:** Release 4 added governed organization versions and optional Inventory provenance, but the
  original Inventory create/edit field remained legacy text. The two interfaces were never joined at
  the point where the Developer is selected.
- **Maintenance location:** Open `CRM → Lead pipeline → Companies`. Create or open the Company with
  Developer category/role, then use `Governance` to create and independently activate its governed
  Developer version. Only active versions are eligible for new Inventory selection.
- **Local solution:** Replaced the Inventory free-text field with a dropdown sourced from active
  governed Developer versions. New selections derive the displayed Developer name from the exact
  immutable version and append the corresponding Inventory organization-link event in the same
  transaction. Existing legacy text remains visibly identified and preserved until the user
  deliberately replaces it with a maintained Developer; clearing an existing governed selection
  appends an unlink event rather than rewriting history.
- **Acceptance requirement:** Verify the dropdown contains active Developer versions only; excludes
  pending, rejected, superseded, retired and non-Developer organizations; saves the selected display
  name and exact version linkage; preserves untouched legacy values; and records replacements and
  removals as append-only history.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-033 — Developer Master has no brokerage-arrangement or property-listing NOC register

- **Status:** Corrected locally; pending inclusion in the combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, `CRM → Companies → Governance`. The governed Developer
  version maintains organization identity and verification evidence, but provides no dedicated option
  for a Developer Brokerage Arrangement or an NOC authorizing NYSA to list an exact property.
- **RCA:** Partner Organization governance was intentionally limited to organization identity and
  immutable verification. The earlier document catalogue left `listing_noc` undefined because an
  organization-level arrangement and a property-specific listing authority are different controls.
- **Required solution:** Add two separate governed evidence registers inside the Developer Company:
  1. `Developer Brokerage Arrangement` — Company/Developer-level commercial relationship evidence,
     with exact immutable document version, reference, effective date, optional expiry, scope and status.
  2. `Property Listing NOC` — property-specific authority issued by that Developer, linked to the exact
     governed Developer version and exact Internal Inventory record, with immutable document version,
     NOC reference, issue date, optional expiry and status.
  Neither record may silently create or modify a Customer, Inventory owner, mandate, portal publication
  or marketing authorization. Expired, rejected, superseded or mismatched evidence must remain history
  and must not represent current authority.
- **Local solution:** Added independent immutable registers for the Developer Brokerage Arrangement and
  the property-specific Listing NOC. Each upload is tied to the exact governed Developer version and
  immutable PDF version; NOCs are also tied to the exact Internal Inventory. A different Administrator
  must activate or reject the evidence, and prior active versions become superseded without deletion.
  Current date, exact-version linkage and evidence status are checked server-side.
- **Authority-gate decision:** These documents do not block Internal Inventory creation, maintenance or
  Manager verification. When the Inventory has a governed Developer, both a current active Developer
  Brokerage Arrangement and current active property-specific Listing NOC are mandatory before external
  listing preparation can be created/revised or advanced to submitted, approved or published. This is
  an external-listing/publication control only.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-034 — Inventory source field is ambiguous about whether it requires the owner

- **Status:** Corrected locally; pending inclusion in the next combined CRM Test candidate and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, Inventory creation. `Inventory source contact / reference`
  used one placeholder containing owner, Developer, co-broker, agency and source file, without clearly
  saying whether the user was expected to identify the owner.
- **RCA:** The field stores original source provenance in the legacy `contact` value. Its label used
  contact terminology while its value could be either a person, organization, internal referral or
  source-file reference. Owner identity and listing authority are separate post-Draft records.
- **Local solution:** Relabelled the field `Who or what supplied this property to NYSA?` and explains
  that the owner is entered only when the owner contacted NYSA directly. The help text distinguishes
  source identification from proof of ownership and authorization to list, and directs the user to add
  the actual owner and authority/agreement evidence after saving the Draft. Storage and workflow are
  unchanged.
- **Acceptance requirement:** Create Inventory received directly from an owner, a Developer, an
  agency/co-broker, an internal referral and a source file. Confirm the wording is unambiguous and that
  none of these source values is treated as owner or listing-authority evidence.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.148`.

### UAT-035 — Significant records are constrained inside dismissible modal windows

- **Status:** Failed owner UAT in cumulative CRM Test `2.1.0-dev.152`; correction required before
  testing continues
- **Observed in:** CRM Test `2.1.0-dev.148`. Inventory, Customer, Lead and Opportunity records use the
  same popup treatment as short confirmation dialogs. Long forms are narrow, cannot be bookmarked, and
  their relationship to browser Back and unsaved changes is unclear.
- **RCA:** The original UI used one reusable `overlay()` primitive for both quick detours and full record
  destinations. The primitive had no record URL, navigation state or dirty-form contract.
- **Local solution:** Existing Inventory, Customer, Lead and Opportunity records now open as full-width,
  route-backed workspaces in the main application surface. Their URL records the workspace and record ID;
  browser Back returns to the preserved list, including its filters and scroll position. Escape and
  backdrop clicks do not close these workspaces. A changed form requires explicit save or discard before
  leaving. Customer creation, Lead capture and Opportunity creation use the same workspace surface rather
  than a dismissible popup. Inventory creation/editing is a workspace with explicit `Save as draft` / `Save property
  facts`; after saving it stays in the Inventory record so the owner/represented party can be captured
  before Manager verification. The detail flow is visibly ordered: property facts, owner/internal-use
  authority, verification, then optional external publication. Repeated draft edit/media controls were
  consolidated.
- **dev.152 failure evidence:** The route-backed shell and Back/dirty-state behavior were deployed, but
  Inventory creation/editing still rendered the legacy monolithic field grid. The promised three-stage
  journey was present only as explanatory text and post-render labels on parts of the saved record; it
  was not a guided workspace. The sticky Save/Cancel footer also overlapped lower form content. This is
  a partial implementation and must not be treated as acceptance of UAT-035.
- **Test-gap RCA:** The dev.151 automated check searched source text for workspace and step phrases. It
  did not render the form, assert visible grouping/order, exercise Draft → owner/authority → verification,
  or verify that the sticky action bar left every field visible. The passing suite therefore proved only
  the shell markers, not the promised user journey.
- **Acceptance requirement:** Verify direct URLs and browser Back for all four record types; preserved
  list/filter/scroll context; no Escape/backdrop close; dirty-form warning; explicit save-as-draft and
  save semantics; and owner/authority appearing before verification in Inventory.
- **Deployment state:** Partial implementation deployed in cumulative `2.1.0-dev.152`; owner UAT failed.
  Do not continue this Inventory lane until a corrected cumulative candidate is visually and functionally
  validated before deployment.

### UAT-036 — Opportunity cannot maintain Inventory after creation and eligibility detail collapses into an unusable column

- **Status:** Corrected locally in cumulative `2.1.0-dev.152`; pending CRM Test deployment and UAT
- **Observed in:** CRM Test `2.1.0-dev.148`, on an Opportunity created without Starting Inventory.
  No attach control was available once the Opportunity progressed beyond Matching, a removed property
  could never be re-added, and the expanded exclusion evidence rendered as a very narrow activity-row
  column that made a normal Inventory population unsustainably long.
- **RCA:** The frontend fetched and displayed attach controls only in `Requirements` and `Matching`, and
  the API enforced the same stage restriction. The matching query excluded every historical
  `property_matches` row, including rejected/removed rows protected by the Opportunity/Inventory unique
  key, making re-add impossible. The exclusion list also reused the generic three-column activity row
  rather than a full-width Inventory evidence layout.
- **Local solution:** Eligible Inventory can now be attached, removed from the active selection and
  re-added during Requirements, Matching, Viewing, Offer and Negotiation. Removal is a governed status
  decision with mandatory reason; immutable match and downstream Viewing/Offer evidence remains. A
  removed row becomes eligible for re-add only after the normal server-side approval, verification,
  availability, reservation and seven-day confirmation checks pass again. The active selection locks
  when an Offer is accepted, an active Booking exists or a governed Deal exists. Offer acceptance also
  fails closed if its exact property was removed. Closed Opportunities remain non-maintainable.
- **Presentation solution:** The Inventory summary distinguishes eligible-to-attach, currently attached
  and total reviewed counts. Exclusion reasons are compact chips; every excluded Inventory record is
  available in a collapsed, full-width responsive grid with an internal scroll region instead of the
  narrow activity column. The API no longer silently caps the eligibility evidence at 50/200 rows.
- **Acceptance requirement:** Create an Opportunity without Inventory and attach eligible Inventory in
  each pre-booking stage; remove with reason; confirm it disappears from the active count but remains in
  removed history; re-add it after current eligibility is revalidated; confirm ineligible Inventory
  remains blocked; confirm exact Offer acceptance is blocked while its property is removed; and confirm
  all add/remove operations lock after acceptance, Booking or Deal. Expand the exclusion evidence with
  the full CRM Test Inventory population and verify readable full-width cards with no hidden records.
- **Deployment state:** Deployed in cumulative `2.1.0-dev.152`; pending focused owner UAT after UAT-035
  is corrected.

### UAT-037 — Inventory linkage lifecycle, shared assignment and reservation exclusivity are not explicit

- **Status:** Corrected locally in `2.1.0-dev.154`; pending CRM Test deployment and owner UAT
- **Observed in:** CRM Test `2.1.0-dev.152` and the UAT-036 redesign review. The existing
  `property_matches` linkage records which Inventory was considered by an Opportunity, but the UI and
  stored Inventory status do not distinguish shared assignment from exclusive reservation, do not show
  the seven-day assignment lifecycle, and the legacy accepted-Offer replacement path closes the Deal.
- **RCA:** Release 2 treated Inventory selection as a shortlist decision and used `Available` until
  Booking. It therefore had no explicit `Assigned` master state or assignment expiry. Accepted-Offer
  replacement was designed as Deal termination and recovery rather than maintaining one commercial
  Deal identity across a replacement Offer and Booking.
- **Confirmed business contract:**
  1. Inventory approval/verification is independent from Opportunity or Deal linkage.
     `property_matches` remains discovery and suitability evidence; it is not an assignment and has no
     expiry or Inventory-status effect.
  2. A separate immutable `inventory_assignments` record formalizes each Opportunity-to-Inventory
     assignment. It has its own ID, seven-day default period, state, reason, actor/event history and an
     optional predecessor lineage. An ended assignment is never reopened; reattachment creates a new row.
  3. Effective non-terminal Inventory status is computed when read: terminal `Sold`, `Rented` or
     administrative `Closed` wins; an active unexpired Booking is `Reserved`; otherwise any active
     unexpired assignment is `Assigned`; otherwise it is `Available`. No cron, background sweep or idle
     worker is introduced. `Under offer` is retired.
  4. Assignment and reservation expiry default to exactly seven days. The reservation timestamps are
     generated by the server, not accepted from the browser. Only the responsible team Manager may change
     either expiry, with a reason and immutable before/after evidence.
  5. Available, Assigned and Reserved Inventory may receive another shared assignment. Only Sold, Rented
     or administratively Closed Inventory blocks assignment. Before an Offer exists, the Opportunity
     owner or responsible team Manager may maintain assignments. After an Offer exists, authority continues
     to follow the current servicing agent (Opportunity owner) or responsible team Manager; it is not locked
     to the original Offer creator.
  6. Reservation is exclusive and first-valid-transaction wins under a lock. Customer acceptance and the
     exact seven-day reservation are one atomic transaction: the winner records both; a competing attempt
     records neither. Other assignments remain visible and may continue through Offer preparation, but
     acceptance/reservation cannot complete while another current reservation owns the Inventory.
  7. Releasing, cancelling or expiring a reservation ends its winning assignment and Deal linkage. The
     effective Inventory status becomes Assigned if another active unexpired assignment remains, otherwise
     Available. A reserved assignment cannot be delinked or swapped through a shortcut.
  8. Manager delink of a non-reserved assignment requires a reason and atomically withdraws any mutable
     Draft/Sent Offer for that exact Inventory. Accepted Offers use the controlled release/expiry path.
  9. Selecting different Inventory creates a new Offer ID at Revision 1 with a predecessor reference.
     Servicing-agent reassignment does not change the external Offer: Offer ID, status, terms, revisions,
     customer communication, Inventory, Booking, Deal and Opportunity remain unchanged. `offers.created_by`
     remains the immutable original author; `offers.owner_id` follows the current servicing agent. The former
     agent loses write authority and the new servicing agent may continue the existing Offer. A separate
     customer relationship-manager-change notification may be sent but is not an Offer revision.
  10. Opportunity ID and Deal ID remain stable. Replacement after release/expiry follows fresh assignment
      → new Offer → acceptance → new Booking. Booking ID changes. The Deal's current Inventory, Offer,
      accepted revision and Booking change atomically while every prior linkage remains immutable history.
  11. `deals.current_inventory_linkage_id` is the single source of truth. Direct Deal foreign-key columns
      are nullable query mirrors only and a `DEFERRABLE INITIALLY DEFERRED` constraint trigger verifies
      them across tables at commit. No route may update a direct Deal pointer independently.
  12. `Sold` and `Rented` are successful transaction outcomes. `Closed` is non-transactional retirement
      only (withdrawn, expired, duplicate, invalid or no longer marketable). Only the responsible team
      Manager may close Inventory, and closure is rejected until every active reservation and assignment
      has first been ended through its governed lifecycle.
  13. Inventory and Opportunity workspaces separate active from historical linkages and show the current
      servicing agent, original assignment creator, original Offer creator, Opportunity ID/stage,
      assignment ID/state/start/expiry, Offer reference/status, Booking reference/reservation expiry,
      current blockage, reasons and immutable event history.
- **Acceptance requirement:** Demonstrate multiple Opportunities sharing one Assigned or Reserved
  Inventory; show non-winning assignments and block only their acceptance/reservation while an exclusive
  reservation is current; release or expire the winning reservation and derive Assigned/Available from
  remaining links; verify seven-day defaults and Manager-only audited expiry changes; replace Inventory
  through a new Offer and Booking while retaining the exact Opportunity and Deal IDs, then confirm the
  authoritative linkage and mirrors move together and all prior lineage remains queryable.
- **Deployment state:** Not deployed. CRM Test remains on `2.1.0-dev.152`.

### UAT-038 — Opportunity Inventory assignment dead-ends in the general Inventory register

- **Status:** Corrected locally after cumulative CRM Test `2.1.0-dev.155`; pending combined package,
  CRM Test deployment and owner UAT
- **Observed in:** CRM Test `2.1.0-dev.155`, Opportunity `NYSA-OP-202608-000005`. The Opportunity
  reported that no Inventory was assignable, then opened the general Inventory register. Inventory could
  be opened or visually selected there, but that workspace had no Opportunity assignment Save action and
  did not retain the originating Opportunity context. The user was therefore blocked with no governed way
  to correct the record and return to the assignment.
- **Final RCA:** The Opportunity matching API supplied an incomplete Inventory projection to the
  eligibility evaluator. In particular, it omitted the maintained `size_sqft` value, so the evaluator
  treated the Inventory size as missing and rejected the property even though the Inventory record held
  that value. The response then presented technical aggregate reasons and opened the general Inventory
  register without retaining the originating Opportunity, so the broker could neither understand the
  false rejection nor correct it and return to the assignment. The shared projection, hard-declaration
  bypass and effective-status defects are corrected together under UAT-046.
- **Separate defect found during the investigation:** A seven-day `Availability last confirmed`
  freshness check had also been introduced without business approval. It was not the cause of this
  reported blockage because the affected record's confirmation date was current. It remains corrected as
  a separate eligibility-policy defect: availability age is advisory, while seven-day expiry applies only
  after an Assignment or Reservation is created.
- **Local solution:** The Opportunity now distinguishes `Available` from `ready to assign`, automatically
  opens the exact per-record reasons when no candidate is ready, and uses business labels rather than
  reason codes. Missing or old availability history is advisory and never removes otherwise eligible
  Inventory from the selection. The assignment form instead requires the broker to confirm that the
  selected Inventory is likely to remain available and instructs them to reconfirm with its owner/source
  before a customer commitment. That acknowledgement and the prior availability timestamp are retained in
  the immutable assignment event. Every genuinely excluded record provides `Correct Inventory and return`;
  saving or completing its correction automatically reopens the same Opportunity. The general register
  remains a secondary review action and explicitly states that assignment must be completed in the
  Opportunity. The Inventory record now starts with one operational assignment-status card: Ready / Not
  ready, every master-record blocker, transaction type, verification state, advisory availability note,
  active Assignment expiry and Reservation expiry. It explicitly states that Inventory availability has no
  automatic expiry; seven-day expiry begins only when an Assignment or Reservation is created. Optional
  market-intelligence content is collapsed beneath the operational record. Seven-day assignment and
  reservation expiry rules are unchanged.
- **Acceptance requirement:** Confirm an otherwise eligible within-budget Inventory remains selectable
  when `Availability last confirmed` is blank or old; confirm the availability message and required broker
  acknowledgement are visible; acknowledge likely availability; save the seven-day assignment; and verify
  the new assignment ID, immutable acknowledgement evidence, Inventory effective status and Opportunity
  linkage. Confirm genuine workflow, verification, terminal-status and transaction-type blockers still
  display their exact reasons and use the correction-and-return pathway.
- **Deployment state:** Not deployed. No CRM Test or production mutation was made for this correction.

### UAT-040 — Developer Master treats a corporate organization as a Customer-owned personal record

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Companies and organisations → Developer governance. The Company form requires a
  Customer-like owner, while a Developer may be a public company, private company, partnership or sole
  establishment whose shareholders or owners are not NYSA Customers. Creating the governed Developer
  version also requires an unexplained opaque source reference and a manually entered SHA-256 value, and
  the activation path assumes a separate Administrator role that NYSA does not maintain.
- **RCA:** Corporate legal identity, CRM relationship ownership, documentary evidence and workflow
  approval were combined in one inherited Company/Customer model. Cryptographic evidence metadata was
  exposed as user input instead of being generated by the system. Approval authority was implemented
  without confirming the operating roles.
- **Required correction:** Maintain corporate legal form independently from any Customer; make relationship
  manager/contact optional and distinct from legal ownership; support listed company, private company,
  partnership and sole-establishment identity fields; generate hashes internally from governed documents;
  use intelligible evidence references; and auto-activate a Developer version created by a Manager,
  Director or Administrator while preserving the actor and evidence audit. Inventory must offer a clear
  `Developer not selected` path until a governed Developer is genuinely applicable.
- **Local solution:** Company creation no longer asks for a personal legal owner; the signed-in broker is
  retained only as the internal NYSA maintainer. Governed versions capture listed/private company, sole
  establishment, partnership, government entity or other legal form. The user supplies an intelligible
  registry/licence/internal reference and CORE derives the immutable SHA-256 evidence digest. Manager,
  Director and Administrator creators auto-activate a non-duplicate version with audited actor/evidence;
  suspected duplicate identities remain visibly controlled. Inventory retains a `Not selected` Developer
  option.
- **Deployment state:** Corrected locally; not deployed.

### UAT-041 — Inventory owner and internal-use authority capture is unclear and ordered too late

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Inventory Step 2. Owner/represented party appears after other advisory sections, and the
  fields `Source` and `Internal-use authority evidence` do not explain what fact or proof the broker must
  record. The screen can therefore collect a name without establishing whether it is the owner, seller,
  landlord, Developer or authorized representative.
- **RCA:** Source provenance, party identity, representation and authority evidence were exposed as flat
  technical fields rather than one guided owner/authority task.
- **Required correction:** Make owner/represented party the first Step 2 section; distinguish actual owner
  from authorized representative; provide controlled party type and role; explain the source as how NYSA
  learned the party identity; explain authority evidence as the saved owner instruction/agreement or other
  proof permitting Internal Inventory use; and show exactly where the maintained party and evidence are
  appended. Do not create a Customer automatically.
- **Local solution:** Owner/represented party is Step 2A before verification Step 2B. Source is relabelled
  as how the party was identified; internal-use evidence is relabelled as the owner instruction,
  authorization, agreement or saved reference permitting Internal Inventory maintenance, with explicit
  wording that it is not marketing consent, a portal NOC or proof of ownership. Saving appends only the
  Inventory counterparty record and does not create a Customer.
- **Deployment state:** Corrected locally; not deployed.

### UAT-042 — Inventory Market Intelligence and organization provenance are not operationally intelligible

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Inventory detail. `Canonical Community`, `Assignment reason`, `Advisory intelligence
  unavailable` and `Organization provenance` are presented without explaining their purpose, maintenance
  source, effect or relationship to valuation/market reporting. The optional advisory panel competes with
  the core owner, verification and assignment journey.
- **RCA:** Internal DLD matching terminology and evidence-link controls were exposed directly in the
  operational workspace without user-facing translation or task ordering.
- **Required correction:** Keep the panel optional and collapsed beneath operational readiness; label the
  maintained Community as the standard DLD/market-data location used for comparable evidence; explain why
  an explicit mapping is needed and where Communities/Buildings are maintained; replace free technical
  reasons with controlled mapping reasons plus notes; translate unavailable states into exact corrective
  actions; and explain organization provenance as the governed Developer/agency evidence linked to this
  Inventory. The panel must never imply that it changes price, availability or verification.
- **Local solution:** The optional panel is titled `Comparable market evidence`, explains its accepted-DLD
  advisory purpose and defines Canonical Community. It explicitly states that it cannot mutate price,
  availability, verification or lifecycle. Organization provenance is renamed `Linked organizations and
  source history`, explains its audit-only purpose and points maintainers to Companies and organisations.
- **Deployment state:** Corrected locally; not deployed.

### UAT-043 — Manager Inventory verification queue cannot open the submitted record

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Manager Inventory verification queue. The Manager can approve, return or reject from the
  row but cannot open the exact Inventory workspace to inspect property facts, owner/authority evidence,
  media and verification history before deciding.
- **RCA:** The queue implemented decision endpoints but omitted record-context navigation.
- **Required correction:** Make the Inventory reference/title and a dedicated `Review Inventory` action open
  the exact route-backed Inventory workspace, preserve return-to-queue context, and keep all decision
  controls server-authorized and audited. A decision must not be encouraged before the evidence is visible.
- **Local solution:** Both the Inventory reference and a dedicated `Review Inventory` button open the exact
  route-backed Inventory workspace. The queue remains behind the workspace and its server-authorized,
  audited decision actions are unchanged.
- **Deployment state:** Corrected locally; not deployed.

### UAT-044 — Organization hierarchy consumes every role's operating dashboard

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Role dashboards. The full Manager/direct-report hierarchy occupies a wide permanent block
  above operational work for every role.
- **RCA:** Organization context was embedded as dashboard content rather than treated as a separately opened
  reference workspace.
- **Required correction:** Move the hierarchy for every role into a dedicated `My Team` tab. Retain only a
  compact link/count where useful on the operating dashboard and preserve role-scoped visibility.
- **Local solution:** Agent, Manager and Director dashboards place the maintained hierarchy only in the
  `My Team` view. The Listing Agent dashboard now exposes the same My Team entry without placing the
  hierarchy in the Inventory operating workspace.
- **Deployment state:** Corrected locally; not deployed.

### UAT-045 — Queue ageing is displayed as raw minute totals

- **Status:** Corrected locally in dev.158; pending combined package, CRM Test deployment and owner UAT
- **Observed in:** Assignment and Manager queues. Long ageing appears as values such as `18,782 minutes`,
  which is technically precise but operationally unreadable.
- **RCA:** The duration formatter exposes the lowest stored unit regardless of elapsed magnitude.
- **Required correction:** Display minutes for durations below two hours, hours thereafter, days for longer
  durations and weeks for extended ageing, retaining an exact timestamp in detail/tooltip evidence.
- **Local solution:** Shared dashboard ageing now renders minutes, hours, days and weeks according to
  magnitude while retaining the exact submitted/due timestamp in the record.
- **Deployment state:** Corrected locally; not deployed.

### UAT-046 — Inventory eligibility boundaries use incomplete facts and can bypass hard declarations

- **Status:** P0 correction and required local real-database evidence complete; pending combined package,
  CRM Test deployment approval and live CRM Test repetition
- **Observed in:** CRM Test `2.1.0-dev.155`, Opportunity Inventory selection. Inventory with a recorded size
  and current availability was reported ineligible because `/matching-inventory` omitted `size_sqft` from
  its partial projection. The same audit found that manual selection with no governed origin skipped
  must-have/exclusion assessments at Assignment, Viewing, Offer and Booking.
- **RCA and provenance:** The incomplete projection and conditional assessment bypass predate dev.153 and
  are present in cumulative dev.145–dev.152. The UAT-037 canonical effective-status function was introduced
  in dev.153, but evaluator routes were not uniformly migrated to project that derived status. The old
  `OPP-INVENTORY-ELIGIBILITY-PARITY-72` source-string test asserted the incomplete projection and therefore
  protected the defect.
- **Priority split:** P0-CRITICAL is the false-acceptance path: a manual match without governed-origin
  evidence can reach customer-facing or reservation boundaries without hard declarations being assessed.
  P0-STANDARD covers false rejection from missing fields, ranking-field omissions and Section D status
  inconsistency.
- **Required correction:** One shared projection and field contract must provide every eligibility/ranking
  fact and canonical `effective_status`; one shared assessment loader must run whether or not governed
  origin exists; every operational boundary must consume that service. There is no override for a missing
  or failed hard must-have/exclusion. The valid recovery is an explicit assessment or a new confirmed
  requirement version. Any future exception model requires a separately approved, evaluator-native,
  immutable reason/authority/scope/expiry contract and must not be an endpoint guard.
- **Local correction implemented:** `INVENTORY_EVALUATOR_FIELD_COLUMNS` is now the exported field contract
  used to generate the SQL projection and the evaluator input. Matching, Assignment, Viewing, Offer,
  Booking, governed matching/share checks, deterministic AI evidence, customer shortlist checks and
  publication readiness now consume canonical effective status rather than silently falling back to the
  stored master status. Manual selection no longer skips declaration hydration: absent must-have or
  exclusion assessments fail closed. PARITY-72 was replaced so it asserts the complete generated contract,
  and behavioural tests independently vary every eligibility and ranking fact.
- **Local evidence completed:** A restricted, non-superuser PostgreSQL fixture with all 99 migrations ran
  `P0-INVENTORY-DECLARATION-BYPASS-156` and `P0-INVENTORY-EFFECTIVE-STATUS-PARITY-157`: both passed with raw
  HTTP and database before/after evidence. Test 156 returned four controlled `409` responses and created no
  unauthorized Assignment, Viewing, Offer or Booking at each tested boundary. Test 157 proved stored
  `Available` versus canonical `Assigned` and confirmed the API reported `Assigned`. Corrected behavioral
  PARITY-72 passed. The cumulative suite passed `1,129/1,131` with zero failures; its two protected tests
  were then executed at their required separate process boundary: M-04/J preserved the Accepted Offer
  during servicing reassignment, and G-02 produced exactly one `201` winner, one `409` conflict, one
  Accepted Offer and one reserved Booking with no phantom accepted loser. Fixture business rows were
  removed after evidence capture while all 99 migration records were retained.
- **Evidence files:** `tmp/installed-postgres-p0-156-157.tap.txt` (SHA-256
  `6555DFB670B30C58E7718394AD9BE6742D060ADDB498BE9B57D61B54385300E3`),
  `tmp/installed-postgres-full-regression.tap.txt` (SHA-256
  `2BEC8D341DDFEF5CB689E4929FE0D5C650092E4D37762EDF6E0D4FF2093F2C0A`) and
  `tmp/installed-postgres-g02.tap.txt` (SHA-256
  `349966B2D552C5798F7D54E2813B2D2532FECFB5175520F3E6F984B1E8D5426F`). CRM Test evidence and production
  approval remain separate.
- **Owner-policy supersession — 21 August 2026:** The earlier dev.158 rule that missing/failed customer
  must-have or exclusion assessments block Assignment, Viewing, Offer and Booking has been superseded.
  Customer-fit declarations now affect rank and visible exception evidence only; they do not make
  operationally usable Inventory ineligible. The historical P0 test 156 result above remains evidence of
  what dev.158 enforced at that time, not acceptance of the newly approved policy. Canonical operational
  status parity test 157 remains applicable.
- **Deployment state:** No deployment or external mutation authorized.

### UAT-047 — Availability confirmation is buried inside the full Inventory edit journey

- **Status:** Corrected locally after CRM Test `2.1.0-dev.155`; pending combined package, CRM Test
  deployment and owner UAT
- **Observed in:** My Inventory workspace. The register shows the Inventory cards, but maintaining the
  operationally important availability timestamp requires opening the full record and then entering the
  multi-section property-edit journey. The card itself does not show when availability was last confirmed.
- **RCA:** `availability_confirmed_at` was implemented only as an optional field in the general Inventory
  form. The register had no focused command for this frequent operational update.
- **Local solution:** Superseded and extended by UAT-048 below. The quick action remains on every
  maintainable card and is also exposed directly in the Listing Agent dashboard.
- **Acceptance requirement:** From My Inventory workspace, confirm the card shows the current availability
  timestamp; use `Update availability`; save both the current time and a valid corrected historical time;
  verify the card refreshes without opening the full Inventory record; verify a future time is rejected;
  and confirm the audit event contains the old and new values. Confirm Assignment and Reservation expiry
  remain unchanged.
- **Deployment state:** Not deployed. No CRM Test or production mutation was made for this correction.

### UAT-048 — Inventory availability needs an explicit effective period and dashboard quick action

- **Status:** Deployed in dev.158; focused dashboard/card quick-action owner retest pending. The user's
  ordinary Inventory-form observation is tracked separately as UAT-050.
- **Observed in:** Listing Agent dashboard and My Inventory workspace after CRM Test `2.1.0-dev.155`.
  Availability is operationally critical, but the effective confirmation is buried in the full record and
  there is no explicit business expiry date. A fixed rolling seven-day assumption is not owner-approved.
- **RCA:** The model stored only the last-confirmed timestamp, so code and copy could confuse an arbitrary
  freshness window with an actual source-confirmed validity period.
- **Local solution:** Adds governed `availability_expires_at`. The compact quick action records both the
  factual effective confirmation time and an explicit future expiry selected by the maintainer; CORE does
  not invent seven days. Both values appear on Inventory cards and the Listing Agent dashboard. Saving is
  scope-controlled, validates expiry after effective time and in the future, and writes one immutable
  before/after audit event. Explicitly expired Inventory fails the single shared eligibility evaluator;
  legacy missing expiry remains visible for correction instead of receiving an invented date. Assignment
  and Reservation expiry remain separate records.
- **Acceptance requirement:** Update one Inventory from the Listing Agent dashboard without opening the
  full record; verify both timestamps on the dashboard and card; verify invalid/reversed dates are rejected;
  verify the audit before/after evidence; and verify the Inventory becomes ineligible only after its explicit
  expiry, without changing Opportunity, Offer, Booking or Deal identifiers.
- **Original pre-deployment state:** Not deployed when the local correction record above was written.
- **dev.158 retest clarification — 18 August 2026:** The user observed the ordinary Inventory screen, not
  the separately implemented dashboard/card `Update availability` quick action that the automated UAT-048
  assertions exercised. That observation does not pass or fail the focused quick-action acceptance steps.
  It exposed the separate incomplete-form defect recorded as UAT-050. UAT-048 remains pending user
  observation in CRM Test.

### UAT-049 — Developer selector appends the governed-version label to the company name

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; not investigated; no
  correction implemented or deployed; retest pending
- **Classification:** Newly discovered during cumulative dev.158 UAT. It is not yet established whether
  this is a regression or an older presentation defect.
- **Role:** Not supplied.
- **Screen/workspace:** Developer selector in the Inventory maintenance journey; exact page/step was not
  supplied. The screenshot helper text points to `CRM → Companies → Governance` as the maintenance source.
- **Record reference:** Developer company shown as `Emaar Properties`; no private record data captured.
- **Prerequisites:** An active governed Developer version exists and is available in the Developer selector.
  Any additional prerequisites were not supplied.
- **Steps observed:** Open the Developer selector and inspect the displayed option for the company. Exact
  navigation and whether the option was selected or merely displayed were not supplied.
- **Expected result:** Display the Developer company name only: `Emaar Properties`. Do not append
  `Developer MASTER v1` to the user-facing name.
- **Actual result:** The selector displays `Emaar Properties · Developer Master v1`.
- **Severity / blocker status:** Severity not assigned by the user. Blocker status not reported.
- **Evidence:** User-supplied screenshot `codex-clipboard-cf52eec3-cfbb-42e3-926f-8c0ea9d65c7d.png`,
  received 18 August 2026. The crop contains no private owner, contact or authority data.
- **Workaround:** Not reported.
- **Issue:** A governed Developer version's internal type/version label is exposed as part of the
  selectable company display name.
- **Confirmed RCA:** None. No cause has been investigated or confirmed.
- **Proposed solution:** Pending investigation. The user's requested presentation is to render only the
  company name while retaining version identity and governance metadata outside the display label as needed.
- **Implementation status:** Not started.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Failed observation recorded on dev.158; corrected behavior has not been observed.

### UAT-050 — Ordinary Inventory edit form omits the availability-expiry field

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158` and confirmed in the exact
  packaged runtime; no correction implemented or deployed; retest pending
- **Classification:** Newly discovered dev.158 correction-coverage defect. The explicit-expiry correction
  exists in the separate quick action and API but was not carried into the ordinary Inventory edit form.
- **Role:** Not supplied.
- **Screen/workspace:** Ordinary Inventory screen/edit form. Exact route and Inventory subsection were not
  supplied.
- **Record reference:** Not supplied; no private record data captured.
- **Prerequisites:** Open a maintainable Inventory record in CRM Test `2.1.0-dev.158`.
- **Steps observed:** Open the Inventory edit screen and inspect the availability date fields. Exact
  navigation and whether Save was attempted were not supplied.
- **Expected result:** Any Inventory form that permits availability maintenance presents the paired
  effective/check timestamp and explicit expiry timestamp, so the validity period can be maintained
  consistently.
- **Actual result:** The ordinary Inventory screen asks only for `Availability checked on`; it provides no
  availability-expiry field.
- **Severity / blocker status:** Severity not assigned by the user. Blocker status not reported.
- **Evidence:** User textual observation received 18 August 2026. Local source and the exact
  `nysa-core-consolidated-crm-test-dev158.zip` runtime independently confirm that the quick-action modal
  contains `Confirmation valid until`, while the ordinary form contains only the confirmation-date input
  and no `availabilityExpiresAt` input.
- **Workaround:** The package contains a separate `Update availability` quick action with both fields, but
  the user has not yet confirmed that path in CRM Test; therefore it is only a potential, unverified
  workaround.
- **Issue:** Availability can be edited through inconsistent user journeys. The ordinary form exposes only
  one half of the governed effective period.
- **Confirmed RCA:** UAT-048 implementation added the expiry input to
  `openInventoryAvailabilityUpdate(...)` and added API/database support, but the ordinary Inventory form
  remained on its earlier single `availabilityConfirmedAt` control and was outside the automated rendered
  journey coverage.
- **Proposed solution:** Add the paired required expiry control to the ordinary Inventory form, submit both
  values through the governed availability update contract, and add a rendered interaction test covering
  the ordinary form as well as the dashboard/card quick action.
- **Implementation status:** Not started.
- **Deployment status:** The defect is present in the exact dev.158 package deployed to CRM Test. No
  correction has been deployed.
- **Retest status:** Failed observation recorded on dev.158; corrected behavior has not been observed.

### UAT-051 — Inventory Community and Building are created as free text instead of governed masters

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; no correction implemented or
  deployed; retest pending
- **Classification:** Newly discovered during cumulative dev.158 UAT. It is not yet established whether
  this is a regression or an older Inventory-governance gap.
- **Role:** Not supplied; observation concerns a user maintaining Inventory.
- **Screen/workspace:** Inventory create/edit journey, property-record section.
- **Record reference:** Not supplied; no private owner, contact or authority data captured.
- **Prerequisites:** Open a new or maintainable single-property Inventory record. Area maintenance and any
  canonical market-intelligence Communities may already exist.
- **Steps observed:** Open Inventory create/edit and review how `Community` and `Building` are supplied.
- **Expected result:** Community and Building are selected from governed, centrally maintained masters
  under the selected Area. Inventory should reference stable internal identities rather than create new
  location identity through free text. Provider-specific Property Finder-approved Community/Building
  identifiers should be mapped to those stable internal identities through governed, versioned mappings.
- **Actual result:** The Inventory form requires free-text `Community` and `Building`. Administration has
  a canonical Community master for DLD comparable-sales mapping, but that is a separate optional
  market-intelligence link. There is no centrally maintained Building master used by Inventory.
- **Severity / blocker status:** Major governance and future integration-readiness defect. The user has not
  assigned release-blocker status.
- **Evidence:** User textual observation received 21 August 2026. Local dev.158 source shows required
  free-text `community` and `building` inputs in the Inventory form, a separate canonical Community model
  for market intelligence, and no governed Building master. No Property Finder call was made; Property
  Finder remains excluded and disabled.
- **Workaround:** Free-text Inventory values and later manual provider mapping are technically possible,
  but no safe governed workaround is confirmed because spelling, alias and duplicate identities can
  diverge across Inventory and provider-approved locations.
- **Issue:** Location identity is being created independently on each Inventory record. That prevents one
  controlled Area → Community → Building hierarchy from governing Inventory identity, duplicate
  prevention, market evidence and future provider mappings.
- **Confirmed RCA:** None. The current implementation boundary is confirmed, but the historical design
  decision or omission that caused it has not been investigated as RCA.
- **Proposed solution:** Introduce governed stable Community and Building/Project identities, immutable
  versions and aliases under Area; require Inventory to select active identities; provide a controlled
  request/review path when a value is missing instead of allowing arbitrary creation; and maintain
  provider-specific versioned mappings—including Property Finder location/project identifiers and mapping
  status—against those stable identities. Preserve legacy text only as migration evidence and route
  unresolved records to an Admin reconciliation queue. Keep DLD source crosswalks distinct but linked to
  the same canonical Community identity.
- **Implementation status:** Not started.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Failed design/governance observation recorded. No corrected behavior has been observed,
  and no external Property Finder behavior has been tested or inferred as a pass/fail result.

### UAT-052 — Opportunity creation offers ineligible Inventory and hides the actual exclusion reason

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; the immediate business-rule
  rejection and presentation defect are confirmed in source; no correction implemented or deployed
- **Classification:** Repeat of the UAT-012 explainability defect in the Opportunity-creation journey:
  eligibility state is contradicted or rejected without the exact governed reason. The budget treatment is
  separately a new owner policy decision that supersedes UAT-012's earlier recorded hard-maximum rule.
- **Role:** Not supplied; the screen is the assigned qualified-Lead Opportunity creation journey.
- **Screen/workspace:** `Lead conversion / governed representation` → `Create an opportunity` → `Starting
  Inventory (select one or more)`.
- **Record reference:** Test Customer `UAT158-HUMAN Customer 01`; Inventory `NYSA-INV-000063`, headline
  `uat 158 round 1`. No private customer, owner, contact or authority data captured.
- **Prerequisites:** Current structured Requirement version 1 has budget AED 1,400,000–2,100,000; the
  Inventory is displayed as approved and available at AED 2,500,000; open Opportunity creation.
- **Exact steps:** Select `NYSA-INV-000063` from Starting Inventory, complete the Opportunity form and press
  `Create opportunity`.
- **Expected result:** An Inventory that fails the current governed Requirement must either be excluded from
  the selectable list or visibly disabled/annotated with its exact reason. If a stale selection reaches
  submit, the error must name the failed rule and values and direct the user to select a compliant Inventory
  or create a governed Requirement revision when the customer's confirmed maximum has genuinely changed.
- **Actual result:** The AED 2,500,000 Inventory remains selectable even though the displayed current maximum
  is AED 2,100,000. Submit fails with: `Selected Inventory is no longer approved, verified, current or
  non-terminal; deliberately remove or replace it before continuing`. The message does not disclose the
  budget exclusion and incorrectly implies only lifecycle/verification causes.
- **Severity / blocker status:** Major usability and explainability defect. It blocks this attempted
  Opportunity-with-Inventory creation but the user has not assigned cumulative-release blocker status.
- **Evidence:** Four user-supplied screenshots received 21 August 2026 show the requirement budget, selected
  Inventory, generic rejection and Inventory card. Local dev.158 source confirms the evaluator returns
  `budget_max_exceeded` when price exceeds `budgetMax`; the create screen filters only approval,
  verification, terminal state and verification expiry, then the submit route discards evaluator reasons
  and returns the generic lifecycle message.
- **Workaround:** Select Inventory priced at or below AED 2,100,000 that satisfies all other governed
  requirements. If AED 2,500,000 is genuinely within the customer's newly confirmed affordability, create
  and confirm a new governed Requirement version first; do not bypass or silently alter the existing
  Requirement. Updating the missing availability-expiry value is separately required under UAT-050 but
  will not resolve this budget rejection.
- **Issue:** The browser's selectable list and helper claim do not use the same complete eligibility result
  enforced by the server, and the server suppresses structured exclusion evidence when it rejects.
- **Owner policy decision — 21 August 2026:** Exceeding the currently recorded maximum budget must not be
  a hard Inventory exclusion. In real customer work, viewing a particular property may cause the customer
  to reconsider and increase the budget. The variance must remain explicit and explainable, but the
  Inventory must remain available for deliberate review rather than being removed from selection. This
  supersedes the contrary budget-ceiling statement recorded during UAT-012; the historical statement is
  retained there as evidence of the earlier decision rather than silently rewritten.
- **Confirmed RCA:** The immediate code-level cause is confirmed: `openCreateOpportunity(...)` builds
  `approved` Inventory using lifecycle/verification predicates only, while `requireOpportunityInventory(...)`
  runs the full evaluator at submit. When that evaluator returns ineligible, the route converts every reason
  to one generic message. Historical design provenance has not been investigated.
- **Proposed solution:** Serve the Opportunity-creation picker from the shared evaluator contract. Return
  each candidate's state and structured reason codes/evidence. Reclassify `budget_max_exceeded` as a visible
  variance/exception rather than an exclusion; show the recorded maximum, Inventory price and difference
  without silently rewriting the governed Requirement. Continue to prevent selection only for operational
  Inventory invalidity. Revalidate on
  submit for concurrency safety and return the same structured reason if state changed. Add rendered and
  HTTP tests for budget variance, transaction type, verification, effective status, expiry and
  declaration-assessment outcomes.
- **Local implementation status — 21 August 2026:** Implemented under immutable policy
  `r3b-operational-eligibility-fit-ranking-v3`. Budget, Area/Community, property type, bedrooms, size,
  funding/payment, timeline/handover and all customer declarations influence scoring/explanation only.
  Unassessed or non-matching must-haves/exclusions remain visible variances and no longer block governed
  promotion. Operational gates remain for deleted, unapproved, unverified, terminal, expired operational
  evidence, missing canonical status and unauthorized/missing Inventory transaction authority. Migration
  `101_dev159_customer_fit_ranking_only.sql` adds the new immutable policy without rewriting prior runs.
  Focused non-isolated tests passed 47/47. The complete ordinary suite passed 1,150/1,150, with 21 protected
  or environment-gated tests skipped. Protected real-database test 156 has been revised for the new policy
  but has not yet been executed against a disposable migrated PostgreSQL fixture.
- **Deployment status:** Local only. No correction deployed; CRM Test remains on cumulative
  `2.1.0-dev.158`.
- **Retest status:** Failed observation remains the CRM Test result. Fixed locally is not passed; corrected
  behavior requires a future authorized deployment and user observation.

### UAT-053 — Rejected Offer cannot visibly initiate lower-price renegotiation for the same property

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; investigated in local source;
  no correction implemented or deployed.
- **Classification:** Newly discovered Offer-recovery workflow defect. Regression status has not been
  established.
- **Role:** Not supplied; do not infer the user's role from the writable Offer-recovery screen.
- **Screen/workspace:** Opportunity → Negotiation → `Offer recovery decision required` after a rejected
  Offer.
- **Record reference:** Not supplied. No customer, owner, contact or authority data was captured.
- **Prerequisites:** A governed Offer for the current property has been rejected; the customer wants to
  continue with the same property at a lower Offer amount; the Opportunity is at the terminal-Offer
  recovery checkpoint.
- **Exact steps reported:** Open the rejected Offer's Opportunity in the Negotiation workspace and click
  `Renegotiate same property` to initiate a lower-price Offer for the same property.
- **Expected result:** Select `Renegotiate same property` and receive one clear same-property recovery form
  in the current context. Enter the lower revised amount, currency, deposit if any, new validity, payment
  terms and renegotiation basis. Saving must create a new linked governed Offer with immutable Revision 1,
  preserve the rejected predecessor unchanged, and must not change the Requirement or Inventory identity.
- **Actual result:** The `Renegotiate same property` button responds to the click but opens no new form and
  provides no place to enter the lower Offer price. No error or ineligibility reason is displayed. The only
  visible recovery form offers requirement review/change and property/inventory disposition choices, which
  are not applicable to this price-only renegotiation.
- **Severity / blocker status:** Major workflow defect and a blocker for this same-property renegotiation
  case. The user has not assigned cumulative-release blocker status.
- **Evidence:** User-supplied screenshot received 21 August 2026 shows the terminal Offer recovery screen,
  the `Renegotiate same property` button and the visible governed-recovery form containing requirement and
  prior-property controls but no revised-price input.
- **Workaround:** None confirmed. Do not use requirement review or replace Inventory when neither has
  actually changed. The intended `Renegotiate same property` control is a silent no-op on this record.
- **Issue:** Same-property commercial renegotiation is not presented as a complete, self-contained recovery
  action. The visible recovery form is for returning to Matching or Requirements, which changes the wrong
  business context for a price-only counter-position.
- **Confirmed code findings:** `offerWorkspaceHTML(...)` contains the correct lower-price recovery form and
  creates a new Offer linked by `predecessorOfferId`. However, that form is rendered only when
  `recoveryAllowed` is true. The prominent `Renegotiate same property` button is rendered whenever the
  general recovery panel exists, even when no `.offer-recovery-form` exists; its click handler uses optional
  chaining and therefore silently does nothing in that state. The form is also located separately from the
  visible recovery panel. These findings confirm an unsafe presentation/control mismatch. The exact data
  condition that prevented or hid the form for this CRM Test record is not yet confirmed and is not labelled
  as RCA.
- **Proposed solution:** Render one explicit same-property renegotiation panel directly under the selected
  recovery action. If the predecessor/property is eligible, expose the revised commercial terms and create
  the linked recovery Offer. If it is not eligible, disable the action and show the exact reason and required
  correction instead of a no-op. Keep the return-to-Matching, requirement-review and Closed-Lost paths
  separate. Add rendered and real route/database tests for lower-price recovery, immutable predecessor
  linkage, missing/ended assignment, unavailable Inventory and stale concurrent state.
- **Implementation status:** Not started.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158:** the button clicks but no lower-price recovery form appears.
  Corrected retest is pending after a future authorized
  implementation and deployment.

### UAT-054 — Inventory verification detail does not return to verification queue after decision

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; the code-level cause is
  confirmed locally; no correction implemented or deployed.
- **Classification:** Newly discovered correction-coverage defect extending UAT-043. UAT-043 added the
  ability to open the exact Inventory from the Manager verification queue, but did not complete the return
  journey after a decision. Regression status is not established.
- **Role:** Not supplied; the observed screen is an authorized Inventory verification review journey.
- **Screen/workspace:** Manager dashboard → `Inventory verification` queue → `Review Inventory` → detailed
  Inventory verification decision.
- **Record reference:** Not supplied. No private owner, contact or authority data was captured.
- **Prerequisites:** A pending Inventory verification request is visible in the authorized verification
  queue; open the exact Inventory detail from the queue.
- **Exact steps reported:** Review the detailed Inventory, select the verification decision, enter the
  decision reason and record the decision successfully.
- **Expected result:** After the decision succeeds, close the detailed Inventory workspace, return control
  to the Inventory Verification queue, refresh the queue, remove the completed request and position the
  reviewer to process the next pending record.
- **Actual result:** The verification decision completes, but the detailed Inventory record does not close
  back to the queue. Control remains in, or returns to, the detailed Inventory screen.
- **Severity / blocker status:** Moderate workflow/productivity defect. The verification itself is not
  reported as failed, but sequential queue processing is interrupted. The user has not assigned
  cumulative-release blocker status.
- **Evidence:** User observation received 21 August 2026. No screenshot or synthetic Inventory reference
  was supplied for this result.
- **Workaround:** Manually close/back out of the Inventory detail and reopen the `Inventory verification`
  queue. This is navigation only; do not repeat the verification decision.
- **Issue:** Successful queue-originated verification does not return the reviewer to the authoritative
  work queue.
- **Confirmed RCA:** In `openDetail(...)`, the successful
  `#inventory-verification-decision-form` handler removes the current overlay and then explicitly calls
  `openDetail(l.id,{afterWorkflow})`, reopening the same Inventory. The verification-queue open actions call
  `openDetail(...)` without a decision-completion callback that restores and refreshes the queue. Therefore
  the origin context is not consumed after the decision.
- **Proposed solution:** Open Inventory review with an explicit queue-origin return callback. After a
  successful verification, exemption, return or rejection decision, close the detail and invoke that
  callback to render and refresh `Inventory verification`. When Inventory detail was opened outside the
  queue, retain an appropriate detail refresh. Add rendered behavior tests for all four decisions and verify
  that a completed request disappears while the next pending request remains available.
- **Local implementation status — 21 August 2026:** Queue-origin review now passes an explicit completion
  callback. After a successful decision the detail closes, the callback refreshes the authoritative
  Inventory verification queue and the completed request is removed from pending work.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158.** Corrected CRM Test retest is pending after a future authorized
  implementation and deployment.

### UAT-055 — Verification checker sees creator guidance and an unnecessary custodian/reassignment concept

- **Status:** Open defect observed by the user in CRM Test `2.1.0-dev.158`; the presentation cause is
  confirmed locally; no correction implemented or deployed.
- **Classification:** Newly discovered checker-workspace and Inventory-custody correction-coverage defect.
  Regression status is not established.
- **Role:** Authorized verification checker; exact role was not supplied and is not inferred.
- **Screen/workspace:** Manager dashboard → `Inventory verification` queue → detailed Inventory verification
  review.
- **Record reference:** Not supplied. No private staff, owner, contact or authority data was captured.
- **Prerequisites:** Open a pending verification request as an authorized checker where the Inventory is
  currently maintained by a Listing Executive and requires handover to a responsible Agent.
- **Exact steps reported:** Open the Inventory from the verification queue and review the verification
  guidance and available custody/reassignment action before recording the decision.
- **Expected result:** The checker sees verification-decision guidance addressed to the reviewer: inspect
  the property, owner/represented-party authority, evidence and history; then verify, return or reject with
  an evidence-based reason. The screen must also prominently highlight the required reassignment from the
  Listing Executive to the responsible Agent, show the current custody role and provide a deliberate
  eligible-agent selection with a reason and audit history.
- **Actual result:** The checker sees the same pending message shown to the creator rather than checker-
  specific review instructions. The Listing Executive-to-Agent reassignment requirement is not highlighted
  in the verification review flow.
- **Severity / blocker status:** Moderate governance and workflow-clarity defect. It risks an incomplete
  post-verification custody handover, but the user has not assigned cumulative-release blocker status.
- **Evidence:** User observation received 21 August 2026. No screenshot or synthetic Inventory reference
  was supplied for this result.
- **Workaround:** The Manager/Admin may use the separate generic `Reassign responsible agent` control if it
  is visible and the correct eligible Agent is known. This is not a confirmed substitute for the missing
  checker guidance; record a reason and do not expose private staff details in UAT evidence.
- **Issue:** The review surface does not adapt its message to the checker role and does not connect
  verification completion with the required operational-custody handover.
- **Confirmed RCA:** The Inventory verification message is selected only from
  `l.verificationStatus`; it does not branch on `pendingVerification`, reviewer authority or whether the
  signed-in user is the request creator/checker. A generic `Reassign responsible agent` form is rendered
  separately for Manager/Admin when eligible agents load, above the verification section. No verification
  guidance, banner or completion state links that control to the Listing Executive-to-Agent handover.
- **Owner policy decision — 21 August 2026:** Remove Agent assignment from Inventory verification and do
  not introduce an intermediate Inventory owner/custodian. The Listing Executive creates and maintains the
  Inventory and submits it for verification. The checker verifies, returns or rejects only. A Sales Agent
  selects available Inventory during Opportunity creation, producing an Opportunity-specific linkage; no
  Inventory custodian approval is required.
- **Proposed solution:** Render distinct creator and checker guidance and remove custody assignment from the
  verification decision. Verification must verify, return or reject only, then return to the refreshed queue.
  The Inventory detail must identify the Listing Executive as maintainer without implying custody. When a
  Sales Agent selects available Inventory during Opportunity creation, record that Agent and Inventory only
  on the Opportunity-specific linkage. Add role-rendering, authority, no-custodian and queue-return tests.
- **Local implementation status — 21 August 2026:** Checker guidance is role-specific; the Inventory detail
  no longer shows `Current custodian`, reassignment controls or an active responsible-agent history. The
  legacy endpoint returns `410`; verification routing follows the Listing Executive/technical poster team;
  and Opportunity creation derives its servicing and inventory-side Agent from the assigned Lead. Historical
  attribution rows remain visible as audit-only evidence and confer no approval authority. The same legacy
  attribution no longer grants Inventory market-intelligence write authority.
- **Local verification:** Modified JavaScript files pass syntax checks. The complete ordinary Node test suite
  passes `1,172/1,172` with exit code `0` after updating the superseded ownership-text assertion.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158.** Corrected CRM Test retest is pending after a future authorized
  implementation and deployment.

### UAT-056 — Responsible-Agent reassignment made during verification is not visible on Inventory

- **Status:** Original failed observation retained from CRM Test `2.1.0-dev.158`; superseded locally by the
  owner decision that no transferable Inventory custodian should exist.
- **Classification:** Newly discovered Inventory-custody persistence or presentation defect in the
  verification journey. The exact failing layer and regression status are not yet established.
- **Role:** Authorized verification checker; exact role was not supplied and is not inferred.
- **Screen/workspace:** Inventory verification review → `Reassign responsible agent` → Inventory detail.
- **Record reference:** Not supplied. No private staff, owner, contact or authority data was captured.
- **Prerequisites:** Open a pending Inventory verification record, select an eligible responsible Agent and
  enter a reassignment reason.
- **Exact steps reported:** Assign the Inventory to an Agent during the verification review, then inspect the
  Inventory after the action.
- **Expected result:** The action succeeds once, `responsible_agent_id` changes to the selected eligible
  Agent, immutable attribution history records previous Agent, new Agent, reason, actor and time, and the
  refreshed Inventory displays the new Agent under `Responsible NYSA agent — Current custodian` and
  `Inventory agent attribution history`. This is Inventory responsibility/custody; it must not be presented
  as an Opportunity Inventory assignment.
- **Actual result:** After assigning the Agent, the user cannot see Inventory-assigned-to-Agent data on the
  Inventory record.
- **Severity / blocker status:** Major custody traceability defect until persistence is verified. It may be
  a display-only problem or a failed reassignment; the user has not assigned cumulative-release blocker
  status.
- **Evidence required:** Capture the action result/toast without private staff details, then reopen the exact
  synthetic Inventory and capture the `Responsible NYSA agent` row and `Inventory agent attribution history`.
  A sanitized read-only database check of `listings.responsible_agent_id` and the latest
  `inventory_agent_assignment_history` row would isolate persistence from rendering, but no external or
  CRM Test query is authorized or performed by this record.
- **Workaround:** Do not repeat or rely on verification-stage reassignment. The Listing Executive maintains
  the Inventory; the Sales Agent selects it inside the relevant Opportunity.
- **Issue:** The verification journey does not provide reliable visible confirmation that the selected
  Agent became the current Inventory custodian.
- **Confirmed code findings:** The `PATCH /listings/:id/responsible-agent` route is designed to update
  `listings.responsible_agent_id`, insert an immutable `inventory_agent_assignment_history` row and audit the
  reassignment in one transaction. The detail API loads that history newest first, and the UI derives
  `Responsible NYSA agent` from the newest history row. The client displays a success toast and reopens the
  detail after a successful response. These findings establish the intended contract but do not prove that
  the observed CRM Test request succeeded or that the returned data contained the new assignment.
- **RCA for the original missing display:** Not confirmed and no longer required to establish the replacement
  policy. The original observation remains historical evidence rather than being relabelled.
- **Proposed solution:** Superseded by the owner policy decision. Remove verification-stage reassignment and
  any current-custodian presentation or authority. Retain legacy attribution fields/history only for schema
  compatibility and audit. Establish the Sales Agent relationship when available Inventory is selected for
  a specific Opportunity, without requiring approval from an Inventory custodian.
- **Local implementation status — 21 August 2026:** The active custodian concept and reassignment control are
  removed from the Inventory review surface. The reassignment endpoint is disabled with an exact explanation.
  Legacy database fields/history are retained for backward compatibility and audit only, but no longer grant
  maintenance, verification-routing or Opportunity-ownership authority.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Original failed observation on dev.158 is retained. Retest of the replacement policy—no
  custodian control and Opportunity-specific Sales Agent linkage—remains pending after a future authorized
  deployment.

### UAT-057 — Customer role `Developer` is ambiguous with the governed corporate Developer Master

- **Status:** Newly discovered clarification and terminology defect observed in CRM Test `2.1.0-dev.158`.
- **Classification:** Customer-master vocabulary defect; regression status is not established.
- **Role:** User creating a Customer; exact signed-in CRM role was not supplied and is not inferred.
- **Screen/workspace:** Customer Master → Create customer → `Customer role`.
- **Record reference:** None; the observation occurred before creating a record. No private customer or
  organization data was captured.
- **Prerequisites:** Open the Create customer form.
- **Exact steps reported:** Review the available Customer roles: Buyer, Seller, Landlord, Tenant, Developer,
  Investor and Other, then compare `Developer` with the earlier Developer Master creation guidance.
- **Expected result:** The form clearly explains whether the selection classifies a person/contact, creates a
  corporate Developer Master, or controls a Lead/transaction. A corporate Developer must not be created
  accidentally as a person Customer.
- **Actual result:** `Developer` appears beside individual transaction roles without explaining that it is
  only a contact classification and does not create or govern a Developer company.
- **Severity / blocker status:** Moderate data-quality and user-guidance defect; no release blocker status has
  been assigned by the user.
- **Evidence:** User-supplied screenshot of the `Customer role` selector and exact written observation. The
  dropdown was not expanded in the supplied image; the reported values are retained as user observation.
- **Workaround:** Do not use Customer role `Developer` to create a corporate Developer. Create the Company in
  CRM → Companies, then have an authorized Manager, Director or Administrator create the governed Developer
  version. The Listing Executive selects an active governed Developer during Inventory creation.
- **Issue:** One unqualified `Developer` label is used in a person/contact vocabulary while a separate,
  governed corporate Developer Master exists.
- **Confirmed code findings:** Customer creation writes a `contacts` record and `contact_roles`; it does not
  create a Company or governed Partner Organization. The initial selector records one role and more roles can
  later be appended. An ordinary Company can be created by a CRM user with write authority, but creating a
  governed organization version is restricted to Manager, Director or Administrator authority. Inventory
  creation accepts only an active governed Developer Master. The current source contains no Customer role
  named `operator`; if CRM Test displays one, separate expanded-dropdown evidence is required.
- **Confirmed RCA:** The contact-role and corporate-governance vocabularies reuse the label `Developer`
  without a qualifier or contextual explanation, despite creating different entity types with different
  authority and lifecycle rules.
- **Owner decision — 21 August 2026:** Remove `Developer` from Customer roles. Corporate Developers belong
  exclusively in the governed Company/Developer Master workflow.
- **Proposed solution:** Remove `Developer` from all new Customer-role selectors and reject it in Customer
  creation and add-role APIs. Preserve existing legacy values read-only for audit/migration safety. Keep
  corporate Developer creation exclusively in Companies → Governance.
- **Local implementation status — 21 August 2026:** Implemented. New Customer creation, Lead-inline Customer
  creation and both add-role workspaces no longer offer Developer. Server validation rejects it as a new
  Customer role. Historical records remain readable and no Company/Developer Master behavior was changed.
- **Local verification:** Modified JavaScript passes syntax checks; the focused set passes `31/31` and the
  complete ordinary Node test suite passes `1,173/1,173`.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Failed/ambiguous behavior remains on dev.158. Corrected CRM Test retest is pending after
  a future authorized deployment.

### UAT-058 — Mandatory Preferred channel has unclear operational effect during Customer creation

- **Status:** Newly discovered clarification/design issue observed in CRM Test `2.1.0-dev.158`.
- **Classification:** Customer-master field-purpose and mandatory-data-quality issue; regression status is not
  established.
- **Role:** User creating a Customer; exact signed-in CRM role was not supplied and is not inferred.
- **Screen/workspace:** Customer Master → Create customer → `Preferred channel`.
- **Record reference:** None. No private customer data was captured.
- **Prerequisites:** Open the Create customer form.
- **Exact step reported:** Review the mandatory Preferred channel field and ask what operational purpose it
  serves at Customer creation.
- **Expected result:** The field explains its effect, distinguishes contact preference from marketing consent,
  and permits `Not yet confirmed` when the customer has not stated a preference.
- **Actual result:** Phone, Email, WhatsApp or SMS must be selected, but the form does not explain whether the
  value drives communication, grants consent or merely records a note.
- **Severity / blocker status:** Moderate data-quality and workflow-clarity issue; the user has not assigned
  blocker status.
- **Evidence:** Exact user observation; no additional screenshot or private data is required.
- **Workaround:** Select only a channel the customer actually confirmed. Do not treat the selection as
  marketing consent; consent is governed separately.
- **Issue:** A mandatory communication-preference field is presented without explaining its operational use.
- **Confirmed code findings:** The value is stored and displayed, marks the Phone channel as WhatsApp-enabled
  when WhatsApp is selected, and is required before creating a Customer or a Lead for an existing Customer.
  Website intake falls back from Email to Phone when the submitted email is not trusted. No current local
  source call site automatically sends a message or consistently defaults an outbound action from this field.
- **Confirmed RCA:** Not established. The implementation boundary is confirmed, but the original business
  decision for making the field mandatory is not documented in the inspected source.
- **Proposed solution:** Retain the concept as `Preferred contact method (if confirmed)`, add `Not yet
  confirmed`, make it optional at initial Customer creation, and use it only to preselect—not authorize—future
  communication actions. Marketing consent and do-not-contact controls remain authoritative and separate.
- **Implementation status:** Not started; owner decision is pending.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Pending after any approved correction and future authorized deployment.

### UAT-059 — Customer Master shows only ten records and omits an existing Customer independently visible through Lead search

- **Status:** Repeat failed observation reported on CRM Test `2.1.0-dev.158`.
- **Classification:** Confirmed Customer-register accessibility regression introduced during Release 2.6
  pagination reconciliation, then incompletely remediated. The independent Lead search is existence evidence,
  not the defective screen.
- **Role:** User reviewing Customers and Leads; exact signed-in CRM role was not supplied and is not inferred.
- **Screen/workspace:** Defective screen: Customer Master main register. Independent evidence: Lead pipeline
  search and Add Lead Customer picker.
- **Record reference:** A synthetic Customer was shown in supplied evidence. Private contact values and UUIDs
  are intentionally not reproduced.
- **Prerequisites:** More than ten permitted Customers exist. At least one Customer outside the first ordered
  page is linked to a visible Lead or discoverable in Add Lead Customer search.
- **Exact steps reported:** Review the Customer Master tab and observe that its list is limited to ten and the
  target Customer is absent. Open the Lead tab and find that Customer there, proving the Customer exists.
- **Expected result:** Every permitted Customer is reachable from Customer Master through real pagination or
  load-more. Searching Customer Master by a partial name, email or phone searches the complete permitted
  register and returns matching records regardless of their unfiltered page.
- **Actual result:** Customer Master exposes only ten records and omits the Customer; the same Customer is
  independently visible through the Lead journey.
- **Severity / blocker status:** Major Customer-register discoverability defect; the user has not assigned
  cumulative-release blocker status.
- **Screenshots/evidence:** User supplied Lead-journey evidence showing the target Customer exists. The exact
  Customer Master filtered-result count was not included in the two supplied screenshots.
- **Workaround:** Use Add Lead Customer search or a linked Lead to establish that the Customer exists. This is
  not an acceptable replacement for a complete Customer Master register.
- **Issue:** Customer Master presents page 1 as the register without providing access to later pages.
- **Confirmed code findings:** Customer Master always sends `pageSize=10`, never sends `page`, and renders
  `showing first` without next, previous, page-number or load-more controls. The Customer API already supports
  `page`, `LIMIT` and `OFFSET`, returns the total count, and applies name/email/phone predicates before
  pagination. The UI initiates filtered search only when `Search` is clicked or Enter is pressed; ordinary
  typing alone does not execute it.
- **Confirmed regression origin:** Before Git commit `5669016` (`release(r2.6): reconcile accepted dev79
  candidate`, 30 July 2026), the Customer endpoint returned up to 500 scoped Customers and the Customer tab
  rendered that returned set. The implementation was not scalable, but the current UAT-sized register was
  accessible. Commit `5669016` changed the API to true `page`/`pageSize` handling with a default of ten and
  changed Customer Master to request `pageSize=10`; it did not add next, previous or load-more controls. The
  UI therefore became permanently pinned to page 1 at the same time the server became page-capable.
- **Confirmed RCA — missing Customer during ordinary register browsing:** The pagination conversion was
  completed on the API side but not on the Customer UI side. The new ten-row presentation limit was treated
  as a complete register even though no navigation existed, making every Customer after the first ten in the
  selected sort order inaccessible through ordinary Customer-tab browsing.
- **RCA — reported full-register filtered-search failure:** The local source is designed to search before
  pagination, so a Search/Enter submission should find a matching Customer anywhere in permitted scope. The
  supplied evidence does not show the Customer Master query after pressing Search or its result count. If that
  exact action also returns no result, it is a second defect and requires one sanitized Customer-tab screenshot
  showing the entered search value and returned count; it must not be attributed to pagination without that
  evidence.
- **How later fixes missed it:** The Release 3A dev.98 Customer-register correction explicitly stated that the
  register would “continue to show ten records”; it fixed sort preservation and made the newest Customer appear
  first, not access to older pages. Dev.147 then corrected the Add Lead Customer picker, which had filtered a
  prefetched ten-Customer array, but it did not change Customer Master. The dev.147 regression tests exercise
  the Add Lead picker and server-side filtered search only; the Customer-register refresh test checks newest
  ordering, and no test creates more than ten Customers and navigates to page 2.
- **Package history evidence:** Every retained cumulative CRM Test package inspected—dev.145, dev.146,
  dev.147, dev.148, dev.151, dev.152, dev.153, dev.154, dev.155 and dev.158—contains `pageSize=10` in Customer
  Master and contains no Customer `page` request, next, previous or load-more control. This proves the defect
  was not newly introduced between dev.157 and dev.158; the earlier “fixed” conclusion accepted adjacent
  search/sort corrections without testing full-register reachability.
- **Proposed solution:** Add Customer-register paging with current range, total, next/previous and preserved
  query/filter/sort state. Make Search behavior explicit and test partial name, email, phone and wildcard
  against Customers beyond page 1. Add an end-to-end regression proving every page is reachable from Customer
  Master and the same Customer can be reconciled with its linked Lead without exposing private data.
- **Implementation status:** Not started; this turn is corrected RCA/documentation only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158.** Correction and retest remain pending.

### UAT-060 — Lead Pipeline exposes only the first ten matching Leads with no later-page navigation

- **Status:** Newly identified by the post-UAT-059 source/package audit; not yet reported as a user-observed
  failure and therefore not marked passed or failed by human UAT.
- **Classification:** Confirmed sibling regression introduced by the same Release 2.6 list-limiting change as
  UAT-059.
- **Role:** Any permitted CRM Lead user; exact role-specific reproduction is pending.
- **Screen/workspace:** CRM → Lead Pipeline main register.
- **Record reference:** None required. Use synthetic Leads only; do not include private Customer data in evidence.
- **Prerequisites:** At least eleven Leads visible within the signed-in user's governed scope. For the clearest
  test, create uniquely named synthetic Leads so one sorts outside the first ten returned rows.
- **Exact verification steps:** Open Lead Pipeline with all filters reset. Confirm the total is greater than ten.
  Observe the ten rendered rows and look for next, previous, page-number or load-more controls. Search for the
  synthetic Lead outside the first ten and then reset the search.
- **Expected result:** Every permitted Lead is reachable through real pagination or load-more, with filter and
  search state preserved. The register must not present page 1 as the entire pipeline.
- **Actual code/package result:** The UI always sends `pageSize=10`, displays `showing first`, and provides no
  later-page control. The Lead API returns the total count but accepts no `page` and applies only `LIMIT`, with
  no `OFFSET`; even a future UI page control cannot retrieve page 2 from this endpoint as currently written.
- **Severity / blocker status:** Major pipeline discoverability defect; cumulative-release blocker status has
  not been assigned by the owner.
- **Screenshots/evidence:** Source/history/package audit only. Capture the Lead Pipeline count, the ten visible
  rows and the absent navigation during human reproduction; exclude private contact values.
- **Workaround:** A sufficiently specific server-side Lead search can find a known Lead by reference, title or
  linked Customer name. This does not allow browsing or reconciling all permitted Leads.
- **Issue:** The main Lead register is a permanently truncated first-page view.
- **Confirmed RCA:** Commit `5669016` (`release(r2.6): reconcile accepted dev79 candidate`, 30 July 2026)
  replaced the former API result cap of 500 with a default ten-row `LIMIT` and made the UI explicitly request
  ten. Unlike Customer and Opportunity APIs, the Lead endpoint did not receive `page`/`OFFSET` support, and the
  Lead UI did not receive navigation. The performance limit was therefore shipped as an accessibility limit.
- **Package history evidence:** Every retained cumulative package inspected from dev.145 through dev.158 keeps
  the Lead `pageSize=10` request and no Lead page-navigation implementation. This is not new to dev.158.
- **Why automated regression did not catch it:** No located test creates more than ten in-scope Leads and opens
  a later page. Existing assertions recognize the ten-row limit but do not prove full-register reachability.
- **Proposed solution:** Add deterministic `page`/`OFFSET` support and page metadata to the Lead API; add
  previous/next, page/range/total display and preserved filters to Lead Pipeline; add an end-to-end test with
  more than ten in-scope Leads that opens a Lead from page 2 and verifies full-register search.
- **Implementation status:** Not started; audit and documentation only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Human reproduction and corrected-build retest pending.

### UAT-062 — Lead/Requirement classification and Offer `Offer type` mix unrelated business dimensions

- **Status:** Failed/ambiguous observation reported on CRM Test `2.1.0-dev.158`; processing impact confirmed
  through local source and the exact deployed package.
- **Classification:** Newly discovered data-model and terminology defect; regression status is not established.
- **Role:** User creating a Lead; exact signed-in CRM role was not supplied and is not inferred.
- **Screen/workspace:** CRM → Add Lead → Business type and CRM → Opportunity → Create property Offer → Offer
  type. Related vocabularies are also reused in Structured requirements, Qualification administration,
  Opportunity transaction and Inventory transaction types.
- **Record reference:** No record reference was supplied or required.
- **Prerequisites:** Open Add Lead as an authorized CRM user.
- **Exact steps reported:** Review the mandatory Business type options: `Sale`, `Rental`, `Off-plan` and
  `Commercial`; compare what each option describes and ask what downstream processing it controls.
- **Expected result:** A mandatory classification must represent one coherent business dimension, use
  unambiguous customer-facing labels and explain any operational consequence. Transaction objective, property
  market stage and property segment must be recorded separately where each independently affects processing.
- **Actual result:** `Sale` and `Rental` describe transaction categories; `Off-plan` describes development/
  readiness stage; and `Commercial` describes a property segment. Valid combinations such as commercial rental,
  off-plan commercial sale and residential off-plan purchase cannot be represented accurately by one value.
- **Severity / blocker status:** Major classification and downstream-processing risk; cumulative-release blocker
  status has not been assigned by the owner.
- **Screenshots/evidence:** User supplied screenshots of the Lead Business type selector and Offer creation. The
  Offer screen explicitly lists `Purchase`, `Rental`, `Off-plan` and `Commercial`. No private Customer data is
  required or retained for this defect.
- **Workaround:** Choose the closest operational team category, then record the actual requirement explicitly in
  Structured requirements and review the Opportunity transaction before saving. This does not eliminate routing,
  qualification or matching risk and is not an acceptable permanent solution.
- **Issue:** One overloaded field is being used as if it were a coherent business taxonomy.
- **Confirmed current processing impact:** The value is mandatory and stored on the Lead; it participates in
  source/business/area routing-rule selection for non-self-assigned creation; it selects a business-line-specific
  Qualification Version; it pre-fills new Structured requirements; the current Structured requirement in turn
  pre-fills Opportunity transaction; it appears in Customer/Lead presentation and reporting; website intake uses
  it for governed routing and duplicate/fingerprint decisions; and proposal timeline logic treats `Off-plan`
  specially.
- **Confirmed matching consequence:** Inventory maintains the same four values as a multi-select transaction-type
  field. Opportunity/requirement matching compares the selected transaction value with the Inventory array by
  exact text. A mismatch is currently a **hard exclusion** (`transaction_type_mismatch`), not merely an AI ranking
  factor. The mixed taxonomy can therefore exclude a commercially valid combination for classification reasons.
- **Confirmed duplication/divergence risk:** Lead `businessType`, versioned Requirement `businessLine`, Opportunity
  `transactionType` and Inventory `transactionTypes` are separate stored values using the same mixed list. The
  Requirement and Opportunity values can be changed later, while the original Lead value continues to control
  Lead-specific qualification selection and remains visible as its classification.
- **Additional user-observed Offer impact:** Offer creation repeats the same modelling error with a different
  vocabulary: `Purchase` and `Rental` describe transaction direction/family, `Off-plan` describes market stage,
  and `Commercial` describes property segment. A commercial rental or commercial purchase cannot be represented
  coherently, and the user is asked to choose information that should already be known from the Opportunity and
  selected viewed Inventory.
- **Owner-confirmed Offer treatment:** Do not retain this mixed Offer-type selector as an independent source of
  truth. Derive the Offer transaction family from the governed Opportunity transaction/objective mapping; obtain
  market stage and property segment from the selected Inventory and canonical classification references; display
  the derived combination and its source for review. Any permitted override must be an explicit governed exception
  with reason and audit evidence, not a free choice among unrelated concepts.
- **Owner clarification — NYSA Offer capability:** NYSA must be able to create and issue an Offer to a registered
  Seller Customer and likewise support the reverse and rental directions as a brokerage communication. The Offer
  must use NYSA's professional brokerage voice and associate the relevant NYSA Customer role, counterparty role,
  Inventory and submitting agent. NYSA is agreeing to broker/facilitate the proposed sale, purchase or rental
  agreement; it is not itself offering to buy, sell, rent or lease the property and must not be presented as the
  transaction principal. The buyer and seller, or tenant and landlord, remain the parties who must agree the terms.
  The template must not invent an `on behalf of` statement or unsupported legal agency characterization.
- **Owner-confirmed Offer directions:** Replace the mixed `Purchase`, `Rental`, `Off-plan`, `Commercial` selector
  with four coherent directional choices, presented with unambiguous labels: (1) `Offer to purchase` — submitted
  for Buyer to Seller; (2) `Offer to sell` — submitted for Seller to Buyer; (3) `Offer to rent` — submitted for
  Tenant to Landlord; and (4) `Offer to rent out / lease` — submitted for Landlord to Tenant. The exact short UI
  labels proposed by the owner are `Purchase`, `Sale`, `Rent`, and `To rent`; final wording must preserve the four
  meanings above and avoid ambiguity between tenant and landlord directions. `Off-plan` remains market stage and
  `Commercial` remains property segment, so neither is an Offer direction.
- **Direction validation requirement:** The selected direction must be consistent with the Opportunity objective,
  NYSA representation side, selected Inventory authority and the identified sender/recipient parties. A governed
  counteroffer reverses sender and recipient while retaining the same negotiation chain; it must not overwrite or
  mutate the preceding proposal.
- **Owner-confirmed counterparty rule:** The counterparty is the other transaction actor on the opposite side of
  the Offer—for example the Seller for a Buyer purchase Offer, the Buyer for a Seller sale Offer, the Landlord for
  a Tenant rental Offer, or the Tenant for a Landlord rent-out/lease Offer. The counterparty may be another firm's
  Customer or another external actor and must not be forced into the NYSA Customer register.
- **Counterparty data requirement:** Counterparty side/role is derived from Offer direction, but counterparty name
  and internal Customer linkage are optional at Offer creation. Permit an optional link to an existing NYSA
  Customer or governed external-counterparty record without requiring either. An unknown or not-yet-disclosed
  name must not block creating the Offer. Any later identity, authority, KYC or compliance requirement must be
  explicitly defined at its applicable stage and must not be silently imposed on Offer creation.
- **Implicit business rules requiring explicit owner confirmation:**
  1. Every Lead must select exactly one of the four mixed values; combinations and an unknown/unconfirmed state
     are not supported.
  2. `Sale` does not distinguish a buyer from a seller, and `Rental` does not distinguish a tenant from a
     landlord. The build assumes representation side can be resolved later at Opportunity creation.
  3. Website intake automatically assigns Customer role `tenant` only for `Rental`; an investment purpose adds
     `buyer` and `investor`; every other type defaults to `buyer`. It does not infer seller or landlord.
  4. The signed website AI routing contract may determine only `Sale` or `Off-plan`. A determined `Rental` or
     `Commercial` result is rejected into Manager review.
  5. Default Dubai routing creates teams/rules only for Rental, Off-plan and Secondary Sale. Commercial has no
     default destination and depends on a separately maintained rule or the Company Unassigned fallback.
  6. Routing chooses the lowest numeric priority among all matching source/business/area rules. Specificity is
     not generally preferred; area-specific wins only as a tie-breaker after priority.
  7. A manually created Lead by a Sales Agent is self-assigned to that creator and bypasses the maintained routing
     destination. Other permitted creators route to a team queue; routing rules never directly assign an agent.
  8. Primary routing area is optional, but if selected its maintained label must also occur in Preferred areas.
     Otherwise only an All-areas rule can match.
  9. The original Lead business type has no ordinary governed edit/version path after capture. A later Requirement
     version may use another business line without changing the original Lead classification.
  10. Qualification selects an active model matching the original Lead business type, preferring it over an
      All-business-lines model. If neither exists, qualification is blocked.
  11. Structured requirements initially inherit the Lead value but may diverge in later versions. Opportunity
      transaction initially follows the current Requirement and remains manually selectable.
  12. Opportunity/Requirement transaction must exactly match one of the Inventory transaction-type strings. A
      mismatch is a hard exclusion; missing Inventory transaction type requires clarification.
  13. Exact `Rental` selects landlord/lessor ownership and authority handling. Other allowed values—including
      `Commercial` and `Off-plan`—take the sale-side seller/developer path, although commercial rental and off-plan
      combinations cannot be represented reliably.
  14. `Off-plan` changes the proposal purchase timeline. The build may also infer off-plan from a non-ready
      Inventory handover value even when Requirement business line is not `Off-plan`.
  15. Website duplicate detection treats business type as part of the Lead identity/fingerprint. The same Customer
      and source with a different type may therefore produce a separate Lead rather than a duplicate continuation.
  16. Dashboard and hierarchy reporting treat the four values as mutually exclusive business lines, so combination
      reporting is impossible and Commercial versus Off-plan totals are not comparable dimensions.
- **Owner-confirmed target structure:** Replace the overloaded Lead field with: (1) Customer objective — `Buy a
  property`, `Sell my property`, `Rent a property`, `Rent out my property` or `Not yet confirmed`; (2) market-stage
  requirement; and (3) property-segment requirement. Do **not** add a separately entered Lead transaction-
  availability field. Derive Sale for Buy/Sell objectives and Rental for Rent/Rent-out objectives. Inventory
  offering mode remains an Inventory attribute, not a Lead input. The owner-confirmed market-stage values are
  `Ready / Secondary`, `Off-plan`, `Either` and `Not confirmed`; the owner-confirmed property-segment values are
  `Residential`, `Commercial`, `Land`, `Plot` and `Not confirmed`. Keep NYSA representation side in the existing
  governed Opportunity representation field.
- **Migration/compatibility requirement:** Do not reinterpret historical values silently. Introduce the new fields,
  map only unambiguous legacy values, flag `Off-plan` and `Commercial` records for governed review, preserve the
  original value as audit evidence, and version routing/qualification/matching policy changes.
- **Updated specification:** Redesign Lead and Requirement controls around Customer objective, market-stage
  requirement and property-segment requirement. Derive, rather than separately request, the Sale/Rental transaction
  path. For Buy/Rent, collect search requirements. For Sell/Rent out, obtain property facts from linked Inventory.
  Remove exact comparison across unlike concepts; display the authority/source beside each field; and add
  combination tests including residential ready purchase, residential rental, commercial sale, commercial rent-
  out and off-plan residential/commercial purchase or resale.
- **Owner-confirmed single-source requirement:** Every impacted screen, API, domain rule, integration contract,
  database constraint, report and downstream translation must obtain classification codes and permitted
  combinations from one versioned canonical classification catalogue. No browser constant, route-local array,
  AI enum, database `CHECK` list or independently maintained dropdown may remain an alternative source of truth.
  Offer, Deal and document-compliance vocabularies may retain purpose-specific codes only through explicit,
  versioned mappings to the canonical dimensions; unmapped or retired values must fail visibly and route to
  governed review rather than be silently inferred.
- **Exact dev.158 impact audit:** The verified package contains 157 relevant code/schema lines across 28 runtime or
  migration files and 13 business functions. The current four-value list is copied or constrained independently in
  11 places, with additional derivative vocabularies for website AI routing, Offers, Deals and document-compliance
  families. The affected functions are Lead capture, routing, website intake, Customer-role derivation,
  Qualification Versions, Structured Requirements, Inventory transaction authority, matching, Opportunities,
  Offers, Deals, document compliance, proposals/AI and dashboards/reporting.
- **Canonical-source implementation contract:** Introduce stable immutable codes, effective-dated/versioned labels,
  active/retired status and allowed-combination/mapping records. Serve them through one authorized read API and use
  the same catalogue in server validation. Persist canonical IDs/codes plus the catalogue version on new business
  records. Operational users may select active values but may not invent free text. Whether catalogue changes are
  performed through governed Administrator maintenance or a controlled migration remains an owner/governance
  decision; either mechanism must preserve approval, effective date and audit history.
- **Compatibility and migration control:** Preserve every legacy value and source field as audit evidence. Map only
  unambiguous values automatically; route mixed `Off-plan` and `Commercial` records and contradictory Lead,
  Requirement, Inventory or Opportunity values to an exception queue. Do not rewrite historical Offer/Deal evidence
  or recalculate historical dashboards without a separately approved restatement policy.
- **Required implementation coverage:** Remove duplicated value definitions from the browser, CRM domain, inline
  route validators, AI schema and Inventory/Opportunity constants; replace database value-list constraints with
  canonical foreign-key or mapping enforcement; update routing, qualification selection, matching, representation,
  proposal, website duplicate/continuation and reporting logic; and provide a compatibility adapter only at explicit
  legacy/external boundaries. All callers must expose the catalogue version and mapping reason in diagnostic/audit
  evidence without exposing private Customer data.
- **Acceptance boundary:** Automated tests must fail if a production path introduces another hard-coded copy of the
  business classification list. Contract tests must prove every affected UI/API consumes the same catalogue version;
  migration tests must prove ambiguous records are queued rather than guessed; and human CRM Test UAT must cover
  buyer, seller, tenant and landlord objectives across ready/off-plan and residential/commercial combinations.
- **Implementation status:** Owner confirmation recorded 24 August 2026. Locally implemented in the dev.159
  candidate through migration `103_dev159_uat062_single_source_classification.sql`, the versioned catalogue/read
  API, exception queue, catalogue-driven Lead and Requirement writes, AI schema, objective-specific qualification,
  and pinned Opportunity/Offer mapping evidence. Full impacted-path verification remains an explicit release gate;
  local implementation is not a human UAT pass.
- **Deployment status:** Deployed on CRM Test `2.1.0-dev.159`.
- **Partial human retest evidence:** The user observed the new Lead fields `Customer objective`, `Market-stage
  requirement` and `Property-segment requirement`. The supplied screenshot shows the selected combination `Buy a
  property` + `Ready / Secondary` + `Residential`. This confirms that the three distinct controls are rendered on
  CRM Test; it does not prove save/persistence or downstream propagation.
- **Retest status:** Partially observed, not passed. Still test required/invalid combinations, save and reload,
  Structured Requirement propagation, derived Sale/Rental path, objective-dependent seller/landlord behaviour,
  qualification-model selection, Opportunity and Offer mapping, AI/reporting use, and governed legacy exceptions.

### UAT-061 — Inventory register and Add Lead property picker expose only the first ten matching Inventory records

- **Status:** Newly identified by the post-UAT-059 source/package audit; not yet reported as a user-observed
  failure and therefore not marked passed or failed by human UAT.
- **Classification:** Confirmed sibling regression introduced by the same Release 2.6 list-limiting change as
  UAT-059, with a second workflow impact in Lead capture.
- **Role:** Inventory users for the main register; Sales Agent or other authorized Lead creator for the optional
  prompted-property picker. Exact role-specific human reproduction is pending.
- **Screen/workspace:** Inventory main register; CRM → Add Lead → “Property that prompted this enquiry”.
- **Record reference:** None required. Use synthetic Inventory references only and omit owner/contact evidence.
- **Prerequisites:** At least eleven permitted Inventory records. For the Add Lead path, at least eleven records
  must also be Available, approved, trusted/not-required for verification, current and non-terminal.
- **Exact verification steps:** Open Inventory with filters reset, confirm the total exceeds ten, and inspect for
  later-page controls. Then open Add Lead and inspect the optional prompted-property list for a qualifying
  Inventory record known to sort after the newest ten.
- **Expected result:** Every permitted Inventory record is reachable through pagination or load-more in the main
  register. The Add Lead picker must search or page through every qualifying Inventory record rather than use a
  prefetched subset.
- **Actual code/package result:** The Inventory UI always requests `pageSize=10`, displays `showing first`, and
  has no later-page control. The `/listings` endpoint returns a total but supports only `LIMIT`, not `page` or
  `OFFSET`. Add Lead calls the same endpoint without a page size, receives its default newest ten Available
  records, and only then filters that partial array for approval, verification, expiry and terminal status; the
  usable picker can therefore contain fewer than ten and omit valid older Inventory.
- **Severity / blocker status:** Major Inventory discoverability and Lead-source selection defect; cumulative-
  release blocker status has not been assigned by the owner.
- **Screenshots/evidence:** Source/history/exact dev.158 package audit only. Human evidence should show the
  Inventory total and absent navigation, then a sanitized qualifying Inventory reference missing from Add Lead.
- **Workaround:** A specific server-side Inventory filter or exact reference search can retrieve a known record
  in the main register. There is no reliable full-register workaround inside the Add Lead prompted-property
  picker; the Lead can be created without that optional historical link.
- **Issue:** One incomplete endpoint result is reused both as the Inventory register and as the source array for
  a business selector.
- **Confirmed RCA:** Before commit `5669016`, `/listings` returned all matching permitted Inventory. That commit
  added the default ten-row `LIMIT` and changed the main Inventory UI to request ten, without adding endpoint
  page/offset support or UI navigation. The existing Add Lead call inherited the new default limit silently;
  its client-side eligibility filtering made the truncation less visible but potentially more restrictive.
- **Package history evidence:** Every retained cumulative package inspected from dev.145 through dev.158 keeps
  the ten-row Inventory register and lacks Inventory page navigation. The exact dev.158 package also contains
  the default-limited Add Lead Inventory request. This is not new to dev.158.
- **Why automated regression did not catch it:** No located test creates more than ten qualifying Inventory
  records and proves that the main register and Add Lead can retrieve an older one. Existing selector coverage
  checks a separate Opportunity path that requests up to 100 records, not these two screens.
- **Proposed solution:** Add deterministic server-side pagination to `/listings`; add preserved-filter navigation
  to Inventory; replace the Add Lead prefetched dropdown with server-side full-register search restricted by the
  authoritative qualifying predicates; test with more than ten qualifying records and select one beyond page 1.
- **Implementation status:** Not started; audit and documentation only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Human reproduction and corrected-build retest pending.

### UAT-063 — Seller Lead capture incorrectly requires buyer-search fields and uses a buyer-side property prompt

- **Status:** Failed observation reported on CRM Test `2.1.0-dev.158`; current UI and API behaviour confirmed
  from local source and the exact cumulative implementation baseline.
- **Classification:** Newly discovered role/objective-dependent Lead-capture design defect. It is related to the
  mixed taxonomy in UAT-062 but is a separate workflow failure.
- **Role:** Sales Agent creating a Lead for an existing seller Customer. The screenshot shows the Sales-Agent
  self-assignment presentation; no user identity or private Customer details are retained here.
- **Screen/workspace:** CRM → Add Lead, seller wishing to sell their own property.
- **Record reference:** Existing synthetic seller Customer selected; private contact data and UUID are excluded.
- **Prerequisites:** Sign in as a Sales Agent, select an operational existing Customer whose role/intention is
  seller, and open Add Lead.
- **Exact steps observed:** Enter a seller-side title and choose the current `Sale` Business type. Review the
  mandatory `Preferred areas`, optional `Primary routing area`, mandatory budget range and `Property that
  prompted this enquiry` selector.
- **Expected result (owner-stated):** A seller-side flow should identify the seller's Inventory/property first.
  Preferred area and primary routing area must not require manual buyer-search input; where an Inventory record
  already exists, its maintained area/location should supply the relevant property and routing context. The
  property control must describe the seller's property/Inventory being offered, not a property that prompted an
  enquiry. Any treatment of a property not yet created or approved as Inventory remains an explicit design
  decision and is not inferred here.
- **Actual result:** The same buyer-search form is shown for the seller. `Preferred areas` is mandatory; Primary
  routing area is presented as customer search-area routing; Budget from/to is mandatory; and the only property
  link is labelled `Property that prompted this enquiry (optional)`. Selecting a property does not populate its
  area or price into the Lead fields.
- **Severity / blocker status:** Major seller-intake workflow defect; cumulative-release blocker status has not
  been assigned by the owner.
- **Screenshots/evidence:** User supplied a CRM Test screenshot showing the seller-side Lead form. The retained
  defect record deliberately excludes the displayed email, phone and UUID. Source evidence: `public/app.js`
  renders one common form; `src/routes/crm.js` requires both budget bounds and at least one Preferred area for
  every Lead; the selected Inventory is stored only as `listing_id`.
- **Workaround:** Manually enter the Inventory area as Preferred areas and repeat the asking-price context in the
  mandatory budget fields, then optionally link an already-operational Inventory record. This duplicates data,
  can create inconsistency and does not support a new/unapproved seller property, so it is not an acceptable
  permanent solution.
- **Issue:** Lead capture does not branch by Customer objective/representation side and therefore imposes
  buyer/tenant search semantics on seller/landlord intake.
- **Confirmed current processing:** The browser marks Preferred areas and both budget bounds required. Both Lead
  creation APIs reject an empty Preferred-area list or missing budget bound. Primary routing area is optional but,
  when supplied, must also be present in Preferred areas. The property selector is populated only from approved,
  verified/current, non-terminal Inventory. The API rejects a selected Inventory that is unavailable and stores
  the accepted record as a historical `listing_id` link; it performs no server-side derivation of area, routing
  area or price from that Inventory.
- **Confirmed consequence:** A seller with a property that has not yet completed Inventory creation and approval
  cannot represent that property through this selector. Even when an approved Inventory record exists, the agent
  must duplicate maintained property data into buyer-oriented Lead fields, creating avoidable divergence.
- **Owner-confirmed requirement:** Render dependent fields from Customer objective. For `Buy a property` and
  `Rent a property`, capture preferred areas, property preferences, budget and timeline. For `Sell my property`
  and `Rent out my property`, use a governed `Property / Inventory being offered` step and derive area, segment,
  property type, market stage and asking-price context from linked Inventory without duplicate manual entry. Do
  not show or require buyer-search Preferred areas or Primary routing area in that path. The handling of a property
  not yet present as approved Inventory, and the final routing destination, remain pending owner decisions.
- **Implementation status:** Not started; observation, source confirmation and proposal only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Corrected-design implementation and human retest pending.

### UAT-064 — Customer selection is hard-gated by prior matching evidence and exposes no AI-ranking action

- **Status:** Failed observation reported on CRM Test `2.1.0-dev.158`; no corrected behaviour has been observed.
- **Classification:** Newly discovered Opportunity workflow defect. This is consistent with, but separate from,
  the earlier owner-confirmed rule that customer preferences should affect AI-assisted ranking rather than make
  otherwise operational Inventory ineligible.
- **Role:** Sales Agent progressing an Opportunity and preparing properties for Customer review.
- **Screen/workspace:** CRM → Opportunity → Governed Customer Selection.
- **Record reference:** User-observed Opportunity; no Customer, contact, owner, authority or other private record
  data is retained in this defect record.
- **Prerequisites:** Open an active Opportunity with available operational Inventory and no property carrying both
  the exact governed matching candidate evidence and latest shortlisted decision demanded by this section.
- **Exact steps observed:** Open Governed Customer Selection; review the empty state and available actions. The
  screen says to select only properties with an exact governed matching run and current broker shortlist decision,
  reports that no property meets both conditions, and provides no visible action to ask AI to rank available
  Inventory.
- **Expected result (owner-confirmed):** The agent must be able to request an explainable AI-assisted ranking of
  available operational Inventory for the Opportunity. Ranking and shortlist evidence may guide and document the
  decision, but the absence of a prior exact matching run must not itself prevent the agent from reviewing or
  deliberately selecting otherwise valid Inventory. Genuine operational hard blocks must remain separate and
  visibly explained.
- **Actual result:** Customer selection is empty because no property has the required matching-run candidate and
  current shortlist evidence. The section offers no visible `Generate ranking`, `Refresh ranking` or equivalent
  action, leaving the user without a path to create the prerequisite evidence from this workflow.
- **Additional confirmed observation:** The later screenshot shows that the same Opportunity already has an active
  Inventory assignment and an Offer created for that property. Governed Customer Selection nevertheless remains
  empty because the separate exact-matching-candidate and latest-shortlist-decision evidence is absent. The failure
  therefore cannot be explained by the Inventory not being linked to the Opportunity or by the Opportunity not
  having progressed far enough to create an Offer.
- **Confirmed workflow consequence:** Inventory can progress through active Opportunity assignment and into Offer
  creation while remaining unavailable for governed Customer review. Customer-selection preparation is therefore
  applying a stricter, separate evidence gate from Offer creation, producing an internally inconsistent workflow.
- **Severity / blocker status:** Major workflow blocker for preparing Customer property selections; cumulative
  release blocker status has not been assigned by the owner.
- **Screenshots/evidence:** User supplied a CRM Test screenshot of the Governed Customer Selection empty state,
  including `PREPARED — NOT SENT` and the exact matching/shortlist dependency. A later screenshot shows the empty
  panel on the same page as an active Inventory assignment and an already-created Offer. Displayed record IDs and
  user names are deliberately not retained; no private data is reproduced.
- **Workaround:** None confirmed. Navigating elsewhere in search of an undocumented matching action is not an
  acceptable governed workflow and has not been treated as a workaround.
- **Issue:** A ranking aid has been implemented as a prerequisite hard gate while the same screen exposes no way
  to generate the required ranking evidence.
- **Confirmed RCA:** Not yet established. The screenshot confirms the behaviour and missing visible action; it
  does not prove which route, domain rule or UI wiring created the condition.
- **Proposed solution:** Add an explicit Opportunity action to generate or refresh explainable AI-assisted ranking
  from all operationally eligible available Inventory; show scores, reasons, warnings and genuine operational
  exclusions separately; allow the agent to shortlist or deliberately select a valid lower-ranked property with
  recorded reason; then prepare the governed Customer selection from that decision. Do not use preference or
  classification mismatches as hard eligibility failures.
- **Implementation status:** Not started; observation and owner requirement recorded only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158.** Corrected workflow implementation and human retest remain pending.

### UAT-065 — Generated Offer PDF is incorrectly classified, incomplete and not client-ready

- **Status:** Failed observation reported on CRM Test `2.1.0-dev.158`; current PDF generation behaviour and the
  two immediate source defects were confirmed in the exact cumulative dev.158 package.
- **Classification:** Newly discovered client-facing document/content defect. The hard-coded `Commercial Offer`
  classification is a downstream manifestation of UAT-062, while the missing Inventory reference, absent property
  particulars, narrative, disclaimers and presentation standard are separate PDF-output failures.
- **Role:** NYSA Agent creating an Offer revision for a viewed property and reviewing its generated PDF.
- **Screen/workspace:** CRM → Opportunity → Offer → generated immutable Offer PDF.
- **Record reference:** Synthetic Offer and Inventory references were visible in the screenshot; Customer contact
  details are deliberately excluded from this retained defect record.
- **Prerequisites:** Create an Offer revision against an existing selected Inventory record and open/download the
  generated PDF.
- **Exact steps observed:** Generate Offer Revision 1; review the document title, recipient/property panel,
  commercial terms, narrative and disclaimer content.
- **Expected result (owner-stated):** Produce a polished private Offer that can be sent to HNW clients. It must use
  the correct directional title—Offer to purchase, Offer to sell, Offer to rent, or Offer to rent out/lease—show
  meaningful Inventory/property details, introduce the proposal in professional language, present its terms and
  conditions clearly, and include suitable approved disclaimers in a premium, well-spaced branded format.
- **Actual result:** Both header and main title say `Commercial Offer` irrespective of the intended Offer direction.
  The document shows a project/name and an internal Inventory ID area but then says `Inventory Not recorded`, gives
  no useful property particulars, contains no introductory offer narrative, uses only a short generic footer
  sentence, and reads as a one-page system extract rather than a client-ready Offer.
- **Meaning of `Inventory Not recorded`:** In this PDF it does **not** establish that the Inventory record is
  missing. The Offer is linked to Inventory; the message is the PDF template's fallback because the generation
  input did not contain `inventoryReference`.
- **Severity / blocker status:** Major client-document and reputational defect; generated PDF should not be sent to
  a client in its current form. Cumulative-release blocker status has not been separately assigned by the owner.
- **Screenshots/evidence:** User supplied a screenshot of the generated one-page Offer PDF. The retained record does
  not reproduce the visible Customer email or phone. Exact-package evidence: `src/offer-pdf.js` hard-codes
  `PRIVATE COMMERCIAL OFFER` and `COMMERCIAL OFFER`; `src/routes/opportunities.js` builds the creation-time property
  row without selecting `inventory_reference`, then passes that partial row to the PDF generator.
- **Workaround:** Do not send the generated PDF. Prepare an externally controlled manual Offer using verified CRM
  facts and approved wording, while retaining the system Offer revision as internal evidence. This duplicates work
  and risks inconsistency, so it is temporary only.
- **Issue:** The immutable Offer evidence file is generated from an incomplete property projection and a fixed
  commercial template rather than the governed Offer direction, parties, Inventory facts and approved client-
  communication standard.
- **Confirmed RCA — false Inventory message:** The Offer creation query selects project, area, property type, price
  and currency but omits `inventory_reference`. `makeOfferPdf()` prints `Inventory ${listing.inventoryReference ||
  'Not recorded'}`, so a linked Inventory is incorrectly described as unrecorded.
- **Confirmed RCA — wrong title:** `makeOfferPdf()` unconditionally renders `PRIVATE COMMERCIAL OFFER` and
  `COMMERCIAL OFFER`; it does not derive a title from Offer direction. This is confirmed in both local source and
  the exact dev.158 package.
- **Confirmed current content limitation:** The PDF template uses only project/name and Inventory reference in its
  property panel. It does not render maintained area/community/building, unit/property type, bedrooms, bathrooms,
  size, readiness/market stage, developer, asking-price context, availability evidence, approved imagery or other
  material property particulars.
- **Owner-confirmed directional titles:** Use `Private Offer to Purchase`, `Private Offer to Sell`, `Private Offer
  to Rent`, or `Private Offer to Rent Out / Lease`, following the four UAT-062 directions. `Commercial` is a
  property segment and `Off-plan` is market stage; neither may replace Offer direction in the title.
- **Required property presentation:** Show the customer-facing property name as the main identifier, then the
  Inventory reference as a secondary audit reference. Populate applicable verified facts from the exact Inventory
  snapshot used for the Offer: community/area, building/project, unit/property type, bedrooms/bathrooms, size,
  readiness/market stage, developer where relevant, asking-price context, current availability evidence and
  approved customer-use imagery where rights permit. Missing optional facts must be omitted or clearly labelled;
  the PDF must never imply that linked Inventory is absent merely because one display field was not projected.
- **Required opening narrative:** Use NYSA's professional brokerage-facilitator voice. Do not imply that NYSA is
  willing to purchase, sell, rent or lease the property, and do not say it proposes the transaction `on behalf of`
  the Customer. Direction-specific baseline copy for owner/editorial/legal review: purchase — `NYSA Realty is
  pleased to confirm its agreement to broker the proposed purchase of [Property] and to facilitate the transaction
  between the buyer and seller on the terms set out below.`; sale — use `proposed sale` between seller and buyer;
  rent — use `proposed rental` between tenant and landlord; rent out/lease — use `proposed lease` between landlord
  and tenant. Follow with: `The transaction remains subject to agreement between those parties and execution of
  the required MOU and transaction documents.` Do not invent a counterparty name; it remains optional under UAT-062.
- **Required document structure:** (1) confidential/private header and correct directional title; (2) Offer and
  revision references; (3) only the non-duplicative transaction-party context required for understanding, plus
  optional counterparty and NYSA submitting-agent details when populated;
  (4) premium property overview with approved imagery and key facts; (5) amount, deposit, financing, validity,
  payment terms and conditions; (6) clearly stated acceptance/counteroffer process; (7) document/revision control;
  and (8) approved disclaimer and contact footer. The layout must remain readable when optional sections expand to
  multiple pages and must repeat brand, confidentiality, document reference and page numbering appropriately.
- **Owner-confirmed non-duplication and optional-field rule:** Scan the complete generated document before release
  and assign each business fact one primary display location. Do not repeat `Customer role` when the directional
  title and opening already make the transaction context clear; do not repeat Community or the same property facts
  across summary and profile sections; and do not repeat commercial-term cards on the property page when the cover
  and terms page already present them. Repetition is permitted only for controlled navigation/audit elements such
  as document reference, revision, confidentiality, page number and a concise cover summary whose detail appears
  later. Optional Counterparty name and other blank optional fields must be omitted entirely, not printed as `Not
  specified`, `Not recorded` or equivalent placeholder text.
- **Proposed disclaimer pack — approval required, not final legal text:** State that the Offer is confidential and
  intended for its recipient; prominently states its exact validity date and Dubai-time deadline; permits the
  recipient to accept, reject or counter before expiry; and explains that the Offer may be withdrawn and otherwise
  expires automatically at the deadline. It must state that no MOU or other binding agreement has yet been executed
  and that, until the required MOU/contract is signed and governed conditions are completed, the document is for
  consideration only, does not reserve Inventory and does not create an obligation to complete. It must also state
  that property particulars, availability and third-party information require reconfirmation, and that NYSA does
  not provide legal, tax, valuation or financial advice through the document. The final treatment of withdrawal/
  cancellation rights, enforceability, jurisdictional notices and regulatory disclosures requires owner/legal/
  compliance approval; the template must not make an unsupported legal conclusion.
- **Privacy decision pending:** The current PDF prints recipient email and phone. Whether either is necessary in a
  client-facing Offer remains an explicit owner/privacy decision; the recommended default is data minimisation and
  omission unless a governed template purpose requires it.
- **Proposed solution:** Replace the fixed one-page template with a direction-aware, versioned Offer-letter template;
  build an immutable verified property snapshot containing all approved display fields and media references; pass
  the Inventory reference explicitly; generate party-aware narrative and mapped disclaimers; and add automated PDF
  content/layout tests plus human visual approval for every direction and representative property combination.
- **Implementation status:** Not started; observation, confirmed source RCA and document requirements recorded.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Failed on dev.158.** Corrected PDF generation and user-observed HNW-readiness retest pending.

### UAT-066 — Agent offboarding does not reconcile active operational ownership before access removal

- **Status:** Business-owner concern recorded and current dev.158 source behaviour confirmed; no corrected behaviour
  has been observed.
- **Classification:** Newly discovered user-offboarding and operational-continuity governance defect.
- **Role:** Administrator or authorized user maintainer suspending/revoking a departing Agent, and Full
  Administrator ending the Agent's employment record.
- **Screen/workspace:** Administration → User records → access status; Administration → Agent employment and leave
  → Agent employment.
- **Record reference:** No real employee or private employment information is retained. Testing must use a synthetic
  Agent with synthetic linked work.
- **Prerequisites:** A synthetic active Sales Agent owns multiple active Leads and open Opportunities, with linked
  Offers and representative pending operational work such as tasks or approval responsibilities.
- **Exact source-confirmed behaviour:** The User-record access action changes the broker status to `suspended` or
  `revoked` and deletes active sessions. It does not first query, display, block on or transfer the Agent's active
  Leads, open Opportunities, linked Offer servicing ownership, tasks, approvals or other operational
  responsibilities. The separate Agent-employment workflow can activate an `ended` employment version, but it
  does not invoke the access action or an operational-ownership reconciliation workflow.
- **Expected result (owner direction):** Offboarding must begin from the departing user and show a complete,
  categorized impact register before final inactivation. The Administrator must assign eligible replacements for
  all active responsibilities, with controlled bulk selection and per-record exception handling. Final access
  removal must be blocked until every mandatory responsibility is transferred, closed or deliberately accepted by
  an authorized exception owner. Historical creator/originator attribution must remain immutable.
- **Actual result:** Dev.158 permits access suspension/revocation without the active-responsibility reconciliation
  described above. Individual Lead-driven coordinated reassignment exists, but there is no user-centric portfolio
  view or atomic offboarding control that proves all of the departing Agent's work has been dealt with.
- **Required impact categories for design and testing:** Active and offered Lead assignments; open Opportunity
  ownership; servicing ownership of linked Offers and negotiations; active Inventory-to-Opportunity assignments;
  pending Viewings, follow-ups and Tasks; reservations/Bookings and open Deals; approval/review queues; maintained
  team, routing and reporting responsibilities; Listing/Inventory responsibilities where applicable; campaigns,
  customer communications and any other future-dated work owned by the Agent. Each category must distinguish work
  that can be transferred from immutable authorship, originating-agent attribution or historical audit evidence
  that must not change.
- **Required offboarding sequence:** (1) select the departing user and proposed effective date; (2) generate a
  current impact snapshot and counts by category; (3) select one or more eligible replacement users/teams; (4)
  preview every proposed transfer and unresolved exception; (5) apply transfers transactionally or in a resumable
  governed batch with an immutable audit record; (6) require acceptance where the receiving workflow normally
  requires it; (7) recheck for newly created or still-active responsibilities; and only then (8) end employment,
  revoke access, terminate sessions and prevent further assignment/routing to that user.
- **Critical sequencing rule:** Urgent security suspension may terminate login immediately, but it must create a
  mandatory offboarding exception owned by an Administrator/Director and remove the unavailable Agent from routing.
  It must not silently imply that operational responsibilities were transferred. Planned departure should complete
  responsibility reconciliation before the effective access-revocation time.
- **Severity / blocker status:** Major operational-continuity, customer-service and control defect. Cumulative-
  release blocker status has not been separately assigned by the owner.
- **Screenshots/evidence:** No screenshot supplied for this specific control. Evidence is the owner-stated business
  scenario and local/exact-dev.158 source inspection of the User access and Agent-employment routes and UI.
- **Workaround:** Reassign each known Lead and its selected open Opportunities through `Review reassignment`, then
  manually inspect other queues and responsibilities before revoking access. This is incomplete and error-prone
  because dev.158 provides no authoritative departing-user portfolio or completeness check; it is not an accepted
  permanent control.
- **Issue:** Access state, employment state and operational ownership are maintained separately without a governed
  offboarding boundary.
- **Confirmed RCA:** The access-status routes directly update the broker status and remove sessions without an
  active-responsibility query or transfer prerequisite. The Agent-employment activation route versions employment
  status independently and has no call to access-state or operational-reassignment logic. Existing coordinated
  reassignment is Lead-centric rather than departing-user-centric.
- **Proposed solution:** Add a governed Agent Offboarding workspace under User/Employment Administration, backed by
  a server-side responsibility-impact service and transactional/resumable reassignment operations. Block planned
  revocation while mandatory items remain; support emergency suspension with an explicit unresolved-work queue;
  preserve original authorship and attribution; and add authorization, concurrency, rollback, completeness and
  audit tests across every supported responsibility category.
- **Implementation status:** Not started; owner requirement, current behaviour and source RCA recorded only.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** Human offboarding journey and corrected-control retest pending.

### UAT-067 — Customer acceptance is missing from Negotiation, preventing workflow completion

- **Status:** **Owner-confirmed UAT blocker.** User-observed failure was recorded after the receiving Agent accepted
  the reassigned Lead. The receiving Agent cannot record the Customer's acceptance or progress the Opportunity to
  Booking. Current dev.158 source behaviour and the separate Booking acceptance design are confirmed, but a
  theoretical source path is not evidence that the deployed human journey works.
- **Classification:** Newly discovered Offer-to-Booking business-workflow defect, with related navigation and
  guidance failures. Regression status has not been established. This is separate from the Lead-assignment
  acceptance itself, which the user observed as completed.
- **Role:** Receiving Sales Agent (`UAT158 Agent Alpha Two` in the synthetic UAT case).
- **Screen/workspace:** Opportunity → step 4, Negotiation; related control is under step 5, Booking & reservation.
- **Record reference:** Synthetic Offer `NYSA-OF-202608-000005`, current Revision 2. No private Customer or
  counterparty information is retained.
- **Prerequisites:** The receiving Agent has accepted the reassigned Lead; the Opportunity and Offer show that
  Agent as current owner; the exact current Offer revision has been sent and is `Viewed`; the revision remains
  within its validity period; and no existing reservation blocks the Inventory.
- **Exact steps observed:** (1) sign in as the receiving Agent after accepting the reassignment; (2) open the
  Opportunity; (3) open step 4, Negotiation; (4) review the current `Viewed · Revision 2` Offer; (5) open the
  `Customer / negotiation update` dropdown; (6) look for an acceptance outcome.
- **Expected result — owner-confirmed business rule:** `Customer / counterparty accepted this revision` must be an
  available Negotiation outcome for an eligible current Offer revision. Recording it must identify and lock the
  exact accepted revision, retain the responding party and communication evidence, change the Offer to `Accepted`
  and complete step 4, Negotiation. Step 5, Booking & reservation, must then begin as a separate subsequent action
  using that exact accepted revision. Acceptance alone must clearly state that Inventory is not yet reserved.
- **Actual result:** The Negotiation dropdown contains receipt/viewing, counteroffer, rejection, expiry and
  withdrawal outcomes, but no acceptance outcome and no visible explanation or forward action in the supplied
  screenshot. The user could not determine how to record acceptance after reassignment.
- **Severity / blocker status:** **Blocker — explicitly confirmed by the business owner.** The receiving Agent
  cannot complete the Offer-acceptance transition or proceed to Booking. This journey must not be treated as passed
  or operationally usable until corrected behaviour is deployed and observed in CRM Test.
- **Screenshots/evidence:** User-supplied screenshot shows Offer `NYSA-OF-202608-000005`, owner `UAT158 Agent Alpha
  Two`, `Viewed · Revision 2`, and the complete Negotiation dropdown without acceptance.
- **Workaround:** **No confirmed or acceptable workaround.** Using Booking to create the missing Negotiation
  acceptance would not follow the owner-confirmed process. Do not fabricate an acceptance, choose another outcome,
  edit history or bypass the governed workflow.
- **Issue:** Dev.158 removes a required Negotiation outcome and incorrectly moves Customer acceptance into the
  Booking transaction. Negotiation therefore cannot reach its legitimate completed state, while Booking says an
  accepted exact Offer is required even though the current Booking route attempts to create both acceptance and
  reservation.
- **Confirmed RCA:** `public/offer-ui.js` deliberately removes `accepted` from the Negotiation choices for `sent`,
  `viewed` and `countered` Offers. `src/routes/opportunities.js` also rejects a direct `accepted` negotiation event
  and instructs the caller to use Booking/reservation. The Booking form accepts `sent`, `viewed` or `countered`
  Offers and the Booking route atomically updates the Offer to `accepted`, records the accepted revision and creates
  the reservation. This contradicts the owner-confirmed boundary: acceptance is a Negotiation decision and
  reservation is the following Booking action. The progress guidance exposes the contradiction by saying Booking
  requires an accepted exact Offer while the Booking route is also responsible for creating that acceptance.
- **Reassignment check:** Reassignment is not the confirmed cause. The screenshot shows the Offer owner as the
  receiving Agent, and the coordinated-reassignment implementation transfers current Opportunity/Offer servicing
  ownership while preserving authorship. The Booking form uses current Opportunity write authority rather than
  requiring the original Offer creator. A human step-5 test is still required to confirm that no deployed-data or
  scope condition hides the form for this specific record.
- **Earlier rejected-version check:** A rejected Offer is terminal by design. It cannot be accepted or receive
  Revision N+1. The Agent must create a separate linked recovery Offer at Revision 1 for the same property, send
  that recovery revision, record acceptance in Negotiation, and then continue separately to Booking. The recorded
  UAT-053 defect may block that recovery because dev.158's `Renegotiate same property` action was observed not to
  expose its form. Acceptance of the rejected predecessor itself must remain unavailable; availability of the
  atomic action must instead be tested on the new recovery Offer.
- **Proposed solution — aligned to owner decision:** Restore `Customer / counterparty accepted this revision` in
  Negotiation for eligible `sent`, `viewed` and `countered` Offers. The server must record the accepted event and
  exact `accepted_revision_id` transactionally, complete Negotiation, and show `Accepted — Inventory not yet
  reserved`. Step 5 must then accept only an already accepted, still-valid exact revision and create the reservation
  as its own governed transaction with deposit/reservation evidence and concurrency protection. If Inventory becomes
  unavailable between acceptance and Booking, retain the accepted Offer evidence, block reservation with a precise
  explanation and open governed recovery. Add focused tests for original Agent, reassigned receiving Agent,
  countered revision, linked recovery after rejection, concurrent reservation, expiry and permission/evidence
  blockers.
- **Evidence correction (24 August 2026):** The earlier release summary said protected real-database evidence had
  passed, but the only UAT-067/UAT-068-labelled test then present was a static source-text assertion. That statement
  was unsupported and has been withdrawn. A separate protected test now exists at
  `test/dev159-uat067-068-real-db.integration.test.js`. It starts the real Opportunity router, uses the disposable
  PostgreSQL fixture, proves Booking returns `409` before acceptance, records acceptance through the Negotiation
  HTTP endpoint, and independently confirms the exact accepted revision and `accepted` negotiation event in the
  database. It then proves the separate Booking succeeds only after that acceptance.
- **Implementation status:** Corrected locally for dev.159 and covered by the dedicated real HTTP/PostgreSQL test;
  not deployed.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Protected runtime evidence passed locally; blocked on dev.158 for human retest.** Corrected behaviour must be deployed and then manually retested using
  the reassigned receiving Agent, the exact current Viewed revision, Negotiation acceptance, subsequent Booking and
  the rejected-predecessor recovery path. Rejected-predecessor recovery also remains separately open under UAT-053.

### UAT-068 — Governed Deal creation fails after successful acceptance and reservation

- **Status:** **Failed on dev.158 and blocks the tested journey.** The user followed the available step-5 path,
  recorded acceptance/reservation and obtained an active Booking, but `Create governed Deal` returned `Internal
  server error`.
- **Classification:** Newly discovered Deal-lineage and database-schema integration defect. This is not classified
  as invalid test data and is separate from UAT-067's missing Negotiation acceptance outcome.
- **Role:** Receiving Sales Agent after coordinated reassignment.
- **Screen/workspace:** Opportunity → step 6, Deal & completion → `Create governed Deal from active reservation`.
- **Record reference:** Synthetic Booking `NYSA-BK-202608-000003`, synthetic Inventory `UAT158INV004`, exact
  accepted Offer Revision 2. No private Customer or counterparty information is retained.
- **Prerequisites:** The reassigned Agent accepted the Lead assignment; the current Offer revision was accepted
  through the available step-5 workaround; the Booking is active and reserved; the screen displays the exact
  accepted revision and permits entry of a future target-completion date.
- **Exact steps observed:** (1) open step 6, Deal & completion; (2) expand `Create governed Deal from active
  reservation`; (3) retain or enter a valid future target-completion date; (4) select `Create governed Deal`.
- **Expected result:** CRM creates one governed Deal linked to the same Opportunity, active Booking, exact accepted
  Offer revision, Inventory and active Inventory assignment; adds the primary buyer/tenant and available inherited
  seller/landlord party evidence; instantiates the approved checklist version; advances the Opportunity to Deal;
  and displays the governed Deal reference and completion controls.
- **Actual result:** The action returns only `Internal server error`; no usable governed Deal is displayed and the
  user cannot proceed with Deal parties, checklist, approval or completion.
- **Severity / blocker status:** **Blocker.** The end-to-end Customer/Opportunity journey cannot progress beyond an
  active reservation. The Booking may continue ageing while Deal creation remains unavailable.
- **Screenshots/evidence:** User-supplied screenshot shows the active Booking, exact accepted Revision 2, future
  target completion input and enabled `Create governed Deal` action on the screen that produced the internal error.
- **Workaround:** **None confirmed.** Do not create a duplicate Booking, alter the accepted Offer, release the
  reservation or repeatedly submit the action to bypass this defect. The corrected route must preserve the current
  Booking and create exactly one Deal idempotently or return the already-created Deal if a retry follows an
  uncertain response.
- **Issue:** The route's staged Deal-lineage construction is incompatible with a retained immediate database
  constraint. The application also converts the database exception into a generic error, leaving the Agent without
  a safe corrective action or correlation reference.
- **Confirmed RCA:** Migration `052_release2_full_remediation_foundation.sql` created
  `deals_single_property_ck`, which immediately requires exactly one of `deals.listing_id` or
  `deals.external_property_id` to be non-null. Migration `099_dev153_inventory_assignment_lifecycle.sql` made the
  direct Deal pointers nullable and introduced `deal_inventory_linkages`, but it did not remove or revise that
  earlier single-property check. The current Deal-creation route first inserts the new Deal with `booking_id`,
  `listing_id`, `external_property_id`, `offer_id` and `accepted_offer_revision_id` all explicitly `NULL`, intending
  to insert the linkage and update those pointers afterward. The initial insert therefore violates
  `deals_single_property_ck` immediately; execution never reaches the lineage insert/update. The generic HTTP error
  handler returns `Internal server error` for the unhandled PostgreSQL exception.
- **Exact-package confirmation:** The final cumulative dev.158 ZIP contains the same temporary-null Deal insert,
  contains `deals_single_property_ck` in migration 052, makes the direct pointers nullable in migration 099, and
  does not drop or revise the retained single-property constraint.
- **Why previous automated evidence did not close this:** Existing local tests assert the presence of the Deal
  route, lineage table and deferred lineage-consistency trigger, but the reviewed coverage does not execute this
  initial Deal-creation sequence against the cumulative real PostgreSQL constraints. A source-presence assertion
  cannot detect the immediate check-constraint conflict. The human UAT result is therefore the authoritative
  failure observation.
- **Proposed solution:** In the initial Deal insert, populate the direct Booking, listing/external-property, Offer
  and accepted-revision pointers from the already locked active Booking rather than inserting temporary nulls.
  Then insert the authoritative `deal_inventory_linkages` row and set `current_inventory_linkage_id` within the
  same transaction. The existing deferred lineage-consistency trigger can validate the final mirrored state at
  commit, while `deals_single_property_ck` remains satisfied throughout. Add explicit idempotency/concurrency
  handling and return a safe actionable error with a correlation reference for any unexpected database failure.
  Add a real cumulative-PostgreSQL integration test covering internal Inventory and external/co-broker property
  Deal creation, inherited parties, checklist instantiation, rollback, retry and reassigned-Agent authority.
- **Evidence correction (24 August 2026):** The earlier release summary's protected Deal-evidence claim was not
  backed by a Deal-creation runtime test and has been withdrawn. The new protected test
  `test/dev159-uat067-068-real-db.integration.test.js` now calls the real Deal HTTP endpoint after exact-revision
  acceptance and active Booking, receives `201`, and reads the committed Deal, current linkage, Opportunity,
  checklist, primary buyer party and audit rows back from PostgreSQL. It confirms the Deal and linkage carry the
  same Opportunity, Inventory, active assignment, Offer, accepted revision and Booking IDs; a retry returns `409`
  and the database still contains exactly one Deal.
- **Implementation status:** Corrected locally for dev.159 and covered by the dedicated real HTTP/PostgreSQL test;
  not deployed.
- **Deployment status:** No correction deployed. CRM Test remains on cumulative `2.1.0-dev.158`.
- **Retest status:** **Protected runtime evidence passed locally; CRM Test human retest remains blocked pending deployment.** After correction is deployed, retest with the same active Booking where safe,
  confirm exactly one governed Deal is created, verify all lineage mirrors and parties/checklist, and confirm no
  partial Deal or consumed reference remains from the failed request.

### UAT-069 — Seller/Landlord qualification is not governed separately from Buyer/Tenant qualification

- **Status:** Previously uncatalogued dev.158 business-logic/design gap. The objective-specific framework is deployed
  in dev.159, but no active owner-approved Qualification Version is available for the human-tested `buy` objective.
- **Classification:** Objective-side Lead Qualification defect related to the mixed classification model in
  UAT-062, but requiring its own qualification questions, evidence and acceptance criteria.
- **Role:** Sales Agent assessing a Lead for a Customer who wants to sell their Inventory. The same structural
  issue applies to Landlord versus Tenant rental objectives.
- **Screen/workspace:** Lead detail → `Assess qualification`; Administration → Lead Qualification Versions.
- **Record reference:** No private Customer or Lead reference is required or retained for this business-rule
  observation.
- **Prerequisites:** Create or open an assigned seller-side Lead and review the active Qualification Version and
  its questions. Compare the evidence relevant to a seller with the evidence required from a buyer.
- **Exact observation reported:** When creating a Lead for a seller who wants to sell their Inventory, the user
  stated that qualification must be assessed separately and must not reuse the buyer assessment.
- **Expected result — owner-stated boundary:** Qualification must follow Customer objective/representation side.
  Buyer/Tenant qualification may assess budget, funding, search clarity and acquisition/occupancy timeline.
  Seller/Landlord qualification requires its own approved questions—for example property/authority readiness,
  asking terms, motivation, decision authority, availability/access and transaction timeline. The precise factor
  set, weights, thresholds and mandatory evidence remain a business-owner confirmation and must not be invented
  from this observation.
- **Actual result:** Dev.158 selected a Qualification Version only from the overloaded Lead `businessType` value.
  Dev.159 now performs objective-specific lookup. During human retest, a contacted Lead with objective `buy` was
  stopped with `No active Lead Qualification Version is available for Customer objective buy`; the framework did
  not fall back to an unrelated questionnaire, but qualification could not proceed because the required governed
  business configuration was absent.
- **Severity / blocker status:** Major business-logic and data-quality defect. It can produce an irrelevant score
  and misleading readiness classification. The owner has not assigned it a cumulative-release blocker status.
- **Evidence:** User's exact written requirement plus source and exact dev.158 package inspection. The package's
  questionnaire GET and assessment POST queries both select an active model where `business_line` equals
  `lead.businessType`, falling back to an All-business-lines model. Neither query considers Customer objective,
  Customer role, Inventory ownership side or Opportunity representation side.
- **Workaround:** Do not treat a buyer-oriented score as authoritative for a Seller/Landlord Lead. Record the
  relevant seller/landlord facts through available governed evidence and obtain Manager review. This is only an
  operational precaution; it does not correct the saved Qualification Assessment or scoring model.
- **Issue:** Qualification model selection inherits the same mixed and directionless classification criticized in
  UAT-062, so distinct transaction-side readiness questions cannot be selected reliably.
- **Confirmed RCA:** Model lookup is keyed only by the original Lead `businessType` or a null/All-lines fallback.
  The current four-value taxonomy contains transaction family, market stage and property segment, but no Customer
  objective/direction. Consequently `Sale` and `Rental` each collapse two materially different qualification
  populations.
- **Proposed solution:** Complete the UAT-062 canonical classification decision, then version Qualification Models
  by canonical Customer objective, with any additional approved market-stage/segment applicability expressed as
  explicit mappings. Require a compatible active model, show its objective and version to the Agent, freeze the
  exact model/questions/answers/contributions on the assessment, and route missing or incompatible coverage to a
  visible governance exception. Preserve historical assessments without reinterpreting them.
- **Business confirmation still required:** The owner must approve the Seller and Landlord factor sets, evidence,
  weights, thresholds, override authority and whether any common factors may be shared with Buyer/Tenant models.
  No assumptions in the examples above are approved rules until that confirmation is recorded.
- **Implementation status:** Objective-specific model selection and safe missing-model rejection are implemented.
  The actual questions, weights, thresholds and evidence rules remain unconfigured pending business approval.
- **Deployment status:** Framework deployed on CRM Test `2.1.0-dev.159`; approved active objective-specific models
  are not yet available for the observed `buy` path.
- **Retest status:** Blocked by missing business configuration. Approve, create, test, approve and activate separate
  governed Qualification Versions for Buy, Sell, Rent and Rent out, then execute human CRM Test for all four
  objectives. The observed safe rejection is not a completed qualification pass.

### UAT-070 — Successful password-reset request leaves the form permanently busy

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 shared authentication busy-state user-interface defect; not currently identified
  as a regression.
- **Role:** Signed-out active NYSA user requesting account recovery.
- **Screen/workspace:** Sign in → Forgot password → Reset your password.
- **Record reference:** Private email address excluded from this UAT record.
- **Prerequisites:** An active internal user account with a valid NYSA email address; user is signed out.
- **Exact steps:** Open `Forgot password`, enter the account email address, submit `Request password reset`, and
  observe the form after the generic privacy-preserving success confirmation appears.
- **Expected result:** After the request receives a response, the submit button must leave its busy state and return
  to `Request password reset`. The user must be told that the request is complete and that an Administrator must
  issue the one-time code through an approved private channel. A second submission must remain possible when
  deliberately required.
- **Actual result:** The generic success confirmation appeared, proving that the request completed, but the button
  remained disabled as `Please wait…` for at least three minutes. The screen therefore falsely appeared to be
  processing indefinitely. A later human test also confirmed the shared defect on ordinary sign-in: after an
  invalid-credentials response was displayed, the sign-in button remained disabled as `Please wait…`.
- **Severity / blocker status:** Moderate usability and recovery-control defect; non-blocker for this observed case
  because the request itself completed, but it can cause duplicate requests, support escalation and uncertainty
  during account recovery.
- **Evidence:** User-supplied dev.159 screenshots for both successful reset request and failed sign-in. Private email
  values visible in the original screenshots are not copied into this document.
- **Workaround:** Treat the displayed generic success confirmation as completion; do not continue waiting or submit
  repeated requests. Obtain the Administrator-issued code through the approved private channel, then use
  `Set new password`.
- **Issue:** The successful request does not restore the form from its loading state.
- **Confirmed RCA:** The async submit handler calls `setAuthBusy(e.currentTarget, true)` synchronously, then awaits
  the API request. In its `finally` block it tests `e.currentTarget.isConnected` and uses `e.currentTarget` again.
  The DOM `Event.currentTarget` value is no longer retained after the synchronous event-dispatch phase and becomes
  null while the async handler is awaiting. Consequently the guarded `setAuthBusy(..., false)` call is skipped even
  though the API returned successfully. The visible success message and the source handler independently agree on
  this failure path. Source review also found the same unstable post-await `e.currentTarget` use in reset-code
  redemption and in the error paths for setup, sign-in, invitation redemption and registration. Those additional
  paths are confirmed impacted code scope but are not recorded as human-observed failures until executed in UAT.
- **Proposed solution:** Capture the form before the first await (`const form = e.currentTarget`) and use that stable
  reference for both busy-state calls and the connectivity check. Apply the same audit to every asynchronous form
  handler that accesses `e.currentTarget` after an await. Add a real browser test that submits the reset request,
  receives both success and error responses, and verifies that the button is re-enabled with its original label.
  Cover setup, sign-in, reset request, reset redemption, invitation redemption and registration so the shared
  lifecycle defect cannot survive in another authentication form.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; correction and redeployment pending.

### UAT-071 — Password-reset queue concatenates user name and email

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 Administrator-layout defect; not currently identified as a regression.
- **Role:** Administrator reviewing an open password-reset request.
- **Screen/workspace:** Administration → Password reset requests.
- **Record reference:** Private user name and email are excluded from this UAT record.
- **Prerequisites:** At least one open password-reset request exists.
- **Exact steps:** Open the Administrator password-reset request queue and inspect the `User` cell.
- **Expected result:** Display the user name as the primary value and the email as a clearly separated secondary value,
  preferably on the next line with muted styling. The two fields must not appear to be one concatenated identifier.
- **Actual result:** The bold user name and email are rendered immediately adjacent with no space, delimiter or line
  break, producing a visually malformed combined value.
- **Severity / blocker status:** Minor usability and identity-readability defect; non-blocker. The Administrator can
  still issue or cancel the request, but the presentation increases the risk of misreading the target account.
- **Evidence:** User-supplied dev.159 screenshot. Private identifying values visible in the original screenshot are
  not copied into this document.
- **Workaround:** Read the bold text as the user name and the following text as the email before issuing the code.
  Independently confirm the intended account through the approved private channel.
- **Issue:** User identity fields are not visually separated in the reset-request table.
- **Confirmed RCA:** The renderer emits adjacent `<b>` and `<small>` elements inside an ordinary table cell. The
  stylesheet makes `small` a block-level secondary line only inside selected table classes such as
  `.pipeline-table`; the password-reset table has no such class or dedicated identity-cell rule. Its `<small>`
  therefore remains inline and is concatenated directly after the closing `</b>` with no intervening whitespace.
- **Proposed solution:** Render a dedicated semantic identity wrapper and apply a password-reset-table rule that
  displays the email as a block-level secondary line with suitable spacing, muted colour and safe wrapping. Add a
  browser layout assertion for desktop and narrow widths and audit other unclassified Administrator tables that
  use adjacent `<b><small>` markup.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; correction and redeployment pending.

### UAT-072 — One-time reset code cannot be reliably copied or governed through delivery

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 account-recovery usability and security-control defect; not currently identified
  as a regression.
- **Role:** Administrator issuing a one-time password-reset code.
- **Screen/workspace:** Administration → Password reset requests → Issue one-time code.
- **Record reference:** Private user identity and the one-time reset code are excluded from this UAT record.
- **Prerequisites:** A pending password-reset request exists and the Administrator is authorised to issue a code.
- **Exact steps:** Select `Issue one-time code`, review the browser dialog, attempt to copy the code for delivery,
  and determine how the delivery channel is selected and evidenced.
- **Expected result:** Present the code in a secure application modal with selectable monospaced text and an explicit
  `Copy code` control. Show the intended user, expiry time/countdown and a warning that the code is shown once.
  Require the Administrator to choose an approved configured private channel or explicitly record an approved
  manual-delivery method. Record the issuing Administrator, issue time, expiry and delivery channel/status without
  storing the plaintext code in audit evidence. Provide revoke/replacement handling.
- **Actual result:** The code is displayed in a native browser alert. It cannot be reliably selected or copied in
  the observed browser, and the application provides neither a delivery action nor a channel-selection/evidence
  workflow. The instruction to use an approved private channel does not identify or govern how that must occur.
- **Severity / blocker status:** Major account-recovery control defect and an operational blocker for a reliable
  reset-code handoff in the observed session. The owner has not yet classified it as a cumulative-release blocker.
- **Evidence:** User-supplied dev.159 screenshot. The live reset code and private identity are intentionally not
  transcribed or retained in this document. Because the code appeared in shared evidence, it must be revoked or
  allowed to expire and must not be used.
- **Workaround:** No governed in-application delivery workaround exists. Cancel the exposed code and issue a
  replacement only when an approved private channel is ready. Manual transcription is error-prone and does not
  create delivery evidence; it should not be treated as the target solution.
- **Issue:** A sensitive one-time credential is displayed through an unsuitable browser primitive and is separated
  from any governed delivery process.
- **Confirmed RCA:** The Administrator handler calls the browser's native `alert()` with the plaintext code and
  expiry. A native alert exposes no application-controlled selection, copy, masking, channel choice, delivery
  confirmation or audit UI. The backend returns the code once as designed, but the frontend has no governed
  handoff component after receiving it.
- **Proposed solution:** Replace `alert()` with a dedicated, focus-managed secure modal. Include `Copy code`, expiry
  countdown, intended-user confirmation, revoke/reissue controls and a delivery-evidence step. Approved delivery
  channels must come from explicit Administration configuration and business-owner approval; do not assume email,
  SMS, WhatsApp or another channel. If an automatic connector is later approved, send through the backend and
  record only delivery metadata—not the plaintext code. Add browser tests for copy, expiry, dismissal, replacement,
  double issuance and audit redaction.
- **Business confirmation required:** Approve the permitted reset-code channels, whether direct system delivery is
  required, who may issue/reissue/revoke codes, the evidence retained for delivery, and the escalation process when
  no approved channel is available.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; correction and redeployment pending.

### UAT-073 — Sign-in screen has no direct path to redeem an issued reset code

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 account-recovery navigation and discoverability defect; not currently identified
  as a regression.
- **Role:** Signed-out user who has already received a valid one-time reset code.
- **Screen/workspace:** Sign-in and account-recovery screens.
- **Record reference:** Private email address and one-time reset code are excluded from this UAT record.
- **Prerequisites:** An Administrator has issued a valid, unexpired password-reset code to the intended user.
- **Exact steps:** Return to the sign-in screen after receiving the code and look for a place to enter it. Attempting
  ordinary sign-in with the old password produces an invalid-credentials response; no code field or direct reset-code
  action is shown on that screen.
- **Expected result:** The sign-in screen must provide a clear action such as `I have a reset code` or
  `Set a new password with a reset code`. It must open the code-redemption form directly, explain that the old
  password is not required, and request only the email, one-time code, new password and confirmation.
- **Actual result:** The sign-in screen contains email, password, `Forgot password?` and invitation redemption only.
  It provides no code field and no direct reset-code redemption action. The existing code-entry form is reachable
  only by opening `Forgot password?` and then selecting the secondary `Set new password` link on the request screen.
  This hidden two-step path was not discoverable to the user who had already received a code.
- **Severity / blocker status:** Major recovery-journey defect and an operational blocker until the hidden navigation
  path is known. The underlying redemption endpoint/form exists, so a workaround is available.
- **Evidence:** User-supplied dev.159 sign-in screenshot plus source inspection. Private identity and credential data
  visible in the original evidence are not copied into this document.
- **Workaround:** From sign-in select `Forgot password?`, then select `Set new password` under `Already have a reset
  code?`. Do not submit another reset request merely to reach the redemption form.
- **Issue:** Reset-code issuance and reset-code redemption are not connected by a clear recovery journey.
- **Confirmed RCA:** The login-mode renderer includes only `Forgot password?`. The `Set new password` control is
  rendered exclusively inside the separate reset-request mode. After code issuance the Administrator interface does
  not provide a user-facing redemption link, and returning to sign-in does not preserve or expose a reset-redemption
  state. The form exists, but its only navigation entry is nested behind the request-new-code screen.
- **Proposed solution:** Add a direct `I have a reset code` action beside `Forgot password?` on sign-in and include a
  clear redemption link in the Administrator's approved handoff template. After a reset request succeeds, replace
  the request form with a completion state containing `Enter issued code` rather than leaving two competing actions.
  Preserve only the email prefill, never the plaintext code. Add browser tests for request → administrator issue →
  direct redemption → password change → old-session invalidation and successful sign-in with the new password.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; correction and redeployment pending.

### UAT-074 — `Remember me` control has no processing effect

- **Status:** Newly discovered during cumulative dev.159 human UAT and source audit.
- **Classification:** Pre-existing authentication-session control defect, not a dev.159 regression. Dev.158 and
  dev.159 contain identical sign-in field and checkbox markup.
- **Role:** Signed-out user choosing whether the CRM session should persist.
- **Screen/workspace:** Sign-in → `Remember me`.
- **Record reference:** Private email and password values are excluded from this UAT record.
- **Prerequisites:** Open the CRM Test sign-in screen in a browser profile.
- **Exact steps:** Compare sign-in with `Remember me` checked and unchecked; inspect whether the selected value is
  submitted and whether it changes the resulting session lifetime. Separately observe browser email/password
  autofill suggestions.
- **Expected result:** The label must have an explicit, approved meaning. If it controls session persistence, its
  checked state must be sent to the backend and produce the approved persistent-session lifetime, while unchecked
  must produce the approved session-only or shorter lifetime. Browser password saving/autofill must remain a
  separate browser-controlled function and must not enumerate CRM users.
- **Actual result:** The checkbox is checked by default but has no `name`, is absent from submitted form data and is
  never read by the login handler or backend. CRM always issues the same cookie with a seven-day `Max-Age`.
  Separately, the user's browser no longer displayed previously saved email suggestions after typing the first
  character. The user subsequently confirmed that the expected Chrome profile had not been loaded; after correcting
  the browser profile, this autofill observation was explained and is not a CRM defect.
- **Severity / blocker status:** Moderate session-privacy and misleading-control defect; non-blocker for sign-in.
- **Evidence:** User-supplied dev.159 sign-in screenshot, dev.158/dev.159 package comparison, and source inspection.
  User confirmation that the Chrome profile was not loaded closes the separate autofill observation. Private
  identity or credential data visible in the original screenshot are not copied into this document.
- **Workaround:** Do not rely on the checkbox to alter session persistence. Sign out explicitly on shared devices.
  Manage saved email/password suggestions through the browser's password manager; CRM cannot retrieve or expose
  saved passwords.
- **Issue:** The visible persistence choice does not affect application behaviour, while its wording can be confused
  with browser password saving.
- **Confirmed RCA:** The checkbox is rendered without a form name and the login handler serializes only named form
  controls. No remember flag reaches `/auth/login`. `setSessionCookie()` unconditionally sets the same seven-day
  `Max-Age`; it has no parameter representing the user's choice.
- **Proposed solution:** Obtain explicit business approval for checked and unchecked session lifetimes and wording.
  Wire a named boolean to the login request, validate it server-side, set the corresponding cookie/session expiry,
  and add browser tests for both paths, sign-out and expiry. Use wording such as `Keep me signed in` if persistence
  is the intended function; do not promise that CRM stores or retrieves browser passwords.
- **Business confirmation required:** Approve the meaning of the control, default state, persistent and non-persistent
  lifetimes, shared-device warning and whether browser password-saving guidance should be displayed.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159` and was also present in dev.158.
- **Retest status:** Pending business decision, correction, deployment and human testing.

### UAT-075 — Governed Building maintenance is blocked by an ambiguous duplicate conflict

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 Administration and master-data maintenance defect; not currently identified as a
  regression.
- **Role:** Administrator maintaining governed Inventory location masters.
- **Screen/workspace:** Administration → Market intelligence → DLD market data and Community mapping → Maintain
  governed Building.
- **Record reference:** Community `Furjan`; proposed Building label and stable code are retained in the user-supplied
  screenshot without any private-party data.
- **Prerequisites:** An active governed Community exists and the Administrator has entered a syntactically valid
  Building stable code and Building label under it.
- **Exact steps:** Select the active Community, enter a new Building stable code and label, and select `Create
  governed Building`.
- **Expected result:** Create the new Building beneath the selected active Community. The existence of the selected
  Community must be validated as the required parent, but must not be treated as a duplicate: one Community may
  contain many distinct Buildings. If the Building code or the same normalized Building label is already maintained,
  identify the exact conflicting field and existing governed Building.
- **Actual result:** The maintenance action displayed the error `This Building code or Community label already
  exists`, but the Building was nevertheless created. The user subsequently opened Inventory and showed that the
  same Building was present and selectable under the selected Community. It did not appear in the Governed Buildings
  list on the maintenance screen after the error. The operation therefore reported failure after committing its
  primary master-data change and left the originating screen showing stale state. The message did not identify the
  actual failed step and also incorrectly suggested that the Community label itself must be unique for each Building.
- **Severity / blocker status:** Major duplicate-feedback and maintenance-state defect; no longer blocking the user's
  current Inventory journey because the required Building is now selectable. It remains unpassed pending a controlled
  create-once retest that establishes the exact response and visible post-create state.
- **Evidence:** User-supplied dev.159 screenshot and source/schema inspection. No private owner, customer or authority
  data is recorded.
- **Workaround:** For this journey, select the now-available governed Building and continue Inventory creation. Do not
  create another Building or vary the code to bypass the conflict. For future maintenance, reload and search the
  governed Building register before retrying a submission.
- **Issue:** Building creation is not atomic: CORE can commit the Building while reporting an error, causing the user
  to retry an operation that has already changed master data. A later/repeated request is then represented by one
  ambiguous Building/Community duplicate message.
- **Confirmed RCA:** The create route correctly verifies that the selected Community exists and has an active version;
  this is required parent validation and does not prohibit multiple Buildings under the Community. It then inserts the
  Building using the default database client and only afterwards writes an `InventoryBuilding` audit event, also using
  the default client. Those statements are not enclosed in one transaction, so failure of the audit statement cannot
  roll back the already committed Building. The active `audit_log_entity_type_check` vocabulary inherited by dev.159
  does not contain `InventoryBuilding`, and migrations 102 and 103 do not extend it, even though the new route emits
  that entity type. The audit write therefore has a schema-contract failure after the Building insert. On the client,
  the successful branch reloads the Administration register, but the error branch only displays a toast and does not
  reload. It therefore leaves the committed Building absent from the visible maintenance list, while the Inventory
  form later performs a fresh `/inventory-location-options` request and finds it. Separately, the route maps every
  PostgreSQL `23505` Building uniqueness violation to the same inaccurate message instead of
  distinguishing the globally unique `stable_code` from `(community_id, normalized_label)`. The user's precise
  request/retry sequence is not retained in the evidence, so the source of the displayed duplicate wording—such as a
  retry after the partial commit—must not be asserted as confirmed.
- **Proposed solution:** Add `InventoryBuilding` to the governed audit entity vocabulary and perform active-Community
  validation, Building insert and audit insert inside one database transaction. Return success only after both commit;
  otherwise roll back both. Disable the submit control while the request is pending and use an idempotency key so a
  repeated request resolves to the existing successful result. After any indeterminate response, reconcile the exact
  submitted code against the authoritative register and render the true committed state rather than leaving stale
  maintenance data. Preserve multiple Buildings per Community. Return
  distinct conflicts for an existing stable code and the same normalized Building label within the selected Community,
  including governed active/retired context. Add real HTTP and database tests proving atomic success, audit creation,
  rollback on audit failure, idempotent replay, two distinct Buildings under one Community, and precise duplicate
  responses.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The defect is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT. The Building is selectable, which lifts the immediate Inventory
  journey blocker, but the create operation's atomic result, audit evidence, idempotency and error feedback require
  correction, CRM Test deployment and user-observed retest.

### UAT-076 — Governed Building shows a non-actionable and unexplained `not mapped` state

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 Building-master governance and usability gap; not currently identified as a
  regression.
- **Role:** Administrator reviewing governed Building maintenance.
- **Screen/workspace:** Administration → Market intelligence → Governed Buildings → Mapping state.
- **Record reference:** User-observed governed Building under the maintained Furjan Community; no private-party data.
- **Prerequisites:** A governed Building exists and is active.
- **Exact steps:** Reload or sign back into Administration, open the Market intelligence maintenance screen and review
  the Building's `Mapping state` column.
- **Expected result:** Either omit an external-mapping state that has no approved workflow, or label the exact external
  register/provider to which the Building is or is not mapped and provide the authorised governed mapping action,
  evidence, lifecycle and impact. The state must clearly distinguish ordinary CORE availability from optional external
  correspondence.
- **Actual result:** The Building is shown with mapping state `not mapped`. No explanation identifies what external
  system or dataset is meant, and no Building mapping action is available. The Building remains active and selectable
  in Inventory despite that state.
- **Severity / blocker status:** Moderate governance and usability defect; non-blocker for Inventory creation because
  the current Inventory location query uses active Building and Community status and does not require this mapping
  field.
- **Evidence:** User-supplied dev.159 Administration and Inventory screenshots plus source/schema inspection.
- **Workaround:** Treat `not mapped` only as an unconfigured external-correspondence marker in dev.159; it does not
  prevent selecting the Building in Inventory. Do not infer that a DLD, Property Finder or other external mapping
  exists. Property Finder remains excluded/disabled.
- **Issue:** The UI exposes an external mapping lifecycle state without identifying its target or supplying a workflow
  that can reach the displayed `mapped` state.
- **Confirmed RCA:** `inventory_buildings.external_mapping_status` defaults to `not_mapped` and permits
  `not_mapped`, `mapped` and `retired`. Building creation does not accept or derive a mapping. No dev.159 route or UI
  action changes an active Building to `mapped`; only Building retirement changes the field to `retired`. The `Draft
  exact DLD crosswalk` workflow maps an external DLD Community identity to an active CORE Community version and does
  not map Buildings. Inventory location selection filters on active Community and active Building only and ignores
  `external_mapping_status`.
- **Proposed solution:** Obtain explicit business confirmation of whether Building-level external mapping is required,
  for which source register(s), and whether separate mappings are required for DLD, Property Finder and other portals.
  If not required in the current scope, remove the Mapping state column and field from the operational UI. If required,
  implement provider-specific, versioned crosswalk records with exact external identifiers, maker/checker governance,
  activation/retirement, evidence and clear downstream impact; do not overload one generic status across providers.
- **Business confirmation required:** Confirm whether CORE Buildings require any external crosswalk now; identify each
  approved target dataset/provider, who maintains and approves it, whether it affects Inventory creation or only later
  external publication/market evidence, and how unmatched Buildings must behave. No Property Finder mapping or
  connection is assumed.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The gap is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Pending business confirmation, correction, CRM Test deployment and user-observed retest.

### UAT-077 — Saving the Lead assessment does not complete qualification automatically

- **Status:** Owner-confirmed business rule and newly identified cumulative dev.159 workflow gap.
- **Classification:** New dev.159 Lead-qualification workflow defect identified during human UAT discussion and
  confirmed by source inspection; not currently identified as a regression.
- **Role:** Assigned Sales Agent working a contacted Lead.
- **Screen/workspace:** Lead detail → Assess qualification → Opportunity-readiness control.
- **Record reference:** Any synthetic Lead classified as Buy, Sell, Rent or Rent out; no private Customer data is
  required.
- **Prerequisites:** The Lead is assigned to the Agent; substantive Customer contact with a dated next action has been
  completed; the exact objective has an active approved Qualification Version; the Agent answers all required
  objective-specific questions.
- **Exact steps:** Open `Assess qualification`, complete the approved questionnaire and select `Calculate new
  assessment`; then close and reopen the Lead and review qualification and Opportunity readiness.
- **Expected result:** Saving the objective-specific assessment is the qualification event. In one governed
  transaction, CORE must preserve the assessment and exact model version, calculate the weighted score, assign
  Cold/Warm/Hot, and mark Lead qualification complete. No separate manual `Move the Lead to Qualified` action may be
  required. Cold/Warm/Hot is a readiness and prioritization outcome, not a second approval. A low result must not
  silently reject or close the Lead. Opportunity readiness may separately require a current structured requirement
  and responsible assignment, but not a duplicate manual qualification-stage toggle.
- **Actual result:** Runtime completion has not yet been manually exercised because no active objective-specific
  Qualification Version was available for the user's Lead. Source inspection confirms that the assessment route
  inserts the assessment and updates only `leads.temperature`; it does not mark qualification complete or transition
  the Lead stage. The Lead UI separately retains an editable stage control and, after an assessment exists, can tell
  the Agent to `Move the Lead to Qualified after completing the approved assessment.`
- **Severity / blocker status:** Major workflow and data-consistency defect. It creates two competing representations
  of one business event and can prevent Opportunity creation even after the governed assessment is complete.
- **Evidence:** User's explicit business-rule confirmation, CRM Test Lead screenshots from the qualification journey,
  and dev.159 source inspection. No private Customer evidence is recorded.
- **Workaround:** None approved. Do not use a manual stage change as proof that qualification is correctly completed;
  that would mask the duplicate workflow. The user may continue other independent UAT while this journey awaits an
  active model and correction.
- **Issue:** Lead qualification is split between the governed assessment and a separate manual Lead-stage action,
  although the business owner has confirmed that the assessment itself must complete qualification.
- **Confirmed RCA:** `POST /crm/leads/:id/qualification-assessments` saves the immutable assessment and executes
  `UPDATE leads SET temperature=$1,updated_at=NOW() WHERE id=$2`; it does not update a governed qualification-complete
  state or the Lead stage. The UI's Opportunity gate separately evaluates Lead stage and renders the instruction to
  move the Lead to Qualified. The database write and UI therefore encode qualification result and qualification
  completion as separate actions.
- **Proposed solution:** In the same database transaction that creates the assessment, atomically mark qualification
  complete and write the corresponding lifecycle/audit evidence. Preserve Cold/Warm/Hot as the calculated priority
  result and preserve Manager overrides as separate audited records. Remove the manual post-assessment stage action
  and its instruction. Make Opportunity readiness depend on the completed current assessment plus only the separately
  approved current-requirement and assignment prerequisites. Keep explicit rejection, nurture or closure as separate
  governed outcomes with reasons; never derive them silently from a score. Add real HTTP and database tests for all
  four objectives, each temperature band, reload persistence, atomic rollback, Manager override, direct-API
  enforcement and Opportunity continuation without a manual stage toggle.
- **Business confirmation:** Confirmed by the owner: the next separate Lead-qualification step is not required; the
  saved objective-specific assessment completes qualification.
- **Implementation status:** Not started; confirmed and documented only.
- **Deployment status:** The gap is present in CRM Test `2.1.0-dev.159` source behaviour.
- **Retest status:** Pending correction, deployment, activation of the approved objective-specific models and
  user-observed human retest.

### UAT-078 — Objective-specific Qualification Version cannot be saved and returns Internal server error

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 qualification-maintenance blocker caused by a confirmed route/schema contract
  mismatch; not currently identified as a regression.
- **Role:** Administrator configuring Lead Qualification Versions.
- **Screen/workspace:** Administration → Lead Qualification Versions → Questions and weights → Save Draft.
- **Record reference:** Stable model code `lead_readiness` and an objective-specific synthetic Draft; no private
  Customer or authority data.
- **Prerequisites:** The Administrator enters a valid model name, purpose, active Customer objective, score bands and
  questions whose weights total exactly 100%.
- **Exact steps:** Create an objective-specific Draft using stable model code `lead_readiness`, complete the questions
  and weights, and select the Draft save action.
- **Expected result:** Save the Draft under the composite identity `model code + Customer objective + version`, return
  the created Draft, and show a precise validation or conflict response if it cannot be saved.
- **Actual result:** CRM Test displayed `Internal server error`; the Draft could not be saved through the observed
  journey.
- **Severity / blocker status:** Critical configuration blocker. Without a saved, approved and active questionnaire,
  the corresponding Lead objective cannot be assessed and the qualification journey cannot continue.
- **Evidence:** User-supplied CRM Test screenshot plus dev.159 route and migration inspection. No private data is
  retained.
- **Workaround:** None approved. Using a different model code for each objective would contradict the confirmed
  single-model-family design and would not correct the underlying schema or selection contract.
- **Issue:** The application implements objective-specific version sequences while the database continues to enforce
  the older global model-code/version identity, and the resulting database conflict is returned as a generic 500.
- **Confirmed RCA evidence:** Migration 006 created `UNIQUE(model_code,version)`. Migration 102 added
  `customer_objective` and correctly changed the active-model index to `(model_code, customer_objective)`, but it did
  not replace the original table uniqueness constraint. The dev.159 create route calculates the next version using
  `WHERE model_code=$1 AND customer_objective=$2`; the first Draft for another objective is therefore version 1 even
  when the same model code already has version 1 under a legacy or different objective. That insert violates the
  surviving global constraint. No route-level handling converts PostgreSQL `23505` into a governed conflict, so the
  common error handler returns `Internal server error`.
- **RCA boundary:** The code/schema defect is confirmed. The exact existing CRM Test row that collided with this
  particular request has not been read from the database or server log and is therefore not asserted as confirmed.
- **Proposed solution:** Replace the legacy uniqueness constraint with a governed composite version identity covering
  `model_code + customer_objective + version`, including an explicit policy for legacy rows whose objective is null.
  Keep exactly one active version per `model_code + customer_objective`. Create the Draft and its audit evidence in
  one transaction; make concurrent version allocation safe; return a precise 409 for a genuine version conflict; and
  make questionnaire lookup explicitly filter both `model_code='lead_readiness'` and the Lead objective. Add real HTTP
  and database tests proving four separate version-1 Drafts under the single stable model code, subsequent versioning,
  concurrent creation, audit atomicity, activation isolation and correct Lead-to-questionnaire selection.
- **Implementation status:** Not started; diagnosed and documented only.
- **Deployment status:** The conflicting dev.159 route and schema definitions are present in CRM Test
  `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; pending correction, deployment and user-observed retest.

### UAT-085 — Reviewed shortlist promotion returns an error and does not create an active Opportunity assignment

- **Classification:** Newly discovered cumulative dev.162 matching-to-assignment journey defect; not a UAT-081
  regression.
- **Role:** Assigned Sales Agent operating the current Opportunity.
- **Screen / workspace:** Opportunity → Match → Governed Inventory Search and Inventory Assignments and Matching
  Evidence.
- **Record reference:** Synthetic UAT Inventory `uat159inv1`, reference `NYSA-INV-000068`; no private Customer,
  contact or authority data is retained.
- **Prerequisites:** A successful governed matching run for the exact current Requirement Version; the Inventory is
  operationally eligible and the Agent has recorded the latest decision as `shortlisted`.
- **Exact steps:** Run the matching search, locate `uat159inv1`, enter decision notes and choose `Shortlist`. Select
  `Add this reviewed shortlist property to the Opportunity`, click `Promote selected shortlist to Opportunity`,
  observe the returned error, and then inspect the active Inventory Assignments at the top of the Opportunity.
- **Expected result:** The confirmed owner flow is one explicit Agent decision: after the Agent shortlists a ranked
  recommendation, CORE transactionally revalidates the Inventory, records the decision and exact run/candidate
  lineage, creates or reuses the Property Match, creates the active seven-day Inventory Assignment, and refreshes the
  Opportunity so that Inventory appears immediately. Failure of any part must roll back the entire action. No
  customer communication, Viewing, Offer or reservation is created automatically.
- **Actual result:** The candidate displays `Broker decision shortlisted`. The Agent successfully selected the small
  checkbox labelled `Add this reviewed shortlist property to the Opportunity` and then clicked the remote global
  `Promote selected shortlist to Opportunity` button. CORE returned
  `Every candidate must belong to this Opportunity and exact current requirement` instead of completing the
  promotion.
  The checkbox, its label and the promotion action are separated across a horizontally broken/cropped workspace,
  making the action difficult to understand. The shortlisted Inventory did not appear in active Inventory
  Assignments.
- **Severity / blocker status:** Blocker for the confirmed AI/governed recommendation-to-assignment journey. The
  Agent cannot proceed through the intended flow.
- **Evidence:** User screenshots `codex-clipboard-c6c441e22-d066-4510-a01a-89a0cd4f1d13.png`,
  `codex-clipboard-e92a4c24-9c29-43ed-9965-2d635daac4c4.png` and
  `codex-clipboard-c3a7c2eb-10c0-444d-bae6-99d5647ac21c.png`, followed by
  `codex-clipboard-40a94ed5-a9b7-49ca-97b9-cfa124da3935.png` and
  `codex-clipboard-2f19472b-bb01-4b86-9921-96de7524d6d3.png`, plus the user's exact observed promotion error:
  `Every candidate must belong to this Opportunity and exact current requirement`. No private evidence is recorded.
- **Workaround:** The Agent can use `Create another Inventory assignment` and select the same Inventory manually,
  but this duplicates the already-recorded shortlist decision and is not accepted as the target business flow.
- **Issue:** Matching decision, Property Match promotion and active Inventory Assignment are presented as one journey
  but implemented as disconnected actions.
- **Confirmed RCA:** `matching-completion-ui.js` renders the promotion checkbox only after a latest shortlist decision
  and without governed origin evidence, but provides no dedicated styling for `matching-promote-choice`; the global
  form rule gives inputs 100% width, separating the small checkbox from its label in the broken layout observed in
  CRM Test. The final promotion button is remote from the candidate and rendered whenever the run has an Opportunity.
  The promotion route returns the observed error only when the selected matching run's `opportunity_id` does not
  equal the target Opportunity ID, or the run's `requirement_id` does not equal the Requirement ID frozen on that
  Opportunity. Matching-run creation is lead-scoped and silently binds the current unsuperseded Requirement plus the
  most recently updated open Opportunity for that Lead; the UI does not make that lineage visible before the Agent
  shortlists. Which of those two stored-ID comparisons failed for this exact CRM Test record remains unconfirmed
  without a read-only runtime trace and must not be inferred. This is structurally related to UAT-082's misleading
  Requirements-completed state. Independently, the shortlist endpoint inserts only `inventory_match_decisions`, and the governed promotion endpoint
  inserts or reuses `property_matches` plus `property_match_governed_origins`; it explicitly returns
  `reservesInventory:false` and never inserts `inventory_assignments`. The separate manual assignment endpoint is the
  only one of these paths that creates the active seven-day assignment.
- **Proposed solution:** Replace the separate checkbox/promotion/assignment chain with one clearly labelled
  `Shortlist and assign to Opportunity` Agent action. In one idempotent transaction, revalidate current operational
  eligibility, record the latest shortlist decision, create/reuse the governed Property Match and origin, create the
  active Inventory Assignment with its event/history, and return the assignment reference and expiry. Immediately
  refresh the assignment panel. A later pre-booking rejection/defer decision must deliberately delink the associated
  governed assignment while preserving history. Do not automate communication, Viewing, Offer or reservation.
- **Implementation status:** Corrected locally in cumulative `2.1.0-dev.164`. The Opportunity supplies its explicit
  ID when creating the run; each candidate retains its frozen Opportunity and Requirement lineage; one
  `Shortlist and assign to Opportunity` transaction creates/reuses the governed Property Match and origin plus the
  active seven-day Inventory Assignment. A later governed Reject or Defer decision deliberately delinks the active
  assignment while retaining its event and decision history. The legacy promotion endpoint uses the same assignment
  helper for recovery. Protected real HTTP/PostgreSQL evidence independently confirms exact lineage, assignment,
  expiry, stage change, no reservation/status rewrite, rollback on mismatch, and delink history.
- **Deployment status:** Corrected runtime deployed to CRM Test `2.1.0-dev.164` on 25 August 2026.
- **Retest status:** Failed by user observation on dev.162; human retest on dev.164 is pending. Automated and
  deployment evidence are not a pass.

## dev.160 cumulative correction deployment — UAT-070 through UAT-079

CRM Test was updated to `2.1.0-dev.160` on 25 August 2026 using the checksum-bound cumulative candidate. Migration
`104_dev160_uat070_079_journey_unblock.sql` is installed (104 total). Health and readiness are ready; exactly one
verified CRM Test LiteSpeed worker remains. Integration switches remain disabled. Production and the R2 clone were
not targeted and their snapshots were unchanged. Backup:
`/home/nysareal/crm-backups/consolidated-crm-test-dev160-20260825T094556Z`.

The defect records above retain their original user-observed dev.159 actual results. Their status is now:

| UAT ID | Implementation status | Deployment status | Human retest status |
|---|---|---|---|
| UAT-070 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-071 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-072 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-073 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-074 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-075 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-076 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-077 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-078 | Implemented and automatically verified | Deployed to CRM Test dev.160 | Pending user observation |
| UAT-079 | Browser wiring corrected and runtime-click tested | Hotfix deployed to CRM Test dev.161 | Pending repeat user observation after failed dev.160 retest |
| UAT-080 | Complete governed questionnaire modal implemented and automatically verified | Deployed to CRM Test dev.162 | Passed by user observation on 25 August 2026 |
| UAT-081 | Implemented cumulatively and protected real-DB verified | Deployed to CRM Test dev.164 | Pending human retest; the dev.162 failure remains the last user-observed result |

Package SHA-256: `9aa22ad1a354eb22d99d1b1020f331bf65adb7ad191b6af50c22c18be5589679`.

### UAT-079 dev.160 failed retest — Retire version button is inert

- **Classification:** Failed retest of UAT-079; not a new UAT ID.
- **Role:** Full Administrator.
- **Screen / workspace:** Administration → Lead Qualification Versions.
- **Record reference:** `Lead readiness v1` / stable model code `lead_readiness`; no private Customer data.
- **Prerequisites:** An active Qualification Version is visible and the `Retire version` button is displayed.
- **Exact steps:** Open Lead Qualification Versions and click `Retire version` on the active version.
- **Expected result:** CORE opens the governed retirement confirmation/reason interaction. After a meaningful reason is
  confirmed, the exact version is retired, the register refreshes, and audit evidence is recorded.
- **Actual result:** Clicking `Retire version` produces no response. No prompt, success/error message or visible state
  change appears.
- **Severity / blocker status:** Blocker for governed Qualification Version retirement and for replacing an incorrect
  active model through the intended maintenance journey.
- **Evidence:** User screenshot `codex-clipboard-028b1192-86b0-47bc-b465-00d90c00cc05.png` and deployed dev.160
  source/CSP inspection. No private data is recorded.
- **Workaround:** None approved. Direct database updates and console invocation are prohibited as UAT workarounds.
- **Issue:** The dev.160 retirement endpoint exists, but the rendered UI button does not invoke it.
- **Confirmed RCA:** `loadQualificationModels()` renders the button using inline
  `onclick="retireQualificationModel(...)"`. CORE sends Content Security Policy `script-src 'self'` without
  `unsafe-inline`, so the browser blocks that inline event handler before it can open the reason prompt or call the
  API. The dev.160 source test asserted only that the button/function strings existed, and the protected real-DB test
  called the endpoint directly; neither test performed a real browser click, so this wiring failure escaped both.
- **Proposed solution:** Render a `data-retire-model` attribute and bind the click using `addEventListener` after the
  register HTML is inserted, consistent with the Test, Approve and Activate actions. Keep the existing governed
  reason, endpoint and audit behavior. Add a browser-level test that clicks the rendered action and proves the prompt
  and HTTP call are reached under the production CSP; retain the real HTTP/database retirement test.
- **Implementation status:** Corrected in dev.161. The inline handler was removed; a scoped CSP-compliant event
  listener now invokes the governed retirement action. A runtime click-wiring test proves the exact model ID reaches
  the handler, and a negative test prevents the inline handler from returning.
- **Deployment status:** Hotfix deployed to CRM Test `2.1.0-dev.161` on 25 August 2026. Health and readiness are ready;
  migration remains 104. Package SHA-256:
  `94243945f6883fcf108a70e366d6eb9af1e272ec9acbe92ebd98289e24736b36`.
- **Retest status:** The dev.160 retest remains recorded as failed. Repeat human retest on dev.161 is pending; no pass
  is inferred from implementation, automated evidence or deployment.

### UAT-080 — Qualification model Test questionnaire does not show configured answer choices

- **Classification:** Newly discovered dev.161 defect; not a UAT-079 retest.
- **Role:** Full Administrator / authorized Qualification model maintainer.
- **Screen / workspace:** Administration → Lead Qualification Versions → `Test questionnaire`.
- **Record reference:** Customer purchase-budget confirmation factor in the newly maintained Qualification model; no
  private Customer data.
- **Prerequisites:** A Qualification Version contains a factor maintained with `Dropdown choices` and explicit
  label-to-score choices.
- **Exact steps:** Open Lead Qualification Versions, select `Test questionnaire`, and review the input presented for
  the configured dropdown factor.
- **Expected result:** The Test questionnaire displays the maintained choice labels as selectable options, preserves
  their configured numeric score mapping internally, and allows the Administrator to test the questionnaire exactly
  as an agent will receive it. Yes/No and numeric-scale factors must likewise use their configured input controls.
- **Actual result:** CORE opens a native browser text prompt showing only the question and `(0–10)`. No maintained
  choices or label-to-score mapping is displayed.
- **Severity / blocker status:** Blocker for governed testing, approval and activation of a choice-based Qualification
  Version. The Administrator cannot verify the configured questionnaire as the agent will experience it.
- **Evidence:** User screenshot `codex-clipboard-84c3ee3f-352e-4539-8952-3aeabc4d1c44.png` and deployed dev.161 UI
  source inspection. No private data is recorded.
- **Workaround:** None approved. Entering an unexplained numeric score does not test the maintained choices and must
  not be treated as equivalent evidence.
- **Issue:** The model-maintenance test journey is inconsistent with the governed questionnaire definition and the
  agent-facing questionnaire renderer.
- **Confirmed RCA:** The `data-test-model` click handler loops through every factor using native `prompt()` with only
  `${question} (${min}–${max})`, then coerces the result with `Number(value)`. It does not branch on `answerType`, does
  not read `answerOptions`, and cannot render configured dropdown labels. By contrast, the agent questionnaire uses
  `qualificationQuestionControl()` and correctly supports `yes_no`, `single_select` and numeric-scale inputs.
- **Proposed solution:** Replace the prompt loop with a governed Test Questionnaire modal that reuses the same
  read-only question-control renderer as the agent journey. Display Dropdown choices, Yes/No controls, numeric scale
  bounds, required status, help text and weight. Calculate only after valid answers are supplied, then show score,
  temperature and per-factor contribution without saving a Lead assessment. Add runtime UI tests for all three answer
  types and a real HTTP test confirming the submitted choice scores produce the displayed result.
- **Implementation status:** Corrected locally for dev.162. The Administrator action now opens one complete modal
  using the shared governed renderer for `single_select`, `yes_no` and numeric-scale factors; it displays choices,
  bounds, help text, required status and weights, and calculates a test result without saving a Lead assessment.
  Runtime UI evidence passes 2/2 and the full ordinary regression passes 1,172/1,172 executed tests with 27 protected
  tests intentionally skipped by that runner.
- **Deployment status:** Corrected in CRM Test `2.1.0-dev.162`. Deployment completed successfully on 25 August 2026;
  health and database readiness both returned ready on dev.162, exactly one verified worker remained, integration
  switches stayed disabled, and Production/R2 snapshots were unchanged. Package SHA-256:
  `79fede37ec8d7be926d94e51fe9e804035cdf5c0dd4dd8b3a1f5b1008a52efe9`.
- **Retest status:** **Passed by user observation on CRM Test dev.162 on 25 August 2026.** The user confirmed that
  the complete questionnaire worked. This pass is recorded from that observation, not inferred from implementation,
  automated evidence or deployment.

### UAT-081 — Qualification priority timing is advisory and does not govern the next action SLA

- **Classification:** Newly discovered dev.162 business-rule and workflow-enforcement gap; not a UAT-080 regression.
- **Role:** Assigned Sales Agent completing the objective-specific Lead qualification questionnaire; Administrator
  maintaining qualification and SLA policy.
- **Screen / workspace:** Lead detail → Assess qualification and dated next action; Administration → Lead
  Qualification Versions and Business hours & SLA.
- **Record reference:** The synthetic Lead used for the successful UAT-080 retest; no Customer identity, contact data
  or private authority evidence is retained.
- **Prerequisites:** A completed substantive Customer discussion with a dated next action and an active
  objective-specific Qualification Version.
- **Exact steps:** Complete the questionnaire, save the calculated Cold/Warm/Hot result, then inspect the displayed
  priority message and the retained next-action deadline.
- **Expected result:** The result must apply an explicitly approved response SLA for the calculated band to the
  current governed next action. The Agent must see the resulting deadline and must not be able to retain or enter a
  later deadline unless an authorized, audited exception rule permits it. Business calendar, cutoff and after-hours
  treatment must come from maintained policy rather than hidden assumptions.
- **Actual result:** Cold/Warm/Hot and response guidance are displayed, but the guidance is not reflected in or
  enforced against the dated next action. The existing next-action deadline remains independent of the calculated
  qualification priority.
- **Severity / blocker status:** Major SLA-control gap; not presently recorded as a journey blocker because the Agent
  can continue manually, but timely follow-up is not system-enforced.
- **Evidence:** User observation on deployed CRM Test dev.162 and source inspection. No private evidence is recorded.
- **Workaround:** The Agent may manually set an earlier next action, but this is not a controlled workaround because
  the application neither calculates nor validates the applicable deadline.
- **Issue:** Qualification priority and Lead next-action governance are disconnected.
- **Confirmed RCA:** The application has hard-coded display guidance (`Hot` 15 minutes, `Warm` 240 minutes, `Cold`
  1,440 minutes), while the qualification model form saves only free-text strategy by band. The qualification-save
  transaction writes the assessment, temperature and Qualified stage but does not calculate a band deadline, update
  the Lead's current follow-up, create/update a governed Task, or validate the retained next action against a band
  SLA. Existing SLA maintenance governs Lead acceptance and first contact only.
- **Confirmed owner rule:** Hot follow-up is due within 15 elapsed minutes, continuously 24/7 including outside
  business hours. Warm follow-up is due within 4 business hours (240 maintained business minutes). Cold follow-up is
  due within 1 business day and, while the same Cold assessment remains current and the Lead stays open, continues as
  a nurture obligation every 5 business days.
- **Proposed solution:** Add explicitly maintained qualification follow-up SLA values per Cold/Warm/Hot band and bind
  Warm and Cold calculations to the active business-hours policy. On assessment or authorized override, calculate the
  exact deadline transactionally; preserve historical contact evidence; create or update one current governed next-action
  obligation; display its source model/version and deadline; prevent a later Agent-selected date without a separately
  approved exception and reason; and recalculate prospectively when a Manager override changes the band. Apply the
  confirmed timing and after-hours rules above; all later policy changes require separate owner approval.
- **Implementation status:** Corrected locally for dev.163. Migration 105 adds the maintained qualification timing
  controls and immutable Task-to-assessment/policy lineage. Saving or overriding an assessment now creates the exact
  governed follow-up Task, supersedes the prior open qualification obligation without deleting history, and updates
  the Lead's next follow-up. Hot uses elapsed time; Warm and Cold use the maintained business calendar. Completing a
  current Cold Task creates the next five-business-day nurture cycle only while that same Cold assessment remains
  current and the Lead is not Won or Lost. Assigned Agents cannot move the governed deadline or cancel the Task;
  authorized Managers require a meaningful audited exception reason. Deterministic domain tests, browser/source
  checks and a protected real HTTP/PostgreSQL test pass. Automated evidence does not constitute human acceptance.
- **Deployment status:** Included cumulatively and deployed to CRM Test `2.1.0-dev.164` on 25 August 2026.
- **Retest status:** Pending human retest on dev.164. The failed dev.162 observation remains authoritative until the
  user observes the corrected behavior in CRM Test.

### UAT-082 — Guided journey shows Requirements completed although matching rejects the Requirement as unconfirmed

- **Classification:** Newly discovered dev.162 journey-state defect; related to, but not a retest of, UAT-081.
- **Role / workspace:** Assigned Sales Agent; connected Lead/Opportunity guided journey and governed Inventory
  ranking.
- **Record reference:** Synthetic `uat159cust1` connected case; no private Customer or authority data is retained.
- **Prerequisites:** A structured Requirement version is saved and displayed as recorded on the guided journey.
- **Exact steps:** Open the connected journey, observe `Requirements completed`, open Match, and run Inventory
  ranking.
- **Expected result:** Requirements is completed only when the exact current Requirement Version has broker
  confirmation and is the same Requirement linked to the on-screen Opportunity. Otherwise the journey must show the
  precise corrective action before ranking.
- **Actual result:** The journey showed Requirements completed, while ranking returned `Requirement version 1 must
  be broker-confirmed before matching Inventory`.
- **Severity / blocker:** Blocker because the journey directs the Agent into an action that the server rejects.
- **Evidence:** User screenshots `codex-clipboard-46844bd5-becb-47d3-9ea5-d4614749196f.png` and
  `codex-clipboard-0cfe810b-5396-4ddd-b609-8dde6fcc4c70.png`.
- **Workaround:** Return to Requirements and find the separate confirmation control; this is not an acceptable target
  journey because the displayed completion state is false.
- **Confirmed RCA:** The operating-context route treated any current `lead_requirements` row as completion evidence.
  It did not join `lead_requirement_confirmations`, did not compare the Opportunity's `requirement_id` to the current
  Requirement, and therefore used weaker readiness rules than the matching route.
- **Proposed solution:** Use the same confirmation and exact-lineage evidence for journey status and matching. Show
  unconfirmed or misaligned Requirements as current/blocked with a direct corrective message.
- **Implementation status:** Corrected locally in cumulative `2.1.0-dev.164`; deterministic tests and protected real
  HTTP/PostgreSQL evidence pass. Automated evidence is not human acceptance.
- **Deployment status:** Deployed to CRM Test `2.1.0-dev.164` on 25 August 2026.
- **Retest status:** Pending user observation on dev.164; the dev.162 failure remains the authoritative result.

### UAT-083 — Inventory ranking action is misleadingly labelled AI-assisted and placed outside the working sequence

- **Classification:** Newly discovered dev.162 usability and process-semantics defect.
- **Role / workspace:** Assigned Sales Agent; Opportunity → Inventory recommendation and assignment.
- **Record reference:** Synthetic UAT Opportunity only; no private data.
- **Prerequisites:** A confirmed current Requirement and an open Opportunity.
- **Exact steps:** Open the Opportunity, locate `Run AI-assisted Inventory ranking`, click it, and attempt to understand
  where the result and next action belong.
- **Expected result:** The Opportunity must present one clearly ordered workspace: rank available Inventory using
  deterministic governed rules, review the explanation, then shortlist and assign. AI must not be claimed where no AI
  model produces the ranking.
- **Actual result:** The button was visually detached from the content, labelled AI-assisted, and did not make the
  resulting assignment or next step clear.
- **Severity / blocker:** Major usability defect contributing to the UAT-085 blocker.
- **Evidence:** User screenshot `codex-clipboard-5b814885-616b-46ea-9004-6b3def09d890.png` and subsequent matching
  screenshots.
- **Workaround:** None that removes the ambiguity; the Agent can inspect the lower matching cards manually.
- **Confirmed RCA:** The Opportunity injected the matching widget inside the governed customer-selection area and
  labelled a deterministic `buildGovernedMatchingRunV2` route as AI-assisted. The trigger and results used no
  dedicated Opportunity ranking layout.
- **Proposed solution:** Move the control into a dedicated `Inventory recommendation and assignment` workspace,
  rename it `Rank available Inventory`, state that scoring is deterministic/advisory, and show the immediate
  shortlist-and-assignment action on each candidate.
- **Implementation status:** Corrected locally in cumulative `2.1.0-dev.164`; source/UI tests pass.
- **Deployment status:** Deployed to CRM Test `2.1.0-dev.164` on 25 August 2026.
- **Retest status:** Pending user observation on dev.164.

### UAT-084 — Reviewed AI Requirement summary is not displayed prominently after it is applied and saved

- **Classification:** Newly discovered dev.162 AI-assistance continuity and visibility defect.
- **Role / workspace:** Assigned Sales Agent; Lead → Structured Requirements and Opportunity matching.
- **Record reference:** Synthetic UAT Lead; no direct contact or identity evidence is retained.
- **Prerequisites:** Generate an AI-assisted Requirement draft, review it, apply it to the governed form and save the
  new Requirement Version.
- **Exact steps:** Generate suggestions, choose `Apply reviewed draft to form`, save the Requirement, then return to
  the Lead and Opportunity and look for the generated summary, confidence, questions and warnings.
- **Expected result:** The reviewed AI narrative must remain visible beside the authoritative structured Requirement
  and in the matching context. It must be clearly labelled human-reviewed advisory evidence; it must not replace the
  structured fields.
- **Actual result:** The generated narrative was visible only during drafting and was effectively buried after save;
  the Agent could not promptly see where it went.
- **Severity / blocker:** Major usability and evidence-continuity defect; not a data-loss claim.
- **Evidence:** User screenshots `codex-clipboard-cd68a837-07e5-4725-a834-c6ac7db7061c.png` and
  `codex-clipboard-c3800b42-163c-44c2-9cbb-1b82d9c2660d.png`, followed by the user's observation that the summary was
  not visible after save.
- **Workaround:** Reopen and inspect deeply nested Requirement evidence; this defeats the assistance purpose.
- **Confirmed RCA:** The apply action saved only structured suggestion fields into `ai_reviewed_evidence`; it did not
  retain the top-level summary, confidence, unanswered questions or warnings. Saved Requirement cards also had no
  prominent reviewed-summary section, and the immutable matching snapshot did not project that narrative.
- **Proposed solution:** Persist the reviewed narrative metadata in the existing JSONB evidence, display it
  prominently on the saved Requirement, and carry a safe reviewed summary into the immutable matching snapshot.
- **Implementation status:** Corrected locally in cumulative `2.1.0-dev.164`; protected PostgreSQL evidence proves
  the summary is retained in the exact matching run snapshot.
- **Deployment status:** Deployed to CRM Test `2.1.0-dev.164` on 25 August 2026.
- **Retest status:** Pending user observation on dev.164.

### dev.164 deployment status — UAT-081 through UAT-085

| UAT ID | Local implementation | Protected evidence | CRM Test | Human retest |
|---|---|---|---|---|
| UAT-081 | Included cumulatively; qualification-band SLA remains corrected | Real HTTP/PostgreSQL 1/1 passed | Deployed on dev.164 | **Passed after SLA activation:** Hot/Warm/Cold deadlines and governed Tasks observed |
| UAT-082 | Exact confirmation and Opportunity/Requirement alignment now govern journey state | Covered by dev.164 real HTTP/PostgreSQL | Deployed on dev.164 | **Failed/incomplete:** confirmation succeeded; no visible alignment action |
| UAT-083 | Dedicated deterministic ranking workspace and corrected labels | UI/source and ordinary regression passed | Deployed on dev.164 | **Blocked:** different Requirement Version error |
| UAT-084 | Reviewed summary metadata retained and displayed prominently | Matching snapshot independently verified in PostgreSQL | Deployed on dev.164 | **Partial:** saved summary observed; matching context blocked |
| UAT-085 | One atomic `Shortlist and assign to Opportunity` action creates exact match/origin/assignment lineage | Real HTTP/PostgreSQL 2/2 passed | Deployed on dev.164 | **Blocked:** no ranked candidate/action reached |

Ordinary local regression for cumulative dev.164: 1,214 tests, 1,184 passed, 30 protected tests intentionally skipped
by the ordinary runner, 0 failed. The separately invoked protected UAT-081 and UAT-082/084/085 suites passed 3/3.
Package SHA-256: `b609ea5394f4fad9a80531b78468753951a48e20f1ced51d3d208ba1bbf0dfd1`. Deployment completed on
25 August 2026 with one verified worker (PID `4019`), migration 105, ready health/readiness responses, disabled
integration switches and unchanged Production/R2 snapshots. None of UAT-081 through UAT-085 is marked passed until
the user observes the corrected behavior in CRM Test.

### Human UAT continuation on dev.164 — 25 August 2026, 23:30–23:34 GST

- **Environment observed:** CRM Test served `NYSA CORE 2.1.0-dev.164`. The signed-in identity was Sunita Sinha,
  Administrator. Production, the R2 clone and Property Finder were not opened or used.
- **Synthetic record observed:** Customer `uat159cust1`, Lead `NYSA-LD-202608-000048`, Opportunity
  `NYSA-OP-202608-000008`. The Lead owner and Opportunity owner displayed as `ajitr`.
- **UAT-081 observed result — blocked, not passed:** The Lead displayed historical qualification `Warm`,
  `Governed target: 240 business minutes`, and next follow-up `26 Aug 2026, 16:38`. Because the signed-in
  Administrator was not the assigned owner, no `Assess qualification` action was displayed. The Lead Tasks workspace
  displayed `No planned actions for this lead.` The required Hot, Warm and Cold saves and their newly created governed
  Tasks/deadlines were therefore not executed. No pass is inferred from the displayed guidance.
- **UAT-082 observed result — partial, not passed:** Before any new Requirement was saved, current Requirement version
  2 displayed as `Broker-confirmed`, but the guided journey displayed Requirements as `current` with
  `Current Requirement version 2 is not the version linked to NYSA-OP-202608-000008`; Match displayed `blocked` with
  `Align the Opportunity to the current confirmed Requirement before ranking Inventory`. The corrected mismatch state
  was directly observed, but the confirmation-to-exactly-aligned completion path was not completed.
- **UAT-083 observed result — partial, not passed:** The Opportunity displayed the dedicated
  `Inventory recommendation and assignment` workspace, the wording `Run transparent advisory ranking against this
  Opportunity's exact confirmed Requirement Version`, and the action `Rank available Inventory`. Selecting the action
  returned `Opportunity NYSA-OP-202608-000008 is linked to a different Requirement Version. Align the Opportunity
  before running matching`. No ranked candidate layout was reached.
- **UAT-084 observed result — partial, not passed:** Synthetic conversation notes were submitted through the AI draft
  workflow. CRM Test generated a summary, `Confidence: high`, three retained questions and two warnings. After
  `Apply reviewed draft to form` and `Save new version`, CORE displayed `New unconfirmed requirement version saved`
  and created Requirement version 3. The saved card prominently displayed `Reviewed AI requirement summary`, the full
  generated summary, confidence, retained questions, retained warnings, and `Reviewed and saved 25 Aug 2026, 23:34.
  It assists the Agent; the confirmed structured fields remain authoritative.` Matching-context retention was not
  observed because version 3 was unconfirmed and the Opportunity was still linked to an older Requirement.
- **UAT-085 observed result — blocked, not passed:** Candidate ranking, candidate selection and
  `Shortlist and assign to Opportunity` were not reached because exact Requirement/Opportunity alignment blocked the
  matching run. The existing active assignment shown on the Opportunity was not created during this retest and is not
  treated as evidence for UAT-085. No new assignment, communication, Viewing, Offer or reservation was created during
  this item.

The directly observed dev.164 results above do not close UAT-081 through UAT-085. A signed-in assigned Sales Agent and
an Opportunity aligned to the exact current confirmed Requirement remain necessary to finish the pending paths.

### Assigned Sales Agent continuation on dev.164 — 25 August 2026, 23:36–23:38 GST

- **Environment and role observed:** CRM Test served `NYSA CORE 2.1.0-dev.164`; the signed-in identity displayed as
  `ajitr` with role `Sales Agent`. The same synthetic Customer, Lead and Opportunity were used. Production, R2 and
  Property Finder were not opened or used.
- **UAT-081 observed result — failed on dev.164:** The assigned Agent could open `Assess qualification`. All six
  maintained answers were selected at their highest values to produce the Hot case, then `Calculate new assessment`
  was selected. CORE returned `An active SLA policy with valid Qualification follow-up timings is required`. The Hot
  assessment did not save. Warm and Cold were not attempted after this prerequisite failure; no governed deadline or
  qualification follow-up Task was created. UAT-081 is not passed.
- **UAT-082 observed result — failed/incomplete on dev.164:** Requirement version 3 initially displayed as requiring
  broker confirmation. The assigned Agent entered synthetic confirmation evidence and selected
  `Confirm exact requirement version`; CORE displayed `Requirement version 3 confirmed for governed matching`, and
  the saved Requirement displayed `Confirmed by ajitr · 25 Aug 2026, 23:38`. After a fresh journey load, Requirements
  remained `current` with `Current Requirement version 3 is not the version linked to NYSA-OP-202608-000008`; Match
  remained `blocked` with `Align the Opportunity to the current confirmed Requirement before ranking Inventory`.
  No visible action to perform that alignment was present. Exact aligned completion was not reached.
- **UAT-083 observed result — blocked, not passed:** As the assigned Agent, selecting `Rank available Inventory` in
  the dedicated deterministic workspace returned `Opportunity NYSA-OP-202608-000008 is linked to a different
  Requirement Version. Align the Opportunity before running matching`. No ranking results were displayed.
- **UAT-084 observed result — partial, not passed:** After Agent confirmation, Requirement version 3 continued to
  display the prominent `Reviewed AI requirement summary`, `Confidence` value `high`, all retained questions, all
  retained warnings and the human-reviewed/authoritative-fields explanation. Matching-context retention still could
  not be observed because the Opportunity/Requirement lineage remained misaligned.
- **UAT-085 observed result — blocked, not passed:** Because UAT-083 produced no ranked candidates, the Agent could
  not select a candidate or invoke `Shortlist and assign to Opportunity`. No new assignment or partial assignment was
  displayed or created during this continuation.

This assigned-Agent continuation replaces the earlier role-access blocker for UAT-081 with the exact active-SLA-policy
failure above. It does not change the deployed status of dev.164 and does not create a pass for UAT-081 through
UAT-085.

### UAT-081 focused rerun after SLA activation — 25 August 2026, 23:45–23:46 GST

- **Role and record:** Assigned Sales Agent `ajitr`; synthetic Lead `NYSA-LD-202608-000048`.
- **Hot:** All six maintained answers were selected at their highest values. CORE saved `Hot`, displayed
  `Governed target: 15 elapsed minutes (24/7, including outside business hours)`, updated Next follow-up to
  `26 Aug 2026, 00:01`, and created open `Hot Lead qualification follow-up`, `Urgent`, due `26 Aug 2026, 00:01`.
- **Warm:** All six maintained answers were selected at their middle values. CORE saved `Warm`, updated Next
  follow-up to `26 Aug 2026, 13:00`, cancelled the Hot Task with outcome
  `Superseded by a later governed Qualification assessment`, and created open `Warm Lead qualification follow-up`,
  `High`, due `26 Aug 2026, 13:00`.
- **Cold:** All six maintained answers were selected at their lowest values. CORE saved `Cold`, displayed
  `Governed target: 1 business day; then every 5 business days while still Cold`, updated Next follow-up to
  `26 Aug 2026, 18:00`, cancelled the Warm Task with the same supersession outcome, and created open
  `Cold Lead nurture follow-up`, `Normal`, due `26 Aug 2026, 18:00`.
- **Result:** **UAT-081 passed by direct assigned-Agent observation after the Administrator activated the maintained
  SLA policy.** The Cold successor-cycle behavior was not invoked because the focused human script required the three
  saves, governed displayed deadlines and open Task, not completion of the live Cold Task.
- **Downstream recheck:** UAT-082 remained incomplete: current broker-confirmed Requirement version 3 was still not
  linked to `NYSA-OP-202608-000008`, and Match remained blocked. UAT-083 again returned the different Requirement
  Version error. UAT-084's reviewed summary remained visible. UAT-085 remained unreachable. No downstream pass is
  inferred from UAT-081.

### Local correction after dev.164 observation — candidate dev.165

- **Observed defect addressed locally:** The connected Lead journey now exposes `Review and align` when the visible
  current broker-confirmed Requirement Version differs from the linked Opportunity Requirement Version and the
  signed-in user has Opportunity write authority.
- **Governed behavior implemented:** The action requires an optimistic Opportunity version, a reason of at least ten
  characters, and explicit acknowledgement of stale matching. It retains older Property Matches as rejected history,
  delinks stale active assignments with immutable events, records old/new Requirement IDs in Opportunity audit, and
  blocks rather than infers recovery when a non-cancelled Viewing, Offer, Booking or Deal already exists.
- **Lineage correction:** Migration `106_dev165_opportunity_requirement_realignment.sql` replaces the one-match-per-
  Opportunity/Inventory uniqueness boundary with one match per Opportunity/Requirement/Inventory. An old match is
  therefore not rewritten to impersonate a later matching run.
- **Disposable-database observation:** A matching request against the misaligned Opportunity returned the existing
  different-Requirement-Version rejection and created no partial run. After explicit alignment, the old match remained
  rejected against the old Requirement; a new deterministic run used the new Requirement and atomic shortlist plus
  assignment created a separate new match lineage. Protected focused tests: 2/2 passed.
- **Ordinary regression observation:** 1,217 total; 1,187 passed; 30 protected tests skipped by guard; 0 failed.
- **Human UAT status:** No pass is inferred. UAT-082 remains failed/incomplete on deployed dev.164, UAT-083 and UAT-085
  remain blocked on deployed dev.164, and UAT-084 remains partial on deployed dev.164. Candidate dev.165 requires
  separate CRM Test deployment approval and assigned-Agent observation.
- **Environment boundary:** The implementation and verification were local only. Production, R2 and Property Finder
  were not opened, called or changed.

### dev.165 CRM Test deployment completion — 26 August 2026

- **Approval and scope:** The user explicitly approved deployment to CRM Test and completed the authenticated cPanel
  upload step. Production, the R2 clone and Property Finder remained excluded.
- **Package identity:** `nysa-core-consolidated-crm-test-dev165.zip`; SHA-256
  `f333a88861092de66d0211743497666c8c16f51943bdf73923e0d079a5bae455`; 296 runtime-manifest entries; 106
  migrations.
- **Guarded installer observation:** Checksum, JSON-manifest, runtime-manifest, exact CRM Test root, database identity
  and installed dev.164/migration-105 baseline gates completed. The installer then reported `Deployment confirmed`,
  one verified LiteSpeed listener PID `3505232`, installed/served version `2.1.0-dev.165`, latest migration
  `106_dev165_opportunity_requirement_realignment.sql (106 total)`, disabled integration switches and unchanged
  Production/R2 clone snapshots.
- **Backup observation:** The exact reported backup path was
  `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260825T211530Z`. The inherited installer emitted the
  legacy `dev162` directory label while separately enforcing the dev.164/migration-105 pre-deployment baseline.
- **Independent endpoint observations:** Public health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.165"}`. Public readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.165"}`.
- **Signed-in browser observation:** The existing assigned Sales Agent CRM Test Lead workspace rendered after
  refresh. Property Finder was not opened, called or changed; no Production or R2 application page was opened.
- **Human UAT status:** No human pass is inferred from packaging, deployment, endpoint checks or page rendering.
  UAT-081 retains its directly observed dev.164 pass after SLA activation. UAT-082 retains failed/incomplete,
  UAT-083 retains blocked, UAT-084 retains partial and UAT-085 retains blocked until direct assigned-Agent execution
  on dev.165 records a different result.

### Assigned Sales Agent human UAT continuation on dev.165 — 26 August 2026, 01:17–01:20 GST

- **Environment and role observed:** CRM Test displayed `NYSA CORE 2.1.0-dev.165`; signed-in identity `ajitr`, role
  `Sales Agent`. Testing reused synthetic Lead `NYSA-LD-202608-000048`, Opportunity
  `NYSA-OP-202608-000008` and broker-confirmed Requirement version 3. Production, R2 and Property Finder were not
  opened or used.
- **UAT-081:** Not rerun. Its directly observed dev.164 pass after SLA activation remains the recorded result.
- **UAT-082 observed result — failed/incomplete, not passed:** The journey displayed Requirement version 3 as
  current but not linked to the Opportunity, Match as blocked, and `Review and align`. Its impact preview stated that
  two earlier matches would remain rejected history and one stale active assignment would be delinked. Selecting the
  action produced no usable reason/acknowledgement form and no alignment. The current in-app browser logged exactly
  `Error: prompt() is not supported.` The journey remained misaligned and Match remained blocked. This observation is
  not generalized beyond the browser context that produced it.
- **UAT-083 observed result — blocked, not passed:** The dedicated deterministic workspace and transparent advisory
  wording rendered. `Rank available Inventory` returned exactly `Opportunity NYSA-OP-202608-000008 is linked to a
  different Requirement Version. Align the Opportunity before running matching`. No ranking results appeared.
- **UAT-084 observed result — partial, not passed:** Broker-confirmed Requirement version 3 prominently displayed the
  complete reviewed summary, confidence `high`, all three retained questions, both retained warnings, the review
  timestamp, confirming Agent and the authoritative-fields explanation. Matching-context retention was not observed
  because UAT-082 prevented a new matching run.
- **UAT-085 observed result — blocked, not passed:** No ranked candidates appeared and no
  `Shortlist and assign to Opportunity` control was present. Active assignment
  `c873344a-1538-4ec9-88be-a1cfc23b7fee` pre-existed this continuation and was not treated as current-test evidence.
  No new assignment, communication, Viewing, Offer or reservation was created.

No new UAT pass is inferred from this continuation. UAT-081 retains its earlier pass; UAT-082 remains
failed/incomplete, UAT-083 blocked, UAT-084 partial and UAT-085 blocked.

### Local correction after dev.165 observation — candidate dev.166, not deployed

- **Exact blocker addressed:** The visible dev.165 `Review and align` action called native `prompt()` and
  `confirm()`. In the current signed-in in-app browser this produced exactly `Error: prompt() is not supported.` and
  did not expose the governed reason/acknowledgement controls.
- **Implemented behavior:** Candidate `2.1.0-dev.166` replaces those native dialogs only for Requirement alignment
  with an accessible in-page form. The form shows the immutable stale-evidence impact, requires a reason of at least
  ten characters, requires explicit stale matching acknowledgement when applicable, and submits the existing
  optimistic Opportunity version to the existing governed alignment endpoint.
- **Governance retained:** The migration-106 schema and alignment transaction are unchanged. Historical matches are
  not rewritten, stale assignments require immutable delink events, and existing Viewing, Offer, Booking or Deal
  evidence continues to block ordinary alignment.
- **Automated observations:** Focused syntax/journey tests passed 8/8; package/dialog gates passed 5/5. Full ordinary
  regression: 1,222 total, 1,192 passed, 30 protected tests skipped by guard, 0 failed. The earlier protected real
  HTTP/PostgreSQL alignment evidence remains applicable because the API and database transaction did not change.
- **Deployment and human UAT:** Not deployed at this entry. No UAT pass is inferred; the dev.165 human observations
  remain authoritative pending explicit CRM Test deployment and assigned-Agent retest.
- **Environment boundary:** Production, R2 and Property Finder were not opened, called or changed.

### dev.166 CRM Test deployment completion — 29 August 2026

- **Package identity:** `nysa-core-consolidated-crm-test-dev166.zip`; SHA-256
  `1f5de019b9ca243198395ff6ddcf33d676dfea3ecdf89a69f1040b65c2f8d5fd`; 297 entries; 106 migrations; latest
  migration `106_dev165_opportunity_requirement_realignment.sql`.
- **Verification before upload:** Full ordinary regression 1,222 total, 1,192 passed, 30 protected skipped by guard,
  0 failed. Final package/dialog gate 3/3 passed; installer Bash syntax passed.
- **Pre-mutation wrapper correction:** The first wrapper run exited on its own marker-count assertion before
  deployment. CRM Test remained healthy on dev.165. Local tracing observed two generated markers rather than the
  wrapper's expected three; the assertion was corrected to two, package/installer tests passed 2/2, and the corrected
  wrapper alone was overwritten and rerun.
- **Guarded deployment observation:** The corrected installer reported `Deployment confirmed`, one verified
  LiteSpeed listener PID `1173096`, installed/served version `2.1.0-dev.166`, latest migration
  `106_dev165_opportunity_requirement_realignment.sql (106 total)`, disabled integration switches and unchanged
  Production/R2 clone snapshots.
- **Backup observation:** Exact reported path
  `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260829T113103Z`. The inherited safety body retained its
  legacy directory label while separately enforcing dev.165 and migration 106 as the pre-deployment baseline.
- **Independent endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.166"}`; readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.166"}`.
- **Environment boundary:** Production and R2 were not opened; their installer snapshots were unchanged. Property
  Finder was not opened, called or changed.
- **Human UAT status:** The prior assigned-Agent browser session expired on refresh and displayed the CRM Test
  sign-in screen. UAT-082 through UAT-085 were not rerun on dev.166. No pass or changed result is inferred pending
  assigned Sales Agent sign-in.

### UAT-079 — Active Lead Qualification Version has no controlled retirement action

- **Status:** Newly discovered during cumulative dev.159 human UAT.
- **Classification:** New dev.159 qualification-model lifecycle and Administration control gap; not currently
  identified as a regression.
- **Role:** Full Administrator governing Lead Qualification Versions.
- **Screen/workspace:** Administration → Lead Qualification Versions → Active model row.
- **Record reference:** Current active Qualification Version shown in the governed register; no private Customer data.
- **Prerequisites:** At least one Qualification Version has status `active`.
- **Exact steps:** Open Lead Qualification Versions, locate the active model and inspect its available actions.
- **Expected result:** A Full Administrator can select a controlled `Retire` or `Deactivate` action, review the
  affected objective and absence/presence of a replacement, enter a mandatory reason, and confirm the change. The
  system preserves historical assessments and clearly warns that new assessments for that objective will be blocked
  until a replacement is active.
- **Actual result:** The active row displays only `Available from Assess qualification`. There is no retirement or
  deactivation action.
- **Severity / blocker status:** Major governance gap contributing to the blocked qualification journey. UAT-078 is
  the direct save blocker; lack of retirement prevents an Administrator from withdrawing an incorrect or obsolete
  active policy through the governed interface.
- **Evidence:** User observation and dev.159 UI/route inspection. No private evidence is recorded.
- **Workaround:** None approved. Direct database updates are prohibited. Retiring the current model would not by
  itself resolve UAT-078 because retired rows still retain the conflicting historical version identity.
- **Issue:** Qualification models support activation and automatic replacement retirement, but do not support
  deliberate governed retirement when no replacement can yet be activated.
- **Confirmed RCA:** The UI renders Test for every model, Approve for Draft, Activate for Approved, and informational
  text for Active. It renders no Active-model action. The qualification route exposes GET, create, edit Draft, test,
  approve and activate endpoints; there is no retire/deactivate endpoint. The only retirement statement runs inside
  activation and retires a previous active model having the same model code and Customer objective.
- **Proposed solution:** Add a Full-Administrator-only retirement endpoint and UI action with mandatory reason,
  confirmation, audit evidence, effective end time and a clear impact preview. Preserve the model and all historical
  assessments immutably. Prevent retirement while an approved replacement activation is in progress, make repeated
  requests idempotent, and explicitly display `No active version` for the affected objective after retirement. Add
  real HTTP/database tests for authority, reason, history preservation, active-state removal, audit atomicity,
  idempotency and Lead questionnaire behaviour after retirement.
- **Implementation status:** Not started; diagnosed and documented only.
- **Deployment status:** The lifecycle gap is present on CRM Test `2.1.0-dev.159`.
- **Retest status:** Failed in dev.159 human UAT; pending correction, deployment and user-observed retest.

### UAT-086 — Ranked Inventory results do not scale beyond a small candidate set

- **Defect ID:** `DEF-086`.
- **Status:** Newly reported during CRM Test dev.166 human review on 30 August 2026; local correction implemented,
  not deployed and not human-retested.
- **Role:** Assigned Sales Agent reviewing Inventory recommendations for an Opportunity.
- **Screen/workspace:** Opportunity → Inventory recommendation and assignment → ranked Inventory results.
- **Evidence:** User-supplied screenshot of the dev.166 ranked Inventory surface. No private Customer data is retained
  in this record.
- **Exact observed concern:** Ranking can return tens or hundreds of Inventory records. Rendering every detailed
  property, scoring explanation and decision form inside the already long Opportunity page makes the workflow
  impractical and difficult to leave before or after selection.
- **Expected result:** Ranking opens in a dedicated review workspace, shows a bounded number of ranked properties at
  a time, preserves the immutable run and decisions, and provides an explicit return to the Opportunity both before
  and after a property is shortlisted and assigned.
- **Actual dev.166 result:** The matching renderer appends every rankable candidate card into the Opportunity's
  `Inventory recommendation and assignment` section. It has no pagination or dedicated return control.
- **Confirmed RCA:** `renderGovernedMatchingRun` rendered `rankable.map(renderCard)` without a volume boundary, and
  the Opportunity ranking button passed the embedded section itself as the result host.
- **Local correction:** The Opportunity now opens a full-width ranked Inventory workspace. Rankable properties are
  paginated 10 per page with Previous/Next controls and exact range/total text. `Return to Opportunity` is available
  at the sticky header and footer. Returning before selection preserves the Opportunity; returning after an
  assignment refreshes it so the new assignment is visible. The immutable matching run, decision, assignment and
  governance boundaries are unchanged.
- **Automated evidence:** Dedicated source/workspace/pagination/return-control tests passed 3/3. The focused
  UAT-082–086 set passed 9/9. Full ordinary regression: 1,225 total; 1,195 passed; 30 protected tests skipped by
  guard; 0 failed. Automated success does not establish human UAT passage.
- **Implementation status:** Corrected locally in the post-dev.166 candidate; no database migration required.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.167` and retained in `2.1.0-dev.168` on
  30 August 2026. Human retest remains pending and no pass is inferred from deployment.
- **Retest status:** Pending packaging, explicit CRM Test deployment approval and assigned-Agent observation with
  enough ranked properties to exercise at least two pages and return both before and after assignment.

### UAT-087 — Agent dashboard controls appear below the full attention queue

- **Defect ID:** `DEF-087`.
- **Status:** Newly reported and directly observed on CRM Test dev.166 on 30 August 2026; local correction
  implemented, not deployed and not human-retested.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Agent landing dashboard.
- **Exact observation:** `My dashboard`, `My Team` and `My tasks`, together with Saved views, Call report, Save view
  and Export, appeared only after the complete `What needs attention now` queue. Five case cards were visible before
  those controls in the observed session. Below them, the page continued with the lifecycle, filters, KPI cards and
  five fully expanded reference panels.
- **Expected result:** Primary dashboard navigation and actions are immediately available below the dashboard title.
  Priority work remains immediately visible, while supporting evidence, filters, performance measures and reference
  information can be opened on demand without removing any governed information.
- **Actual dev.166 result:** Primary navigation and actions are below the attention queue, forcing the Agent to
  scroll through every priority case before changing dashboard workspace. Supporting information is expanded by
  default, producing a long and repetitive landing page.
- **Evidence:** User report followed by read-only inspection of the signed-in CRM Test Agent dashboard. The identity
  was displayed as `ajitr · Sales Agent`; no Customer names, references or private record values are retained here.
- **Confirmed RCA:** The Agent template placed dashboard tabs inside the main flow after the guided-work container.
  Priority cards rendered source, all reasons and consequence inline, while performance and five reference panels
  rendered expanded with no progressive-disclosure boundary.
- **Local correction:** The Agent control bar is now directly below the dashboard heading and remains sticky on wide
  screens. Period and filters are in an on-demand drawer. Priority cards retain customer, status, required action,
  deadline and action button in the compact surface; source, campaign, every priority reason and consequence remain
  in an expandable evidence section. Performance/SLA measures and all five existing reference panels remain present
  in labelled disclosures. Manager and Managing Director layout paths are unchanged.
- **Automated evidence:** Dedicated UAT-087/088 plus dashboard requirements passed 32/32. Full ordinary regression:
  1,228 total; 1,198 passed; 30 protected tests skipped by guard; 0 failed. Automated success does not establish
  human UAT passage.
- **Implementation status:** Corrected locally in the post-dev.166 candidate; no database migration required.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.167` and retained in `2.1.0-dev.168` on
  30 August 2026. Human retest remains pending and no pass is inferred from deployment.
- **Retest status:** Pending packaging, explicit CRM Test deployment approval and assigned-Agent observation.

### UAT-088 — Agent qualification conversion rate displays `NaN`

- **Defect ID:** `DEF-088`.
- **Status:** Newly discovered during read-only UAT-087 inspection on CRM Test dev.166; local correction implemented,
  not deployed and not human-retested.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Agent dashboard → My qualification priorities → Warm conversion rate.
- **Expected result:** The governed Warm conversion rate is displayed as its numeric percentage.
- **Actual dev.166 result:** The row displayed exactly `NaN`.
- **Evidence:** Read-only inspection of the signed-in Agent dashboard. No private record values are retained.
- **Confirmed RCA:** The qualification renderer first formatted the rate as a string ending in `%`; the shared table
  renderer then passed that string through `Number(...)`, producing `NaN`.
- **Local correction:** The shared dashboard value formatter now preserves escaped, intentionally formatted strings
  and continues to normalize numeric values. The percentage suffix and governed source value are preserved.
- **Automated evidence:** A dedicated source contract verifies that the formatted percentage is not passed through
  the numeric coercion path. Focused UAT/dashboard regression passed 32/32. Full ordinary regression: 1,228 total;
  1,198 passed; 30 protected tests skipped by guard; 0 failed. Automated success does not establish human UAT
  passage.
- **Implementation status:** Corrected locally in the post-dev.166 candidate; no database migration required.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.167` and retained in `2.1.0-dev.168` on
  30 August 2026. Human retest remains pending and no pass is inferred from deployment.
- **Retest status:** Pending packaging, explicit CRM Test deployment approval and assigned-Agent observation.

### UAT-089 — Agent attention cards need clearer urgency and overdue differentiation

- **Defect ID:** `DEF-089`.
- **Status:** User-requested usability refinement on 30 August 2026; implemented locally, not deployed and not
  human-retested.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Agent dashboard → What needs attention now.
- **Exact request:** Add colour coding for expired items and items requiring urgent attention.
- **Expected result:** Elapsed deadlines and governed urgent work are immediately distinguishable without relying on
  colour alone. The exact deadline/countdown and action remain visible.
- **Actual dev.166 result:** Priority bands have narrow coloured borders, but compact Agent cards do not carry an
  explicit overdue/urgent status label or sufficiently differentiated card treatment.
- **Governed classification:** A recorded `dueMinutes` below zero is labelled `Overdue`. If not overdue, the existing
  `immediate` priority band is labelled `Urgent`; the existing `due_today` band is labelled `Due today`. No urgency is
  inferred from customer identity, free text or presentation order.
- **Local correction:** Agent cards now use a red soft treatment and `Overdue` badge for elapsed deadlines, amber and
  `Urgent` for the governed Immediate band, and gold with `Due today` for due-today work. Text badges and the existing
  exact countdown accompany every colour signal. Overdue takes precedence when an item also belongs to Immediate.
- **Automated evidence:** Dedicated classification, precedence, text-signal and styling contracts passed 2/2. The
  focused Agent/dashboard regression passed 39/39. Full ordinary regression: 1,230 total; 1,200 passed; 30 protected
  tests skipped by guard; 0 failed. Automated success does not establish human UAT passage.
- **Implementation status:** Corrected locally in the post-dev.166 candidate; no database migration required.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.167` and retained in `2.1.0-dev.168` on
  30 August 2026. Human retest remains pending and no pass is inferred from deployment.
- **Retest status:** Pending packaging, explicit CRM Test deployment approval and assigned-Agent visual observation.

### UAT-090 — Agent Proposal workload summary duplicates governed proposal work

- **Defect ID:** `DEF-090`.
- **Status:** User-requested Agent dashboard simplification on 30 August 2026; implemented locally, not deployed and
  not human-retested.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Agent dashboard → Workload and supporting details → Proposal workload.
- **Exact request:** The Agent `Proposal workload` summary is unnecessary.
- **Expected result:** The Agent landing dashboard does not repeat proposal lifecycle counts. Proposal history,
  preparation and correction work remain available in their authoritative workspaces.
- **Actual dev.166 result:** The Agent reference area repeats aggregate Prepare, Review, Send and Sent counts even
  though proposal history and preparation are maintained from the Lead and returned corrections appear in My tasks.
- **Local correction:** Removed only the `Proposal workload` disclosure from the Agent dashboard. Existing proposal
  records, immutable versions, status history, preparation workflow, Lead entry point and proposal-correction tasks
  are unchanged. Manager and Managing Director workload and approval surfaces are unchanged.
- **Automated evidence:** Dedicated Agent-only removal and authoritative-path preservation contracts passed 2/2.
  Focused Agent/dashboard regression passed 36/36. Full ordinary regression: 1,232 total; 1,202 passed; 30 protected
  tests skipped by guard; 0 failed. Automated success does not establish human UAT passage.
- **Implementation status:** Corrected locally in the post-dev.166 candidate; no database migration required.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.167` and retained in `2.1.0-dev.168` on
  30 August 2026. Human retest remains pending and no pass is inferred from deployment.
- **Retest status:** Pending packaging, explicit CRM Test deployment approval and assigned-Agent visual observation.

### dev.167 CRM Test deployment completion — 30 August 2026

- **Included defects:** `DEF-086` through `DEF-090`, mapped one-to-one to UAT-086 through UAT-090.
- **Package:** `nysa-core-consolidated-crm-test-dev167.zip`; SHA-256
  `ec4bfa9d80c50a2e6f9db54d2d4bbbafa8c74659cc3404b7d2ff7d0e59253876`; 296 entries; 106 migrations.
- **Automated evidence:** Linked-functionality gate 79/79 passed. Full ordinary regression: 1,232 total; 1,202
  passed; 30 protected skipped; 0 failed. Package integrity 2/2 passed and the package reproduced identically.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.167`, latest migration `106_dev165_opportunity_requirement_realignment.sql (106 total)`, disabled
  integration switches and unchanged Production/R2 clone snapshots.
- **Worker observation:** Installer and independent process output showed one CRM Test LiteSpeed listener PID
  `3883094`. The additional line in the independent command was the command's `grep` process, not a Node worker.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.167"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.167"}`.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T053706Z`. The retained directory
  label is inherited from the reviewed safety body; the baseline gate required dev.166 and migration 106.
- **Human UAT boundary:** The signed-in Agent dashboard and Opportunity rendered on dev.167. These smoke observations
  do not mark UAT-086 through UAT-090 passed.

### UAT-091 — Direct Opportunity route leaves an in-flight dashboard renderer attached to removed controls

- **Defect ID:** `DEF-091`.
- **Status:** Newly observed during the dev.167 live post-deployment smoke on 30 August 2026; corrected and deployed
  cumulatively in dev.168, with direct-route smoke observed and human UAT still pending.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Direct Opportunity URL opened immediately after application bootstrap.
- **Exact observed result:** Opportunity `NYSA-OP-202608-000008` rendered, including the dedicated ranked Inventory
  entry point, while the browser console recorded exactly `TypeError: Cannot read properties of null (reading
  'addEventListener')` at `dashboard-ui.js` line 101.
- **Expected result:** Direct record routing cancels or safely exits the in-flight dashboard renderer after the
  dashboard DOM is replaced, with no console error and no attempt to bind removed dashboard controls.
- **Confirmed RCA:** Application bootstrap begins the asynchronous dashboard renderer, then the direct-record router
  replaces `#view` with the Opportunity workspace. After team/staff/filter-option requests return, the renderer
  unconditionally calls `addEventListener` on the removed `#dashboard-source` element before its later render-sequence
  guard.
- **Local correction:** The renderer now checks that `#dashboard-source` still exists and that its render sequence is
  current before binding the source-change event or starting the dashboard data request.
- **Governance and linked-function boundary:** No API, database, ranking, assignment, Opportunity, proposal, task,
  hierarchy or role-scope behavior changes. The correction only ends an obsolete presentation render.
- **Implementation status:** Corrected locally for cumulative candidate `2.1.0-dev.168`; no migration required.
- **Deployment status:** Deployed to CRM Test `2.1.0-dev.168` on 30 August 2026.
- **Retest status:** Post-deployment direct-route smoke rendered the exact Opportunity and dedicated ranking entry
  point with no dev.168 browser warning or error. This operational smoke is not recorded as a human UAT pass.

### dev.168 CRM Test deployment completion — 30 August 2026

- **Cumulative scope:** DEF-086/UAT-086 through DEF-091/UAT-091.
- **Package:** `nysa-core-consolidated-crm-test-dev168.zip`; SHA-256
  `2285c2b107a72a97518247c93aff447a59888bcc18dc260bb58d512c37c53e2a`; 296 entries; 106 migrations. The package
  reproduced twice with the identical checksum.
- **Automated evidence:** Linked-functionality gate 80/80 passed. Full ordinary regression: 1,237 total; 1,207
  passed; 30 protected skipped; 0 failed. Package integrity and target-lock checks passed 2/2.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.168`, latest migration `106_dev165_opportunity_requirement_realignment.sql (106 total)`, disabled
  integration switches and unchanged Production/R2 clone snapshots.
- **Worker observation:** Installer and independent exact-process filtering both returned one CRM Test LiteSpeed
  listener: PID `4034532`. No stale second Node worker was observed.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.168"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.168"}`.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T054256Z`. The inherited safety body
  retains its legacy directory label while enforcing the dev.167/migration-106 baseline.
- **Signed-in browser smoke:** Assigned Sales Agent `ajitr` directly opened Opportunity
  `NYSA-OP-202608-000008`; the exact dev.168 version, Opportunity and `Open ranked Inventory workspace` entry point
  rendered. No dev.168 browser warning or error was recorded. Ranking was not run and no business record changed.
- **Environment boundary:** Production, R2 and Property Finder were not opened, called or changed.
- **Human UAT boundary:** No human pass is inferred. UAT-086 through UAT-091 remain pending direct user observation.

### UAT-092 — Opportunity stages render as sections in one continuous page

- **Defect ID:** `DEF-092`.
- **Status:** User-requested design correction on 30 August 2026; deployed in `2.1.0-dev.169`, with the
  stage-pane binding correction deployed cumulatively in `2.1.0-dev.170`. Human UAT remains pending.
- **Role:** Signed-in Sales Agent.
- **Screen/workspace:** Opportunity → Inventory selection, Viewing & feedback, Offer, Negotiation, Booking &
  reservation, and Deal & completion.
- **Exact observed result:** The six stage controls changed which section was visible inside the same continuous
  Opportunity page. The selected stage did not open a separate focused page and there was no consistent Back,
  Save as draft, and Save action set.
- **User-confirmed design principle:** Long continuous transaction pages are not acceptable. Each workflow section
  must open as a focused page. `Save as draft` must create a version.
- **Expected result:** Each of the six stages opens as a dedicated full-screen in-application page. Back returns to
  the Opportunity without committing. Save as draft creates a numbered server-side version. Save invokes only the
  existing governed action selected on that page.
- **Local correction:** The Opportunity remains the stage overview. Each stage now opens one focused page with
  Back, Save as draft and Save controls. Existing Inventory assignment, Viewing, Offer, Negotiation, Booking and Deal
  forms and their prerequisites remain the authoritative business actions; they were moved, not duplicated.
- **Draft version model:** Drafts are scoped to Opportunity, stage and signed-in user. Repeated saves append immutable
  version numbers; the latest version loads automatically and prior versions are available through compact Draft
  history. After a successful governed Save, a separate immutable finalization record closes the current draft while
  retaining it in history. Draft payloads exclude file contents, so reservation evidence must be selected again.
  Draft creation does not create or mutate an Inventory assignment, Viewing, Offer, Booking, Deal or Opportunity
  stage.
- **Security/concurrency controls:** Reads use Opportunity scope. Writes require Opportunity write scope and the
  exact Opportunity version that opened the workspace. Payloads must be JSON objects no larger than 64 KB. Version
  creation is serialized under the Opportunity row lock and recorded in the audit log.
- **Database change:** Migration `107_dev169_versioned_opportunity_stage_drafts.sql` adds immutable stage draft
  versions and a latest-version retrieval index.
- **Automated evidence:** Focused Opportunity lifecycle and DEF-092 regression passed 25/25. Full ordinary regression
  passed 1,240 total: 1,210 passed, 30 protected tests skipped by guard, 0 failed. Automated success does not
  establish human UAT passage.
- **Deployment status:** Deployed cumulatively to CRM Test `2.1.0-dev.170` on 30 August 2026. Production, R2 and
  Property Finder remained excluded.
- **Retest status:** Signed-in read-only smoke opened all six focused stage pages with their Back, Save as draft and
  Save controls. No draft or business record was created. This smoke does not establish a human UAT pass.

### dev.169 CRM Test deployment and failed stage-navigation smoke — 30 August 2026

- **Package:** `nysa-core-consolidated-crm-test-dev169.zip`; SHA-256
  `1bd01de26e6d80e061095e10f38f3eb88b2febcf737954f224f526dd8117648b`; 299 entries; 107 migrations.
- **Deployment observation:** Guarded deployment confirmed version `2.1.0-dev.169`, migration
  `107_dev169_versioned_opportunity_stage_drafts.sql`, one fresh verified LiteSpeed worker PID `1508923`, disabled
  integration switches, backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T064925Z`, and
  unchanged Production/R2 snapshots.
- **Independent endpoint observation:** Health returned `{"ok":true,"process":"ready","version":"2.1.0-dev.169"}`
  and readiness returned `{"ok":true,"database":"ready","version":"2.1.0-dev.169"}`. Exact-process filtering
  returned one CRM Test listener, PID `1508923`.
- **Signed-in smoke observation:** The assigned Sales Agent opened Opportunity `NYSA-OP-202608-000008`. The six stage
  controls and focused-page guidance rendered. Selecting Inventory selection returned exactly `This stage is not
  available for this Opportunity.` No draft or business record was created or changed.
- **Human UAT boundary:** UAT-092 did not pass. The failed smoke was recorded as DEF/UAT-093 and required a cumulative
  hotfix before this deployment could be considered complete.

### UAT-093 — Inventory stage button cannot resolve its rendered stage pane

- **Defect ID:** `DEF-093`.
- **Status:** Discovered by signed-in post-deployment smoke on CRM Test dev.169; corrected locally in cumulative
  candidate `2.1.0-dev.170`, not yet deployed or human-retested.
- **Exact observed result:** Selecting `Inventory selection` displayed exactly `This stage is not available for this
  Opportunity.` The overview remained visible.
- **Expected result:** The button opens the rendered Inventory assignment and matching-evidence section as the
  dedicated stage page, with Back, Save as draft and Save controls.
- **Confirmed RCA:** Earlier UAT-086 work renamed the Inventory section heading from `Explainable property shortlist`
  to `Inventory assignments and matching evidence`. The new stage-page binding attempted to rediscover the section
  using the obsolete heading text, producing no Inventory pane even though the already-held
  `inventorySelectionSection` reference was valid.
- **Correction:** The Inventory stage now binds directly to `inventorySelectionSection`; it no longer relies on
  presentation text for functional identity. Viewing, Offer, Negotiation, Booking and Deal bindings are unchanged.
- **Automated evidence:** Focused Opportunity lifecycle regression passed 26/26. Full ordinary regression passed
  1,243 total: 1,213 passed, 30 protected skips, 0 failed. Automated success does not establish human UAT passage.
- **Deployment boundary:** Dev.170 is migration-neutral and must accept only dev.169 with migration 107 (or an exact
  dev.170/migration-107 rerun). Production, R2 and Property Finder remain excluded.

### dev.170 CRM Test deployment completion — 30 August 2026

- **Cumulative scope:** DEF-086/UAT-086 through DEF-093/UAT-093.
- **Package:** `nysa-core-consolidated-crm-test-dev170.zip`; SHA-256
  `31542525c903c18693a20eb58419ef55e89b836c037037d2102fe03624443481`; 301 entries; 107 migrations. The package
  reproduced twice with the identical checksum.
- **Automated evidence:** Focused Opportunity lifecycle 26/26 passed. Full ordinary regression: 1,243 total; 1,213
  passed; 30 protected skipped; 0 failed. Package and installer contracts passed 6/6.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.170`, latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`, disabled
  integration switches and unchanged Production/R2 snapshots.
- **Worker observation:** Installer and independent exact-process filtering both returned one CRM Test LiteSpeed
  listener: PID `1630758`. No stale second Node worker was observed.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.170"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.170"}`.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T065414Z`.
- **Signed-in browser smoke:** Assigned Sales Agent `ajitr` directly opened Opportunity
  `NYSA-OP-202608-000008`. Inventory selection opened as Stage 1 with Back, Save as draft, Save and Draft history.
  Viewing & feedback, Offer, Negotiation, Booking & reservation and Deal & completion each opened with the exact
  expected title and the same action controls. Browser warnings/errors returned an empty list. No draft or business
  record was created or changed.
- **Environment boundary:** Production, R2 and Property Finder were not opened, called or changed.
- **Human UAT boundary:** Operational deployment and read-only smoke succeeded. No human pass is inferred;
  UAT-086 through UAT-093 remain subject to direct user acceptance unless separately recorded otherwise.

### UAT-094 — Agent dashboard visual hierarchy and website-brand alignment

- **Defect ID:** `DEF-094`.
- **Status:** Deployed to CRM Test in cumulative candidate `2.1.0-dev.171`; human UAT pending.
- **Role:** Signed-in Sales Agent.
- **User-requested result:** Bring `My dashboard` and its working controls higher on the page; simplify the Agent
  dashboard without removing information; make expired and urgent items visually distinct; remove unnecessary
  technical emphasis from Operational exceptions and Proposal workload; and align the visual system with the new
  NYSA website logo, palette and typography.
- **Implemented scope:** The Agent dashboard alone receives the website-aligned ink, pine, bronze, gold, mineral,
  alabaster and mist palette, the website font stack, proportional heading sizes, compact card spacing and explicit
  urgency states. The existing official NYSA shell logo remains the identity asset. No dashboard information or
  governed business action was removed.
- **Copy boundary:** `Four Overlapping KPI cards removed` is a prototype annotation and is not present in the
  deployed application asset.
- **Automated evidence:** Focused theme/version checks passed 16/16. Full ordinary regression passed 1,248 total:
  1,218 passed, 30 protected tests skipped by guard and 0 failed. Post-build package/theme contracts passed 5/5.
  Automated success does not establish human UAT passage.
- **Human UAT boundary:** Pending direct signed-in Agent review; no pass is inferred.

### dev.171 CRM Test deployment completion — 30 August 2026

- **Cumulative scope:** DEF/UAT-086 through DEF/UAT-094.
- **Package:** `nysa-core-consolidated-crm-test-dev171.zip`; SHA-256
  `a051b3150ee019961d346848d5eb0be85ffbc768fd76848630c24308c420c8ce`; 303 entries; 107 migrations.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.171`, latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`, disabled
  integration switches and unchanged Production/R2 clone snapshots.
- **Worker observation:** Installer and independent exact-process filtering both returned one CRM Test LiteSpeed
  listener: PID `3233987`. No stale second CRM Test worker was observed.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.171"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.171"}`.
- **Live asset observations:** The Agent-theme marker was present in both the served root CSS and
  `dashboard-ui.js`. The prototype annotation `Four Overlapping KPI cards removed` was absent from the served
  application asset.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T075833Z`.
- **Environment boundary:** Production, R2 and Property Finder were not targeted. The installer independently
  reported Production/R2 snapshots unchanged and integration switches disabled.
- **Human UAT boundary:** No human pass is inferred. UAT-094 remains pending direct signed-in Agent review.

### UAT-095 — Shared CORE shell and application screens match the website-aligned Agent dashboard

- **Defect ID:** `DEF-095`.
- **Status:** Deployed to CRM Test in cumulative candidate `2.1.0-dev.172`; human UAT pending.
- **Role:** Signed-in Sales Agent, with application-wide visual scope.
- **Exact user observation:** The deployed Agent dashboard used the new palette and typography, but the landing
  page, shared CORE shell and application screens did not yet share the same design system. On a wide display the
  1,500 px workspace ceiling also left a large unused area.
- **Correction:** Website-aligned ink, pine, bronze, gold, mineral, alabaster and mist tokens now drive the shared
  CORE shell and application controls. The website UI font stack is global; page and panel headings use the website
  serif stack. Primary actions use pine, navigation uses the shared gold/pine states, and the workspace ceiling is
  1,920 px with proportional side padding.
- **Preservation boundary:** The official NYSA logo assets, screens, information, fields and governed actions are
  unchanged. This is a presentation-system change only.
- **Automated evidence:** Focused shared-theme/dashboard checks passed 34/34. Full ordinary regression passed
  1,252 total: 1,222 passed, 30 protected tests skipped by guard and 0 failed. Post-build package/theme contracts
  passed 4/4. Automated success does not establish human UAT passage.
- **Human UAT boundary:** Pending direct user review; no pass is inferred.

### dev.172 CRM Test deployment completion — 30 August 2026

- **Cumulative scope:** DEF/UAT-086 through DEF/UAT-095.
- **Package:** `nysa-core-consolidated-crm-test-dev172.zip`; SHA-256
  `270f1f2c7c24a1b7447e04d31888cf1aa4cacb6363e5fe68c879bf65b2d8a6be`; 304 entries; 107 migrations.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.172`, latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`, disabled
  integration switches and unchanged Production/R2 clone snapshots.
- **Worker observation:** Installer and independent exact-process filtering both returned one CRM Test LiteSpeed
  listener: PID `3548592`. No stale second CRM Test worker was observed.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.172"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.172"}`.
- **Live asset observations:** The served root contained `CORE-WEBSITE-THEME-DEV172` and the 1,920 px shared
  workspace ceiling.
- **Signed-in browser smoke:** The Sales Agent dashboard visibly reported dev.172 and rendered the unified CORE
  header, navigation, dashboard typography, controls and widened workspace. No record was changed.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T081058Z`.
- **Environment boundary:** Production, R2 and Property Finder were not targeted. The installer independently
  reported Production/R2 snapshots unchanged and integration switches disabled.
- **Human UAT boundary:** No human pass is inferred. UAT-095 remains pending direct user review.

### UAT-096 — Agent dashboard summary placement and non-duplicated environment identity

- **Defect ID:** `DEF-096`.
- **Status:** Deployed to CRM Test in cumulative candidate `2.1.0-dev.173`; human UAT pending.
- **Role:** Signed-in Sales Agent, with shared-header and Administration identity scope.
- **User-requested result:** Keep Pipeline at a glance and the Customer-to-Deal operating sequence near the top as
  the overall summary, while preserving the detailed task queue below. Remove the visible duplicate Agent workspace
  and user dashboard title. Do not display a redundant Production badge in Production, and maintain the application
  version in an Administration panel.
- **Correction:** The Agent dashboard controls remain first. A compact Operations overview follows with Pipeline at
  a glance visible and the complete operating sequence available as an expandable disclosure. What needs attention
  now follows the overview. The duplicate visible workspace/user title is removed while an accessible hidden heading
  remains. Production suppresses its environment badge; non-production environments retain a warning. Application,
  version and environment identity are available under Administration → About.
- **Preservation boundary:** Existing pipeline values, operating-sequence information, attention records, filters,
  saved views and governed actions are retained. This is a frontend information-hierarchy and identity change only.
- **Automated evidence:** Focused Agent-dashboard information-hierarchy checks passed 15/15. Full ordinary regression
  passed 1,257 total: 1,227 passed, 30 protected tests skipped by guard and 0 failed. Post-build package checks passed
  5/5. Automated success does not establish human UAT passage.
- **Human UAT boundary:** Pending direct signed-in Agent review; no pass is inferred.

### dev.173 CRM Test deployment completion — 30 August 2026

- **Cumulative scope:** DEF/UAT-086 through DEF/UAT-096.
- **Package:** `nysa-core-consolidated-crm-test-dev173.zip`; SHA-256
  `ae5542cf75b597664da6a815d532f2139416647af896612cb4e8973f2b838230`; 307 entries; 107 migrations.
- **Deployment observation:** The guarded installer reported `Deployment confirmed`, installed/served version
  `2.1.0-dev.173`, latest migration `107_dev169_versioned_opportunity_stage_drafts.sql (107 total)`, disabled
  integration switches and unchanged Production/R2 clone snapshots.
- **Worker observation:** The installer returned one verified CRM Test LiteSpeed listener, and independent exact
  process filtering returned only `CRM_TEST_WORKER 1835710`.
- **Endpoint observations:** Health returned exactly
  `{"ok":true,"process":"ready","version":"2.1.0-dev.173"}` and readiness returned exactly
  `{"ok":true,"database":"ready","version":"2.1.0-dev.173"}`.
- **Live asset observations:** The served `dashboard-ui.js` asset returned `agent-operations-overview`; the served
  `app.js` asset returned `About NYSA CORE`.
- **Backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T123316Z`.
- **Environment boundary:** Production, R2 and Property Finder were not targeted. The installer independently
  reported Production/R2 snapshots unchanged and integration switches disabled.
- **Human UAT boundary:** No human pass is inferred. UAT-096 remains pending direct user review.

### DEF-097 — Financial Illustration incorrectly requires sales recommendations

- **Status:** Fix design approved by the user on 30 August 2026; implementation remains open. Not packaged or
  deployed.
- **Role / workflow:** Signed-in Agent preparing a customer proposal after selecting Inventory and saving a
  financial scenario.
- **Exact user observation:** The proposal builder displayed `RECOMMENDED NEXT STEPS *` and prevented generation
  unless the Agent entered recommendations such as availability confirmation, viewing and financial verification,
  even though the intended document was only a financial proposal using the saved financial scenario.
- **Additional visible context:** `WHY THESE PROPERTIES FIT *` was also presented as mandatory. The selected saved
  scenario was `lead no · mortgage`; the screen described the scenario as an immutable calculation carrying its
  approved fee-rule version and disclaimer.
- **Observed result:** A saved financial scenario does not switch CORE to a financial-only proposal contract. The
  active buyer-proposal template continues to require every mandatory Agent-input section.
- **RCA:** CORE currently supports only `Quick`, `Investment` and `Comparison` proposal types. A saved financial
  scenario is treated as optional content inside one of those full buyer-proposal templates. The active template
  marks `next_steps` and `value_assessment` as mandatory Agent inputs; the browser renders them with `required`, and
  the proposal-version API independently rejects an empty value for every mandatory configured section.
- **Approved terminology:** The standalone customer document is `Financial Illustration`, not Financial Proposal.
  It presents indicative calculations and does not imply lending approval, regulated financial advice or a property
  recommendation. `Investment Proposal` remains the recommendation-led document explaining why one or more
  properties may suit the customer's investment objectives.
- **Expected result:** For a Financial Illustration, generation should require the saved immutable financial
  scenario, its linked Inventory where applicable, customer-facing assumptions, approved disclaimer, calculation
  rule/version evidence and as-of date. Sales recommendations, viewing actions, match narrative and next steps may
  be optional but must not block generation.
- **Approved correction design:** Add an explicit governed Financial Illustration mode/template with a separate mandatory
  content contract. Do not silently weaken existing `Quick`, `Investment` or `Comparison` buyer-booklet templates.
  Retain immutable PDF generation and Manager review before external delivery.
- **Human UAT boundary:** This entry records the observed defect only. No correction or pass is inferred.

### DEF-098 — Immutable proposal PDF review is too small for meaningful review

- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Agent or Manager opening an immutable generated proposal for on-screen review.
- **Exact user observation:** The PDF review opened inside the standard constrained modal. The embedded browser PDF
  controls, thumbnail rail and page canvas consumed most of the available area, leaving the proposal text too small
  to review meaningfully. The user requested a full-screen review window.
- **Correction:** The proposal-review overlay now occupies the browser viewport with an eight-pixel desktop margin
  and no mobile margin. Its PDF frame flexes to consume all remaining height. Close and Download remain accessible
  at the top, while status or Manager review controls remain visible below the exact stored PDF.
- **Preservation boundary:** The immutable document, private view endpoint, download, review confirmation, change
  request and approval actions are unchanged. This correction changes only the review workspace dimensions and
  responsive layout.
- **Automated evidence:** The focused full-screen review and Release 1 proposal regression checks passed 31/31.
  Automated success does not establish human UAT passage.
- **Human UAT boundary:** Pending direct review after deployment; no pass is inferred.

### DEF-099 — Value Brief creation and viewing discard the open Lead workspace

- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Agent working inside a Lead and selecting either `Create value brief` or `View value briefs`.
- **Exact user observation:** After creating a Value Brief, CORE returned to the Lead pipeline/dashboard instead of
  the originating Lead. Opening an existing Value Brief caused the same loss of Lead context.
- **RCA:** The Value Brief viewer explicitly removed the parent Lead workspace before opening its own overlay. The
  save workflow opened that same viewer after creation, so both entry paths discarded the Lead.
- **Correction:** The viewer now opens as a child overlay without removing the parent Lead workspace. Saving closes
  only the creation form and opens the newly created brief; closing the brief returns to the same Lead record.
- **Preservation boundary:** Value Brief persistence, calculations, content, Print action and Lead ownership are
  unchanged. This is a navigation/context correction only.
- **Human UAT boundary:** Pending direct signed-in Agent review after deployment; no pass is inferred.

### SPEC-GAP-001 — Saved Value Brief should strengthen the customer proposal

- **Prior working reference:** This was initially recorded as `DEF-100`; the post-dev.173 reconciliation correctly
  classifies it as a specification gap because proposal inclusion was a new user requirement, not a failure against
  the previously approved proposal contract.
- **Status:** Specification implemented locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Agent preparing an immutable customer proposal after creating a Value Brief for shortlisted
  Inventory.
- **Exact user requirement:** The Value Brief adds weight to the proposal and should be included.
- **Observed gap:** Value Briefs were stored and viewable from the Lead, but Proposal builder did not offer them and
  generated proposal versions/PDFs did not retain or display their rent, ROI, deal strengths or recommendation.
- **Correction:** Proposal builder now lists the Lead's saved Value Briefs and automatically selects the latest brief
  matching each shortlisted Inventory record, while allowing the Agent to review the exact selection. The API
  independently requires every selected brief to belong to the proposal Lead and shortlisted Inventory, permits no
  more than one brief per property, and stores the selected evidence in the immutable proposal data snapshot. Each
  matching property page displays expected annual rent, estimated annual costs, estimated net ROI, deal strengths
  and the recorded recommendation.
- **Preservation boundary:** Value Brief creation, calculations and standalone viewing remain unchanged. Inclusion is
  optional where no matching saved brief exists; proposal ownership, approved-media controls, disclaimer, immutable
  PDF generation and Manager review remain enforced.
- **Human UAT boundary:** Pending direct signed-in Agent review after deployment; no pass is inferred.

### DEF-101 — Create opportunity action is visually easy to miss

- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Agent viewing a qualified Lead with completed structured requirements and no active
  Opportunity.
- **Exact user observation:** The full-width `Create opportunity` action used the small-button typography and was
  easily missed despite being the primary conversion decision.
- **Correction:** The qualified-Lead conversion action now has a dedicated presentation with 18.4 px bold text,
  increased vertical padding and a 44 px minimum target height. The change is scoped to this action and does not
  enlarge unrelated CORE buttons.
- **Preservation boundary:** Opportunity eligibility, permissions, conversion confirmation and creation workflow are
  unchanged.
- **Human UAT boundary:** Pending direct signed-in Agent review after deployment; no pass is inferred.

### DEF-102 — Opportunity workflow page overlaps and jumbles the parent workspace

- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Agent opening any of the six Opportunity workflow steps after converting a Lead.
- **Exact user observation:** After Opportunity creation, the selected workflow content appeared over the parent
  Opportunity details, producing overlapping headings, controls and Inventory content instead of a clean new page.
- **RCA:** The shared focused-stage surface was created inside the Opportunity record surface. This nested the
  viewport layer within the parent workspace and allowed their layout and scrolling contexts to interfere.
- **Correction:** The shared stage surface is now mounted directly at the document top layer for Inventory selection,
  Viewing & feedback, Offer, Negotiation, Booking & reservation, and Deal & completion. It occupies the full viewport,
  locks background scrolling, and restores the unchanged Opportunity when Back is selected. Leaving the Opportunity
  also removes any owned stage surface.
- **Preservation boundary:** Stage data, numbered drafts, draft history, governed Save actions and Opportunity state
  rules are unchanged.
- **Human UAT boundary:** Pending direct signed-in Agent review after deployment; no pass is inferred.

### DEF-103 — Parking is displayed in proposals but absent from Inventory specifications

- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Role / workflow:** Listing Executive or authorized Inventory maintainer recording property specifications, and
  an Agent generating a proposal from that Inventory.
- **Exact user observation:** The proposal displayed `PARKING` as `Not recorded`, but no Parking field existed in
  Inventory specifications where Bedrooms was maintained. The user requested a database field and an Inventory
  input beside Bedrooms.
- **RCA:** The proposal layout had a presentation placeholder for `parkingSpaces`, but the authoritative Inventory
  table, create/edit API and maintenance form had no corresponding field. The proposal therefore could not receive
  a governed value.
- **Correction:** Inventory now records optional `Parking spaces` immediately beside Bedrooms as a non-negative
  whole number. A nullable constrained `listings.parking_spaces` column persists it; create/edit APIs validate and
  audit it; the Inventory record displays it; and the proposal reads that same authoritative Inventory value.
- **Historical-data boundary:** Existing records remain `Not recorded`. No value is inferred or backfilled. Property
  Finder `hasParkingSpace` and DLD market-data parking indicators remain separate external evidence and are not
  silently promoted into the CORE Inventory master.
- **Bulk-deal boundary:** The field applies to the single-property Inventory specification. Bulk Deal schedules
  retain their existing per-property contract and do not receive an invented aggregate parking count.
- **Human UAT boundary:** Pending direct signed-in Inventory and proposal review after deployment; no pass is
  inferred.

### DEF-104 — Area is maintained twice across Administration and Market Intelligence

- **Original observation:** Post-dev.173 issue 1, identified by the user as one of three unnumbered observations
  recorded at approximately 22:49 GST on 30 August 2026.
- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Exact user observation:** Administration provided Area Maintenance while Market Intelligence separately asked
  the user to maintain Area. The stable code and Area identity should come from one maintenance source.
- **Correction:** Administration → Area Maintenance is now the sole user-facing Area master. New Areas receive an
  internal Market Intelligence compatibility projection atomically; Market Intelligence reads the current stable
  code, label, Emirate and active state from Area Maintenance while preserving technical history and DLD crosswalks.
- **Preservation boundary:** Existing Market Intelligence history is not deleted or rewritten. Migration 108 is
  additive and retains compatibility projections.
- **Human UAT boundary:** Pending direct Administration and Market Intelligence review; no pass is inferred.

### DEF-105 — Listing Executive cannot create a governed Developer

- **Original observation:** Post-dev.173 issue 2, identified by the user as one of three unnumbered observations
  recorded at approximately 22:49 GST on 30 August 2026.
- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Exact user observation:** A Listing Executive could not create a Developer, although Developer creation is
  required to maintain Inventory.
- **Correction:** Listing Executives can reach Companies and Developers, create the Company and initial Developer
  role transactionally, and submit a governed Developer version for independent verification. Their own submission
  remains `pending_verification`; a different authorized Administrator must activate it before Inventory selection.
- **Preservation boundary:** Listing Executives see only Companies they own and do not acquire Developer activation
  authority or broader Administration rights.
- **Human UAT boundary:** Pending direct Listing Executive and independent-Administrator review; no pass is inferred.

### DEF-106 — Manager approval access incorrectly permits Agent-owned Lead operations

- **Original observation:** Post-dev.173 issue 3, identified by the user as one of three unnumbered observations
  recorded at approximately 22:49 GST on 30 August 2026.
- **Status:** Corrected locally; not packaged or deployed. Human UAT pending.
- **Exact user observation:** A Manager reviewing a request for an active Agent could initiate actions on the Lead
  even though the Lead remained assigned to that Agent.
- **Correction:** Manager oversight, review, approval and assignment authority no longer become operational Lead
  authority. Contact, qualification, matching, proposal and connected Agent actions require the directly assigned
  active Agent; Manager views explain the read-only boundary.
- **Preservation boundary:** Managers retain read access, approval decisions, queue supervision and governed
  reassignment. The correction does not weaken legitimate Manager controls.
- **Human UAT boundary:** Pending direct Agent/Manager boundary review; no pass is inferred.

### Post-dev.173 defect reconciliation — 30 August 2026

- **Scope:** Nine defects (`DEF-097`, `DEF-098`, `DEF-099`, `DEF-101` through `DEF-106`) and one specification gap
  (`SPEC-GAP-001`).
- **Corrected locally:** `DEF-097` through `DEF-099`, `DEF-101` through `DEF-106`, and `SPEC-GAP-001`.
- **Showstopper:** `DEF-102` is the reported Opportunity workflow overlap showstopper and is corrected locally.
- **Database changes:** Migration 108 consolidates Area maintenance through an additive compatibility projection;
  migration 109 adds the nullable constrained authoritative Inventory parking field; migration 110 adds the explicit
  Financial Illustration template contract. None invents historical customer or Inventory data.
- **Focused automated observation:** The implemented post-dev.173 correction tests passed 47/47.
- **Cumulative automated observation:** The full ordinary suite passed 1,289 total: 1,259 passed, 30 protected tests
  skipped by guard and 0 failed.
- **Release observation:** The checksum-bound post-dev.173 set was deployed to CRM Test as `2.1.0-dev.174` with
  migrations 108 through 110. Health and readiness reported the exact version; the exact-process query observed one
  CRM Test LiteSpeed worker, PID `198393`. Production, R2 and Property Finder remained excluded.
- **Human UAT boundary:** Automated results do not establish a human pass. Every implemented item remains pending
  direct CRM Test UAT after deployment.

### CRM Test dev.174 human-UAT continuation — DEF-102 direct browser observation — 31 August 2026, 00:05–00:07 GST

- **Environment / release:** CRM Test only, `https://crm-test.nysarealty.com/`, release query
  `2.1.0-dev.174` from `2.1.0-dev.173`. Production, R2/Production clone and Property Finder were not opened.
- **Role:** Signed-in Sales Agent `ajitr`.
- **Record:** Existing Opportunity `NYSA-OP-202608-000001`, customer `uat173round1`, Sale, title
  `2 bedroom in Business Bay`, active status `Matching`, source Lead history `Qualified`.
- **Precondition preservation:** The existing Opportunity was reopened after sign-in; no replacement Customer, Lead,
  Opportunity, Inventory, viewing, offer, booking or Deal record was created. No Save or Save as draft action was
  used.
- **Action:** Opened each of the six Opportunity workflow stages from the Opportunity strip and selected the stage's
  `Back to Opportunity` action before opening the next stage.
- **Stage 1 observed:** `Inventory selection` opened as `Stage 1 of 6 · Completed` in a clean top-level focused page.
  It showed one attached property, Inventory `NYSA-INV-000070 · uat173round1`, and no parent Opportunity overlap.
- **Stage 2 observed:** `Viewing and customer feedback` opened as `Stage 2 of 6 · Not completed` in a clean top-level
  focused page. It displayed the viewing form for the selected Inventory and no parent Opportunity overlap.
- **Stage 3 observed:** `Offer and commercial terms` opened as `Stage 3 of 6 · Not completed` in a clean top-level
  focused page. It correctly stated that Viewing & feedback must be completed before an offer; no parent overlap was
  visible.
- **Stage 4 observed:** `Negotiation` opened as `Stage 4 of 6 · Not completed` in a clean top-level focused page. It
  correctly stated that an offer must be created and sent first; no parent overlap was visible.
- **Stage 5 observed:** `Booking and reservation` opened as `Stage 5 of 6 · Not completed` in a clean top-level
  focused page. It correctly required an accepted exact offer revision; no parent overlap was visible.
- **Stage 6 observed:** `Deal and completion` opened as `Stage 6 of 6 · Not completed` in a clean top-level focused
  page. It correctly required an active governed reservation; no parent overlap was visible.
- **Return-state observation:** After every Back action the same Opportunity returned unchanged: status remained
  `Matching`; stage 1 remained completed; stages 2–6 remained not completed; source/customer/title remained the same.
- **Defect observation:** The overlap/jumble previously reported as `DEF-102` was not reproduced in this browser run.
  No new defect was raised from these six open/return checks.
- **Screenshot boundary:** The browser was under an existing third-party debugging session during part of the run;
  the exact stage and return states were visually inspected in the CRM Test window, but no standalone screenshot file
  was captured into the evidence repository.
- **Human UAT boundary:** This is a direct agent-operated browser observation prepared for the user's review. Per the
  agreed UAT rule, `DEF-102` is **not marked passed** until the user directly observes and confirms the required
  behavior.
