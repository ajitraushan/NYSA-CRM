# WA-001 Stage A sandbox outbound evidence

1 November 2026. Target: CRM Test DEV257 only.

## Approved boundary

The user authorized temporary sandbox-only activation with callback approval,
sending enabled and a local request budget of five. The authorization covered
one text reply, one predefined sandbox template, delivery evidence and STOP for
the single fixed test recipient. Production, the live WhatsApp receiver, REM and
the website were explicitly excluded.

## Results

- Authenticated inbound prerequisite: passed; one verified reply event existed
  before sending was enabled.
- Predefined sandbox template: submitted once, provider accepted, delivered and
  then read. No retry.
- Verified-conversation text reply: submitted once, provider accepted, delivered
  and then read. No retry.
- Local request control: two reservations used of five; three remain.
- STOP: one authenticated opt-out event recorded from the fixed recipient.
- Fail-safe outcome: STOP automatically paused the sandbox connection and the
  send control became unavailable.
- Pre-close hosted state: paused connection, two attempts, one verified reply,
  callback authentication approved, database readiness green and exactly one
  exact-root worker.
- Approved close-out: both sandbox activation flags were returned to false and
  the request budget to its non-active value of ten. The connection stayed
  paused; the test-phone opt-out and audit trail were retained.

No phone number, provider message identifier, message body, API key, callback
secret or encrypted event content is copied into this evidence file.

## Template interpretation

The disclaimer/privacy wording seen on the phone came from 360dialog's
predefined sandbox template. The sandbox does not support NYSA-authored custom
templates. This validates the transport and status path only. Production must
use NYSA-branded templates created and approved through Meta/WhatsApp Manager;
the sandbox wording must not be presented as NYSA production content.

## Verification

- Runtime: `2.1.0-dev.257`.
- GitHub origin commit: `b4a12928aa3678757d5c725a7f1d3861707c9c9c`.
- Final verification: `2026-11-01T08:40:13.220Z`.
- Database readiness: green.
- Exact-root worker count after readiness: one (`1244645`).
- Fail-closed configuration completed: `2026-11-01T08:41:00.167Z`.
- Post-close database readiness: green.
- Post-close exact-root worker count: one (`1373531`).
- Post-close flags: sandbox enabled `false`; callback approved `false`; request
  budget `10`.
- Production/main/website/REM mutation: none.

## Post-test control

Completed under explicit approval. The database connection is paused,
`WHATSAPP_SANDBOX_CALLBACK_APPROVED=false`,
`WHATSAPP_SANDBOX_ENABLED=false`, and the non-active request budget is ten.
Reactivation requires a new approval.
