# NYSA CORE Microsoft 365 Email and Calendly - Gate 3 Local Review

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** local Gate 3 boundary accepted by owner; real-flow UAT deferred until authorized provider integration  
**Gate 2 authority:** approved by owner  
**Policies:** `r3d-microsoft365-email-v1`, `r3d-calendly-scheduling-v1`  
**Boundary:** local and reversible only; no provider, CRM environment or external service accessed

## Package completed locally

- Additive, unapplied migrations `093_release3d_microsoft365_email.sql` and
  `094_release3d_calendly_scheduling.sql`.
- Deterministic Email and Calendly policy domains.
- Disabled-by-default provider connectors plus network-free simulators.
- Public webhook receipt boundaries with Microsoft client-state and Calendly signature checks.
- Authenticated own-mailbox Email status, draft and exact send-confirmation boundaries.
- Authenticated staff Calendly readiness and scheduling-intent boundaries.
- Full-Administrator Calendly host and event-type mapping boundaries; Director may view status.
- Lead actions for **Email from CORE** and **Schedule with Calendly**.
- Admin Email and scheduling readiness panel.
- Synthetic Gate 3 walkthrough on loopback only.

## Owner decisions demonstrated

1. Every staff member uses only their own Microsoft 365 mailbox.
2. The Email recipient comes only from the maintained Customer record. There is no editable To, CC
   or BCC field.
3. Sending requires review of the exact draft and the exact `SEND_EMAIL` confirmation.
4. Provider acceptance is not treated as delivery; reconciliation retains the lifecycle evidence.
5. Unrelated mailbox messages are not retained or logged.
6. NYSA uses one Calendly team with explicit Admin-maintained host and event-type mappings.
7. Calendly supports both customer meetings and property viewings.
8. A customer-meeting booking projects one CRM Meeting Activity and cannot produce a duplicate
   calendar-origin event.
9. A property-viewing booking first creates evidence and one broker task in My Task Queue. Only
   broker confirmation followed by current Opportunity, Property Match and live Inventory
   revalidation may create the Viewing.
10. Cancellation and reschedule evidence is appended, never overwritten.

## Gate 3 review sequence

Open `http://127.0.0.1:3241/` while the local review server is running, then review:

1. **Email** - exact Customer authority, own mailbox, controlled purpose and reviewed draft.
2. **Admin mapping** - one team, explicit hosts, and separate customer-meeting/property-viewing
   event types.
3. **Customer meeting** - synthetic booking projects one Activity and duplicate replay projects none.
4. **Property viewing** - My Task Queue confirmation; select the stale-Inventory option to verify
   that no Viewing is created.
5. **Reconciliation** - original, duplicate, cancellation and rescheduled events remain explainable.

All displayed names, references and values are synthetic. The review server is GET-only, binds only
to `127.0.0.1`, and its browser content security policy blocks every outbound connection.

## Verification evidence

- JavaScript syntax checks: passed for domains, connectors, routes, staff UI, bootstrap, review
  server, review interaction and focused tests.
- Focused package: **26/26 passed**.
- Complete local CRM suite: **991/991 passed**.
- Loopback smoke: root `200`, interaction asset `200`, `connect-src 'none'` confirmed.
- No Property Finder implementation is referenced by this package.
- No credentials, private owner/contact/authority information or real mailbox/calendar values were
  requested, printed or stored.

## Intentionally not performed

- No migrations applied to any database.
- No Microsoft Entra application, OAuth authorization, mailbox subscription or Graph request.
- No Calendly OAuth application, team connection, webhook subscription or API request.
- No CRM Test, Production, production clone, R2, cPanel, deployment package, restart or promotion.
- No Property Finder work.

Provider OAuth callback completion, background dispatch/reconciliation workers and provider-backed
projection execution remain behind a separately approved provider-sandbox and migration-rehearsal
stage. Every current boundary fails closed until that authority exists.

## Owner review decision

The owner accepted the local review on 14 August 2026 and confirmed that meaningful end-to-end
testing can occur only after Microsoft 365 Email and Calendly are integrated into an authorized real
flow. Accordingly, the 26/26 focused tests, 991/991 complete suite and synthetic walkthrough prove
the local contract and fail-closed controls only; they do **not** claim provider-backed functional
UAT.

The owner subsequently approved Gate 4 local completion. Provider-backed UAT remains a named future
gate and cannot be silently waived by local completion.
