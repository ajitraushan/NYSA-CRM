# CRM Test UAT session register — 12 October 2026

Consolidates the defects, gaps and enhancements recorded in this session. Detailed requirements remain in [the cumulative UAT register](CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md). Baseline discussed: CRM Test DEV226. Recording a requirement does not mean it is deployed or human accepted.

Current implementation/testing progress is tracked separately in [the fix reconciliation](UAT_20261012_FIX_RECONCILIATION.md). The tables below preserve the initial UAT record.

## Defects

| Reference | Issue | Status when recorded |
|---|---|---|
| DEF-126 | Ordinary Inventory property-source text edit fails with unrelated portal-readiness error. | Corrected locally; 1,598 regression tests passed, 87 skipped, zero failed. Not deployed; exact-record user retest pending. |
| DEF-127 | Submitted Inventory verification is missing from Manager My Tasks. | Open; source omission identified; not fixed/deployed. |
| DEF-128 | Internal Opportunity conversion requires a mandate with no maintenance form in Inventory. | Revised requirement: optional Mandate agreement upload/maintenance section in Inventory, including actual document, details and version/audit history. Absence must not block internal seller/landlord/dual Opportunity creation; External Portal Listing authority requirements remain mandatory. Not implemented/deployed. |
| DEF-129 | Send viewing calendar invitation returns Internal server error. | Open; exact cause and external delivery status unconfirmed. No diagnostic client resend performed. |
| DEF-130 | Offer PDF amount in words is blank. | Open; not fixed/deployed. |
| DEF-131 | Seller-only acceptance completes Negotiation and unlocks Booking readiness without buyer acceptance of the same revised Offer. | Open; require separate buyer and seller acceptance of exact current revision at API and downstream gates. Not fixed/deployed. |
| DEF-132 | Pending MD batch shows Awaiting payment and premature payout-advice actions. | Open; lifecycle-specific status/actions required. Not fixed/deployed. |

## Specification gaps

| Reference | Requirement | Status when recorded |
|---|---|---|
| SPEC-GAP-003 | Select and persist an existing NYSA Customer as Inventory owner/represented party without creating a duplicate. | Open; not implemented/deployed. |
| SPEC-GAP-004 | Consistent Customer name/mobile/passport/Emirates ID lookup across selectors and Customer, Lead, Opportunity and linked-owner Inventory searches. | Open; principal source queries reviewed; full selector coverage and secure exact-identity lookup design remain pending. |
| SPEC-GAP-005 | Meaningful Offer PDF filenames for download and browser Save As. | Open; proposed NYSA_Offer_Letter_<Property>_<Unit>_<Date>_Rev-<Revision>.pdf. Not implemented/deployed. |

## Enhancements

| Reference | Requirement | Status when recorded |
|---|---|---|
| ENH-001 | Shared My Tasks category/request-type filters for Manager/Director, with scoped counts, pagination and exact review links. | Open; request-category catalogue recorded; not implemented/deployed. |
| ENH-002 | MD Commission Payments summary by Agent/Team, pending approval amount and quarter/YTD/lifetime recorded payment totals, with drill-down. | Open; not implemented/deployed. |

## Other observations and guidance — not yet confirmed defects

- **CRM Test access from another laptop:** user reports Request failed. Open investigation; no standalone defect ID assigned because the failing request, login stage and runtime cause are unconfirmed.
- **Partial invoice payments:** supported. Screenshot failure arose from reuse of the incoming payment reference, not a one-payment-per-invoice restriction. Each separate actual receipt requires its own reference; wording Record payment once is confusing. UI wording improvement noted here, not assigned an implementation ID.
- **Payout approval navigation:** Accountant Ready for approval → submit batch → Pending MD → Director approval → Accountant Approved – Pay now → record actual payment → advice. Initial empty Pending MD tab was not a missing queue; later screenshot showed the submitted batch. DEF-132 covers the confirmed misleading detail controls.
- **Dual-side disclosure field:** guidance explained its purpose and evidence. No defect recorded for the field itself.
- **Earlier accountant workspace work:** DEV226 deployment on 10 October is an already delivered baseline, not a newly fixed item in this session. Human end-to-end UAT remains open.

Totals for this session: **7 defects, 3 specification gaps and 2 enhancements — 12 numbered items.** One defect has a local correction; no fixes for these items were deployed in this session. Production and R2 were not changed. No actual customer approvals, payments or invitation sends were performed to record these observations.

## Added defect — 23 October 2026

**DEF-133 — Document viewing incorrectly restricted by role.** Every active signed-in role must be able to view/download documents, including KYC, retained versions and existing private files. No ownership/team/reviewer role gate may deny a document read. Authentication, audit/private storage and existing upload/edit/approval rules remain. This supersedes the earlier Director-only scope.

