# CRM Test dev.173 Agent dashboard information hierarchy

**Target:** CRM Test only  
**Baseline:** `2.1.0-dev.172` with migration 107  
**Database change:** none  
**Human UAT:** pending

## Approved dashboard hierarchy

- The duplicate visible `NYSA CORE / AGENT WORKSPACE / {user} dashboard` identity block is removed from the
  Agent dashboard. A visually hidden `My dashboard` heading remains for accessibility.
- `My dashboard`, `My Team`, `My tasks`, saved views and dashboard actions remain the first visible dashboard
  controls.
- A compact **Operations overview** follows the controls. It keeps **Pipeline at a glance** visible and places the
  complete Customer-to-Deal operating sequence in an expandable disclosure within the same overview.
- **What needs attention now** follows the overview and retains its governed urgency colours, exact records and
  actions. Performance, SLA and supporting detail remain secondary disclosures.

The pipeline answers where active work is now. The operating sequence explains the complete end-to-end journey.
They share one overview but do not receive equal visual weight.

## Environment and version identity

- CRM Test, R2 clone, Local and unknown environments retain a visible environment warning in the shared header.
- Production has no redundant `Production` environment badge.
- The application version is removed from the shared header and appears under **Administration → About**, together
  with the application and environment identity.

## Isolation and acceptance boundary

This is a frontend information-hierarchy and identity change only. No migration or business rule changes are
included. Production, R2 and Property Finder are excluded. Automated checks and technical smoke observations do
not establish a human UAT pass.
