# DEV263 full local WhatsApp simulator flow

Date: 4 November 2026 (Dubai)

Environment: disposable local PostgreSQL fixture and ephemeral local HTTP server

Provider URL: deliberately unreachable loopback address `http://127.0.0.1:9/api/providers/whatsapp-simulated`

External providers: not contacted

## Results

| Requested path | Result | Evidence checked |
| --- | --- | --- |
| Template simulated submit — approved, rejected, pending | PASS | Three independent template versions reached the exact configured terminal/pending state; rejected reason retained. |
| Inbound — CTWA, button reply, media | PASS | CTWA source and entry time persisted; button text persisted; image type and caption persisted. |
| Conversation send — sent, delivered, read | PASS | One outbound message was observed through `accepted → sent → delivered → read`. |
| Conversation simulated failure | PASS | One outbound message was observed through `accepted → sent → failed`. |
| Frozen campaign recipient list and per-recipient status | PASS | Two frozen recipients each reached `read`; a second launch reported two unchanged and created zero additional sends. |
| timeout | PASS | HTTP 504, accessible UI banner, repeated request created no outbound row. |
| rate limited | PASS | HTTP 429, accessible UI banner, repeated request created no outbound row. |
| server error | PASS | HTTP 503, accessible UI banner, repeated request created no outbound row. |
| invalid number | PASS after correction | Migration 167 aligns the database check constraint with the application whitelist; HTTP 400, accessible UI banner, no outbound row. |
| invalid payload | PASS | HTTP 502, accessible UI banner, repeated request created no outbound row. |
| template paused | PASS | HTTP 409, accessible UI banner, no template-status event created. |
| 23-hour window | PASS | Free-form reply open; CTWA free-pricing window open. |
| 25-hour window | PASS | Free-form reply closed; CTWA free-pricing window open. |
| 71-hour window | PASS | Free-form reply closed; CTWA free-pricing window open. |
| 73-hour window | PASS | Both windows closed. |
| Run cleanup | PASS | Run conversation, Lead and Contact removed; run marked cleaned. |
| Global cleanup | PASS | Simulated conversations/messages removed; provider template states reset; audit evidence retained. |

## Browser evidence

The real tracked `public/whatsapp-workspace-ui.js` (SHA-256
`9c7aac3bd463ce5940f289773b1a399417cef31e388aba3b4b3750428e7d395b`)
was loaded in headless Chrome as a synthetic Sales Agent. Template library,
Recipient import, Segments, Campaign composer, Conversation inbox and Materials
catalogue all rendered. All six fault messages appeared in a persistent
`role="alert"` banner. Page errors: 0. Console errors: 0.

## Regression

- Governed release selection: 305 test files included, 93 historical local
  artifact files excluded.
- Result: 1,547 passed, 98 skipped, 0 failed.
- Selection SHA-256:
  `4c98f87c4cf37751eb678c46268089cb0e04f455565b8c6cfe34d73a9dee452b`.
- Fresh fixture rebuild: 167 migrations, latest
  `167_whatsapp_simulator_fault_contract.sql`.

The integration fixture and all test identities/data were synthetic. CRM Test,
production, website, REM, 360dialog and Meta were not changed.
