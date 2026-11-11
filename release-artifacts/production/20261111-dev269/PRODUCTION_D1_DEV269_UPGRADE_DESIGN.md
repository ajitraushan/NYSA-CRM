# Production D-1 — DEV269 cumulative upgrade design

**Date:** 11 November 2026

**Status:** D-1 design for review; no Production action authorized

**Owner:** Nysa Realty / Ajit

**Target:** `crm.nysarealty.com` only

This note is governed by the hosted-deployment controls in
`CRM_CHANGE_POLICY.md` and the mandatory exact-root worker and deployment
controls in `AGENTS.md`. Emergency priority does not relax those controls.

## 1. Evidence-backed source and target state

### Production — last verified source of truth

The latest retained read-only Production evidence is
`release-artifacts/production-schema-check-20261105/P1_PRODUCTION_IDENTITY.json`
and the P-4/P-6 comparison under the same folder:

| Property | Verified value |
|---|---|
| Domain | `crm.nysarealty.com` |
| Application root | `/home/nysareal/nysa-crm` |
| Database | `nysareal_nysacrm` |
| Database role | `nysareal_nysacrmapp` |
| Installed version | `2.1.0-rc.1` |
| Installed commit | `b6e013c51f46be482858e733160fa7e675ff3106` |
| Migration ledger | 140, through `140_business_line_organisation.sql` |
| PostgreSQL | 13.23 |
| Public tables | 258 |
| Enabled user triggers | 108 |

The 5 November schema comparison replayed the installed commit and its 140
migrations on PostgreSQL 13.23. Production matched that reference with zero
missing, extra or changed constraints, indexes, columns, functions, triggers,
sequences or views. No customer rows were exported and Production was not
changed.

This evidence is the D-1 baseline, not permission to assume the state is still
current. Before any later Production preparation or deployment step, a new
committed, approved, read-only preflight must re-read `RELEASE_PROVENANCE.json`,
version, migration ledger, complete schema contract, configuration guards and
exact-root workers. Any difference stops preparation.

### Accepted CRM Test reference

CRM Test accepted `2.1.0-dev.269`, commit
`e5db302e12a21d2597ecab0dc340fa2eae534381`, at migration 170 with 306
public tables and 111 enabled triggers. The accepted schema-manifest SHA-256 is
`59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`.
Its acceptance record is
`release-artifacts/dev269-preparation/DEV269_ACCEPTANCE.md`.

CRM Test acceptance proves the feature on the Test shape. It does not prove the
30-migration Production upgrade, Production configuration, Production data
compatibility or a Production rollback.

## 2. Proposed Production outcome

The business outcome is the accepted DEV269 capability, including Prospect
Diary and its governed calling/suppression controls. Production is 30 migrations
behind, so this cannot be treated as a one-screen file hotfix. A safe Production
candidate must reconcile and test the complete 140-to-170 database and runtime
delta:

- 141–159: lead-source, non-voice, website intake and intake corrections;
- 160–169: WhatsApp sandbox/workspaces/simulator and schema-recovery history;
- 170: Prospect Diary, company calling numbers and shared suppression controls.

No current package is approved for Production. A Production candidate must have
a Production version, a new GitHub-advertised origin commit, the mandatory
origin-only package, a verified manifest and a Production-specific deployment
configuration. It must not reuse CRM Test secrets, simulator settings, users,
team assignments or provider state.

## 3. Confirmed blockers in the accepted DEV269 source

DEV269 must not be installed on Production unchanged.

### D1-B01 — migration 166 has the wrong fixed database role

`src/migrations/166_whatsapp_simulated_provider_stub.sql:99-101` grants the
simulator tables to `nysareal_nysar2app`. Production's verified application role
is `nysareal_nysacrmapp`. The Production candidate must remove the hard-coded
environment role and apply an explicitly configured, validated target-role
mapping. The migration rehearsal must prove the grant lands only on the approved
Production role and that the simulator remains disabled.

### D1-B02 — migration 169 contains CRM Test-specific data deletion guards

`src/migrations/169_restore_full_schema_contract.sql` is a recovery migration
for the CRM Test drift incident. It requires exactly 12 simulated orphan
messages and 5 orphan notifications, deletes those exact rows and records the
UAT264 cleanup. A clean Production database is expected not to contain that
CRM Test evidence, so the migration will fail closed; it must never be weakened
to delete different Production rows.

The Production candidate needs a reviewed dual-state migration strategy:

1. on the exact previously approved CRM Test drift state, retain the already
   accepted guarded recovery behavior; and
2. on the clean cumulative Production path, prove the complete schema is already
   compatible and perform no UAT cleanup or customer-data deletion.

The approach must be idempotent, transactional and tested on PostgreSQL 13.23.
It must not forge the migration ledger or silently skip an unverified schema.

### D1-B03 — cumulative data and configuration compatibility is unproven

