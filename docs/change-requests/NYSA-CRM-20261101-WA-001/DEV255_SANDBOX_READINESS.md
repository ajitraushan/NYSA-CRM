# DEV255 sandbox foundation candidate

Prepared 1 November 2026, Dubai. Functional v1.1 approval applies; costs and
timelines are excluded. This is Stage A source preparation, not a claim that
bulk campaigns, AI or real sandbox connectivity are complete.

## Source scope

- Separate sandbox protocol and encrypted connection store; no change to the
  existing live WhatsApp adapter, CRM ownership, eligibility or workflows.
- Admin-only protected setup in the existing integration workspace. Secrets
  clear after submission and never appear in status responses. Credential save
  pauses sandbox sending, including the visible screen state.
- Durable quota reservations and logical-action uniqueness; accepted/rejected/
  unknown outcomes remain distinct. Unknown submissions block additional tests
  pending reconciliation. No blind retry. Same-key rotation does not reset quota.
- Authenticated, fixed-recipient inbound events with deduplication, altered
  replay rejection, STOP pause and callback-before-receipt status reconciliation.
- HMAC relay mode and a separately gated provider-Basic-header probe. The latter
  is a real-provider contract test still to perform, not an already verified
  sandbox capability. No unauthenticated ingress is available.
- Fixed-host callback configuration action uses the encrypted key and a private
  Basic header. Only the CRM Test callback URL is permitted. A configuration
  response is labelled separately from an observed authenticated callback.

## Migration and rollback

Migration `160_whatsapp_sandbox_foundation.sql` creates four sandbox-only tables.
It does not modify existing Customer, Lead, campaign or integration rows. All 160
migrations passed on a newly created, restricted local synthetic database.
Existing live credentials remain separate.

Local baseline and rollback remain DEV254 source `42b25cb4d84d93a33336a2c49149759d4b2ca9b6`
with evidence commit `8457d4bd785af01dde7a6f7ca92a657cb99b1393`. Hosted Test is
still DEV254/migration159; production remains RC1/migration140 on HOLD. Before
any separately approved Test deployment, refresh paired backups, verify encrypted
off-server recovery and origin provenance, and audit exact-root workers before
restart and after readiness. Code rollback must preserve sandbox evidence tables;
do not blindly drop them after messages have been submitted.

## Proposed Test setup, requiring exact deployment approval

Use the existing protected server connection key; do not copy it into this file.
Enable only the separate sandbox setup and Basic-header probe:

```
LEAD_RESPONSE_ENVIRONMENT=crm-test
WHATSAPP_SANDBOX_SETUP_ENABLED=true
WHATSAPP_SANDBOX_AUTH_MODE=basic
WHATSAPP_SANDBOX_NATIVE_PROBE_ENABLED=true
WHATSAPP_SANDBOX_PUBLIC_ORIGIN=https://crm-test.nysarealty.com
WHATSAPP_SANDBOX_ENABLED=false
WHATSAPP_SANDBOX_CALLBACK_APPROVED=false
WHATSAPP_SANDBOX_REQUEST_BUDGET=10
```

No live key is needed. After approved deployment, the user enters the sandbox key
and its fixed recipient privately in the Admin form and generates/records a
private callback secret. Saving keeps sending paused. The explicit Connect action
configures only the sandbox callback. A real phone message must demonstrate the
correct authentication header and encrypted durable receipt. If the sandbox does
not forward the configured header, keep ingress locked and resolve an approved
authenticated relay; do not remove authentication or use public capture sites.

Only after evidence review may sandbox sending and callback approval be enabled
for the fixed test recipient. Unpause is an explicit Admin action. Text replies
use the persisted inbound time; the browser cannot supply a fabricated window.
The local budget is conservative, not a claim about provider remaining quota.

## Acceptance already performed

- Focused protocol/routes tests and real PostgreSQL lifecycle with synthetic
  data: encrypted save, access boundaries, concurrent idempotency, quota, key
  rotation, replay conflicts, status ordering and unknown-outcome recovery.
- Full migration build: 160 applied successfully as a restricted fixture role.
- Eight browser cases: 390px/1440px, locked/empty/paused/ready states. Existing
  integration draft save remains functional; private fields clear; fixed callback
  action and test send are exercised with mocked APIs; no horizontal overflow.
- Governed regression is rerun from the exact origin commit by the mandatory
  package builder. Its final receipt is authoritative for the release candidate.

## Remaining acceptance / approval boundaries

Real provider sends, callback header support, template delivery and read callbacks
are not yet tested; no API key has been received. No hosted deployment, real
message, number migration, customer-data import, paid subscription or AI activation
has occurred. Stages B/C remain to implement after the foundation; unresolved
business selections and spending approvals remain live-activation gates.

Provider references checked: sandbox
https://docs.360dialog.com/docs/get-started/sandbox.md and header configuration
https://docs.360dialog.com/docs/messaging/webhook . Live-header documentation does
not by itself prove sandbox-header forwarding; the probe is mandatory.
