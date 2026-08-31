# NYSA CORE Release 3C — Local Functional Modules Checkpoint

**Checkpoint date:** 8 August 2026 (Asia/Dubai)  
**Classification:** Local functional package complete and owner-accepted — migration unapplied; not packaged, deployed or production-ready  
**Workspace:** `canonical-worktree`  

## Purpose

This checkpoint preserves two small, independently testable Release 3C functional modules developed
while the hosted CRM environment was unavailable. They establish reviewed business behaviour before
database, CRM UI, WhatsApp or deployment integration.

## Agile module handoff rule

An accepted functional module is a versioned upstream contract, not a disposable mock. Every later
module must consume or faithfully map that contract and must not recreate a reduced first-version
payload. Before review, a downstream contract test must prove that all previously accepted fields,
guards, unavailable states and decision boundaries survive the handoff. Any deliberate omission or
change requires an explicit owner decision and checkpoint update; passing isolated tests alone is not
sufficient evidence of continuity.

## Module 1 — Customer Shortlist and Response

- Policy version: `r3c-customer-shortlist-v1`
- Domain: `src/customer-shortlist-domain.js`
- Local prototype: `tools/customer-shortlist-local/`
- Local review URL while its localhost server is running: `http://127.0.0.1:3221/`
- Tests: `test/customer-shortlist-domain.test.js` and `test/customer-shortlist-local.test.js`

Accepted functional decisions:

- A customer may express interest in more than one property.
- Every property response retains separate immutable evidence; a combined follow-up may be proposed.
- Customer-safe snapshots include only approved, rights-cleared floor-plan references.
- Market evidence must be approved, source-labelled and date-bound; missing evidence is shown as
  unavailable and is never invented.
- `Not suitable` requires a controlled reason and explicit requirement impact.
- Property-specific rejection does not change the requirement.
- Possible or confirmed preference changes require agent review; a confirmed change proposes a new
  governed requirement version rather than overwriting the current version.
- The internal handoff is shown as proposed to the current responsible agent CRM work queue and is
  explicitly not sent or applied.
- Interest, viewing and response capture do not reserve Inventory or change Opportunity status.
- Existing reservation behaviour remains downstream of the existing booking-confirmation controls.

## Module 2 — Customer-response to existing work-item translation

- Policy version: `r3c-next-action-v1`
- Domain: `src/broker-next-action-domain.js`
- Exploratory local prototype: `tools/broker-next-action-local/`
- Local review URL while its localhost server is running: `http://127.0.0.1:3222/`
- Tests: `test/broker-next-action-domain.test.js` and `test/broker-next-action-local.test.js`

**Review decision:** this must not become a separate production queue. The prototype is retained only
to validate response-to-action translation, working context and prioritization. Authoritative work
must be created in the existing CRM `tasks` work-item model and surfaced through the already-built
My Tasks, My Diary, Opportunity and Immediate Attention views.

Accepted translation design:

- Governed customer responses produce deterministic broker actions, due times and ageing states.
- Overdue and urgent work ranks ahead of routine follow-up.
- Every action carries its responsible agent, Opportunity, requirement, property, source response,
  immutable evidence reference, explanation and missing working context.
- Start, defer and completion controls in the exploratory prototype produce preview evidence only.
- The existing Task remains the authoritative work item for assignment, due time, status, completion,
  cancellation and escalation. There must be no parallel Release 3C queue or second SLA clock.
- The Opportunity next-action label and due time may be synchronized transactionally as a display
  pointer to the governing open Task; it must not become an independent duplicate action.
- My Tasks owns open/in-progress/completed work and due buckets; My Diary and Immediate Attention
  consume the same Task instead of receiving separate Release 3C records.

### Required task mapping at later integration

| Response evidence | Existing Task subject | Priority | Due | Downstream context |
|---|---|---:|---:|---|
| Viewing requested | Coordinate property viewing | urgent | 2 hours | Existing viewing workflow |
| Interested | Follow up on customer interest | high | 4 hours | Selected property references |
| Information required | Prepare requested property information | high | 4 hours | Missing facts and approved evidence |
| More options | Review requirement and prepare more options | normal | 8 hours | Governed rematch |
| Not suitable — property only | Record property feedback and continue matching | normal | 8 hours | Requirement unchanged |
| Possible preference change | Review possible preference change | high | 8 hours | Agent review; no automatic rewrite |
| Confirmed preference change | Prepare a new governed requirement version | high | 4 hours | Versioned requirement workflow |

The current Task model already supplies `lead_id`, `contact_id`, `subject`, `details`, `assignee_id`,
`priority`, `status`, `due_at`, `outcome` and completion evidence. Later integration must add or use a
governed provenance link for the response evidence hash, Opportunity and property references rather
than hiding those identifiers in free text. Task creation and any Opportunity display-pointer update
must be one idempotent transaction.

## Module 3 — Governed share-time preflight

- Policy version: `r3c-governed-share-preflight-v1`
- Domain: `src/governed-share-preflight-domain.js`
- Local prototype: `tools/governed-share-preflight-local/`
- Local review URL while its localhost server is running: `http://127.0.0.1:3223/`
- Tests: `test/governed-share-preflight-domain.test.js` and
  `test/governed-share-preflight-local.test.js`
- Status: **APPROVED — NOT INTEGRATED**.
- Owner decision: approved locally on 2026-08-08 (Asia/Dubai).
- Approval scope: the complete broker-prepared, not-yet-sent customer-review package described
  below. This approval does not authorize CRM integration, deployment or message delivery.

Accepted functional design:

- Reuse the existing fail-closed communication-policy decision for authorization, channel
  eligibility, consent, restriction, subject eligibility, purpose, scope and expiry.
