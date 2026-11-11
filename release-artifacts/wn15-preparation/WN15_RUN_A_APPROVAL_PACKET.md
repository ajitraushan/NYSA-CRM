# WN-15 Run A approval packet

Date: 11 November 2026  
Target: CRM Test only  
Status: plan only; no backup, account/team change, load run or cleanup is authorized or performed

This packet applies the hosted-deployment and exact-worker controls in `AGENTS.md`
and `CRM_CHANGE_POLICY.md`. WN-15 is not an application deployment, but the same
fail-closed evidence, exact-target, worker and environment-isolation rules apply.

## 1. Baseline and boundary

- Installed accepted application: `2.1.0-dev.269`, commit
  `e5db302e12a21d2597ecab0dc340fa2eae534381`.
- CRM Test application root:
  `/home/nysareal/nysa-core-dashboard-dd6262a-stage`.
- Database: `nysareal_nysa_dev247_smoke`, PostgreSQL `13.23`, migration 170,
  306 public tables and 111 enabled triggers on 95 tables.
- Before Run A, `/api/readiness` must be green and exactly one worker must match
  both the exact application-root command marker and `/proc/<pid>/cwd`.
- Production, website, REM, Meta, 360dialog and real WhatsApp recipients are out
  of scope. No application package, migration, selector environment or deployed
  runtime file is changed.

The baseline values above come from the accepted DEV269 Phase D/acceptance
record. They must be reverified read-only immediately before Run A; they are not
claimed as a new hosted observation by this packet.

## 2. Governed WN-15 tooling

Origin commit (pushed to `origin/codex/dev267-prospect-diary`; not placed on
hosting): `5703868caedfe6d1f2a6d00cca6c1f61b6a4105d`, parent
`b30668dc91b28aa97df61735f57b094656e5d50d`.

| File | SHA-256 |
|---|---|
| `tools/whatsapp-simulation-load.mjs` | `8c3fce6520a61b75bfdc0dfdeac1796dd05fa550cdd176324883063a166dd8d6` |
| `tools/whatsapp-simulation-cleanup.mjs` | `a61e544a22d1d43a8757cd788815b5f1b9ec2dd42ae137922be629237d29b72c` |
| `tools/wn15-team-state-readonly.sql` | `a8f1f8dcf38a353590c257810449ff50e49e7bff73baf3c0e8d785ac871fe09b` |
| `test/wn15-load-and-cleanup-tools.test.js` | `9827e7adbe3be90077818b82689d6eaaea23eeeb41ad578000b8106f67b7871f` |

The loader now:

- accepts one to three unique teams and two to ten unique Agents;
- validates optional `--team-count` and `--agent-count` against the exact run
  configuration before sending anything;
- records the actual team count, Agent count and per-team Agent allocation in
  every receipt;
- records and enforces `phoneStartOffset`;
- requires the exact `--app-root` and dynamically loads the deployed simulator
  environment guard without modifying the installed application;
- stops scheduling on the first failed request, aborts in-flight load requests,
  marks the run failed and records only the safe first failure.

The cleanup tool:

- selects data only by exact run UUID plus its exact provider-event evidence;
- requires a hashed dry-run receipt and rechecks counts/fingerprint under lock;
- deletes only run conversations (with their messages and notifications),
  assignment history, Leads, Contacts and exact run-created suppression
  restrictions;
- refuses cleanup if any campaign-recipient link exists;
- keeps the simulation run, changes its status to `cleaned`, and keeps all
  provider events;
- audits the exact counts and proves zero remaining generated rows.

Focused test command:

```text
node --test test/whatsapp-simulated-provider.test.js test/wn15-load-and-cleanup-tools.test.js
```

Result: 15 tests, 15 passed, 0 failed, 0 skipped.

The repository's unrestricted raw `npm test` was also attempted and exited 1
because this workspace lacks historical release artifacts, PostgreSQL fixture
credentials and permission for several loopback browser/server tests. That run
is not presented as WN-15 approval evidence and was not baseline-compared. The
focused WN-15/simulator selection above is the verified evidence scope.

## 3. Synthetic teams and accounts

The account inventory selects active accounts; the teams themselves are
inactive.

Conversation owners:

- CORE Test Sales Team — `d2000000-0000-4000-8000-000000000001`
  - CORE Test Agent A1 — `d1000000-0000-4000-8000-000000000003`
  - CORE Test Agent A2 — `d1000000-0000-4000-8000-000000000004`
  - CORE Test Sales Manager — `d1000000-0000-4000-8000-000000000002`

No-conversation scope check:

