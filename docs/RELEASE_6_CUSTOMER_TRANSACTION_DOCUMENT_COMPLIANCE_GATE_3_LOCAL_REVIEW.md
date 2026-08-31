# Release 6 — Customer and Transaction Document Compliance

**Gate:** 3 — local implementation and owner review  
**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** owner-approved  
**Migration:** `090_release6_customer_transaction_document_compliance.sql` — created locally and unapplied

**Owner decision:** Gate 3 approved on 14 August 2026 (Asia/Dubai). Approval authorizes the Gate 4
local completion record only. It does not authorize applying migration 090, packaging, deployment,
restart or external-environment work.

## Implemented scope

- Versioned Admin-maintained Sale/Lease matrices for buyer, seller, landlord and tenant, split by
  individual/organization party kind and exact Deal transition gate.
- Full Administrator direct activation/retirement without maker-checker; Admin Assistant remains
  draft-only.
- Existing Deal checklist extended with an immutable party-document snapshot and exact requirement
  instances; no second general checklist.
- Restricted generic PDF evidence using existing Documents/Versions/private storage, immutable
  replacement chain, idempotency and cleanup on failed atomic submission.
- Existing Release 4 official evidence linked by identity/version/Deal without copying its file,
  issuer, expiry or review authority.
- Manager/Director review with ordinary self-review denial; full Administrator direct same-actor
  decision is explicitly audited.
- Required/advisory state derivation, calendar-day expiry/renewal windows and exact transition gates
  before approval and Close Won.
- Existing My Task Queue follow-up with responsible Deal agent assignment, safe metadata and one
  canonical reason/reminder/cycle.
- Customer-scoped compliance view that excludes the other transaction party and private file content.
- Restricted document view/download tightened to the exact associated Deal/Opportunity scope.

## Local owner-review surface

Open `http://127.0.0.1:3238/` and review the four tabs:

1. **Admin matrix** — direct Admin configuration, applicability, gates and expiry policy;
2. **Deal checklist** — accepted, missing and expiring party requirements in one checklist;
3. **Customer view** — only the selected customer's Deal-party requirements; and
4. **My Task Queue** — safe follow-up and renewal Tasks without private content.

The surface is synthetic, GET-only and loopback-only. Its Content Security Policy blocks outbound
connections. Buttons demonstrate the review flow but perform no business mutation.

## Verification

- New focused suite: **32/32 passed**.
- Complete local repository suite: **916/916 passed**.
- JavaScript syntax checks passed for domain, routes, server, CRM UI and review surface.
- Local review smoke: root, JavaScript and CSS returned HTTP 200; POST returned 405; CSP contains
  `connect-src 'none'`.
- No active compliance obligation is seeded by migration 090. Admin must explicitly create/activate
  NYSA-approved rules after a future authorized migration application.

## Files added or extended

- `src/migrations/090_release6_customer_transaction_document_compliance.sql`
- `src/document-compliance-domain.js`
- `src/document-compliance-gate.js`
- `src/routes/document-compliance.js`
- `public/document-compliance-ui.js`
- `tools/document-compliance-local/`
- focused domain, integration and local-review tests
- existing server, Deal transition/UI, Admin/customer UI, bootstrap and restricted document scope

## Review decisions requested at Gate 3

Please confirm that:

1. Admin matrix terminology and direct activation are clear;
2. the Deal checklist presents party, document, state and blocking transition adequately;
3. the customer view is sufficiently narrow;
4. missing and expiry follow-up belongs in existing My Task Queue as shown; and
5. the package may proceed to Gate 4 local completion recording.

Gate 3 approval does not apply migration 090 and does not authorize packaging, deployment, restart,
CRM Test, Production, R2, cPanel, Property Finder, credentials, private records or external services.
