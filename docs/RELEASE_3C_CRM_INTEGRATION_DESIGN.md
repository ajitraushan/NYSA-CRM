# NYSA CORE Release 3C — CRM Integration Design Gate

**Design date:** 12 August 2026 (Asia/Dubai)  
**Classification:** Locally implemented and owner-accepted — migration unapplied; no packaging or deployment authorized  
**Workspace:** `canonical-worktree`  
**Proposed package:** Release 3C governed customer selection, response and CRM follow-up integration

**Gate 1:** Approved by owner on 12 August 2026 (Asia/Dubai). Approval covers the integration
boundary and authoritative-record decisions in this document; it is not deployment authorization.

**Gate 4:** Accepted by owner on 13 August 2026 (Asia/Dubai). Release 3C is complete as a local
functional package. This acceptance does not authorize migration application, packaging or deployment.

## 1. Owner decision requested

Approve this package for local implementation in four reversible slices:

1. strengthen the existing Opportunity property-share records so they preserve the accepted
   broker-reviewed shortlist and share-time preflight evidence;
2. capture controlled, property-level customer responses as immutable CRM evidence;
3. create exactly one authoritative existing CRM Task for each response, idempotently and in the
   same transaction as the response;
4. expose read-only Opportunity and management reporting from exact stored events and Tasks.

Approval would authorize local code, a proposed migration, local UI changes and automated tests.
It would not authorize applying a migration to any environment, sending a message, resolving a
recipient, publishing a card, connecting a provider, or deploying/restarting anything outside the
local workspace.

## 2. Why this is the next complete offline package

The four accepted Release 3C domain contracts already define the functional rules:

- `r3c-customer-shortlist-v1` prepares at most six reviewed, eligible, customer-safe properties;
- `r3c-governed-share-preflight-v1` rechecks policy, eligibility and exact fact drift and produces
  `prepared_not_sent` evidence with a fifteen-minute lifetime;
- `r3c-next-action-v1` deterministically translates a response into broker work; and
- `r3c-share-response-mis-v1` reports only exact event evidence and reconciles each response to the
  existing Task model.

The CRM already has the correct authoritative roots: `opportunities`, `property_matches`,
`opportunity_property_shares`, `opportunity_property_share_items`, `tasks`, `viewings` and versioned
`lead_requirements`. Integration can therefore be designed and tested completely offline without a
WhatsApp provider or any other external service.

## 3. Reuse and authority decisions

| Concern | Authoritative record | Integration rule |
|---|---|---|
| Customer pursuit | Existing `opportunities` | No parallel customer journey or stage model. |
| Candidate property | Existing `property_matches` | Every selected property must belong to the Opportunity and retain its match identity. |
| Prepared selection | Existing `opportunity_property_shares` | Evolve this table into the governed package header; do not add a second shortlist/share header. |
| Prepared property | Existing `opportunity_property_share_items` | Preserve the exact accepted customer-safe snapshot, eligibility/preflight evidence and property identity. |
| Customer response | Existing immutable `inventory_match_feedback`, extended with governed share-response provenance | Separate response records are required because a customer may respond differently to several properties; no parallel feedback ledger. |
| Broker follow-up | Existing `tasks` | Exactly one governing Task per immutable response; no Release 3C queue and no second SLA clock. |
| Opportunity next action | Existing `opportunities.next_action` and `next_action_due_at` | Optional display pointer synchronized to the highest-priority open response Task; Task remains authoritative. |
| Viewing | Existing `viewings` | A viewing request creates a Task only. Scheduling remains an explicit broker action in the existing viewing workflow. |
| Requirement change | Existing versioned `lead_requirements` | Possible/confirmed changes create review work only. No automatic overwrite or new version. |
| Reporting | Exact share events, response evidence and Tasks | No inferred sent/opened/converted stage. Missing evidence remains missing. |

The existing Release 2.6 share endpoint currently accepts recipient contact data during preparation,
creates a thirty-day public token, allows up to ten properties and stores mutable response fields.
Those behaviours do not satisfy the accepted Release 3C boundary. The integration must preserve
legacy records for history while routing new governed packages through the stricter contract.

## 4. Proposed governed persistence

### 4.1 Existing share header additions

Add nullable governed fields to `opportunity_property_shares`, leaving legacy rows readable:

