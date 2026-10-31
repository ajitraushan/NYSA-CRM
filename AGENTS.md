# NYSA CRM Development Instructions

These instructions apply to every task in this project.

Before auditing, coding, migrating, importing, testing or deploying CRM work,
read `CRM_CHANGE_POLICY.md` and `BASELINE.md` in full.

- NYSA CORE/CRM is authoritative for customers, leads, inventory, eligibility,
  availability, assignment and compliance.
- Start by recording the application version, file/database snapshot, target
  environment and rollback point. If no reproducible baseline exists, create a
  dated recoverable snapshot before mutation.
- Use synthetic or explicitly approved test data. Do not expose credentials or
  personal/customer data in code, logs, screenshots or task output.
- Develop and verify in the test environment. Production data, schema,
  configuration and deployment require explicit approval for that exact change.
- Do not silently change business rules, access controls, ownership, compliance
  decisions or integration contracts.
- Report migrations, tests, security/privacy impact, backup/rollback and the
  production state at completion.

## Mandatory hosted-worker verification

- Every hosted deployment must audit Node.js workers for the exact application
  root before the controlled restart and again after post-start readiness.
- After requesting `/api/readiness`, exactly one `lsnode:<exact-app-root>/`
  worker must be present and it must serve the expected version with database
  readiness green. An idle pre-request count of zero may be normal on cPanel;
  zero after the readiness request or more than one worker fails deployment
  acceptance.
- Stop or kill workers only after verifying both their exact application-root
  command marker and `/proc/<pid>/cwd`. Never use a broad Node.js process kill.
- A stale or duplicate worker makes the deployment incomplete. Reconcile the
  process lifecycle, perform the single controlled start, and repeat readiness
  plus worker-count verification before connector or external-write testing.

## Mandatory release packaging

- The only authorized packaging command is
  `npm run release:package -- --commit <full-40-character-origin-SHA>`.
- The SHA must already be advertised by the configured GitHub `origin` through
  a branch or tag. An unpushed commit is not releasable.
- Packaging from the current working directory is prohibited, even when it is
  clean. The canonical builder creates and removes a detached temporary
  checkout and reads governed package content only from that checkout.
- Historical `tools/build-isolated-dev*.mjs` scripts are archival and must not
  be used for a new package. Current legacy builders fail through the deprecated
  source-control gate.
- Before deployment, run `npm run release:verify-package -- <zip> <manifest>
  <manifest-sha256-file>`. Missing or mismatched provenance fails closed.
