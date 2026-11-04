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
- Before requesting approval for a hosted run, verify and record that all
  operator output paths are absent, including the candidate staging directory,
  scoped-backup directory and evidence/output directory. A pre-existing output
  path fails pre-run acceptance; do not delete, rename, overwrite or reuse it
  without separate explicit approval.
- Do not launch a browser on shared hosting when the platform cannot support it.
  Record the check as deferred and run it remotely against the deployed target
  before acceptance.
- Run the approved stage and deployment no more than the authorized number of
  times. On a failure, timeout or stall, stop and report the exact completed
  phase and safe error; do not retry or broaden the operation without new
  approval.
- CRM Test uses four separately invoked and separately approved canonical
  operator phases: stage/package verification, scoped backup verification,
  quiesce/install/configure/start, and settled smoke/report. Never combine the
  four approvals into one command. Bind each phase receipt to the exact commit,
  version and configuration hash before allowing the next phase.
- Settled smoke is read-only and must retain every attempt during a bounded
  30-60 second window, including timestamp, status, safe body snippet and server
  header. A smoke failure on a healthy application stops and reports; it does
  not automatically roll back.
- Automatic install/start recovery is application-only: restore the prior
  application files and original selector environment, never the database.
  Database restore is a separate explicitly approved action. Automatic
  application rollback is permitted only before readiness has returned green
  with one verified worker. After that acceptance point, any later failure must
  preserve the running application and evidence and stop/report.
- Any rollback must finish with the domain serving NYSA CORE at `/`, green
  health/readiness for the restored version and exactly one
  command/CWD-verified exact-root worker. If those acceptance checks fail, stop
  and report without further repair attempts.

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

## Mandatory evidence, environment parity and state continuity

Added after DEV263: CRM Test had lost all 108 database triggers, yet the
deployment was signed off because checks compared only the migration ledger
and table counts. These rules are acceptance criteria for every task.

### 1. Session start: confirm the source of truth

- Before any release work, read the current handoff/state document supplied by
  the owner and restate, with evidence, the installed version, installed commit,
  database identity, migration count, table count and trigger count for the
  target environment.
- Never derive the "installed baseline" (version, commit, hashes) from memory,
  a previous session, a branch name or the working tree. Take it from the
  installed `RELEASE_PROVENANCE.json` or the last accepted deployment receipt,
  and cite the file and value.
- If any value differs from the handoff document, stop and report the
  difference before preparing a candidate. Do not "correct" either side.

### 2. Every claim needs evidence and a stated scope

- Each claim in a report (passed, fixed, restored, unchanged, safe) must cite
  its evidence: command and output excerpt, query and result, file and line,
  or hash. A claim without evidence is reported as "not verified".
- State what a check did NOT cover. "All 4 phases passed" must list what the
  phases compared, and name important properties they did not compare.
- Distinguish clearly between: verified on the hosted environment, verified on
  a local fixture, and inferred from code. Never present an inference as a
  hosted result.
- Report skipped tests by name and reason. A skipped test is not a pass.

### 3. Test against the real environment's shape, not only a fresh build

- A freshly migrated database is not evidence that a hosted database behaves the
  same way. For every change touching data paths, also test against a fixture
  that reproduces the target environment's actual schema (from a read-only
  schema-only dump or the recorded schema contract), including known drift.
- Every new write path needs an integration test for its plainest, most common
  input, not only the feature-specific path (for example, plain inbound, not
  only CTWA-first).
- When code relies on a database object (trigger, function, default,
  constraint, sequence, extension), the test must assert that object exists and
  works, not just that the application call succeeds.

### 4. Schema contract, not counts

- Preflight and post-install checks must compare the full database contract
  against an approved, hashed expectation: table names, migration ledger,
  triggers (name, table, function, enabled state), trigger functions, and,
  as they are added to the contract, constraints, indexes and sequences.
- Counts alone (migrations, tables) are never sufficient evidence of schema
  health.
- Any difference blocks deployment. Do not proceed on the assumption that a
  migration will repair drift unless that exact repair is the approved change.
- Before a migration attaches to existing database objects (functions,
  sequences, counter tables), verify read-only that those objects exist on the
  target with the expected definitions, and include the results in the approval
  packet.

### 5. Read-only diagnosis before any fix

- On any hosted failure: stop, collect the hosted error log entry for the exact
  request time, identify the exact exception (code, object, statement), and
  reproduce it locally with the exact deployed package before proposing a fix.
- Diagnosis queries must be read-only, listed in the report with their
  results, and run only with the owner's approval for that environment.
  Production queries always need separate explicit approval.
- When a root cause is environmental drift, assess its full scope (all
  objects of that kind, the time window, data written during the window) before
  proposing a narrow fix.

### 6. Approval packet consistency

- Before asking for approval, cross-check that every identity value agrees
  across the deploy config, origin manifest, package hash files, handoff
  document and change-request report: version, candidate commit, baseline
  commit, package/manifest/config SHA-256, contract hashes, database identity
  and expected counts. Include the cross-check table in the packet.
- A value that appears in only one artifact must be explained with its source.
- State config-file hashes in both the as-committed (LF) and on-disk forms when
  they differ, and say which one the operator checks.

### 7. Handoff at session end

- Update the handoff/state document with: installed version and commit per
  environment, database contract hashes, open defects, pending approvals, test
  data present, and simulator/worker states. Facts not written down are treated
  as unknown by the next session.