- CORE Test Leasing Team — `d2000000-0000-4000-8000-000000000002`
  - CORE Test Leasing Manager — `d1000000-0000-4000-8000-000000000005`
  - `agentIds: []`; no conversation is assigned to this team.

Excluded: CORE Test Agent B1 (Listing Agent; no WhatsApp workspace access) and
all UAT158 accounts (they have phone numbers).

No account is created. Both teams are activated only for the approved run and
deactivated after accepted cleanup.

## 4. Exact team-state checks and changes

Before activation, run the committed `tools/wn15-team-state-readonly.sql`
unchanged with `PGOPTIONS='-c default_transaction_read_only=on'`. It must show:

- exactly the two named teams, both inactive;
- exactly the four named active accounts;
- `.invalid` non-delivery email for each account and no phone number.

Activation is through the existing audited Admin API, not direct SQL:

```text
PATCH /api/crm/teams/d2000000-0000-4000-8000-000000000001  {"active":true}
PATCH /api/crm/teams/d2000000-0000-4000-8000-000000000002  {"active":true}
```

The session token stays in `NYSA_SIMULATION_SESSION_TOKEN`; it is never printed
or included in a command argument. Each response must identify the same team,
manager and `active=true`. Run the same read-only SQL again and require exactly
two active teams before creating the simulation run.

After cleanup acceptance, reverse through the same audited API:

```text
PATCH /api/crm/teams/d2000000-0000-4000-8000-000000000001  {"active":false}
PATCH /api/crm/teams/d2000000-0000-4000-8000-000000000002  {"active":false}
```

Run the same read-only SQL once more and require both teams inactive. Any
identity or state mismatch stops without further change.

## 5. Database-only recovery point

Before team activation, create one new database-only PostgreSQL 13.23 custom
format dump in an absent path under:

`/home/nysareal/crm-release-preparation/20261111-wn15/recovery/run-a-pre-5703868/`

Controls:

1. Compare `pg_dump --version` with server `13.23`; stop on mismatch.
2. Read credentials privately from the existing CRM Test application
   configuration; never print them or place the password in the command line.
3. Use `pg_dump -Fc` for only `nysareal_nysa_dev247_smoke`.
4. Record size and raw `sha256sum` output.
5. Require `pg_restore --list` to open the dump and independently confirm 306
   public tables and 111 enabled triggers against the live database/contract.
6. Keep this dump until Run A/B/C cleanup and evidence are accepted. There is
   no automatic restore and no full application archive.

## 6. External-write isolation

- The loader calls only CRM Test's authenticated simulator inbound/read routes
  (`tools/whatsapp-simulation-load.mjs`, load requests).
- The route handles simulator events in process
  (`src/routes/whatsapp-simulated-provider.js`, `submitInProcess`) and reports
  `externalNetwork:false`.
- The simulator guard rejects external provider hosts
  (`src/whatsapp-simulated-provider.js`, `external-provider-host-blocked`).
- Inbound creates only a CORE inbox notification for its selected owner
  (`src/whatsapp-simulated-provider-store.js`). Owners are restricted to A1/A2,
  so no real staff account receives a notification.
- No email, SMS, live WhatsApp or external notification sender is invoked by
  this path.

### 6.1 Exact scheduled-job and notification impact

The code path was traced from the exact DEV269 source. For each Run A inbound,
`ingestSimulatedInbound` creates one Contact, one Lead, one conversation, one
inbound message and, because an Agent is assigned, one
`wa_inbox_notifications` row with `notification_type='new_message'`
(`src/whatsapp-simulated-provider-store.js`, `ingestSimulatedInbound`). The
notification recipient is only the selected synthetic owner Agent. With the
approved allocation, those recipients are CORE Test Agent A1 and A2; the CORE
Test Managers and all real staff receive no notification row.

Every scheduled or deferred path that could appear relevant was checked:

| Path | Can it act on Run A rows? | Recipient/effect |
|---|---|---|
| Lead-response/nonvoice dispatch | No. The dispatcher selects `lead_follow_up_cases` and `lead_follow_up_jobs`; simulator inbound creates neither. It is also not started by `src/server.js`. | No email, WhatsApp or staff task. |
| WEB intake reconciliation, overdue escalation and stale release | No. The only conditional background worker started for this area is `startWebIntakeWorker`; its workflow selects WEB intake journeys/cases. Run A creates no WEB journey, provisional identity, follow-up case or Task. | None. |
| Lead SLA/acceptance/first-contact timers | No. Run A's Lead insert does not set assignment, acceptance, first-contact or next-follow-up due fields and creates no timer/job row. | None. |
| Overdue task/dashboard calculations | No scheduled action. Run A creates no Task. Dashboard queries are read-only when a user opens them. | No notification. |
| Digest/email/SMS jobs | No digest worker is registered by `src/server.js`; no email or SMS sender is called from the simulator store. | None. |
| Payout-advice worker | No. The other worker started by `src/server.js` selects only `agent_payout_advices`. | None. |
| Lead triggers | `leads_assign_reference` assigns the Lead reference. `leads_close_follow_ups` sees a non-terminal new Lead and has no follow-up to close. `leads_stage_transition_guard` is update-only. | Database-only; no notification or external send. |
| WhatsApp inbox notification | Yes, exactly one per conversation. | A1/A2 only, in CORE's inbox. No email, SMS or live WhatsApp. |

