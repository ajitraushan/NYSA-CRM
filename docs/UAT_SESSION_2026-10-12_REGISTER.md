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
