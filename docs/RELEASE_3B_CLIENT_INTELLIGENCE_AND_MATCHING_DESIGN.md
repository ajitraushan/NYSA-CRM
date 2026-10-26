# Release 3B Design - Client Intelligence and Explainable Inventory Matching

Status: Design plus local increment preparation after Release 3A CRM Test UAT approval; hosted promotion gates remain open  
Prepared: 2026-08-01  
Frozen Release 3A CRM Test candidate: `2.1.0-dev.114`  
Governing outcome: **shorten the time from a credible client requirement to a reviewed, accurate shortlist**

Release 3B application code must not be mixed into the frozen dev.114 candidate. Release 3A UAT
corrections are resolved, owner UAT sign-off was approved on 2026-08-02, and the exact dev.114 ZIP
and checksum are frozen. Release 3B work remains local and separate until dev.114 passes R2-clone
acceptance, receives explicit Production promotion approval, is verified in Production, and both
non-production environments are aligned to that exact Production baseline.

## 1. Frozen scope and plain-language outcome

| Requirement | Outcome |
|---|---|
| `R3B-REQUIREMENT-47` | Guide the broker through a complete, versioned client profile and requirement map without hidden profiling. |
| `R3B-WEBSITE-TOOLS-48` | Reuse governed evidence from NYSA website tools without duplicate entry or automatic commitment. |
| `R3B-AI-MATCH-49` | Exclude ineligible Inventory first, then rank only eligible properties using explainable governed evidence. |
| `R3B-EXPLAINABILITY-50` | Show why each property fits, misses or was excluded, including important trade-offs and missing facts. |
| `R3B-FEEDBACK-51` | Record property-level customer/broker feedback so the next matching cycle improves without rewriting history. |
| `R3B-INVENTORY-BOUNDARY-52` | Keep Internal Inventory capture simple, progressively govern internal authority, and require publication evidence only for an external Listing. |
| `R3B-IMPORT-ATTRIBUTION-53` | Resolve genuine originating/responsible agents during Excel and external intake instead of silently attributing every property to the uploader. |
| `R3B-INVENTORY-OWNER-54` | Capture the basic owner atomically during Excel/external Draft intake, retain a post-import correction path, and create no Customer or external Listing. |
| `R3B-INVENTORY-VERIFY-55` | Show pending Inventory verification in Manager Immediate attention and expose its governed queue as a visible operating view above priority work. |

## 2. What already exists and what is not yet sufficient

Release 3A provides Customer 360, website-profile evidence, controlled next-action assistance and
time-sensitive broker work. Earlier releases provide structured requirements, live Inventory,
Opportunity matching, viewing feedback and server-side Inventory eligibility checks.

The application also contains a transparent proposal-ranking helper. It compares Area, property
type, budget, bedrooms, funding/payment-plan compatibility and availability confirmation. This is
a useful foundation, not the finished Release 3B capability, because:

- its initial candidate filter checks only the visible `Available` status;
- it does not apply every approval, verification, expiry, deletion, closure and reservation gate
  before ranking;
- it does not create an immutable matching-run snapshot;
- it does not fully use declared must-haves, exclusions, preferences and acceptable trade-offs;
- it is reached mainly through proposal preparation rather than one customer-centred matching
  workspace; and
- feedback does not yet become governed evidence for the next recommendation cycle.

Release 3B will strengthen and connect these foundations rather than create a second Inventory or
Opportunity system.

## 3. Intended end-to-end journey

1. The broker opens Customer 360 and selects one active Lead/Opportunity need.
2. CORE shows the latest structured requirement and its evidence source/date.
3. Missing or ambiguous facts are shown as questions. AI may draft an interpretation, but the
   broker must confirm any structured value before it becomes authoritative.
4. The broker saves a new immutable requirement version when the client changes or clarifies the
   need.
5. The broker requests matches. The server transactionally obtains the current eligible Inventory
   set before any ranking occurs.
6. Deterministic criteria calculate reproducible fit components. AI may explain evidence and
   trade-offs only inside the eligible set.
7. The broker sees a ranked comparison with **why it fits**, **important trade-offs**, **missing
   evidence**, **live availability checked at**, and any excluded-property reason.
8. The broker selects, rejects or holds properties for clarification. This does not reserve
   Inventory or change authoritative status.
9. The reviewed shortlist continues into the existing Opportunity/proposal flow.
10. Property-level feedback is recorded against that exact matching run. A new run uses the newer
    evidence while leaving the previous run immutable.