- `contract_version` — `r3c-customer-shortlist-v1` for new governed rows;
- `preflight_version` — `r3c-governed-share-preflight-v1`;
- `matching_run_reference`, `requirement_id`, `requirement_version_no`;
- `shortlist_evidence_hash`, `preflight_evidence_hash` with unique constraints for retry safety;
- `policy_decision_reference` and its non-contact opaque subject/scope references;
- `template_reference`, `prepared_at`, `preflight_expires_at`;
- `governed_status`, initially and locally limited to `prepared_not_sent` or `cancelled`;
- `version` for optimistic concurrency.

No new governed preparation endpoint may accept or return a phone number, email address, public
token, provider identifier or authority/contact detail. Existing legacy contact columns remain only
for backward-compatible reads of old records and are never populated by the new route.

### 4.2 Existing share-item additions

Each new governed `opportunity_property_share_items` row retains:

- the existing `property_match_id` and internal `listing_id`;
- exact customer-safe `property_snapshot` from the accepted contract;
- `property_reference` for stable display and evidence reconciliation;
- eligibility check time and immutable eligibility evidence hash;
- the shortlist property evidence hash; and
- a sequence number unique within the package.

The governed route accepts no external/co-broker provisional property because the accepted
shortlist eligibility contract is currently defined against trusted Internal Inventory. Expanding
that scope requires a separate owner-approved contract.

### 4.3 New append-only event and response evidence

Add `opportunity_property_share_events` for exact lifecycle evidence:

- event type, currently `prepared` and `cancelled` only in Release 3C local integration;
- share, optional share item, occurred time, actor and immutable evidence hash;
- source fixed to `crm_local` for this package; and
- an immutability trigger blocking update/delete.

Extend the existing immutable `inventory_match_feedback` table for governed responses:

- one immutable row per recorded action, linked to share item and its existing matching candidate;
- controlled outcome, notes, occurred time, recording actor and source (`manual_fallback` initially);
- controlled not-suitable reason, preference impact and optional change detail;
- response contract version and immutable evidence hash; and
- an immutability trigger blocking update/delete.

The database must not impose one lifetime response per property: later customer feedback is valid.
Retry identity is the immutable response evidence hash, so resubmitting the same evidence returns the
same response and Task, while genuinely new evidence produces a new response.

### 4.4 Structured Task provenance

Add a one-to-one provenance table rather than hiding identifiers in `tasks.details`:

- `task_id` unique and linked to the existing Task;
- `response_id` unique and linked to immutable response evidence;
- response evidence hash, Opportunity, property match and share references;
- translation policy version and created time.

Task `task_type` gains `customer_response_follow_up`. The existing Task fields remain authoritative
for assignee, priority, due time, status, completion, cancellation and outcome.

## 5. API and transaction design

### Slice A — Prepare governed package

`POST /crm/opportunities/:id/governed-property-shares`

- requires writable Opportunity scope;
- accepts selected existing property-match IDs, broker review confirmation and the accepted
  non-contact policy/preflight inputs;
- locks the Opportunity/matches and rereads live Inventory;
- executes the accepted shortlist then preflight contracts server-side;
- rejects more than six properties, rejected/untrusted/stale/reserved Inventory, fact drift,
  unapproved media/evidence, expired policy or mismatched scope;
- writes the share header, items and exact `prepared` event atomically; and
- returns only the governed package and evidence, with `automaticSend=false` and no public URL.

The preflight evidence hash is the idempotency key. Concurrent identical requests converge on the
same stored package; a hash collision with different canonical content fails closed.

### Slice B — Record a controlled response and Task

`POST /crm/opportunities/:id/governed-property-shares/:shareId/responses`

- requires writable Opportunity scope and an existing property in the immutable package;
- validates the accepted response contract;
- locks the response identity and governing Opportunity;
- inserts or resolves the immutable response by evidence hash;
- creates exactly one existing `tasks` row and one structured provenance row;
- maps assignee to the current responsible Opportunity owner, failing closed if none is active;
- uses the approved priority and due-time mapping from the checkpoint; and
- optionally updates the Opportunity next-action display pointer only when this open Task is earlier
  or higher-priority than the current response-derived pointer.

