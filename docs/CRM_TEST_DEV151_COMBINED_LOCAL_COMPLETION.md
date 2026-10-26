# CRM Test dev.151 combined local completion

**Prepared:** 16 August 2026 (Asia/Dubai)  
**Candidate:** `2.1.0-dev.151`  
**Target:** CRM Test only, after separate explicit deployment approval  
**Deployed baseline:** `2.1.0-dev.148`

## Included scope

- All cumulative local corrections recorded as UAT-023 through UAT-035.
- UAT-033: separate immutable Developer Brokerage Arrangement and property-specific Listing NOC
  registers, independent review, exact governed Developer/Inventory/document-version linkage, retained
  superseded/rejected history, and a server-side external-listing authority gate.
- UAT-035: route-backed, full-width Inventory, Customer, Lead and Opportunity record and creation workspaces; preserved
  list context; browser Back; dirty-form protection; and explicit Inventory draft/save workflow with
  owner/internal-use authority before Manager verification.
- Activity/enrichment corrections in migrations 096 and 097 and their UI/API changes.

## Deliberate boundaries

- Developer authority evidence does not block Internal Inventory creation, maintenance or verification.
  It is mandatory only for external-listing preparation/submission when a governed Developer is linked.
- No existing CRM Test record is repaired or backfilled by this package.
- Property Finder remains disabled and excluded from UAT execution. Microsoft 365 and Calendly remain
  disabled pending their separate integration approvals.
- Production and Production/R2 clone are protected targets and are not part of this candidate.
- This document records local completion only. It is not deployment evidence.

## Database change

- 98 cumulative migrations, through `098_developer_arrangement_and_listing_noc.sql`.
- Migration 096 adds activity Opportunity snapshots without historical inference.
- Migration 097 adds controlled customer-enrichment pathway fields.
- Migration 098 adds the two Developer authority evidence registers and immutable evidence controls.

## Retest focus

1. Open Inventory, Customer, Lead and Opportunity from filtered registers; confirm full-width workspace,
   direct URL, browser Back, preserved register state and unsaved-change protection.
2. Save a new Inventory as Draft, add the owner/represented party, then submit for verification.
3. For a governed Developer, upload and independently activate the arrangement and exact property NOC.
4. Confirm external preparation is blocked without either current evidence item and succeeds only after
   both are active; confirm ordinary Internal Inventory verification never asks for either document.
5. Retest the activity launcher, Note, Task and completed-interaction pathways from dev.149/dev.150.