Current release total: **13 numbered items — 8 defects (DEF-126–133), 3 specification gaps (SPEC-GAP-003–005), 2 enhancements (ENH-001–002)**. Candidate DEV227; deployment verification is tracked in the release report.

## Post-DEV227 defect — 24 October 2026

**DEF-134 — Admin Lead routing Business type dropdown is empty.**

- Environment/baseline: CRM Test `2.1.0-dev.227`; source commit `00d391f3182ba6117ae7a156c36f0b3045c0d4a5`.
- Reproduction: sign in as Admin, open Administration → Lead routing & queues, and open Business type. Only Any business is available; Rental cannot be selected, despite existing maintained Rental rules.
- Actual: attempting a team-directed All areas fallback without a selectable business type submits Any source / Any business / All areas and is rejected because that combination is reserved for the Company Unassigned Queue. Editing an existing business-specific rule also risks losing its selection because its option is missing.
- Cause confirmed in source: `BUSINESS_TYPES` starts empty; `renderShell` loads classification/business options only when `!ME.accessPolicy`. Admin sessions with an access policy skip initialization. The routing form still builds its dropdown from `BUSINESS_TYPES`.
- Expected: Admin routing maintenance loads valid routing business options, including Rental; existing rules retain their business selection; the Company Unassigned Queue catch-all safeguard remains enforced.
- Scope distinction: 67 imported Rental Leads have no destination team because their primary routing area is blank while the maintained Dubai Rental rule is area-specific. This dropdown defect prevents maintenance of a suitable fallback. Adding/changing a routing rule and rerouting existing Leads are separate configuration/data operations, not implied by recording this defect.
- Status: **Open — confirmed; no fix, rule change, rerouting or deployment performed.** This is a new post-DEV227 item and is not counted among the 13 items deployed in DEV227.

**DEF-135 — Customer Reset filters leaves identity search inputs active.**

- Recorded: 24 October 2026. Environment/baseline: CRM Test `2.1.0-dev.227`; source commit `00d391f3182ba6117ae7a156c36f0b3045c0d4a5`.
- Reproduction: open Customers, enter a Mobile number, Passport last four or Emirates ID last four filter, run Search, then click Reset filters.
- Actual: identity input values remain populated and are reapplied when the Customer list reloads, so the list remains filtered.
- Cause confirmed in source: the reset handler in `public/app.js` clears `customer-q`, KYC and duplicate-review selectors, resets sort and page, but does not clear `customer-mobile`, `customer-passportLast4` or `customer-emiratesIdLast4`. The loader continues reading these through `customerIdentityParams`.
- Expected: Reset filters clears all search inputs, including all three identity fields, restores dropdown/sort defaults, resets pagination to page 1 and reloads the permitted unfiltered Customer list. This does not alter stored Customer records or visibility permissions.
- Acceptance: exercise each identity filter separately and all filters together; after Reset, all text inputs are empty, dropdowns have their defaults, the request contains no previous identity criteria, and the default list/count/page are restored. Repeat after navigating beyond page 1.
- Status: **Open — confirmed in source; not fixed or deployed.** Separate from DEF-134 and excluded from the 13 items deployed in DEV227.

## Post-DEV227 enhancement — 25 October 2026

**ENH-003 — Maintain signed Marketing Agreement in Inventory owner/authority maintenance.**

**Disposition: Withdrawn by user on 25 October 2026 — no implementation required.** The user confirmed that signed Marketing Agreement maintenance is already available in the next step, External Listing Preparation, and that this existing flow is acceptable. The original request below is retained for history only and is excluded from active enhancement scope.

- User reference document: **Marketing_Agreement_Nysa_Realty.pdf**.
- Source file: `C:\Users\ajitr\Dropbox\Nysa Realty\forms\MARKETING\Marketing_Agreement_Nysa_Realty.pdf`.
- Requirement: the user must be able to attach and maintain the signed Marketing Agreement directly in the Inventory owner/internal-authority section, linked to the Inventory and selected owner/Customer. A text evidence reference alone does not satisfy this requirement.
- Required maintenance: PDF upload, view/download, agreement reference, effective date and expiry where applicable; replacement retains prior versions.
- Reuse: External Portal Listing should reference the saved Inventory agreement without requiring a duplicate upload. Portal permit/publication evidence remains separate.
- Scope distinction: this is the signed **Marketing Agreement**, not `Property_Listing_Sheet_Nysa_Realty.pdf` and not an instruction to make the optional mandate from DEF-128 mandatory.
- Status: **Withdrawn — existing External Listing Preparation flow accepted by the user.** No additional Inventory owner/authority upload change is required. No business records or functionality were changed.

**ENH-004 — Prominent current workflow status on Inventory cards.**

