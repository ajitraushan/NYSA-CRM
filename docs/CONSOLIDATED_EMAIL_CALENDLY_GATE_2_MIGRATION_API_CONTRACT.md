# NYSA CORE Microsoft 365 Email and Calendly - Gate 2 Contract

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** owner Gate 2 approved; migrations created locally and remain unapplied  
**Policies:** `r3d-microsoft365-email-v1`, `r3d-calendly-scheduling-v1`  
**Boundary:** local contract design only; no provider account, credential, webhook or request

## Owner decisions carried forward

- Microsoft 365 is the Email provider.
- Each authorized staff member connects their own mailbox; CORE does not ingest an organization-wide
  mailbox.
- One NYSA Calendly organization/team account is used with explicit agent/host mapping.
- Calendly covers customer meetings and property viewings.
- Property Finder and every provider other than Microsoft 365 Email and Calendly remain deferred.

## Governing design decisions

1. Microsoft 365 Email uses delegated access on behalf of the signed-in staff member. No app-only
   tenant-wide mailbox access is proposed.
2. Email send is always a staff-confirmed CRM action to the exact maintained Customer email. There is
   no bulk send, nurture, autonomous AI send or arbitrary-recipient field.
3. Email notifications are hints, not authoritative message payloads. CORE fetches the referenced
   message with the mailbox's delegated authorization, deduplicates it and uses per-folder delta
   reconciliation to recover missed notifications.
4. Only messages exactly correlated to a CORE-created thread are retained or projected. Unrelated
   mailbox messages are discarded after minimum in-memory comparison; their content and addresses
   are not stored or logged.
5. Calendly uses one organization-scoped connection, explicit host mappings and explicit event-type
   mappings. Provider names, event labels or invitee text never determine CRM behavior by guessing.
6. A Calendly customer-meeting booking may create one existing CRM `Meeting` Activity when its
   scheduling intent, Lead, Customer and host resolve exactly.
7. A Calendly property-viewing booking does not directly create a Viewing. It creates immutable
   booking evidence and one broker confirmation Task. Confirmation revalidates the exact
   Opportunity, Property Match and live Inventory, then calls the existing Viewing transaction.
8. Calendly cancellation/reschedule webhooks preserve both events. A reschedule is a cancellation
   plus a new booking and never overwrites historical evidence.
9. A provider-origin key prevents CORE from creating a duplicate Google or Microsoft calendar event
   for the same Calendly booking. Existing Google Calendar/Meet behavior remains available outside a
   Calendly-origin booking, and `.ics` remains the fallback.
10. Both connectors are disabled by default and fail closed when configuration, authorization,
    signature, correlation, scope, version or current CRM authority is absent.

## Current official-provider constraints used by this contract

### Microsoft Graph

- Delegated authorization uses the Microsoft identity platform authorization-code flow on behalf of
  the signed-in user and may request `offline_access` for refresh-token continuity.
- Proposed minimum Graph permissions are `User.Read`, delegated `Mail.Send` and delegated
  `Mail.Read`. `Mail.ReadWrite`, shared-mailbox and application permissions are excluded.
- `Mail.Send` permits sending as the connected user and saves a copy in Sent Items without requiring
  `Mail.ReadWrite`.
- Outlook message subscriptions expire and require renewal; the current maximum for Outlook message
  subscriptions is under seven days. A missed or expired lease is recovered with folder-scoped
  message delta queries.
- Basic webhook notifications are used. Rich resource-data notifications are excluded. The public
  endpoint validates the Graph validation handshake and subscription `clientState`, acknowledges
  quickly, then processes asynchronously.

Official references:

