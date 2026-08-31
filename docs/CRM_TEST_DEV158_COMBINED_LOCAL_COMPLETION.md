# CRM Test dev.158 cumulative local completion

Date: 2026-08-18  
Target: CRM Test only  
Status: built and verified locally; deployment requires separate approval

## Cumulative scope

dev.158 contains the complete current Releases 3–6 runtime and the full cumulative dev.157 correction scope, plus UAT-040 through UAT-045. It is not a partial patch and does not remove or replace earlier release artifacts.

The combined scope is these 16 tracked items:

1. **B-04:** deterministic migration evidence for legacy `Under offer` Inventory.
2. **C-02 / P-05:** Manager-only administrative Inventory closure; active assignments or reservations block closure.
3. **F-04:** ended or expired assignments block Offer, acceptance and Booking actions.
4. **G-02 / K-03:** atomic acceptance and exclusive reservation with no phantom accepted loser or mutable accepted-Inventory delink.
5. **G-06:** server-governed seven-day Assignment/Reservation periods and audited Manager expiry changes.
6. **J / M-04:** servicing reassignment preserves the external Offer and immutable creator while moving operating authority.
7. **O-03 / Q:** immutable detached Deal linkage and complete active/history visibility.
8. **UAT-038:** Opportunity Inventory correction-and-return, readable blockers and no invented availability-age rejection.
9. **UAT-046 / Test 156 / Test 157:** complete shared eligibility facts, hard-declaration enforcement and canonical effective-status parity.
10. **UAT-047:** focused audited availability maintenance, extended by UAT-048.
11. **UAT-040:** corporate Developer Master and authorized auto-activation.
12. **UAT-041:** clear owner/represented-party and internal-use-authority workflow without Customer creation.
13. **UAT-042:** understandable comparable-market evidence, Community mapping and linked-organization purpose.
14. **UAT-043:** Manager verification queue opens the exact submitted Inventory before a decision.
15. **UAT-044:** organization hierarchy is isolated in My Team for every applicable role.
16. **UAT-045:** queue age renders as minutes, hours, days and weeks.

## Corrections completed locally

- UAT-038: Inventory availability age is not an invented hard seven-day eligibility rule; exact blockers and governed eligibility remain visible.
- UAT-040: Developer governance models organizations, supports controlled legal structures, derives the evidence digest server-side, and auto-activates versions created by Manager, Director or Administrator.
- UAT-041: Inventory owner/represented-party fields use operational language and keep the party separate from Customer Master.
- UAT-042: comparable-market evidence is identified as optional advisory evidence, not valuation or Inventory lifecycle control; governed community and organization linkage are explained.
- UAT-043: Manager Inventory verification queue opens the exact Inventory workspace before a decision.
- UAT-044: organization hierarchy is available in a dedicated My Team view for operational roles, including Listing Executive.
- UAT-045: elapsed queue time uses minutes, hours, days and weeks instead of unbounded minute counts.
- UAT-046: the complete shared Inventory eligibility projection, assessment hydration and canonical effective status are enforced at Assignment, Viewing, Offer and Booking boundaries.
- UAT-047: availability maintenance remains an audited quick action and is extended by UAT-048.
- UAT-048: Listing Executive dashboard exposes a direct Availability effective period action requiring both exact effective and expiry timestamps. No expiry is invented by CORE.

## Database change

Migration `100_dev158_uat040_048_operational_corrections.sql` adds controlled organization legal structure and explicit `availability_expires_at`, including the invariant that expiry must be later than availability confirmation.

## Verification evidence

- Ordinary full regression: 1,143 passed, 0 failed, 0 skipped.
- Protected PostgreSQL integration: 9 passed, 0 failed, 0 skipped, executed separately to preserve test isolation.
- UAT-040–043 real HTTP/database evidence confirms authorized Developer activation, owner-party persistence without Customer/Contact creation, Community and Developer linkage without operational Inventory mutation, and the exact Manager-queue Inventory ID.
- UAT-040 specifically verifies the Company and governed Developer-version relationship, active external Developer role, zero Customer/Contact creation, authorization state and the exact `verification_auto_activated` audit actor/entity.
- UAT-043–045 executable dashboard evidence invokes the production navigation helper with the exact Inventory ID, checks My Team across the role matrix, and verifies minute/hour/day/week boundaries.
- The ten original UAT-037 correction gates were rerun against the final packaged runtime: B-04, C-02/P-05, F-04, G-02/K-03, G-06, J/M authority, Q and O-03.
- Previously closed gates were rerun: M-04/J coordinated servicing reassignment, true-concurrent G-02 Booking arbitration, Test 156 manual-origin hard-declaration enforcement at four boundaries, and Test 157 canonical effective-status parity.
- Audited availability-period persistence also passed through real HTTP/database evidence.
- Local fixture rebuild applied 100 migrations through migration 100.
- Raw extracted-package PostgreSQL output is preserved in `release-artifacts/release-3/consolidated/dev158-final-package-db-evidence.tap`; the ten-gate UAT-037 archive run is in `release-artifacts/release-3/consolidated/dev158-uat037-final-archive-evidence.tap`; and the complete ordinary TAP run is in `release-artifacts/release-3/consolidated/dev158-full-regression.tap`. All are embedded as non-runtime package evidence.

## Release controls

- Runtime package roots are limited to `.env.example`, `app.cjs`, `package.json`, `package-lock.json`, `public/`, and `src/`, plus non-runtime evidence documents.
- `.env`, storage, tests, tools, outputs, Git metadata, dependencies and private runtime data are excluded.
- Property Finder and other unapproved external integrations remain disabled.
- No CRM Test, Production, R2 clone, cPanel or other external environment was changed during this work.
