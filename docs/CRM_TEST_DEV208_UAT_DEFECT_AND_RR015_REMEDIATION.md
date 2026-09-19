# CRM Test DEV208 — UAT defect and RR-015 remediation

**Date:** 19 September 2026 (Asia/Dubai)  
**Target:** CRM Test only; deployed 19 September 2026  
**Application version:** `2.1.0-dev.208`  
**Exact source baseline:** deployed DEV207 package  
**Database baseline:** migration 126; DEV208 adds migration 127  
**Rollback source snapshot:** `remediation-baselines/dev208-prechange-20260919T225045.zip`  
**Rollback snapshot SHA-256:** `B122B6DC8C6BFEA18C1C6388A606096B0D9F52ADC091B42B81761657D0FCC8EE`
**Deployed package SHA-256:** `989d6b628ee3a06b744012a5cb6a59eddd2db1a37e84642cbb63bb938cad8aa2`  
**Server rollback backup:** `/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`  

## Outcome

DEV208 resolves the current UAT defect set, DEF-124, DEF-125 and implements RR-015. The approved
package was deployed to CRM Test only. Post-deployment health and readiness returned HTTP 200 and
one expected CRM Test worker was present. Production and the R2 clone were not targeted. Human
authenticated UAT remains required before any production decision.

## Defect reconciliation

| Reference / observation | DEV208 correction | Verification | Status |
|---|---|---|---|
| Sales Agent **My Leave** returned 500 | Preserved the governed leave route and verified the authenticated empty-state response | Authenticated runtime request returns 200 | Ready for CRM Test UAT |
| Listing Executive dashboard showed the wrong workspace and a redundant Inventory button | Dashboard now opens the Inventory workspace directly and removes the duplicate action | UI/source regression | Ready for CRM Test UAT |
| Marketing Compliance returned 500 | Corrected the obsolete authorization reference and split Admin configuration from operational access | Authenticated Admin configuration returns 200 | Ready for CRM Test UAT |
| Market Intelligence language was unclear | Reworded the comparison area as an optional DLD sales comparison with plain labels | UI/source regression | Ready for CRM Test UAT |
| A valid pending task could disappear because of unrelated Lead scope | **My Tasks** now includes an explicit assignee branch while retaining governed Lead scope for other tasks | Authenticated Manager task request returns 200 | Ready for CRM Test UAT |
| Official-document operational wording was over-regulatory | Replaced it with plain transaction-document wording while retaining the evidence control | UI/source regression | Ready for CRM Test UAT |
| Deal completion presentation was unclear | Renamed the workspace **Closure Steps**, clarified open, returned, approved, Won and Lost states, and retained separate closure authority | UI/domain regression | Ready for CRM Test UAT |
| Booking wording implied an unclear CORE-created commitment | Booking now states that the amount comes from the exact accepted Offer revision and preserves the seven-day reservation rule | Release 2 regression | Ready for CRM Test UAT |
| Inventory reference was absent from customer proposal/offer output | Proposal PDF now includes the governed Inventory reference; Offer PDF already retained it | PDF/source regression | Ready for CRM Test UAT |
| DEF-124 customer-contact action was below a large empty history area | Added **Record customer contact** beside the qualification lock and placed conversation history after the governed form | UI/source regression | Ready for CRM Test UAT |
| DEF-125 Admin could not maintain official-document requirements | Admin configuration bypasses only the operational identity prerequisite; operational evidence remains denied | Authenticated Admin: configuration 200, evidence 403 | Ready for CRM Test UAT |
| Dark-theme pages contained pale/white opportunity and Deal blocks | Global charcoal/navy theme overrides cover those panels, forms and state cards | Theme/source regression | Ready for CRM Test UAT |

## RR-015 implementation

Two deliberately separate modules are provided:

1. **Purchased Customer Import** creates or exactly links Customer Master records only. It creates no
   Lead, assignment, requirement or Opportunity.
2. **Purchased Lead Import** requires an existing unambiguous Customer, creates a New/Unassessed
   unassigned Lead and queues assignment. Optional structured preferences create a governed
   requirement version; missing values remain unknown.

Controls include:

- Admin configuration of one explicitly authorized Manager or Managing Director importer;
- no automatic permission derived from a role label and no automatic role reassignment;
- separate versioned Excel templates with instructions, batch metadata and controlled headers;
- name plus at least one usable channel, exact-match and ambiguity checks;
- non-mutating preview and SHA-256/HMAC-bound confirmation of the unchanged workbook;
- stable source-row idempotency and one database transaction per confirmed batch;
- private raw-workbook evidence storage and PII-minimized audit events;
- supplier, acquisition batch/date and processing-basis provenance;
- no automatic qualification, Opportunity creation, uploader ownership or Agent assignment; and
- batch register plus downloadable row-level reconciliation CSV.

## Database and migration

Migration `127_governed_purchased_data_intake.sql` adds Customer references, the controlled
`Purchased data` Lead source, import batch/row registers, explicit importer authorizations and audit
support. It does not seed an importer, change an existing user role or alter historical migrations.

The migration was applied to the dedicated local PostgreSQL fixture: 127 migrations present and
migration 127 latest. A local fixture backup helper could not create its optional backup because of a
Windows file-lock (`EPERM`); the pre-change source snapshot above remains recoverable. Deployment must
create its own server backup before migration.

## Verification

- Complete repository regression: 1,522 tests; 1,444 passed; 78 intentionally skipped; 0 failed.
- Focused DEV208 and access regression: passed.
- Real local PostgreSQL migration/import integration: passed.
- Authenticated runtime checks: Admin document configuration 200; Admin document operation 403;
  Admin marketing configuration 200; Sales Agent leave 200; Manager tasks 200; purchased import 403
  before explicit authorization and 200 after authorization.
- Modified JavaScript syntax checks: passed.
- Both Excel templates were inspected after generation and contain safe replace-before-use samples.

## Security, privacy and deployment boundary

No customer credentials or production data are embedded in source, templates, tests or output.
Operational Admin access is not broadened. Uploaded raw workbooks remain private evidence. The
current source and test results do not authorize deployment. CRM Test requires explicit confirmation;
Production requires a later, separate comparison, approval, backup and end-to-end UAT decision.
