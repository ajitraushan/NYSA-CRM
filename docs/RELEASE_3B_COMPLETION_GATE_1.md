# Release 3B Completion - Gate 1 Functional Design

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 1 owner-approved; Gate 2 contract design authorized  
**Scope:** local/offline completion of Client Intelligence and Explainable Inventory Matching  
**External systems:** excluded

## 1. Why this package remains

Release 3B already provides governed requirement confirmation, immutable matching runs, preliminary
Inventory eligibility, ranked candidates, broker decisions and property-level feedback. The existing
increment deliberately left four functional gaps:

1. one reusable complete Inventory eligibility boundary with transactional run and downstream
   revalidation;
2. deterministic treatment of declared must-haves, exclusions, preferences, trade-offs and facts
   that are missing or not assessed;
3. a complete broker review workspace with exclusion drill-down, explanation evidence, run history
   and current-versus-historical status; and
4. controlled promotion of an approved shortlist into the existing Opportunity Property Match
   workflow.

This Gate 1 closes those gaps. It does not repeat the website intake, requirement-confirmation,
Inventory, Opportunity, Property Match, viewing, feedback or Release 3C sharing functions already in
CORE.

## 2. Owner outcome

A broker starts from one exact confirmed client requirement, runs a reproducible search against
currently eligible Internal Inventory, understands every fit, gap, trade-off and exclusion, reviews
the shortlist, and promotes selected properties into the existing Opportunity workflow without
re-entry or loss of provenance.

The same frozen requirement, policy and Inventory facts produce the same deterministic result. AI
may explain a deterministic result but cannot change eligibility, score, order, shortlist decision or
operational state.

## 3. Existing authorities to reuse

- `lead_requirements`, immutable requirement versions, website conflicts and exact confirmation.
- Internal Inventory and its existing approval, verification, availability, reservation, expiry and
  transaction-mode controls.
- Existing `inventory_matching_runs`, candidates, policy versions, decisions and feedback.
- Existing Opportunity, `property_matches`, match history, viewing and offer workflow.
- Release 3C governed shortlist/share preparation, which already requires an exact matching run,
  candidate, shortlist decision and Property Match.
- Existing broker/Manager/Director role and Opportunity scope.
- Existing audit records. No parallel work queue, Inventory master, requirement master, Opportunity,
  Property Match or feedback register will be created.

## 4. Proposed four-increment build

### Increment A - shared eligibility and transactional evidence

- Extract one server-side eligibility decision used by matching-run generation, shortlist decision,
  Property Match promotion, viewing preparation and Release 3C preflight.
- Evaluate deletion, workflow approval, verification trust/expiry, current availability, active
  reservation, availability-confirmation age and Sale/Lease transaction compatibility.
- Lock the exact requirement and evaluated Inventory rows while creating a run snapshot.
- Preserve historical eligibility while displaying a separate current eligibility result.
- A later state change blocks new action but never rewrites the historical run.

### Increment B - complete deterministic fit semantics

- Classify each declared item as `met`, `not_met`, `missing` or `not_assessed`.
- A declared exclusion that is proven true excludes the property before ranking.
- A must-have proven false excludes the property. Missing evidence is visibly different from a
  failed requirement and follows an explicit policy; it is never silently treated as satisfied.
- Preferences and acceptable trade-offs affect visible deterministic score components only after
  eligibility passes.
- Budget, transaction mode, area/Community, property type, bedrooms and size use controlled
  structured fields. Free text cannot silently become a hard rule.
- A versioned scoring policy publishes component weights and deterministic tie-breaking.

### Increment C - broker review and explanation workspace

- Show exact requirement version/source/confirmation, run time, policy version and evidence identity.
- Present eligible results separately from excluded Inventory.
- For each result show component score, matched facts, unmet facts, missing facts, not-assessed facts,
  material trade-offs and current eligibility.
- Provide exclusion drill-down without revealing another customer's or Opportunity's private facts.
- Preserve run history and clearly mark the current run; older runs remain historical evidence.
- Any AI explanation is stored with model/prompt-policy provenance, source evidence and human-review
  state. When AI is unavailable, the deterministic explanation remains fully usable.
- Broker decisions remain shortlist, reject or defer with controlled reason and notes.

### Increment D - governed Opportunity promotion and feedback continuity

- Promote only the current broker-shortlisted, currently eligible candidate into the existing
  `property_matches` record for the same Opportunity and exact requirement.
- Revalidate under transaction immediately before promotion.
- Make promotion idempotent: repeating the same accepted request returns the same Property Match and
  never creates a duplicate.
