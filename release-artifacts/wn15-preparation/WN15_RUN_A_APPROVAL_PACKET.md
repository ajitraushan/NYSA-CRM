# WN-15 Run A approval packet

Prepared 13 November 2026. CRM Test only. Each hosted step requires its own written go after 20:00 Dubai. The reported account usage is approximately 42%. The scripts check the live quota.

This packet applies the mandatory hosted-worker verification in AGENTS.md and the hosted-deployment controls in CRM_CHANGE_POLICY.md. The installed application is DEV272, commit 54421912fc1496a1066814cd8b665c19c7e8fd45, at /home/nysareal/nysa-core-dashboard-dd6262a-stage. CRM Test install receipt 7840165c and smoke receipt 1eae2113 identify the baseline. The config (39680750) and install receipt identify PostgreSQL 13.23, database nysareal_nysa_dev247_smoke and role nysareal_nysar2app. The database has 172 migrations, 313 public tables and 113 enabled non-internal triggers. The common guard checks installed provenance, the pinned schema files, the observed schema contract, green readiness and one worker verified by exact command and cwd. The rollback point is the verified database-only dump from step A. A restore requires separate approval.

The selector guard checks the CRM Test registration and deployed simulator guard, including a loopback provider, no live WhatsApp keys, the synthetic prefix and six-digit suffix, and paused/no-fault simulator control. Digest sending and scheduling must be off. The only planned inbox notifications belong to the two synthetic owner Agents. The scope check verifies the exact two CORE Test teams and four active CORE Test users with non-delivery email and no phone, and checks the reserved range +971509100000 through +971509119999 across 16 sources. Run A uses its first 500 numbers.

For each written go, use agent-only SSH (disable identity files, no -i), capture full stdout and stderr directly to a new local file, preserve the exit code, and commit and push the receipt and report its SHA-256. Download the files from the reviewed origin commit into a fresh directory outside the application root and verify all required files using sha256sum -c and SHA256SUMS. The commands below run from that directory. The operator stops on any failure. A partial activation or aborted load is evidence for review before further changes.

Ajit supplies a fresh CRM Test Admin session privately using the existing login procedure with hidden password entry. The token is passed only in NYSA_SIMULATION_SESSION_TOKEN. Use the standard authenticated logout afterward, verify that the token receives 401 from /api/me, and clear private session material. The backup does not need an Admin session. Database credentials come privately from the exact selector registration and are passed only to PostgreSQL child processes.

## Read-only telemetry before Step A

Run the separately approved `./wn15-dev272-telemetry-readonly.sh` by file path from the fresh, hash-verified download directory. This check can run before 20:00 Dubai. Use agent-only SSH and capture the full stdout and stderr. The script runs each of Quota get_quota_info, DomainInfo list_domains and ResourceUsage get_usages once, retains their raw output, and prints each exit code. Inspect the JSON status and field availability as well as the process exit codes before clearing Step A.

Quota UAPI returned exit 1 in the saved inventory runs. If telemetry is unavailable, review the raw evidence before changing the runner. A possible fallback is an independently confirmed finite account quota with a conservative du-based usage estimate whose coverage and units are verified, plus the existing HTTP health, readiness, latency and limit-response stops. A filesystem df reading alone cannot establish account quota. If resource usage is unavailable, the fallback loses the 80% resource stop and needs explicit review. Production health and latency thresholds stay in force.

## A. Recovery backup

```sh
/opt/alt/alt-nodejs24/root/usr/bin/node ./wn15-dev272-recovery-backup.mjs
```

Creates the recovery parent if needed and requires a fresh child directory at /home/nysareal/crm-release-preparation/20261111-wn15/recovery/run-a-pre-dev272. Uses pg_dump 13.23 -Fc with normal owner and ACL handling. Checks the table of contents and decodes the archive to /dev/null to verify readability. Records dump and listing paths and hashes, dump size, quota and the full listing. No database restore is performed. The dump stays private on hosting.

## B. Team activation

```sh
/opt/alt/alt-nodejs24/root/usr/bin/node ./wn15-dev272-activate-teams.mjs
```

Rechecks the backup hash and four-hour freshness, unused numbers, synthetic identities and integer team state 0. PATCHes only the two pinned team UUIDs through the audited Admin API using active:1. Verifies both returned identities and integer state 1 in the database.

## C. Run A

```sh
/opt/alt/alt-nodejs24/root/usr/bin/node ./wn15-dev272-run-a.mjs
```

Creates one run, seed wn15-run-a-dev272-20261113, with 500 conversations, zero extra messages and opt-outs, two teams, two Agents assigned only to Sales, offset 100000, at most five new conversations per second and five workers. The wrapper supplies the exact child arguments and logs its PID. Inbound and mark-read writes go to CRM Test simulator routes. The fresh run-a-dev272 folder receives WN15_RUN_A_LOAD_RECEIPT.json.

Three pre-run samples establish per-endpoint medians. The runner checks CRM Test and Production health, readiness and root, plus the website root, before, every five seconds during load and after it. It stops on any load or probe error, timeout, a response taking three seconds, or two consecutive samples both above twice the median and more than 500 ms above it. It also stops on CRM Test worker change, quota at 90%, any sampled resource at 80%, an increasing available fault counter, or a five-minute load deadline. It signals only the child it spawned. An abort can leave run-scoped rows for later cleanup.

The runner expects DomainInfo list_domains to identify nysarealty.com as the account main domain, and ResourceUsage get_usages to return rows with id, usage, limit and optional faults for cpu, pmem, ep, nproc, iops and io. These interfaces are unverified on this hosting account. Missing or incompatible telemetry blocks the load before it creates a run. An HTTP 503 or 508 also aborts. Resource and quota probes time out after one second while sampling. Confirm the telemetry format through a separately approved read-only check before clearing the load.

Local verification: 15 focused simulator and WN-15 tests passed. Hosted PostgreSQL backup, team/API behavior and monitoring have not been rehearsed in this turn. See the separate WN15_RUN_A_CLEANUP_PLAN.md for later review.
