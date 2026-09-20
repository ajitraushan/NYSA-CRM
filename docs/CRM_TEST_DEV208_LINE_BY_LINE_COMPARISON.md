# CRM Test DEV208 — line-by-line requirement comparison

**Comparison date:** 19 September 2026  
**Compared against:** current UAT defect log, DEF-124, DEF-125 and RR-015  
**Result:** every recorded line is either implemented and testable in DEV208, or explicitly retained
as a human CRM Test UAT item. Nothing in this document authorizes deployment.

| Requirement line | Implemented result | Automated evidence | Human CRM Test check |
|---|---|---|---|
| My Leave must open for an Agent | Governed route retained and empty state supported | Authenticated 200 | Open as Agent and submit only synthetic leave if desired |
| Listing Executive must have an Inventory-first dashboard | Direct Inventory workspace; duplicate Inventory launcher removed | UI regression | Sign in as Listing Executive and inspect first screen |
| Marketing Compliance must open | Broken legacy authorization reference removed | Authenticated Admin configuration 200 | Open configuration and permitted operational role screens |
| Market comparison must be understandable | Plain optional DLD comparison terminology | UI regression | Review wording with business user |
| Assigned pending tasks must remain visible | Explicit assignee visibility no longer depends on unrelated Lead scope | Authenticated Manager tasks 200 | Confirm the known pending task appears |
| Transaction document wording must be plain | User surface says required transaction documents | UI regression | Review Opportunity/Deal wording |
| Deal closure screen must distinguish open and completed work | **Closure Steps** plus explicit returned, approved, Won and Lost states | Deal/domain regression | Complete one synthetic transaction path |
| Booking source and duration must be clear | Exact accepted Offer revision; seven-day rule retained | Release 2 regression | Reserve synthetic Inventory |
| Proposal/Offer must identify Inventory | Inventory reference included in PDF output | PDF/source regression | Generate and inspect both documents |
| DEF-124 contact action and history order | CTA beside lock; governed form before history | UI regression | Record one synthetic Customer contact |
| DEF-125 Admin document-rule maintenance | Config and operations use distinct authorization boundaries | Authenticated 200/403 | Draft, activate and retire a synthetic rule |
| RR-015 Customer-only bulk intake | Separate template, preview, commit, Customer match/create, no Lead | Unit and DB integration | Import synthetic email-only and phone-only rows |
| RR-015 Lead-only bulk intake | Existing Customer required; New/Unassessed/unassigned/queued Lead | Unit and DB integration | Import basic and enriched synthetic Lead rows |
| Duplicate/ambiguous identity protection | Exact match links; conflicts block; no silent overwrite | Unit and DB integration | Exercise one conflict row |
| Idempotency | Source system, batch, type and external row uniquely identify processing | DB integration | Re-submit committed synthetic source row |
| Privacy and provenance | Private raw evidence, hashes, supplier/date/basis and minimized audit | Source and integration checks | Inspect register/reconciliation without exposing raw file |
| Importer role boundary | Sales Agent and Admin only; Manager and Managing Director denied | Authenticated fixed role matrix | Test both allowed roles and both denied leadership roles |
| No automatic routing ownership | Lead remains company-sourced and unassigned with queued history | DB integration | Assign through normal Manager/MD process |

## Remaining human evidence, not missing implementation

The automated suite cannot replace authenticated browser acceptance of visual clarity, document
appearance, real role assignments or the complete Deal-to-Finance journey. After an approved CRM Test
deployment, perform the checks above and then run:

`Deal document rule → Deal evidence → Closure → Invoice → Receipt → payout calculation → MD batch
approval → Accountant batch payment`.

Production remains unchanged and must not be considered until that evidence is recorded and a fresh
Production-versus-CRM-Test package comparison is approved.
