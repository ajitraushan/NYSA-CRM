# CRM Test dev.175 — deployment confirmed

Date: 2 September 2026. Owner authorization: “ok pl deploy”, followed by “done” after cPanel sign-in.
Target: https://crm-test.nysarealty.com/ only.

## Exact release and observed runtime

- Installed and served version: **2.1.0-dev.175**.
- Package: `nysa-core-consolidated-crm-test-dev175.zip`, 9,859,069 bytes, 308 entries.
- Package SHA-256: `80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`.
- Successfully executed installer SHA-256:
  `7c68194b80cb6dd8e2a18ca6964103154bc9930819d20ba76c94092b08402a11`.
- Health: `{"ok":true,"process":"ready","version":"2.1.0-dev.175"}`.
- Readiness: `{"ok":true,"database":"ready","version":"2.1.0-dev.175"}`.
- Registered migrations: **111**, latest `111_dev175_stage_draft_audit.sql`.
- Exact installed runtime manifest: verified. All 110 pre-existing migration bytes match the dev.174 archive.
- Final exact worker observation: **4184054**, `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`.
  One verified CRM Test LiteSpeed listener. A separate post-deployment process query confirmed the same single PID.
- Property Finder, Microsoft 365 and Calendly switches remained disabled. The protected Production and
  Production/R2 clone package.json hashes were unchanged before/after. Neither environment was an installation target.

## First pre-check and safe retry

The first attempt verified the application archive checksum, then stopped before backup or installation:

`FAIL: expected exactly one CRM Test LiteSpeed listeners; found 2`

Exact Test worker labels identified PIDs **198393** and **714383**. The first is the historical dev.174 worker;
the additional worker is a new observation, not a replacement of the old one-worker historical evidence.
No cause for the extra worker or link to the user's UAT defects is inferred.

The installer was revised to accept one or two **existing** exact Test workers, verify each owns the correct
CRM Test listener socket, and restart all verified Test instances together. Successful completion and an exact
rerun still require **one** worker. No hosting configuration, privilege or business rule was changed.
Revised Bash syntax and both package/installer tests passed before upload. The application archive did not change.

The retry completed with `Deployment confirmed`. Installer logs retained on the host:

- `/home/nysareal/crm-test-dev175-precheck-workers.log`
- `/home/nysareal/crm-test-dev175-deployment.log`

## Fresh rollback point

Created before application replacement:

`/home/nysareal/crm-backups/consolidated-crm-test-dev175-20260902T180327Z`

The containing directory is mode **700**. Both archives are non-empty; PostgreSQL archive listing and application
tar listing succeeded before install. Backup content was not downloaded or exposed in task output.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `pre-dev175.dump` | 1,280,904 | `e4c0aa13b8a30b10636d6927a5521d723e02c845f6902ffe62e838d99126c499` |
| `pre-dev175-app.tar.gz` | 9,498,367 | `0ba39059dd33a5c60e25c67800ca877d8d9a0bf67f67a95145cab7bd7f9d3176` |

The app archive includes the existing .env; .env and private evidence storage were not replaced by the package.
Rollback must preserve intervening user writes and audit rows: prefer reverting application files while retaining
additive migration 111 compatibility. A paired database restoration that discards intervening writes needs approval.
Never delete draft audit evidence merely to restore the prior audit CHECK constraint. No rollback was needed.

## Tests, evidence and acceptance boundary

- Release ordinary suite: **1,307 total / 1,266 passed / 41 protected skips / 0 failed**.
- Separately enabled targeted real-database regression: **11 passed / 0 failed**.
- Separate governed acceptance/reservation/Deal-lineage journey: **1 passed / 0 failed**.
- Browser skill used for authenticated cPanel upload, visible terminal operation and screenshot evidence.
- No production personal data was copied. No manual Lead, Booking, Deal, commission or closure repair was performed.
- All **12 user-reported issues remain open for human retest** on dev.175. Deployment health and local machine
  checks do not prove human UAT. The suspected original-record stage bypass and second Lead contact/pipeline
  interpretation remain explicit retest requirements.
- Existing Opportunity may be reopened after refreshing CRM Test; no replacement business record is required.

Evidence: `docs/uat-evidence/2026-09-02-dev175-deployment/01-deployment-health-worker.png`, SHA-256
`1898c8486e0f35b64e354d09208d9d81d54a0b7b0e1d58113a01f27cd9319950`;
backup checksum screenshot: `02-rollback-checksums.png` in the same directory.

Historical dev.174 facts remain intact: package SHA
`30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
one worker PID 198393 at that observation, automated **1,291 total / 1,261 passed / 30 protected skips / 0 failed**.
The old rollback point `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` was not restored.

Status: **deployment complete; human UAT pending**. Production, R2/Production clone and Property Finder excluded.
