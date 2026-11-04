# NYSA-CRM-20261104-DEV264 — Governed Trigger Drift Recovery

Status: candidate preparation; no hosted mutation authorized
Target: CRM Test only
Installed baseline: 2.1.0-dev.263, migration 167, 303 public tables, 0 user triggers
Candidate: 2.1.0-dev.264, migration 168
Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
Database: `nysareal_nysa_dev247_smoke`
Rollback: retained DEV263 Phase B scoped app/database backup plus the fresh
303-table post-incident safety dump. Automatic rollback remains application-only.

This plan and any later approval packet are governed by the hosted-deployment
controls in `CRM_CHANGE_POLICY.md` and the mandatory hosted-worker verification
and operator controls in `AGENTS.md`.

## 1. Confirmed failure and scope

DEV263 UAT failed on the first plain simulated inbound with an unexpected HTTP
500. The application log records PostgreSQL `23502`: the Lead insert reached
the database without a generated `lead_reference`. Read-only inspection found:

- `leads_assign_reference` absent;
- all other user-defined triggers absent as well (observed count 0);
- `public.nysa_assign_lead_reference` present with the migration-061 final body;
- `public.lead_month_number_counters` present;
- highest durable reference `NYSA-LD-202610-000209`;
- counter period `202610` at 209, exactly matching 209 retained October Lead
  references with sequence values 1 through 209. The earlier value 2,091 was a
  transcription error, not a database gap.

A second read-only reconciliation found all 45 distinct PostgreSQL functions
required by the 108 final triggers. None is missing.

This is a database-wide schema-drift recovery. It is not limited to WhatsApp or
the Lead allocator.

## 2. Drift explanation and prevention

Retained backup evidence bounds the loss:

- last known backup with 108 triggers: 1 November 2026, 21:51:12 Dubai;
- first known scoped backup with zero triggers: 2 November 2026, 02:35:36 Dubai.

The exact mutating command is not retained. The application migrations and the
reviewed DEV260/DEV261 operators do not contain a command that drops every
trigger. The observed shape—tables and trigger functions retained, with every
post-data trigger object absent—is consistent with a PostgreSQL restore or
schema rebuild that did not restore trigger archive entries. That is the
strongest supported explanation, but it is not presented as certainty.

The bounded window contains no `audit_log` entry and no surviving row whose
`created_at`, `updated_at`, `edited_at`, `recorded_at` or `timestamp` value falls
inside that window. This finds no retained evidence of application writes. It
cannot establish that no write occurred: an update to an immutable record with
no retained update timestamp, or a row later removed, is not reconstructable
from the current database. The 15 compatibility checks below therefore remain
the actionable safety boundary rather than a claim of complete forensic proof.

The prevention is explicit and testable:

1. The complete expected contract is versioned in
   `src/database-trigger-contract.json`.
2. Stage, backup and pre-install compare live table/name/function/enabled state
   against the approved baseline and stop on any difference.
3. The scoped custom-format backup is checked with `pg_restore --list`; its
   table set and trigger set must exactly match the live approved baseline.
4. Post-readiness verification requires the exact candidate trigger contract.
5. Receipts retain expected/observed counts, hashes and missing/extra/wrong
   function/wrong enabled differences.

## 3. Expected trigger contract

The final migrations 001-167 produce exactly **108 enabled triggers across 93
tables**. Canonical SHA-256:
`a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073`.

The authoritative machine-readable list is
`src/database-trigger-contract.json`. Every row records:

- table;
- trigger name;
- invoked function;
- BEFORE/AFTER timing and events;
- enabled state;
- source migration;
- exact final `CREATE TRIGGER` definition.

CRM Test currently has zero rows in this contract, so all 108 are missing. No
extra or disabled user trigger exists because the observed set is empty.

## 4. Read-only data compatibility checks

The read-only transaction in `src/trigger-drift-data-checks.js` was run against
CRM Test. All 15 results were zero:

1. invalid Lead stage-history transitions;
2. terminal Leads with open governed follow-ups;
3. terminal Leads with a stale `next_follow_up_at` projection;
4. initial booking terms over seven days without an extension;
5. booking terms over fourteen days;
6. booking extensions without exact evidence;
7. accepted Offers without bilateral evidence;
8. Bookings without bilateral evidence;
9. Deals without bilateral evidence;
10. overlapping active commission policies;
11. overlapping active Agent payout adjustments;
12. invalid active commission slab sets;
13. invalid active Agent-adjustment slab sets;
14. self-approved leave decisions;
15. leave-approval task/approver mismatches.