- [Delegated Microsoft Graph authorization](https://learn.microsoft.com/en-us/graph/auth-v2-user)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Outlook message delta queries](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Microsoft Graph webhook delivery](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Microsoft Graph subscription lifetime](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
- [Microsoft Graph message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0)

### Calendly

- One organization-level webhook subscription receives `invitee.created` and `invitee.canceled` for
  the NYSA team. Calendly represents a reschedule as a cancellation plus a new booking.
- Proposed OAuth scopes are `organizations:read`, `users:read`, `event_types:read`,
  `scheduled_events:read`, `scheduling_links:write` and `webhooks:write`, subject to exact scope-name
  verification when the sandbox app is later created. Event cancellation/write authority is not
  requested in this first connector.
- OAuth uses a specific redirect URI and PKCE/S256. Refresh-token replacement is atomic: CORE never
  reuses a token after a successful rotation.
- Only existing, Admin-mapped Calendly event types can produce a CRM scheduling intent. CORE does not
  create or edit Calendly event types or availability.

Official references:

- [Calendly authentication choices](https://developer.calendly.com/authentication)
- [Creating a Calendly OAuth app](https://developer.calendly.com/creating-an-oauth-app)
- [Calendly authorization scopes](https://developer.calendly.com/scopes)
- [Organization webhook subscriptions](https://developer.calendly.com/receive-data-from-scheduled-events-in-real-time-with-webhook-subscriptions)
- [Calendly reschedule event behavior](https://developer.calendly.com/trigger-automations-with-other-apps-when-invitees-schedule-or-cancel-events)
- [Calendly refresh-token rotation](https://developer.calendly.com/refresh-token-rotation-guide)
- [Organization event-type links](https://developer.calendly.com/how-to-get-scheduling-page-links-for-team-members-across-the-organization)

Provider documentation must be checked again at sandbox-registration time. No current entitlement,
plan, tenant policy, consent or scope availability is assumed by this design.

## Proposed migrations

Two additive migrations are proposed so either connector can be disabled, rehearsed and rolled back
independently:

### `093_release3d_microsoft365_email.sql`

#### `microsoft365_mailbox_connections`

One active delegated mailbox connection per internal broker.

- `id`, `broker_id`, `tenant_ref`, `external_user_ref`, `granted_scopes`
- encrypted refresh-token reference and rotation generation; never a plaintext token
- `status`: `pending`, `active`, `reauthorization_required`, `disconnected`
- connected/disconnected actor, reason and timestamps
- unique active `broker_id`; no Company-wide or shared mailbox connection

#### `email_threads`

One CRM-owned correlation thread.

- exact `lead_id`, optional `opportunity_id`, `contact_id`, mailbox connection and owner
- immutable opaque CORE thread reference
- provider conversation reference only after reconciliation
- `status`: `active`, `closed`, `correlation_review`
- no email address, subject or message body in this table

#### `email_message_evidence`

Immutable inbound/outbound message evidence.

- exact thread, direction, provider message/event references and provider timestamps
- controlled purpose and lifecycle state
- exact Contact/email authority fingerprint derived from current CRM evidence
- restricted payload reference plus SHA-256; address digests rather than address values
- optional projected existing `activities.id`
- unique `(mailbox_connection_id, provider_message_ref)` and unique CORE attempt reference
- no plaintext body, subject, address, attachment or raw provider payload

#### `email_outbox`

Transactional dispatch work for staff-confirmed outbound email.

- exact immutable message-evidence and policy-decision references
- `pending`, `claimed`, `accepted`, `retry_wait`, `outcome_unknown`, `dead_letter`, `cancelled`
- lease, attempt count, next-attempt time and controlled reason code
- one dispatch generation; an outcome-unknown request is reconciled and never blindly resent

#### `microsoft365_subscription_leases`

- one Inbox and one Sent Items lease per active mailbox
- opaque subscription reference, resource, expiry, client-state digest and renewal state
- no client-state secret stored in plaintext
- renewal and lifecycle evidence; expired lease triggers delta recovery

#### `email_sync_checkpoints`

- mailbox plus folder (`inbox`, `sent_items`)
- encrypted opaque delta-link reference and generation
- last successful round, error and retry evidence
- a checkpoint is never accepted for another mailbox or folder

#### `email_provider_events` and `email_projection_events`

- immutable notification identity, verified client-state evidence, processing state and timestamps
- unique provider event/subscription/resource identity
- exactly one Activity projection per message evidence
- raw notification body, message content and addresses remain outside ordinary tables

### `094_release3d_calendly_scheduling.sql`

#### `calendly_connections`

Exactly one active NYSA organization connection.

- opaque organization/user references, granted scopes and connection status
- encrypted rotating refresh-token reference and generation
- webhook subscription reference/status without signing key material
- Administrator connector/disconnector and timestamps

#### `calendly_host_mappings`

- exact Calendly user reference to one active internal broker
- active date range, Administrator actor and reason
- one active mapping per Calendly user and broker
- mapping changes append a new version; no inferred email/name match

#### `calendly_event_type_mappings`

- exact event-type reference and immutable mapping version
- controlled kind: `customer_meeting` or `property_viewing`
- active dates, expected duration bounds and location mode
- viewing mappings require physical location mode
- Administrator maintenance is direct and audited; no maker-checker

#### `calendly_scheduling_intents`

Immutable CRM-authorized request to prepare a scheduling link.

- kind, exact event-type mapping/version, broker, contact and Lead
- Opportunity and Property Match required for a property viewing
- exact Lead/Opportunity/Match version fingerprints and current authority hash
- opaque random correlation reference; restricted provider-link reference and digest
- `prepared`, `booked`, `cancelled`, `expired`, `reconciliation_required`, `projected`
- expiry and one-time-use evidence; no arbitrary recipient or host

#### `calendly_provider_events`

- event family, event URI, invitee URI, occurred/received time and signature-verification evidence
- restricted raw-event reference and digest; no payload in audit or ordinary tables
- `received`, `deduplicated`, `correlated`, `reconciliation_required`, `projected`, `failed`
- unique provider event identity and replay-safe processing

#### `calendly_bookings`

- exact intent, event type, host mapping, event and invitee references
- start/end/timezone and restricted location/join-link reference
- `booked`, `pending_broker_confirmation`, `confirmed`, `cancelled`, `rescheduled`,
  `reconciliation_required`
- optional existing Activity or Viewing reference, never both
- predecessor/successor references preserve reschedules

#### `calendly_projection_events`

- immutable booking-to-Activity, booking-to-Viewing and booking-to-Task evidence
- unique projection type per booking
- the Task uses the existing My Task Queue; no Calendly work queue is created

Both migrations add only the necessary audit entity codes, immutable triggers, indexes and
least-privilege application-role grants. Neither migration alters existing Google rows, backfills a
mailbox/calendar mapping, reads legacy mail or infers a Calendly host/event type.

## Proposed API contract

### Microsoft 365 connection and status

- `GET /api/integrations/microsoft365-email/status`
- `GET /api/integrations/microsoft365-email/connect` - active user connects only their own mailbox
- `GET /api/integrations/microsoft365-email/callback` - one-time state and PKCE verification
- `POST /api/integrations/microsoft365-email/disconnect` - own mailbox; Administrator may revoke a
  disabled/terminated user's connection with a reason
- `POST /api/integrations/microsoft365-email/subscriptions/renew` - internal scheduled operation,
  never a browser-secret endpoint
- `POST /api/webhooks/microsoft-graph/mail` - public Graph validation/notification endpoint

### CRM Email

- `GET /api/crm/leads/:leadId/emails`
- `POST /api/crm/leads/:leadId/email-drafts`
- `POST /api/crm/leads/:leadId/email-drafts/:draftId/send`
- `GET /api/crm/leads/:leadId/email-threads/:threadId`
- Opportunity context may be supplied only when it belongs to the exact Lead/Customer chain.
- Draft creation accepts controlled purpose, template version, subject/body in the restricted payload
  boundary and the exact current Contact email version. Send requires draft version and a fresh
  confirmation. The current Contact/email authority fingerprint is re-derived at send time. The API
  accepts no free recipient address, provider token or provider identifier.
- The request transaction creates immutable evidence and outbox work. It does not synchronously call
  Microsoft Graph.

### Calendly administration

- `GET /api/admin/integrations/calendly/status`
- `GET /api/admin/integrations/calendly/connect`
- `GET /api/integrations/calendly/callback`
- `POST /api/admin/integrations/calendly/disconnect`
- `GET/POST /api/admin/integrations/calendly/host-mappings`
- `GET/POST /api/admin/integrations/calendly/event-type-mappings`
- `POST /api/webhooks/calendly` - public signature-verified receipt only

### Calendly scheduling

- `POST /api/crm/leads/:leadId/calendly/meeting-intents`
- `POST /api/crm/opportunities/:opportunityId/matches/:matchId/calendly/viewing-intents`
- `GET /api/crm/calendly/intents/:intentId`
- `POST /api/crm/calendly/bookings/:bookingId/confirm-viewing`
- `POST /api/crm/calendly/bookings/:bookingId/resolve` - controlled reconciliation decision

Preparing a viewing intent requires a current shortlist decision, current Opportunity version and
canonical Inventory eligibility. Broker confirmation repeats all checks and obtains row locks before
calling the existing Viewing workflow. A stale/unavailable property keeps the Calendly booking as
evidence, blocks Viewing creation and leaves the governing Task open with a controlled reason.

## Permission contract

| Action | Agent | Manager | Director | Full Administrator |
| --- | --- | --- | --- | --- |
| Connect/disconnect own Microsoft mailbox | Yes | Yes | Yes | Yes |
| Send from own connected mailbox in writable CRM scope | Yes | Yes | Yes | Yes |
| Read CRM-linked email evidence | Existing Lead/Opportunity scope | Team scope | Organization scope | Existing CRM scope only |
| Connect/disconnect Calendly organization | No | No | No | Yes |
| Maintain host and event-type mappings | No | No | Read | Yes, direct audited maintenance |
| Prepare scheduling link | Writable record scope | Team writable scope | Organization writable scope | Existing CRM scope only |
| Confirm Calendly property viewing | Assigned broker | Team Manager | Director | Only when already permitted by CRM scope |
| Read raw payloads, tokens or secrets | No | No | No | No browser/API exposure |

Webhook processing uses a dedicated internal service actor and does not inherit Administrator,
Director or customer authority. UI hiding is never treated as authorization.

## Detailed workflows

### Staff-confirmed outbound Email

1. Staff opens an exact Lead/Opportunity and chooses the maintained Customer email.
2. CORE evaluates role scope, communication preference/restriction, purpose, template and current
   Contact version.
3. Staff reviews exact recipient, subject and body and explicitly confirms send.
4. One transaction freezes restricted payload evidence and creates one outbox row.
5. The enabled Microsoft adapter sends once. A provider timeout becomes `outcome_unknown`; it is
   reconciled through Sent Items before any retry.
6. Exact provider evidence projects one existing outbound `Email` Activity.

### Inbound Email reply

1. Graph webhook is validated and acknowledged without parsing business content in the request path.
2. Worker fetches minimum selected fields and deduplicates the provider message.
3. Exact CORE thread/provider conversation or immutable correlation header is required.
4. A correlated reply stores restricted evidence and projects one inbound `Email` Activity.
5. An unrelated message is discarded without persistence. Ambiguous CRM-linked evidence enters
   restricted correlation review for the mailbox owner; it is never attached by email-address guess.
6. Folder delta reconciliation recovers missed notifications and advances its opaque checkpoint only
   after the complete page chain succeeds.

### Calendly customer meeting

1. Staff prepares a link from an exact Lead and mapped Calendly host/event type.
2. Calendly booking webhook resolves the immutable intent, host, Customer and time evidence.
3. One existing `Meeting` Activity is created idempotently with the Calendly provider origin.
4. Cancellation voids/cancels the provider-origin Meeting through controlled system evidence and
   creates broker follow-up only where needed. Reschedule creates the successor meeting evidence.

### Calendly property viewing

1. Staff prepares a link only from an exact current Property Match and eligible Inventory.
2. Booking creates `pending_broker_confirmation` evidence and one existing Task assigned to the
   responsible broker, with time/property facts but no unnecessary private invitee detail.
3. Broker reviews and confirms. CORE locks and revalidates Opportunity, Property Match, Inventory,
   duplicate time and actor scope.
4. Success creates one existing Viewing and completes the Task. The existing Viewing transaction may
   shortlist a considered property and move Matching to Viewing; only this explicit broker action may
   cause those changes.
5. Failure leaves the booking visible and Task actionable for customer rescheduling; it does not
   create a partial Viewing or alter Inventory/Opportunity state.
6. Calendly cancellation before confirmation closes the Task. Cancellation after confirmation uses
   the existing Viewing cancellation/history rules and never deletes the Viewing.

## UI contract

- **My Settings:** connect/disconnect own Microsoft 365 mailbox, granted-purpose summary, last sync,
  subscription health and reauthorization status. Never show tokens or tenant secrets.
- **Lead/Customer activity:** Email composer with exact maintained recipient, controlled purpose,
  optional approved template, preview, explicit send confirmation, thread history and provider state.
- **Admin Integrations:** one Calendly team connection, mapped hosts, mapped event types, webhook and
  reconciliation health. Ordinary Admin maintenance has no maker-checker.
- **Lead:** prepare Customer Meeting link and show scheduled/cancelled/reconciled state.
- **Opportunity Property Match:** prepare Property Viewing link only for current eligible match;
  display pending booking and confirm/reject/reschedule action through the existing Task.
- **Existing calendars:** show one origin badge (`Calendly`, `Google Calendar`, `Microsoft 365` or
  `ICS/manual`) and never present duplicate create/send controls for the same origin.

## Configuration contract

Names only; no values are created or stored in source:

- `MICROSOFT365_EMAIL_ENABLED=0`
- `MICROSOFT365_TENANT_ID`
- `MICROSOFT365_CLIENT_ID`
- `MICROSOFT365_CLIENT_SECRET`
- `MICROSOFT365_REDIRECT_URI`
- `MICROSOFT365_WEBHOOK_CLIENT_STATE_SECRET`
- `CALENDLY_ENABLED=0`
- `CALENDLY_CLIENT_ID`
- `CALENDLY_CLIENT_SECRET`
- `CALENDLY_REDIRECT_URI`
- `CALENDLY_WEBHOOK_SIGNING_KEY`
- existing `INTEGRATION_ENCRYPTION_KEY`

Startup and status endpoints report only configured/missing booleans, enabled state, lease health and
last safe reconciliation time. They never return secret values, tokens, raw external identifiers,
private addresses or provider response bodies.

## Gate 3 offline implementation slices after approval

1. Deterministic Email and Calendly domain policies and tests.
2. Additive migrations `093` and `094`, created locally but not applied to a NYSA environment.
3. Disabled Microsoft Graph and Calendly adapters plus local synthetic adapters.
4. Authenticated APIs, public webhook verification boundaries and existing Task/Activity/Viewing
   integration.
5. Existing CRM UI extensions and Administrator configuration surfaces.
6. Loopback-only synthetic review with no external requests or private data.
7. Focused tests, migration-chain rehearsal if a disposable local PostgreSQL baseline is available,
   complete repository suite, syntax, diff and local HTTP smoke.

No sandbox or real provider verification is included in Gate 3 local implementation. Provider app
registration, OAuth consent, webhook registration and sandbox UAT require a later explicit gate.

## Minimum offline acceptance evidence

### Microsoft 365 Email

1. Only an active user can connect their own mailbox.
2. Delegated permissions exclude app-only, shared mailbox and `Mail.ReadWrite` authority.
3. OAuth state/PKCE is one-time, expiring and replay-safe.
4. Refresh tokens are encrypted, replaceable and never exposed.
5. Recipient is derived from exact current Contact evidence; arbitrary addresses are rejected.
6. Communication restriction or stale Contact version blocks send.
7. One confirmation creates one immutable attempt and one outbox generation.
8. Timeout/outcome unknown does not resend until Sent Items reconciliation proves absence.
9. Notification validation/client-state failure is rejected before provider-resource fetch.
10. Duplicate webhook and delta evidence produces one message and one Activity.
11. Unrelated mailbox messages are not persisted.
12. Subscription expiry renews or falls back to delta without losing the checkpoint.
13. Disconnect prevents dispatch and sync while preserving historical CRM evidence.

### Calendly

14. Only Full Administrator connects the one team account and maintains mappings.
15. Host and event type are never inferred from display name or email.
16. Unknown event type, host, intent or signature enters fail-closed reconciliation.
17. Duplicate `invitee.created` creates one booking/projection.
18. `invitee.canceled` plus successor create preserves reschedule history.
19. Meeting booking creates one existing Meeting Activity without a second calendar event.
20. Viewing intent requires exact Opportunity, Property Match and current eligible Inventory.
21. Viewing booking creates a broker Task but no Viewing or stage change before confirmation.
22. Confirmation revalidates and creates one Viewing through the existing workflow.
23. Stale/unavailable Inventory blocks Viewing and leaves actionable evidence without partial writes.
24. Cancellation preserves historical Activity/Viewing evidence.
25. No path reserves Inventory, creates an Offer, publishes, sends bulk Email or invokes Property
    Finder.

### Cross-cutting

26. Agent, Manager, Director and Administrator permissions are enforced at API and database layers.
27. Audit and status responses contain no token, secret, raw payload or private address.
28. Both real connectors remain disabled in local tests; synthetic adapters prove lifecycle,
    idempotency, retries and reconciliation.
29. Focused and complete repository suites remain green.

## Gate 2 approval points

The owner is asked to approve or revise:

1. delegated individual Microsoft 365 mailboxes with `Mail.Send` plus `Mail.Read`, not app-only or
   organization-wide access;
2. manual one-to-one CRM Email only, with no bulk campaign or autonomous send;
3. one Calendly organization connection with Admin-maintained host/event-type mappings;
4. automatic existing Meeting Activity creation for an exactly correlated customer booking;
5. broker confirmation through My Task Queue before a Calendly property booking becomes a CRM
   Viewing and can move the Opportunity stage;
6. no Calendly event-cancellation/write scope in the first connector; provider cancellations enter
   through signed webhooks;
7. separate additive migrations `093` and `094`; and
8. Gate 2 approval authorizes local Gate 3 implementation and synthetic testing only, not provider
   registration, credentials, OAuth consent, webhook registration, sandbox access, packaging,
   migration application, deployment or restart.
