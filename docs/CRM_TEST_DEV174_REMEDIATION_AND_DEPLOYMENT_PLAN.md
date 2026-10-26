# NYSA CORE CRM Test dev.174 — Remediation and Deployment Plan

Date: 30 August 2026  
Target: CRM Test only  
Baseline: `2.1.0-dev.173`, migration 107  
Candidate: `2.1.0-dev.174`, migration 110

## Included correction scope

The candidate includes `DEF-097`, `DEF-098`, `DEF-099`, `DEF-101` through `DEF-106`, and specification gap
`SPEC-GAP-001`. It contains the approved Financial Illustration terminology and contract, full-screen immutable PDF
review, Lead-context-safe Value Brief handling, governed Value Brief proposal evidence, a more prominent Create
opportunity action, top-level Opportunity stage workspaces, authoritative Inventory parking, one Area maintenance
source, governed Listing Executive Developer creation, and the Agent-owned Lead authority boundary.

## Database plan

- Migration 108 creates the governed Area-to-Market-Intelligence compatibility projection without deleting history.
- Migration 109 adds nullable non-negative `listings.parking_spaces`; existing values remain unknown.
- Migration 110 permits and seeds an active Financial Illustration template without weakening existing buyer
  proposal contracts.
- Precondition: exactly 107 registered migrations with migration 107 latest.
- Postcondition: exactly 110 registered migrations with migration 110 latest.

## Controlled deployment

The installer is locked to `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database
`nysareal_nysa_r2_rehearsal`, and the exact dev.174 package/checksum/manifest. It takes database and application
backups, validates the internal runtime manifest and JavaScript syntax, preserves `.env`, installs production
dependencies, restarts only verified CRM Test LiteSpeed workers, and checks health, readiness, migration state,
runtime identity, integration switches and protected-environment snapshots.

Production, the Production/R2 clone and Property Finder are excluded. Microsoft 365 and Calendly remain disabled.
Deployment and automated checks do not infer human UAT passage.