No corrective data mutation is proposed. If a later preflight observes a
non-zero result or any changed value, the phase stops and reports. Any data
correction would require a separate written approval.

## 5. Forward migration 168

`168_restore_governed_trigger_contract.sql`:

- reconciles monthly Lead counters upward with `GREATEST`, never downward;
- drops and recreates all 108 triggers from the final definitions;
- attaches to existing functions and contains no `CREATE FUNCTION` or
  `CREATE OR REPLACE FUNCTION` statement;
- therefore preserves the migration-061 Lead-reference function body and does
  not re-run migration 060's superseded body;
- is safe to run repeatedly;
- verifies missing, unexpected, disabled and wrong-function conditions;
- refuses to finish unless the exact count is 108.

The migration changes no table/column definition and expects the table count to
remain 303. The migration ledger advances from 167 to 168.

## 6. Tests and acceptance

Required source/fixture coverage:

- build all migrations in a restricted synthetic PostgreSQL database;
- remove all 108 user triggers to reproduce the CRM Test shape;
- run migration 168 twice and verify 108 triggers across 93 tables;
- create a brand-new plain simulated inbound with `agentId` before CTWA and
  verify a Lead reference and ownership;
- reject an invalid `New -> Qualified` stage transition;
- close a Lead and verify the governed follow-up task is cancelled;
- run the full simulator flow and the full governed regression;
- verify stage/backup/install trigger guards and scoped-dump trigger parsing.

Completed local evidence:

- all 168 migrations rebuilt on the restricted `nysa_test_fixture` role;
- the recovery lifecycle passed after removing all 108 triggers, applying
  migration 168 twice, creating a plain inbound with `agentId`, rejecting the
  invalid stage transition and closing its governed follow-up;
- the complete DEV263 simulator flow passed with the loopback provider URL
  deliberately unreachable;
- the governed release selection included 307 test files and excluded 93
  historical local-artifact files; 1,652 tests ran, 1,556 passed, 96 were
  intentionally fixture-gated, and zero failed;
- governed selection SHA-256:
  `da9473dc9fb79bcbf57b9f9b8976637dd3567e0a2835b3eedf1e6cebe8d0da83`.

## 7. Deployment plan (not yet authorized)

Only the canonical GitHub-versioned
`tools/crm-test-direct-node-release-operator.mjs` may be used. The candidate and
any operator change require their own exact commit/hash approvals. Packaging is
only through:

`npm run release:package -- --commit <full-40-character-origin-SHA>`

and must pass `npm run release:verify-package`.

CRM Test uses four separately approved phases:

1. Stage: non-mutating provenance, runtime, ledger, 303-table, zero-trigger
   baseline, governed-data, counter and worker inventory checks.
2. Backup: scoped app archive plus custom-format PostgreSQL dump; verify sizes,
   SHA-256, archive readability, 303 table names, and zero baseline triggers.
3. Install: verify and stop all exact-root command/CWD workers, install the exact
   package, run migration 168, controlled start, green readiness, one worker,
   303 tables and exact 108-trigger contract. Automatic rollback is
   application-only and only before readiness acceptance.
4. Smoke: bounded read-only settled attempts recording time/status/body/server;
   remote browser UAT follows because shared hosting cannot launch Chrome.

After readiness, any later check failure preserves the running application and
evidence and stops. A deployment is not complete unless exactly one
command/CWD-verified `lsnode:<exact-app-root>/` worker serves the expected
version with database readiness green.

## 8. Production query — prepared only, not executed

Production remains outside this candidate. After separate written approval,
the read-only inventory query is:

```sql
SELECT c.relname AS table_name,
       t.tgname,
       t.tgenabled,
       pn.nspname || '.' || p.proname AS function_name,
       pg_get_triggerdef(t.oid, true) AS definition
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT t.tgisinternal
   AND n.nspname = 'public'
 ORDER BY c.relname, t.tgname;
```

It has not been run against production.

## 9. Privacy, security and exclusions

- Evidence contains counts, hashes and schema identifiers, not credentials or
  customer rows.
- No access control, workflow decision or integration contract is changed.
- No provider setting, live credential or outbound message is enabled.
- Production, website, REM, Meta and 360dialog are excluded.
- Re-testing after recovery must cover the affected governed flows, not only
  WhatsApp UAT.
