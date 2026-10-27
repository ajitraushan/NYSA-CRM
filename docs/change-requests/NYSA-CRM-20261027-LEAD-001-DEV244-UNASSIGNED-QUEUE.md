# NYSA-CRM-20261027-LEAD-001 — DEV244 unassigned response queue

## Authorization and baseline

- Target: CRM Test and the staging-to-CRM-Test website path only.
- Source baseline: `2.1.0-dev.243`, commit `31778b9b248690239e492c1c110d2aef53c5c8e0`, migration 155.
- Current recoverable rollback evidence: paired CRM Test backup `/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z` and verified encrypted local recovery copy `crm-test-dev243-20261027T193434Z/recovery.nyback` (encrypted SHA-256 `bee74240b3253cc6049a6b268c7f13760fa3460185fbf05578fbb4761c92694d`). A new paired backup and encrypted verified copy are mandatory immediately before DEV244 deployment.
- Production, production assignments/configuration, live integration flags and customer messaging are outside this change and remain unchanged.

## Approved behavior

1. Accepted Website/NIA and Meta enquiries create exactly one Lead Response case even when no fallback response owner is configured.
2. An owner-free case appears in a separate **Unassigned** Lead Response view for Admin and Managers. The original two-minute response-assignment due time starts from source receipt and remains visible when overdue.
3. Admin or an in-scope Manager may assign an active operational response owner (Sales Agent or Manager). This changes the response case owner only; it does not silently accept, reassign or change the canonical Lead owner/team assignment.
4. Assignment is transactional, audited and idempotent. Once assigned, the case leaves Unassigned and appears in that response owner's normal queue.
5. No Task or outbound WhatsApp/email job exists before response-owner assignment. Eligible sequence jobs are created only after assignment, and CRM Test live sending remains disabled.
6. The accepted Contact Us Lead that previously lacked a response case is recovered automatically into Unassigned. The earlier NIA submission cannot be recovered and is resubmitted once after deployment.

## Acceptance and rollback

- Verify authorization boundaries for Admin, Manager, Sales Agent and unrelated Manager.
- Verify source/case idempotency, owner assignment concurrency, audit evidence, no pre-assignment jobs, and no live provider calls.
- Rehearse all 156 migrations against disposable PostgreSQL and run the full governed release suite.
- Package only from the exact GitHub-advertised commit and verify package provenance before CRM Test deployment.
- Rollback restores the fresh paired pre-DEV244 CRM Test backup and verified staging bridge state. Production remains untouched.

## Local verification evidence

- Governed release selection: 1,554 tests; 1,463 passed, 91 restricted-fixture skips, zero failures.
- Dedicated loopback PostgreSQL rehearsal: all 156 migrations applied; all original pre-migration table snapshots remained identical; 22 non-voice integration checks passed with zero failures.
- DEV244 integration checks cover owner-free Website/NIA recovery, owner-free Meta-compatible case creation, zero Task/outbound jobs before assignment, Admin/Manager authorization, Sales Agent denial, concurrent assignment idempotency, immutable audit evidence, and unchanged canonical Lead owner/team.
- No provider credential, customer value or live external request was used. The synthetic database is disposable and private.
