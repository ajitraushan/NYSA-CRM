# Release 3B Completion - Gate 2 Migration and API Contract

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 2 owner-approved; local Gate 3 implementation authorized  
**Migration:** `092_release3b_matching_completion.sql` - created locally and not applied  
**Deployment target:** future single consolidated Production/R2-clone candidate only after local Gate 4

## 1. Contract decision summary

This contract closes Release 3B without replacing existing Customer/Lead requirements, Inventory,
Opportunity, Property Match, feedback or Release 3C sharing authorities.

The proposed decisions are:

1. extract one code-owned Inventory eligibility service and reuse it at run, decision, promotion,
   viewing and Release 3C boundaries;
2. add exact transaction-type and requirement-size facts because CORE does not currently maintain
   them in the required authoritative shape;
3. use three candidate states: `eligible`, `needs_clarification` and `excluded`;
4. score only structured or explicitly assessed evidence under code-owned policy
   `r3b-eligibility-ranking-v2`;
5. deliver deterministic explanations now and defer persisted AI narrative;
6. link governed candidates to existing Property Matches through one immutable provenance table;
7. make promotion transactionally revalidated and idempotent; and
8. implement the complete additive data change in one ordered migration `092` after Gate 2 approval.

No policy is maintained through an Admin screen in this package. Changing eligibility or weights is a
controlled code/configuration release with a new immutable policy version and regression evidence.

## 2. Authority gaps found during Gate 2 review

### 2.1 Inventory transaction type

`listings` currently has no authoritative field that states whether the Inventory is available for
Sale, Rental, Off-plan or Commercial pursuit. Portal preparation contains provider-specific offering
facts, but those cannot become the Internal Inventory authority.

Migration `092` therefore proposes nullable `listings.transaction_types TEXT[]` with allowed values
`Sale`, `Rental`, `Off-plan` and `Commercial`. It will:

- perform no legacy backfill or inference;
- allow one Inventory to support more than one explicitly maintained transaction type;
- require at least one controlled value for newly approved/edited Inventory after the new UI is used;
- treat a missing legacy value as `needs_clarification` for matching; and
- never copy a portal value into this field automatically.

### 2.2 Structured size requirement

`lead_requirements` currently has no structured minimum/maximum size. Migration `092` proposes
nullable `size_sqft_min` and `size_sqft_max`, constrained to non-negative values and maximum greater
than or equal to minimum. Existing versions are not backfilled. A later requirement revision may
record these values with ordinary immutable versioning.

### 2.3 Free-text declarations

Existing `must_haves`, `preferences`, `exclusions` and `acceptable_trade_offs` are declared text. The
system must not silently parse text into a hard business rule. Structured facts are evaluated
automatically; text declarations are displayed as `not_assessed` until the broker records an exact
candidate assessment with evidence.

## 3. Proposed migration 092

### 3.1 Existing-table additions

```sql
ALTER TABLE listings
  ADD COLUMN transaction_types TEXT[];

ALTER TABLE lead_requirements
  ADD COLUMN size_sqft_min NUMERIC(14,2),
  ADD COLUMN size_sqft_max NUMERIC(14,2);
```

Exact checks will prohibit empty arrays, duplicate transaction types, unknown values, negative sizes
and an inverted size range. Existing nulls remain valid to avoid unsafe backfill.

The `inventory_matching_candidates` eligibility constraint will be replaced so historical
`eligible`/`excluded` rows remain valid and new rows may also use `needs_clarification`. New v2
candidates still require a rank and deterministic score when structurally rankable; excluded rows do
not receive a rank or score.

The `property_matches.match_source` check will be extended from `manual`/`rule` to include
`governed`. Existing values are unchanged.

### 3.2 Immutable candidate assessments

```text
inventory_match_candidate_assessments
  id UUID primary key
  candidate_id UUID -> inventory_matching_candidates
  previous_assessment_id UUID -> same table, nullable
  sequence_no integer
  declaration_kind must_have | exclusion | preference | acceptable_trade_off
  declaration_index integer
  declaration_text text
  declaration_hash char(64)
  result met | not_met | missing | not_assessed
  evidence_kind inventory_fact | customer_confirmation | broker_review
  evidence_reference text, nullable
  assessment_notes text
  assessed_by UUID -> brokers
  assessed_at timestamptz
  created_at timestamptz
```

- The exact declaration index, text and SHA-256 bind the assessment to the frozen requirement
  snapshot.
- Revisions form a linear optimistic chain. Rows are append-only and immutable.
- Promotion requires every must-have to be `met` and every exclusion to be `not_met`.
- `missing` and `not_assessed` never count as satisfied.
- Preferences and acceptable trade-offs may remain not assessed, but contribute no score and are
  visibly disclosed.

### 3.3 Immutable governed promotion provenance

