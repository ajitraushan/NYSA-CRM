# CRM Test dev.168 — DEF-091 direct-route dashboard race correction

## Boundary

- Cumulative baseline: CRM Test `2.1.0-dev.167`, including DEF-086 through DEF-090.
- Correction: DEF-091 / UAT-091 only.
- Target: CRM Test only.
- No schema migration; migration count remains 106.
- Production, R2 and Property Finder remain excluded.

## Correction

A direct Customer, Lead, Inventory or Opportunity URL may replace the dashboard while its initial asynchronous
filter-option request is still running. The dashboard renderer now exits when its source filter no longer exists or
its render sequence has been superseded. It does not bind events or start dashboard-data requests against a removed
dashboard DOM.

This preserves all dev.167 ranking, assignment, dashboard, proposal, task, hierarchy and role-scope behavior.
Automated and deployment evidence do not constitute human UAT passage.