Managers may be able to see team conversations by opening the workspace, but
that is a user-initiated scoped read, not a scheduled job or notification.
Run A is refused if a pre-run code/hash check shows any additional worker,
trigger or notification path. Cleanup removes the 500 run-linked Leads,
Contacts, conversations, messages and A1/A2 inbox notifications.

### 6.2 Admin session and private simulator configuration

No password or session token is shared with the developer or placed in chat,
an argument, a receipt or shell history:

1. Ajit enters the Admin password himself at a hidden (`read -s`) cPanel
   Terminal prompt. The standard `POST /api/auth/login` route creates a new
   random 32-byte session token; only its SHA-256 is stored in `sessions`
   (`src/auth.js`, `createSession`). The response's HttpOnly cookie is captured
   to a mode-`0600` temporary cookie jar under a `umask 077` shell.
2. The cookie value is loaded only into the current shell's private
   `NYSA_SIMULATION_SESSION_TOKEN` environment variable. It is not echoed and
   is not included in the process arguments. The password variable is unset
   immediately after login.
3. A shell exit/interrupt trap and the normal completion path both call the
   standard authenticated `POST /api/auth/logout`, which deletes the hashed
   session row, then unset the token and remove the private cookie jar. The
   run is not handed over until `/api/me` with that token returns `401`.

If Ajit is not present to enter the password privately, the run does not
start. An existing long-lived browser cookie is not copied or reused.

The load process reads the exact CRM Test selector registration privately
through `cloudlinux-selector get --json` with stdout captured in memory, checks
the exact domain and application root, and passes only these registered names
to the child process without printing their values:

- `WHATSAPP_SIMULATED_PROVIDER_ENABLED` (must be `true`);
- `LEAD_RESPONSE_ENVIRONMENT` (must be `crm-test`);
- `WHATSAPP_SIMULATED_PROVIDER_URL` (must be the loopback simulator route);
- `WHATSAPP_SIMULATED_PROVIDER_TOKEN` (must be present and at least 32
  characters; value withheld);
- `WHATSAPP_SIMULATED_PHONE_PREFIX` and
  `WHATSAPP_SIMULATED_PHONE_SUFFIX_DIGITS` (must cover the approved synthetic
  range).

The committed loader then imports the exact deployed
`src/whatsapp-simulated-provider.js` and runs
`assertSimulatedProviderEnvironment` before the first request. The guard also
fails if a live WhatsApp key is present. Selector JSON, token values and live
environment values are never written to stdout, stderr or evidence.

The simulator control remains **paused** with fault mode `none` before, during
and after Run A. This is deliberate: `submitSimulatedMessage` and
`submitSimulatedTemplate` enforce the pause, while the Admin inbound route
builds and accepts the inbound event in-process without changing or bypassing
the outbound control. If the first inbound does not succeed while the control
is paused, Run A stops; the simulator is not unpaused.

## 7. Run A definition and exact load command

Create one run record with this exact body:

```json
{
  "seed": "wn15-run-a-20261111",
  "conversations": 500,
  "messages": 0,
  "optOuts": 0,
  "rate": 5,
  "configuration": {
    "phoneStartOffset": 100000,
    "teamCount": 2,
    "agentCount": 2,
    "teams": [
      {
        "teamId": "d2000000-0000-4000-8000-000000000001",
        "managerId": "d1000000-0000-4000-8000-000000000002",
        "agentIds": [
          "d1000000-0000-4000-8000-000000000003",
          "d1000000-0000-4000-8000-000000000004"
        ]
      },
      {
        "teamId": "d2000000-0000-4000-8000-000000000002",
        "managerId": "d1000000-0000-4000-8000-000000000005",
        "agentIds": []
      }
    ]
  }
}
```

After the returned UUID is stored privately as `WN15_RUN_A_ID`, run exactly:

