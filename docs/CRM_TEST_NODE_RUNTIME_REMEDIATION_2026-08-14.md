# CRM Test Node runtime remediation

Status: implemented and verified locally; not deployed and not applied to the hosting configuration.

## Owner decision

Small changes are consolidated locally. CRM Test receives one reviewed, numbered and checksum-bound
candidate in one maintenance window with one restart. R2 clone and Production receive only the exact
frozen candidate after the mandatory acceptance sequence. Production is never used for iterative
restart-based development.

## Application controls included in the consolidated candidate

- Database-free `GET /api/health` for Node process liveness and installed version.
- Separate bounded `GET /api/readiness` for PostgreSQL readiness.
- PostgreSQL pool maximum 3, idle and acquisition limits, bounded query and statement duration,
  idle-transaction termination, maximum connection lifetime and maximum connection usage count.
- Explicit transactions release their client in `finally`; readiness uses `pool.query()` without
  unmanaged checkout.
- Sanitized handling of unexpected idle pool-client errors.
- HTTP request, header, keep-alive and requests-per-socket bounds.
- Graceful SIGTERM/SIGINT shutdown closes HTTP and database resources.
- A read-only stability verifier proves the same exact worker PID survives liveness, readiness and a
  repeated liveness request while all Property Finder Production action switches remain zero.

## Hosting control requiring Tasjeel administrator action

CloudLinux Node.js Selector is hosted through a Passenger-compatible selector, but LiteSpeed uses a
different implementation. LiteSpeed documents support for only a limited group of Passenger mapping
directives. `PassengerMinInstances`, `PassengerMaxInstances` and `PassengerPoolIdleTime` are not in
that supported LiteSpeed list. Phusion Passenger additionally documents `PassengerMaxInstances` as
Enterprise-only and `PassengerPoolIdleTime` as server-configuration-only.

Therefore these three lines must not be added blindly to the application `.htaccess`. The correct
hosting-side control is for Tasjeel to identify the LiteSpeed/CloudLinux external application owning
the socket `APVH_crm-test.nysarealty.com` and set its effective application **Instances** value to
exactly `1`, or apply the supported per-application single-instance equivalent for their installed
LiteSpeed/CloudLinux versions. Max Connections must not be reduced to one merely to limit process
instances; a single Node process can serve concurrent requests.

Tasjeel must confirm after the change:

1. exact virtual host and application root;
2. effective external-application instance count `1`;
3. effective startup and idle lifecycle settings;
4. the supported restart mechanism that terminates every worker for this application root;
5. process listing before the first request;
6. database-free `/api/health`, bounded `/api/readiness`, then `/api/health` again;
7. the same single PID after every request; and
8. no stale UNIX socket or detached worker remains.

No Property Finder read, draft-create or publish switch may be enabled until the stability verifier
returns `RESULT=PASS` with one unchanged PID.

## Deployment boundary

This remediation is not a standalone micro-deployment. It will be packaged with the next owner-approved
consolidated CRM Test candidate after the local functional scope is frozen. The candidate must take a
backup, verify environment identity and checksum, install once, restart once, run liveness/readiness
stability, verify the migration level, and confirm all external-action switches remain disabled.
