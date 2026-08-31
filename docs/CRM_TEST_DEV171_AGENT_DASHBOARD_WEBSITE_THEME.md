# CRM Test dev.171 — DEF-094 Agent dashboard website theme

## Boundary

- Target: CRM Test only.
- Cumulative baseline: `2.1.0-dev.170` with migration 107.
- Production, R2 and Property Finder remain excluded.
- No database migration is required; migration count remains 107.

## Change

The Agent dashboard uses the approved NYSA website visual language without changing dashboard data, role scope or
workflow behavior:

- official website palette: Ink `#0a2233`, Pine `#315f55`, Bronze `#a9783a`, Gold `#d0aa64`, Mineral `#eee7dc`,
  Alabaster `#faf8f3`, Mist `#eef0eb` and Muted `#5f6d73`;
- website typography stack: Inter for interface text and the approved Iowan/Palatino/Baskerville/Georgia serif stack
  for dashboard headings;
- proportional responsive headings and controls;
- official existing NYSA horizontal and compact logo assets remain the application identity;
- governed Overdue, Urgent and Due today states remain text-labelled and retain their semantic status colours.

## Preservation gate

The release must retain all dev.167 through dev.170 behavior, including ranked Inventory pagination and return,
Agent dashboard progressive disclosure, role-scoped task and team views, Opportunity stage workspaces, direct-route
race protection and the Inventory-stage binding correction. Automated checks and successful deployment are not a
human UAT-094 pass.
