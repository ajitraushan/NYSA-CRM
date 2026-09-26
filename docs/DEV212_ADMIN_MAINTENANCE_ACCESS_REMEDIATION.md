# DEV212 Admin maintenance access remediation

## Baseline and scope

- Source baseline: `905581f286395500bd1e91d8134b36a6fa1d27d0`
- Source version: `2.1.0-dev.211`
- Target: CRM Test candidate `2.1.0-dev.212`
- Database/schema/configuration change: none
- Production impact: none; production is not targeted
- Rollback: redeploy the governed DEV211 package and source commit

## Defect

`DEF-ACC-001` — Admin was correctly denied business-process authority by the
central capability policy, but the CRM and Task routers then incorrectly
treated the configuration-only Admin as a non-staff identity. This blocked
configuration references used by the Administration workspace, including
Teams, Staff and the Admin's personal Task list.

## Corrected authorization model

1. An active Admin is an NYSA staff identity.
2. Admin is not an operational CRM identity and gains no Customer, Lead,
   Company, Inventory, Opportunity, Deal, Finance or payout authority.
3. The central governed Admin profile remains the only allow-list for Admin
   requests. It permits the Administration namespace and the specifically
   listed configuration-reference, Bulk Upload, leave and personal-task routes.
4. The CRM and personal-Task routers now verify NYSA staff identity without
   overriding the central capability decision.
5. Retired Admin Assistant, partner and external identities remain excluded.

## Required verification

- Admin: all Administration maintenance sections load, including Team and Staff
  references used by routing, users and dashboard-target configuration.
- Admin: permitted Team maintenance, configuration references, Bulk Upload,
  My Leave, Leave Administration and personal Tasks remain available.
- Admin: Customers, Leads, Companies, Inventory business operations,
  Opportunities, Deals, receivables, commission receipts and payouts remain
  denied through direct URLs and API calls.
- Operational roles retain their existing scoped CRM access.
- Retired Admin Assistant and non-staff identities remain denied.

No migration, data update or automatic role-assignment change is required.
