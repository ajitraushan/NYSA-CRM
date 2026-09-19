# CRM Test DEV203 — Charcoal-Navy Theme Refinement

## Scope

- Target: CRM Test only.
- Baseline: deployed `2.1.0-dev.202` package with verified SHA-256.
- Runtime delta: `public/index.html`, plus package version metadata.
- Database: no migration or data change.

## Approved visual change

- Replace the saturated navy/teal page treatment with a quieter charcoal-navy palette.
- Keep gold as the principal NYSA accent.
- Use teal only for active, positive, or successful states.
- Preserve the desktop left sidebar and responsive horizontal mobile navigation.
- Preserve white print and PDF layouts.

## Safety and rollback

- The guarded deployer accepts only the exact DEV202 baseline or an idempotent DEV203 rerun.
- It verifies the package checksum and runtime manifest before installation.
- It creates a timestamped server backup before replacing runtime files.
- Rollback is to the deployer's recorded DEV202 backup and the unchanged CRM Test database.
- Production and the R2 clone are excluded.
