# WN-15 Approval 1 execution report

Scope: CRM Test only. Times below are UTC. Exact commands are preserved verbatim from the hosted shell history and their encoded payloads are also decoded into separate evidence files. No command in this report activated a team or created a WN-15 run.

## Attempt 1 — initial placement command

- Start: `2026-11-11T13:01:08Z` (shell history entry 974).
- Stop: during the same second; the only file created was `preflight/APPROVAL1_PLACEMENT_RESULT.txt`, whose hosted modification time is `2026-11-11T13:01:08.431771495Z` and size is zero. The command did not emit its `PLACEMENT_STARTED` marker, place a tool, or record a shell error.
- What completed: creation/opening of the zero-byte evidence file only.
- Why it stopped: the terminal execution was interrupted before the script emitted output. The hosted evidence does not contain a more specific shell exception, so the cause is recorded as **not captured**, not inferred.
- Exact command: `attempt-1-placement-exact-command.txt`.
- Decoded payload: `attempt-1-placement-decoded-payload.sh`.

## Attempt 2 — separately authorized replacement placement

- Authorization context: after Attempt 1 stopped, Ajit explicitly instructed “pl try again.” The label `RETRY2` means the second placement execution after that new instruction. It does **not** mean an automatic retry of the later read-only checks or recovery dump.
- Start: `2026-11-11T15:40:47Z` (`PLACEMENT_RETRY2_STARTED`).
- Stop: `2026-11-11T15:40:48Z` (`PLACEMENT_RETRY2_COMPLETED`).
- What completed: exact-commit download, SHA-256 verification, and atomic placement of the four approved files under `tools/`.
- Why it stopped: completed successfully; the command ended normally.
- Files created: the four `tools/` files and `preflight/APPROVAL1_RETRY2_PLACEMENT_RESULT.txt`.
- Exact command: `attempt-2-authorized-replacement-placement-exact-command.txt`.
- Decoded payload: `attempt-2-authorized-replacement-placement-decoded-payload.sh`.

## Attempt 3 — remaining Approval 1 checks and proposed recovery dump

- Start: `2026-11-11T15:48:13Z` (shell history entry 978). The read-only transaction reported `checked_at=2026-11-11 15:48:14.144962+00`.
- Stop: immediately after `preflight/APPROVAL1_RETRY2_TEAM_STATE.txt` was written; its hosted modification time is `2026-11-11T15:48:14.145810747Z`. The script did not emit a completion marker, so that file time is the last precise hosted timestamp.
- What completed in memory: CRM Test selector/database identity, installed DEV269 provenance, readiness plus exact-root worker verification, PostgreSQL identity, migration/table/trigger baseline; then the approved team-state query ran in a read-only transaction and rolled back.
- Why it stopped: the ephemeral parser incorrectly required team `active` to equal PostgreSQL text boolean `f`. CRM stores this column as integer `0`/`1`; both exact teams returned `0`. The query itself was correct and read-only.
- What did **not** run: website/account mapping, website response measurement, `lveinfo`, recovery-directory creation, `pg_dump`, `pg_restore --list`, and receipt creation.
- File created: `preflight/APPROVAL1_RETRY2_TEAM_STATE.txt` only.
- Exact command: `attempt-3-remaining-checks-exact-command.txt`.
- Decoded payload: `attempt-3-remaining-checks-decoded-payload.sh`.

## Hosted file inventory

The immutable hosted inventory lists 11 files under `/home/nysareal/crm-release-preparation/20261111-wn15/`. Four preflight files pre-date Approval 1 and are included because the requested evidence scope was every file under that directory. Approval 1 itself added the zero-byte first-attempt evidence, four tool files, the replacement-placement receipt, and the team-state output. No log or recovery-dump file exists.

- Hosted inventory: `audit/HOSTED_FILE_INVENTORY.txt`
- Hosted hashes: `audit/HOSTED_SHA256SUMS.txt`
- Exact local copies: `hosted/`
- Locally recomputed hashes: `LOCAL_SHA256SUMS.txt`
- Scripted comparison: `HASH_COMPARISON_RESULT.json`

## State continuity

No team activation, load run, cleanup, application mutation, database mutation, worker restart, or recovery dump occurred. The proposed resume remains unexecuted and requires separate written approval.
