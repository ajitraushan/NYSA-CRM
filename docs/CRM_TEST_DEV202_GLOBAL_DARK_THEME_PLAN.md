# CRM Test DEV202 Global Dark Theme

Date: 2026-09-16 (Asia/Dubai)

## Baseline and target

- Source baseline: exact deployed CRM Test package `2.1.0-dev.201`.
- Baseline SHA-256: `255f20f68a334206d546f5d4d18b4e9034353e833a544d6c100d4c410967f995`.
- Local rollback snapshot: `tmp/dev202-global-dark-baseline-20260916`.
- Target environment: CRM Test only, after explicit owner confirmation.
- Production and the R2 clone are excluded.

## Change

Apply the approved Receivables dark navy-to-teal visual language to every authenticated
CORE page. The shared shell, left navigation, content background, panels, tables, form
fields and buttons use one dark token system. Legacy light Agent-dashboard overrides and
semantic warning, success, information and error surfaces receive explicit dark variants.

Printable proposals, invoices, payout calculation sheets and other generated documents
remain white. No business rule, data, schema, permission, workflow or integration changes.

## Verification and rollback

- Verify the focused DEV202 theme contract and the existing Receivables workflow contract.
- Verify balanced style blocks/braces and package runtime delta.
- The deployment package must differ from DEV201 only in `public/index.html`, `package.json`
  and `package-lock.json`.
- Rollback restores the pre-DEV202 application archive. Migration rollback is unnecessary
  because DEV202 is migration-neutral.
