# NYSA CORE WhatsApp Integration - Stage 1 Design

Status: Stages 1-3 internal foundation implemented; external connection not approved  
Date: 2026-08-08  
Scope: local design only

## 1. Decision boundary

This document defines the provider-neutral boundary for a future native WhatsApp integration.
It does not authorize code implementation, database migration, provider selection, credential
handling, external resource creation, webhook registration, message transmission, deployment, or
changes to CRM Test, R2, or Production.

The existing external WhatsApp launcher remains the safe fallback until a later stage is approved,
implemented, and accepted. Manual activity recording remains authoritative while the launcher is
used.

## 2. Current baseline

NYSA CORE currently supports:

- WhatsApp as a controlled lead source, preferred channel, and activity type.
- WhatsApp capability as an attribute of a validated phone channel rather than a duplicate contact
  record.
- Governed property-share preparation with a secure public property page and immutable property
  snapshots.
- An external-client launcher followed by a manual status update in CORE.
- Manual proposal, offer, and activity evidence that records an external action without claiming
  provider delivery.

NYSA CORE does not currently have:

- A native WhatsApp provider adapter or provider SDK.
- An outbound job processor, delivery retry queue, or dead-letter workflow.
- A webhook receiver, signature verification, replay protection, or inbound correlation service.
- Automatic provider delivery, read, failure, or response events.
- WhatsApp-specific environment configuration or secret-manager integration.

## 3. Outcomes and non-goals

### Required outcomes

- Preserve a provider-neutral CORE domain model.
- Re-evaluate consent, restriction, channel eligibility, authorization, and Inventory eligibility
  immediately before every transmission attempt.
- Correlate each provider event to one CORE communication attempt without duplicate activities.
- Preserve an auditable lifecycle while excluding credentials and sensitive payloads from general
  application logs.
- Retain the manual launcher when the native connector is unavailable or disabled.
- Ensure inbound activity never creates or implies marketing consent.

### Stage 1 non-goals

- Selecting or configuring a provider.
- Defining real sender, recipient, account, owner, or authority information.
- Writing or approving message or template content.
- Migrating existing property-share records.
- Enabling automated campaign or AI-initiated transmission.
- Deploying any component.

## 4. Recommended architecture

The recommended approach is a provider-neutral communication core with a replaceable WhatsApp
adapter. Provider-specific identifiers and status vocabulary terminate at the adapter boundary.

```text
Broker action
  -> CORE communication policy decision
  -> immutable communication attempt
  -> transactional outbox
  -> disabled-by-default WhatsApp adapter
  -> provider

Provider webhook
  -> signature and replay verification
  -> immutable inbound provider event
  -> idempotent correlation
  -> CORE activity / follow-up projection
  -> exception queue when correlation is unsafe
```

The request path must never call the provider synchronously. A database transaction should create
the authoritative attempt and its outbox entry together. A worker may deliver only after the
transaction commits and the policy decision is revalidated.

## 5. Domain contracts

The following are conceptual contracts, not approved database or API names.

### Communication policy decision

- Subject reference and business-area scope.
- Channel and communication purpose.
- Consent or legal-basis evidence reference.
- Active restriction and suppression result.
- Validated channel reference.
- Actor, role, and authorization decision.
- Inventory or document eligibility decision when applicable.
- Decision timestamp, policy version, outcome, and reason codes.

The decision contains references and reason codes, not contact values or message payloads.

### Communication attempt

- Internal immutable attempt identifier.
- Related lead, customer, Opportunity, share, proposal, or offer reference.
- Direction, purpose, provider-neutral channel, and lifecycle state.
- Policy-decision reference and approved template/version reference when required.
- Restricted payload reference and integrity digest; no payload in ordinary logs or audit metadata.
- Provider correlation reference stored only after accepted delivery handoff.
- Creation, scheduling, attempt, acceptance, delivery, read, failure, and cancellation timestamps.
- Initiating actor and responsible follow-up owner references.

### Provider adapter

The outbound adapter accepts an approved attempt reference and returns a normalized result:

- accepted with provider correlation reference;
- temporarily unavailable with retry classification;
- permanently rejected with a controlled reason code; or
- outcome unknown, requiring reconciliation rather than blind retry.

The adapter must not make business-policy decisions or create CRM activities directly.

### Provider event envelope

- Provider event identifier and provider correlation reference.
- Normalized event type and provider event time.
- Receipt time, signature-verification result, and replay-detection result.
- Restricted raw-event reference with retention classification.
- Correlation outcome and processing version.