Response and Task creation are one database transaction. A retry returns the existing pair. Neither
operation changes the Opportunity stage, property-match state, Inventory status or reservation.

### Slice C — Broker workflow bridges

- The existing My Tasks and Diary endpoints surface `customer_response_follow_up` Tasks without a
  new queue.
- Opportunity detail shows the immutable response and governing Task state.
- `viewing_requested` offers an explicit link to the existing viewing form; it does not create a
  viewing automatically.
- `more_options` and property-only rejection link back to existing matching.
- possible/confirmed preference change links to the existing requirement-version workflow only
  after the broker reviews the evidence.
- Task completion/cancellation continues through the existing Task endpoint and requires its
  existing outcome evidence.

### Slice D — Read-only audit and MIS

- Opportunity detail reads package, item, exact event, response and Task reconciliation together.
- A scoped management endpoint reports prepared packages, exact recorded responses, response age,
  missing Task (which should be zero after atomic creation) and overdue Task.
- `shared`, `delivered`, `opened`, provider response and provider failure stay unavailable until
  Release 3D provides immutable external evidence.
- No lifecycle event is inferred from a later event.

## 6. Permissions and privacy

- Read access follows existing Opportunity/lead scope.
- Only brokers with existing Opportunity write permission may prepare or cancel a package or record
  a manual response.
- A broker cannot select a different assignee through the response endpoint; normal Task
  reassignment remains governed by existing lead/team permissions.
- Read-only management aggregates require the same manager/admin scope used by current dashboards.
- New governed records contain internal opaque IDs and customer-safe property facts only.
- No new route requests, logs, audits, returns or stores recipient contact data, owner data or
  authority information.
- Notes retain the existing controlled 1,000-character limit and must never be copied into broad MIS
  aggregates.

## 7. UI workflow for local integration

1. On an eligible Opportunity, the broker selects one to six already-reviewed property matches.
2. A review screen shows exact customer-safe facts, match reasons, trade-offs, missing facts,
   approved floor plans and source-dated market evidence.
3. The broker confirms the review; CORE performs the final fifteen-minute preflight and stores a
   `Prepared — not sent` package.
4. The package offers no send button in this Release 3C integration. The existing external launcher
   remains separate legacy behaviour and is not silently invoked.
5. A broker can record a controlled manual-fallback response against each property.
6. CORE immediately shows the one authoritative Task, priority, due time and responsible broker.
7. Opportunity history and MIS show exact evidence and clearly label unavailable provider states.

## 8. Verification gate

Local implementation is complete only when tests prove:

- all accepted v1 contract fields and guards survive persistence and API round trips;
- six-property maximum and Internal-Inventory-only boundary;
- current scope and permissions on every read/write route;
- stale/unavailable/reserved/unapproved/fact-drift failures under transaction locks;
- identical prepare retry returns one share; concurrent prepare produces one share;
- identical response retry returns one response and one Task; concurrent response produces one of
  each;
- every response mapping has the approved Task subject, priority and due time;
- no automatic viewing, requirement rewrite, Opportunity stage change, match mutation, Inventory
  mutation or reservation;
- Task/response rollback together on any failure;
- historical legacy shares remain readable;
- MIS counts exact events only and detects missing/overdue Task reconciliation; and
- focused tests plus the complete repository suite pass locally.

The migration remains proposed and unapplied. Local browser review follows implementation and test
completion as a separate approval gate.

## 9. Explicit exclusions

- Native WhatsApp, email or any provider delivery.
- Recipient resolution or storage in the governed path.
- Public/secure card hosting, tokens or external URLs.
- Delivery/read/failure webhooks, retry workers or provider idempotency.
- Automatic viewing creation, requirement version creation, rematching or conversion.
- Offer, booking, reservation or Inventory status changes.
- Property Finder or any other external lead/listing source.
- Any deployment, environment migration, package, restart or external-service change.

## 10. Approval gates

- **Gate 1 — integration boundary and data authority:** approve/revise this document.
- **Gate 2 — migration/API contract:** review exact proposed schema, endpoints, permissions and
  idempotency tests before CRM UI material implementation.
- **Gate 3 — local CRM workflow:** review the working local screens after focused and full tests.
- **Gate 4 — package completion:** accept the local functional package and checkpoint evidence.

No later gate implies deployment authorization.
