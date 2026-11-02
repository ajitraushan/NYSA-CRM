# DEV262 CRM Test WhatsApp Simulator

## Purpose

DEV262 provides an isolated local WhatsApp-provider contract for synthetic
end-to-end testing on CRM Test. CORE still performs the outbound HTTP call and
receives provider callbacks; the remote provider is replaced by a loopback-only
stub. It does not connect Meta, 360dialog, REM, the website, or production.

## Fixed safety boundary

- The feature defaults off and can start only when
  `LEAD_RESPONSE_ENVIRONMENT=crm-test`.
- The provider URL must be loopback HTTP under
  `/api/providers/whatsapp-simulated`.
- Live WhatsApp credentials cannot coexist with the enabled simulator.
- Only `+971509000000` through `+971509999999` are accepted by default.
- Administrator authentication is required for provider control, injection,
  load-run creation and cleanup. Agents see only conversations they own;
  Managers see their teams; Directors see all governed teams.
- Simulated conversations, messages, statuses and audit events are explicitly
  marked. Payload evidence is SHA-256, not message content.

## Configuration

The simulator remains inert unless all required values are supplied by the
CRM Test runtime:

```text
LEAD_RESPONSE_ENVIRONMENT=crm-test
WHATSAPP_SIMULATED_PROVIDER_ENABLED=true
WHATSAPP_SIMULATED_PROVIDER_URL=http://127.0.0.1:<PORT>/api/providers/whatsapp-simulated
WHATSAPP_SIMULATED_PROVIDER_TOKEN=<private random value of at least 32 characters>
WHATSAPP_SIMULATED_PHONE_PREFIX=+971509
WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS=6
```

Provider sending is also paused in the database by default. An Administrator
must explicitly unpause it through the guarded control endpoint.

## Capabilities

- Template submission: pending, approved or rejected with a synthetic reason.
- Session and template messages with deterministic idempotency keys.
- Status callbacks: sent, delivered, read, or sent then failed.
- Text, media and button inbound messages through the real callback route.
- STOP, UNSUBSCRIBE, Stop promotions and maintained Arabic suppression terms.
- CTWA referral, distinct 24-hour reply and 72-hour pricing windows.
- 23, 25, 71 and 73-hour backdating.
- Timeout, HTTP 429, HTTP 5xx, invalid-number, malformed-response and
  template-paused faults.
- Frozen-list campaign simulation with one message per unique approved phone.
- Seeded 1,000/10,000 conversation loads, 0–96-hour spread, 30% CTWA,
  20% unread, long threads, opt-outs, 5/20/50 msg/s and 20 workers.
- Per-run cleanup and one guarded all-simulator cleanup command.

## Load and cleanup commands

The commands require a private Administrator session token in
`NYSA_SIMULATION_SESSION_TOKEN`; it must never appear in logs or arguments.

```powershell
npm run wa:simulation:load -- --run <run-uuid> --url https://crm-test.nysarealty.com
npm run wa:simulation:cleanup -- --url https://crm-test.nysarealty.com --confirm DELETE-SIMULATED-ONLY
```

Cleanup deletes only records carrying the simulator marker and reports exact
conversation, message, Lead and Contact counts. Provider audit events are
retained as evidence and remain visibly marked `SIMULATED`.

## Release acceptance

Before activation on CRM Test, the exact origin-built candidate must pass:

1. the complete release regression;
2. the guarded PostgreSQL integration test, including migration 166;
3. the actual packaged workspace file in Chromium;
4. STB-01 through STB-15 with synthetic data;
5. remote role/visibility, first-page performance and cleanup checks;
6. readiness and exactly one verified worker for the CRM Test application root.

Deployment must use the governed direct-node operator and a scoped CRM Test app
archive plus PostgreSQL custom-format dump created and verified in the same run.
No simulator configuration is approved for production.
