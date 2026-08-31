# Release 6 — Customer and Transaction Document Compliance

**Gate:** 4 — local completion  
**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** locally complete; migration unapplied  
**Migration:** `090_release6_customer_transaction_document_compliance.sql`

## Completion decision

The NYSA owner approved the Gate 3 local review on 14 August 2026. The Customer and Transaction
Document Compliance story is therefore complete at its authorized local/offline boundary.

This record does not authorize migration application, packaging, deployment, restart, external
connection or production use.

## Completed functional boundary

- Full Administrator directly maintains versioned Sale/Lease document matrices without
  maker-checker; Admin Assistant remains draft-only.
- Applicability resolves by buyer/seller/landlord/tenant, individual/organization and named Deal
  transition.
- The existing Deal checklist remains authoritative and presents its frozen party-document component
  as one combined checklist.
- Generic evidence reuses restricted Documents and immutable Document Versions.
- Official evidence reuses Release 4 identity, file, expiry and review authority by link rather than
  copying it.
- Generic evidence submission, replacement, review and follow-up are immutable, idempotent and
  scope-checked.
- Manager/Director ordinary review prevents uploader self-review; a full Administrator may decide
  directly with explicit same-actor audit evidence.
- Required items block only the configured Deal transition. Advisory and unexpired expiring evidence
  do not block.
- Expiry/renewal follow-up reuses the existing My Task Queue and responsible Deal agent.
- Customer view exposes only that customer's party requirements, while restricted file access is
  rechecked against exact Deal/Opportunity scope.
- No legal/compliance obligation is seeded automatically; Admin must explicitly activate approved
  requirements after a separately authorized future migration application.

## Verification baseline

- Focused document-compliance suite: **32/32 passed**.
- Complete local repository suite: **916/916 passed**.
- JavaScript syntax checks passed across domain, gate service, routes, server and browser UI.
- Synthetic owner-review surface passed HTTP smoke: root/JavaScript/CSS 200, POST 405 and outbound
  connections blocked by CSP.
- Gate 3 owner review covered Admin matrix, combined Deal checklist, customer-scoped view and existing
  My Task Queue behavior.

## Local artifacts

- Migration: `src/migrations/090_release6_customer_transaction_document_compliance.sql`
- Domain: `src/document-compliance-domain.js`
- Transition service: `src/document-compliance-gate.js`
- Authenticated routes: `src/routes/document-compliance.js`
- CRM UI: `public/document-compliance-ui.js`
- Synthetic review: `tools/document-compliance-local/`
- Tests:
  - `test/document-compliance-domain.test.js`
  - `test/document-compliance-integration.test.js`
  - `test/document-compliance-local.test.js`

## Promotion boundary

Migration 090 is deliberately unapplied. A future promotion requires a separate authorization,
environment-specific migration review, backup/rollback planning, approved NYSA matrix configuration,
deployment package, CRM Test verification and user acceptance. None of those actions are included in
this completion record.

No CRM Test, Production, R2, cPanel, Property Finder or external service was accessed or changed. No
credential or private owner/contact/authority information was requested, stored or displayed.
