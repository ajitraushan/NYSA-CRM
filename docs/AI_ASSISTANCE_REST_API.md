# Governed AI Assistance REST API

Environment: CRM Test only until UAT approval.

The AI service provides advisory drafts. It never saves a customer requirement,
changes deterministic property eligibility, selects proposal inventory, or corrects an
authoritative record automatically. Every response requires human confirmation.

## Server configuration

Maintain these only as cPanel Node.js environment variables. Never place a real key in
Git, an uploaded `.env` file, a browser, or a proposal.

```text
OPENAI_API_KEY=<server-side secret>
OPENAI_MODEL=gpt-5.6-luna
OPENAI_API_BASE_URL=https://api.openai.com/v1/responses
OPENAI_TIMEOUT_MS=30000
AI_MAX_INPUT_CHARS=12000
```

The model is configurable so an approved model can be pinned without changing source.
The application uses the Responses API with strict JSON Schema output and `store:false`.

## Authentication and scope

All routes require an authenticated internal NYSA CRM identity and existing lead-read
scope. The browser never receives `OPENAI_API_KEY`. Direct email, phone and identity
number patterns are removed from conversation notes before transmission. Full identity
numbers and identity documents are prohibited inputs.

Each invocation creates `ai_assistance_runs` metadata containing function, model,
input hash, safe provider response ID, status, latency, requester and safe error code.
Raw prompt text and raw AI output are not stored in that table or audit details.

## Routes

### Service status

`GET /api/crm/ai/status`

Returns whether the server is configured, the configured model, available functions
and the advisory-only flag. It never returns the key.

### Draft structured requirements

`POST /api/crm/leads/:leadId/ai/requirements-draft`

```json
{
  "conversationNotes": "Buyer seeks either a two-bedroom Dubai Marina apartment up to AED 2.5m or a family townhouse; mortgage pre-approval is not yet confirmed."
}
```

Returns one to three draft requirement options, must-haves, preferences, exclusions,
unanswered questions, warnings and confidence. The result is not saved. The agent must
review it with the customer and use the normal versioned requirement workflow.

### Explain a deterministic inventory comparison

`POST /api/crm/leads/:leadId/ai/match-explanation`

```json
{
  "listingId": "<inventory UUID>"
}
```

The server reads the current requirement and inventory record, computes factual
comparison evidence and asks AI only to produce concise `whyItMatches`, `tradeOffs` and
customer-summary wording. AI cannot change eligibility or invent a score.

### Identify missing information

`POST /api/crm/leads/:leadId/ai/missing-information`

```json
{
  "purpose": "proposal",
  "listingIds": ["<inventory UUID 1>", "<inventory UUID 2>"]
}
```

`purpose` may be `proposal` or `matching`; no more than three inventory records are
accepted. The response separates blocking gaps from recommended improvements, states
the authoritative source record and supplies concise follow-up questions.

## Failure behaviour

- Missing API configuration returns HTTP `503` and `ai_not_configured`.
- Oversized minimized input returns HTTP `413`.
- Provider timeout returns HTTP `504`.
- Provider errors, invalid output and refusals return safe codes without provider
  payloads or secrets.
- No failure creates or changes a customer requirement, inventory match or proposal.

## Official API basis

- Responses and structured outputs:
  <https://developers.openai.com/api/docs/guides/structured-outputs>
- Data controls:
  <https://developers.openai.com/api/docs/guides/your-data>
- Model catalogue:
  <https://developers.openai.com/api/docs/models>