## 4. Client profile and requirement mapping

### Authoritative structured facts

The current requirement will cover:

- purpose and transaction type;
- budget range and currency;
- funding method and readiness;
- preferred and acceptable Areas;
- property types, bedrooms and size range;
- ready/off-plan preference and required timeline;
- intended use, occupancy or investment objective;
- customer-declared priorities and must-haves;
- preferences that may be traded off;
- explicit exclusions; and
- acceptable trade-offs confirmed by the customer.

Every requirement version records who confirmed it, when, its source and the prior version. Website
evidence remains labelled as customer-declared until a broker confirms it. AI-extracted values are
proposals, never authoritative facts by themselves.

### No hidden profiling

CORE will not infer personality, ethnicity, religion, health, family status, protected traits,
undisclosed wealth or intent. It will not scrape social media. “Client profile” means the
customer's recorded property need, readiness, declared priorities and engagement with NYSA.

## 5. Deterministic Inventory eligibility boundary

Before scoring or AI processing, the server will exclude Inventory that is:

- deleted or retired;
- not workflow-approved;
- unverified when verification is required;
- verification-expired;
- sold, closed or otherwise unavailable;
- reserved by another active Opportunity/booking;
- blocked by a different Offer/Opportunity;
- inconsistent with the required sale/rental transaction mode;
- outside any absolute customer exclusion; or
- missing a mandatory live commercial fact required for safe recommendation.

The same reusable eligibility service will be called by match generation, match viewing,
shortlisting and the later Release 3C share boundary. A database transaction and row-level checks
will prevent a property that becomes unavailable during matching from being newly selected.

Historical recommendations remain visible with their original snapshot, but the current screen
marks them unavailable and blocks new action.

## 6. Ranking and AI boundary

### Reproducible score first

Only eligible Inventory enters ranking. A versioned scoring policy assigns visible weights to the
applicable dimensions. Initial dimensions include:

- Area;
- property type;
- budget;
- bedrooms and size;
- funding/payment-plan compatibility;
- timeline/readiness;
- declared must-haves and exclusions; and
- customer priorities and acceptable trade-offs.

Weights are normalized over criteria that have sufficient evidence. Missing evidence does not
silently score zero; it appears separately as **not assessed**. Absolute exclusions never become a
low score—they remove the candidate before ranking.

The same requirement version, Inventory snapshot and scoring-policy version must produce the same
deterministic candidate order.

### Permitted AI work

AI may:

- summarize why a high-ranking property suits the recorded need;
- describe a material trade-off in plain language;
- draft clarification questions for missing facts; and
- compare several eligible properties using the supplied evidence.

AI may not:

- introduce a property outside the server-provided eligible candidate IDs;
- invent price, availability, yield, view, size, amenity or developer facts;
- alter the deterministic score or exclusion reason;
- save a shortlist, reserve Inventory or communicate externally; or
- treat generated prose as customer-confirmed evidence.

When AI is unavailable, deterministic ranking and all broker actions continue to work.

## 7. Proposed screens

### Customer 360 - Match Inventory

The matching workspace will show:

1. **Requirement summary** — current version, source, confirmed date and missing facts.
2. **Eligibility summary** — eligible count, excluded count, live check time and policy version.
3. **Recommended properties** — reference, project, Area, amount, property facts, score and fit.
4. **Why this fits** — passed criteria with exact expected and actual values.
5. **Trade-offs / not assessed** — failed preferences and missing evidence, visually separate from
   hard exclusions.
6. **Broker decision** — shortlist, reject, hold for clarification or request more options.
7. **Feedback** — interested, not suitable, more options, viewing requested or information
   required, with controlled reasons and notes.

### Exclusion evidence

A broker may open **Why properties were excluded**. This shows safe business reasons and counts,
for example unavailable, reserved elsewhere, outside absolute budget, wrong transaction mode or
explicit customer exclusion. It will not disclose another customer's identity or confidential
Opportunity details.

## 8. Durable data design

The implemented first Release 3B schema increment begins at
`075_release3b_governed_inventory_matching.sql`, followed by
`076_release3b_match_decisions_and_feedback.sql`, and remains additive. Durable records are:

- `matching_policy_versions` — approved dimensions, weights and lifecycle;
- `inventory_matching_runs` — Customer, Lead/Opportunity, exact requirement version, policy
  version, initiator, timestamps and Inventory eligibility snapshot time;
