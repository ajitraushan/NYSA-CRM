# CRM Test DEV204 — No-Teal Theme Refinement

## Scope

- Target: CRM Test only.
- Baseline: deployed `2.1.0-dev.203` package with verified SHA-256.
- Runtime delta: `public/index.html`, plus package version metadata.
- Database: no migration or data change.

## Approved visual change

- Remove teal from the rendered authenticated application theme.
- Use charcoal, neutral navy, warm grey and NYSA gold.
- Increase separation between the canvas, panels, tables, fields and sidebar.
- Preserve the desktop left sidebar and responsive horizontal mobile navigation.
- Preserve white print and PDF layouts.

## Safety and rollback

- The guarded deployer accepts only the exact DEV203 baseline or an idempotent DEV204 rerun.
- It verifies the package checksum and runtime manifest before installation.
- It creates a timestamped server backup before replacing runtime files.
- Rollback is to the deployer's recorded DEV203 backup and the unchanged CRM Test database.
- Production and the R2 clone are excluded.
