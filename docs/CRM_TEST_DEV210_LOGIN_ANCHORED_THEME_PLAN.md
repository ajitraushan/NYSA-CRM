# CRM Test DEV210 — Login-Anchored Theme Alignment

## Baseline and scope

- Source baseline: Git commit `8334c3d26a59129efb5ee83215ec3ec3de5dc937` on
  `codex/crm-dev209-rebuild`.
- Development branch: `codex/crm-dev210-login-anchor-theme`.
- Target environment: CRM Test only after separate deployment approval.
- Deployed rollback remains CRM Test DEV208 at
  `/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`.
- Production and the R2 clone are outside scope.

## Acceptance criteria

The authenticated shell uses the login screen as its visual anchor:

- near-black warm charcoal workspace and surfaces rather than cool slate-blue panels;
- the login screen's bronze-gold accent, ivory primary text and warm-grey secondary text;
- subtle bronze ambient highlights, restrained shadows and moderately rounded controls;
- one shared token set across dashboards, registers, forms and detached workspaces;
- no Dubai photograph behind operational screens, preserving information density and readability;
- semantic error and status colours, printable documents and role/access behaviour remain unchanged.

## Risk and rollback

This is a presentation-only change in `public/index.html`. It has no database migration, data,
permission, workflow or integration impact. Rollback is the exact DEV209 Git source commit above.
