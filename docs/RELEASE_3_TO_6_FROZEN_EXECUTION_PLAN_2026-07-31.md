# NYSA CORE Frozen Release 3-6 Execution Plan

Frozen by the NYSA owner on 2026-07-31. The governing outcome is **broker speed with
accuracy**: reduce lead and sales leakage, shorten time to a credible recommendation and
customer action, and preserve deterministic controls around identity, Inventory, consent,
commercial facts and transaction state.

## Frozen baseline and change control

- Environment promotion is governed by `ENVIRONMENT_AND_RELEASE_PROMOTION_POLICY.md`: local
  implementation, iterative CRM Test verification, one frozen R2-clone acceptance candidate,
  Production promotion, then exact application/migration alignment of both non-production
  environments before the next release starts.
- Production remains `2.1.0-dev.91`. The accepted R2-clone acceptance baseline is
  `2.1.0-dev.93`; the R2 clone is an acceptance baseline, not the daily development environment.
- Release 2 receives no further feature expansion. A correction may enter Release 2 only when
  reproducible evidence shows a security, data-integrity, availability or accepted-workflow
  defect. Every correction requires a new version, signed regression test and R2 clone evidence.
- Release 3 is delivered and accepted one phase at a time. Each phase is developed and tested on
  CRM Test, then frozen and accepted on the R2 clone. Work does not begin on the next phase until
  the current phase is promoted and both non-production environments are aligned to Production.
- A new idea receives a requirement ID and future-phase allocation. It does not enlarge an active
  phase unless the NYSA owner explicitly changes this freeze.
- AI may extract, rank, summarize and draft. It may not autonomously create consent, approve KYC,
  change Inventory availability, reserve Inventory, change an Opportunity stage, send external
  communication or invent commercial facts.

## Release 3A - Customer intelligence, trusted intake and broker action

Purpose: deliver a ready-to-use customer-to-broker-action loop. Every enquiry becomes credible,
owned, traceable and actionable; the Customer 360 explains the current relationship and need; and
the broker receives evidence-bound AI next-action suggestions inside a deterministic time-sensitive
landing screen.

The proposed plain-language design, limitations and acceptance evidence are maintained in
`RELEASE_3A_TRUSTED_INTAKE_AND_LEAKAGE_CONTROL_DESIGN.md`. Development begins only after owner
review of that design.

- `R3A-INTAKE-EMAIL-42`: score email credibility using deterministic syntax, normalized identity,
  domain/MX availability, disposable-domain and obvious-risk checks. Surface evidence and permit
  a controlled warning/override; do not silently reject a genuine lead.
- `R3A-DUPLICATE-43`: detect likely Customer and Lead duplicates across normalized email, phone
  and governed corroborating fields before creating another record.
- `R3A-LEAKAGE-44`: enforce accountable owner, next action, due time, SLA ageing, unattended-lead
  queue, escalation and manager recovery. No active enquiry may disappear because a broker did
  not act.
- `R3A-CAMPAIGN-45`: deliver the minimum governed campaign master already required by D-037:
  stable identity, owner, objective, dates, applicable properties, channels, source identifiers,
  status and operational targets. Financial ROI remains excluded.
- `R3A-PROFILE-46`: deliver a usable governed Customer 360 using Customer, Lead, interaction,
  qualification and structured-requirement evidence without social-media profiling.
- `R3A-BROKER-PRIORITY-46A`: make the broker landing screen a time-sensitive, explainable work
  queue. Deterministic deadlines and consequences establish safe priority bands; AI may rank and
  explain work within a band but cannot hide or demote a hard-deadline item.
- `R3A-AI-ACTION-46B`: build evidence-bound Customer summaries and controlled next-action
  suggestions that the broker can do now, schedule, edit or dismiss. Suggestions never bypass
  role, consent, lifecycle, Inventory or transaction controls.
- `R3A-WEBSITE-PROFILE-46C`: ingest approved NYSA website profile/requirement outputs into Customer
  360 with source/version evidence and no duplicate entry. Deeper AI Inventory ranking remains 3B.

Acceptance gate: a test Customer journey from each approved website form is ingested once,
credibility and source evidence are visible, duplication is controlled, source/campaign is
immutable, Customer 360 reconciles to authoritative evidence, and the correct Agent receives an
explainable priority plus an executable AI-suggested action. The recorded outcome updates the
timeline/next action, unattended work reaches the Manager, and deterministic operation continues
when AI is unavailable.

## Release 3B - Client intelligence and explainable Inventory matching

Purpose: convert client information into a faster, accurate and reviewable shortlist.

- `R3B-REQUIREMENT-47`: guided client profiling and requirement mapping covering purpose,
  transaction, budget, funding, areas, property type, bedrooms, size, timeline, lifestyle,
  investment goals, constraints and declared trade-offs. Preserve versioned source evidence.
- `R3B-WEBSITE-TOOLS-48`: consume the governed profile/requirement evidence ingested in 3A and
  integrate the NYSA AI Property Match output without duplicate data entry or unverified automatic
  commitment.
- `R3B-AI-MATCH-49`: apply deterministic live-Inventory eligibility first, then AI-assisted ranking
  only within the eligible set. Unavailable, unapproved, expired, deleted, closed, sold or
  conflicting reserved Inventory is excluded before AI sees the candidate set.
- `R3B-EXPLAINABILITY-50`: show match score components, supporting requirements, missing facts,
  important trade-offs and why a property was excluded. Broker review is mandatory.
