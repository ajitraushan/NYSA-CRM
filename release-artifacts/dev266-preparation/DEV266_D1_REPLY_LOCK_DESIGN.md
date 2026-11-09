# DEV266 D-1 — governed WhatsApp reply-lock design

Date: 9 November 2026  
Target: CRM Test only  
Status: design checkpoint; no implementation, package, upload or hosted change has been made

## Approval source and baseline

- Approved instruction: `DEV266_reply_lock_instructions.md`.
- Instruction SHA-256, verified before design work: `f3fa3a0922f9d131f32738d885e279714f9808fb78b1826f1e302e6e0cc78317`.
- Required source baseline: accepted DEV265 candidate commit `ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`, advertised by `origin/codex/dev265-schema-contract-restoration`.
- Accepted CRM Test runtime: `2.1.0-dev.265`, migration ledger 169, 303 public tables, 108 enabled governed triggers across 93 tables, complete schema contract restored.
- Accepted DEV265 origin package SHA-256: `99166cabaa57e7f69320a207e84b166e5a4957a12bf004572fc705fdc0e9ad2a`.
- Current CRM Test rollback point remains `/home/nysareal/crm-release-preparation/20261106-dev265-run2/scoped-backup-dev265-phased-run2-d7a5a34` (application archive SHA-256 `706b529aa96449334e323c14d6580aedfbc86fef19e3a29cca3d79d0c38e05b2`; database dump SHA-256 `a99fbaa179acf3ea68410c1ffa85a204e84fee7213990e2d094189ae4544a533`).
- Confirmed defect: PostgreSQL 13.23 rejects the current acquire/release statement with SQLSTATE `42P08` because `$1` is untyped inside `CASE WHEN $1 IS NULL`. DEV264 and DEV265 contain byte-identical affected route code; the defect is not caused by schema restoration.
- Current simulated conversation sends do not consult the reply lock. DEV266 will close that authorization gap.
- The working tree contains unrelated existing local changes and retained evidence folders. They are outside DEV266 and will not be altered.
- Production, website, REM, Meta, 360dialog, CRM Test hosting, its database, configuration, selector and workers are outside D-1 and remain unchanged.

The mandatory hosted-worker controls, canonical operator controls, origin-only packaging and four separately approved deployment phases in `AGENTS.md` and `CRM_CHANGE_POLICY.md` remain future release acceptance criteria. This checkpoint authorizes none of them.

## Business rule: Option B

DEV266 will make the reply lock an enforced conversation-level authorization control:

1. With no active lock, any otherwise authorized in-scope user may send a conversation reply.
2. With an active lock, only its holder may send. This applies equally to Sales Agents, Managers and Directors; management role does not bypass another user's active lock.
3. The holder may release the lock. An in-scope Manager or Director may also release it. A Manager or Director who wants to reply while an Agent holds the lock must release it first, then send.
4. An in-scope operational user may acquire a free or expired lock. Acquiring a lock already actively held by somebody else returns HTTP 409.
5. Reassignment and takeover continue to clear both lock fields in the same transaction before the new owner can reply.
6. Frozen campaign sends are not conversation replies and remain unaffected.

### Exact expiry rule

- Environment variable: `WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES`.
- Absent variable: 30 minutes.
- Accepted value: trimmed whole-number text from 5 through 240 inclusive.
- Explicit empty text, decimals, signs, units, non-numeric text and values outside 5–240 are invalid and fail application startup before migration, worker startup or listening.
- The effective value is read and frozen once during application startup. Request handlers do not reread `process.env`.
- PostgreSQL is the sole clock authority. Within the transaction, a lock is active only while:

  `NOW() < reply_lock_acquired_at + make_interval(mins => timeout_minutes)`

- It is expired exactly when `NOW()` is equal to or later than that boundary. Node.js wall-clock time is not used for lock authorization.
- A successful, non-duplicate reply by the active holder refreshes `reply_lock_acquired_at` to database `NOW()`. A rejected/failed provider attempt or an idempotent duplicate does not refresh it.
- Sending while no lock is active does not silently acquire a lock. Sending against stale expired metadata is allowed but does not revive that metadata.
- Acquiring over expired metadata replaces the prior holder/time and writes a distinct audit event.
- A structurally inconsistent pair (only one of owner/time populated) fails closed with a safe diagnostic; it is not interpreted as an available lock.

### Same-holder and release semantics

