# Release 2.5 dev.50 — Full remediation acceptance

CRM Test only. Production and the frozen Release 1.1 candidate are outside scope.

| Ref | Remediated scope | Automated evidence | Result |
|---|---|---|---|
| R2.5-UI-SHELL-001 | Fixed application header/tabs; only workspace content scrolls; visible application version | UI shell regression contract | PASS |
| R2.5-INV-VER-001 | Inventory verification is a governed request/decision workflow; status is system controlled | Domain, migration, API and Manager-queue tests | PASS |
| R2.5-REG-INV-VER-002 | Submit sets Pending; approval sets Verified; return/reject and expiry are explicit; Not required is a governed terminal exemption | Verification transition and regression tests | PASS |
| R2.5-INV-VER-003 | Verification and inventory approval are separate queues and decisions | Queue and route tests | PASS |
| R2.5-REG-INV-TERM-004 | Inventory approval wording is separated from optional external-portal publication | UI and external-publication lifecycle tests | PASS |
| R2.5-FIN-UX-006 | Occupancy rate replaces vacancy rate; net-yield calculation uses effective rent correctly | Financial-domain and browser contract tests | PASS |
| R2.5-FIN-SCN-007 | Multiple immutable scenarios can be saved and compared | Scenario comparison contract | PASS |
| R2.5-REG-OPP-INV-008 | Multiple selected inventory records carry from Lead to Opportunity without re-entry | Lead/Opportunity carry-forward tests | PASS |
| R2.5-CAL-DATA-009 | Viewing invite includes full customer address and representative email/phone when maintained; correction/reissue is governed | Calendar route and UI tests | PASS |
| R2.5-VIEW-UX-010 | No-show prompts a prefilled reschedule; cancellation does not require an artificial follow-up due date | Viewing workflow tests | PASS |
| R2.5-PARTY-MODEL-012 | Transaction counterparties are independent of Customer Master and require explicit linking | Party model and closure-gate tests | PASS |
| R2.5-COBROKER-013 | Buyer-representation, inventory-representation and dual-NYSA paths are explicitly branched with agents, agencies, external property and commission evidence | Representation-domain, migration, API and downstream transaction tests | PASS |
| R2.5-REG-CACHE-014 | Browser assets carry the dev.50 cache identity | Cache regression contract | PASS |
| R2.5-REG-CLOSE-015 | Manager/Director can approve, return for correction or reject; mandatory seller evidence blocks approval; app role has checklist permission | Closure API, permission and UI tests | PASS |
| R2.5-REG-DIARY-016 | Diary DISTINCT ordering regression is corrected | Diary query regression test | PASS |
| R2.5-DASH-SCOPE-017 | Agent priority cases contain only agent-owned actions; every operating-sequence count opens its exact same-scope contributing population | Connected-operations scope and drill-down tests | PASS |
| R2.5-NAV-SEQ-018 | Leads precedes Opportunities in the primary application navigation | Shell navigation regression test | PASS |
| R2.5-MORT-AMT-019 | Mortgage calculator amount inputs accept K/k, M/m and comma-formatted values and normalize them before calculation | Business-amount UI and mortgage-domain tests | PASS |

Full automated suite: **215 passed, 0 failed**.

Deployment baseline: `2.0.0-dev.45`, migration `050_release2_customer_kyc_uat_corrections.sql`.

Deployment target: `2.0.0-dev.50`, migrations `051_release2_final_uat_remediation.sql` and `052_release2_full_remediation_foundation.sql`.