- `R3B-FEEDBACK-51`: capture interested/not suitable/more-options and reason evidence against each
  property so future suggestions and MIS improve without rewriting the original recommendation.

Acceptance gate: the same governed profile and Inventory state produce a reproducible eligible
set; AI cannot introduce an ineligible property; every recommendation has evidence and trade-offs;
the broker can produce a reviewed shortlist materially faster than manual search.

## Release 3C - Broker execution and governed WhatsApp property sharing

Purpose: turn an accepted shortlist into customer action with minimal re-entry and no loss of
history.

- `R3C-NEXT-ACTION-52`: recommend the stage-appropriate next best action, due time and prepared
  working context while leaving the decision with the broker.
- `R3C-SHORTLIST-53`: create a compact customer-ready property selection from approved facts and
  media, including visible property reference, location, amount, match reason and trade-off.
- `WHATSAPP-INVENTORY-SHARE-58`: revalidate eligibility transactionally immediately before share;
  prepare a governed WhatsApp message and secure mobile property cards; preserve the exact
  recipient, broker, timestamp and immutable property snapshot; and capture property-level
  interested, viewing, more-information, alternatives and not-interested responses.
- `R3C-RESPONSE-54`: translate a governed customer response into the correct Opportunity activity,
  next action, viewing workflow or rematch request without automatically reserving Inventory or
  changing authoritative status.
- `R3C-SHARE-MIS-55`: report prepared, shared, opened, responded, viewing-requested and converted
  property selections, plus response ageing and broker follow-up gaps.

This phase retains the current external WhatsApp launcher as a safe fallback. It does not depend
on native Meta delivery. If a property later becomes unavailable, the historical snapshot remains
immutable while the live page clearly marks the property unavailable and blocks new action.

Acceptance gate: an eligible AI-assisted shortlist can be reviewed, shared and answered end to
end; stale Inventory cannot be newly shared; a customer response creates the correct broker action;
and the complete audit trail reconciles to the Opportunity.

## Release 3D - Connected communications and campaign automation

Purpose: replace manual provider steps only after the underlying governed workflow is proven.

- `R3D-WHATSAPP-56`: native WhatsApp Business Platform delivery, approved templates or supported
  property-card format, inbound response correlation, delivery/read/failure events, idempotent
  webhooks and retry management.
- `R3D-COMMS-57`: connected email and provider-neutral conversation history with consent,
  restriction, retention and failure controls.
- Connected calendar synchronization retains the `.ics` fallback.
- Approved external lead-provider ingestion, landing pages and nurture use the Release 3A campaign
  identity and never create disconnected campaign labels.
- Property Finder enquiries reconcile idempotently to one potential Lead, PF listing and Internal
  Inventory. AI text or automated voice first response is evaluated only through the central
  communication-preference, subscription/unsubscribe, suppression and DNCR policy, preserves a
  human handoff, and never converts an enquiry into automatic qualification or a commitment.
- Provider credentials, account ownership, data-residency/privacy review, approved sender/template,
  webhook ownership and sandbox testing are mandatory entry gates.

Acceptance gate: each enabled provider is proven in its sandbox; one external event reconciles to
one scoped CRM activity; duplicate webhook delivery is harmless; restrictions are enforced; and a
failed event can be retried without data duplication.

## Release 4 - Inventory, listing and partner operations

- Developer, agency and partner masters; Inventory source, verification, price and availability
  history; duplicate Inventory review; media and document governance.
- Populate the listing agreement from maintained Inventory and owner/authority data, allow the
  agent to complete missing controlled fields, capture the signed document, and require the signed
  agreement plus publication-readiness evidence before external listing. The agreement is not a
  prerequisite for maintaining internal Inventory.
- Property Finder, Bayut/dubizzle and other portal publication/reconciliation only after approved
  account access, schemas and sandboxes are available.
- Existing agency-owned Property Finder listings may be discovered read-only and explicitly
  imported as governed Internal Inventory Drafts; no silent overwrite, deletion or automatic
  bidirectional synchronization is permitted.
- Governed Inventory Market Intelligence reports using licensed/imported source evidence,
  deterministic calculations and reviewed AI narrative.

The cross-release end-state and sequencing gates are maintained in
`PROPERTY_FINDER_END_STATE_INTEGRATION_BLUEPRINT.md`.

## Release 5 - Commission and finance operations

- Governed commission rules, internal/referral/partner splits, exceptions and approvals.
- Expected, approved, invoiced, received and paid lifecycle with ageing and leakage alerts.
- Statements, accounting exports and Director/accountant reconciliation.

## Release 6 - Documents, compliance and authoritative analytics

- Transaction/customer document matrices, expiry reminders, restricted access and approval.
- Privacy operations, compliance evidence and authoritative closed-transaction reporting.
- CPL, CPA and marketing ROI only after campaign spend, authoritative revenue and commission
  sources reconcile to the same identities.
- Advanced operational, financial and regulatory reporting with traceable source evidence.

## Explicitly outside the frozen Release 3 scope

- Uncontrolled social-media profiling or sensitive-attribute inference.
- AI-generated prices, availability, transaction evidence, yields or forecasts without governed
  source data and deterministic calculation.
- Production provider credentials before sandbox acceptance.
- Portal publication, listing-agreement automation, commissions, finance and advanced compliance;
  these remain allocated to Releases 4-6 above.