- Revalidate every selected property against live Inventory immediately before a future share.
- Block if Inventory is unavailable, reserved, unapproved, untrusted, expired or missing.
- Compare exact customer-visible facts with the broker-reviewed shortlist and block if any have
  changed; a fresh broker review is required rather than silently refreshing the card.
- Prepare only customer-safe property-card fields and approved floor-plan references.
- Preserve the complete agreed customer-review package: property highlights, trade-offs, items to
  confirm, approved floor-plan metadata, and source-dated market comparison/recent performance.
- Bind the shortlist, policy decision, opaque customer/Opportunity/agent references, exact cards,
  template reference, timestamp and fifteen-minute expiry into deterministic evidence.
- Successful output is `prepared_not_sent`; the connector remains disabled and no provider or
  recipient contact value is available to this module.
- Reservation and Opportunity status are unchanged.

## Module 4 — Share and response audit/MIS

- Policy version: `r3c-share-response-mis-v1`
- Domain: `src/share-response-mis-domain.js`
- Local prototype: `tools/share-response-mis-local/`
- Local review URL while its localhost server is running: `http://127.0.0.1:3224/`
- Tests: `test/share-response-mis-domain.test.js` and `test/share-response-mis-local.test.js`
- Status: **ACCEPTED AS LOCAL FUNCTIONAL PROTOTYPE — NOT INTEGRATED**.
- Owner review decision: retain the current review form as of 2026-08-08 (Asia/Dubai); it is not
  approved as the final CRM interface and may be redesigned during integration without weakening
  the accepted event-evidence, property-response or authoritative-Task controls.

Proposed functional design:

- Consume the approved Module 3 `prepared_not_sent` package without changing its property identity.
- Count prepared, shared, delivered, opened, responded, viewing-requested and converted only when
  that exact event has immutable evidence; never infer one lifecycle stage from another.
- Preserve separate property-level responses when a package contains more than one property.
- Reconcile every governed response to the existing authoritative CRM Task and expose a missing or
  overdue follow-up gap; do not create a parallel action queue or second SLA clock.
- Distinguish the current approved prepared/not-sent package from synthetic lifecycle demonstrations.
- Use opaque references and synthetic evidence only; collect no recipient or customer contact value.
- Produce read-only local MIS. It does not send, reserve Inventory, change Opportunity status or
  write to CRM.

## Deferred integration

The following work is deliberately deferred and must be separately designed, authorized, implemented
and tested:

- CRM database schema, migrations, APIs, permissions and production UI integration.
- WhatsApp Business delivery, inbound webhook correlation, delivery/read/failure events and retries.
- Idempotent provider-event processing and manual-fallback reconciliation.
- Idempotent mapping into the existing authoritative Task model, including structured provenance.
- Provider dispatch, recipient resolution and secure-card hosting after share preflight.
- Viewing, requirement-versioning, matching, Offer, booking and reservation workflow integration.
- MIS aggregation and production reporting.

WhatsApp is intended to become the primary response source after Release 3D integration. Manual entry
remains a controlled fallback. Ambiguous inbound replies must enter agent review and must never be
guessed or used to rewrite a requirement automatically.

## Safety and environment record

- Synthetic data only.
- Localhost-only servers bound to `127.0.0.1`.
- Browser policy blocks outbound connections with `connect-src 'none'`.
- No database, CRM Test, Production, R2, Property Finder or external-provider request was made.
- No credential, private contact, owner or authority information is present.
- No Inventory was reserved and no Opportunity or requirement status was changed.
- These files are not a deployment script, migration, release package or authorization to deploy.

## Verification

- Customer shortlist focused verification after the latest correction: 11/11 passed.
- Broker next-action focused verification: 7/7 passed.
- Governed share-preflight focused verification: 8/8 passed.
- Share and response audit/MIS focused verification: 9/9 passed.
- Complete repository regression suite at this checkpoint: **610/610 passed**.

## Integration entry gate

Before integration, the owner must review and accept each module's functional behaviour. Integration
must then map these policy contracts to authoritative CRM records without weakening their guards,
must include idempotency and concurrency tests, and must preserve existing booking-confirmation and
Inventory-reservation controls.

## Local CRM integration checkpoint — 13 August 2026

- Gate 1 integration boundary and Gate 2 migration/API contract were approved by the owner.
- Gate 3 Opportunity UI implementation was approved and completed locally.
- Existing share headers/items, immutable matching feedback and authoritative CRM Tasks are reused;
  no parallel queue or response ledger was created.
- Governed packages remain `prepared_not_sent`, contain no recipient/contact value or public token,
  and expose no send or provider control.
- Server-derived policy, final Inventory eligibility, exact shortlist decision chain, canonical
  retry fingerprints and transaction locks fail closed.
- Every response creates exactly one existing CRM Task and structured immutable provenance in the
  same transaction.
- The Opportunity UI shows customer-safe facts, controlled property responses, governing Task state
  and immutable cancellation history while keeping the legacy launcher visibly separate.
- No automatic viewing, requirement rewrite, rematch, stage change, Inventory mutation, Offer,
  booking or reservation occurs.
- Migration 085 remains unapplied. No CRM Test, Production, R2, Property Finder or external service
  was accessed or changed.
- Focused integrated verification after Gate 3: **43/43 passed**.
- Complete repository regression after Gate 3: **786/786 passed**.
- A migration-free synthetic review surface is available locally at `http://127.0.0.1:3230/` and
  passed its loopback-only, GET-only and outbound-network-blocked checks **2/2**.
- Gate 4 was accepted by the owner on 13 August 2026 (Asia/Dubai). Release 3C is complete locally;
  migration application, packaging and deployment remain explicitly unauthorized.
