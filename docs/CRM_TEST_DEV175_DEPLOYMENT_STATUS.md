# CRM Test dev.175 — deployed and verified

Latest status: **deployed successfully on 2 September 2026**. Health/readiness serve 2.1.0-dev.175;
migration 111 and one verified worker (PID 4184054) confirmed. Fresh backup:
`/home/nysareal/crm-backups/consolidated-crm-test-dev175-20260902T180327Z`.
See [deployment completion and retry evidence](CRM_TEST_DEV175_DEPLOYMENT_COMPLETION.md).
The sections below retain the earlier pre-deployment packaging/sign-in history; their paused status is superseded.

Date: 2 September 2026. Owner authorization: “ok pl deploy”.

## Verified local release identity

- Version: `2.1.0-dev.175` in package.json and package-lock.json.
- Package: `release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev175.zip`.
- SHA-256: `80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`.
- Size: 9,859,069 bytes; 308 archive entries; 111 migration files.
- Latest migration: `111_dev175_stage_draft_audit.sql`.
- Installer: `release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev175.sh`.
- Initial installer SHA-256: `4d1983ae4a16dd82e3a55db81f3cf923ef5fd2b167ce9d096455cee125ca448f`.
  Successful worker-safe revision: `7c68194b80cb6dd8e2a18ca6964103154bc9930819d20ba76c94092b08402a11`.
- Existing dev.174 package rehashed unchanged:
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`.

## Release validation

- Ordinary suite: **1,307 total / 1,266 passed / 41 protected skips / 0 failed**.
- Targeted enabled real-database suite: **11 passed / 0 failed**.
- Separate acceptance/reservation/Deal-lineage journey: **1 passed / 0 failed**.
- Two package/installer tests are included in the ordinary suite. They verify checksum binding, exact source
  runtime, all prior applied migration bytes, scope and backup-before-install ordering.
- Local Bash syntax validation passed with `bash -n` (read-only elevated execution was needed because the
  sandbox prevented Bash from creating its signal pipe).
- Initial release run had 19 failures solely from current-runtime version assertions still expecting dev.174.
  Those assertions now expect dev.175; historical package/baseline assertions remain unchanged. Full rerun passed.
- Package verification initially detected one missing trailing blank line each in migrations 101 and 106
  compared with the deployed dev.174 archive. Restored the exact archived bytes; SQL is unchanged. All 110 prior
  migration hashes now match dev.174. Raw `git diff --check` flags these two deliberately retained EOF blank
  lines; they must not be trimmed because preserving applied migration bytes takes precedence.
- Logs: `docs/dev175-release-tests.log`, `docs/dev175-release-db-tests.log`,
  `docs/dev175-release-journey-tests.log` (local generated artifacts).

## Earlier remote state — historical sign-in pause

cPanel at `https://jutee.tasjeel.ae:2083/` shows its login screen with “The security token is missing from your
request.” The owner was asked to sign in manually in the opened browser tab, without sending credentials.

No upload, remote application mutation, remote migration, restart or business-record change was performed.
A fresh paired remote backup has **not yet been created**; that is mandatory before the guarded installer
changes files. No claim is made about current live health or worker count in this attempt. The last confirmed
CRM Test deployment remains dev.174 / migration 110 / one worker, with historical automated result
1,291 total / 1,261 passed / 30 protected skips / 0 failed.

Next: after cPanel sign-in, upload the new ZIP, checksum, JSON manifest and guarded installer to
`/home/nysareal/` without replacing dev.174; verify hashes and run the guarded CRM Test-only installer.
It verifies the precise Test root/database and baseline, retains a mode-700 fresh PostgreSQL/application
backup, checks backup readability, preserves .env and private storage, restarts only verified Test workers,
and requires version 175 health/readiness, migration 111, exact runtime manifest and one worker.

Production, the Production/R2 clone and Property Finder are excluded. No new production personal data was
accessed. All 12 reported issues remain pending deployed human retest; no human pass inferred.
Rollback/backup requirements are in `CRM_TEST_DEV175_DEPLOYMENT_PLAN.md` and
`CRM_TEST_DEV175_UAT_REMEDIATION.md`; retain the existing local pre-edit archive.
