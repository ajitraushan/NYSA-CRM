# NYSA CRM Change Policy

## Required workflow

1. Identify the application/module, owner, target environment and acceptance
   criteria.
2. Record the baseline using `BASELINE.md`. Preserve the current state and make
   a recoverable backup before database, schema, configuration or bulk-data work.
3. Map affected data, roles, permissions, workflows, reports and integrations.
4. Implement in an isolated development/test copy using synthetic or approved
   test data.
5. Test happy paths, validation, authorization, auditability, failure recovery,
   concurrency/idempotency where relevant, migrations and rollback.
6. Present the tested version, evidence, migration plan and rollback plan.
7. Change production only after explicit approval for that exact version and
   operation. Back up immediately before deployment and run regression checks.

## Hosted deployment preparation and operator controls

Every hosted deployment preparation, approval packet, operator and completion
report must explicitly reference this section and the mandatory hosted-worker
verification in `AGENTS.md`. A preparation that omits these controls is
incomplete and must not proceed to deployment.

- Keep deployment operators and their meaningful tests in the governed GitHub
  repository. The reviewed source, exact commit and operator hash must be part
  of deployment evidence.
- Run deployment tooling outside the installed application root. Never add a
  release-only script to the live application's `package.json` or otherwise
  mutate governed runtime files to make the operator executable.
- Make stage/preflight non-mutating. Before deployment it must verify the exact
  origin package and manifest hashes, installed runtime manifest, database and
  migration identity, registered configuration guards, rollback evidence and
  exact-root workers. A runtime mismatch must identify the file plus expected
  and actual hashes.
- Parameterize and record the approved backup path and freshness rule. Do not
  rely on a hidden hard-coded filename, timestamp or environment identity.
- CRM Test deployments must create a scoped rollback set in the same bounded
  operator run: an archive of the exact CRM Test application root plus a
  database-only dump of the exact CRM Test database. Verify both files' size,
  SHA-256 and contents before mutation; rollback may restore only those scoped
  targets. Full-account cPanel backups are reserved for production releases or
  separately scheduled account backups.
- Run environment-dependent browser/PDF checks where the required runtime is
  supported. If shared hosting cannot launch a browser, defer that check
  explicitly to a remote post-deployment test; do not hang the hosted stage.
- Treat the approved run count as a hard limit. On failure, timeout or stall,
  stop and report without retrying, killing broad process groups, contacting a
  third party or expanding scope unless separately authorized.
- Before mutation, record every worker whose command marker and
  `/proc/<pid>/cwd` match the exact application root. Stop only verified
  exact-root workers, perform one controlled start, request `/api/readiness`,
  and then verify database readiness, expected version and exactly one
  `lsnode:<exact-app-root>/` worker.
- A stale, duplicate, zero-after-readiness or command/cwd-unverified worker is a
  failed deployment. Reconcile it and repeat readiness/worker verification
  within the approved operation; otherwise roll back or stop. Never hand over a
  deployment, enable a connector or perform an external write while such a
  worker remains.
- Completion evidence must state the deployed version and commit, package and
  manifest hashes, backup/rollback point, migrations, runtime integrity,
  readiness, exact worker PID/command/cwd, regression results, deferred remote
  checks and confirmation that unrelated environments remained unchanged.

## Enforced release provenance

Every deployment archive must be generated only by
`npm run release:package -- --commit <full-origin-SHA>`. The builder verifies
that the exact commit is advertised by the configured GitHub origin, creates a
detached temporary checkout, runs the test suite there, packages tracked runtime
files from that checkout only, records the repository URL, commit, tree,
advertised ref, package and manifest hashes, test receipt, version and migration
state, and then removes the checkout. The caller's working tree is never a
package source; modified and untracked files cannot enter the archive.

Legacy release builders are archival and prohibited for new releases. A package
without `nysa.release-provenance.v1`, a green test receipt, a matching package
and manifest checksum, and a commit still advertised by the governed GitHub
origin must be rejected before deployment.

## Data governance

Apply least privilege and data minimization. Do not copy production personal data
into development by default. Never reveal passwords, tokens, session data or
private customer/employee information. Log only what is operationally necessary
and preserve audit trails for consequential changes.

## Integration boundary

Document source of truth, identifiers, validation, authorization, retries,
idempotency, error handling and reconciliation for every integration. Website
systems may submit through an approved CRM intake boundary but must not create a
competing customer, lead, inventory or eligibility authority.