- Recorded: 25 October 2026; CRM Test DEV227 UAT.
- User example: Inventory `NYSA-INV-000078`; card shows Available, Off-market and Draft but does not clearly communicate pending verification.
- Requirement: display a prominent, clearly labelled **Current status** using the authoritative workflow/review state; show **Pending verification** when the request is submitted and awaiting review. Do not infer pending verification solely from Draft or from readiness to submit.
- Keep workflow status distinct from availability (e.g. Available) and listing exposure (e.g. Off-market). Colour may support the label but must not be the only indicator.
- Acceptance: the card reflects the actual state before submission, after submission, after the reviewer decision and after reload; pending verification is explicit while awaiting review. Availability and exposure remain separately identified. Existing workflow rules are unchanged.
- Status: **Recorded — not implemented, tested or deployed.**

**ENH-005 — Support fractional bedroom configurations in Inventory details.**

- Recorded: 25 October 2026. User explicitly clarified that this request concerns **Inventory details**, despite the example screenshot showing requirement minimum/maximum fields.
- Requirement: allow Inventory bedroom configurations such as **1.5** and **2.5**, retain the exact selected configuration when saving/reopening, and display it correctly on Inventory cards/details and dependent documents. Existing supported configurations must continue to work.
- Confirmed implementation boundaries: the Inventory UI and API currently use whole-configuration enumerations; database CHECK constraints on `listings.bedrooms` and `listing_units.bedrooms` also exclude these fractional configurations. A dropdown-only change would be insufficient. Any implementation must reconcile the Inventory UI, API, storage constraints and dependent Inventory paths without silently rounding values or inventing portal mappings.
- Lead/Customer requirement bedroom minimum/maximum fields are **not included** in this clarified request. No change to those fields is authorized by this entry.
- Status: **Recorded — not implemented, tested or deployed.**

**ENH-006 — Separate appointment completion, Customer decision and overall Viewing stage status.**

- Recorded: 25 October 2026; CRM Test DEV227 UAT.
- Problem: completed-appointment banners imply the Viewing stage is complete even when feedback requests more viewings or another appointment remains pending.
- Proposed design: display an overall Viewing summary with completed/pending appointment counts and an explicit next action. Each appointment separately shows appointment status, Customer reaction and Customer next decision. Replace repeated completion banners with one appointment-status label.
- Proposed next-decision values: More viewings required, Ready for Offer, Not proceeding, Undecided. Capture this explicitly when recording feedback; free-text comments must not determine workflow decisions.
- Proposed progression: More viewings required and Undecided keep the stage in progress with scheduling/follow-up actions. Ready for Offer permits the selected property to progress only when its viewing requirements are satisfied. Not proceeding stops progression for that property.
- Property-specific pending appointments: an unrelated property's appointment must not automatically block the selected property. A pending appointment for the same property must be completed or explicitly cancelled with a reason before progressing that property.
- Acceptance: completed appointment plus further-viewing decision remains Viewing in progress; pending appointments/counts and next action are visible; positive reaction alone does not imply Ready for Offer; reload preserves statuses/decisions; property-specific progression follows the agreed rules.
- Status: **Recorded design proposal — not implemented, tested or deployed.** Recording does not authorize automatic cancellation or alteration of existing appointments or historical outcomes.

## Post-DEV227 defect — 25 October 2026

**DEF-136 — Intended Seller acceptance saved as acknowledgement; Offer acceptance and Negotiation status remain incomplete.**

- Environment: CRM Test DEV227; Offer `NYSA-OF-202610-000001`, Revision 1, Opportunity `NYSA-OP-202610-000001`.
- User report: both parties' acceptance responses were entered, but acceptance status and workflow did not update.
- Read-only backend verification: Buyer acceptance is saved at 25 October 2026 21:56:36 Dubai time, with accepting side `buyer` and evidence reference. Seller events are saved as `viewed` at 21:59:30 and `acknowledged` at 22:03:14, with remarks indicating seller agreement but no accepting side/evidence. Offer status is `viewed`, accepted revision/time are null, and Opportunity remains Negotiation.
- Evidence distinction: the intended Seller acceptance and saved event differ. The backend result is confirmed; whether the UI submitted an unintended outcome or the outcome selector was ambiguous remains unconfirmed. Do not infer acceptance from free-text remarks or rewrite historical events.
- Expected: an explicitly submitted Seller acceptance persists as acceptance for the exact revision with party, evidence and timestamp. Once both valid acceptances exist, the Offer becomes accepted and Negotiation readiness enables Booking. Acknowledgement/viewing alone must not count as acceptance. Party-specific labels and confirmation must clearly identify the recorded outcome.
- Acceptance PDF scope explicitly requested by the user: provide a separate acceptance PDF for the exact Offer revision showing each party's name, acceptance status, recorded Dubai timestamp and evidence reference. Show Accepted by both parties only after both valid acceptances exist. Preserve the original issued PDF and history. Not yet implemented or deployed.
- Severity: **UAT blocker** — user cannot proceed to Booking. Inspection of the live form confirms that the negotiation outcome defaults to receipt acknowledgement after a saved event; acceptance remains selectable independently of the Seller party selector. This explains a possible confusing path, not proof of the user's prior selection or a reproduced payload corruption.
- Status: **Open — saved mismatch verified; root cause pending reproduction. No fix, record correction or deployment performed.** Related to, but distinct from, DEF-131's bilateral acceptance gate.

