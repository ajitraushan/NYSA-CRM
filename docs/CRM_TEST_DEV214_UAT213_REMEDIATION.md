# CRM Test DEV214 — UAT after DEV213

## Controlled baseline

- Target: CRM Test only.
- Starting version: `2.1.0-dev.213`.
- Starting Git rollback point: `860b3db362f1e33a40cbe68e16f6ef90e3b774d9`.
- Starting database level: `128_dev211_uat210_remediation.sql` (128 migrations).
- DEV214 version: `2.1.0-dev.214`.
- DEV214 database level: `129_dev214_offplan_developer_stock.sql` (129 migrations).
- Production and the R2 clone are outside this change and must remain unchanged.

## UAT defects corrected

1. Light panels inside the dark Opportunity flow now use the dark panel palette.
2. **Save as draft** is contained in the stage workspace header instead of the page edge.
3. Booking amounts and explanatory text use separate block layout.
4. Offer, Booking and Deal summaries show business-useful lineage: Opportunity reference, Inventory reference and title, and the relevant Offer or Booking reference.
5. Inventory titles are carried through Offer, Booking and Deal projections.
6. Opportunity reference remains visible throughout the six-stage flow.
7. Deal creation separates agreed property value from reservation/deposit amount.
8. Stage mutations use a refresh mask so the Lead page does not flash before the Opportunity is restored.
9. Administration feature modules load before the saved Administration section is restored, removing the refresh/login race that made sections disappear.
10. Authority-issued completion evidence such as a Title Deed can be uploaded directly in the Deal document requirement card and linked to the exact frozen definition and Deal.
11. The screen explains authority-issued evidence in business language and distinguishes a new upload from a previously uploaded document.

## Accepted gaps included

### Proposal payment plan

Customer proposal property pages now include the maintained developer/payment plan, down-payment, handover and post-handover terms alongside availability.

### Lightweight off-plan developer stock

- An Off-plan Opportunity may capture current Developer stock as evidence without creating available NYSA Inventory.
- A Manager verifies the captured stock before it can be tagged to the Opportunity.
- Physical viewing and internal Booking/Reservation are not required for this path.
- Offers are tied to the tagged Developer stock and availability must be reconfirmed at commercial actions.
- An accepted Offer creates the Off-plan Deal directly.
- Closed Lost releases the tagged stock evidence without creating Inventory.
- Closed Won atomically creates a **Sold** Inventory record with the Opportunity owner retained as originating and responsible agent. It is never exposed as available stock first.
- The audit chain retains Developer stock, Offer, Deal and resulting Sold Inventory identities.

### Deferred enhancement

`ENH-LEAD-CALL-001` remains in `docs/CRM_FUTURE_CHANGE_BACKLOG.md`. Opening a linked phone call must not silently alter Lead status; any future implementation must record a confirmed call outcome and audit evidence.

## Database and compatibility

Migration `129_dev214_offplan_developer_stock.sql` adds an explicit Developer-stock usage type, the minimum Developer/unit facts, a booking-free Deal linkage type, and an open-stock duplicate guard. Existing external/co-broker records retain their current default and behavior.

The migration was applied successfully to the restricted synthetic fixture. A rollback-only database test proved that the final Sold Inventory row satisfies the real schema, including generated Inventory reference, ownership, status and Off-plan transaction type.

## Verification

- JavaScript syntax checks: passed.
- Migration runner on restricted fixture: passed; 129 migrations, latest `129_dev214_offplan_developer_stock.sql`.
- DEV214 database integration: passed with transaction rollback.
- Full automated suite: 1,571 tests; 1,489 passed; 0 failed; 82 intentionally skipped fixture/optional tests.
- Focused DEV214 and historical Release 2 compatibility tests: passed.
- Browser render smoke: local DEV214 shell and login render correctly; authenticated journey verification is required again after CRM Test deployment.

## Security and privacy impact

- No new external connector or message dispatch.
- No customer credentials or personal data are added to logs or package content.
- Authority-issued files remain private, immutable evidence and retain independent review separation.
- Off-plan stock remains internal Opportunity evidence until authoritative Closed Won.
- Admin permissions and operational business-process restrictions are unchanged.

## Rollback

Application rollback is the prior advertised Git commit and its verified DEV213 package. Database rollback must be backup restoration; migration 129 must not be manually reversed after DEV214 business records have been created because it introduces new lineage values. `scripts/deploy-crm-test-dev214.sh` is locked to CRM Test, accepts only the exact DEV213 baseline or an idempotent DEV214 rerun, verifies release provenance and disabled connectors, takes file and database backups before mutation, verifies migration 129 and runtime checksums, and confirms Production and R2 clone snapshots remain unchanged.
