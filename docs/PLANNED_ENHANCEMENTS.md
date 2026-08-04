# NYSA CORE Planned Enhancements

These records capture approved planning inputs that are not implemented by the current
Release 1.1 correction packages. Release allocation, provider selection, credentials,
privacy/compliance review and implementation approval remain separate gates.

## ENH-CAMPAIGN-001: Governed campaign management and outcome attribution

- Requested: 2026-07-21; release allocation approved under D-037 on 2026-07-22.
- Current behavior: CORE retains lead source and campaign codes and reports operational lead
  response/conversion, but it has no campaign master, governed budget, channel execution record or
  authoritative deal-based acquisition/return calculation.
- Release 2 foundation: Preserve immutable original-enquiry source, campaign, advert, form,
  landing-page and property identifiers from Lead through Opportunity, Booking and Deal. Record
  provenance and reconciliation only; do not infer multi-touch credit, spend, CPL, CPA or ROI.
- Release 3A requirement: Deliver the governed campaign master with stable identity, owner,
  objective, applicable properties, audience, channels, dates, budget, status, source identifiers,
  performance targets and operational lead/qualification/deal-conversion reporting.
- Release 3B consumption: Communications, calendars, lead providers, landing pages, nurture and
  dynamic advertisements use governed campaign identities and retain provider event mappings,
  failures, retries and reconciliation instead of creating free-text campaign labels.
- Release 6 analytics: Add CPL, CPA and marketing ROI only after channel spend, authoritative
  Release 2 outcomes and applicable revenue/commission records reconcile to the same campaign and
  property identities.
- Controls: API-enforced role scope; versioned/retired controlled identities; immutable intake
  provenance; consent and privacy basis; audited budget/status changes; idempotent provider
  mappings; data-as-of and contributing-record drill-down; no financial return inferred from
  proposal values, free text or a lead-stage label.
- Status: Allocated; design boundary approved, not implemented. Testing and deployment remain
  restricted to CRM Test and require separately approved acceptance criteria.
- Acceptance condition: Reconcile one controlled campaign identifier from enquiry to Lead,
  Opportunity, Booking and Deal without duplication or mutation; prove unrelated-role denial;
  reconcile Release 3 operational campaign counts to their source records; and keep financial
  return explicitly unavailable until Release 6 source gates pass.

## ENH-COMMS-001: Provider-neutral communication actions and automatic history

- Requested: 2026-07-21
- Current behavior: Lead detail provides Call, Open WhatsApp and Email launchers. They open
  the device dialler or external application; CORE does not receive delivery, conversation,
  reply or completion events automatically. Staff manually record activities.
- Planned requirement: Retain one clear action rail for Call, WhatsApp and Email that can
  operate as a launcher before integration and as a connected action after a provider is
  configured. A connected action must create or correlate the exact lead/customer activity,
  direction, participants, timestamps, provider message/call ID, status, outcome, duration,
  attachments and follow-up without duplicating events.
- Controls: Enforce channel validation, mandatory Inbound/Outbound direction, Do-not-contact,
  consent/legal-basis policy, approved WhatsApp templates where required, role scope, secret
  isolation, webhook signature validation, idempotency, retention, redaction, audit history,
  failure queue and retry controls. An inbound interaction must not create marketing consent.
- Dependencies: Approved email provider and mailbox model; WhatsApp Business Platform account,
  dedicated number, templates and webhook ownership; telephony provider if automatic call
  detail is required; privacy/compliance decision; sandbox credentials and support owner.
- Candidate release: Release 3 Communications and External Lead Channels.
- Status: Planned; not implemented and not included in Release 1.1 acceptance.
- Acceptance condition: In provider sandboxes, send and receive each enabled channel, reconcile
  one external event to one scoped lead activity, prove consent/restriction denial, retry a
  failed webhook without duplication, and drill from the conversation to the customer/lead.

## ENH-CALENDAR-001: Connected meeting scheduling and synchronization