**DEF-137 — Opportunity Approved documents omits issued Offer PDFs.**

- Recorded: 25 October 2026; CRM Test DEV227. User has progressed to Deal creation but Approved documents shows only the Viewing Confirmation, omitting the issued Offer.
- Source-confirmed cause: Offer generation records approved-document issuance with source entity type `Offer` and links the document to its Opportunity. The Opportunity Approved documents endpoint filters issuances to source entity type `Opportunity` only, so linked Offer issuances are excluded.
- Expected: the Opportunity's issued-document list includes its linked issued Offer revisions with reference/revision, issue date and working view/download actions. The accepted revision must be clearly identifiable from authoritative acceptance data. Include the acceptance PDF requested under DEF-136 once generated; preserve the original PDFs, hashes and history.
- Scope: document-list completeness, separate from DEF-136's acceptance capture and acceptance PDF. Do not generate a duplicate Offer or rewrite issuance ownership/history merely to make it appear.
- Status: **Open — omission confirmed in source; not fixed, tested or deployed.**

**ENH-008 — Readable Deal identification in signed-document requirement summary.**

- Recorded: 25 October 2026; CRM Test UAT. User requests an explanatory name instead of the bare `NYSA-DL-...` reference in the Signed documents still required summary.
- Requirement: show a human-readable Deal description using the linked property and Customer, with an explicit Deal label. Retain the immutable Deal reference as secondary traceability detail; do not rename or renumber database references.
- Suggested presentation: `1 document required · Deal: 2 bedroom in Marina — Test Customer 062`, with `Reference: NYSA-DL-202610-000001` secondary. Use actual linked values, not hardcoded example data.
- Status: **Recorded — not implemented, tested or deployed.**

## Local defect verification update — 25 October 2026

DEF-134, DEF-135 and DEF-137 have local corrections; DEF-136 has explicit outcome/party controls and a separate acceptance-record PDF. The prior backend mismatch is not claimed as reproduced payload corruption: Seller acceptance subsequently saved and the live Deal progressed without a code change. Original Offer PDFs and historical events remain preserved.

Release regression: 1,360 passed, 86 skipped, 0 failed; three additional restricted synthetic database checks passed separately. No deployment or live operational data correction. Details and limits: `UAT_DEF134_137_FIX_VERIFICATION_2026-10-25.md`. Earlier status entries remain historical observations; enhancements are unchanged.

**ENH-007 — One-step Agent reservation without evidence or Manager approval, with visible reservation attribution.**

- Recorded: 25 October 2026; CRM Test DEV227 UAT. Explicit user-approved reservation rule change.
- Requirement: the responsible Agent confirms reservation in one step. Remove mandatory reservation evidence upload and do not introduce Manager approval for initial reservation. Apply consistently to UI and backend validation.
- Retain the existing exact-revision bilateral acceptance prerequisite, seven-day reservation term, exclusivity and competing-reservation safeguards. This request does not change reservation extension, release, cancellation or expiry rules.
- Inventory dashboard card: clearly show Reserved, reserving Agent name, reservation date/time and expiry date/time in Dubai time, using the authoritative active reservation record. Avoid confusing reservation attribution with the Inventory listing owner or maintenance Agent.
- User screenshot clarification: replace the primary heading `Blocked by NYSA-BK-...` with `Reserved by [Agent name]`. Booking/Opportunity references may remain secondary traceability details; they must not substitute for the reserving Agent's name. The `Listed by` footer is separate and does not satisfy reservation attribution.
- Preserve existing reservation evidence and audit history; no deletion or rewriting of prior records. Record the confirming Agent and reservation timestamps for new reservations.
- Acceptance: an eligible Agent can confirm without an evidence file or Manager step; API and UI agree; successful reservation displays the correct Agent/date/expiry after reload; competing reservation remains blocked; release/cancellation/expiry removes stale active-reservation information and restores the correct current status.
- Status: **Recorded — not implemented, tested or deployed.** Separate from DEF-136 and its acceptance PDF scope.