```text
property_match_governed_origins
  id UUID primary key
  property_match_id UUID unique -> property_matches
  matching_run_id UUID -> inventory_matching_runs
  candidate_id UUID unique -> inventory_matching_candidates
  shortlist_decision_id UUID unique -> inventory_match_decisions
  policy_version text -> matching_policy_versions
  promotion_fingerprint char(64) unique
  inventory_checked_at timestamptz
  inventory_eligibility jsonb
  assessment_snapshot jsonb
  assessment_evidence_hash char(64)
  promoted_by UUID -> brokers
  promoted_at timestamptz
  created_at timestamptz
```

This is provenance for the existing Property Match, not a second Property Match register. The
fingerprint is calculated from Opportunity, exact requirement, run, candidate, latest shortlist
decision, policy and current Inventory/assessment evidence.

All new assessment and provenance tables receive SELECT/INSERT-only application grants and immutable
UPDATE/DELETE triggers. Migration `092` seeds no customer, Inventory, policy choice or private data.

## 4. Canonical eligibility contract

New module: `src/inventory-eligibility-domain.js`.

It will return a stable object:

```json
{
  "policyVersion": "r3b-eligibility-ranking-v2",
  "state": "eligible | needs_clarification | excluded",
  "reasons": [{"code": "controlled_code", "state": "not_met | missing", "label": "Readable reason"}],
  "checkedAt": "ISO-8601",
  "evidence": {},
  "evidenceHash": "sha256"
}
```

Hard exclusion checks:

- deleted Inventory;
- workflow not approved;
- verification not trusted or expired;
- status not `Available`;
- active reservation belonging to another pursuit;
- availability confirmation older than seven days; and
- an explicit Inventory transaction type that does not include the Opportunity transaction type.

`needs_clarification` checks:

- transaction type is not maintained;
- availability confirmation is absent;
- a required structured requirement fact is absent; or
- any must-have/exclusion declaration remains missing or not assessed.

Run generation may display and rank structurally comparable `needs_clarification` candidates, but
they are clearly marked and cannot be shortlisted or promoted until the named blocker is resolved.

The same service will replace duplicated eligibility logic in governed matching and Opportunity
operations and will be consumed by Release 3C preflight. SQL selection may prefilter obvious rows for
performance, but the domain result is the final business decision.

## 5. Deterministic scoring policy v2

Only structurally eligible or reviewable candidates enter scoring. Proposed maximum 100 points:

| Component | Points | Rule |
| --- | ---: | --- |
| Budget | 25 | Exact calculation against confirmed minimum/maximum; outside a declared hard maximum is excluded. |
| Area/Community | 20 | Exact governed Area/Community match; no fuzzy text identity. |
| Property type | 15 | Exact controlled type match. |
| Bedrooms | 15 | Exact confirmed range match. |
| Size | 10 | Exact confirmed square-foot range match when maintained. |
| Funding/payment fit | 5 | Structured funding and Inventory payment-plan compatibility only. |
| Timeline/handover fit | 5 | Structured timeline and handover evidence only. |
| Assessed preferences | 5 | Proportion of exact declared preferences assessed `met`; unassessed gives zero. |

Must-haves and exclusions are gates, not bonus/penalty points. Acceptable trade-offs are displayed but
do not increase score. Missing structured facts receive zero for that component and a visible
`missing` label; the denominator remains 100 so incomplete evidence cannot inflate a score.

Tie-break order is score descending, fewer missing/not-assessed facts, then stable Inventory
reference ascending. No input/database order is used.

The policy definition is inserted as immutable `r3b-eligibility-ranking-v2`. The code requests that
exact version; earlier policy/run evidence remains readable and is not retired or rewritten.

## 6. API contract

Existing endpoints remain backward-compatible.

### 6.1 Create and read a run

`POST /api/crm/leads/:leadId/inventory-matching-runs`

- Requires the exact current confirmed requirement.
- Locks the requirement and evaluated Inventory rows within one transaction.
- Uses policy v2 and saves exact structured evaluation/explanation evidence.
- Returns counts for eligible, needs-clarification and excluded candidates.

`GET /api/crm/leads/:leadId/inventory-matching-runs`

- Returns the latest 25 immutable runs and identifies the current run derived from the current
  requirement and latest run time.

`GET /api/crm/leads/:leadId/inventory-matching-runs/:runId`

- Returns frozen and current eligibility separately, score components, declaration assessments,
  latest decisions, feedback and any governed Property Match provenance.

### 6.2 Record/revise declaration assessment

`POST /api/crm/leads/:leadId/inventory-matching-runs/:runId/candidates/:candidateId/assessments`

Request:

```json
{
  "declarationKind": "must_have",
  "declarationIndex": 0,
  "result": "met",
  "evidenceKind": "customer_confirmation",
  "evidenceReference": "opaque-reference-if-applicable",
  "assessmentNotes": "Required review note",
  "expectedPreviousAssessmentId": null
}
```

The server derives declaration text/hash from the frozen requirement and rejects client-supplied
substitution, stale chains, unauthorized scope and self-contradictory evidence.

### 6.3 Existing decision endpoint

The existing candidate decision endpoint remains. A `shortlisted` decision additionally requires:

- current canonical eligibility `eligible`;
- all must-haves assessed `met`;
- all exclusions assessed `not_met`; and
- no newer run for a different current requirement version.