The normalized envelope excludes credentials, contact values, and message payloads.

## 6. Lifecycle and idempotency

### Outbound lifecycle

```text
draft -> policy_approved -> queued -> dispatching
      -> accepted -> delivered -> read
      -> retry_wait -> dispatching
      -> failed_permanent
      -> outcome_unknown -> reconciled
      -> cancelled
```

- `draft` is not transmissible.
- `policy_approved` records a point-in-time decision but must be rechecked before dispatch.
- `accepted` means the provider acknowledged the request; it does not mean delivered or read.
- `outcome_unknown` blocks automatic retry until reconciliation proves that duplication is safe.
- Terminal states are append-only; corrections create reconciliation evidence rather than rewriting
  provider history.

### Inbound lifecycle

```text
received -> verified -> deduplicated -> correlated -> projected
         -> rejected_security
         -> correlation_review
         -> processing_failed -> retry_wait
```

Idempotency requires uniqueness at three boundaries:

1. One outbox command per internal communication attempt and dispatch generation.
2. One normalized provider event per provider event identifier.
3. One CRM projection per normalized event and projection type.

## 7. Policy and authorization controls

Every outbound attempt must fail closed unless all applicable controls pass:

- The actor is authenticated and authorized for the related record and business area.
- The contact channel is validated, eligible for WhatsApp, and not superseded.
- No active do-not-contact, suppression, or channel restriction blocks the purpose.
- The recorded consent or legal basis permits the purpose at dispatch time.
- A required approved template and version are selected.
- Required property, media, proposal, offer, or document approvals remain current.
- The connector is enabled for the environment and communication purpose.
- Rate, frequency, quiet-time, and campaign controls pass when applicable.

Automated or AI-assisted preparation never grants authority to transmit. A human approval boundary
remains required unless a later governance decision explicitly authorizes a narrowly defined
automation policy.

## 8. Webhook security baseline

- Verify signatures against provider documentation before parsing business data.
- Read the request body once and retain only the minimum restricted evidence required for audit or
  troubleshooting.
- Enforce timestamp tolerance and replay protection.
- Apply strict body-size, content-type, schema, and event-type validation.
- Acknowledge valid duplicate events idempotently.
- Reject unverified events without updating CRM state.
- Separate receipt from asynchronous processing so provider retries do not duplicate projections.
- Keep public webhook routes outside browser sessions while applying independent authentication,
  rate limiting, monitoring, and network controls.
- Rotate secret references without application-code changes; secrets must not be supplied through
  chat, source control, ordinary environment examples, logs, or test fixtures.

## 9. Data protection and observability

### Data minimization

- General logs contain internal references, normalized states, reason codes, durations, and
  redacted error classifications only.
- Contact values, credentials, private-party details, and communication payloads are excluded from
  logs, metrics labels, traces, test fixtures, support bundles, and audit metadata.
- Restricted payload and raw-event storage, if later approved, requires encryption, explicit access
  control, purpose-limited retention, access audit, and deletion rules.
- Public property-share tokens remain hashed at rest, expire, and are revocable.

### Operational measures

- Queue depth and oldest-item age.
- Dispatch acceptance, delivery, failure, and unknown-outcome rates using non-sensitive dimensions.
- Webhook verification failures, duplicates, correlation-review volume, and processing latency.
- Retry exhaustion and dead-letter age.
- Manual-launcher fallback usage without capturing external-client content.

## 10. Failure and recovery behavior

- Temporary provider failure uses bounded exponential backoff with jitter and a retry ceiling.
- Permanent policy or provider rejection does not retry automatically.
- Unknown outcomes enter reconciliation to prevent duplicate transmission.
- Expired consent, restrictions, stale Inventory, revoked documents, or lost authorization cancel
  queued attempts before dispatch.
- Uncorrelated inbound events enter a restricted review queue and do not create speculative leads,
  activities, or consent.
- Connector disablement stops new dispatch while preserving queued evidence and the manual launcher.
- Recovery actions are explicit, role-controlled, idempotent, and audited.

## 11. Provider strategy options

### Option A - Provider-neutral core with direct WhatsApp Business adapter

Best alignment with the roadmap and long-term portability. NYSA owns more operational concerns,
including webhook handling, template lifecycle integration, retries, reconciliation, and support.

### Option B - Provider-neutral core with managed business-solution provider adapter

May reduce initial provider operations, but introduces vendor-specific capabilities, commercial
terms, data-processing boundaries, and possible migration constraints. The CORE contracts remain
the same.

