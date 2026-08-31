# NYSA CORE Release 3C — Gate 2 Migration and API Contract

**Contract date:** 12 August 2026 (Asia/Dubai)  
**Status:** Approved and implemented locally — migration not applied  
**Depends on:** Approved Release 3C Gate 1 integration boundary  
**Proposed future migration:** `085_release3c_governed_share_response.sql`  
**Reviewable SQL:** `docs/schema-proposals/release3c_crm_integration.sql.proposed`

**Gate 2 approval:** Approved by owner on 12 August 2026 (Asia/Dubai). Local backend implementation
was completed on 13 August 2026; migration 085 remains unapplied.

## 1. Gate 2 decisions

Owner approval is requested for these exact technical decisions:

1. Promote only `communication_policy_decisions` from the provider-neutral communication design
   into this Release 3C package. It stores opaque CRM references and pass/fail evidence only.
   Communication attempts, payloads, recipients, outbox, provider events and delivery remain 3D.
2. Reuse and extend `opportunity_property_shares` and `opportunity_property_share_items`. Legacy
   Release 2.6 rows and public links remain readable; no new governed row contains contact values or
   a public token.
3. Reuse and extend immutable `inventory_match_feedback` as the customer-response evidence ledger.
   Do not create a second response/feedback table.
4. Use the existing `tasks` table as the sole work item and add immutable structured provenance.
5. Limit this local package to Internal Inventory and `prepared_not_sent`; connected states remain
   explicitly unavailable.

## 2. Server-derived policy decision

The prepare request supplies no policy booleans and no contact value. Under one transaction the
server derives the five accepted policy checks from authoritative CRM state:

| Check | Pass condition |
|---|---|
| `actorAuthorized` | Authenticated internal CRM broker has existing write permission for the Opportunity. |
| `channelEligible` | The Opportunity contact has a referenced Phone channel with WhatsApp enabled, verification `format_valid` or `verified`, and restriction `allowed`. Values are never selected into the API response or audit metadata. |
| `consentPermits` | A current executed, effective, unexpired `marketing_agreements` record explicitly contains `transactional_share` in `consent_scope` and WhatsApp in `permitted_channels`. The stored policy decision retains only that agreement's opaque ID as evidence. |
| `restrictionClear` | Contact `do_not_contact=0`, lifecycle is `active`, and selected channel restriction is `allowed`. |
| `subjectEligible` | Contact is active, not archived/merged/anonymized, belongs to the Opportunity, and Opportunity is not closed. |

Any false or missing check denies preparation. Policy validity is fifteen minutes from evaluation
and can never outlive the share preflight. The decision uses policy version
`r3c-transactional-share-policy-v1` and is immutable.

## 3. Exact API contracts

All routes require the existing authenticated internal-CRM middleware. Unknown or out-of-scope IDs
return the same not-found/forbidden behaviour as existing Opportunity routes and never disclose a
record from another scope.

### 3.1 Prepare governed property selection

`POST /crm/opportunities/:id/governed-property-shares`

Request:

```json
{
  "expectedOpportunityVersion": 7,
  "title": "Property selection",
  "brokerReviewConfirmed": true,
  "selections": [
    {
      "propertyMatchId": "opaque-uuid",
      "matchingCandidateId": "opaque-uuid",
      "matchDecisionId": "opaque-uuid"
    }
  ]
}
```

Rules:

- `expectedOpportunityVersion` is a positive integer and must equal the locked Opportunity version.
- `title` is required, trimmed and at most 120 characters.
- `brokerReviewConfirmed` must be exactly `true`.
- `selections` contains one to six unique rows.
- Every match belongs to the Opportunity and references Internal Inventory.
- Every candidate belongs to one governed matching run for the same Opportunity/current requirement,
  points to the same listing as its property match, and is `eligible`.
- Every decision is the latest decision for its candidate and is `shortlisted`.
- The matching run's requirement is the Opportunity's current, non-superseded requirement and its
  stored version equals the Opportunity detail version.
- All selected Inventory rows are locked in deterministic listing-ID order and revalidated using
  the accepted eligibility boundary.
- The domain functions prepare the shortlist and preflight server-side. Client snapshots, policy
  outcomes, hashes, eligibility results or card facts are never trusted.

Success: `201 Created`. Exact replay may return `200 OK` with `idempotentReplay=true`.

```json
{
  "share": {
    "id": "opaque-uuid",
    "opportunityId": "opaque-uuid",
    "status": "prepared_not_sent",
    "contractVersion": "r3c-customer-shortlist-v1",
    "preflightVersion": "r3c-governed-share-preflight-v1",
    "shortlistEvidenceHash": "sha256",
    "preflightEvidenceHash": "sha256",
    "preparedAt": "ISO-8601",
    "expiresAt": "ISO-8601",
    "templateReference": "property_selection_transactional_v1",
    "automaticSend": false,
    "connectorEnabled": false,
    "version": 1,
    "items": []
  },
  "idempotentReplay": false
}
```

