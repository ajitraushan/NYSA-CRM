# CRM Test dev.153 combined local completion

**Candidate:** `2.1.0-dev.153`  
**Target:** CRM Test only  
**Baseline:** deployed `2.1.0-dev.152`  
**Scope:** cumulative build plus UAT-037 Inventory assignment and Deal-linkage lifecycle

## UAT-037 correction

- Inventory verification remains independent from transaction linkage. `property_matches` remains
  discovery evidence; the new immutable `inventory_assignments` lifecycle records formal seven-day
  Opportunity linkage, predecessor lineage, expiry changes and events.
- Effective Inventory status is computed live: terminal `Sold`, `Rented` or administrative `Closed`;
  otherwise active reservation `Reserved`; otherwise active assignment `Assigned`; otherwise
  `Available`. No cron job, idle worker or direct status synchronizer is introduced.
- Available, Assigned and Reserved Inventory may remain in shared consideration. Reservation is
  exclusive and the first row locked successfully wins; competing Offers cannot be accepted or
  booked while that reservation is active.
- Opportunity creation formalizes every selected starting Inventory. Later assignment, delink,
  re-attachment and seven-day expiry are explicit and audited. Re-attachment creates a fresh
  assignment row; ended assignments are never reopened.
- Before an Offer, the Opportunity owner or responsible Manager may change assignments. After an
  Offer, only its exact creator or the responsible Manager may do so. A Manager delink withdraws a
  mutable Offer atomically; Accepted/Reserved lineage requires formal release or expiry.
- A different Inventory or Opportunity-owner reassignment requires a new Offer ID at Revision 1
  with predecessor evidence. Offer, Booking and assignment IDs change; Opportunity and Deal IDs do
  not.
- `deals.current_inventory_linkage_id` is the authoritative current lineage. Existing direct Deal
  columns are compatibility mirrors verified by a deferred PostgreSQL constraint trigger. Release
  creates a detached linkage; a later accepted Offer and Booking switches the same Deal to a new
  immutable linkage.
- Close Won produces `Sold` or `Rented`; `Closed` is reserved for non-transactional administrative
  closure. Historical won rows are corrected and historical terminal assignments are closed.
- Inventory detail shows every linked Opportunity, its stage, assignment state/expiry, Offer and
  Booking evidence. The obsolete legacy Reserved reconciliation surface is removed.

## Cross-module impact review

- Inventory lists, detail, dashboards, reports, Lead selection, Opportunity matching, governed
  shortlist/share, AI ranking and publication reads consume the effective status contract.
- Direct non-terminal Inventory status writes were removed. The only remaining direct `Available`
  write is the governed Manager-approved administrative reopening of a `Closed` Inventory.
- Starting Inventory, viewing, Offer, acceptance, Booking, release, Deal retention and terminal
  closure are all revalidated at their authoritative transaction boundaries.
- Property Finder remains disabled and excluded from this correction.

## Package contract

- Runtime roots only: `.env.example`, `app.cjs`, `package.json`, `package-lock.json`, `public`, `src`.
- Evidence documents and the CRM Test-only deployer are outside the runtime manifest.
- `.env`, storage, dependencies, tests, tools, outputs, Git metadata and private runtime data are
  excluded.
- Migration inventory is 99 through `099_dev153_inventory_assignment_lifecycle.sql`.

## Deployment gate

This package is local and deployment-ready only after all verification gates pass. It must not be
uploaded or deployed until the user gives separate explicit approval for this exact dev.153 package.
