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

- Every deployment preparation plan, approval packet, operator and completion
  report must cite this section and the hosted-deployment controls in
  `CRM_CHANGE_POLICY.md`. Treat them as acceptance criteria, not optional
  operational guidance.
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
- Never hand over, approve or describe a deployment as complete while a stale,
  duplicate or unverified exact-root worker remains after deployment.

## Mandatory deployment operator controls

- For CRM Test, the only permitted operator source is
  `tools/crm-test-direct-node-release-operator.mjs` from an exact, advertised
  GitHub commit. Never create, copy, rename or generate a release-specific
  operator locally or on hosting (for example, `DEV262_OPERATOR.mjs`).
- Before every run, verify and record that the operator's origin commit and
  SHA-256 on hosting exactly match GitHub. Demonstrate in a non-mutating test
  that the full scoped-backup path is passed as an operator input. Release
  details such as version, package and backup path must be parameters, not a
  derived operator copy.
- Any operator change requires a new GitHub commit, operator tests and separate
  approval before use. The application candidate approval does not authorize a
  changed operator.
- A deployment operator must not modify the installed application's
  `package.json`, runtime manifest or any other governed runtime file merely to
  make itself runnable. Invoke it directly with the approved Node.js executable
  from outside the application root.
- Stage/preflight must be non-mutating and must complete every available
  integrity check before deployment starts: exact origin provenance and hashes,
  installed-runtime manifest with exact expected/actual mismatch reporting,
  database identity and migration ledger, backup identity/freshness, registered
  configuration guards and exact-root worker inventory.
- Backup paths, freshness limits and environment identities must be explicit
  operator inputs or approved configuration, not unexplained release-specific
  assumptions. Record the resolved values in the evidence.
- Do not launch a browser on shared hosting when the platform cannot support it.
  Record the check as deferred and run it remotely against the deployed target
  before acceptance.
- Run the approved stage and deployment no more than the authorized number of
  times. On a failure, timeout or stall, stop and report the exact completed
  phase and safe error; do not retry or broaden the operation without new
  approval.

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