- Reacquiring one's own active lock is idempotent ownership-wise and refreshes its acquisition timestamp because it is an explicit new acquisition action.
- Releasing a current active lock clears owner and timestamp together.
- The recorded holder or an in-scope Manager/Director may clear expired metadata. A different Sales Agent may not release another user's recorded metadata even after expiry; that Agent can instead acquire the expired lock, which records the expired replacement.
- Releasing an already clear lock returns a successful no-op state without creating a misleading release audit event.

## Transaction and concurrency design

The server, not the UI, is authoritative. A new shared reply-lock domain module will be used by lock routes and every one-to-one send path.

### Acquire/release

The route transaction will:

1. select the conversation and holder display name with `FOR UPDATE`;
2. enforce existing inbox/team scope;
3. obtain one transaction-stable `NOW()` value and compute active/expiry in SQL;
4. apply the Option B command;
5. update both lock columns atomically; and
6. write the audit event before commit.

The immediate `42P08` repair is explicit UUID typing in both parameter uses:

`reply_lock_owner_id=$1::uuid` and `CASE WHEN $1::uuid IS NULL ...`.

The shared domain function, rather than duplicated route conditions, will remain responsible for state interpretation and permissions.

### Simulated one-to-one send

`POST /api/crm/whatsapp-workspace/conversations/:id/simulated-send` will execute its authorization and persistent acceptance as one database transaction:

1. select the scoped simulated conversation `FOR UPDATE`;
2. evaluate the reply lock with database `NOW()`;
3. return 409 before provider acceptance when another user holds an active lock;
4. validate the 24-hour/template rule and template ownership/status;
5. run the in-process simulator acceptance using the same database client for its control-state read;
6. record the outbound event and message using the same client;
7. only for a new successfully recorded message, refresh the lock timestamp when the actor is the active holder; and
8. commit before scheduling delivery/read/failure callbacks.

`recordSimulatedOutbound` will therefore accept a provided transaction client, following the existing pattern already used by inbound/status store functions. The status callback schedule will be created only after the acceptance transaction commits, preventing a callback from racing a rolled-back message.

Holding the conversation row lock through persistent message acceptance makes acquire, release, reassignment and another one-to-one send serialize for that conversation. It avoids the unsafe sequence “provider accepted first, lock checked later.” No process-local mutex will be used, so correctness does not depend on a single Node process.

There is no enabled live-provider conversation send path in DEV265. DEV266 will expose the same shared gate for that future path; a later live-provider implementation must reserve/idempotently authorize through this gate before external network I/O rather than duplicating lock logic. No live provider, credential or network integration is added in DEV266.

Campaign simulation continues through its campaign route and deliberately does not call the conversation reply gate.

## API and UI contract

Conversation detail will return a structured `replyLock` object derived from database time:

- holder ID and display name;
- acquired timestamp;
- computed expiry timestamp;
- active/expired state;
- effective timeout minutes;
- whether the current user is the holder;
- whether the current user may release; and
- whether the current user may send.

An active-lock send conflict returns HTTP 409 with code `WHATSAPP_REPLY_LOCK_HELD`, the message `Reply lock held by <name> until <time>`, and the safe structured lock state. The holder's display name is exposed only to a user who already has conversation scope. The server writes no message or provider-send event for this rejection.

The conversation UI will:

- show holder and expiry using the server response;
- disable the reply controls for a non-holder while a lock is active;
- show the same visible 409 error if state changed after the screen loaded;
- show release only to the holder or an in-scope Manager/Director; and
- refresh the displayed lock state after acquire, release, assignment, takeover or successful send.

The UI remains advisory; direct API requests receive identical server enforcement.

## Audit contract

Existing governed `audit_log` infrastructure will record:

- `reply_lock_acquired` — actor, new holder, database acquisition time and expiry;
- `reply_lock_released` — actor, prior holder, release mode (`holder` or `manager_override`) and prior expiry;
- `reply_lock_expired_replaced` — actor, prior holder/time/expiry and new holder/time/expiry; and
- the existing outbound-accepted audit event, extended with whether an active holder's timeout was refreshed and its new expiry.

Audit details contain identifiers, timestamps and control outcomes only—no message body or credentials. Existing reassignment/takeover audit retains `replyLockReset: true` and will include the prior lock identity/state for traceability.

## Configuration exposure and future maintainability

The effective `replyLockTimeoutMinutes` will be returned read-only in the Admin WhatsApp simulation/status response and in conversation lock state. It is not editable in CORE in DEV266, is not a secret and is not written to logs as an environment dump.

No hosted value is proposed at D-1. If no value is separately approved for a later CRM Test deployment, the documented default of 30 applies.

A database-backed Admin-editable value may be preferable later only if NYSA needs audited runtime changes without a restart. It is deliberately excluded now because it requires a separate governed design for RBAC, approval/audit, value precedence, activation time, multi-worker cache consistency and rollback. The environment-only value is the smaller fail-closed change for DEV266.