- Record the matching run, candidate and current shortlist decision as immutable provenance on the
  promotion link/history.
- Do not reserve Inventory, change availability, schedule a viewing, create an Offer or communicate
  externally.
- Existing Property Match, viewing, Release 3C and feedback flows continue from the promoted record.
  Feedback remains new evidence for a later run and never rewrites an earlier score.

## 5. Proposed broker workflow

1. Open the Customer/Lead or Opportunity and review the exact current requirement.
2. Resolve website conflicts and confirm that exact requirement version if not already confirmed.
3. Select **Match available Inventory**.
4. Review eligible matches and excluded-property explanations.
5. Compare score components, missing evidence and trade-offs.
6. Shortlist, reject or defer each relevant candidate with a controlled reason.
7. Select shortlisted candidates and choose **Add reviewed shortlist to Opportunity**.
8. CORE revalidates and creates/reuses the existing Property Match records.
9. Continue through the existing viewing, offer or governed Release 3C sharing workflow.
10. Record property feedback against the exact candidate/decision; request a new run when facts or
    requirements change.

## 6. Permissions and approval

- The Opportunity owner, an authorized team Manager, or organization-wide Director may run and
  review matching within existing scope.
- Ordinary broker shortlist review does not require maker-checker.
- A broker cannot use matching to bypass Inventory, Opportunity, viewing, offer or communication
  permissions.
- Manager/Director access follows existing team and organization boundaries; no private record is
  exposed merely because Inventory was excluded.
- This package creates no new Administrator policy-maintenance requirement at Gate 1. Gate 2 must
  decide whether scoring-policy activation remains controlled code/configuration or needs an Admin
  screen; no configurable policy will be implemented by assumption.

## 7. Fail-closed rules

Matching or promotion is blocked when:

- the current requirement is absent, unconfirmed, conflicted or requires a corrected version;
- required structured facts cannot be evaluated under the approved policy;
- Inventory is deleted, unapproved, unverified/expired, unavailable, actively reserved, stale for
  availability, or for the wrong transaction mode;
- the selected candidate, run or shortlist decision is no longer current;
- Opportunity or role scope does not authorize the actor; or
- transaction-time revalidation differs from the reviewed facts.

The user receives a readable reason and a safe next action. Historical evidence remains unchanged.

## 8. Explicit exclusions

- Property Finder, Bayut, dubizzle or any other portal work.
- External website, lead-provider, messaging, email, calendar or AI-provider integration.
- New Inventory intake, duplicate prevention, market intelligence or portal publication.
- Reservation, booking, offer, deal, commission or document workflow changes.
- Automatic customer communication or automatic lifecycle change.
- Autonomous AI eligibility, scoring, selection, approval or data correction.
- CRM Test, Production, R2, cPanel, migration application, packaging or deployment.

## 9. Gate 2 decisions required before implementation

Gate 2 will present the exact additive data/API contract and must resolve:

1. which existing eligibility implementation becomes the single canonical service;
2. the structured-field mapping and policy for `missing` versus `not_assessed` must-haves;
3. the initial deterministic score weights and tie-break order;
4. whether AI explanation persistence is included now or deterministic explanations alone complete
   the offline package;
5. the minimum immutable provenance link from a matching candidate/decision to `property_matches`;
6. idempotency fingerprints and transaction locks; and
7. whether one additive migration numbered `092` is sufficient.

No migration `092`, API, UI or test implementation may begin until Gate 2 is separately approved.

## 10. Acceptance evidence

The package will be complete locally only when synthetic tests prove:

- the same evidence produces the same eligible set, component scores and ordering;
- ineligible Inventory never reaches ranking, shortlist promotion, viewing or Release 3C preparation;
- must-have, exclusion, preference, trade-off, missing and not-assessed states are visibly distinct;
- concurrent Inventory change blocks promotion without rewriting the prior run;
- each exclusion and score reconciles to exact requirement/Inventory evidence;
- a reviewed shortlist promotes once into the existing Property Match workflow;
- feedback remains append-only and is visible to a later matching cycle;
- deterministic matching remains usable with AI disabled; and
- focused tests, complete repository regression, syntax checks and a loopback-only synthetic owner
  review all pass without external access.

## 11. Approval requested

The NYSA owner approved Gate 1 on 14 August 2026. This confirms the functional boundary and
authorizes Gate 2 schema/API contract design only. It does not authorize material implementation,
migration creation/application, external access, packaging or deployment.