Each returned item is the accepted customer-safe property snapshot and opaque internal references.
The response never includes channel/contact values, recipient identity, message content, a public
token/URL, owner/authority data, or provider fields.

Transaction order:

1. lock Opportunity and verify optimistic version/write scope;
2. lock matching run, candidates and latest decisions in stable order;
3. lock current requirement and selected Inventory in stable order;
4. read policy sources without selecting channel values into application output;
5. evaluate and persist the immutable allowed policy decision;
6. execute shortlist and preflight contracts;
7. insert-or-resolve by a canonical request fingerprint derived from Opportunity/version, title and
   ordered opaque selection references; the time-bound preflight hash remains evidence, not a retry key;
8. write header, immutable items and exact `prepared` event; and
9. audit hashes and opaque record IDs only, then commit.

An identical request fingerprint with different canonical content is `409 evidence_collision`; no partial data is
committed.

### 3.2 Cancel an unsent governed package

`POST /crm/opportunities/:id/governed-property-shares/:shareId/cancel`

Request:

```json
{ "expectedVersion": 1, "reason": "Broker withdrew this prepared selection before sending." }
```

Rules: writable Opportunity scope; reason 10–500 characters; current status
`prepared_not_sent`; exact version match. The route changes only `governed_status` to `cancelled`,
increments the header version and appends an immutable `cancelled` event. A repeat after confirmed
cancellation returns the current record; it never deletes snapshots.

### 3.3 Record property response and create the authoritative Task

`POST /crm/opportunities/:id/governed-property-shares/:shareId/responses`

Request:

```json
{
  "shareItemId": "opaque-uuid",
  "outcome": "not_suitable",
  "notes": "Controlled response evidence, maximum 1,000 characters.",
  "occurredAt": "ISO-8601",
  "notSuitableReason": "layout_or_size",
  "preferenceImpact": "review_required",
  "preferenceChangeDetail": "Customer asked to review the required layout."
}
```

Controlled outcomes: `interested`, `viewing_requested`, `information_required`, `more_options`,
`not_suitable`.

Rules:

- Share and item must be governed, immutable, in the same Opportunity and not cancelled.
- Response time is valid, no more than five minutes in the future, and not before preparation.
- Notes are required and at most 1,000 characters.
- `not_suitable` requires one accepted reason and preference impact. Detail is required for
  `review_required` or `confirmed_change` and forbidden for `property_only`.
- Other outcomes forbid all not-suitable fields.
- `recordedBy` is always the authenticated broker and `responseSource` is always
  `manual_fallback`; neither is accepted from the client.
- The response contract computes the immutable evidence hash server-side.

Task mapping:

| Response | Existing Task subject | Priority | Due from `occurredAt` |
|---|---|---:|---:|
| Viewing requested | Coordinate property viewing | urgent | 2 hours |
| Interested | Follow up on customer interest | high | 4 hours |
| Information required | Prepare requested property information | high | 4 hours |
| More options | Review requirement and prepare more options | normal | 8 hours |
| Not suitable — property only | Record property feedback and continue matching | normal | 8 hours |
| Possible preference change | Review possible preference change | high | 8 hours |
| Confirmed preference change | Prepare a new governed requirement version | high | 4 hours |

The Task uses the Opportunity lead/contact, current active Opportunity owner, type
`customer_response_follow_up`, status `open`, and structured provenance. If the owner is missing or
inactive the request fails closed; callers cannot override assignment.

Success: `201 Created`; exact replay returns `200 OK` and the same response/Task IDs.

```json
{
  "response": {
    "id": "opaque-uuid",
    "shareItemId": "opaque-uuid",
    "outcome": "not_suitable",
    "occurredAt": "ISO-8601",
    "evidenceHash": "sha256",
    "policyVersion": "r3c-customer-shortlist-v1"
  },
  "task": {
    "id": "opaque-uuid",
    "taskType": "customer_response_follow_up",
    "subject": "Review possible preference change",
    "priority": "high",
    "status": "open",
    "dueAt": "ISO-8601"
  },
  "automaticViewing": false,
  "automaticRequirementChange": false,
  "changesOpportunityStage": false,
  "changesInventory": false,
  "idempotentReplay": false
}
```

Response evidence, Task and provenance insert in one transaction. The unique response evidence hash
and unique provenance response link are the database-level retry/concurrency boundary.

### 3.4 Read package audit

`GET /crm/opportunities/:id/governed-property-shares/:shareId`

Uses existing Opportunity read scope. Returns the immutable package, exact local events,
property-level responses and each response's governing Task state. It redacts Task notes from users
who cannot already read that Task and never returns contact/channel values from legacy columns.

### 3.5 Read-only scoped MIS

`GET /crm/reports/governed-property-shares?from=ISO-date&to=ISO-date&ownerId=opaque-uuid`

