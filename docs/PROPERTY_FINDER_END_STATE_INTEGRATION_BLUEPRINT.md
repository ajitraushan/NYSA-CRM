# Property Finder end-state integration blueprint

Status: recorded product direction and future acceptance boundary. This document does not claim that the capabilities below are implemented or authorised for Production.

## Product intent

NYSA CORE is intended to become the governed system of record around the complete Property Finder operating loop:

1. CORE prepares and sends an approved listing to Property Finder.
2. CORE can discover existing agency-owned PF listings and import explicitly selected PF-only records as governed Internal Inventory Drafts.
3. A customer enquiry on a PF listing enters CORE promptly as a potential Lead.
4. CORE deduplicates the enquiry, links it to the PF listing and Internal Inventory, preserves attribution and routes it under the approved responsibility policy.
5. Where communication policy permits, an AI assistant or automated voice service may make the first response, capture structured needs and transfer the conversation to a human agent.
6. CORE reconciles listing and lead lifecycles without silently overwriting or deleting authoritative internal records.

Outbound listing publication, inbound listing import, inbound lead ingestion and customer communication are separate governed flows. Approval of one flow never authorises another.

## Existing PF listing import

The import workspace should perform read-only discovery first and display agency-owned PF listings with their PF ID, reference, status, likely CORE match and import blockers. An operator must select records explicitly.

- A PF listing already linked to CORE is reconciled, not duplicated.
- A PF-only listing is imported as an Internal Inventory Draft, never automatically Approved, Verified, Available or publication-ready.
- The PF listing ID and source reference are retained as immutable provenance.
- PF values do not silently overwrite governed CORE values. Differences enter a review queue.
- PF deletion or unpublication creates reconciliation evidence; it never deletes Internal Inventory by assumption.
- Owner/contact details are not imported through the listing flow.
- PF media does not become approved CORE Property Media until identity, usage rights, durability and storage controls are satisfied.
- Automated bidirectional synchronization remains disabled until field ownership, conflict, replay and deletion rules are approved and tested.

## PF enquiry to potential Lead

Each eligible PF enquiry should create or reconcile one potential Lead through an idempotent inbound boundary.

- Retain the PF enquiry ID, PF listing ID, Internal Inventory ID, source timestamps and original attribution.
- Deduplicate provider retries and overlapping scheduled reads.
- Match a Customer only through the governed identity boundary; otherwise create the appropriate unconfirmed intake state.
- Route to the responsible listing agent or governed team queue. Do not infer direct assignment outside the approved routing policy.
- Begin the response SLA from authoritative provider receipt time where available.
- Preserve the original enquiry as immutable intake evidence without exposing contact information in logs, audit summaries or integration diagnostics.
- A PF enquiry is a potential Lead, not an automatically qualified Lead, Opportunity, availability confirmation or viewing commitment.
- Prefer verified, idempotent webhooks when the approved PF contract supports them; otherwise use controlled scheduled reads with an overlap window, durable cursor and deduplication.

## AI first response and automated voice

Automation must be designed into the inbound Lead boundary, but contact occurs only after a separate communication-policy decision.

An eligible AI first response may:

- identify NYSA and disclose that the customer is interacting with an automated assistant;
- acknowledge the exact property enquiry without claiming unverified availability;
- capture preferred language, continuing interest, budget, timing, funding direction, viewing preference and desired human follow-up;
- answer only from approved listing and organisational facts;
- create structured conversation evidence and a concise agent handoff summary;
- transfer immediately on uncertainty, complaint, opt-out, sensitive subject, explicit human request or configured risk trigger.

It must not invent price, availability, permit status, authority, financial advice, eligibility or a commercial commitment.

Automated voice additionally requires an approved company calling identity, permitted calling window, retry ceiling, disclosure script, continue-call confirmation, recording/transcription policy, human transfer path and provider-specific failure controls. Production activation requires current UAE legal/compliance review and the necessary organisational/provider approvals.

Automation being blocked must never discard the enquiry. The potential Lead remains visible in the human response queue with a business-readable blocking reason.

## Central communication-preference and DNCR service

CORE should maintain one provider-neutral communication-policy service for voice, AI chat, WhatsApp, SMS and email. Property Finder must consume this service rather than implement a private consent list.

For each person, purpose and channel, retain:

- subscribed, unsubscribed, suppressed or unknown state;
- consent or other approved contact basis, source, purpose, timestamp and evidence;
- DNCR screening result, checked time, policy version and permitted next-check time;
- preferred channel, language and permitted contact window;
- immutable subscribe, unsubscribe and suppression history;
- provider synchronization and failure state;
- wrong-number, complaint and do-not-contact indicators;
- the policy decision and reason evaluated immediately before each automated attempt.

Unsubscribe or suppression takes effect immediately, cancels queued automation and overrides campaigns and routine agent actions. Any exceptional contact path must be separately governed and auditable; it cannot be a casual user override. An incoming enquiry may still be retained and routed as a potential Lead when automated outreach is blocked.

## Security, privacy and audit boundary

- Provider credentials, access tokens and webhook secrets remain server-side and environment-bound.
- Production and sandbox accounts, credentials, endpoints and evidence remain isolated.
- Contact details, owner data, authority documents, call recordings, transcripts and signed media URLs are never written to ordinary logs or privacy-minimised audit summaries.
- Webhook signatures, replay protection, idempotency keys, durable cursors, bounded retries and a failure/dead-letter work queue are mandatory.
- Access to conversations, recordings and contact details follows CRM record scope and retention policy.
- Audit evidence records the provider event identity, governed decision, action, result and responsible actor/system without copying the private payload.

## Delivery sequence and gates

1. Read-only PF listing discovery, match preview and explicit Draft import in sandbox (implemented as the dev.139 code boundary; controlled sandbox UAT remains pending the separate read scope and tagged fixtures).
2. PF lead ingestion into the ordinary human response queue with deduplication and attribution; no automated contact.
3. Central communication-preference, DNCR, subscription and suppression service with provider-neutral policy evaluation.
4. AI text first response in test mode, then restricted CRM-Test UAT with human handoff.
5. Automated voice in test mode only after calling-provider, organisational, legal/compliance, number, disclosure, recording and DNCR controls are approved.
6. Outbound PF listing create/update and later publication/credit operations as separately authorised increments.
7. Production enablement only after isolated sandbox acceptance, rollback/failure procedures, privacy review and measurable operational sign-off for each flow.

No step broadens the authority of a later step. In particular, lead ingestion does not authorise contact; AI text approval does not authorise voice; listing preflight does not authorise a listing write; and listing creation does not authorise publication or credit spend.