```text
/opt/alt/alt-nodejs24/root/usr/bin/node /home/nysareal/crm-release-preparation/20261111-wn15/tools/whatsapp-simulation-load.mjs --app-root /home/nysareal/nysa-core-dashboard-dd6262a-stage --run "$WN15_RUN_A_ID" --url https://crm-test.nysarealty.com --phone-start-offset 100000 --team-count 2 --agent-count 2 --workers 5 --receipt /home/nysareal/crm-release-preparation/20261111-wn15/run-a/WN15_RUN_A_LOAD_RECEIPT.json
```

Expected receipt: 500 requested/completed, zero failed, range
`+971509100000` through `+971509100499`, two teams, two Agents, Sales allocation
2 and Leasing allocation 0. The tool stops at the first failed request.

## 8. Monitoring and abort conditions

Before any mutation, confirm read-only whether `www.nysarealty.com` is mapped to
the same `nysareal` cPanel account. If this cannot be proven, stop.

Record before, every five seconds during, and after Run A:

- CRM Test health/readiness/root status and response time;
- Production health/readiness/root status and response time;
- `www.nysarealty.com` root status and response time;
- cPanel/CloudLinux account CPU percentage, memory percentage and any limit or
  fault counter.

The exact read-only CloudLinux account command, invoked once per sample and
captured verbatim with a UTC timestamp, is:

```text
date -u +%Y-%m-%dT%H:%M:%SZ; /usr/sbin/lveinfo --user=nysareal --period=1m --style=user --show-all --json
```

This is the account aggregate, not a process estimate. Its CPU and physical
memory usage are compared with the reported limits, and all reported CPU,
physical/virtual-memory, entry-process, process-count, IO and IOPS fault
counters are compared with the immediately preceding sample. If the binary,
permissions, JSON output, usage, limits or fault fields are unavailable, the
preflight fails and no load starts; no substitute command is improvised.

If the approved resource tool exposes CPU and memory usage plus limits but no
fault counters, any HTTP `503` or `508` response from CRM Test, Production or
`www.nysarealty.com` is treated as a CloudLinux limit hit and aborts the run.
The 80% CPU/memory threshold and the response-time abort rules below remain in
force.

Abort the exact load-tool process immediately and create no further work if:

- any load request fails;
- any monitored service returns a non-success response or times out;
- Production or website response time exceeds both twice its pre-run median and
  the median plus 500 ms for two consecutive samples, or exceeds 3 seconds once;
- disk usage reaches 90% or more of its limit;
- any reported `uapi ResourceUsage get_usages` limit reaches 80% or more for
  CPU, physical memory, entry processes, process count, IOPS or I/O, or any
  available CloudLinux limit/fault counter increases;
- CRM Test readiness/database state changes, or exact-root worker verification
  is no longer exactly one after a readiness request.

No broad process kill is allowed. The load PID must be recorded before start;
only that exact process may be stopped for an abort. Claude performs Agent and
Manager screen checks; there is no 20-session browser load.

## 9. Cleanup plan (separate later approval)

1. Pause the simulator.
2. Run cleanup `dry-run` for exactly `WN15_RUN_A_ID`; save counts, fingerprint
   and receipt hash.
3. Review and separately approve the exact dry-run receipt.
4. Run cleanup `apply` once with that receipt and SHA-256.
5. Require zero remaining run-linked conversations, messages, notifications,
   Leads, Contacts, assignment history and run-created suppression restrictions.
6. Keep exactly one run record with status `cleaned` and retain every provider
   event; keep the cleanup audit row.
7. Deactivate the two CORE Test teams and prove their final state read-only.
8. Keep the database recovery dump until the cleanup evidence is accepted.

No restore step is part of normal cleanup. Database restore would require a
separate exact approval.

The built-in HTTP cleanup routes are explicitly prohibited for WN-15:

- `POST /api/admin/whatsapp-simulation/runs/:id/cleanup` is not called;
- `POST /api/admin/whatsapp-simulation/cleanup` is not called.

Cleanup is performed only by the reviewed, hash-pinned
`tools/whatsapp-simulation-cleanup.mjs`, first in `dry-run` mode and then, after
separate approval of that receipt, once in `apply` mode. This preserves the run
record and provider events as required.

## 10. Approval still required

Nothing in this packet authorizes a hosted action. Before Run A, Ajit must
separately approve:

1. push/origin identity and placement of the exact committed WN-15 tools into
   the fresh preparation folder, with temporary paths, SHA-256 checks and atomic
   moves;
2. the read-only domain/account, baseline, worker and team-state checks;
3. the database-only recovery point;
4. activation of exactly the two CORE Test teams;
5. creation and execution of exactly Run A under the monitoring/abort rules.

Run B, Run C and cleanup remain separately approved operations.
