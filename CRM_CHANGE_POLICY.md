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
