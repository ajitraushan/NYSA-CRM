# WA-001 v1.1 implementation approval

Recorded 1 November 2026, Asia/Dubai.

User instruction: "i apporve except cost and timlines.. please commence implementation."

The functional requirements and design in v1.1 are approved for implementation.
Costs, rates, budgets and dated delivery estimates are excluded from approval.
The original approval PDF remains immutable, SHA-256:
`fd1abd96e0b044fdb016f619ebf19e96a1bbb527a62d0b4fa1d8a563c79d3124`.
This approval record qualifies the document; it does not rewrite historical
"For approval" text in the issued artifact or approve the excluded sections.

Unselected alternatives and unfilled assignments remain unresolved activation
gates: language selection, named operational/compliance/material owners, approved
AI processor terms, staging number/payer, actual account capacity and financial
caps. Implement fail-closed controls without inventing those values. The proposed
09:00–18:00 limit and seven-day marketing cap govern implementation; no live
marketing activation is authorised by this record.

## Development baseline and rollback

- Isolated branch: `codex/dev255-whatsapp-sandbox`.
- Source starting point: `8457d4bd785af01dde7a6f7ca92a657cb99b1393`
  (DEV254 deployment evidence); runtime source remains deployed DEV254 commit
  `42b25cb4d84d93a33336a2c49149759d4b2ca9b6`.
- Local application version remains `2.1.0-dev.254` until an integrated candidate
  is prepared. No partial foundation is represented as DEV255 deployed.
- Migration baseline 159; no migration or database mutation in this increment.
- Rollback: original runtime is reproducible from the above commits; new
  sandbox foundation is isolated in new files and not mounted in the server.
- Existing v1.0/v1.1 artifacts are retained. No hosted baseline or backup is
  modified; refresh paired recovery before any later approved deployment.

## Stage A increment 1

Separate sandbox envelope/transport, bounded provider receipts, required durable
attempt interface, fixed recipient/host, phone and BSUID events, deterministic
opt-out detection and authenticated NYSA-relay verification. No existing live
adapter, server route, protected settings or frontend is changed.

This is protocol foundation, not completed connectivity: persistence/quota ledger,
protected Admin setup, authenticated ingress wiring and real provider checks are
still required. Relay verification is not a claim that 360dialog signs callbacks
with the NYSA relay key. Resolve the real provider callback authentication contract
before enabling ingress. Do not remove authentication as a workaround.

No production/CRM Test deployment, provider setup, REM operation, live message,
credential entry, financial commitment or AI activation is performed here.

## Verification of increment 1

- Focused suite: 15 passed, zero failures, including ten new sandbox tests and
  five existing connector tests.
- Governed release selection: 1,606 tests; 1,512 passed, 94 intentionally skipped,
  zero failures. The restricted first run hit loopback EACCES in existing HTTP
  tests; the permitted local-network rerun passed without code changes.
- No database migration or fixture mutation was needed. These are synthetic
  protocol tests, not evidence of real sandbox delivery or callback receipt.
- No existing runtime file is modified. The new module is not imported by the
  server; actual integration and hosted acceptance remain future increments.