- `inventory_matching_candidates` — exact Inventory snapshot, eligibility result/reason,
  deterministic score, criteria evidence, rank and AI explanation reference;
- `inventory_match_decisions` — broker shortlist/reject/hold decision and reason; and
- `inventory_match_feedback` — immutable property-level customer/broker feedback and source.

Existing `lead_inventory_matches` and Opportunity `property_matches` remain the operational
selection records. A reviewed candidate is promoted into those governed workflows; matching-run
history is not overwritten.

## 9. Security, privacy and transaction controls

- Apply current Lead/Opportunity role and team scope to every run and decision.
- Send AI only the minimum requirement and eligible-property evidence needed for explanation.
- Exclude direct identity, private documents, KYC numbers and unrelated notes from AI input.
- Record input hash, model/provider, schema version and reviewed output under the existing AI audit
  pattern.
- Revalidate Inventory under transaction immediately before creating an operational match.
- Never reveal another Opportunity's customer or commercial details when explaining a conflict.

## 10. Realistic limitations

- A match is only as good as recorded requirements and current Inventory facts.
- Availability can change after recommendation; every later selection/share/offer boundary must
  revalidate it.
- AI cannot reliably know unrecorded preferences or facts and may phrase an explanation poorly.
- Predicted investment return is excluded unless supported by governed calculation and source
  evidence; AI will not invent yield or appreciation.
- Website tool integration cannot be accepted until its actual payload and version are exercised
  in CRM Test.
- Customer feedback outside CORE remains unknown until recorded; native WhatsApp correlation is
  Release 3D.

## 11. Delivery sequence after Release 3A freezes

1. Requirement-version completion and source labels (`R3B-REQUIREMENT-47`).
2. Shared server-side eligibility service and boundary tests (`R3B-AI-MATCH-49`).
3. Immutable run/candidate/decision schema and deterministic ranking policy.
4. Customer-centred matching workspace and evidence drill-down (`R3B-EXPLAINABILITY-50`).
5. Website-tool reuse and conflict/confirmation handling (`R3B-WEBSITE-TOOLS-48`).
6. Property-level feedback and next-run evidence (`R3B-FEEDBACK-51`).
7. AI explanation layer with deterministic fallback.
8. Full regression, PostgreSQL migration rehearsal, CRM Test UAT and one frozen R2-clone
   acceptance package.
9. UAT-derived Inventory/Listing separation, multi-agent attribution and post-import owner-enrichment
   corrections (`R3B-INVENTORY-BOUNDARY-52`, `R3B-IMPORT-ATTRIBUTION-53`,
   `R3B-INVENTORY-OWNER-54`) before general Inventory rollout.

## 12. Acceptance demonstrations

| Requirement | Minimum demonstration |
|---|---|
| `R3B-REQUIREMENT-47` | Create and revise a complete requirement, prove prior versions remain immutable, and distinguish website-declared, broker-confirmed and AI-proposed evidence. |
| `R3B-WEBSITE-TOOLS-48` | Ingest one approved NYSA website profile, reuse it without re-entry, hold conflicting values for confirmation and retain source/version. |
| `R3B-AI-MATCH-49` | Create mixed eligible/ineligible Inventory, prove no ineligible ID reaches ranking or AI, change availability concurrently and prove selection is blocked transactionally. |
| `R3B-EXPLAINABILITY-50` | Reconcile each score component, trade-off, missing fact and exclusion reason to authoritative requirement/Inventory evidence; repeat the run and reproduce the deterministic result. |
| `R3B-FEEDBACK-51` | Record several property decisions and customer responses, generate a new run using the new evidence and prove the original run remains unchanged. |
| `R3B-INVENTORY-BOUNDARY-52` | Create a minimal internal Draft, prove it cannot match or publish, verify it for internal matching without a portal Listing, then create a separately governed external publication with the required authority/permit evidence. |
| `R3B-IMPORT-ATTRIBUTION-53` | Import a multi-agent workbook through an Admin Assistant, resolve each maintained agent during preview, reject missing/inactive/out-of-scope references, and prove originating, responsible and uploader identities remain distinct. |
| `R3B-INVENTORY-OWNER-54` | Open an imported Draft with no party, save its actual owner with governed source/authority evidence, reload it, and prove no Customer, publication, match or reservation was created. |

Release 3B is accepted only when a broker can move from a confirmed Customer need to a reviewed,
explainable eligible shortlist end to end in CRM Test and then on the unchanged R2-clone candidate.