## Schema and migration decision

- No database migration is proposed.
- Existing `wa_conversations.reply_lock_owner_id` and `reply_lock_acquired_at` columns are sufficient.
- Migration ledger remains 169; expected public table count remains 303.
- Canonical constraints, indexes, columns, functions, sequences/views and 108-trigger contract remain unchanged.
- DEV266 must fail testing if its package or deployment config claims a schema/migration change.

## Planned implementation files

Implementation after D-1 approval is expected to be limited to:

- `src/whatsapp-reply-lock.js` — configuration parsing, frozen effective config, SQL state calculation and shared permission/gate functions;
- `src/server.js` — fail-closed startup configuration before migration/listening;
- `src/routes/whatsapp-workspace.js` — typed acquire/release and structured lock state;
- `src/routes/whatsapp-simulated-provider.js` — transactional send gate, post-commit status scheduling and Admin read-only value;
- `src/whatsapp-simulated-provider-store.js` — provided-client outbound recording;
- `public/whatsapp-workspace-ui.js` — holder/expiry display and visible send blocking/errors;
- `.env.example` — non-secret setting documentation;
- version metadata for `2.1.0-dev.266`; and
- focused DEV266 tests and preparation evidence.

No deployment operator change is expected. If implementation reveals one is necessary, it must be isolated in its own GitHub commit, tests, SHA-256 and separate approval before use.

## PostgreSQL 13.23 and route-level test plan

The governed DEV266 test database will run PostgreSQL 13.23. Tests will exercise the full mounted app and authenticated API, not a route copy:

1. Owner acquires: 200, typed SQL succeeds and acquisition audit exists.
2. Second in-scope user acquire: 409 with holder and database-derived expiry; no state/audit mutation.
3. Holder sends: 202, exactly one outbound message/event and timestamp refreshed to database time.
4. Other Agent sends while active: 409, visible error, zero provider/message/send-audit rows.
5. Manager/Director sends while Agent lock active: 409; an in-scope Manager/Director releases; subsequent send succeeds. Manager/Director may also acquire and is then the only sender.
6. Holder releases: another authorized user may send; release-by-unrelated Agent is rejected.
7. Expiry with one transaction-stable database clock: 29:59 active, exactly 30:00 expired, 30:01 expired; non-default 10-minute boundary; expired replacement succeeds and is audited.
8. Configuration: absent gives 30; 5 and 240 accepted; 4, 241, `abc`, decimal and explicit empty value terminate startup before listening.
9. Assignment, reassignment and takeover clear both lock fields and preserve audit evidence.
10. Simulated campaign send remains unaffected and retains per-recipient outcomes.
11. Provider faults and idempotent duplicate requests do not refresh the lock or create duplicate sends.
12. Concurrent acquire/send and two-sender tests prove row serialization and exactly-one authorization outcome.

The exact candidate package test will use the extracted origin ZIP, its actual `src` and public file, full router order from `src/server.js`, PostgreSQL 13.23 and a hosted-tools-only deployment layout with no repository fallback. It will open the WhatsApp workspace in a real browser as Agent, Manager and Director, exercise acquire/release/send visibility, and record screenshots/logs. Package and governed-suite pass/skip counts will be reported from machine-generated manifests, never inferred.

## Security, privacy and rollback impact

- The change tightens authorization; it does not broaden conversation visibility.
- No customer data is required for tests. Only synthetic approved simulator records are permitted.
- No credentials, phone numbers or message content may enter logs, screenshots or audit details.
- Failures are safe: blocked sends produce no provider/message side effect; invalid configuration prevents startup.
- Because no schema change is planned, a future rollback is application/configuration-only. Any database action would require separate exact approval.
- A future CRM Test deploy still requires a fresh verified scoped app/database backup, separately approved four-phase execution and exact-root worker verification before and after readiness. Acceptance requires one command/CWD-verified exact-root worker serving the expected version with database readiness green; a stale, duplicate or unverified worker fails acceptance.

## D-1 exit and D-2 gate

Checkpoint D-1 stops here. No application source, tests, version, package, deployment config or hosting content has been changed.

After Ajit approves this design, D-2 may implement from exact DEV265 commit `ce4f16c7adaf1636db216abd9e1ccbdd62dd8fd8`, run the PostgreSQL 13.23 and exact-package tests above, push the candidate to GitHub, package only with the mandatory origin builder, verify provenance and provide a full approval packet. D-2 itself will still authorize no upload or deployment.
