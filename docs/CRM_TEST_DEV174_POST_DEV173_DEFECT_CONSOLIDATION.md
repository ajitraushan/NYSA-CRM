# NYSA CORE CRM Test — Post-dev.173 Defect Consolidation

Date: 30 August 2026  
Candidate: dev.174  
Deployed baseline: `2.1.0-dev.174`

## Consolidated register

| Reference | Classification | Observation | Current state |
|---|---|---|---|
| DEF-104 | Defect; formerly unnumbered issue 1 | Area was maintained separately in Administration and Market Intelligence | Deployed; migration 108; UAT pending |
| DEF-105 | Defect; formerly unnumbered issue 2 | Listing Executive could not create a governed Developer | Deployed; UAT pending |
| DEF-106 | Defect; formerly unnumbered issue 3 | Manager approval access allowed operations on an active Agent-owned Lead | Deployed; UAT pending |
| DEF-097 | Defect | Financial Illustration still required sales narrative and recommended next steps | Deployed; migration 110; UAT pending |
| DEF-098 | Defect | Immutable proposal PDF review was too small | Deployed; full-screen review; UAT pending |
| DEF-099 | Defect | Creating or viewing a Value Brief exited the Lead | Deployed; Lead context retained; UAT pending |
| SPEC-GAP-001 | Specification gap; initially called DEF-100 | Saved Value Brief should add weight to the proposal | Deployed with governed immutable proposal evidence; UAT pending |
| DEF-101 | Defect | Create opportunity action was easily missed | Deployed; dedicated larger CTA; UAT pending |
| DEF-102 | Showstopper defect | Opportunity workflow page overlapped and jumbled the parent Opportunity | Deployed; six clean stage open/Back returns directly observed by agent on dev.174; user confirmation pending |
| DEF-103 | Defect | Proposal showed Parking but Inventory had no authoritative Parking specification | Deployed; migration 109 and end-to-end field; UAT pending |

The three formerly unnumbered observations above are the issues the user identified as having been noted at
approximately 22:49 GST on 30 August 2026. They receive the next available defect numbers to preserve every number
already used in the subsequent discussion.

## Status summary

- Total observations: 10.
- Defects: 9.
- Specification gaps: 1.
- Corrected or implemented locally: 10.
- Open: 0.
- Packaged: 10.
- Deployed after dev.173: 10.
- Human UAT passed: 0 inferred.

## Implemented correction — DEF-097

The current proposal contract supports full buyer proposals with mandatory match rationale and next steps. A saved
financial scenario adds governed calculation evidence but does not change that proposal type. The user approved the
customer-facing term `Financial Illustration`. It is calculation-led and indicative; `Investment Proposal` remains
recommendation-led. Migration 110 and the application now provide an explicit Financial Illustration type with its
own mandatory contract: one applicable Inventory record, a saved immutable financial scenario, calculation/rule and
as-of evidence, customer-facing assumptions, approved disclaimer, immutable PDF and Manager review. Sales
recommendations, viewing actions, Value Brief, match narrative and next steps do not block or appear in that specific
document type. Existing Quick, Investment and Comparison contracts remain unchanged.

## Verification evidence

- Focused post-dev.173 correction tests: 47 passed, 0 failed.
- Full ordinary regression: 1,289 tests; 1,259 passed, 30 protected skips, 0 failed.
- These automated results verify the local candidate only and do not establish human UAT passage.

## Deployment boundary

The checksum-bound cumulative package was deployed to CRM Test as `2.1.0-dev.174`. Production, R2 and Property
Finder were excluded. Every correction remains pending direct human UAT; deployment does not infer a pass.

## Direct CRM Test observation — DEF-102 — 31 August 2026, 00:05–00:07 GST

- Role: Sales Agent `ajitr`.
- Existing record: Opportunity `NYSA-OP-202608-000001`, customer `uat173round1`, Sale, `2 bedroom in Business Bay`,
  status `Matching`, source Lead history `Qualified`.
- All six workflow stages were opened one at a time from the existing Opportunity: Inventory selection; Viewing and
  customer feedback; Offer and commercial terms; Negotiation; Booking and reservation; Deal and completion.
- Each stage rendered as a clean top-level focused/full-viewport page. No Opportunity-parent headings, controls or
  Inventory content overlapped or jumbled the stage surface.
- Each `Back to Opportunity` action restored the same Opportunity. The status remained `Matching`, stage 1 remained
  completed, stages 2–6 remained not completed, and the source/customer/title evidence remained unchanged.
- No business record was created or replaced, and no draft or governed Save action was used.
- Result boundary: the reported `DEF-102` failure was not reproduced in this direct agent-operated browser run.
  This does not change `Human UAT passed: 0 inferred`; user direct observation and confirmation are still required
  before the case can be marked passed.