### Option C - Preserve launcher only

Lowest implementation and privacy risk. Delivery and response evidence remain manual, limiting
automation, reconciliation, and service-level reporting.

Recommendation: retain Option C until local contracts and controls pass; then implement Option A or
B behind the same provider-neutral boundary after a separate provider decision.

## 12. Test strategy for later stages

Stage 2 local tests should use synthetic opaque identifiers and omit message bodies and contact
values. Required suites include:

- Policy allow/deny matrices and dispatch-time revalidation.
- Authorization and business-area isolation.
- Outbox transactionality, concurrency, retry, cancellation, and unknown-outcome behavior.
- Signature verification, replay rejection, schema validation, and body-size enforcement.
- Provider-event and CRM-projection idempotency.
- Correlation success, ambiguity, and review-queue behavior.
- Redaction assertions for logs, metrics, audit records, and errors.
- Connector-disabled behavior and manual-launcher fallback.
- Public property-share expiry, revocation, and stale-Inventory blocking.

No provider network tests or real transmissions are authorized by this plan.

## 13. Approval gates

| Gate | Scope | Current status |
|---|---|---|
| Stage 1 | Local specification and threat model | Approved and documented |
| Stage 2 | Local disabled scaffold, schema proposal, and synthetic tests | Approved and implemented locally |
| Stage 3 | Local emulator and contract tests | Approved and implemented locally |
| Stage 4 | Provider selection and isolated sandbox connection | Not approved |
| Stage 5 | Environment deployment, migration, or real transmission | Not approved |

Each gate requires a separate explicit approval. Approval of one gate does not authorize later
gates or any third-party action.

## 14. Stage 2 implementation record

Stage 2 was approved on 2026-08-08 and implemented only as isolated local files:

- `src/communication-domain.js`: provider-neutral policy, attempt, dispatch-gate, lifecycle,
  normalized-event, sensitive-field, and idempotency rules.
- `src/communication-connector.js`: the production-facing connector boundary; permanently disabled
  and guarded against runtime use. The separate local simulator added in Stage 3 has no network
  capability.
- `docs/schema-proposals/release3d_communication_core_scaffold.sql.proposed`: a non-executable
  schema definition outside the automatic migration directory, with no runtime grants and no
  direct contact-value, credential, or communication-content columns.
- `test/communication-domain.test.js`: synthetic local tests using opaque references.

The scaffold is not imported by the application server or any route, has no provider dependency,
and cannot transmit. Its schema proposal is outside the automatic migration directory and has not
been applied to any database or environment.

## 15. Stage 3 implementation record

Stage 3 was approved on 2026-08-08 and implemented as an isolated in-memory simulator:

- `src/communication-local-connector.js`: a deterministic, network-incapable connector supporting
  accepted, temporary-failure, permanent-failure, unknown-outcome, delivery, read, duplicate, and
  replay scenarios.
- `test/communication-local-connector.test.js`: local contract coverage for dispatch idempotency,
  retry generations, recovery paths, event ordering, duplicate collapse, replay rejection, policy
  gating, and sensitive-field exclusion.
- `tools/whatsapp-local-console/`: a localhost-only visual console for selecting synthetic provider
  and policy scenarios and inspecting lifecycle and normalized-event evidence.
- `test/communication-local-console.test.js`: checks scenario coverage, absence of sensitive-data
  inputs and external request primitives, localhost serving, and restrictive browser headers.

The simulator accepts opaque references and digests only. It is imported by tests only and is not
wired into the CORE application server, routes, browser UI, database, or environment configuration.
The separate console server binds only to `127.0.0.1`, disables browser network connections through
its content-security policy, and is started manually for local testing.

## 16. Decisions required before Stage 4

These decisions require no credential, contact, owner, authority, or message information:

1. Select a direct WhatsApp Business adapter or a managed business-solution provider adapter while
   retaining the provider-neutral CORE boundary.
2. Confirm the human-approval boundary for one-to-one transactional sharing.
3. Confirm retention classifications for normalized events, restricted raw events, and restricted
   payload references.
4. Confirm the team roles permitted to dispatch, reconcile unknown outcomes, and review ambiguous
   inbound correlations without naming individuals.
5. Approve or decline provider research and an isolated sandbox plan as separate actions; neither
   approval authorizes credentials, third-party configuration, connection, or transmission.

The implemented direction is a new shared communication domain, disabled by default, with property
sharing intended as its first future consumer and no external provider dependency.
