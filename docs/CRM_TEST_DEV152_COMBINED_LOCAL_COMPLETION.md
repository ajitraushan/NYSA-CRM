# CRM Test dev.152 combined completion

**Candidate:** `2.1.0-dev.152`  
**Target:** CRM Test only  
**Baseline:** deployed `2.1.0-dev.148`  
**Scope:** cumulative dev.149–dev.152 corrections, including UAT-033, UAT-035 and UAT-036

## UAT-036 blocker correction

- Opportunity Inventory can be attached, removed with a governed reason, and re-added during
  Requirements, Matching, Viewing, Offer and Negotiation.
- Removal preserves the match, Viewing and Offer history. Re-add updates the existing match rather
  than conflicting with its immutable Opportunity/Inventory identity.
- Every add or re-add revalidates approval, verification, availability, reservation conflicts,
  verification expiry and the seven-day availability confirmation.
- Inventory maintenance locks after exact Offer acceptance, an active Booking or a governed Deal.
  An Offer whose exact property was removed cannot be accepted until eligible Inventory is re-added.
- The eligibility explanation is a collapsed full-width responsive grid with a bounded internal
  scroll region. Aggregate reasons are compact, all reviewed Inventory is accessible, and the API no
  longer silently caps the evidence at 50 or 200 rows.

## Cumulative scope retained

- UAT-001–UAT-035 local corrections and governed Releases 3–6 runtime remain included.
- Developer Brokerage Arrangement and property-specific Listing NOC governance remain external-
  publication controls only.
- Customer, Lead, Opportunity and Inventory route-backed workspaces and explicit save/draft behavior
  remain included.
- Leave, Director-only Commission/Payout and all prior cumulative migrations remain included.
- Property Finder and unfinished external integrations remain disabled.

## Package contract

- Runtime roots only: `.env.example`, `app.cjs`, `package.json`, `package-lock.json`, `public`, `src`.
- Evidence documents and the CRM Test-only deployer are included outside the runtime manifest.
- `.env`, storage, dependencies, tests, tools, outputs, Git metadata and private runtime data are
  excluded.
- Migration inventory remains 98 through `098_developer_arrangement_and_listing_noc.sql`; UAT-036 is
  an application correction and requires no schema change.

## Deployment

The package is cumulative. Deploy `dev.152` once; do not deploy `dev.151` first. The deployer verifies
the exact CRM Test root/database, creates application and database backups, checks package and internal
manifests, installs the runtime, restarts only the verified CRM Test worker, requires exactly one new
worker, and confirms health, readiness, version, migration inventory and disabled integration switches.
