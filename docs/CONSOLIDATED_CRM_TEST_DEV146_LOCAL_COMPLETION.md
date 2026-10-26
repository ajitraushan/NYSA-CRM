# NYSA CORE Consolidated CRM Test dev.146 — Local Completion

**Date:** 15 August 2026 (Asia/Dubai)  
**Version:** `2.1.0-dev.146`  
**State:** historical local-build record; subsequently deployed and technically verified on CRM Test  
**Target:** CRM Test only

Post-deployment evidence is recorded in `CONSOLIDATED_CRM_TEST_DEV146_DEPLOYMENT_COMPLETION.md`.

## UAT correction disposition

The original CRM Test observations against dev.145 remain recorded in
`CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md`. UAT-001–022 are corrected locally in dev.146 and remain
pending CRM Test deployment and focused owner UAT. They are not recorded as passed.

- UAT-001: Agent leave reason validation now returns an explicit client error rather than an
  uncaught server error; the Manager/Director approval Task path remains governed.
- UAT-002–003: Admin navigation has 24 unique stable entries, and assignment actions refresh the
  mounted queue without exposing another workspace.
- UAT-004–006: routed unassigned Leads appear in both Assignment Queue and the responsible
  Manager's My Task Queue; eligible Agent-created Leads self-assign; initial qualification is the
  assigned Agent's action; immutable `Created by` is visible.
- UAT-007: the owner-supplied production variants are preserved byte-for-byte and centrally mapped
  for header, compact mark, authentication, footer, favicon/app icon, social share, email signature,
  PDF/letterhead, light/dark, stacked and monochrome contexts.
- UAT-008–013: completed customer discussions use a controlled outcome and direction; only
  successful outcomes count as first contact; direct Lead-stage bypass is blocked without that
  evidence and a dated next action. Opportunity next actions use stable API-enforced codes.
  Below-target prices remain affordable, and matching returns selected/additional counts plus
  governed property-level exclusion reasons without owner/contact data.
- UAT-014–016: terminal Offer recovery now presents explicit same-property, more-options,
  requirement-review and Closed Lost paths. More-options/review records the terminal Offer,
  requirement impact, property disposition, exact confirmed replacement requirement when used,
  and a dated governed action. Return to Matching uses the canonical value.
- UAT-017–018: modal Close labels and card hierarchy/readability are corrected.
- UAT-019–020: composite displayed Opportunity references are extracted for exact lookup;
  transaction type is searchable; the Opportunity register has Previous/Next pagination; Connected
  Lead binding is installed before optional flow modules.
- UAT-021: independent accepted-Offer withdrawal and Booking release remain blocked while a Deal
  exists. An authorized Manager/Director now has one atomic `Withdraw accepted Offer and replace
  terms` action that closes the prior Deal, cancels its Booking, restores Inventory, withdraws the
  accepted Offer, creates linked replacement Offer Revision 1 and records immutable lineage; any
  failure rolls back the database transaction.
- UAT-022: Opportunity creation explicitly ends the current Lead operating SLA while retaining
  assignment history, both recycler paths require an unsuperseded operating SLA and exclude active
  Opportunities, and the consolidated Lead API projects the authoritative active Opportunity owner
  and team.

## Validation

- Runtime JavaScript syntax: 126/126 files passed.
- Focused Leave, Director-only Commission/Payout, Release 2 and dev.146 correction/package tests:
  validation rerun is recorded with the final package below.
- Complete local suite: 1,028/1,028 passed after the final package rebuild.
- Migration inventory: 95 files, latest `095_dev146_full_scope_uat_governance.sql`.
- External connector defaults remain disabled, including every Property Finder switch, Microsoft
  365 Email and Calendly. Native WhatsApp delivery remains excluded.

Archive integrity, deterministic rebuild, exclusion and final diff checks are completed after this
document is embedded in the versioned archive. This build record did not itself authorize deployment;
fresh explicit approval was received later and the resulting evidence is recorded separately.