The clean schema check at migration 140 is strong baseline evidence, but it is
not a rehearsal of migrations 141–170 on the Production data shape. The complete
set of migration preconditions, duplicate/orphan checks, role grants, background
jobs, integration flags and new configuration defaults must be reconciled before
packaging.

## 4. D-2 build and verification requirements

No Production upload or execution is part of D-1. D-2 must provide all of the
following before any Phase A request:

1. **Candidate identity:** Production version, full origin commit, tree,
   advertised origin ref, package, manifest and config SHA-256 values, generated
   and cross-checked by script.
2. **Migration compatibility:** reviewed fixes for D1-B01 and D1-B02, with tests
   for the clean Production path and the retained CRM Test recovery path.
3. **Production-shaped PostgreSQL 13.23 rehearsal:** start at the exact migration
   140/schema contract and apply 141–170 in order. Where data-bearing validation
   is required, use only a separately approved protected rehearsal copy; do not
   export customer rows into developer evidence.
4. **Full post-migration contract:** expected table names, columns, constraints,
   indexes, functions, sequences/views, triggers and migration ledger, all
   compared by hashed canonical definitions—not counts alone.
5. **Data compatibility report:** every precondition and any non-zero conflict,
   with no corrective Production write proposed or performed without separate
   approval.
6. **Configuration reconciliation:** explicit expected/observed names without
   secret values. Simulator, sandbox sending and unapproved external connectors
   remain disabled. `PROSPECT_OUTSIDE_CALLING_HOURS_MODE` remains the accepted
   `warning` default unless Ajit separately approves a Production setting.
7. **Job and notification impact:** list newly enabled workers/timers and prove
   that installing the schema cannot send WhatsApp, email, SMS or other external
   messages before a separately approved activation.
8. **Regression:** governed tests, Production-shaped integration tests, exact
   packaged full-router tests and real-browser Agent/Manager checks. Every skip
   is named with its reason; a skip is not a pass.
9. **Rollback rehearsal:** application rollback and database recovery remain
   separate. Database restore is never automatic. Prove the application-only
   rollback returns the domain to RC1 with green health/readiness and exactly
   one command/CWD-verified worker.
10. **Production operator:** identify or build the canonical, committed and
    tested Production operator. The CRM Test operator is not assumed safe for
    Production. Any operator/helper change has a separate commit, tests, hash
    and approval.

## 5. Hosted-step execution rule — effective immediately

This rule applies to every hosted step on CRM Test and Production, including
read-only checks, backup preparation, deployment, smoke, load tests and cleanup.

1. The step is implemented as a script file committed to GitHub origin. The
   same commit contains the applicable syntax check and tests.
2. The approval names the exact origin commit, destination path, script
   SHA-256, arguments, evidence path and allowed run count.
3. Hosting receives the exact origin file at a new path. The approved short
   download command must fail closed and must not overwrite an existing output.
4. `sha256sum` on hosting must equal the committed hash before execution. A
   mismatch stops the step; there is no edit, substitution or retry.
5. The script is run by file path with explicit arguments. Standard output and
   standard error are saved to the approved evidence file. The receipt records
   the script commit/hash, arguments, timestamps, target identity and result.
6. Only the short download, hash-check and run commands listed verbatim in the
   approval may be entered in cPanel Terminal.

Prohibited on hosting: inline encoded programs; pasted multi-line scripts;
heredocs/here-strings; `node -e`, `python -c` or equivalent inline interpreters;
runtime-generated operator/helper files; and manual editing of the committed
script. An execution failure consumes the approved run and stops without retry.

For Production, every new query script—read-only or otherwise—must be shown to
Ajit in full with its SHA-256 before it is run. Script placement itself is a
hosted change and needs exact approval.

## 6. Proposed phased Production controls

After D-2 approval, each phase remains separately approved and runs once:

- **A — stage/preflight:** non-mutating provenance, installed baseline, full
  schema/configuration contract and exact-root worker inventory.
- **B — recovery:** fresh verified Production application archive, PostgreSQL
  custom dump, selector environment and required off-server encrypted recovery.
- **C — install:** quiesce only verified exact-root workers, apply the reviewed
  cumulative migrations, install governed files, restore only approved
  environment values, controlled start, readiness and exactly one verified
  worker.
- **D — settled smoke:** read-only 30–60 second evidence window retaining every
  attempt, followed by separately approved authenticated browser UAT.

Automatic recovery before readiness is application-only. No automatic database
restore is allowed. After readiness is green with one verified worker, later
failures preserve the running application and evidence and stop for direction.
Any rollback must end with `/` serving NYSA CORE, green health/readiness for the
restored version and exactly one command/CWD-verified exact-root worker.

## 7. D-1 decision and authorization boundary

**Recommendation:** approve preparation of a new Production candidate that
resolves D1-B01 and D1-B02 and supplies the D-2 evidence above. Do not approve a
direct DEV269 package deployment.

This D-1 note authorizes no hosted query, upload, backup, application change,
database change, selector action, worker action, provider action or Production
deployment. WN-15 remains paused, and Approval 1R-3 is not retried.