Reject and defer remain available with controlled reasons even where the candidate is excluded or
needs clarification, so the broker can preserve a reviewed outcome.

### 6.4 Promote reviewed shortlist

`POST /api/crm/opportunities/:opportunityId/governed-matches`

Request:

```json
{
  "expectedOpportunityVersion": 3,
  "requestId": "caller-generated-uuid",
  "selections": [
    {
      "runId": "uuid",
      "candidateId": "uuid",
      "shortlistDecisionId": "uuid"
    }
  ]
}
```

- One request accepts one to six candidates from the same run, Opportunity and exact requirement.
- The transaction locks Opportunity, requirement, candidates, decisions, assessments, Inventory and
  any existing Property Matches.
- Every selection is revalidated using the canonical eligibility service.
- It creates or returns the existing `(opportunity_id, listing_id)` Property Match.
- A new Property Match uses `match_source='governed'`, derives fit/rationale/exceptions from frozen
  deterministic evidence and starts `shortlisted` because the exact latest decision is shortlisted.
- Existing manual/rule Property Matches are not overwritten. The provenance link may attach only
  when the existing record represents the same requirement and has no conflicting governed origin;
  otherwise the request fails for explicit review.
- Repeating the same `requestId`/fingerprint returns the prior successful result.
- Any changed fact fails the complete atomic request; no partial shortlist is promoted.
- It does not reserve Inventory, change Opportunity stage automatically, schedule a viewing, create
  an Offer or prepare/send a communication.

## 7. UI contract

The current Customer/Lead matching section will be extended rather than creating another menu:

- exact requirement and confirmation banner;
- current-run indicator and prior-run history;
- separate Eligible, Needs clarification and Excluded filters;
- visible score-component reconciliation;
- Must-have, Exclusion, Preference and Trade-off assessment panel;
- frozen run state beside current eligibility state;
- controlled shortlist/reject/defer actions; and
- **Add reviewed shortlist to Opportunity** for one to six eligible shortlisted candidates.

The Opportunity page will show the governed run/candidate origin inside the existing Property Match
detail. Release 3C continues to consume the existing Property Match plus exact matching provenance.

No new dashboard, work queue or Administrator maintenance page is introduced.

## 8. Permissions

- Lead/Opportunity owner or assigned Sales Agent: create runs, assess, decide and promote inside
  writable scope.
- Managed-team Manager: the same actions inside existing managed-team scope.
- Director and full Administrator: organization-wide existing authority.
- Read-only roles cannot create evidence or promote.
- No actor receives access to another Customer/Opportunity merely because the same Inventory was
  considered or excluded.

Ordinary broker review does not use maker-checker. Every decision and promotion remains attributed
and audited.

## 9. Deterministic explanation and AI boundary

Gate 2 recommends deterministic explanations only for this completion package. They are sufficient
for every eligibility, score, missing-fact, trade-off and exclusion decision and work when AI is
unavailable.

AI may be considered later as a separately gated wording aid. It would receive only minimized frozen
evidence and could not change facts or decisions. Migration `092` therefore adds no AI narrative
table, model field or provider dependency.

## 10. Verification contract

Gate 3 must add focused coverage for:

- transaction-type and size validation without legacy backfill;
- all canonical eligibility outcomes at every consumer boundary;
- exact scoring, missing-fact behavior and stable tie-breaks;
- immutable assessment creation/revision and declaration-hash binding;
- must-have/exclusion promotion gates;
- current-versus-historical run display;
- one-to-six atomic promotion, duplicate request replay and concurrency conflict;
- non-overwrite of existing manual/rule Property Matches;
- Release 3C compatibility using the governed origin;
- role/scope denial and private-fact non-disclosure;
- AI-disabled deterministic operation; and
- absence of portal, provider, publication, external request and lifecycle side effects.

Gate 3 evidence must include focused tests, the complete repository suite, migration-chain rehearsal,
syntax/diff checks and a loopback-only GET review using synthetic records.

## 11. Single-clone-deployment boundary

This local package is being designed for inclusion in one future consolidated Production/R2-clone
deployment candidate. Gate 2 approval does not authorize that deployment.

Before any clone action, the complete candidate must pass:

1. local Gate 3 review and owner approval;
2. local Gate 4 completion and code freeze;
3. ordered rehearsal of every unapplied migration on a production-shaped local restore;
4. complete application/migration compatibility and rollback review;
5. one consolidated deployment manifest and checksum set;
6. one end-to-end synthetic UAT plan; and
7. separate explicit owner authorization for the clone deployment.

The migrations remain individually ordered and auditable inside the one deployment package; they are
not manually collapsed into one SQL file.

## 12. Approval requested

The NYSA owner approved Gate 2 on 14 August 2026 by directing the work to move ahead. This authorized
local Gate 3 implementation of this exact contract, including creation of unapplied migration `092`,
application/domain/UI work, focused tests and the synthetic review page. It does not authorize
applying any migration, connecting to an external service, packaging, restarting or changing CRM
Test, Production, R2, cPanel or the Production clone.
