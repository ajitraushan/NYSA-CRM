# CRM Test DEV209 — DEV208 rebuild and acceptance reconciliation

**Prepared:** 20 September 2026 (Asia/Dubai)  
**Source baseline:** deployed CRM Test `2.1.0-dev.208` / migration 127  
**Target:** CRM Test only  
**Production and R2 clone:** excluded  

DEV208 is treated as a failed UAT candidate. DEV209 is a new, rollback-safe candidate; it does not
overwrite the DEV208 evidence or claim that browser UAT has passed.

## Line-by-line UAT reconciliation

| UAT line / regression | DEV208 gap confirmed | DEV209 correction | Automated acceptance |
|---|---|---|---|
| 1. Sales Agent My Leave returned 500 | DEV208 tested only the no-employment empty state. The populated balance query ordered by a column omitted from `GROUP BY`. | Add `e.display_order` to the grouped query and exercise employment, balance and application endpoints with a populated synthetic employment. | Authenticated local PostgreSQL integration: all three endpoints HTTP 200; one governed entitlement returned. |
| 2. Listing Executive dashboard opened the wrong Inventory workspace | The earlier Inventory-first presentation is retained. | Retain the Listing Executive header and queue strip; no second action row is introduced. | Listing workflow regressions. |
| 3. Marketing Compliance returned 500 | Obsolete helper was already removed. | Retain the corrected central boundary. | Existing route and authenticated integration checks. |
| Market comparison wording unclear | Plain optional DLD comparison wording was already present. | Retained. | Existing UI regression. |
| Old pending work stopped Manager dashboard | DEV208 checked only that `/crm/tasks` returned 200. | Preserve explicit assignee access and independently project governed Manager work. | Full regression plus Manager task source contract. |
| 4. Pale/white status panels and unreadable text | DEV208 dark overrides were scoped to `#app.shell-layout`; full-screen Opportunity stages are mounted under `body`, outside that scope. | Apply semantic red/amber/green/blue dark surfaces globally, including Viewing, Booking & Reservation and Closure Steps. | Selector regression verifies all detached-stage surfaces use dark variables. |
| 5. “Completed · Open page” unclear | DEV208 did not change this label. | Display only the workflow status; the clickable control receives an accessible “Open … Status …” label. | Source regression prohibits the old visible wording. |
| Viewing form appeared in the wrong workflow context | Existing full-screen stage separation is retained; no creation-time presentation is added. | Retain stage-specific panes and verify the corrected stage presentation. | Existing Opportunity-flow regressions. |
| Inventory reference absent in Offer/Proposal | Existing PDF correction retained. | Retained. | Existing PDF source regression. |
| Booking language unclear | Existing accepted-Offer wording retained. | Retained. | Existing Booking regression. |
| Closure Steps and Booking/Reservation screens unreadable | Same theme-scope defect as item 4. | Global semantic theme correction applies to all detached stage workspaces. | DEV209 dark-surface regression. |
| 11. Closure approval pending but absent from Manager My Tasks | DEV208 exposed the case on the dashboard but did not add it to the task workspace; HTTP 200 was not evidence that the known task existed. | Project every ready, team-scoped Deal closure approval into Manager/Director My Tasks with a direct **Review closure** action. It disappears after the governed decision. | Exact task type, readiness query, merged queue and UI action are asserted. |
| DEF-124 Customer contact placement | Existing correction retained. | Retained. | Existing ordering regression. |
| DEF-125 Admin official-document maintenance | Existing correction retained. | Retained; Admin remains blocked from operational Deal evidence. | Authenticated 200/403 integration. |
| RR-015 Customer-only and Lead-only bulk intake | DEV208 incorrectly assumed a Manager/MD importer configured by Admin. | Central role capability grants both import modules to Sales Agent and Admin only. Manager and Director are denied. The legacy authorization table remains historical but is not consulted by active code or shown in Admin. | Capability unit tests and authenticated role-matrix integration. |
| Post-DEV208 regression: Sales Agent Inventory creation buttons and header disappeared | Inventory creation was hard-coded to Listing Executive/Manager in both browser and API. | Central Inventory capability grants Sales Agent, Listing Executive and Manager creation. Sales Agent receives one Inventory header with Upload and Create actions; API uses the same capability. | UI/API source contract and central policy unit test. |

## Access decisions

- **Purchased Customer Import:** Sales Agent and Admin.
- **Purchased Lead Import:** Sales Agent and Admin.
- **Inventory creation:** Sales Agent, Listing Executive and Manager.
- **Deal closure approval:** managed-team Manager or Director under the existing Deal approval policy.
- **Admin:** configuration, purchased-data intake and leave administration; no Customer, Lead,
  Opportunity, Deal evidence, Finance or payout operations.

These decisions are implemented through `src/role-access.js` and sent to the browser as capabilities.
The UI and API do not independently infer the above permissions from role names.

## Required CRM Test human acceptance

Automated checks do not close UAT. After DEV209 is deployed to CRM Test, verify with synthetic data:

1. Sales Agent with active employment opens My Leave and sees balances/history.
2. Sales Agent opens Inventory and sees one header plus Upload/Create actions; creates a Draft.
3. Sales Agent and Admin can open both purchased-data import modes; Manager and Director cannot.
4. Viewing, Booking & Reservation and Closure Steps contain no pale panels or illegible text.
5. The process strip shows `Completed`, not `Completed · Open page`.
6. A checklist-ready Deal appears in the responsible Manager's My Tasks and **Review closure** opens it.
7. Recheck DEF-124, DEF-125, Marketing Compliance, proposal/offer Inventory reference and booking wording.
8. Only after those pass, run the separate Deal → Finance → commission payout end-to-end scenario.

## Rollback and deployment boundary

The deployed DEV208 server backup remains
`/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`. DEV209 introduces no
database migration; rollback is an application-package rollback. A fresh server backup is still
mandatory before CRM Test installation. Nothing here authorizes Production deployment.
