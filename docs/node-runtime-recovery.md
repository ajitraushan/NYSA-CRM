# Node runtime recovery

This runbook is preparation only. It does not authorize a hosted restart or deployment.

## Safety boundary

- Do not probe a stopped application through its public URL because LiteSpeed may start a worker on demand.
- Do not start, restart, stop, or terminate Production or R2 while diagnosing CRM Test.
- Do not use `kill -KILL` as a normal restart mechanism.
- Use only the restart method confirmed by the hosting administrator.
- Keep all Property Finder outward-action switches disabled before a worker starts.

## Evidence to capture before termination

Capture only sanitized operational fields:

- unique PID and PPID;
- process or thread count;
- process state and elapsed runtime;
- exact application-root label for each `lsnode` worker;
- whether CloudLinux NPROC includes threads/tasks;
- relevant LiteSpeed, Node Selector and LVE lifecycle errors.

Never capture or print environment values, credentials, tokens, private contact data, or command arguments containing secrets.

## Controlled CRM Test recovery

1. Confirm the hosting restriction is lifted and NPROC has safe headroom.
2. Confirm the exact supported Node Selector restart method.
3. While CRM Test is stopped, verify every Property Finder action switch is saved as `0`.
4. Start CRM Test only.
5. Verify exactly one worker whose full label matches the CRM Test application root.
6. Verify process liveness through `/api/health`, then database readiness through `/api/readiness`, the installed version, and live action-switch values.
7. Stop on any duplicate worker, resource guard, unexpected status, or external-integration error.

## Application runtime controls prepared locally

- `/api/health` is a database-free Node process-liveness check. It must not create or borrow a PostgreSQL connection.
- `/api/readiness` performs one bounded `SELECT 1` through the shared pool and fails with sanitized HTTP 503 evidence when the database is unavailable.
- The PostgreSQL pool defaults to three connections and bounds connection acquisition, query duration, statement duration, idle transactions, idle connection age, total connection lifetime and connection reuse count.
- Explicit transactions release their checked-out client in a `finally` block. Ordinary queries and readiness checks use `pool.query()` without unmanaged checkout.
- The HTTP server bounds request duration, header duration, keep-alive duration and requests per socket.
- These controls are local source changes only until included in one reviewed, checksum-bound CRM-Test candidate. They do not authorize direct server editing or an additional restart.

Historical deployment scripts that combine `tmp/restart.txt` with direct `kill -KILL` require review before reuse.