- Requested: 2026-07-21
- Current behavior: Calendar actions download an `.ics` file. The file can be imported into a
  calendar, but CORE does not create, update, cancel or synchronize the provider event.
- Planned requirement: Add a Schedule meeting action that records meeting purpose, lead,
  customer, organizer, attendees, location/video link, timezone, start/end, reminders and
  follow-up, then creates a provider event through a replaceable calendar adapter. Preserve
  the `.ics` download as a clearly labelled fallback when no connector is configured.
- Controls: Store provider event ID and synchronization state; process signed/idempotent
  create/update/cancel callbacks; prevent cross-agent calendar access; audit every change;
  surface failures and retry safely; never expose calendar credentials in browser code.
- Dependencies: Provider decision (Google Calendar and/or Microsoft 365), NYSA account model,
  delegated-access approval, attendee/privacy policy, sandbox credentials and webhook owner.
- Candidate release: Release 3, with Release 2 viewing scheduling consuming the adapter.
- Status: Planned; not implemented. The current Calendar button remains `.ics` download only.
- Acceptance condition: In a provider sandbox, create, reschedule and cancel a meeting from an
  authorized lead, reconcile the external event and CORE activity once, verify timezone and
  reminders, demonstrate cross-agent denial and retain `.ics` fallback behavior.

## ENH-DASH-001: Agent lead-lifecycle overview with actionable drill-down

- Requested: 2026-07-21
- Previous behavior: The Agent dashboard showed scoped workload/task information, and an opened
  lead showed its individual lifecycle, but no aggregated personal lifecycle with drill-down.
- Agreed requirement: Add an Agent-scoped lifecycle component showing the current population
  at Lead/New, Contacted, Qualified, Viewing, Negotiation and Won, with Lost separate. Each
  stage opens the exact contributing leads while preserving period/filter context and offers
  the appropriate next action: record contact, assess/confirm qualification, schedule viewing,
  record negotiation, close Won, or record Lost with reason.
- Reconciliation rules: Count each lead once at its current stage; never count Customer as a
  lead stage; keep Lost separate; respect signed-in Agent scope; reconcile totals to the lead
  pipeline and underlying records; retain one-customer/many-leads separation.
- Release allocation: Authorized on 2026-07-21 as `R1.1-AMD-016`, the final proposed Release
  1.1 enhancement before Release 2. It is a current-stage aggregate for the leads created in
  the selected dashboard period, not a stage-movement report. Connected calendar/viewing
  actions remain separately planned.
- Status: Accepted on CRM Test on 2026-07-22 after the complete 156-test suite and explicit NYSA
  owner confirmation; `R1.1-UAT-030` is closed. Revision 1 places the strip at the top of My
  dashboard, before filters and KPI cards,
  and excludes it from My Tasks. Revision 3 automatically refreshes the originating filtered
  dashboard after a successful stage change from lifecycle drill-down. Revision 4 forces a
  current-data read for both forward and backward movements instead of accepting cached counts.
- Acceptance condition: With controlled Agent A/Agent B fixtures, reconcile every stage count,
  prove cross-agent denial, drill each count to the exact records, execute each available next
  action and confirm the component refreshes without losing filter or breadcrumb context.

## Planning sequence

1. Preserve Release 2 campaign/source provenance through accepted Opportunity and Deal outcomes.
2. Approve the Release 3A campaign business owner, controlled fields, budget policy, targets and
   operational reporting definitions.
3. Implement and accept the provider-neutral campaign master before channel-specific automation.
4. Decide providers, account ownership, data residency, retention and consent/legal-basis rules.
5. Approve adapter contracts and sandbox credentials; never begin with production credentials.
6. Implement provider-neutral activity/calendar interfaces before individual connectors.
7. Add authenticated integration, permission, idempotency, failure/retry and reconciliation tests.
8. Deploy and test only on CRM Test before any separately authorized production promotion.