- Manager/admin only, using existing manager/team scope.
- Maximum 93-day inclusive range; default 30 days; UTC instants with Dubai presentation labels.
- `ownerId` is optional and must remain within the caller's management scope.
- Returns prepared/cancelled counts, controlled response counts, response age, Task open/overdue/
  completed state, and reconciliation gaps.
- `shared`, `delivered`, `opened`, provider failures and provider responses return `unavailable` and
  are never inferred.
- Free-text response or Task notes are excluded from aggregate output.

## 4. Error contract

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `invalid_request` | Shape, controlled value or timestamp invalid. |
| 403 | `outside_write_scope` / `report_scope_required` | Existing permission denied. |
| 404 | `opportunity_not_found` / `share_not_found` | Missing or unreadable scoped record. |
| 409 | `stale_version` | Opportunity/share changed after opening. |
| 409 | `policy_denied` | One or more controlled policy checks failed; reason codes only. |
| 409 | `inventory_ineligible` / `customer_fact_drift` | Final eligibility or exact facts changed. |
| 409 | `selection_not_current` | Candidate/decision/requirement is no longer the accepted current chain. |
| 409 | `share_cancelled` | New response cannot attach to cancelled package. |
| 409 | `evidence_collision` | Same hash was presented with non-identical canonical evidence. |
| 409 | `responsible_agent_unavailable` | No active authoritative Task assignee. |

Errors contain only controlled codes, opaque record references where safe, and customer-safe field
names. They never echo contact values, private notes, credentials, owner or authority information.

## 5. Exact test gate before UI implementation

### Contract continuity

- Round-trip every field from all four accepted Release 3C contracts.
- Prove customer-safe snapshot, trade-offs, missing facts, approved floor plans and source-dated
  market evidence are unchanged by persistence.
- Prove the stored hashes recompute from canonical evidence.

### Permissions and privacy

- Internal read/write owner, participant, team lead, manager and admin cases.
- Read-only/out-of-team/external identity denial cases.
- API, audit and application-log assertions contain no contact/channel value, public token,
  credentials, owner data or authority data.
- MIS excludes notes and respects team scope.

### Preparation invariants

- One through six selections succeed; zero, seven, duplicates and external properties fail.
- Mismatched Opportunity/run/candidate/decision/listing/requirement chains fail.
- Non-latest or non-shortlisted decision fails.
- Every eligibility, reservation, verification, expiry, media-rights and fact-drift blocker fails.
- Missing/expired/withdrawn consent, restricted channel/contact or closed Opportunity fails.
- Optimistic version mismatch fails.

### Idempotency and concurrency

- Sequential identical prepare returns one policy decision, share, item set and prepared event by
  canonical request fingerprint even though a newly evaluated preflight would have a later timestamp.
- Two concurrent identical prepare transactions converge on one package.
- Sequential and concurrent identical response submissions produce one feedback row, one Task and
  one provenance row.
- Different evidence creates a later valid response; one-response-per-property is not imposed.
- Hash collision simulation fails closed.
- Forced failure at each write rolls back the entire transaction.

### Workflow boundaries

- All seven response-to-Task mappings match the approved priority/due contract.
- My Tasks and Diary consume the same Task.
- Opportunity display pointer, if synchronized, references the highest-priority/earliest open
  response Task and never becomes an independent work item.
- No response creates a viewing, requirement version or rematch automatically.
- No route changes Opportunity stage, property-match state, Inventory, Offer, booking or reservation.
- Cancellation appends evidence and preserves history.
- Legacy Release 2.6 shares remain readable and public legacy routes cannot resolve governed rows.

### Reporting

- Exact prepared/cancelled/response evidence only.
- Missing, open, overdue and completed Task reconciliation.
- No inferred sent/delivered/opened/converted state.
- Date-range, timezone and management-scope boundaries.

Focused Gate 2 implementation tests and the full repository suite must pass locally before Gate 3
browser review. The proposed migration must remain unapplied throughout local review.

## 6. Gate 2 approval effect

Approval authorizes creating the local migration file, domain integration, authenticated routes and
automated tests described here. It does not authorize material CRM UI implementation until those
backend tests pass and their evidence is presented, and it never authorizes deployment, migration
application, external communication or service access.

## 7. Local implementation evidence

- Migration: `src/migrations/085_release3c_governed_share_response.sql` — locally created and unapplied.
- Domain and routes: `src/release3c-crm-integration-domain.js` and
  `src/routes/release3c-governed-shares.js`.
- Gate 3 Opportunity UI approved and implemented locally on 13 August 2026.
- Focused integrated verification after UI implementation: **43/43 passed**.
- Complete repository regression after Gate 3: **786/786 passed**.
- Migration-free synthetic Gate 3 review: `http://127.0.0.1:3230/`; focused safety tests **2/2 passed**.
- No migration application, local runtime restart, deployment, external request or provider action
  was performed.
