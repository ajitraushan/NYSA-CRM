# CRM Test DEV205 — Role Access Separation

> Deployment revision: R3. R1 and R2 are superseded and must not be uploaded or deployed.

The corrected `r3-redeploy` deployer recognizes an earlier runtime with the same DEV205 semantic version, backs it up, and performs a guarded R3 replacement. It only exits as already confirmed when the complete runtime manifest matches R3.

## Baseline and target

- Source/deployed baseline: `2.1.0-dev.204`, package SHA-256 `9286d5697ea12fe7dcfed2b79bf5c464ab78c02b70df5e17fde37a7138e80840`.
- Target: CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`).
- Database: `nysareal_nysa_r2_rehearsal`.
- Migration status: migration-neutral; latest migration remains `126_executing_agent_tier_and_social_uplift.sql`.
- Rollback: guarded deployer backup of the exact DEV204 runtime.

## Approved access change

- Administrator is limited to system governance and configuration.
- Administrator cannot open business workspaces or direct business APIs for Customers, Leads, Inventory, Opportunities, Finance, payouts or leave administration.
- Managing Director remains the company-wide business reader and business approver.
- Admin Assistant owns leave policy, employment configuration, the leave register and leave decisions.
- Submitted leave routes to an active Admin Assistant, with self-approval prohibited.
- Admin Assistant receives a dedicated leave-administration workspace and has no general business or system-administrator access.

## Modular implementation

- One declarative server policy maps governed roles to named capabilities, workspace tabs and dashboard types.
- One ordered API policy maps route families to capabilities; route handlers do not select roles independently.
- The authenticated `/me` response supplies the governed workspace policy to the browser, so navigation is server-directed rather than duplicated in UI conditionals.
- Governed workspaces boot independently and do not call the business classification catalogue.
- Leave submission resolves its approver job role, routing reason and label from the central leave-workflow policy.
- Business-scope helpers share the same non-business-role boundary.

## Verification

- Syntax checks for every changed JavaScript file.
- Focused role-boundary, CRM-scope, leave-domain, dashboard and administration regression tests.
- Isolated-package manifest and checksum verification.
- CRM Test health/version check and authenticated human end-to-end UAT after deployment.

## Exclusions

- No production or R2 clone deployment.
- No database, schema or historical migration change.
- No commission, invoice, payout calculation, customer ownership or integration-contract change.
