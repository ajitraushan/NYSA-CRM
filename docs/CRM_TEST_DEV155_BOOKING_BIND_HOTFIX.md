# CRM Test dev.155 booking bind hotfix

**Candidate:** `2.1.0-dev.155`  
**Target:** CRM Test only  
**Scope:** cumulative dev.154 package plus the G-02 live-database correction below.

## Root cause

The live Inventory revalidation query in `requireLiveInventory` contains one PostgreSQL placeholder (`$1`) but passed two bind values. PostgreSQL correctly rejected every internal-Inventory Booking request with `08P01`, so the atomic acceptance/reservation boundary returned HTTP 500 before its locking and conflict logic could execute.

## Correction

The route now binds only `listingId`, the sole value referenced by the SQL. Opportunity-specific governed-match validation remains immediately after the locked Inventory read and is unchanged.

## Evidence gates

- Syntax check for `src/routes/opportunities.js`.
- Focused G-02, booking/reservation and UAT-037 regression tests.
- Full local suite.
- Deterministic dev.155 archive, checksum and manifests.
- CRM Test isolated-schema real HTTP test: one accepted Offer survives coordinated reassignment unchanged except servicing owner.
- CRM Test isolated-schema real concurrent Booking test: exactly one HTTP 201, one HTTP 409, one accepted Offer, one losing Offer still sent and exactly one reserved Booking.
- The synthetic schema is permanently dropped after the test and the temporary loopback process is stopped.

## Observed CRM Test result

- M-04/J: HTTP 200; Offer ID, Accepted status and original `created_by` preserved; servicing owner changed; zero withdrawal events.
- G-02: concurrent HTTP outcomes were 201 and 409; one accepted Offer; losing Offer remained Sent; one reserved Booking; no phantom accepted loser.
- Cleanup: fixture schema dropped, temporary test process stopped and exactly one CRM Test worker remained.
- Raw evidence: `release-artifacts/release-3/consolidated/dev155-live-db-evidence.txt`.

No Production or R2 clone action is permitted by this package.
