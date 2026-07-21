# NYSA CORE Planned Enhancements

These records capture approved planning inputs that are not implemented by the current
Release 1.1 correction packages. Release allocation, provider selection, credentials,
privacy/compliance review and implementation approval remain separate gates.

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
- Status: Implemented locally and covered by the complete 155-test suite. CRM Test deployment,
  visual/functional retest and explicit owner confirmation remain pending; `R1.1-UAT-030` is
  open. Revision 1 places the strip at the top of My dashboard, before filters and KPI cards,
  and excludes it from My Tasks.
- Acceptance condition: With controlled Agent A/Agent B fixtures, reconcile every stage count,
  prove cross-agent denial, drill each count to the exact records, execute each available next
  action and confirm the component refreshes without losing filter or breadcrumb context.

## Planning sequence

1. Finish and explicitly accept the open Release 1/1.1 CRM Test findings.
2. Approve release allocation and business owner for each enhancement.
3. Decide providers, account ownership, data residency, retention and consent/legal-basis rules.
4. Approve adapter contracts and sandbox credentials; never begin with production credentials.
5. Implement provider-neutral activity/calendar interfaces before individual connectors.
6. Add authenticated integration, permission, idempotency, failure/retry and reconciliation tests.
7. Deploy and test only on CRM Test before any separately authorized production promotion.
