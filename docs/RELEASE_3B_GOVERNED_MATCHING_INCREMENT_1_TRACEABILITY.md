# Release 3B governed matching — increment 1 traceability

Status: consolidated CRM Test candidate `2.1.0-dev.115` is authorised for packaging. No deployment or migration execution on CRM Test, Production or R2 is authorised by packaging.

## Implemented evidence

| Frozen requirement | Evidence in this increment | Boundary retained |
| --- | --- | --- |
| R3B-AI-MATCH-49 | A shortlist decision locks the frozen candidate and live Inventory row, recalculates the current eligibility result and refuses an ineligible shortlist. | The decision creates no `property_matches`, booking, reservation or availability guarantee. Remaining eligibility rules and shared-boundary extraction are later increments. |
| R3B-EXPLAINABILITY-50 | The approved `r3b-eligibility-v1` policy is durably registered; every decision records a controlled reason, notes, live check time and live eligibility evidence. | AI explanation audit, missing/not-assessed separation and complete exclusion semantics are not claimed complete. |
| R3B-FEEDBACK-51 | Append-only `inventory_match_decisions` and `inventory_match_feedback` evidence is tied to the exact immutable candidate/run. Decision revisions form an optimistic, linear immutable chain. | Feedback influences no previous run and does not automatically alter the requirement, score, Inventory or operational Opportunity records. |
| Website separation | Run and decision APIs continue to expose `websiteSuggestionsIncluded:false`; UI repeats that website AI suggestions are excluded. | Website evidence confirmation and conflict resolution remain separate future work. |

## Targeted UAT instructions

1. Open Customer 360 for a writable Lead with a current structured requirement and choose **Match available Inventory**.
2. Confirm the run shows eligible/excluded counts, policy version, checked time, evidence hash and the advisory/no-commitment notice.
3. Shortlist one eligible property with a controlled reason and notes. Confirm success states that Inventory was revalidated and that no Property Match or reservation was created.
4. Change that decision to Defer or Reject using a new reason. Reload the exact run API and confirm both immutable decisions remain in sequence and only the newest is presented as latest.
5. In a second browser/session, open the same candidate before step 4 and submit a stale decision. Confirm a `409` reload message prevents a forked decision chain.
6. Change the Inventory status or create an active reservation through the governed operational workflow, then attempt a new shortlist decision. Confirm it is rejected with current eligibility reasons while the prior run remains readable.
7. Record customer-reported property feedback such as **More options requested**, with a controlled reason and notes. Reload and confirm the immutable feedback remains attached to the exact candidate.
8. Confirm none of these actions creates a row in `property_matches` or `bookings`, changes listing availability, sends a message, or includes website AI suggestions.

## Validation gates for this increment

- focused Release 3B/domain/static tests;
- JavaScript syntax checks for the domain, route, server and browser app;
- complete `npm test` suite;
- isolated PostgreSQL/WASM rehearsal of the complete 001–076 chain, including explicit verification of the 075–076 tables, policy foreign key and immutable triggers.

Verified locally on 2026-08-02: focused tests passed 16/16, complete suite passed 407/407, syntax and diff checks passed, and the isolated PGlite PostgreSQL/WASM 0.5.4 rehearsal reached 76 migrations with `076_release3b_match_decisions_and_feedback.sql` latest. No NYSA environment was contacted. The rehearsal also confirmed all five Release 3B tables, five immutable trigger names, the active policy row, policy foreign key and immutable-policy rejection. A native PostgreSQL restore rehearsal remains a pre-deployment gate.

## Increment 2 — exact requirement authority

- Migration `077_release3b_requirement_confirmation.sql` adds immutable field-level website conflicts, one immutable resolution per conflict and one immutable confirmation per exact requirement version.
- Continued website journeys declare only materially changed supplied values against the prior governed version.
- Confirmation freezes and SHA-256 hashes the exact governed requirement fields.
- An unresolved conflict blocks confirmation. `requires_new_version` is explicit resolution evidence but keeps that version ineligible for confirmation and matching.
- Matching holds the exact current requirement and Inventory rows in one transaction and refuses unconfirmed, unresolved or correction-required versions.
- The requirements UI exposes source, authority status, conflict values/resolution and the exact-version confirmation action.

Verified locally on 2026-08-02: focused Release 3B/dependency tests passed 25/25, the pre-package complete suite passed 410/410, and the final packaged-candidate complete suite passed 412/412. Syntax checks passed, and isolated PGlite PostgreSQL/WASM 0.5.4 applied the complete 001–077 chain. The rehearsal confirmed eight Release 3B tables, eight immutable triggers, required FK/uniqueness constraints and SELECT/INSERT-only application-role grants for the three authority tables. No NYSA environment was contacted.

## Release 3B gaps closed by the completion package

- Remaining eligibility rules, reusable shared boundary, downstream revalidation and deterministic
  run evidence are implemented locally in the canonical v2 service.
- Declared must-have/exclusion/trade-off scoring and missing-versus-not-assessed presentation are
  implemented locally without silently converting free text into rules.
- Full exclusion drill-down, deterministic explanations and run-history/current-status UI are
  implemented locally. No AI provider dependency or narrative persistence was added.
- Reviewed-shortlist promotion into the existing operational Property Match workflow is implemented
  locally with one-to-six atomic, idempotent selections.
- Native PostgreSQL restore rehearsal, migration application, CRM Test deployment/UAT and later
  promotion approval remain environment-readiness activities outside local functional completion.

## Completion planning initiated

The local/offline functional gaps above are consolidated into the four-increment Gate 1 proposal in
`RELEASE_3B_COMPLETION_GATE_1.md`. Gate 1 was owner-approved on 14 August 2026. The exact proposed
schema/API boundary is documented in
`RELEASE_3B_COMPLETION_GATE_2_MIGRATION_API_CONTRACT.md`. Gate 2 was owner-approved on 14 August
2026. Local implementation and owner-approved review evidence are recorded in
`RELEASE_3B_COMPLETION_GATE_3_LOCAL_REVIEW.md`; migration `092` is created locally and unapplied.
The Gate 4 freeze is recorded in `RELEASE_3B_COMPLETION_GATE_4_COMPLETION.md`. All four completion
records exclude native restore, CRM Test, portals and every external integration.
